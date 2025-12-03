-- ============================================================================
-- * ORE Historical Rounds Database Schema
-- * Version: 1.0.0
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================================
-- * Table: rounds
-- * One row per round with aggregated data and post-fin results
-- ============================================================================
CREATE TABLE IF NOT EXISTS rounds (
    -- Identity
    round_id            INTEGER PRIMARY KEY,

    -- Timestamps
    ts_pre              INTEGER NOT NULL,       -- Pre-fin snapshot timestamp (ms)
    ts_post             INTEGER,                -- Post-fin completion timestamp (ms)

    -- Slots
    slot_pre            INTEGER NOT NULL,       -- Slot at pre-fin snapshot
    remaining_slots     INTEGER NOT NULL,       -- Slots remaining at snapshot
    board_start_slot    INTEGER NOT NULL,       -- Board start slot
    board_end_slot      INTEGER NOT NULL,       -- Board end slot

    -- Prices (Jupiter)
    price_ore_sol       REAL NOT NULL,          -- ORE price in SOL
    price_sol_usd       REAL NOT NULL,          -- SOL price in USD
    price_ore_usd       REAL NOT NULL,          -- ORE price in USD
    price_fetched_at    INTEGER NOT NULL,       -- Price fetch timestamp (ms)

    -- Aggregates
    total_deployed      INTEGER NOT NULL,       -- Total lamports deployed
    total_miners        INTEGER NOT NULL,       -- Total miner count

    -- Metrics
    latency_fetch_ms    INTEGER NOT NULL,       -- On-chain fetch latency
    latency_ev_ms       INTEGER NOT NULL,       -- EV calculation latency
    mining_cost_pct     REAL NOT NULL,          -- Mining cost percentage

    -- Post-fin (nullable until completion)
    slot_hash           BLOB,                   -- 32-byte slot hash
    rng_u64             INTEGER,                -- RNG value from slot hash
    winning_tile        INTEGER,                -- Winning tile index (0-24)
    split_top_miner     INTEGER DEFAULT 0,      -- Boolean: top miner split
    top_miner_reward    INTEGER,                -- Top miner ORE reward (atoms)
    motherlode_paid     INTEGER,                -- Motherlode ORE paid (atoms)
    num_winners         INTEGER,                -- Number of winners
    total_winnings      INTEGER,                -- Total winnings (lamports)
    total_vaulted       INTEGER,                -- Total vaulted (lamports)
    rent_payer          TEXT,                   -- Rent payer pubkey (base58)
    top_miner_pubkey    TEXT,                   -- Top miner pubkey (base58)

    -- Constraints
    CHECK(winning_tile IS NULL OR (winning_tile >= 0 AND winning_tile <= 24)),
    CHECK(split_top_miner IN (0, 1)),
    CHECK(slot_hash IS NULL OR length(slot_hash) = 32)
);

-- ============================================================================
-- * Table: tiles
-- * 25 rows per round with per-tile data
-- ============================================================================
CREATE TABLE IF NOT EXISTS tiles (
    -- Reference
    round_id            INTEGER NOT NULL,
    tile_index          INTEGER NOT NULL,

    -- Pre-fin data
    deployed            INTEGER NOT NULL,       -- Deployed lamports
    miners_count        INTEGER NOT NULL,       -- Miner count
    others_stake        INTEGER NOT NULL,       -- Others' stake (lamports)
    ev_ratio            REAL NOT NULL,          -- Expected value ratio
    stake_suggested     INTEGER NOT NULL,       -- Suggested stake (lamports)
    max_profitable      INTEGER NOT NULL,       -- Max profitable stake (lamports)
    rank_ev             INTEGER NOT NULL,       -- EV ranking (1-25)

    -- Post-fin data (nullable until completion)
    deployed_final      INTEGER,                -- Final deployed lamports
    count_final         INTEGER,                -- Final miner count

    -- Keys
    PRIMARY KEY (round_id, tile_index),
    FOREIGN KEY (round_id) REFERENCES rounds(round_id) ON DELETE CASCADE,

    -- Constraints
    CHECK(tile_index >= 0 AND tile_index <= 24),
    CHECK(rank_ev >= 1 AND rank_ev <= 25)
);

-- ============================================================================
-- * Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rounds_ts_pre ON rounds(ts_pre);
CREATE INDEX IF NOT EXISTS idx_rounds_ts_post ON rounds(ts_post) WHERE ts_post IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rounds_winning_tile ON rounds(winning_tile) WHERE winning_tile IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tiles_ev ON tiles(ev_ratio DESC);
CREATE INDEX IF NOT EXISTS idx_tiles_rank ON tiles(rank_ev);

