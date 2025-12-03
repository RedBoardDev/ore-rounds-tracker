import type { RoundPreFin, RoundPostFin } from "../entities/index.js";

/**
 * Repository interface for round data persistence.
 * Implementations handle database-specific logic.
 */
export interface IRoundRepository {
  /**
   * Insert a pre-fin snapshot into the database.
   * Creates round + 25 tile records in a single transaction.
   * @throws if round already exists
   */
  insertPreFin(data: RoundPreFin): Promise<void>;

  /**
   * Complete a round with post-fin data.
   * Updates existing round + tile records in a single transaction.
   * @throws if round doesn't exist or is already complete
   */
  completePostFin(data: RoundPostFin): Promise<void>;

  /**
   * Delete a round and all associated tiles.
   * Used when collection fails and we need to remove partial data.
   * @returns true if round was deleted, false if not found
   */
  deleteRound(roundId: bigint): Promise<boolean>;

  /**
   * Check if a round exists in the database.
   */
  exists(roundId: bigint): Promise<boolean>;

  /**
   * Get the latest round ID in the database.
   * @returns null if no rounds exist
   */
  getLatestRoundId(): Promise<bigint | null>;

  /**
   * Get all pending (incomplete) round IDs.
   * Used on startup to complete any interrupted rounds.
   */
  getPendingRoundIds(): Promise<bigint[]>;
}

