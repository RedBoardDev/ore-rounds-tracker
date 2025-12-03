import type { AccountInfo } from "@solana/web3.js";
import { getSolanaConnection } from "../infrastructure/solana/connection.js";
import { BOARD_ADDRESS } from "../infrastructure/solana/pda.js";
import {
  decodeBoardAccount,
  isRoundActive,
  getRemainingSlots,
  type BoardAccount,
} from "../infrastructure/solana/decoders/board.decoder.js";
import { getLogger } from "../shared/logger.js";

/**
 * Events emitted by the BoardWatcher.
 *
 * Two-phase timing:
 * 1. onPricesFetchTrigger: Early trigger (~15 slots) for stable data (prices, mining cost)
 * 2. onEvSnapshotTrigger: Late trigger (~5 slots) for volatile data (board state, EV)
 */
export interface BoardWatcherEvents {
  /** Phase 1: Emitted early for fetching prices/mining cost (stable data) */
  onPricesFetchTrigger: (board: BoardAccount, remainingSlots: number, currentSlot: bigint) => void;
  /** Phase 2: Emitted late for board state + EV snapshot (volatile data, like smart-bot) */
  onEvSnapshotTrigger: (board: BoardAccount, remainingSlots: number, currentSlot: bigint) => void;
  /** Emitted when board.roundId increments (new round started) */
  onPostFinTrigger: (previousRoundId: bigint, newBoard: BoardAccount) => void;
  /** Emitted on any board update */
  onBoardUpdate: (board: BoardAccount) => void;
}

/**
 * Board Watcher - monitors board state via WebSocket with HTTP fallback.
 *
 * Two-phase triggers:
 * - Phase 1 (prices fetch): when remaining_slots <= preFinThresholdSlots (~15)
 * - Phase 2 (EV snapshot): when remaining_slots <= evSnapshotSlots (~5)
 * - Post-fin: when board.roundId increments
 */
export class BoardWatcher {
  private readonly logger = getLogger().child("BoardWatcher");
  private subscriptionId: number | null = null;
  private lastBoard: BoardAccount | null = null;
  private pricesFetchTriggeredForRound: bigint | null = null;
  private evSnapshotTriggeredForRound: bigint | null = null;
  private isRunning = false;
  private httpPollIntervalId: ReturnType<typeof setInterval> | null = null;

  // * HTTP fallback settings
  private lastWsUpdate = 0;
  private readonly WS_STALE_THRESHOLD_MS = 5_000; // Consider WS stale after 5s
  private readonly HTTP_POLL_INTERVAL_MS = 2_000; // Poll every 2s when WS is stale

  constructor(
    private readonly preFinThresholdSlots: number,
    private readonly evSnapshotSlots: number,
    private readonly events: BoardWatcherEvents
  ) {}

  /**
   * Start watching the board.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("BoardWatcher already running");
      return;
    }

    this.isRunning = true;
    this.logger.info("Starting BoardWatcher", {
      pricesFetchThreshold: this.preFinThresholdSlots,
      evSnapshotThreshold: this.evSnapshotSlots,
    });

    // * Fetch initial board state
    await this.fetchAndProcessBoard();

    // * Subscribe to WebSocket updates
    this.subscribeToBoard();

    // * Start HTTP fallback polling
    this.startHttpFallback();
  }

  /**
   * Stop watching the board.
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.subscriptionId !== null) {
      await getSolanaConnection().unsubscribeFromAccount(this.subscriptionId);
      this.subscriptionId = null;
    }

    if (this.httpPollIntervalId !== null) {
      clearInterval(this.httpPollIntervalId);
      this.httpPollIntervalId = null;
    }

    this.logger.info("BoardWatcher stopped");
  }

  /**
   * Subscribe to board account changes via WebSocket.
   */
  private subscribeToBoard(): void {
    const connection = getSolanaConnection();

    this.subscriptionId = connection.subscribeToAccount(
      BOARD_ADDRESS,
      (accountInfo) => {
        this.lastWsUpdate = Date.now();
        this.processAccountInfo(accountInfo);
      }
    );

    this.logger.debug("Subscribed to board account via WebSocket");
  }

