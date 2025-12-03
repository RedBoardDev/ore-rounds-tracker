/**
 * EV Calculator - Expected Value calculation for tiles.
 *
 * This EXACTLY replicates the smart-bot EvStrategyPlanner logic for pure EV calculation.
 * The formulas match smart-bot/src/core/ev-strategy.ts line by line.
 *
 * Key difference: As an observer (not a miner), we use exposureBeforeSol=0
 * since we have no existing stake on the board.
 */

import type { RoundAccount } from "../../infrastructure/solana/decoders/round.decoder.js";
import type { PriceQuote } from "../../domain/entities/price.entity.js";
import { lamportsToSol, ORE_DECIMALS } from "../../shared/types.js";

// * Constants EXACTLY matching smart-bot/src/core/ev-strategy.ts lines 6-10
const PROBABILITY_OF_WIN = 1 / 25;
const SOL_PAYOUT_FEE_FACTOR = 0.9;
const MOTHERLODE_TRIGGER_PROBABILITY = 1 / 625;
const EV_DENOMINATOR = 1 - PROBABILITY_OF_WIN * SOL_PAYOUT_FEE_FACTOR; // 0.964

/**
 * EV calculation result for a single tile.
 */
export interface TileEvResult {
  tileIndex: number;
  deployed: bigint;
  minersCount: bigint;
  othersStake: bigint;
  evRatio: number;
  maxProfitable: bigint;
}

/**
 * Calculate net ORE value in SOL, including motherlode component.
 * MATCHES smart-bot/src/core/ev-strategy.ts lines 27-33
 *
 * smart-bot uses priceQuote.netOreValueInSol which is orePriceInSol * 0.9
 * We calculate the same: oreSol * 0.9
 */
function computeNetOreValueSol(round: RoundAccount, priceQuote: PriceQuote): number {
  const motherlodeOre = Number(round.motherlode) / ORE_DECIMALS;
  // * netOreValueInSol = oreSol * 0.9 (same as smart-bot's price-oracle.ts line 90)
  const netOreValueInSol = priceQuote.oreSol * SOL_PAYOUT_FEE_FACTOR;
  return netOreValueInSol * (1 + MOTHERLODE_TRIGGER_PROBABILITY * Math.max(motherlodeOre, 0));
}

/**
 * Calculate total pot from ALL stakes across all tiles.
 *
 * NOTE: smart-bot subtracts its own miner stakes (computePotFromOthersLamports).
 * As an observer with NO stake, potFromOthers = total deployed (everything is "others").
 */
function computePotFromOthers(round: RoundAccount): bigint {
  return round.deployed.reduce((acc, deployed) => acc + deployed, 0n);
}

/**
 * Calculate EV ratio for a tile.
 * MATCHES smart-bot/src/core/ev-strategy.ts lines 62-78 EXACTLY
 *
 * @param exposureBeforeSol - Existing exposure from previous placements
 *                            For observer mode (collector), this is always 0
 */
function computeEvRatio(params: {
  othersStakeSol: number;
  potFromOthersSol: number;
  exposureBeforeSol: number;
  stakeSol: number;
  netOreValueSol: number;
}): number {
  const { othersStakeSol, potFromOthersSol, exposureBeforeSol, stakeSol, netOreValueSol } = params;
  const denominator = othersStakeSol + stakeSol;

  if (denominator <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  // * EXACT formula from smart-bot lines 74-76
  const numerator =
    PROBABILITY_OF_WIN *
    (SOL_PAYOUT_FEE_FACTOR * (potFromOthersSol + exposureBeforeSol + stakeSol) + netOreValueSol);

  return numerator / denominator;
}

/**
 * Solve for maximum profitable stake.
 * MATCHES smart-bot/src/core/ev-strategy.ts lines 80-94 EXACTLY
 *
 * @param exposureBeforeSol - Existing exposure (0 for observer)
 */
function solveMaxProfitableStake(params: {
  othersStakeSol: number;
  potFromOthersSol: number;
  exposureBeforeSol: number;
  netOreValueSol: number;
}): number {
  const { othersStakeSol, potFromOthersSol, exposureBeforeSol, netOreValueSol } = params;

  // * EXACT formula from smart-bot lines 87-89
  const numerator =
    PROBABILITY_OF_WIN * (SOL_PAYOUT_FEE_FACTOR * (potFromOthersSol + exposureBeforeSol) + netOreValueSol) -
    othersStakeSol;

  if (numerator <= 0) {
    return 0;
  }

  return numerator / EV_DENOMINATOR;
}


/**
 * Calculate EV metrics for all tiles in a round.
 *
 * This calculates the "baseline EV" exactly like smart-bot does in buildPlan()
 * at lines 160-166. The key difference:
 * - smart-bot uses exposureBeforeSol = miner's existing stake
 * - collector uses exposureBeforeSol = 0 (pure observer mode)
 *
 * @param round - Round account data
 * @param priceQuote - Current price quote
 * @returns Array of tile EV results (unsorted)
 */
export function calculateAllTileEvs(
  round: RoundAccount,
  priceQuote: PriceQuote
): TileEvResult[] {
  const potFromOthers = computePotFromOthers(round);
  const potFromOthersSol = lamportsToSol(potFromOthers);
  const netOreValueSol = computeNetOreValueSol(round, priceQuote);

  // * As observer, we have zero existing exposure
  // * This matches smart-bot's baseline EV calculation with exposureExistingSol=0
  const exposureBeforeSol = 0;

  const results: TileEvResult[] = [];

  for (let tileIndex = 0; tileIndex < 25; tileIndex++) {
    const deployed = round.deployed[tileIndex];
    const minersCount = round.counts[tileIndex];

    // * Others stake = deployed on this tile (we're not participating)
    const othersStake = deployed;
    const othersStakeSol = lamportsToSol(othersStake);

    // * Calculate baseline EV with minimal stake (matches smart-bot line 164)
    // * smart-bot uses Math.max(minStakeSol, Number.EPSILON)
    const minStakeSol = Math.max(0.001, Number.EPSILON);
    const evRatio = computeEvRatio({
      othersStakeSol,
      potFromOthersSol,
      exposureBeforeSol,
      stakeSol: minStakeSol,
      netOreValueSol,
    });

    // * Calculate max profitable stake (matches smart-bot lines 168-173)
    const maxProfitableSol = solveMaxProfitableStake({
      othersStakeSol,
      potFromOthersSol,
      exposureBeforeSol,
      netOreValueSol,
    });

    results.push({
      tileIndex,
      deployed,
      minersCount,
      othersStake,
      evRatio,
      maxProfitable: BigInt(Math.floor(maxProfitableSol * 1_000_000_000)),
    });
  }

  return results;
}

