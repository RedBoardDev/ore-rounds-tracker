import type { Database, Statement } from "better-sqlite3";
import type { IRoundRepository } from "../../domain/interfaces/round.repository.js";
import type { RoundPreFin, RoundPostFin } from "../../domain/entities/index.js";
import { getLogger } from "../../shared/logger.js";
import { getSqliteClient } from "./sqlite.client.js";

/**
 * SQLite implementation of the round repository.
 */
export class SqliteRoundRepository implements IRoundRepository {
  private readonly logger = getLogger().child("Repository");

  // * Prepared statements (lazy initialized)
  private stmtInsertRound: Statement | null = null;
  private stmtInsertTile: Statement | null = null;
  private stmtUpdateRoundPostFin: Statement | null = null;
  private stmtUpdateTilePostFin: Statement | null = null;
  private stmtDeleteRound: Statement | null = null;
  private stmtExistsRound: Statement | null = null;
  private stmtGetLatestRoundId: Statement | null = null;
  private stmtGetPendingRoundIds: Statement | null = null;

  private getDb(): Database {
    return getSqliteClient().getDb();
  }

  private prepareStatements(): void {
    const db = this.getDb();

    if (!this.stmtInsertRound) {
      this.stmtInsertRound = db.prepare(`
        INSERT INTO rounds (
          round_id, ts_pre, slot_pre, remaining_slots,
          board_start_slot, board_end_slot,
          price_ore_sol, price_sol_usd, price_ore_usd, price_fetched_at,
          total_deployed, total_miners,
          latency_fetch_ms, latency_ev_ms, mining_cost_pct
        ) VALUES (
          @roundId, @tsPre, @slotPre, @remainingSlots,
          @boardStartSlot, @boardEndSlot,
          @priceOreSol, @priceSolUsd, @priceOreUsd, @priceFetchedAt,
          @totalDeployed, @totalMiners,
          @latencyFetchMs, @latencyEvMs, @miningCostPct
        )
      `);
    }

    if (!this.stmtInsertTile) {
      this.stmtInsertTile = db.prepare(`
        INSERT INTO tiles (
          round_id, tile_index,
          deployed, miners_count, others_stake,
          ev_ratio, max_profitable, rank_ev
        ) VALUES (
          @roundId, @tileIndex,
          @deployed, @minersCount, @othersStake,
          @evRatio, @maxProfitable, @rankEv
        )
      `);
    }

    if (!this.stmtUpdateRoundPostFin) {
      this.stmtUpdateRoundPostFin = db.prepare(`
        UPDATE rounds SET
          ts_post = @tsPost,
          slot_hash = @slotHash,
          rng_u64 = @rngU64,
          winning_tile = @winningTile,
          split_top_miner = @splitTopMiner,
          top_miner_reward = @topMinerReward,
          motherlode_paid = @motherlodePaid,
          num_winners = @numWinners,
          total_winnings = @totalWinnings,
          total_vaulted = @totalVaulted,
          rent_payer = @rentPayer,
          top_miner_pubkey = @topMinerPubkey
        WHERE round_id = @roundId
      `);
    }

    if (!this.stmtUpdateTilePostFin) {
      this.stmtUpdateTilePostFin = db.prepare(`
        UPDATE tiles SET
          deployed_final = @deployedFinal,
          count_final = @countFinal
        WHERE round_id = @roundId AND tile_index = @tileIndex
      `);
    }

    if (!this.stmtDeleteRound) {
      this.stmtDeleteRound = db.prepare(`DELETE FROM rounds WHERE round_id = ?`);
    }

    if (!this.stmtExistsRound) {
      this.stmtExistsRound = db.prepare(`SELECT 1 FROM rounds WHERE round_id = ?`);
    }

    if (!this.stmtGetLatestRoundId) {
      this.stmtGetLatestRoundId = db.prepare(`SELECT MAX(round_id) as maxId FROM rounds`);
    }

    if (!this.stmtGetPendingRoundIds) {
      this.stmtGetPendingRoundIds = db.prepare(`SELECT round_id FROM rounds WHERE ts_post IS NULL`);
    }
  }

