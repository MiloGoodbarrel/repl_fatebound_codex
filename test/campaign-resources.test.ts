import test from "node:test";
import assert from "node:assert/strict";
import { planResourceLinks, resourceLinkSchema } from "../shared/campaignResources";

test("link selection accepts only items and NPCs and rejects empty or excessive selections", () => {
  assert.deepEqual(resourceLinkSchema.parse({ sourceCampaignId: 2, itemIds: [3, 3] }), {
    sourceCampaignId: 2, itemIds: [3], npcIds: [],
  });
  assert.equal(resourceLinkSchema.safeParse({ sourceCampaignId: 2 }).success, false);
  for (const forbidden of ["encounterIds", "rollTableIds", "characterIds", "savedEncounter"]) {
    assert.equal(resourceLinkSchema.safeParse({ sourceCampaignId: 2, itemIds: [1], [forbidden]: [1] }).success, false);
  }
  assert.equal(resourceLinkSchema.safeParse({ sourceCampaignId: 2, npcIds: [-1] }).success, false);
  assert.equal(resourceLinkSchema.safeParse({ sourceCampaignId: 2, itemIds: Array.from({ length: 501 }, (_, index) => index + 1) }).success, false);
});

test("link plans contain source identities only, never copied statistics or action records", () => {
  const source = [{ id: 8, name: "Quill", profileData: { cha: 20, spellSaveDc: 17 } }];
  const before = structuredClone(source);
  assert.deepEqual(planResourceLinks(source, [8], []), { resourceIds: [8], existing: 0 });
  assert.deepEqual(source, before);
});

test("repeated selections and existing links never create duplicate references", () => {
  assert.deepEqual(planResourceLinks([{ id: 1 }, { id: 2 }], [1, 1, 2], [1]), {
    resourceIds: [2], existing: 1,
  });
});

test("resources with matching names retain distinct identities rather than overwriting or hiding each other", () => {
  const source = [{ id: 1, name: "Guard" }, { id: 2, name: "Guard" }];
  assert.deepEqual(planResourceLinks(source, [1, 2], []), { resourceIds: [1, 2], existing: 0 });
});

test("missing or foreign resource IDs fail before any links are created", () => {
  assert.throws(() => planResourceLinks([{ id: 1 }], [1, 100], []), /no longer belongs/);
});

test("link plans do not retain stale copies when the source profile changes", () => {
  const source = [{ id: 4, name: "Friendly NPC", profileData: { cha: 20, disposition: "ally" } }];
  const plan = planResourceLinks(source, [4], []);
  source[0].profileData.cha = 14;
  assert.deepEqual(plan, { resourceIds: [4], existing: 0 });
  assert.equal(source.find(row => row.id === plan.resourceIds[0])?.profileData.cha, 14);
});
