import { config as loadDotenv } from "dotenv";
import { envSchema, type EnvConfig } from "./env.schema.js";

// * Load .env file if present
loadDotenv();

/**
 * Validated configuration object.
 * Throws on startup if required env vars are missing.
 */
function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error("❌ Invalid environment configuration:");
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type { EnvConfig };

