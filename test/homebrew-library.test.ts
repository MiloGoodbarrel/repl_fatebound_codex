import test from "node:test";
import assert from "node:assert/strict";
import type { CampaignHomebrewAction, CampaignHomebrewMonster } from "../shared/schema";
import { hydrateHomebrewLibrary } from "../server/homebrewLibrary";

function row(id: number, campaignId = 1) {
  const monster: CampaignHomebrewMonster = {
    id, campaignId, name: `Fictional creature ${id}`, creatureType: "undead", size: null,
    alignment: null, armorClass: 12, printedAverageHp: 20, hitDice: null,
    dexScore: null, challengeRating: null, profileData: null,
  };
  return { monster, owner: { id: campaignId, name: `Fictional campaign ${campaignId}` } };
}
function action(id: number, monsterRefId: number, actionOrder: number): CampaignHomebrewAction {
  return { id, monsterRefId, actionOrder, actionName: `Action ${id}`, actionDescription: "Fictional action", attackBonus: null };
}

test("homebrew hydrates 200 creatures with one actions fetch, preserving library and action order", async () => {
  const rows = Array.from({ length: 200 }, (_, i) => row(200 - i));
  let calls = 0;
  const results = await hydrateHomebrewLibrary(rows, 1, async ids => {
    calls++;
    assert.deepEqual(ids, rows.map(r => r.monster.id));
    // A globally ordered batch interleaves creatures; each subgroup must keep its order.
    return [action(1, 1, 0), action(2, 2, 0), action(3, 1, 1), action(4, 2, 1)];
  });
  assert.equal(calls, 1);
  assert.deepEqual(results.map(r => r.id), rows.map(r => r.monster.id));
  assert.deepEqual(results.find(r => r.id === 1)!.actions.map(a => a.id), [1, 3]);
  assert.deepEqual(results.find(r => r.id === 2)!.actions.map(a => a.id), [2, 4]);
  assert.deepEqual(results[0].actions, []);
  assert.equal("linkedSource" in results[0], false);
});

test("empty libraries skip the actions query entirely", async () => {
  const results = await hydrateHomebrewLibrary([], 1, async () => {
    assert.fail("An empty authorized library must not query actions");
  });
  assert.deepEqual(results, []);
});

test("linked source metadata and full profiles survive without including unrelated actions", async () => {
  const own = row(1), linked = row(2, 3);
  linked.monster.profileData = {
    index: "fictional", name: "Fictional creature", hp: 1, hpLabel: "Manual counter",
    ac: 12, cr: "—", type: "undead", size: "", source: "Fictional source",
    detailedActions: [{ name: "Blink", category: "reaction", description: "Fictional reaction" }],
  };
  const results = await hydrateHomebrewLibrary([own, linked], 1, async ids => {
    assert.deepEqual(ids, [1, 2]);
    return [action(1, 2, 0), action(2, 999, 0)];
  });
  assert.equal(results.length, 2);
  assert.deepEqual(results[1].linkedSource, { campaignId: 3, campaignName: "Fictional campaign 3" });
  assert.deepEqual(results[1].profileData, linked.monster.profileData);
  assert.deepEqual(results[1].actions.map(a => a.id), [1]);
  assert.deepEqual(results[0].actions, []);
  assert.equal("linkedSource" in results[0], false);
});

test("batch query failures are propagated, never returned as an apparently empty library", async () => {
  await assert.rejects(hydrateHomebrewLibrary([row(1)], 1, async () => {
    throw new Error("Database unavailable");
  }), /Database unavailable/);
});
