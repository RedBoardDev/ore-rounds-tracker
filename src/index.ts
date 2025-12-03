/**
 * ORE Historical Rounds Collector
 *
 * Main entry point - initializes all services and starts collection.
 *
 * Features:
 * - Collects pre-fin and post-fin data for every ORE round
 * - Parallel fetching for price, mining cost, and on-chain data
 * - SQLite persistence with atomic transactions
 * - Discord notifications on failures
 * - Graceful shutdown on SIGINT/SIGTERM
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config/index.js";
import { initLogger } from "./shared/logger.js";
import { initSqliteClient, getSqliteClient } from "./infrastructure/database/sqlite.client.js";
import { SqliteRoundRepository } from "./infrastructure/database/sqlite.repository.js";
import { initSolanaConnection, getSolanaConnection } from "./infrastructure/solana/connection.js";
import { DiscordNotifier } from "./infrastructure/notifications/discord.notifier.js";
import { Orchestrator } from "./application/orchestrator.js";

// * Initialize logger first
const logger = initLogger(config.LOG_LEVEL);

// * Global orchestrator for shutdown handling
let orchestrator: Orchestrator | null = null;
let isShuttingDown = false;

/**
 * Main application entry point.
 */
async function main(): Promise<void> {
  logger.info("=".repeat(60));
  logger.info("ORE Historical Rounds Collector");
  logger.info("=".repeat(60));
  logger.info("Configuration loaded", {
    rpcUrl: config.RPC_URL.substring(0, 30) + "...",
    dbPath: config.DB_PATH,
    pricesFetchThreshold: config.PRE_FIN_THRESHOLD_SLOTS,
    evSnapshotSlots: config.EV_SNAPSHOT_SLOTS,
    discordEnabled: !!config.DISCORD_WEBHOOK_URL,
  });

  // * Ensure data directory exists
  const dbDir = dirname(config.DB_PATH);
  if (!existsSync(dbDir)) {
    logger.info("Creating data directory", { path: dbDir });
    mkdirSync(dbDir, { recursive: true });
  }

  // * Initialize SQLite
  const sqliteClient = initSqliteClient(config.DB_PATH);
  await sqliteClient.initialize();

  // * Initialize Solana connection
  const solanaConnection = initSolanaConnection(config.RPC_URL, config.RPC_WS_URL);
  await solanaConnection.initialize();

  // * Create repository and notifier
  const repository = new SqliteRoundRepository();
  const notifier = new DiscordNotifier(config.DISCORD_WEBHOOK_URL);

  // * Create and start orchestrator
  orchestrator = new Orchestrator(
    {
      preFinThresholdSlots: config.PRE_FIN_THRESHOLD_SLOTS,
      evSnapshotSlots: config.EV_SNAPSHOT_SLOTS,
    },
    repository,
    notifier
  );

  await orchestrator.start();

  // * Send startup notification
  await notifier.notifyInfo(
    "Collector Started",
    `Monitoring ORE rounds. Phase 1 (prices): ${config.PRE_FIN_THRESHOLD_SLOTS} slots, Phase 2 (EV): ${config.EV_SNAPSHOT_SLOTS} slots`
  );

  logger.info("Collector running. Press Ctrl+C to stop.");
}

/**
 * Graceful shutdown handler.
 */
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress, forcing exit");
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // * Stop orchestrator first (waits for in-flight operations)
    if (orchestrator) {
      await orchestrator.stop();
    }

    // * Close Solana connection
    try {
      await getSolanaConnection().close();
    } catch {
      // Ignore if not initialized
    }

    // * Close SQLite connection
    try {
      getSqliteClient().close();
    } catch {
      // Ignore if not initialized
    }

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// * Register signal handlers
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// * Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message, stack: error.stack });
  shutdown("uncaughtException").catch(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
});

// * Start the application
main().catch((error) => {
  logger.error("Fatal error during startup", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