  /**
   * Start HTTP fallback polling for when WS is stale.
   */
  private startHttpFallback(): void {
    this.httpPollIntervalId = setInterval(async () => {
      if (!this.isRunning) return;

      const timeSinceWsUpdate = Date.now() - this.lastWsUpdate;

      if (timeSinceWsUpdate > this.WS_STALE_THRESHOLD_MS) {
        this.logger.debug("WS stale, using HTTP fallback", {
          staleDurationMs: timeSinceWsUpdate
        });
        await this.fetchAndProcessBoard();
      }
    }, this.HTTP_POLL_INTERVAL_MS);
  }

  /**
   * Fetch board state via HTTP and process it.
   */
  private async fetchAndProcessBoard(): Promise<void> {
    try {
      const connection = getSolanaConnection();
      const accountInfo = await connection.getAccountInfo(BOARD_ADDRESS);

      if (accountInfo) {
        this.processAccountInfo(accountInfo);
      }
    } catch (error) {
      this.logger.warn("Failed to fetch board via HTTP", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process board account data.
   */
  private processAccountInfo(accountInfo: AccountInfo<Buffer>): void {
    try {
      const board = decodeBoardAccount(accountInfo.data);
      this.processBoard(board);
    } catch (error) {
      this.logger.error("Failed to decode board account", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process decoded board data and emit events.
   */
  private processBoard(board: BoardAccount): void {
    const previousBoard = this.lastBoard;
    this.lastBoard = board;

    // * Emit board update event
    this.events.onBoardUpdate(board);

    // * Check for post-fin trigger (round ID changed)
    if (previousBoard && board.roundId > previousBoard.roundId) {
      this.logger.info("Round changed, triggering post-fin", {
        previousRoundId: previousBoard.roundId.toString(),
        newRoundId: board.roundId.toString(),
      });

      // * Reset triggers for the new round
      this.pricesFetchTriggeredForRound = null;
      this.evSnapshotTriggeredForRound = null;

      this.events.onPostFinTrigger(previousBoard.roundId, board);
    }

    // * Check for two-phase triggers
    if (isRoundActive(board)) {
      const currentSlot = getSolanaConnection().getCurrentSlot();
      const remainingSlots = getRemainingSlots(board, currentSlot);

      // * Phase 1: Prices fetch trigger (early, ~15 slots)
      if (
        remainingSlots >= 0 &&
        remainingSlots <= this.preFinThresholdSlots &&
        this.pricesFetchTriggeredForRound !== board.roundId
      ) {
        this.logger.info("Phase 1: Prices fetch trigger", {
          roundId: board.roundId.toString(),
          remainingSlots,
          threshold: this.preFinThresholdSlots,
        });

        this.pricesFetchTriggeredForRound = board.roundId;
        this.events.onPricesFetchTrigger(board, remainingSlots, currentSlot);
      }

      // * Phase 2: EV snapshot trigger (late, ~5 slots - like smart-bot)
      if (
        remainingSlots >= 0 &&
        remainingSlots <= this.evSnapshotSlots &&
        this.evSnapshotTriggeredForRound !== board.roundId
      ) {
        this.logger.info("Phase 2: EV snapshot trigger", {
          roundId: board.roundId.toString(),
          remainingSlots,
          threshold: this.evSnapshotSlots,
        });

        this.evSnapshotTriggeredForRound = board.roundId;
        this.events.onEvSnapshotTrigger(board, remainingSlots, currentSlot);
      }
    }
  }

  /**
   * Get the current board state.
   */
  getCurrentBoard(): BoardAccount | null {
    return this.lastBoard;
  }

  /**
   * Force a refresh of the board state.
   */
  async forceRefresh(): Promise<BoardAccount | null> {
    await this.fetchAndProcessBoard();
    return this.lastBoard;
  }
}

