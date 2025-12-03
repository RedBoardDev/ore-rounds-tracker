#!/usr/bin/env tsx
/**
 * Database Reset Script
 *
 * Deletes all data from rounds and tiles tables.
 * Requires explicit confirmation before proceeding.
 */

import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import Database from "better-sqlite3";

const DB_PATH = process.env.DB_PATH || "./data/rounds.db";

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N]: `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function main() {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║       ⚠️  DATABASE RESET SCRIPT ⚠️          ║");
  console.log("╚════════════════════════════════════════════╝");
  console.log();

  if (!existsSync(DB_PATH)) {
    console.log(`❌ Database not found at: ${DB_PATH}`);
    console.log("   Nothing to reset.");
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // Get current stats
  const roundCount = db.prepare("SELECT COUNT(*) as count FROM rounds").get() as { count: number };
  const tileCount = db.prepare("SELECT COUNT(*) as count FROM tiles").get() as { count: number };

  console.log(`📊 Current database: ${DB_PATH}`);
  console.log(`   - Rounds: ${roundCount.count}`);
  console.log(`   - Tiles:  ${tileCount.count}`);
  console.log();

  if (roundCount.count === 0) {
    console.log("✅ Database is already empty. Nothing to do.");
    db.close();
    process.exit(0);
  }

  console.log("⚠️  This will DELETE ALL DATA from the database!");
  console.log("   This action is IRREVERSIBLE.");
  console.log();

  const confirmed = await confirm("Are you sure you want to reset the database?");

  if (!confirmed) {
    console.log();
    console.log("❌ Reset cancelled.");
    db.close();
    process.exit(0);
  }

  console.log();
  console.log("🗑️  Deleting all data...");

  try {
    // Use a transaction for atomicity
    db.exec("BEGIN TRANSACTION");

    // Delete tiles first (foreign key constraint)
    const tilesDeleted = db.prepare("DELETE FROM tiles").run();
    console.log(`   - Deleted ${tilesDeleted.changes} tiles`);

    // Delete rounds
    const roundsDeleted = db.prepare("DELETE FROM rounds").run();
    console.log(`   - Deleted ${roundsDeleted.changes} rounds`);

    db.exec("COMMIT");

    // Vacuum to reclaim space
    console.log("   - Vacuuming database...");
    db.exec("VACUUM");

    console.log();
    console.log("✅ Database reset complete!");
  } catch (error) {
    db.exec("ROLLBACK");
    console.error();
    console.error(`❌ Reset failed: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

