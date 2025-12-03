import type { RoundAccount } from "../solana/decoders/round.decoder.js";
import { decodeRoundAccount } from "../solana/decoders/round.decoder.js";
import { deriveRoundPda } from "../solana/pda.js";
import { getSolanaConnection } from "../solana/connection.js";
import { getLogger } from "../../shared/logger.js";
import { withRetry } from "../../shared/retry.js";

const logger = getLogger().child("RoundStateFetcher");

/**
 * Fetch round state from on-chain.
 * This is not a class-based fetcher since it needs context (roundId).
 */
export async function fetchRoundState(roundId: bigint): Promise<RoundAccount> {
  return withRetry(
    async () => {
      const connection = getSolanaConnection();
      const roundPda = deriveRoundPda(roundId);

      logger.debug("Fetching round state", { roundId: roundId.toString(), pda: roundPda.toString() });

      const accountInfo = await connection.getAccountInfo(roundPda);

      if (!accountInfo) {
        throw new Error(`Round account not found: ${roundPda.toString()}`);
      }

      return decodeRoundAccount(accountInfo.data);
    },
    {
      retries: 3,
      delayMs: 2000,
      name: "RoundStateFetch",
    }
  );
}

/**
 * Fetch round state, returning null if not found instead of throwing.
 */
export async function fetchRoundStateOrNull(roundId: bigint): Promise<RoundAccount | null> {
  try {
    return await fetchRoundState(roundId);
  } catch (error) {
    logger.debug("Round not found", { roundId: roundId.toString() });
    return null;
  }
}

