import test from "node:test";
import assert from "node:assert/strict";
import { creatureProfileSchema, profileLibraryColumns } from "../shared/creatureProfiles";
import { session5CombatProfiles, session5ReferenceProfiles, session5PreparedEncounters,
  session5Notes, SESSION5_SOURCE } from "../server/data/aetherfallSession5";
import { normalizeEncounterSnapshot } from "../shared/encounterRecovery";
import { validateText } from "../shared/journal";
import type { Pool } from "pg";
import { importAetherfallSession5 } from "../server/importAetherfallSession5";

test("Session 5 preserves seven printed statblocks, explicit sidekick choices and source discrepancies", () => {
  assert.equal(session5CombatProfiles.length, 7);
  for (const profile of session5CombatProfiles) {
    assert.ok(creatureProfileSchema.safeParse(profile).success);
    assert.equal(profile.source, SESSION5_SOURCE);
    assert.ok(profile.sourcePage && profile.sourcePage >= 9 && profile.sourcePage <= 12);
  }
  const goblin = session5CombatProfiles.find(p => p.name === "Ashborn Goblin")!;
  const hobgoblin = session5CombatProfiles.find(p => p.name === "Ashborn Hobgoblin")!;
  assert.deepEqual([goblin.hp, goblin.ac, goblin.cr], [16, 13, "1/2"]);
  assert.deepEqual([hobgoblin.hp, hobgoblin.ac, hobgoblin.cr], [30, 15, "1"]);
  assert.ok(goblin.actions?.some(a => a.name === "Infect (1/Day)" && a.desc.includes("DC 12")));
  assert.ok(hobgoblin.actions?.some(a => a.name === "Infect (3/Day)" && a.desc.includes("DC 13")));
  assert.ok(!hobgoblin.actions?.some(a => a.name === "Claw"));
  assert.ok(!goblin.special_abilities?.some(a => a.name === "Pitch Frenzy"));
  const liora = session5CombatProfiles.find(p => p.name === "Liora Holdt")!;
  assert.equal(liora.cr, "—");
  assert.equal(liora.actions?.[0].attack_bonus, 2);
  assert.equal(liora.disposition?.stance, "ally");
  assert.match(liora.description!, /No lessons are marked learned automatically/);
});

test("Unstatted cast remain noncombat references instead of fabricated statblocks", () => {
  assert.equal(session5ReferenceProfiles.length, 9);
  for (const npc of session5ReferenceProfiles) {
    assert.equal(npc.disposition?.referenceOnly, true);
    assert.equal(profileLibraryColumns(npc).printedAverageHp, null);
    assert.equal(profileLibraryColumns(npc).armorClass, null);
  }
  assert.ok(session5ReferenceProfiles.some(p => p.name === "Ruadh"));
  assert.ok(session5ReferenceProfiles.some(p => p.name === "Garran"));
});

test("Raid and reinforcement templates preserve exact counts without stacking waves or overwriting PCs", () => {
  const [raid, wave, lighter] = session5PreparedEncounters();
  assert.equal(raid.data.combatState, "setup");
  assert.deepEqual(raid.data.selectedVersions, ["5e"]);
  assert.equal(raid.data.combatants.filter(c => c.monsterData.name === "Ashborn Goblin").length, 0);
  const count = (data: typeof raid.data, name: string) => data.combatants.filter(c => c.monsterData.name === name)
    .reduce((n, c) => n + (c.isGroup ? c.memberHp!.length : 1), 0);
  assert.equal(count(raid.data, "Orc"), 4); assert.equal(count(raid.data, "Worg"), 1);
  assert.equal(count(raid.data, "Boar"), 2); assert.equal(count(raid.data, "Enthralled Sergeant"), 1);
  assert.equal(count(raid.data, "Liora Holdt"), 1);
  assert.ok(!raid.data.combatants.some(c => c.combatantType === "pc"));
  assert.equal(count(wave.data, "Ashborn Goblin"), 3);
  assert.equal(count(lighter.data, "Ashborn Goblin"), 2);
  assert.equal(count(wave.data, "Ashborn Hobgoblin"), 1);
  for (const encounter of [raid, wave, lighter]) {
    assert.ok(normalizeEncounterSnapshot(encounter.data));
    assert.match(encounter.data.combatants[0].monsterData.description!, /ENCOUNTER PREP:/);
    for (const c of encounter.data.combatants.filter(c => c.isGroup)) {
      assert.equal(c.memberHp!.length, c.memberMaxHp!.length);
      assert.ok(c.memberHp!.every(hp => hp === c.maxHp));
    }
  }
  assert.match(raid.data.prepNotes, /19 HP/);
  assert.match(wave.data.prepNotes, /Loading replaces/);
});

test("DM reference distinguishes preparation from history and includes image-only handouts", () => {
  assert.equal(validateText(session5Notes), session5Notes);
  assert.match(session5Notes, /not a record of completed play/);
  for (const name of ["The Prior's Letter", "Emerus's Second Letter", "The Steward's Letter", "The Tally"])
    assert.ok(session5Notes.includes(name));
  assert.match(session5Notes, /Hallowmere itself is not to be touched/);
  assert.match(session5Notes, /no numerical counts/);
  assert.match(session5Notes, /STANDARD D&D, NOT ZOMBICIDE/);
});

test("Receipt and campaign identity guards prevent repeated imports or targeting another workspace", async () => {
  for (const mode of ["receipt", "wrong-target"] as const) {
    const queries: string[] = [];
    let released = false;
    const database = { connect: async () => ({
      async query(sql: string) {
        queries.push(sql);
        if (sql.includes("FROM app_setup")) return { rowCount: mode === "receipt" ? 1 : 0, rows: [] };
        if (sql.includes("FROM campaigns")) return { rowCount: 0, rows: [] };
        if (sql.includes("count(DISTINCT name)")) return { rowCount: 1, rows: [{ count: 3 }] };
        return { rowCount: 0, rows: [] };
      },
      release() { released = true; },
    }) } as unknown as Pool;
    const result = await importAetherfallSession5(database);
    assert.equal(result.applied, false);
    assert.ok(!queries.some(q => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(q)));
    assert.ok(queries.includes("COMMIT")); assert.ok(released);
  }
});
