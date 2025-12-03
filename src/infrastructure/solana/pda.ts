import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, BOARD_SEED, ROUND_SEED, MINER_SEED, TREASURY_SEED } from "./constants.js";

/**
 * Derive the Board PDA address.
 */
export function deriveBoardPda(): PublicKey {
  return PublicKey.findProgramAddressSync([BOARD_SEED], PROGRAM_ID)[0];
}

/**
 * Derive a Round PDA address for a given round ID.
 */
export function deriveRoundPda(roundId: bigint): PublicKey {
  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(roundId);
  return PublicKey.findProgramAddressSync([ROUND_SEED, idBuffer], PROGRAM_ID)[0];
}

/**
 * Derive a Miner PDA address for a given authority.
 */
export function deriveMinerPda(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([MINER_SEED, authority.toBuffer()], PROGRAM_ID)[0];
}

/**
 * Derive the Treasury PDA address.
 */
export function deriveTreasuryPda(): PublicKey {
  return PublicKey.findProgramAddressSync([TREASURY_SEED], PROGRAM_ID)[0];
}

// * Pre-computed static PDAs
export const BOARD_ADDRESS = deriveBoardPda();
export const TREASURY_ADDRESS = deriveTreasuryPda();

