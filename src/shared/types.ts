/**
 * Utility type to make specific properties optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type to make specific properties required.
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Lamports per SOL constant.
 */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * ORE atomic units per ORE token.
 */
export const ORE_DECIMALS = 100_000_000_000; // 1e11

/**
 * Convert lamports to SOL.
 */
export function lamportsToSol(lamports: bigint | number): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports.
 */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * LAMPORTS_PER_SOL));
}

