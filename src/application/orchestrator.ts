/**
 * Orchestrator - Main collector coordination.
 *
 * Two-phase collection:
 * - Phase 1 (~15 slots): Fetch prices and mining cost (stable data)
 * - Phase 2 (~5 slots): Fetch board state and calculate EV (volatile data, like smart-bot)
 *
 * Wires together:
 * - Board watcher (triggers)
 * - Use cases (pre-fin, post-fin)
 * - Repository (persistence)
 * - Notifier (alerts)
 */

import type { BoardAccount } from "../infrastructure/solana/decoders/board.decoder.js";
import type { PriceQuote } from "../domain/entities/price.entity.js";
import type { MiningCostData } from "../domain/entities/mining-cost.entity.js";
import type { IRoundRepository } from "../domain/interfaces/round.repository.js";
import type { INotifier } from "../domain/interfaces/notifier.js";
import { BoardWatcher, type BoardWatcherEvents } from "../presentation/board-watcher.js";
import { JupiterPriceFetcher } from "../infrastructure/fetchers/jupiter-price.fetcher.js";
import { MiningCostFetcher } from "../infrastructure/fetchers/mining-cost.fetcher.js";
import { collectPreFin, type CachedPhase1Data } from "./use-cases/collect-pre-fin.js";
import { completePostFin, completePendingRounds } from "./use-cases/complete-post-fin.js";
import { getLogger } from "../shared/logger.js";

const logger = getLogger().child("Orchestrator");

export interface OrchestratorConfig {
  preFinThresholdSlots: number;
  evSnapshotSlots: number;
}

/**
 * Cached data from Phase 1 (prices fetch).
 */
interface Phase1Cache {
  roundId: bigint;
  priceQuote: PriceQuote;
  miningCost: MiningCostData;
  fetchedAt: number;
}

export class Orchestrator {
  private boardWatcher: BoardWatcher | null = null;
  private readonly priceFetcher = new JupiterPriceFetcher();
  private readonly miningCostFetcher = new MiningCostFetcher();

  // * Phase 1 cache - prices and mining cost fetched early
  private phase1Cache: Phase1Cache | null = null;

  // * Track in-flight operations to prevent duplicates
  private phase1InFlight = new Set<string>();
  private phase2InFlight = new Set<string>();
  private postFinInFlight = new Set<string>();

  constructor(
    private readonly config: OrchestratorConfig,
    private readonly repository: IRoundRepository,
    private readonly notifier: INotifier
  ) {}

  /**
   * Start the orchestrator.
   */
  async start(): Promise<void> {
    logger.info("Starting orchestrator", { config: this.config });

    // * Complete any pending rounds from previous sessions
    await completePendingRounds({
      repository: this.repository,
      notifier: this.notifier,
    });

    // * Create board watcher with two-phase event handlers
    const events: BoardWatcherEvents = {
      onPricesFetchTrigger: (board, remainingSlots, currentSlot) => {
        this.handlePhase1PricesFetch(board, remainingSlots, currentSlot);
      },
      onEvSnapshotTrigger: (board, remainingSlots, currentSlot) => {
        this.handlePhase2EvSnapshot(board, remainingSlots, currentSlot);
      },
      onPostFinTrigger: (previousRoundId, newBoard) => {
        this.handlePostFinTrigger(previousRoundId, newBoard);
      },
      onBoardUpdate: (board) => {
        // * Optional: log board updates for debugging
        logger.debug("Board updated", {
          roundId: board.roundId.toString(),
          endSlot: board.endSlot.toString(),
        });
      },
    };

    this.boardWatcher = new BoardWatcher(
      this.config.preFinThresholdSlots,
      this.config.evSnapshotSlots,
      events
    );
    await this.boardWatcher.start();

    logger.info("Orchestrator started successfully");
  }

