import type { IDataFetcher } from "../../domain/interfaces/data-fetcher.js";
import { FetchError } from "../../domain/errors/collection.errors.js";
import { withRetry, type RetryOptions } from "../../shared/retry.js";
import { getLogger } from "../../shared/logger.js";

/**
 * Abstract base class for data fetchers with built-in retry logic.
 */
export abstract class BaseFetcher<T> implements IDataFetcher<T> {
  protected readonly logger;

  constructor(
    public readonly name: string,
    protected readonly retryOptions: RetryOptions = {}
  ) {
    this.logger = getLogger().child(name);
    this.retryOptions = {
      retries: 3,
      delayMs: 5000,
      name: name,
      ...retryOptions,
    };
  }

  /**
   * Fetch data with automatic retries.
   * @throws FetchError if all retries fail
   */
  async fetch(): Promise<T> {
    try {
      return await withRetry(() => this.doFetch(), this.retryOptions);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new FetchError(this.name, err.message, null, err);
    }
  }

  /**
   * Implement the actual fetch logic in subclasses.
   * @throws Error on failure (will be retried)
   */
  protected abstract doFetch(): Promise<T>;
}

