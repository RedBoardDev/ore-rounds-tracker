#!/usr/bin/env tsx
/**
 * Database initialization script.
 *
 * Creates the SQLite database and initializes the schema.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Usage: yarn db:init
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

// * Default DB path
const DB_PATH = process.env.DB_PATH || "./data/rounds.db";

// * Schema (same as embedded in sqlite.client.ts)
const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS rounds (
    round_id            INTEGER PRIMARY KEY,
    ts_pre              INTEGER NOT NULL,
    ts_post             INTEGER,
    slot_pre            INTEGER NOT NULL,
    remaining_slots     INTEGER NOT NULL,
    board_start_slot    INTEGER NOT NULL,
    board_end_slot      INTEGER NOT NULL,
    price_ore_sol       REAL NOT NULL,
    price_sol_usd       REAL NOT NULL,
    price_ore_usd       REAL NOT NULL,
    price_fetched_at    INTEGER NOT NULL,
    total_deployed      INTEGER NOT NULL,
    total_miners        INTEGER NOT NULL,
    latency_fetch_ms    INTEGER NOT NULL,
    latency_ev_ms       INTEGER NOT NULL,
    mining_cost_pct     REAL NOT NULL,
    slot_hash           BLOB,
    rng_u64             INTEGER,
    winning_tile        INTEGER,
    split_top_miner     INTEGER DEFAULT 0,
    top_miner_reward    INTEGER,
    motherlode_paid     INTEGER,
    num_winners         INTEGER,
    total_winnings      INTEGER,
    total_vaulted       INTEGER,
    rent_payer          TEXT,
    top_miner_pubkey    TEXT,
    CHECK(winning_tile IS NULL OR (winning_tile >= 0 AND winning_tile <= 24)),
    CHECK(split_top_miner IN (0, 1)),
    CHECK(slot_hash IS NULL OR length(slot_hash) = 32)
);

CREATE TABLE IF NOT EXISTS tiles (
    round_id            INTEGER NOT NULL,
    tile_index          INTEGER NOT NULL,
    deployed            INTEGER NOT NULL,
    miners_count        INTEGER NOT NULL,
    others_stake        INTEGER NOT NULL,
    ev_ratio            REAL NOT NULL,
    stake_suggested     INTEGER NOT NULL,
    max_profitable      INTEGER NOT NULL,
    rank_ev             INTEGER NOT NULL,
    deployed_final      INTEGER,
    count_final         INTEGER,
    PRIMARY KEY (round_id, tile_index),
    FOREIGN KEY (round_id) REFERENCES rounds(round_id) ON DELETE CASCADE,
    CHECK(tile_index >= 0 AND tile_index <= 24),
    CHECK(rank_ev >= 1 AND rank_ev <= 25)
);

CREATE INDEX IF NOT EXISTS idx_rounds_ts_pre ON rounds(ts_pre);
CREATE INDEX IF NOT EXISTS idx_rounds_ts_post ON rounds(ts_post) WHERE ts_post IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rounds_winning_tile ON rounds(winning_tile) WHERE winning_tile IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiles_ev ON tiles(ev_ratio DESC);
CREATE INDEX IF NOT EXISTS idx_tiles_rank ON tiles(rank_ev);
`;

function main(): void {
  console.log("=".repeat(50));
  console.log("ORE Collector - Database Initialization");
  console.log("=".repeat(50));
  console.log(`Database path: ${DB_PATH}`);

  // * Ensure data directory exists
  const dbDir = dirname(DB_PATH);
  if (!existsSync(dbDir)) {
    console.log(`Creating directory: ${dbDir}`);
    mkdirSync(dbDir, { recursive: true });
  }

  // * Check if DB already exists
  const dbExists = existsSync(DB_PATH);
  if (dbExists) {
    console.log("Database file already exists. Schema will be updated if needed.");
  } else {
    console.log("Creating new database file...");
  }

  // * Open database
  const db = new Database(DB_PATH);

  // * Execute schema
  console.log("Applying schema...");
  db.exec(SCHEMA);

  // * Verify tables exist
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as { name: string }[];

  console.log("\nTables created:");
  for (const table of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    console.log(`  - ${table.name}: ${count.count} rows`);
  }

  // * Verify indexes
  const indexes = db.prepare(`
    SELECT name, tbl_name FROM sqlite_master
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `).all() as { name: string; tbl_name: string }[];

  console.log("\nIndexes created:");
  for (const index of indexes) {
    console.log(`  - ${index.name} (on ${index.tbl_name})`);
  }

  // * Close database
  db.close();

  console.log("\n✅ Database initialization complete!");
}

main();

