/**
 * Base error class for collection failures.
 */
export class CollectionError extends Error {
  constructor(
    message: string,
    public readonly roundId: bigint | null = null,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

/**
 * Error thrown when a data fetch fails after all retries.
 */
export class FetchError extends CollectionError {
  constructor(
    public readonly fetcherName: string,
    message: string,
    roundId: bigint | null = null,
    cause?: Error
  ) {
    super(`[${fetcherName}] ${message}`, roundId, cause);
    this.name = "FetchError";
  }
}

/**
 * Error thrown when price fetch fails.
 */
export class PriceFetchError extends FetchError {
  constructor(message: string, roundId: bigint | null = null, cause?: Error) {
    super("JupiterPrice", message, roundId, cause);
    this.name = "PriceFetchError";
  }
}

/**
 * Error thrown when mining cost fetch fails.
 */
export class MiningCostFetchError extends FetchError {
  constructor(message: string, roundId: bigint | null = null, cause?: Error) {
    super("MiningCost", message, roundId, cause);
    this.name = "MiningCostFetchError";
  }
}

/**
 * Error thrown when round state fetch fails.
 */
export class RoundStateFetchError extends FetchError {
  constructor(message: string, roundId: bigint | null = null, cause?: Error) {
    super("RoundState", message, roundId, cause);
    this.name = "RoundStateFetchError";
  }
}

/**
 * Error thrown when post-fin validation fails.
 */
export class PostFinValidationError extends CollectionError {
  constructor(message: string, roundId: bigint, cause?: Error) {
    super(message, roundId, cause);
    this.name = "PostFinValidationError";
  }
}

