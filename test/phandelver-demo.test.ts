import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceDemo, validateWorkspaceDemo, WORKSPACE_DEMO_KEY } from "../client/src/demo/workspaceData";
import { PHANDELVER_ENCOUNTERS } from "../client/src/demo/phandelver/encounters";
import { PHANDELVER_PROFILES } from "../client/src/demo/phandelver/profiles";
import { creatureProfileSchema } from "../shared/creatureProfiles";
import { WorkspaceDemoApi } from "../client/src/demo/workspaceApi";

test("Phandelver demo has the five supplied, unnamed level-one pregens with exact core stats", () => {
  const data = createWorkspaceDemo();
  validateWorkspaceDemo(data);
  assert.equal(data.campaigns[0].name, "Lost Mine of Phandelver");
  assert.equal(data.campaigns[0].ownerUserId, null);
  assert.deepEqual(data.characters.filter(c => c.campaignId === 1).map(c => [c.name, c.maxHp, c.ac, c.initiativeBonus]), [
    ["Human Fighter (Noble)", 12, 17, -1], ["Hill Dwarf Cleric (Soldier)", 11, 18, -1],
    ["Lightfoot Halfling Rogue (Criminal)", 9, 14, 3], ["High Elf Wizard (Acolyte)", 8, 12, 2],
    ["Human Fighter (Folk Hero)", 12, 14, 3],
  ]);
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < 1024 * 1024);
  assert.notEqual(WORKSPACE_DEMO_KEY, "fatebound:workspace-demo:v2", "New example must not overwrite old visitor work");
});

test("all fixed and wandering encounters have five PCs, accurate group arrays and independent profiles", () => {
  const data = createWorkspaceDemo();
  const prepared = data.prepared.filter(e => e.campaignId === 1);
  assert.equal(prepared.length, 66);
  assert.equal(prepared.length, PHANDELVER_ENCOUNTERS.length);
  for (const [i, encounter] of prepared.entries()) {
    const combatants = encounter.data.combatants as any[];
    assert.equal(combatants.filter(c => c.combatantType === "pc").length, 5);
    const enemies = combatants.filter(c => c.combatantType !== "pc");
    assert.equal(enemies.length, PHANDELVER_ENCOUNTERS[i].enemies.length);
    for (const [j, [key, count]] of PHANDELVER_ENCOUNTERS[i].enemies.entries()) {
      const enemy = enemies[j], profile = PHANDELVER_PROFILES[key];
      assert.equal(enemy.hp, profile.hp);
      assert.equal(enemy.ac, profile.ac);
      assert.equal(enemy.monsterData.source, "Lost Mine of Phandelver");
      assert.equal(enemy.isGroup ? enemy.memberHp.length : 1, count);
      if (count > 1) {
        assert.equal(enemy.memberConditions.length, count);
        assert.ok(enemy.memberHp.every((hp: number) => hp === profile.hp));
        assert.notEqual(enemy.memberConditions[0], enemy.memberConditions[1]);
      }
      assert.equal(enemy.initiativeRolled, false);
      assert.equal(enemy.isDead, false);
    }
  }
  for (const collection of [data.characters, data.homebrew, data.prepared, data.items])
    assert.equal(new Set(collection.map(r => r.id)).size, collection.length, "IDs must not collide with linking sandbox");
  const first = prepared[0].data.combatants as any[];
  first.find(c => c.isGroup).monsterData.actions[0].desc = "changed";
  assert.doesNotMatch(PHANDELVER_PROFILES.goblin.actions![0].desc, /changed/);
});

test("named HP variants and module-specific statistics are not overwritten by generic stock versions", () => {
  for (const [key, hp] of Object.entries({ yeemik: 12, yegg: 12, lhupo: 12, grol: 45, snarl: 18, targor: 20, brughor: 30,
    glasstaff: 22, mormesk: 45, nezznar: 27, venomfang: 136 }))
    assert.equal(PHANDELVER_PROFILES[key].hp, hp, key);
  for (const profile of Object.values(PHANDELVER_PROFILES)) creatureProfileSchema.parse(profile);
  assert.equal(PHANDELVER_PROFILES.glasstaff.ac, 13);
  assert.equal(PHANDELVER_PROFILES.nezznar.ac, 11);
  assert.match(PHANDELVER_PROFILES.mormesk.actions![0].desc, /DC 13/);
  assert.match(PHANDELVER_PROFILES.venomfang.actions![3].desc, /DC 16.*12d6/);
  assert.match(PHANDELVER_PROFILES.spectator.actions![0].desc, /1d4/);
  assert.match(PHANDELVER_PROFILES.blight.actions![0].desc, /\+3 to hit/);
  assert.ok(PHANDELVER_PROFILES.ashZombie.special_abilities!.some(a => a.name === "Ash Puff"));
});

