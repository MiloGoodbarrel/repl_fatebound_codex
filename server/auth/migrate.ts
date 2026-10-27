import { pool } from "../db";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Additive and safe to run on each deployment. Never infer ownership from a first login.
export async function migrateAccounts() {
  const journalSql = await readFile(path.resolve(process.cwd(), "scripts/migrations/20261026-journal.sql"), "utf8");
  const cx = await pool.connect();
  try {
    await cx.query("BEGIN");
    await cx.query("SELECT pg_advisory_xact_lock(253148311)");
    await cx.query(`
    CREATE TABLE IF NOT EXISTS app_accounts (
      user_id text PRIMARY KEY,
      is_admin boolean NOT NULL DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS app_setup (
      key text PRIMARY KEY,
      completed_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS appearance jsonb;
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS owner_user_id text;
    ALTER TABLE homebrew_items ADD COLUMN IF NOT EXISTS owner_user_id text;
    CREATE INDEX IF NOT EXISTS campaigns_owner_idx ON campaigns(owner_user_id);
    CREATE INDEX IF NOT EXISTS homebrew_owner_idx ON homebrew_items(owner_user_id);
    `);
    await cx.query(journalSql.replace(/^\s*BEGIN;/, "").replace(/COMMIT;\s*$/, ""));
    await cx.query("COMMIT");
  } catch (e) {
    await cx.query("ROLLBACK"); throw e;
  } finally { cx.release(); }
}
