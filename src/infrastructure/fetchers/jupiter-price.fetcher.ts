import { BaseFetcher } from "./base.fetcher.js";
import type { PriceQuote } from "../../domain/entities/price.entity.js";
import { ORE_MINT, SOL_MINT } from "../solana/constants.js";

// * Jupiter Lite API v3 endpoint (faster, no rate limits)
const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";

// * Request timeout
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Jupiter v3 response format:
 * { [mint]: { usdPrice, blockId, decimals, priceChange24h } }
 */
interface JupiterV3TokenPrice {
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h: number;
}

type JupiterPriceResponse = {
  [mint: string]: JupiterV3TokenPrice;
};

/**
 * Fetcher for Jupiter price API.
 * Gets ORE and SOL prices in USD.
 */
export class JupiterPriceFetcher extends BaseFetcher<PriceQuote> {
  constructor() {
    super("JupiterPrice", {
      retries: 3,
      delayMs: 5000,
    });
  }

  protected async doFetch(): Promise<PriceQuote> {
    const oreMint = ORE_MINT.toString();
    const solMint = SOL_MINT.toString();

    const url = `${JUPITER_PRICE_API}?ids=${oreMint},${solMint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Jupiter API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as JupiterPriceResponse;

      const oreData = data[oreMint];
      const solData = data[solMint];

      if (!oreData || !solData) {
        throw new Error("Missing price data in Jupiter v3 response");
      }

      const oreUsd = oreData.usdPrice;
      const solUsd = solData.usdPrice;

      if (!Number.isFinite(oreUsd) || !Number.isFinite(solUsd)) {
        throw new Error("Invalid price values in Jupiter v3 response");
      }

      // * Calculate ORE/SOL price
      const oreSol = oreUsd / solUsd;

      return {
        oreSol,
        solUsd,
        oreUsd,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Jupiter API request timed out after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }
}

