/**
 * Data fetchers for external data sources.
 *
 * Each fetcher is isolated and can be easily added/removed.
 * To add a new data source:
 * 1. Create a new fetcher file (e.g., new-source.fetcher.ts)
 * 2. Export it from this index
 * 3. Inject it in the use case that needs it
 */

export { BaseFetcher } from "./base.fetcher.js";
export { JupiterPriceFetcher } from "./jupiter-price.fetcher.js";
export { MiningCostFetcher, type MiningCostData } from "./mining-cost.fetcher.js";
export { fetchRoundState, fetchRoundStateOrNull } from "./round-state.fetcher.js";

