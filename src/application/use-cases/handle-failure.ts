/**
 * Failure Handler Use Case
 *
 * Handles collection failures by:
 * 1. Deleting the round from the database (if it exists)
 * 2. Sending a Discord notification
 */

import type { IRoundRepository } from "../../domain/interfaces/round.repository.js";
import type { INotifier } from "../../domain/interfaces/notifier.js";
import { getLogger } from "../../shared/logger.js";

const logger = getLogger().child("FailureHandler");

export interface FailureHandlerDeps {
  repository: IRoundRepository;
  notifier: INotifier;
}

/**
 * Handle a collection failure.
 * Deletes the round from DB (if exists) and notifies via Discord.
 */
export async function handleCollectionFailure(
  roundId: bigint | null,
  reason: string,
  deps: FailureHandlerDeps,
  details?: Record<string, unknown>
): Promise<void> {
  logger.warn("Handling collection failure", {
    roundId: roundId?.toString() ?? "unknown",
    reason,
  });

  // * Delete round if it exists
  if (roundId !== null) {
    try {
      const deleted = await deps.repository.deleteRound(roundId);
      if (deleted) {
        logger.info("Deleted failed round from database", { roundId: roundId.toString() });
      }
    } catch (error) {
      logger.error("Failed to delete round from database", {
        roundId: roundId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // * Send Discord notification
  try {
    await deps.notifier.notifyFailure(roundId, reason, details);
  } catch (error) {
    logger.error("Failed to send Discord notification", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

