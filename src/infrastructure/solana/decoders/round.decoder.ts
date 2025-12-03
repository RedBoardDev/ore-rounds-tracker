import { PublicKey } from "@solana/web3.js";

const ACCOUNT_DISCRIMINATOR_SIZE = 8;
const U64_SIZE = 8;
const PUBKEY_SIZE = 32;
const SLOT_HASH_SIZE = 32;
const TILES_COUNT = 25;

/**
 * Decoded Round account data.
 */
export interface RoundAccount {
  /** Round ID */
  id: bigint;
  /** Deployed lamports per tile (25 values) */
  deployed: bigint[];
  /** 32-byte slot hash */
  slotHash: Buffer;
  /** Miner count per tile (25 values) */
  counts: bigint[];
  /** Round expiration slot */
  expiresAt: bigint;
  /** Motherlode ORE pool (atomic units) */
  motherlode: bigint;
  /** Rent payer pubkey */
  rentPayer: PublicKey;
  /** Top miner pubkey */
  topMiner: PublicKey;
  /** Top miner ORE reward (atomic units) */
  topMinerReward: bigint;
  /** Total deployed lamports */
  totalDeployed: bigint;
  /** Total vaulted lamports */
  totalVaulted: bigint;
  /** Total winnings lamports */
  totalWinnings: bigint;
}

/**
 * Read a u64 from a buffer at the given offset.
 */
function readU64LE(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

/**
 * Decode a Round account from raw account data.
 *
 * Layout:
 * - [0..8]     discriminator
 * - [8..16]    id: u64
 * - [16..216]  deployed: [u64; 25]
 * - [216..248] slot_hash: [u8; 32]
 * - [248..448] counts: [u64; 25]
 * - [448..456] expires_at: u64
 * - [456..464] motherlode: u64
 * - [464..496] rent_payer: Pubkey
 * - [496..528] top_miner: Pubkey
 * - [528..536] top_miner_reward: u64
 * - [536..544] total_deployed: u64
 * - [544..552] total_vaulted: u64
 * - [552..560] total_winnings: u64
 */
export function decodeRoundAccount(data: Buffer): RoundAccount {
  let offset = ACCOUNT_DISCRIMINATOR_SIZE;

  // * Round ID
  const id = readU64LE(data, offset);
  offset += U64_SIZE;

  // * Deployed array (25 x u64)
  const deployed: bigint[] = [];
  for (let i = 0; i < TILES_COUNT; i++) {
    deployed.push(readU64LE(data, offset));
    offset += U64_SIZE;
  }

  // * Slot hash (32 bytes)
  const slotHash = Buffer.from(data.subarray(offset, offset + SLOT_HASH_SIZE));
  offset += SLOT_HASH_SIZE;

  // * Counts array (25 x u64)
  const counts: bigint[] = [];
  for (let i = 0; i < TILES_COUNT; i++) {
    counts.push(readU64LE(data, offset));
    offset += U64_SIZE;
  }

  // * Expires at
  const expiresAt = readU64LE(data, offset);
  offset += U64_SIZE;

  // * Motherlode
  const motherlode = readU64LE(data, offset);
  offset += U64_SIZE;

  // * Rent payer
  const rentPayer = new PublicKey(data.subarray(offset, offset + PUBKEY_SIZE));
  offset += PUBKEY_SIZE;

  // * Top miner
  const topMiner = new PublicKey(data.subarray(offset, offset + PUBKEY_SIZE));
  offset += PUBKEY_SIZE;

  // * Top miner reward
  const topMinerReward = readU64LE(data, offset);
  offset += U64_SIZE;

  // * Total deployed
  const totalDeployed = readU64LE(data, offset);
  offset += U64_SIZE;

  // * Total vaulted
  const totalVaulted = readU64LE(data, offset);
  offset += U64_SIZE;

  // * Total winnings
  const totalWinnings = readU64LE(data, offset);

  return {
    id,
    deployed,
    slotHash,
    counts,
    expiresAt,
    motherlode,
    rentPayer,
    topMiner,
    topMinerReward,
    totalDeployed,
    totalVaulted,
    totalWinnings,
  };
}

/**
 * Check if the slot hash is valid (non-zero).
 */
export function isSlotHashValid(slotHash: Buffer): boolean {
  // * All zeros or all 255s are invalid
  const allZeros = slotHash.every((b) => b === 0);
  const allOnes = slotHash.every((b) => b === 255);
  return !allZeros && !allOnes;
}

/**
 * Calculate total miners from counts array.
 */
export function getTotalMiners(round: RoundAccount): bigint {
  return round.counts.reduce((sum, count) => sum + count, 0n);
}

