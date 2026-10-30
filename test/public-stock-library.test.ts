import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { publicStockLibrary, stockMonsterDetail } from "../server/publicStockLibrary";
import { SOURCEBOOK_NAMES, sourcebookName, sourcebookMatches } from "../shared/sourcebooks";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

test("source names cover every seeded stock identifier, composites and full-name searches", () => {
  assert.equal(sourcebookName("PHB"), "Player's Handbook");
  assert.equal(sourcebookName("phb"), "Player's Handbook");
  assert.equal(sourcebookName("DMG+PHB"), "Dungeon Master's Guide + Player's Handbook");
  assert.equal(sourcebookName("HOTDQ/ROT"), "Hoard of the Dragon Queen / The Rise of Tiamat");
  assert.equal(sourcebookName("Grim Hollow: The Monster Grimoire"), "Grim Hollow: The Monster Grimoire");
  assert.equal(sourcebookName("Unknown supplement"), "Unknown supplement");
  assert.ok(sourcebookMatches("PHB", "player"));
  assert.ok(sourcebookMatches("PHB", "phb"));
  assert.ok(!sourcebookMatches("PHB", "dragon"));
  const rows: string[][] = parse(readFileSync("server/data/5e_loot.csv", "utf8"), { relax_column_count: true });
  for (const source of rows.map(r => r[12]).filter(Boolean)) {
    for (const code of source.split(/[+/]/))
      assert.ok(SOURCEBOOK_NAMES[code.trim().toUpperCase()], `Missing source name: ${code}`);
  }
});

test("public stock router exposes only fixed shared reads, full detail and bounded filters", async () => {
  const calls: [string, unknown[]][] = [];
  const monster = { monsterId: "stock-one", name: "Stock monster", printedAverageHp: 12, armorClass: 13,
    sourceBook: "Monster Manual", challengeRating: "1", traits: [{ traitName: "Keen", traitDescription: "Aware." }],
    actions: [{ actionName: "Claw", actionCategory: "action", actionDescription: "A claw.", attackBonus: 4 }] };
  const items = [{ id: 1, name: "Stock item", source: "PHB" }];
  const methods: Record<string, (...args: any[]) => any> = {
    getItems5e: () => items, getSources5e: () => ["PHB", "DMG"],
    getBestiaryTypes: () => ["Beast"], getBestiaryCRs: () => ["1"], getBestiarySources: () => ["Monster Manual"],
    searchBestiary: () => [monster], getRandomBestiaryMonster: () => monster, getEncounterGroup: () => [monster],
    getBestiaryMonsterDetail: (id: string) => id === "stock-one" ? monster : null,
  };
  const reader: any = new Proxy({}, { get: (_target, name: string) => {
    assert.ok(methods[name], `Attempt to access non-stock repository method: ${name}`);
    return async (...args: any[]) => { calls.push([name, args]); return methods[name](...args); };
  } });
  const app = express();
  app.use("/demo-library", publicStockLibrary(reader, {}));
  // A sentinel proves unmatched stock paths cannot continue to another handler.
  app.use((_req, res) => { res.status(599).end("unsafe fallback"); });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/demo-library`;
  try {
    assert.deepEqual(await (await fetch(`${base}/items/5e?campaignId=123`)).json(), items);
    assert.deepEqual(await (await fetch(`${base}/items/5e/sources`)).json(), ["PHB", "DMG"]);
    for (const path of ["types", "cr-values", "sources"])
      assert.equal((await fetch(`${base}/bestiary/${path}`)).status, 200);
    const search = await fetch(`${base}/bestiary/monsters?search=stock&types=Beast&cr=1&sources=Monster%20Manual&limit=999&campaignId=123`);
    assert.equal(search.status, 200);
    assert.deepEqual(calls.find(c => c[0] === "searchBestiary")![1], ["stock", ["Beast"], 100, "1", ["Monster Manual"]]);
    for (const path of ["random", "encounter"])
      assert.equal((await fetch(`${base}/bestiary/monsters/${path}?cr=1`)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/bestiary/monsters/stock-one`)).json(),
      JSON.parse(JSON.stringify(stockMonsterDetail(monster))));
    assert.equal((await fetch(`${base}/bestiary/monsters/private-campaign-creature`)).status, 404);
    const before = calls.length;
    for (const method of ["POST", "PUT", "PATCH", "DELETE"])
      assert.equal((await fetch(`${base}/items/5e`, { method })).status, 405);
    for (const path of ["/campaigns", "/account", "/campaigns/1/items", "/api/campaigns", "/bestiary/template.csv"])
      assert.equal((await fetch(base + path)).status, 404);
    assert.equal(calls.length, before, "Denied paths/writes must not touch a repository");
    const head = await fetch(`${base}/items/5e/sources`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.match(head.headers.get("x-robots-tag")!, /noindex/);
    methods.getItems5e = () => { throw new Error("internal database details"); };
    const failed = await fetch(`${base}/items/5e`);
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /internal database details/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
