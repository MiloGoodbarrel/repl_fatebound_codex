import assert from "node:assert/strict";
import test from "node:test";
import { campaignProfileToMonster, creatureProfileSchema, profileLibraryColumns, type CreatureProfile } from "../shared/creatureProfiles";
import { applyFreedomWeakening, hasFreedomWeakening, normalizeRescuedCaptives } from "../shared/freedomWeakening";
import { createEncounterRestoreState, createPreparedEncounterSnapshot } from "../shared/encounterRecovery";
import { homebrewDisposition } from "../shared/homebrewDisposition";

const quill: CreatureProfile = {
  index: "quill", name: "Pellinore Quill", hp: 82, ac: 15, cr: "5", type: "humanoid", size: "Medium",
  str: 10, dex: 16, con: 16, int: 18, wis: 14, cha: 20,
  strMod: 0, dexMod: 3, conMod: 3, intMod: 4, wisMod: 2, chaMod: 5,
  savingThrows: { int: 8, cha: 9 }, spellSaveDc: 17, spellAttackBonus: 9,
  special_abilities: [
    { name: "Weakened by Freedom", desc: "For each captive freed: -1, minimum +1 bonus." },
    { name: "Spellcasting", desc: "Spell save DC 17, +9 to hit with spell attacks. 6th level: mass suggestion." },
  ],
  actions: [
    { name: "Cane", desc: "Melee Weapon Attack: +6 to hit. Hit: 1d6 + 3 bludgeoning plus 2d6 psychic.", attack_bonus: 6 },
    { name: "Enthrall Audience", desc: "DC 17 Wisdom saving throw; this is not a spell." },
  ],
  detailedActions: [
    { name: "Cane", description: "+6 to hit; 1d6 + 3 plus 2d6 psychic.", category: "action", attackBonus: 6 },
    { name: "Theatrical Flourish", description: "Teleport 30 ft.", category: "bonus" },
    { name: "Dramatic Reversal", description: "Cast a spell of 3rd level or lower.", category: "reaction" },
    { name: "Move", description: "Move without provoking attacks.", category: "legendary" },
  ],
  source: "The Hollow Carnival", sourcePage: 19,
  resistances: ["psychic"], conditionImmunities: ["charmed"], languages: "Common, Sylvan",
  disposition: { combatantType: "monster", stance: "enemy", referenceOnly: false },
};

function libraryEntry(profileData: CreatureProfile | null = quill) {
  return {
    id: 42, name: quill.name, printedAverageHp: 82, armorClass: 15, hitDice: "11d8 + 33",
    dexScore: 16, challengeRating: "5", creatureType: "humanoid", size: "Medium",
    alignment: "chaotic evil", actions: [{ actionName: "Legacy Cane", actionDescription: "+6 to hit", attackBonus: 6 }],
    profileData,
  };
}

test("complete campaign profiles preserve every structured field through validation, storage and library addition", () => {
  const stored = profileLibraryColumns(creatureProfileSchema.parse(JSON.parse(JSON.stringify(quill))));
  const added = campaignProfileToMonster({ ...libraryEntry(), ...stored });
  assert.equal(added.int, 18);
  assert.equal(added.cha, 20);
  assert.deepEqual(added.detailedActions, quill.detailedActions);
  assert.deepEqual(added.special_abilities, quill.special_abilities);
  assert.deepEqual(added.savingThrows, quill.savingThrows);
  assert.equal(added.spellSaveDc, 17);
  assert.deepEqual(added.conditionImmunities, ["charmed"]);
  assert.equal(added.source, quill.source);
  added.actions![0].desc = "local change";
  assert.notEqual(quill.actions![0].desc, "local change");
});

test("legacy campaign creatures remain usable without a rich profile", () => {
  const legacy = campaignProfileToMonster(libraryEntry(null));
  assert.equal(legacy.dexMod, 3);
  assert.equal(legacy.actions?.[0].name, "Legacy Cane");
  assert.equal(legacy.hp, 82);
});

test("structured friendly and reference-only disposition is preserved without legacy label actions", () => {
  const friendly = { ...quill, disposition: { combatantType: "npc" as const, stance: "ally" as const, referenceOnly: false } };
  assert.equal(homebrewDisposition([], friendly).stance, "ally");
  const reference = { ...friendly, disposition: { ...friendly.disposition, referenceOnly: true } };
  assert.equal(homebrewDisposition([], reference).referenceOnly, true);
  assert.equal(profileLibraryColumns(reference).armorClass, null);
});

