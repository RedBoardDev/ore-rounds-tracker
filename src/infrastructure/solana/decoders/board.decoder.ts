const ACCOUNT_DISCRIMINATOR_SIZE = 8;
const U64_SIZE = 8;

/**
 * Decoded Board account data.
 */
export interface BoardAccount {
  /** Current round ID */
  roundId: bigint;
  /** Round start slot */
  startSlot: bigint;
  /** Round end slot (u64::MAX if not started) */
  endSlot: bigint;
}

/**
 * Read a u64 from a buffer at the given offset.
 */
function readU64LE(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

/**
 * Decode a Board account from raw account data.
 *
 * Layout:
 * - [0..8]   discriminator
 * - [8..16]  round_id: u64
 * - [16..24] start_slot: u64
 * - [24..32] end_slot: u64
 */
export function decodeBoardAccount(data: Buffer): BoardAccount {
  const minSize = ACCOUNT_DISCRIMINATOR_SIZE + U64_SIZE * 3;
  if (data.length < minSize) {
    throw new Error(`Board account data too small: ${data.length} < ${minSize}`);
  }

  let offset = ACCOUNT_DISCRIMINATOR_SIZE;

  const roundId = readU64LE(data, offset);
  offset += U64_SIZE;

  const startSlot = readU64LE(data, offset);
  offset += U64_SIZE;

  const endSlot = readU64LE(data, offset);

  return { roundId, startSlot, endSlot };
}

/**
 * Check if a round is currently active (has started).
 */
export function isRoundActive(board: BoardAccount): boolean {
  // * u64::MAX indicates round not started
  return board.endSlot !== BigInt("18446744073709551615");
}

/**
 * Calculate remaining slots until round end.
 */
export function getRemainingSlots(board: BoardAccount, currentSlot: bigint): number {
  if (!isRoundActive(board)) {
    return -1;
  }
  const remaining = board.endSlot - currentSlot;
  return remaining > 0n ? Number(remaining) : 0;
}