  async insertPreFin(data: RoundPreFin): Promise<void> {
    this.prepareStatements();
    const client = getSqliteClient();

    client.transaction(() => {
      // * Insert round record
      this.stmtInsertRound!.run({
        roundId: Number(data.roundId),
        tsPre: data.tsPre,
        slotPre: Number(data.slotPre),
        remainingSlots: data.remainingSlots,
        boardStartSlot: Number(data.boardStartSlot),
        boardEndSlot: Number(data.boardEndSlot),
        priceOreSol: data.price.oreSol,
        priceSolUsd: data.price.solUsd,
        priceOreUsd: data.price.oreUsd,
        priceFetchedAt: data.price.fetchedAt,
        totalDeployed: Number(data.totalDeployed),
        totalMiners: Number(data.totalMiners),
        latencyFetchMs: data.latencyFetchMs,
        latencyEvMs: data.latencyEvMs,
        miningCostPct: data.miningCostPct,
      });

      // * Insert tile records
      for (const tile of data.tiles) {
        this.stmtInsertTile!.run({
          roundId: Number(data.roundId),
          tileIndex: tile.tileIndex,
          deployed: Number(tile.deployed),
          minersCount: Number(tile.minersCount),
          othersStake: Number(tile.othersStake),
          evRatio: tile.evRatio,
          maxProfitable: Number(tile.maxProfitable),
          rankEv: tile.rankEv,
        });
      }
    });

    this.logger.info("Inserted pre-fin data", { roundId: data.roundId.toString() });
  }

  async completePostFin(data: RoundPostFin): Promise<void> {
    this.prepareStatements();
    const client = getSqliteClient();

    client.transaction(() => {
      // * Update round with post-fin data
      this.stmtUpdateRoundPostFin!.run({
        roundId: Number(data.roundId),
        tsPost: data.tsPost,
        slotHash: data.slotHash,
        rngU64: Number(data.rngU64),
        winningTile: data.winningTile,
        splitTopMiner: data.splitTopMiner ? 1 : 0,
        topMinerReward: Number(data.topMinerReward),
        motherlodePaid: Number(data.motherlodePaid),
        numWinners: Number(data.numWinners),
        totalWinnings: Number(data.totalWinnings),
        totalVaulted: Number(data.totalVaulted),
        rentPayer: data.rentPayer,
        topMinerPubkey: data.topMinerPubkey,
      });

      // * Update tile records with final data
      for (const tile of data.tiles) {
        this.stmtUpdateTilePostFin!.run({
          roundId: Number(data.roundId),
          tileIndex: tile.tileIndex,
          deployedFinal: Number(tile.deployedFinal),
          countFinal: Number(tile.countFinal),
        });
      }
    });

    this.logger.info("Completed post-fin data", {
      roundId: data.roundId.toString(),
      winningTile: data.winningTile,
    });
  }

  async deleteRound(roundId: bigint): Promise<boolean> {
    this.prepareStatements();
    const result = this.stmtDeleteRound!.run(Number(roundId));

    if (result.changes > 0) {
      this.logger.warn("Deleted round", { roundId: roundId.toString() });
      return true;
    }
    return false;
  }

  async exists(roundId: bigint): Promise<boolean> {
    this.prepareStatements();
    const row = this.stmtExistsRound!.get(Number(roundId));
    return row !== undefined;
  }

  async getLatestRoundId(): Promise<bigint | null> {
    this.prepareStatements();
    const row = this.stmtGetLatestRoundId!.get() as { maxId: number | null } | undefined;
    return row?.maxId !== null && row?.maxId !== undefined ? BigInt(row.maxId) : null;
  }

  async getPendingRoundIds(): Promise<bigint[]> {
    this.prepareStatements();
    const rows = this.stmtGetPendingRoundIds!.all() as { round_id: number }[];
    return rows.map((row) => BigInt(row.round_id));
  }
}

