#!/usr/bin/env tsx
/**
 * Database health check script.
 *
 * Checks database integrity and displays stats.
 *
 * Usage: yarn db:check
 */

import { existsSync } from "node:fs";
import Database from "better-sqlite3";

// * Default DB path
const DB_PATH = process.env.DB_PATH || "./data/rounds.db";

function main(): void {
  console.log("=".repeat(50));
  console.log("ORE Collector - Database Health Check");
  console.log("=".repeat(50));
  console.log(`Database path: ${DB_PATH}`);

  // * Check if DB exists
  if (!existsSync(DB_PATH)) {
    console.error("\n❌ Database file not found!");
    console.log("Run 'yarn db:init' to create the database.");
    process.exit(1);
  }

  // * Open database
  const db = new Database(DB_PATH, { readonly: true });

  // * Run integrity check
  console.log("\n📋 Integrity Check:");
  const integrity = db.pragma("integrity_check") as { integrity_check: string }[];
  if (integrity[0]?.integrity_check === "ok") {
    console.log("  ✅ Database integrity OK");
  } else {
    console.error("  ❌ Database integrity FAILED:", integrity);
  }

  // * Table stats
  console.log("\n📊 Table Statistics:");

  const roundsCount = db.prepare("SELECT COUNT(*) as count FROM rounds").get() as { count: number };
  const roundsComplete = db.prepare("SELECT COUNT(*) as count FROM rounds WHERE ts_post IS NOT NULL").get() as { count: number };
  const roundsPending = db.prepare("SELECT COUNT(*) as count FROM rounds WHERE ts_post IS NULL").get() as { count: number };

  console.log(`  rounds: ${roundsCount.count} total (${roundsComplete.count} complete, ${roundsPending.count} pending)`);

  const tilesCount = db.prepare("SELECT COUNT(*) as count FROM tiles").get() as { count: number };
  console.log(`  tiles: ${tilesCount.count} total`);

  // * Latest round info
  if (roundsCount.count > 0) {
    console.log("\n📈 Latest Round:");
    const latest = db.prepare(`
      SELECT round_id, ts_pre, ts_post, winning_tile, total_deployed
      FROM rounds
      ORDER BY round_id DESC
      LIMIT 1
    `).get() as { round_id: number; ts_pre: number; ts_post: number | null; winning_tile: number | null; total_deployed: number };

    console.log(`  Round ID: ${latest.round_id}`);
    console.log(`  Pre-fin: ${new Date(latest.ts_pre).toISOString()}`);
    console.log(`  Post-fin: ${latest.ts_post ? new Date(latest.ts_post).toISOString() : "PENDING"}`);
    console.log(`  Winning tile: ${latest.winning_tile ?? "N/A"}`);
    console.log(`  Total deployed: ${(latest.total_deployed / 1e9).toFixed(4)} SOL`);
  }

  // * Database size
  const pageCount = db.pragma("page_count") as { page_count: number }[];
  const pageSize = db.pragma("page_size") as { page_size: number }[];
  const sizeBytes = pageCount[0].page_count * pageSize[0].page_size;
  const sizeMb = (sizeBytes / 1024 / 1024).toFixed(2);

  console.log(`\n💾 Database Size: ${sizeMb} MB`);

  // * Close database
  db.close();

  console.log("\n✅ Health check complete!");
}

main();

