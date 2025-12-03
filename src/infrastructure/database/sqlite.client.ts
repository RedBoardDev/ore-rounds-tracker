import Database from "better-sqlite3";
import { getLogger } from "../../shared/logger.js";

// * Embedded schema (to avoid file path issues in built version)
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

/**
 * SQLite database client wrapper.
 * Handles connection, initialization, and schema setup.
 */
export class SqliteClient {
  private db: Database.Database | null = null;
  private readonly logger = getLogger().child("SQLite");

  constructor(private readonly dbPath: string) {}

  /**
   * Initialize the database connection and schema.
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing database", { path: this.dbPath });

    // * Create database connection
    this.db = new Database(this.dbPath);

    // * Enable WAL mode and foreign keys
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    // * Execute embedded schema
    this.db.exec(SCHEMA);

    this.logger.info("Database initialized successfully");
  }

  /**
   * Get the underlying database instance.
   * @throws if not initialized
   */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.db;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info("Database connection closed");
    }
  }

  /**
   * Run a function within a transaction.
   * Automatically commits on success, rolls back on error.
   */
  transaction<T>(fn: () => T): T {
    const db = this.getDb();
    return db.transaction(fn)();
  }
}

// * Singleton instance
let instance: SqliteClient | null = null;

export function initSqliteClient(dbPath: string): SqliteClient {
  instance = new SqliteClient(dbPath);
  return instance;
}

export function getSqliteClient(): SqliteClient {
  if (!instance) {
    throw new Error("SQLite client not initialized. Call initSqliteClient() first.");
  }
  return instance;
}

