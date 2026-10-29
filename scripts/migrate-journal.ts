import pg from "pg";
import { readFile } from "node:fs/promises";

// Additive, idempotent migration: does not reconcile or alter existing game tables.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = await readFile(new URL("./migrations/20261026-journal.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await pool.query(await readFile(new URL("./migrations/20261029-session-summaries.sql", import.meta.url), "utf8"));
  console.log("Private journal tables ready.");
} finally { await pool.end(); }
