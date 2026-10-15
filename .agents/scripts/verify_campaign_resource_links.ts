/** Live verification uses only disposable campaigns; original campaign resources are read-only. */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../../server/db";
import { campaignItems, campaigns, campaignHomebrewActions } from "../../shared/schema";

const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
async function call(path: string, method = "GET", body?: unknown, status = 200, contentType = "application/json"): Promise<any> {
  const response = await fetch(base + path, {
    method, headers: { "Content-Type": contentType },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
const originalCampaigns = await call("/api/campaigns");
const originals = new Map<number, any>();
for (const campaign of originalCampaigns) originals.set(campaign.id, await call(`/api/campaigns/${campaign.id}/resources`));
const created: number[] = [];
let prepared: any, table: any;
try {
  for (const name of ["Link verification source", "Link verification destination"]) {
    created.push((await call("/api/campaigns", "POST", { name, edition: "5e" })).id);
  }
  const [source, target] = created;
  const sourcePath = `/api/campaigns/${source}`, targetPath = `/api/campaigns/${target}`;
  await call(`${sourcePath}/import`, "POST",
    "name,category,rarity,description\nVerification Token,Wondrous Items,Uncommon,Original effect\nUnselected Ticket,Wondrous Items,Rare,Not selected\n",
    200, "text/csv");
  const profile = {
    index: "verification-quill", name: "Verification Quill", hp: 82, ac: 15, cr: "5", type: "humanoid", size: "Medium",
    str: 10, dex: 16, con: 16, int: 18, wis: 14, cha: 20,
    savingThrows: { int: 8, cha: 9 }, spellSaveDc: 17, spellAttackBonus: 9,
    actions: [{ name: "Cane", desc: "+6 to hit; 1d6 + 3 damage.", attack_bonus: 6 }],
    special_abilities: [{ name: "Weakened by Freedom", desc: "Printed source baseline." }],
    detailedActions: ["action", "bonus", "reaction", "legendary"].map(category => ({ name: category, description: category + " rules", category })),
    disposition: { combatantType: "monster", stance: "enemy", referenceOnly: false }, source: "Verification fixture",
  };
  await call(`${sourcePath}/homebrew-bestiary/import`, "POST", { profiles: [profile] });
  await call(`${sourcePath}/homebrew-bestiary/import`, "POST",
    "name,type,size,ac,hp,dex,cr,action1_name,action1_desc,action1_attack_bonus\nLegacy verification gate,construct,Medium,15,22,12,1,Slam,Printed slam rules,4\n",
    200, "text/csv");
  await call(`${sourcePath}/characters`, "POST", { name: "Source-only party member", maxHp: 10, ac: 10 });
  prepared = await call(`${sourcePath}/prepared-encounters`, "POST", {
    name: "Source-only encounter", data: { combatants: [{ id: "source-only", name: "NPC", initiative: 0, hp: 10, maxHp: 10, combatantType: "npc" }] },
  }, 201);
  table = await call("/api/roll-tables", "POST", {
    campaignId: source, name: "Source-only table", mode: "weighted", entries: [{ text: "Source-only reward", weight: 1 }],
  }, 201);
  await call(`${sourcePath}/encounter`, "PUT", { combatants: [], rescuedCaptives: 4 });
  const before = await call(`${sourcePath}/resources`);
  const item = before.items.find((row: any) => row.name === "Verification Token");
  const body = { sourceCampaignId: source, itemIds: [item.id], npcIds: before.npcs.map((npc: any) => npc.id) };
  const endpoint = `${targetPath}/resources/links`;
  await call(`${targetPath}/resources/import`, "POST", body, 410);
  await call(endpoint, "POST", { ...body, npcIds: [99999999] }, 400);
  assert.deepEqual(await call(`${targetPath}/resources`), { items: [], npcs: [], links: [] });
  for (const change of [{ sourceCampaignId: target }, { encounterIds: [prepared.id] }, { itemIds: [], npcIds: [] }]) {
    await call(endpoint, "POST", { ...body, ...change }, 400);
  }
  await call(endpoint, "POST", { ...body, sourceCampaignId: 99999999 }, 404);
  const results = await Promise.all([0, 1, 2].map(() => call(endpoint, "POST", body)));
  assert.equal(results.reduce((sum, result) => sum + result.linkedItems, 0), 1);
  assert.equal(results.reduce((sum, result) => sum + result.linkedNpcs, 0), 2);
  const destination = await call(`${targetPath}/resources`);
  assert.equal(destination.items.length + destination.npcs.length, 0, "No resource records may be copied");
  assert.equal(destination.links.length, 3);
  for (const original of before.npcs) {
    const visible = (await call(`${targetPath}/homebrew-bestiary`)).find((npc: any) => npc.id === original.id);
    const { linkedSource, ...sourceRecord } = visible;
    assert.deepEqual(sourceRecord, original);
    assert.equal(linkedSource.campaignId, source);
  }
  await call(`${sourcePath}/resources/links`, "POST", { sourceCampaignId: target, itemIds: [item.id] }, 400);
  assert.deepEqual(await call(`${targetPath}/characters`), []);
  assert.deepEqual(await call(`${targetPath}/prepared-encounters`), []);
  await call(`${targetPath}/encounter`, "GET", undefined, 404);
  assert.equal((await call(`/api/roll-tables?campaignId=${target}`)).filter((row: any) => row.campaignId === target).length, 0);

  const richNpc = before.npcs.find((npc: any) => npc.profileData);
  await call(`${sourcePath}/homebrew-bestiary/${richNpc.id}/profile`, "PATCH", {
    ...richNpc.profileData, name: "Updated source NPC", cha: 14, spellSaveDc: 18,
  });
  await db.update(campaignItems).set({ description: "Updated source effect" })
    .where(and(eq(campaignItems.id, item.id), eq(campaignItems.campaignId, source)));
  await db.update(campaigns).set({ name: "Updated source campaign" }).where(eq(campaigns.id, source));
  const legacy = before.npcs.find((npc: any) => !npc.profileData);
  await db.update(campaignHomebrewActions).set({ actionDescription: "Updated source slam" })
    .where(eq(campaignHomebrewActions.monsterRefId, legacy.id));
  const visibleNpcs = await call(`${targetPath}/homebrew-bestiary`);
  assert.equal(visibleNpcs.find((npc: any) => npc.id === richNpc.id).profileData.cha, 14);
  assert.equal(visibleNpcs.find((npc: any) => npc.id === richNpc.id).name, "Updated source NPC");
  assert.equal(visibleNpcs.find((npc: any) => npc.id === legacy.id).actions[0].actionDescription, "Updated source slam");
  const visibleItem = (await call(`${targetPath}/items`))[0];
  assert.equal(visibleItem.id, item.id);
  assert.equal(visibleItem.description, "Updated source effect");
  assert.equal(visibleItem.linkedSource.campaignName, "Updated source campaign");
  const drawn = await call("/api/items/draw", "POST", {
    source: "campaign", campaignId: target, categories: ["Wondrous Items"], rarities: ["Uncommon"],
    sources: [], count: 1, search: "Verification Token",
  });
  assert.equal(drawn[0].id, item.id);
  assert.equal(drawn[0].description, "Updated source effect");
  const itemLink = destination.links.find((link: any) => link.kind === "items");
  await call(`${sourcePath}/resources/links/${itemLink.id}`, "DELETE", undefined, 404);
  await call(`${endpoint}/${itemLink.id}`, "DELETE");
  assert.deepEqual(await call(`${targetPath}/items`), []);
  assert.equal((await call(`${sourcePath}/items`)).find((row: any) => row.id === item.id).description, "Updated source effect");
  await call(endpoint, "POST", { sourceCampaignId: source, itemIds: [item.id] });
  await db.delete(campaignItems).where(and(eq(campaignItems.id, item.id), eq(campaignItems.campaignId, source)));
  assert.deepEqual(await call(`${targetPath}/items`), []);
  await call(`${sourcePath}/homebrew-bestiary`, "DELETE");
  assert.deepEqual(await call(`${targetPath}/homebrew-bestiary`), []);
  assert.deepEqual((await call(`${targetPath}/resources`)).links, []);
  const remainingItem = (await call(`${sourcePath}/items`))[0];
  await call(endpoint, "POST", { sourceCampaignId: source, itemIds: [remainingItem.id] });
  await call(`/api/roll-tables/${table.id}?campaignId=${source}`, "DELETE"); table = undefined;
  await call(`${sourcePath}/prepared-encounters/${prepared.id}`, "DELETE"); prepared = undefined;
  await call(sourcePath, "DELETE"); created.splice(created.indexOf(source), 1);
  assert.deepEqual((await call(`${targetPath}/resources`)).links, []);
  for (const [id, original] of originals) assert.deepEqual(await call(`/api/campaigns/${id}/resources`), original);
  console.log("PASS: live source stats/actions/items, loot draws, identity preservation without copies, concurrent deduplication, unlink/source deletion, scope isolation, and unchanged existing campaigns.");
} finally {
  if (table) await call(`/api/roll-tables/${table.id}?campaignId=${created[0]}`, "DELETE");
  if (prepared) await call(`/api/campaigns/${created[0]}/prepared-encounters/${prepared.id}`, "DELETE");
  for (const id of created.reverse()) await call(`/api/campaigns/${id}`, "DELETE");
  await pool.end();
  console.log("Removed temporary verification campaigns and resources.");
}
