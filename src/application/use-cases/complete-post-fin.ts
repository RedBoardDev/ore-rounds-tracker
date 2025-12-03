/**
 * Post-Fin Completion Use Case
 *
 * Completes a pending round with post-fin data:
 * 1. Fetch round state for the previous round
 * 2. Validate slot hash is non-zero
 * 3. Calculate RNG and winning tile
 * 4. Update database with final data
 *
 * If validation fails, the round is deleted and Discord is notified.
 */

import type { BoardAccount } from "../../infrastructure/solana/decoders/board.decoder.js";
import type { RoundPostFin, TilePostFin } from "../../domain/entities/index.js";
import type { IRoundRepository } from "../../domain/interfaces/round.repository.js";
import type { INotifier } from "../../domain/interfaces/notifier.js";
import { fetchRoundStateOrNull } from "../../infrastructure/fetchers/round-state.fetcher.js";
import { isSlotHashValid } from "../../infrastructure/solana/decoders/round.decoder.js";
import { SPLIT_ADDRESS } from "../../infrastructure/solana/constants.js";
import { computeRng, computeWinningTile } from "../services/rng-calculator.js";
import { getLogger } from "../../shared/logger.js";

const logger = getLogger().child("PostFin");

export interface PostFinContext {
  previousRoundId: bigint;
  newBoard: BoardAccount;
}

export interface PostFinDependencies {
  repository: IRoundRepository;
  notifier: INotifier;
}

/**
 * Execute post-fin completion for a round.
 *
 * @returns true if successful, false if failed (round deleted)
 */
export async function completePostFin(
  context: PostFinContext,
  deps: PostFinDependencies
): Promise<boolean> {
  const roundId = context.previousRoundId;
  const startTime = Date.now();

  logger.info("Starting post-fin completion", {
    roundId: roundId.toString(),
    newRoundId: context.newBoard.roundId.toString(),
  });

  try {
    // * Check if round exists and is pending
    const exists = await deps.repository.exists(roundId);
    if (!exists) {
      logger.warn("Round not found in DB, skipping post-fin", { roundId: roundId.toString() });
      return true;
    }

    // * Fetch round state
    const roundState = await fetchRoundStateOrNull(roundId);

    if (!roundState) {
      logger.error("Round account not found on-chain", { roundId: roundId.toString() });
      await handleFailure(roundId, "Round account not found on-chain", deps);
      return false;
    }

    // * Validate slot hash
    if (!isSlotHashValid(roundState.slotHash)) {
      logger.error("Invalid slot hash (all zeros)", { roundId: roundId.toString() });
      await handleFailure(roundId, "Invalid slot hash (refund round)", deps);
      return false;
    }

    // * Calculate RNG and winning tile
    const rngU64 = computeRng(roundState.slotHash);
    const winningTile = computeWinningTile(roundState.slotHash);
    const splitTopMiner = roundState.topMiner.equals(SPLIT_ADDRESS);

    // * Build tile post-fin data
    const tiles: TilePostFin[] = [];
    for (let i = 0; i < 25; i++) {
      tiles.push({
        tileIndex: i,
        deployedFinal: roundState.deployed[i],
        countFinal: roundState.counts[i],
      });
    }

    // * Build post-fin data
    const postFin: RoundPostFin = {
      roundId,
      tsPost: startTime,
      slotHash: roundState.slotHash,
      rngU64,
      winningTile,
      splitTopMiner,
      topMinerReward: roundState.topMinerReward,
      motherlodePaid: roundState.motherlode, // ! Note: this is the pool, not paid amount
      numWinners: roundState.counts[winningTile],
      totalWinnings: roundState.totalWinnings,
      totalVaulted: roundState.totalVaulted,
      rentPayer: roundState.rentPayer.toBase58(),
      topMinerPubkey: roundState.topMiner.toBase58(),
      tiles,
    };

    // * Update database
    await deps.repository.completePostFin(postFin);

    const totalTime = Date.now() - startTime;
    logger.info("Post-fin completion successful", {
      roundId: roundId.toString(),
      totalTimeMs: totalTime,
      winningTile,
      numWinners: postFin.numWinners.toString(),
      totalWinnings: roundState.totalWinnings.toString(),
    });

    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error("Post-fin completion failed", {
      roundId: roundId.toString(),
      error: err.message,
    });

    await handleFailure(roundId, `Post-fin completion failed: ${err.message}`, deps);
    return false;
  }
}

/**
 * Handle failure: delete round and notify.
 */
async function handleFailure(
  roundId: bigint,
  reason: string,
  deps: PostFinDependencies
): Promise<void> {
  // * Delete the incomplete round
  const deleted = await deps.repository.deleteRound(roundId);

  if (deleted) {
    logger.warn("Deleted incomplete round", { roundId: roundId.toString() });
  }

  // * Notify via Discord
  await deps.notifier.notifyFailure(roundId, reason);
}

/**
 * Complete any pending rounds from previous sessions.
 * Called on startup to handle interrupted collections.
 */
export async function completePendingRounds(deps: PostFinDependencies): Promise<void> {
  const pendingIds = await deps.repository.getPendingRoundIds();

  if (pendingIds.length === 0) {
    logger.debug("No pending rounds to complete");
    return;
  }

  logger.info("Found pending rounds to complete", { count: pendingIds.length });

  for (const roundId of pendingIds) {
    try {
      const roundState = await fetchRoundStateOrNull(roundId);

      if (!roundState) {
        logger.warn("Pending round not found on-chain, deleting", { roundId: roundId.toString() });
        await deps.repository.deleteRound(roundId);
        await deps.notifier.notifyFailure(roundId, "Pending round not found on-chain (cleanup)");
        continue;
      }

      if (!isSlotHashValid(roundState.slotHash)) {
        logger.warn("Pending round has invalid slot hash, deleting", { roundId: roundId.toString() });
        await deps.repository.deleteRound(roundId);
        await deps.notifier.notifyFailure(roundId, "Pending round has invalid slot hash (refund)");
        continue;
      }

      // * Complete the round
      // ! We need a mock BoardAccount here - using current values
      await completePostFin(
        { previousRoundId: roundId, newBoard: { roundId: roundId + 1n, startSlot: 0n, endSlot: 0n } },
        deps
      );
    } catch (error) {
      logger.error("Failed to complete pending round", {
        roundId: roundId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

