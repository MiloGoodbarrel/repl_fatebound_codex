import { clerkClient } from "@clerk/express";
import { pool } from "../db";
import type { Actor } from "./context";
import type { PoolClient } from "pg";

// Caller owns the transaction. The one-shot marker and grants commit atomically.
export async function syncAccount(cx: PoolClient, userId: string, creator: boolean): Promise<Actor> {
  await cx.query("INSERT INTO app_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING", [userId]);
  if (creator) {
    const granted = await cx.query("INSERT INTO app_setup(key) VALUES('legacy-owner') ON CONFLICT DO NOTHING RETURNING key");
    if (granted.rowCount) {
      await cx.query("UPDATE campaigns SET owner_user_id=$1 WHERE owner_user_id IS NULL", [userId]);
      await cx.query("UPDATE homebrew_items SET owner_user_id=$1 WHERE owner_user_id IS NULL", [userId]);
      await cx.query("UPDATE app_accounts SET is_admin=true WHERE user_id=$1", [userId]);
      console.info("[accounts] Legacy ownership bootstrap completed.");
    }
  }
  const row = await cx.query("SELECT is_admin FROM app_accounts WHERE user_id=$1", [userId]);
  return { userId, admin: row.rows[0].is_admin };
}

export function matchesCreator(
  configured: string | undefined,
  user: { emailAddresses: { emailAddress: string; verification: { status: string } | null }[];
    externalAccounts: { provider: string; emailAddress: string }[] },
) {
  const email = configured?.trim().toLowerCase();
  return !!email && user.emailAddresses.some(e => e.emailAddress.toLowerCase() === email && e.verification?.status === "verified") &&
    user.externalAccounts.some(a => a.provider === "google" && a.emailAddress.toLowerCase() === email);
}

export async function resolveAccount(userId: string): Promise<Actor> {
  // User id is obtained ONLY from verified Clerk middleware.
  const configured = process.env.CREATOR_GOOGLE_EMAIL;
  let creator = false;
  if (configured) {
    const done = await pool.query("SELECT 1 FROM app_setup WHERE key = 'legacy-owner'");
    if (!done.rowCount) creator = matchesCreator(configured, await clerkClient.users.getUser(userId));
  }
  const cx = await pool.connect();
  try {
    await cx.query("BEGIN");
    const actor = await syncAccount(cx, userId, creator);
    await cx.query("COMMIT");
    return actor;
  } catch (e) {
    await cx.query("ROLLBACK");
    throw e;
  } finally { cx.release(); }
}
