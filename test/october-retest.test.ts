import test from "node:test";
import assert from "node:assert/strict";
import { healGroupMember, memberMaximums } from "../shared/groupHitPoints";
import { normalizeEncounterSnapshot, createPreparedEncounterSnapshot, resizePreparedGroup } from "../shared/encounterRecovery";
import { normalizeItemCategory, itemCategoryFilterValues } from "../shared/itemCategories";
import { parseTableDraft } from "../client/src/lib/tableDraft";
import { statblockBody } from "../shared/statblockText";

test("rolled grouped healing never lowers HP and uses each member's own maximum", () => {
  const group = { maxHp: 7, memberHp: [11, 8, 2], memberMaxHp: [12, 8, 4] };
  assert.deepEqual(healGroupMember(group, 0, 1).memberHp, [12, 8, 2]);
  assert.deepEqual(healGroupMember(group, 1, 1).memberHp, [11, 8, 2]);
  assert.deepEqual(healGroupMember(group, 2, 20).memberHp, [11, 8, 4]);
  assert.deepEqual(group.memberHp, [11, 8, 2]);
  assert.deepEqual(healGroupMember(group, 0, -5).memberHp, group.memberHp);
  for (let max = 1; max < 30; max++) for (let hp = 0; hp <= max; hp++)
    for (const heal of [1, 5, 50]) {
      const actual = healGroupMember({ maxHp: 7, memberHp: [hp], memberMaxHp: [max] }, 0, heal);
      assert.equal(actual.memberHp[0], Math.min(max, hp + heal));
    }
});

test("individual maxima survive saves, prepared recovery and resizing; legacy recovery does not discard HP", () => {
  const snapshot = { combatants: [{ id: "g", isGroup: true, initiative: 18, maxHp: 7,
    hp: 11, memberHp: [11, 3], memberMaxHp: [12, 4] }], round: 2, activeIndex: 0, combatState: "active" };
  const roundTrip = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(normalizeEncounterSnapshot<any>(roundTrip)!.combatants[0].memberMaxHp, [12, 4]);
  const prepared = createPreparedEncounterSnapshot<any>(roundTrip)!;
  assert.deepEqual(prepared.combatants[0].memberHp, [12, 4]);
  const resized = resizePreparedGroup<any>(roundTrip, "g", 3)!;
  assert.deepEqual(resized.combatants[0].memberHp, [12, 4, 7]);
  assert.deepEqual(resized.combatants[0].memberMaxHp, [12, 4, 7]);
  assert.deepEqual(memberMaximums({ maxHp: 7, memberHp: [11, 3] }), [11, 7]);
  assert.deepEqual(healGroupMember({ maxHp: 7, memberHp: [11, 3] }, 0, 1).memberHp, [11, 3]);
});

test("custom category aliases match stock selections without broadening unrelated categories", () => {
  assert.equal(normalizeItemCategory("Wondrous Item"), normalizeItemCategory("Wondrous Items"));
  assert.equal(normalizeItemCategory("staff"), "Staves");
  assert.deepEqual(itemCategoryFilterValues(["Wondrous Items"]), ["wondrous items", "wondrous item"]);
  assert.ok(!itemCategoryFilterValues(["Weapons"]).includes("armor"));
});

test("table draft validation recovers form strings and rejects invalid or excessive data", () => {
  const draft = { id: 7, name: "Unsaved name", description: "draft", category: "Custom", mode: "weighted",
    entries: [{ text: "Mist", minRoll: "1", maxRoll: "1", weight: "3" }] };
  assert.deepEqual(parseTableDraft(JSON.stringify(draft)), draft);
  for (const raw of ["{", "null", JSON.stringify({ ...draft, mode: "invalid" }),
    JSON.stringify({ ...draft, entries: [null] }), JSON.stringify({ ...draft, entries: [{ text: 5 }] })])
    assert.equal(parseTableDraft(raw), null);
});

test("statblock display removes a repeated heading without modifying source descriptions", () => {
  assert.equal(statblockBody("Nimble Escape", "Nimble Escape. The goblin hides."), "The goblin hides.");
  assert.equal(statblockBody("Scimitar", "Melee Weapon Attack: +4 to hit."), "Melee Weapon Attack: +4 to hit.");
  assert.equal(statblockBody("Bite", "Bite attacks have reach."), "Bite attacks have reach.");
});
