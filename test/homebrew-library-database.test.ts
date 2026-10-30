import test from "node:test";
import assert from "node:assert/strict";

test("real homebrew storage uses two queries and preserves action associations and owner filtering", {
  skip: process.env.HOMEBREW_LIBRARY_DB_TEST !== "1",
}, async t => {
  const { pool } = await import("../server/db");
  const { storage } = await import("../server/storage");
  const { actorContext } = await import("../server/auth/context");
  try {
    // Read-only check of the workspace database; never creates test identities or changes records.
    const target = await pool.query("SELECT id,owner_user_id FROM campaigns WHERE name=$1 AND owner_user_id IS NOT NULL ORDER BY id LIMIT 1", ["Aetherfall"]);
    if (!target.rowCount) { t.skip("No existing owned Aetherfall campaign to inspect"); return; }
    const campaign = target.rows[0];
    const countedPool = pool as unknown as { query: (...args: any[]) => any };
    const originalQuery = countedPool.query;
    let queries = 0;
    countedPool.query = function (...args: any[]) {
      queries++;
      return originalQuery.apply(pool, args);
    };
    let results: any[];
    const started = performance.now();
    try {
      results = await actorContext.run({ userId: campaign.owner_user_id, admin: false }, () => storage.getCampaignHomebrew(campaign.id));
      assert.ok(results.length > 0);
      assert.equal(queries, 2, "One authorized creature query plus one batched actions query");
      queries = 0;
      const denied = await actorContext.run({ userId: `qa-nonexistent-${crypto.randomUUID()}`, admin: false }, () => storage.getCampaignHomebrew(campaign.id));
      assert.deepEqual(denied, []);
      assert.equal(queries, 1, "An empty authorized result never loads actions");
    } finally { countedPool.query = originalQuery; }
    const elapsed = performance.now() - started;
    // Compare against the old serial action-loading behavior on the same records.
    const legacyStarted = performance.now();
    for (const monster of results!) {
      const oldActions = await pool.query("SELECT id FROM campaign_homebrew_actions WHERE monster_ref_id=$1 ORDER BY action_order,id", [monster.id]);
      assert.deepEqual(monster.actions.map((a: { id: number }) => a.id), oldActions.rows.map(a => a.id));
      assert.ok(monster.actions.every((a: { monsterRefId: number }) => a.monsterRefId === monster.id));
    }
    t.diagnostic(`${results!.length} records: 2 storage queries instead of ${results!.length + 1}; owner + denied reads ${elapsed.toFixed(1)}ms; serial action-only reference ${(performance.now() - legacyStarted).toFixed(1)}ms`);
  } finally { await pool.end(); }
});