test("critical encounter counts exclude captives, preserve leader totals, and flag optional/source conflicts", () => {
  const encounter = (key: string) => PHANDELVER_ENCOUNTERS.find(e => e.key === key)!;
  assert.deepEqual(encounter("ambush").enemies, [["goblin", 4]]);
  assert.deepEqual(encounter("yeemik").enemies, [["goblin", 5], ["yeemik", 1]]);
  assert.deepEqual(encounter("yegg").enemies, [["goblin", 7], ["yegg", 1]]);
  assert.deepEqual(encounter("mosk").enemies, [["bugbear", 3]]);
  assert.deepEqual(encounter("wyvern").enemies, [["brughor", 1], ["orc", 6], ["gog", 1]]);
  assert.deepEqual(encounter("orc-sentry").enemies, [["orc", 1]]);
  assert.deepEqual(encounter("owl-well").enemies, [["zombie", 12]]);
  assert.deepEqual(encounter("nezznar").enemies, [["nezznar", 1], ["spider", 4]]);
  assert.match(encounter("thunder-5").notes, /SOURCE AMBIGUITY.*eight.*twelve/);
  for (const key of ["droop", "gundren", "nundro", "sildar"])
    assert.ok(PHANDELVER_ENCOUNTERS.every(e => e.enemies.every(([enemy]) => enemy !== key)));
  for (const e of PHANDELVER_ENCOUNTERS.filter(e => /trail-|mine-/.test(e.key)))
    assert.match(e.notes, /illustrative minimum.*NOT a fixed source count/);
  const common = createWorkspaceDemo().prepared.find(e => e.name.includes("10 — Common Room"))!;
  assert.ok((common.data.combatants as any[]).find(c => c.isGroup).memberConditions.every((c: string[]) => c.includes("Poisoned")));
});

test("campaign journal contains source-cited prep, not fabricated play history or copied transcripts", () => {
  const data = createWorkspaceDemo();
  const journal = data.sessions.filter(s => s.session.campaignId === 1);
  assert.equal(journal.length, 12);
  assert.ok(journal.every(s => s.session.notes.startsWith("DEMO / DM PREP — NOT PLAYED\nSource:")));
  assert.ok(journal.every(s => !s.imports.length && !s.recordings.length));
  const text = journal.map(s => s.session.notes).join("\n");
  for (const e of PHANDELVER_ENCOUNTERS) assert.ok(text.includes(e.name), `Missing journal reference: ${e.name}`);
  for (const name of ["Agatha", "Reidoth", "Sister Garaele", "Mirna", "Nundro", "Tharden"]) assert.ok(text.includes(name));
  assert.match(text, /STR 8, DEX 16, CON 12, INT 13/);
  assert.match(text, /level four/);
  assert.deepEqual(data.summaries, {}, "No invented approved recaps");
});

test("demo reset restores the module but leaves old demo saves and real-account selection untouched", async () => {
  const map = new Map([["fatebound:workspace-demo:v2", "old-demo-sentinel"], ["activeCampaign", "private-sentinel"]]);
  const api = new WorkspaceDemoApi({ getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } });
  await api.reset();
  const state = JSON.parse(map.get(WORKSPACE_DEMO_KEY)!);
  assert.equal(state.campaigns[0].name, "Lost Mine of Phandelver");
  assert.equal(map.get("fatebound:workspace-demo:v2"), "old-demo-sentinel");
  assert.equal(map.get("activeCampaign"), "private-sentinel");
  state.characters[0].maxHp = 1;
  map.set(WORKSPACE_DEMO_KEY, JSON.stringify(state));
  await api.reset();
  assert.equal(JSON.parse(map.get(WORKSPACE_DEMO_KEY)!).characters[0].maxHp, 12);
});
