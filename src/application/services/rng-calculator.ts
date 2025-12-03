/**
 * RNG Calculator - calculates winning tile from slot hash.
 *
 * This replicates the Rust Round::rng() logic:
 * - XOR all 4 u64 chunks of the 32-byte slot hash
 * - Winning tile = rng % 25
 */

/**
 * Calculate RNG from slot hash by XORing 4 u64 values.
 */
export function computeRng(slotHash: Buffer): bigint {
  if (slotHash.length !== 32) {
    throw new Error(`Invalid slot hash length: ${slotHash.length}, expected 32`);
  }

  const u64_0 = slotHash.readBigUInt64LE(0);
  const u64_1 = slotHash.readBigUInt64LE(8);
  const u64_2 = slotHash.readBigUInt64LE(16);
  const u64_3 = slotHash.readBigUInt64LE(24);

  return u64_0 ^ u64_1 ^ u64_2 ^ u64_3;
}

/**
 * Calculate the winning tile index from slot hash.
 * @returns Tile index (0-24)
 */
export function computeWinningTile(slotHash: Buffer): number {
  const rng = computeRng(slotHash);
  return Number(rng % 25n);
}

/**
 * Check if motherlode was triggered.
 * Motherlode triggers when rng.reverse_bits() % 625 == 0
 */
export function isMotherlodeTriggered(slotHash: Buffer): boolean {
  const rng = computeRng(slotHash);
  // * Reverse bits of a u64
  const reversed = reverseBits64(rng);
  return reversed % 625n === 0n;
}

/**
 * Reverse the bits of a 64-bit value.
 */
function reverseBits64(value: bigint): bigint {
  let result = 0n;
  for (let i = 0; i < 64; i++) {
    result = (result << 1n) | ((value >> BigInt(i)) & 1n);
  }
  return result;
}

/**
 * Check if top miner reward should be split.
 * Split when XOR of four u16 values is even.
 */
export function shouldSplitReward(slotHash: Buffer): boolean {
  if (slotHash.length !== 32) {
    return false;
  }

  // * XOR four u16 values from the hash
  const u16_0 = slotHash.readUInt16LE(0);
  const u16_1 = slotHash.readUInt16LE(2);
  const u16_2 = slotHash.readUInt16LE(4);
  const u16_3 = slotHash.readUInt16LE(6);

  const xored = u16_0 ^ u16_1 ^ u16_2 ^ u16_3;
  return xored % 2 === 0;
}

