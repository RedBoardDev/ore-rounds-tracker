import type { PriceQuote } from "./price.entity.js";
import type { TilePreFin, TilePostFin } from "./tile.entity.js";

/**
 * Round snapshot captured during pre-fin phase.
 * Contains all data needed before round completion.
 */
export interface RoundPreFin {
  roundId: bigint;
  /** Timestamp of pre-fin snapshot (ms) */
  tsPre: number;
  /** Slot at snapshot time */
  slotPre: bigint;
  /** Slots remaining when snapshot was taken */
  remainingSlots: number;
  /** Board start slot */
  boardStartSlot: bigint;
  /** Board end slot */
  boardEndSlot: bigint;
  /** Price data from Jupiter */
  price: PriceQuote;
  /** Total deployed lamports across all tiles */
  totalDeployed: bigint;
  /** Total miner count across all tiles */
  totalMiners: bigint;
  /** Latency to fetch on-chain data (ms) */
  latencyFetchMs: number;
  /** Latency to calculate EVs (ms) */
  latencyEvMs: number;
  /** Mining cost percentage from external API */
  miningCostPct: number;
  /** Per-tile pre-fin data */
  tiles: TilePreFin[];
}

/**
 * Round completion data captured during post-fin phase.
 */
export interface RoundPostFin {
  roundId: bigint;
  /** Timestamp of post-fin completion (ms) */
  tsPost: number;
  /** 32-byte slot hash */
  slotHash: Buffer;
  /** RNG value derived from slot hash */
  rngU64: bigint;
  /** Winning tile index (0-24) */
  winningTile: number;
  /** Whether top miner reward was split */
  splitTopMiner: boolean;
  /** Top miner ORE reward (atomic units) */
  topMinerReward: bigint;
  /** Motherlode ORE paid (atomic units) */
  motherlodePaid: bigint;
  /** Number of winners */
  numWinners: bigint;
  /** Total winnings in lamports */
  totalWinnings: bigint;
  /** Total vaulted in lamports */
  totalVaulted: bigint;
  /** Rent payer pubkey (base58) */
  rentPayer: string;
  /** Top miner pubkey (base58) */
  topMinerPubkey: string;
  /** Per-tile final data */
  tiles: TilePostFin[];
}

/**
 * Complete round record for database storage.
 */
export interface RoundRecord {
  roundId: bigint;
  tsPre: number;
  tsPost: number | null;
  slotPre: bigint;
  remainingSlots: number;
  boardStartSlot: bigint;
  boardEndSlot: bigint;
  // Price
  priceOreSol: number;
  priceSolUsd: number;
  priceOreUsd: number;
  priceFetchedAt: number;
  // Aggregates
  totalDeployed: bigint;
  totalMiners: bigint;
  // Metrics
  latencyFetchMs: number;
  latencyEvMs: number;
  miningCostPct: number;
  // Post-fin (nullable)
  slotHash: Buffer | null;
  rngU64: bigint | null;
  winningTile: number | null;
  splitTopMiner: boolean;
  topMinerReward: bigint | null;
  motherlodePaid: bigint | null;
  numWinners: bigint | null;
  totalWinnings: bigint | null;
  totalVaulted: bigint | null;
  rentPayer: string | null;
  topMinerPubkey: string | null;
}

