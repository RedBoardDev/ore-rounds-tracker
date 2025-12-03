import { getLogger } from "./logger.js";

export interface RetryOptions {
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Delay between retries in ms (default: 5000) */
  delayMs?: number;
  /** Name for logging purposes */
  name?: string;
  /** Whether to log retry attempts */
  silent?: boolean;
}

/**
 * Sleep for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, delayMs = 5000, name = "operation", silent = false } = options;
  const logger = getLogger();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!silent) {
        logger.warn(`${name} failed (attempt ${attempt}/${retries})`, {
          error: lastError.message,
        });
      }

      if (attempt < retries) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Execute multiple promises in parallel, returning results for all.
 * Unlike Promise.all, this collects all results/errors before throwing.
 */
export async function parallelFetch<T extends Record<string, Promise<unknown>>>(
  fetchers: T
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(fetchers) as (keyof T)[];
  const results = await Promise.allSettled(Object.values(fetchers));

  const output: Partial<{ [K in keyof T]: Awaited<T[K]> }> = {};
  const errors: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const result = results[i];

    if (result.status === "fulfilled") {
      output[key] = result.value as Awaited<T[typeof key]>;
    } else {
      errors.push(`${String(key)}: ${result.reason?.message ?? "Unknown error"}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Parallel fetch failed:\n${errors.join("\n")}`);
  }

  return output as { [K in keyof T]: Awaited<T[K]> };
}

