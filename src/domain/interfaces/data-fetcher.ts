/**
 * Generic interface for data fetchers.
 * Each data source implements this interface.
 */
export interface IDataFetcher<T> {
  /**
   * Unique identifier for this fetcher.
   * Used in error messages and logging.
   */
  readonly name: string;

  /**
   * Fetch data from the source.
   * Implementations should handle their own retry logic.
   * @throws FetchError on failure after all retries
   */
  fetch(): Promise<T>;
}

/**
 * Interface for fetchers that need context (like round ID).
 */
export interface IContextualFetcher<TContext, TResult> {
  readonly name: string;
  fetch(context: TContext): Promise<TResult>;
}