test("rescued captives weaken actual attack and saving bonuses and spell DC without changing ability scores or damage", () => {
  const effective = applyFreedomWeakening(quill, 3);
  assert.equal(effective.actions?.[0].attack_bonus, 3);
  assert.match(effective.actions![0].desc, /\+3 to hit/);
  assert.match(effective.actions![0].desc, /1d6 \+ 3.*2d6 psychic/);
  assert.equal(effective.detailedActions?.[0].attackBonus, 3);
  assert.equal(effective.savingThrows?.int, 5);
  assert.equal(effective.savingThrows?.cha, 6);
  assert.equal(effective.spellSaveDc, 14);
  assert.equal(effective.spellAttackBonus, 6);
  assert.match(effective.special_abilities![1].desc, /DC 14, \+6 to hit/);
  assert.equal(effective.actions![1].desc, quill.actions![1].desc); // Non-spell ability DC stays printed.
  assert.equal(effective.dexMod, 3);
  assert.equal(effective.cha, 20);
  assert.equal(quill.actions?.[0].attack_bonus, 6);
  assert.equal(quill.spellSaveDc, 17);
});

test("positive bonus floors, zero rescues, changing counts and invalid input are handled without cumulative penalties", () => {
  const maximum = applyFreedomWeakening(quill, 1000);
  assert.equal(maximum.actions?.[0].attack_bonus, 1);
  assert.equal(maximum.savingThrows?.int, 1);
  assert.equal(maximum.spellSaveDc, 1);
  assert.equal(applyFreedomWeakening(quill, 0).actions?.[0].attack_bonus, 6);
  assert.equal(applyFreedomWeakening(quill, 2).actions?.[0].attack_bonus, 4);
  assert.equal(applyFreedomWeakening(quill, 1).actions?.[0].attack_bonus, 5);
  assert.equal(normalizeRescuedCaptives(-2), 0);
  assert.equal(normalizeRescuedCaptives(NaN), 0);
  assert.equal(normalizeRescuedCaptives(2.8), 2);
});

test("old prepared Quill snapshots obtain printed saves and casting stats without altering source notes", () => {
  const legacy = structuredClone(quill);
  delete legacy.savingThrows;
  delete legacy.spellSaveDc;
  delete legacy.spellAttackBonus;
  legacy.special_abilities!.push({ name: "Source and Printed Defenses", desc: "Saves Int +8, Cha +9 Skills Deception +15." });
  const adjusted = applyFreedomWeakening(legacy, 2);
  assert.equal(adjusted.savingThrows?.int, 6);
  assert.equal(adjusted.savingThrows?.cha, 7);
  assert.equal(adjusted.spellSaveDc, 15);
  assert.match(adjusted.special_abilities![2].desc, /Saves Int \+8, Cha \+9/);
});

test("unrelated creatures, ordinary ability checks and initiative are not weakened", () => {
  const other = { ...quill, special_abilities: [] };
  assert.equal(hasFreedomWeakening(other), false);
  assert.equal(applyFreedomWeakening(other, 4), other);
  assert.equal(applyFreedomWeakening(quill, 4).dexMod, 3);
});

test("save and restore keep the count and baseline once; a prepared template always resets the count", () => {
  const saved = { combatants: [{ ...quill, monsterData: quill, initiative: 12 }], rescuedCaptives: 4, combatState: "active" };
  const restored = createEncounterRestoreState<typeof saved.combatants[0]>(JSON.parse(JSON.stringify(saved)))!;
  assert.equal(restored.rescuedCaptives, 4);
  assert.equal(applyFreedomWeakening(restored.combatants[0].monsterData, restored.rescuedCaptives!).spellSaveDc, 13);
  assert.equal(restored.combatants[0].monsterData.spellSaveDc, 17);
  assert.equal(createPreparedEncounterSnapshot(saved)?.rescuedCaptives, 0);
  assert.equal(createEncounterRestoreState({ combatants: [], rescuedCaptives: -1 })?.rescuedCaptives, 0);
});
