import type { Commitment } from "@solana/web3.js";
import type { RoundAccount } from "../solana/decoders/round.decoder.js";
import { decodeRoundAccount } from "../solana/decoders/round.decoder.js";
import { deriveRoundPda } from "../solana/pda.js";
import { getSolanaConnection } from "../solana/connection.js";
import { getLogger } from "../../shared/logger.js";
import { withRetry } from "../../shared/retry.js";

const logger = getLogger().child("RoundStateFetcher");

export interface RoundStateWithContext {
  roundState: RoundAccount;
  contextSlot: bigint;
}

interface FetchOptions {
  commitment?: Commitment;
  minContextSlot?: number;
  retries?: number;
  delayMs?: number;
}

/**
 * Fetch round state from on-chain.
 * This is not a class-based fetcher since it needs context (roundId).
 */
export async function fetchRoundState(roundId: bigint): Promise<RoundAccount> {
  const { roundState } = await fetchRoundStateWithContext(roundId);
  return roundState;
}

/**
 * Fetch round state with RPC context slot metadata.
 */
export async function fetchRoundStateWithContext(
  roundId: bigint,
  options: FetchOptions = {}
): Promise<RoundStateWithContext> {
  const {
    commitment = "confirmed",
    minContextSlot,
    retries = 3,
    delayMs = 2000,
  } = options;

  return withRetry(
    async () => {
      const connection = getSolanaConnection().getConnection();
      const roundPda = deriveRoundPda(roundId);

      logger.debug("Fetching round state", {
        roundId: roundId.toString(),
        pda: roundPda.toString(),
        commitment,
        minContextSlot,
      });

      const accountInfo = await connection.getAccountInfoAndContext(roundPda, {
        commitment,
        minContextSlot,
      });

      if (!accountInfo?.value) {
        throw new Error(`Round account not found: ${roundPda.toString()}`);
      }

      return {
        roundState: decodeRoundAccount(accountInfo.value.data),
        contextSlot: BigInt(accountInfo.context.slot),
      };
    },
    {
      retries,
      delayMs,
      name: "RoundStateFetch",
    }
  );
}

/**
 * Fetch round state, returning null if not found instead of throwing.
 */
export async function fetchRoundStateOrNull(roundId: bigint): Promise<RoundAccount | null> {
  try {
    const { roundState } = await fetchRoundStateWithContext(roundId);
    return roundState;
  } catch (error) {
    logger.debug("Round not found", { roundId: roundId.toString() });
    return null;
  }
}
