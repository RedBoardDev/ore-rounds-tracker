/**
 * Mining Cost Entity
 *
 * Represents mining cost data from external API (MineMore).
 */

export interface MiningCostData {
  /** Mining cost as EV percentage */
  evPercent: number;
  /** Timestamp when data was fetched */
  fetchedAt: number;
}

