import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { localDate } from "../shared/localDate";
import { parseEncounterRevision, nextEncounterRevision } from "../shared/encounterConcurrency";
import { encounterBaseRevisionPredicate } from "../server/encounterPersistence";
import { WorkspaceDemoApi, type DemoStorage } from "../client/src/demo/workspaceApi";

test("local session dates follow the calendar day in Denver and east of UTC", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "America/Denver";
    assert.equal(localDate(new Date("2026-10-30T02:51:00Z")), "2026-10-29");
    assert.equal(localDate(new Date("2026-03-08T08:59:00Z")), "2026-03-08");
    process.env.TZ = "Pacific/Auckland";
    assert.equal(localDate(new Date("2026-10-29T12:30:00Z")), "2026-10-30");
  } finally {
    if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
  }
});

test("encounter base revisions are explicit and SQL checks equality, not newer client clocks", () => {
  assert.equal(parseEncounterRevision("none"), null);
  assert.equal(parseEncounterRevision("0"), 0);
  assert.equal(parseEncounterRevision("12"), 12);
  for (const invalid of [null, "", "-1", "1.5", "NaN", "999999999999999999999"])
    assert.equal(parseEncounterRevision(invalid), undefined);
  assert.ok(nextEncounterRevision(Date.now() + 100000, {}) > Date.now() + 99999);
  const query = new PgDialect().sqlToQuery(encounterBaseRevisionPredicate(12));
  assert.match(query.sql, /saveRevision.*= \$1/);
  assert.doesNotMatch(query.sql, /<=/);
  assert.deepEqual(query.params, [12]);
});

test("stale tabs cannot overwrite or clear a newer encounter, including simultaneous writes", async () => {
  const map = new Map<string, string>();
  const storage: DemoStorage = { getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
  let tail: Promise<unknown> = Promise.resolve();
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const request = tail.then(work); tail = request.catch(() => {}); return request;
  }
  const a = new WorkspaceDemoApi(storage, undefined, undefined, serialize);
  const b = new WorkspaceDemoApi(storage, undefined, undefined, serialize);
  const url = new URL("https://demo.test/api/campaigns/1/encounter");
  const write = (api: WorkspaceDemoApi, data: object, base: number | null) =>
    api.request(url, "PUT", data, { "X-Encounter-Revision": base === null ? "none" : String(base) });
  const original = { combatants: [{ id: "hero", hp: 7 }], round: 1 };
  assert.equal((await a.request(url, "PUT", original)).status, 428);
  const created = await write(a, original, null);
  assert.equal(created.status, 200);
  const base = (await created.json()).revision;
  const updated = await write(b, { ...original, combatants: [{ id: "hero", hp: 12 }] }, base);
  assert.equal(updated.status, 200);
  const current = (await updated.json()).revision;
  const stale = await write(a, { ...original, saveRevision: current + 100000, round: 9 }, base);
  assert.equal(stale.status, 409, "a later client clock is not authority to overwrite");
  assert.equal((await a.request(url, "DELETE", undefined, { "X-Encounter-Revision": String(base) })).status, 409);
  assert.equal((await (await a.request(url)).json()).data.combatants[0].hp, 12);
  const concurrent = await Promise.all([write(a, { ...original, round: 2 }, current),
    write(b, { ...original, round: 3 }, current)]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  const latest = await (await a.request(url)).json();
  assert.equal((await a.request(url, "DELETE", undefined, { "X-Encounter-Revision": String(latest.data.saveRevision) })).status, 200);
  assert.equal((await a.request(url)).status, 404);
  // The same browser-wide lock protects unrelated records from whole-store races.
  await Promise.all([a.request(new URL("https://demo.test/api/campaigns"), "POST", { name: "Tab A" }),
    b.request(new URL("https://demo.test/api/campaigns"), "POST", { name: "Tab B" })]);
  const campaigns = await (await a.request(new URL("https://demo.test/api/campaigns"))).json();
  assert.ok(campaigns.some((c: any) => c.name === "Tab A"));
  assert.ok(campaigns.some((c: any) => c.name === "Tab B"));
});
