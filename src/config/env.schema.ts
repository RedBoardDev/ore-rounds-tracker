import { z } from "zod";

/**
 * Environment variables schema with validation.
 * All required fields must be present at runtime.
 */
export const envSchema = z.object({
  // * Solana RPC endpoints
  RPC_URL: z.string().url().describe("Solana RPC HTTP endpoint"),
  RPC_WS_URL: z.string().url().describe("Solana RPC WebSocket endpoint"),

  // * Discord webhook for error notifications
  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .describe("Discord webhook URL for failure notifications"),

  // * Collector configuration - Two-phase timing
  PRE_FIN_THRESHOLD_SLOTS: z.coerce
    .number()
    .int()
    .min(10)
    .max(50)
    .default(15)
    .describe("Slots remaining to trigger early fetches (prices, mining cost)"),

  EV_SNAPSHOT_SLOTS: z.coerce
    .number()
    .int()
    .min(2)
    .max(10)
    .default(5)
    .describe("Slots remaining to capture board state + calculate EV (like smart-bot)"),

  DB_PATH: z
    .string()
    .default("./data/rounds.db")
    .describe("Path to SQLite database file"),

  // * Logging
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info")
    .describe("Logging verbosity level"),
});

export type EnvConfig = z.infer<typeof envSchema>;

