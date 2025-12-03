import { BaseFetcher } from "./base.fetcher.js";
import type { MiningCostData } from "../../domain/entities/mining-cost.entity.js";

// * Re-export for convenience
export type { MiningCostData } from "../../domain/entities/mining-cost.entity.js";

// * MineMore API endpoint
const MINING_COST_API = "https://minemoreserver-production.up.railway.app/api/ev/summary";

// * Request timeout
const FETCH_TIMEOUT_MS = 5_000;

interface MiningCostResponse {
  evPercent?: number;
  [key: string]: unknown;
}

/**
 * Fetcher for mining cost data from MineMore API.
 */
export class MiningCostFetcher extends BaseFetcher<MiningCostData> {
  constructor() {
    super("MiningCost", {
      retries: 3,
      delayMs: 5000,
    });
  }

  protected async doFetch(): Promise<MiningCostData> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(MINING_COST_API, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`MineMore API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as MiningCostResponse;

      const evPercent = data.evPercent;

      if (typeof evPercent !== "number" || !Number.isFinite(evPercent)) {
        throw new Error("Invalid evPercent in MineMore response");
      }

      return {
        evPercent,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`MineMore API request timed out after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }
}

