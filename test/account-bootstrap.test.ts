import test from "node:test";
import assert from "node:assert/strict";
import { matchesCreator } from "../server/auth/accounts";

test("creator bootstrap requires an explicit matching verified email AND linked Google identity", () => {
  const verified = { emailAddresses: [{ emailAddress: "dm@example.invalid", verification: { status: "verified" } }],
    externalAccounts: [{ provider: "oauth_google", emailAddress: "dm@example.invalid" }] };
  assert.equal(matchesCreator(undefined, verified), false);
  assert.equal(matchesCreator("other@example.invalid", verified), false);
  assert.equal(matchesCreator("DM@example.invalid", verified), true);
  assert.equal(matchesCreator("dm@example.invalid", { ...verified, externalAccounts: [] }), false);
  assert.equal(matchesCreator("dm@example.invalid", { ...verified, emailAddresses: [{
    emailAddress: "dm@example.invalid", verification: { status: "unverified" },
  }] }), false);
});

test("database bootstrap never assigns first-login ownership or re-grants revoked permissions", {
  skip: process.env.ACCOUNT_DATABASE_TEST !== "1",
}, async () => {
  const { pool } = await import("../server/db");
  const { syncAccount } = await import("../server/auth/accounts");
  const cx = await pool.connect();
  try {
    await cx.query("BEGIN");
    // Connection-local shadow tables: no real campaign or setup record is touched.
    await cx.query(`
      CREATE TEMP TABLE app_setup(key text PRIMARY KEY) ON COMMIT DROP;
      CREATE TEMP TABLE app_accounts(user_id text PRIMARY KEY, is_admin boolean DEFAULT false) ON COMMIT DROP;
      CREATE TEMP TABLE campaigns(id integer PRIMARY KEY, owner_user_id text) ON COMMIT DROP;
      CREATE TEMP TABLE homebrew_items(id integer PRIMARY KEY, owner_user_id text) ON COMMIT DROP;
      INSERT INTO campaigns VALUES (1,NULL),(2,'second-user');
      INSERT INTO homebrew_items VALUES (1,NULL),(2,'second-user');
    `);
    assert.equal((await syncAccount(cx, "first-user", false)).admin, false);
    assert.equal((await cx.query("SELECT owner_user_id FROM campaigns WHERE id=1")).rows[0].owner_user_id, null);
    assert.equal((await syncAccount(cx, "creator", true)).admin, true);
    assert.equal((await cx.query("SELECT owner_user_id FROM campaigns WHERE id=1")).rows[0].owner_user_id, "creator");
    assert.equal((await cx.query("SELECT owner_user_id FROM campaigns WHERE id=2")).rows[0].owner_user_id, "second-user");
    assert.equal((await cx.query("SELECT owner_user_id FROM homebrew_items WHERE id=1")).rows[0].owner_user_id, "creator");
    assert.equal((await syncAccount(cx, "other-user", true)).admin, false);
    await cx.query("UPDATE app_accounts SET is_admin=false WHERE user_id='creator'; UPDATE campaigns SET owner_user_id=NULL WHERE id=1");
    assert.equal((await syncAccount(cx, "creator", true)).admin, false);
    assert.equal((await cx.query("SELECT owner_user_id FROM campaigns WHERE id=1")).rows[0].owner_user_id, null);
  } finally {
    await cx.query("ROLLBACK"); cx.release(); await pool.end();
  }
});
