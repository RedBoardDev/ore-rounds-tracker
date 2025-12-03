/**
 * Price quote from Jupiter API.
 * All prices are relative values.
 */
export interface PriceQuote {
  /** ORE price in SOL */
  oreSol: number;
  /** SOL price in USD */
  solUsd: number;
  /** ORE price in USD (derived: oreSol * solUsd) */
  oreUsd: number;
  /** Timestamp when price was fetched (ms) */
  fetchedAt: number;
}

