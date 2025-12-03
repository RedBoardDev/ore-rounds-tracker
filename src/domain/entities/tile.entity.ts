/**
 * Tile data captured during pre-fin snapshot.
 * One tile per board position (25 total per round).
 */
export interface TilePreFin {
  /** Tile index on the board (0-24) */
  tileIndex: number;
  /** Total lamports deployed on this tile */
  deployed: bigint;
  /** Number of miners on this tile */
  minersCount: bigint;
  /** Stake from other miners (excluding hypothetical bot stake) */
  othersStake: bigint;
  /** Expected value ratio for this tile */
  evRatio: number;
  /** Maximum profitable stake in lamports */
  maxProfitable: bigint;
  /** EV ranking (1 = best, 25 = worst) */
  rankEv: number;
}

/**
 * Tile data captured during post-fin completion.
 */
export interface TilePostFin {
  /** Tile index on the board (0-24) */
  tileIndex: number;
  /** Final deployed lamports after round end */
  deployedFinal: bigint;
  /** Final miner count after round end */
  countFinal: bigint;
}

/**
 * Combined tile data for database storage.
 */
export interface TileRecord {
  roundId: bigint;
  tileIndex: number;
  // Pre-fin
  deployed: bigint;
  minersCount: bigint;
  othersStake: bigint;
  evRatio: number;
  maxProfitable: bigint;
  rankEv: number;
  // Post-fin (nullable)
  deployedFinal: bigint | null;
  countFinal: bigint | null;
}

