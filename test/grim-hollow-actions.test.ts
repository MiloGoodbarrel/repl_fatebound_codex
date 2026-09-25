import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { combineBestiaryActions, mapBestiaryActions, validateBestiaryEffects } from "../server/bestiaryActions";

const dataDir = path.resolve(import.meta.dirname, "../server/data/bestiary");
const prefix = "dnd_5e2014_ghmg_";
const noActionMonsters = new Map([
  [`${prefix}eye_crawler`, "Eye Crawler"],
  [`${prefix}spythronar_sac`, "Spythronar Sac"],
]);

type CsvRow = Record<string, string>;

function loadCsv(filename: string): CsvRow[] {
  return parse(fs.readFileSync(path.join(dataDir, filename), "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
    record_delimiter: ["\r\n", "\n", "\r"],
  });
}

const monsters = loadCsv("monsters.csv").filter(row => row.monster_id.startsWith(prefix));
const grimActions = loadCsv("grim_hollow_actions.csv");
const baseActions = loadCsv("monster_actions.csv");
const effects = loadCsv("action_effects.csv");

test("every Grim Hollow monster has restored actions or a source-accurate no-action exception", () => {
  assert.equal(monsters.length, 409);
  assert.equal(new Set(monsters.map(row => row.monster_id)).size, 409);
  assert.equal(grimActions.length, 1230);
  const monsterIds = new Set(monsters.map(row => row.monster_id));
  const covered = new Set(grimActions.map(row => row.monster_id));
  assert.deepEqual(
    [...covered].filter(id => !monsterIds.has(id)),
    [],
    "actions must reference Grim Hollow monsters in monsters.csv",
  );
  assert.deepEqual(
    monsters.filter(row => !covered.has(row.monster_id)).map(row => [row.monster_id, row.name]).sort(),
    [...noActionMonsters].sort(),
  );
  for (const id of noActionMonsters.keys()) {
    assert.equal(covered.has(id), false, `${id} must remain actionless`);
  }
});

test("restored action IDs are unique and descriptions contain no footer or lore text", () => {
  const ids = grimActions.map(row => row.action_id);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of grimActions) {
    assert.ok(row.action_id.trim(), `missing ID for ${row.monster_id}`);
    assert.ok(row.action_name.trim(), `missing name for ${row.action_id}`);
    assert.ok(row.action_description.trim(), `missing description for ${row.action_id}`);
    assert.doesNotMatch(
      row.action_description,
      /\b\d+\s+Grim Hollow Monster Grimoire\b|\bDC\s+\d+\s+Intelligence\s+\([^)]+\):|\b(?:Lore|Salvage|Regional Effects)\s*:|[“"]/i,
      `contaminated description for ${row.action_id}`,
    );
  }
});

test("seed combines base and restored actions without retaining legacy Grim Hollow rows", () => {
  const combined = combineBestiaryActions(baseActions, grimActions);
  assert.equal(combined.length, baseActions.filter(row => !row.monster_id.startsWith(prefix)).length + grimActions.length);
  assert.deepEqual(combined.filter(row => row.monster_id.startsWith(prefix)), grimActions);
  assert.equal(new Set(combined.map(row => row.action_id)).size, combined.length);
  assert.throws(
    () => combineBestiaryActions(baseActions, [...grimActions, grimActions[0]]),
    /duplicate bestiary action ID/i,
  );
});

test("all effects belong to imported actions and Grim Hollow damage matches restored text", () => {
  assert.deepEqual(baseActions.filter(row => row.monster_id.startsWith(prefix)), []);
  const combined = combineBestiaryActions(baseActions, grimActions);
  assert.doesNotThrow(() => validateBestiaryEffects(combined, effects));
  const byId = new Map(grimActions.map(row => [row.action_id, row]));
  const restoredEffects = effects.filter(row => row.action_id.startsWith(prefix));
  assert.ok(restoredEffects.length > 1000);
  for (const effect of restoredEffects) {
    const action = byId.get(effect.action_id);
    assert.ok(action, `orphaned restored effect: ${effect.effect_id}`);
    if (effect.effect_type === "damage") {
      assert.ok(action.action_description.includes(effect.effect_description),
        `damage is not in restored text: ${effect.effect_id}`);
    }
  }
  const slam = grimActions.find(row =>
    row.monster_id === `${prefix}amorphous_horror` && row.action_name === "Slam"
  );
  assert.ok(slam);
  assert.deepEqual(
    restoredEffects.filter(row => row.action_id === slam.action_id && row.effect_type === "damage")
      .map(row => [row.dice_count, row.die_size, row.flat_modifier, row.printed_average, row.damage_type]),
    [["1", "8", "3", "7", "bludgeoning"], ["2", "8", "0", "9", "acid"]],
  );
  assert.throws(
    () => validateBestiaryEffects(combined, [...effects, {
      effect_id: "test_orphan", action_id: "missing_action",
    }]),
    /orphan bestiary effect/i,
  );
  assert.throws(
    () => validateBestiaryEffects(combined, [...effects, effects[0]]),
    /duplicate bestiary effect ID/i,
  );
  assert.throws(
    () => validateBestiaryEffects(combined, [...effects, {
      effect_id: "", action_id: slam.action_id,
    }]),
    /missing or duplicate bestiary effect ID/i,
  );
});

test("bestiary detail mapping retains standard, reaction, and legendary actions", () => {
  const samples = [
    [prefix + "amorphous_horror", "Slam", "action"],
    [prefix + "amorphous_horror", "Split", "reaction"],
    [prefix + "angel_of_empyreus", "Hurl Sword (2 actions)", "legendary_action"],
  ] as const;
  const rows = samples.map(([monsterId, name, category]) => {
    const row = grimActions.find(action =>
      action.monster_id === monsterId && action.action_name === name && action.action_category === category
    );
    assert.ok(row, `missing ${category} ${name}`);
    return {
      actionName: row.action_name,
      actionDescription: row.action_description,
      actionCategory: row.action_category,
      attackBonus: row.attack_bonus ? Number(row.attack_bonus) : null,
    };
  });
  const mapped = mapBestiaryActions(rows);
  assert.deepEqual(mapped.detailedActions.map(action => [action.name, action.category]), [
    ["Slam", "action"],
    ["Split", "reaction"],
    ["Hurl Sword (2 actions)", "legendary_action"],
  ]);
  assert.ok(mapped.detailedActions.every(action => action.description.length > 0));
  assert.deepEqual(mapped.actions.map(action => action.name), ["Slam"]);
});