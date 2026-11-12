import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

test("PDF receipts atomically protect items, creatures and actions across retries and concurrent requests", {
  skip: process.env.PDF_IMPORT_DB_TEST !== "1", timeout: 60000,
}, async () => {
  const { pool } = await import("../server/db");
  const { DatabaseStorage, PdfImportConflict } = await import("../server/storage");
  const { actorContext } = await import("../server/auth/context");
  const { pdfCommitSchema } = await import("../server/pdfLibraryParser");
  const owner = { userId: `pdf-test-${randomUUID()}`, admin: false };
  const other = { userId: `pdf-test-${randomUUID()}`, admin: false };
  const ids: number[] = [];
  const run = <T>(fn: () => Promise<T>) => actorContext.run(owner, fn);
  const repo = new DatabaseStorage();
  try {
    await pool.query(await readFile("scripts/migrations/20261112-pdf-import-receipts.sql", "utf8"));
    const a = await run(() => repo.createCampaign({ name: "Fictional retry A", edition: "5e" }));
    ids.push(a.id);
    const b = await run(() => repo.createCampaign({ name: "Fictional retry B", edition: "5e" }));
    ids.push(b.id);
    for (const kind of ["items", "creatures"] as const) {
      const data = pdfCommitSchema.parse({
        idempotencyKey: randomUUID(), kind,
        entries: kind === "items"
          ? [{ name: "Fictional Lantern", category: "Wondrous Items", rarity: "Common", description: "Blue light.", sourcePage: 2 }]
          : [{ index: "fictional", name: "Fictional Watcher", hp: 12, ac: 13, cr: "1", type: "humanoid", size: "Medium",
            actions: [{ name: "Spear", desc: "Fictional action.", attack_bonus: 3 }] }],
      });
      const first = await run(() => repo.commitPdfImport(a.id, data));
      // Discard the first response, instantiate fresh storage (no in-memory receipt).
      const fresh = new DatabaseStorage();
      const retries = await run(() => Promise.all(Array.from({ length: 6 }, () => fresh.commitPdfImport(a.id, data))));
      retries.forEach(result => assert.deepEqual(result, first));
      const table = kind === "items" ? "campaign_items" : "campaign_homebrew_monsters";
      const count = async () => (await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE campaign_id=$1`, [a.id])).rows[0].n;
      assert.equal(await count(), 1);
      if (kind === "creatures") {
        assert.equal((await pool.query(`SELECT count(*)::int AS n FROM campaign_homebrew_actions
          WHERE monster_ref_id IN (SELECT id FROM campaign_homebrew_monsters WHERE campaign_id=$1)`, [a.id])).rows[0].n, 1);
      }
      await assert.rejects(run(() => repo.commitPdfImport(a.id, {
        ...data, entries: data.entries.map(entry => ({ ...entry, name: "Changed review" })),
      } as typeof data)), PdfImportConflict);
      await assert.rejects(actorContext.run(other, () => repo.commitPdfImport(a.id, data)), /Campaign not found/);
      assert.equal(await count(), 1);
      // A new operation deliberately appends exactly the same reviewed content.
      const deliberate = { ...data, idempotencyKey: randomUUID() };
      await run(() => Promise.all(Array.from({ length: 6 }, () => fresh.commitPdfImport(a.id, deliberate))));
      assert.equal(await count(), 2, "Concurrent first attempts have one winner");
      await run(() => repo.commitPdfImport(b.id, data));
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE campaign_id=$1`, [b.id])).rows[0].n, 1,
        "The same key belongs to separate operations in separate campaigns");
    }
    // Force an insert failure after claiming the receipt, without altering database constraints.
    const invalid = pdfCommitSchema.parse({
      idempotencyKey: randomUUID(), kind: "items",
      entries: [{ name: "Rollback fixture", category: "Wondrous Items", rarity: "Common", description: "" }],
    });
    if (invalid.kind !== "items") throw new Error("Expected item fixture");
    await assert.rejects(run(() => repo.commitPdfImport(a.id, {
      ...invalid, entries: [{ ...invalid.entries[0], name: null as unknown as string }],
    })));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM pdf_import_receipts WHERE campaign_id=$1 AND idempotency_key=$2",
      [a.id, invalid.idempotencyKey])).rows[0].n, 0);
    await run(() => repo.commitPdfImport(a.id, invalid));
    await run(() => repo.deleteCampaign(b.id));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM pdf_import_receipts WHERE campaign_id=$1", [b.id])).rows[0].n, 0);
  } finally {
    for (const id of ids) {
      await pool.query("DELETE FROM campaign_homebrew_actions WHERE monster_ref_id IN (SELECT id FROM campaign_homebrew_monsters WHERE campaign_id=$1)", [id]);
      await pool.query("DELETE FROM campaign_homebrew_monsters WHERE campaign_id=$1", [id]);
      await pool.query("DELETE FROM campaign_items WHERE campaign_id=$1", [id]);
      await pool.query("DELETE FROM campaigns WHERE id=$1 AND owner_user_id=$2", [id, owner.userId]);
    }
    await pool.end();
  }
});
