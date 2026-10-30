import test from "node:test";
import assert from "node:assert/strict";
import { untilFirstLightProfiles as profiles } from "../server/data/untilFirstLight";
import { creatureProfileSchema, profileLibraryColumns, campaignProfileToMonster } from "../shared/creatureProfiles";

test("Until First Light has eight validated profiles, no pregens or invented ability scores", () => {
  assert.equal(profiles.length, 8);
  assert.equal(new Set(profiles.map(p => p.index)).size, 8);
  for (const p of profiles) {
    assert.equal(creatureProfileSchema.safeParse(p).success, true);
    assert.equal(p.source, "Until First Light");
    assert.ok([11, 12].includes(p.sourcePage!));
    for (const ability of ["str","dex","con","int","wis","cha","hit_dice"] as const) assert.equal(p[ability], undefined);
    assert.equal(p.cr, "—");
  }
});

test("kill thresholds remain explicit counters, not fabricated printed HP", () => {
  for (const p of profiles.slice(0, 3)) {
    assert.ok(p.hpLabel);
    const row = profileLibraryColumns(p);
    assert.equal(row.printedAverageHp, null);
    const restored = campaignProfileToMonster({ id: 88, ...row, actions: [] });
    assert.equal(restored.hpLabel, p.hpLabel);
    assert.equal(restored.hp, p.hp);
  }
  assert.match(profiles[2].special_abilities![0].desc, /SAME turn/);
  assert.match(profiles[2].special_abilities![0].desc, /reset the counter/);
});

test("level variants preserve exact health, automatic hits and Shepherd discrepancies", () => {
  assert.deepEqual(profiles.slice(3,7).map(p => p.hp), [60,80,45,60]);
  for (const p of profiles.slice(3,5)) {
    assert.equal(p.ac, 15);
    assert.equal(p.actions![0].attack_bonus, undefined);
    assert.match(p.actions![0].desc, /Always hits/);
    assert.deepEqual(p.vulnerabilities, ["fire"]);
  }
  for (const p of profiles.slice(5,7)) {
    assert.equal(p.ac, 13);
    assert.match(p.description!, /overview table lists AC 12/);
    assert.deepEqual(p.conditionImmunities, ["charmed","frightened"]);
    assert.equal(p.actions![0].attack_bonus, 5);
    assert.deepEqual(p.detailedActions!.map(a => a.category), ["reaction","legendary"]);
    assert.match(p.special_abilities!.find(a => a.name === "Cornered")!.desc, p.hp === 45 ? /22 HP/ : /30 HP/);
  }
  const survivor = profiles[7];
  assert.equal(survivor.hp, 12);
  assert.equal(survivor.ac, 10);
  assert.deepEqual(survivor.actions, []);
  assert.equal(survivor.disposition?.combatantType, "npc");
});