  /**
   * Stop the orchestrator.
   */
  async stop(): Promise<void> {
    logger.info("Stopping orchestrator");

    if (this.boardWatcher) {
      await this.boardWatcher.stop();
      this.boardWatcher = null;
    }

    // * Wait for in-flight operations to complete
    const maxWaitMs = 10_000;
    const startWait = Date.now();

    while (
      (this.phase1InFlight.size > 0 || this.phase2InFlight.size > 0 || this.postFinInFlight.size > 0) &&
      Date.now() - startWait < maxWaitMs
    ) {
      logger.debug("Waiting for in-flight operations", {
        phase1: this.phase1InFlight.size,
        phase2: this.phase2InFlight.size,
        postFin: this.postFinInFlight.size,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    logger.info("Orchestrator stopped");
  }

  /**
   * Phase 1: Fetch prices and mining cost early (~15 slots).
   * These are stable data that don't change rapidly.
   */
  private handlePhase1PricesFetch(
    board: BoardAccount,
    _remainingSlots: number,
    _currentSlot: bigint
  ): void {
    const roundId = board.roundId.toString();

    // * Prevent duplicate operations
    if (this.phase1InFlight.has(roundId)) {
      logger.debug("Phase 1 already in flight, skipping", { roundId });
      return;
    }

    this.phase1InFlight.add(roundId);

    // * Execute async without blocking
    this.fetchAndCachePrices(board.roundId)
      .catch((error) => {
        logger.error("Phase 1 prices fetch failed", {
          roundId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.phase1InFlight.delete(roundId);
      });
  }

  /**
   * Fetch prices and mining cost, cache for Phase 2.
   */
  private async fetchAndCachePrices(roundId: bigint): Promise<void> {
    const fetchStart = Date.now();

    logger.info("Phase 1: Fetching prices and mining cost", {
      roundId: roundId.toString(),
    });

    // * Parallel fetch prices and mining cost
    const [priceQuote, miningCost] = await Promise.all([
      this.priceFetcher.fetch(),
      this.miningCostFetcher.fetch(),
    ]);

    // * Cache for Phase 2
    this.phase1Cache = {
      roundId,
      priceQuote,
      miningCost,
      fetchedAt: fetchStart,
    };

    logger.info("Phase 1: Prices cached", {
      roundId: roundId.toString(),
      oreSol: priceQuote.oreSol.toFixed(4),
      miningCostPct: miningCost.evPercent.toFixed(2),
      fetchTimeMs: Date.now() - fetchStart,
    });
  }

  /**
   * Phase 2: EV snapshot - fetch board state and calculate EV (~5 slots).
   * This is the critical timing - matches smart-bot behavior.
   */
  private handlePhase2EvSnapshot(
    board: BoardAccount,
    remainingSlots: number,
    currentSlot: bigint
  ): void {
    const roundId = board.roundId.toString();

    // * Prevent duplicate operations
    if (this.phase2InFlight.has(roundId)) {
      logger.debug("Phase 2 already in flight, skipping", { roundId });
      return;
    }

    this.phase2InFlight.add(roundId);

    // * Get cached Phase 1 data (prices, mining cost)
    const cachedData = this.getCachedPhase1Data(board.roundId);

    // * Execute async without blocking
    collectPreFin(
      { board, remainingSlots, currentSlot },
      {
        repository: this.repository,
        notifier: this.notifier,
        priceFetcher: this.priceFetcher,
        miningCostFetcher: this.miningCostFetcher,
      },
      cachedData
    )
      .catch((error) => {
        logger.error("Phase 2 EV snapshot failed", {
          roundId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.phase2InFlight.delete(roundId);
        // * Clear cache after use
        if (this.phase1Cache?.roundId === board.roundId) {
          this.phase1Cache = null;
        }
      });
  }

  /**
   * Get cached Phase 1 data if available and valid.
   */
  private getCachedPhase1Data(roundId: bigint): CachedPhase1Data | undefined {
    if (this.phase1Cache && this.phase1Cache.roundId === roundId) {
      return {
        priceQuote: this.phase1Cache.priceQuote,
        miningCost: this.phase1Cache.miningCost,
        fetchedAt: this.phase1Cache.fetchedAt,
      };
    }
    return undefined;
  }

  /**
   * Handle post-fin trigger from board watcher.
   */
  private handlePostFinTrigger(previousRoundId: bigint, newBoard: BoardAccount): void {
    const roundId = previousRoundId.toString();

    // * Prevent duplicate operations
    if (this.postFinInFlight.has(roundId)) {
      logger.debug("Post-fin already in flight, skipping", { roundId });
      return;
    }

    this.postFinInFlight.add(roundId);

    // * Execute async without blocking
    completePostFin(
      { previousRoundId, newBoard },
      {
        repository: this.repository,
        notifier: this.notifier,
      }
    )
      .catch((error) => {
        logger.error("Unhandled error in post-fin completion", {
          roundId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.postFinInFlight.delete(roundId);
      });
  }

  /**
   * Get current status.
   */
  getStatus(): {
    currentRoundId: bigint | null;
    phase1InFlight: number;
    phase2InFlight: number;
    postFinInFlight: number;
    hasCachedPrices: boolean;
  } {
    return {
      currentRoundId: this.boardWatcher?.getCurrentBoard()?.roundId ?? null,
      phase1InFlight: this.phase1InFlight.size,
      phase2InFlight: this.phase2InFlight.size,
      postFinInFlight: this.postFinInFlight.size,
      hasCachedPrices: this.phase1Cache !== null,
    };
  }
}

