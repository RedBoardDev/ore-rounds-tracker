/**
 * Pre-Fin Collection Use Case (Phase 2: EV Snapshot)
 *
 * Two-phase collection:
 * - Phase 1 (earlier): Prices and mining cost are pre-fetched and cached
 * - Phase 2 (this): Board state snapshot + EV calculation at ~5 slots
 *
 * Orchestrates:
 * 1. Use cached prices OR fetch if not available
 * 2. Fetch round state (this is the critical timing!)
 * 3. Calculate EV for all tiles
 * 4. Rank tiles by EV
 * 5. Insert into database
 *
 * If any critical fetch fails, the round is not inserted.
 */

import type { BoardAccount } from "../../infrastructure/solana/decoders/board.decoder.js";
import type { PriceQuote } from "../../domain/entities/price.entity.js";
import type { MiningCostData } from "../../domain/entities/mining-cost.entity.js";
import type { RoundPreFin } from "../../domain/entities/round.entity.js";
import type { IRoundRepository } from "../../domain/interfaces/round.repository.js";
import type { INotifier } from "../../domain/interfaces/notifier.js";
import { JupiterPriceFetcher } from "../../infrastructure/fetchers/jupiter-price.fetcher.js";
import { MiningCostFetcher } from "../../infrastructure/fetchers/mining-cost.fetcher.js";
import { fetchRoundState } from "../../infrastructure/fetchers/round-state.fetcher.js";
import { getTotalMiners } from "../../infrastructure/solana/decoders/round.decoder.js";
import { calculateAllTileEvs } from "../services/ev-calculator.js";
import { rankTilesByEv } from "../services/tile-ranker.js";
import { getLogger } from "../../shared/logger.js";

const logger = getLogger().child("Phase2-EV");

export interface PreFinContext {
  board: BoardAccount;
  remainingSlots: number;
  currentSlot: bigint;
}

export interface PreFinDependencies {
  repository: IRoundRepository;
  notifier: INotifier;
  priceFetcher: JupiterPriceFetcher;
  miningCostFetcher: MiningCostFetcher;
}

/**
 * Cached data from Phase 1 (prices fetch at ~15 slots).
 */
export interface CachedPhase1Data {
  priceQuote: PriceQuote;
  miningCost: MiningCostData;
  fetchedAt: number;
}

/**
 * Execute Phase 2 EV snapshot collection for a round.
 *
 * @param context - Board context at trigger time
 * @param deps - Dependencies (repository, notifier, fetchers)
 * @param cachedData - Optional cached Phase 1 data (prices, mining cost)
 * @returns true if successful, false if failed
 */
export async function collectPreFin(
  context: PreFinContext,
  deps: PreFinDependencies,
  cachedData?: CachedPhase1Data
): Promise<boolean> {
  const roundId = context.board.roundId;
  const startTime = Date.now();
  const usedCache = !!cachedData;

  logger.info("Phase 2: Starting EV snapshot", {
    roundId: roundId.toString(),
    remainingSlots: context.remainingSlots,
    usedCachedPrices: usedCache,
  });

  try {
    // * Check if round already exists
    const exists = await deps.repository.exists(roundId);
    if (exists) {
      logger.warn("Round already exists, skipping", { roundId: roundId.toString() });
      return true;
    }

    // * Get prices - use cache from Phase 1 OR fetch now (fallback)
    let priceQuote: PriceQuote;
    let miningCost: MiningCostData;
    let priceFetchLatency = 0;

    if (cachedData) {
      // * Use cached Phase 1 data - this is the normal path
      priceQuote = cachedData.priceQuote;
      miningCost = cachedData.miningCost;
      logger.debug("Using cached Phase 1 data", {
        cachedAge: Date.now() - cachedData.fetchedAt,
      });
    } else {
      // * Fallback: fetch prices now (if Phase 1 was missed)
      logger.warn("No cached prices, fetching now (Phase 1 was missed)");
      const priceFetchStart = Date.now();
      [priceQuote, miningCost] = await Promise.all([
        deps.priceFetcher.fetch(),
        deps.miningCostFetcher.fetch(),
      ]);
      priceFetchLatency = Date.now() - priceFetchStart;
    }

    // * Fetch round state - THIS IS THE CRITICAL TIMING (~5 slots)
    // * Board state changes throughout the round, so we capture it late
    const roundStateFetchStart = Date.now();
    const roundState = await fetchRoundState(roundId);
    const roundStateFetchLatency = Date.now() - roundStateFetchStart;

    logger.debug("Round state fetched", {
      latencyMs: roundStateFetchLatency,
      totalDeployed: roundState.totalDeployed.toString(),
    });

    // * Calculate EV for all tiles
    const evStartTime = Date.now();
    const tileEvs = calculateAllTileEvs(roundState, priceQuote);
    const evLatency = Date.now() - evStartTime;

    // * Rank tiles by EV
    const rankedTiles = rankTilesByEv(tileEvs);

    // * Build pre-fin data
    const preFin: RoundPreFin = {
      roundId,
      tsPre: startTime,
      slotPre: context.currentSlot,
      remainingSlots: context.remainingSlots,
      boardStartSlot: context.board.startSlot,
      boardEndSlot: context.board.endSlot,
      price: priceQuote,
      totalDeployed: roundState.totalDeployed,
      totalMiners: getTotalMiners(roundState),
      latencyFetchMs: roundStateFetchLatency + priceFetchLatency,
      latencyEvMs: evLatency,
      miningCostPct: miningCost.evPercent,
      tiles: rankedTiles,
    };

    // * Insert into database
    await deps.repository.insertPreFin(preFin);

    const totalTime = Date.now() - startTime;
    logger.info("Phase 2: EV snapshot completed", {
      roundId: roundId.toString(),
      totalTimeMs: totalTime,
      roundStateFetchMs: roundStateFetchLatency,
      evLatencyMs: evLatency,
      usedCachedPrices: usedCache,
      totalDeployed: roundState.totalDeployed.toString(),
      bestEvRatio: rankedTiles[0]?.evRatio.toFixed(4),
    });

    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error("Phase 2: EV snapshot failed", {
      roundId: roundId.toString(),
      error: err.message,
    });

    // * Notify via Discord
    await deps.notifier.notifyFailure(roundId, `EV snapshot failed: ${err.message}`, {
      remainingSlots: context.remainingSlots,
      phase: "Phase 2 (EV Snapshot)",
    });

    return false;
  }
}

