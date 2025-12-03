/**
 * Tile Ranker - ranks tiles by EV ratio.
 */

import type { TileEvResult } from "./ev-calculator.js";
import type { TilePreFin } from "../../domain/entities/tile.entity.js";

/**
 * Rank tiles by EV ratio (descending).
 * Rank 1 = highest EV (best), Rank 25 = lowest EV (worst).
 *
 * @param tiles - Array of tile EV results
 * @returns Array of TilePreFin with rank_ev assigned
 */
export function rankTilesByEv(tiles: TileEvResult[]): TilePreFin[] {
  // * Sort by EV ratio descending
  const sorted = [...tiles].sort((a, b) => {
    // * Handle infinity values
    if (!Number.isFinite(b.evRatio) && Number.isFinite(a.evRatio)) {
      return 1;
    }
    if (!Number.isFinite(a.evRatio) && Number.isFinite(b.evRatio)) {
      return -1;
    }
    if (b.evRatio !== a.evRatio) {
      return b.evRatio - a.evRatio;
    }
    // * Tie-breaker: higher max profitable stake first
    return Number(b.maxProfitable - a.maxProfitable);
  });

  // * Assign ranks and map to TilePreFin
  return sorted.map((tile, index) => ({
    tileIndex: tile.tileIndex,
    deployed: tile.deployed,
    minersCount: tile.minersCount,
    othersStake: tile.othersStake,
    evRatio: tile.evRatio,
    maxProfitable: tile.maxProfitable,
    rankEv: index + 1, // 1-indexed rank
  }));
}

/**
 * Get the best tile by EV ratio.
 */
export function getBestTile(tiles: TilePreFin[]): TilePreFin | null {
  const best = tiles.find((t) => t.rankEv === 1);
  return best ?? null;
}

/**
 * Get tiles above a certain EV threshold.
 */
export function getTilesAboveThreshold(tiles: TilePreFin[], minEv: number): TilePreFin[] {
  return tiles.filter((t) => t.evRatio >= minEv);
}

