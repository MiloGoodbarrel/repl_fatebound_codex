import { parse } from "csv-parse";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { sql } from "drizzle-orm";

const DATA_DIR = path.join(import.meta.dirname, "data", "bestiary");

const FILES = {
  monsters: "monsters.csv",
  monster_traits: "monster_traits.csv",
  monster_actions: "monster_actions.csv",
  action_effects: "action_effects.csv",
  spellcasting_profiles: "spellcasting_profiles.csv",
  monster_spells: "monster_spells.csv",
};

function toNull(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

function toInt(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function toBool(v: string): boolean | null {
  const s = v.trim().toUpperCase();
  if (s === "TRUE" || s === "1") return true;
  if (s === "FALSE" || s === "0") return false;
  return null;
}

async function parseCSV(filePath: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const records: Record<string, string>[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
      .on("data", (row: Record<string, string>) => records.push(row))
      .on("error", reject)
      .on("end", () => resolve(records));
  });
}

async function importMonsters(rows: Record<string, string>[]) {
  let inserted = 0, updated = 0;
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO bestiary_monsters (
        monster_id, system_key, edition_key, source_key, source_book, source_page,
        name, variant_name, size, creature_type, creature_tags, alignment,
        armor_class, armor_notes, hit_dice_count, hit_die_size, printed_average_hp,
        hp_formula_override,
        str_score, str_mod, dex_score, dex_mod, con_score, con_mod,
        int_score, int_mod, wis_score, wis_mod, cha_score, cha_mod
      ) VALUES (
        ${r.monster_id}, ${toNull(r.system_key)}, ${toNull(r.edition_key)},
        ${toNull(r.source_key)}, ${toNull(r.source_book)}, ${toInt(r.source_page)},
        ${r.name}, ${toNull(r.variant_name)}, ${toNull(r.size)},
        ${toNull(r.creature_type)}, ${toNull(r.creature_tags)}, ${toNull(r.alignment)},
        ${toInt(r.armor_class)}, ${toNull(r.armor_notes)},
        ${toInt(r.hit_dice_count)}, ${toInt(r.hit_die_size)}, ${toInt(r.printed_average_hp)},
        ${toNull(r.hp_formula_override)},
        ${toInt(r.str_score)}, ${toInt(r.str_mod)},
        ${toInt(r.dex_score)}, ${toInt(r.dex_mod)},
        ${toInt(r.con_score)}, ${toInt(r.con_mod)},
        ${toInt(r.int_score)}, ${toInt(r.int_mod)},
        ${toInt(r.wis_score)}, ${toInt(r.wis_mod)},
        ${toInt(r.cha_score)}, ${toInt(r.cha_mod)}
      )
      ON CONFLICT (monster_id) DO UPDATE SET
        system_key = EXCLUDED.system_key,
        edition_key = EXCLUDED.edition_key,
        source_key = EXCLUDED.source_key,
        source_book = EXCLUDED.source_book,
        source_page = EXCLUDED.source_page,
        name = EXCLUDED.name,
        variant_name = EXCLUDED.variant_name,
        size = EXCLUDED.size,
        creature_type = EXCLUDED.creature_type,
        creature_tags = EXCLUDED.creature_tags,
        alignment = EXCLUDED.alignment,
        armor_class = EXCLUDED.armor_class,
        armor_notes = EXCLUDED.armor_notes,
        hit_dice_count = EXCLUDED.hit_dice_count,
        hit_die_size = EXCLUDED.hit_die_size,
        printed_average_hp = EXCLUDED.printed_average_hp,
        hp_formula_override = EXCLUDED.hp_formula_override,
        str_score = EXCLUDED.str_score, str_mod = EXCLUDED.str_mod,
        dex_score = EXCLUDED.dex_score, dex_mod = EXCLUDED.dex_mod,
        con_score = EXCLUDED.con_score, con_mod = EXCLUDED.con_mod,
        int_score = EXCLUDED.int_score, int_mod = EXCLUDED.int_mod,
        wis_score = EXCLUDED.wis_score, wis_mod = EXCLUDED.wis_mod,
        cha_score = EXCLUDED.cha_score, cha_mod = EXCLUDED.cha_mod
    `);
    inserted++;
  }
  return { inserted, updated };
}

async function importTraits(rows: Record<string, string>[]) {
  let count = 0;
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO bestiary_monster_traits (trait_id, monster_id, trait_order, trait_type, trait_name, trait_description)
      VALUES (${r.trait_id}, ${r.monster_id}, ${toInt(r.trait_order)}, ${toNull(r.trait_type)}, ${toNull(r.trait_name)}, ${toNull(r.trait_description)})
      ON CONFLICT (trait_id) DO UPDATE SET
        monster_id = EXCLUDED.monster_id,
        trait_order = EXCLUDED.trait_order,
        trait_type = EXCLUDED.trait_type,
        trait_name = EXCLUDED.trait_name,
        trait_description = EXCLUDED.trait_description
    `);
    count++;
  }
  return count;
}

async function importActions(rows: Record<string, string>[]) {
  let count = 0;
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO bestiary_monster_actions (
        action_id, monster_id, action_order, action_category, action_name, action_description,
        activation_condition, action_cost, is_attack, attack_type, attack_ability, attack_bonus,
        reach_ft, range_normal_ft, range_long_ft, target_text, target_count,
        save_ability, save_dc, save_on_success, uses_max, uses_period,
        recharge_min, recharge_max, linked_action_ids, notes
      ) VALUES (
        ${r.action_id}, ${r.monster_id}, ${toInt(r.action_order)},
        ${toNull(r.action_category)}, ${toNull(r.action_name)}, ${toNull(r.action_description)},
        ${toNull(r.activation_condition)}, ${toInt(r.action_cost)},
        ${toBool(r.is_attack)}, ${toNull(r.attack_type)}, ${toNull(r.attack_ability)},
        ${toInt(r.attack_bonus)}, ${toInt(r.reach_ft)}, ${toInt(r.range_normal_ft)},
        ${toInt(r.range_long_ft)}, ${toNull(r.target_text)}, ${toInt(r.target_count)},
        ${toNull(r.save_ability)}, ${toInt(r.save_dc)}, ${toNull(r.save_on_success)},
        ${toInt(r.uses_max)}, ${toNull(r.uses_period)},
        ${toInt(r.recharge_min)}, ${toInt(r.recharge_max)},
        ${toNull(r.linked_action_ids)}, ${toNull(r.notes)}
      )
      ON CONFLICT (action_id) DO UPDATE SET
        monster_id = EXCLUDED.monster_id,
        action_order = EXCLUDED.action_order,
        action_category = EXCLUDED.action_category,
        action_name = EXCLUDED.action_name,
        action_description = EXCLUDED.action_description,
        activation_condition = EXCLUDED.activation_condition,
        action_cost = EXCLUDED.action_cost,
        is_attack = EXCLUDED.is_attack,
        attack_type = EXCLUDED.attack_type,
        attack_ability = EXCLUDED.attack_ability,
        attack_bonus = EXCLUDED.attack_bonus,
        reach_ft = EXCLUDED.reach_ft,
        range_normal_ft = EXCLUDED.range_normal_ft,
        range_long_ft = EXCLUDED.range_long_ft,
        target_text = EXCLUDED.target_text,
        target_count = EXCLUDED.target_count,
        save_ability = EXCLUDED.save_ability,
        save_dc = EXCLUDED.save_dc,
        save_on_success = EXCLUDED.save_on_success,
        uses_max = EXCLUDED.uses_max,
        uses_period = EXCLUDED.uses_period,
        recharge_min = EXCLUDED.recharge_min,
        recharge_max = EXCLUDED.recharge_max,
        linked_action_ids = EXCLUDED.linked_action_ids,
        notes = EXCLUDED.notes
    `);
    count++;
  }
  return count;
}

async function importEffects(rows: Record<string, string>[]) {
  let count = 0;
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO bestiary_action_effects (
        effect_id, action_id, effect_order, effect_timing, effect_type,
        dice_count, die_size, flat_modifier, printed_average, damage_type,
        save_ability, save_dc, success_result, condition_applied, duration_text,
        repeat_timing, area_shape, area_size_ft, forced_movement_ft, escape_dc,
        effect_description, notes
      ) VALUES (
        ${r.effect_id}, ${r.action_id}, ${toInt(r.effect_order)},
        ${toNull(r.effect_timing)}, ${toNull(r.effect_type)},
        ${toInt(r.dice_count)}, ${toInt(r.die_size)}, ${toInt(r.flat_modifier)},
        ${toInt(r.printed_average)}, ${toNull(r.damage_type)},
        ${toNull(r.save_ability)}, ${toInt(r.save_dc)}, ${toNull(r.success_result)},
        ${toNull(r.condition_applied)}, ${toNull(r.duration_text)},
        ${toNull(r.repeat_timing)}, ${toNull(r.area_shape)},
        ${toInt(r.area_size_ft)}, ${toInt(r.forced_movement_ft)}, ${toInt(r.escape_dc)},
        ${toNull(r.effect_description)}, ${toNull(r.notes)}
      )
      ON CONFLICT (effect_id) DO UPDATE SET
        action_id = EXCLUDED.action_id,
        effect_order = EXCLUDED.effect_order,
        effect_timing = EXCLUDED.effect_timing,
        effect_type = EXCLUDED.effect_type,
        dice_count = EXCLUDED.dice_count,
        die_size = EXCLUDED.die_size,
        flat_modifier = EXCLUDED.flat_modifier,
        printed_average = EXCLUDED.printed_average,
        damage_type = EXCLUDED.damage_type,
        save_ability = EXCLUDED.save_ability,
        save_dc = EXCLUDED.save_dc,
        success_result = EXCLUDED.success_result,
        condition_applied = EXCLUDED.condition_applied,
        duration_text = EXCLUDED.duration_text,
        repeat_timing = EXCLUDED.repeat_timing,
        area_shape = EXCLUDED.area_shape,
        area_size_ft = EXCLUDED.area_size_ft,
        forced_movement_ft = EXCLUDED.forced_movement_ft,
        escape_dc = EXCLUDED.escape_dc,
        effect_description = EXCLUDED.effect_description,
        notes = EXCLUDED.notes
    `);
    count++;
  }
  return count;
}

async function importSpellcastingProfiles(rows: Record<string, string>[]) {
  let count = 0;
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO bestiary_spellcasting_profiles (
        spellcasting_id, monster_id, profile_order, profile_name, casting_type,
        spellcasting_ability, caster_level, spell_save_dc, spell_attack_bonus,
        spellcasting_class, components_required, concentration_limit,
        profile_description, notes
      ) VALUES (
        ${r.spellcasting_id}, ${r.monster_id}, ${toInt(r.profile_order)},
        ${toNull(r.profile_name)}, ${toNull(r.casting_type)},
        ${toNull(r.spellcasting_ability)}, ${toInt(r.caster_level)},
        ${toInt(r.spell_save_dc)}, ${toInt(r.spell_attack_bonus)},
        ${toNull(r.spellcasting_class)}, ${toNull(r.components_required)},
        ${toInt(r.concentration_limit)}, ${toNull(r.profile_description)},
        ${toNull(r.notes)}
      )
      ON CONFLICT (spellcasting_id) DO UPDATE SET
        monster_id = EXCLUDED.monster_id,
        profile_order = EXCLUDED.profile_order,
        profile_name = EXCLUDED.profile_name,
        casting_type = EXCLUDED.casting_type,
        spellcasting_ability = EXCLUDED.spellcasting_ability,
        caster_level = EXCLUDED.caster_level,
        spell_save_dc = EXCLUDED.spell_save_dc,
        spell_attack_bonus = EXCLUDED.spell_attack_bonus,
        spellcasting_class = EXCLUDED.spellcasting_class,
        components_required = EXCLUDED.components_required,
        concentration_limit = EXCLUDED.concentration_limit,
        profile_description = EXCLUDED.profile_description,
        notes = EXCLUDED.notes
    `);
    count++;
  }
  return count;
}

async function importMonsterSpells(rows: Record<string, string>[]) {
  let count = 0;
  for (const r of rows) {
    await db.execute(sql`
      INSERT INTO bestiary_monster_spells (
        monster_spell_id, spellcasting_id, spell_order, spell_key, spell_name,
        spell_level, casting_frequency, uses_max, shared_use_group, slot_level,
        slots_available, is_innate, requires_concentration, notes
      ) VALUES (
        ${r.monster_spell_id}, ${r.spellcasting_id}, ${toInt(r.spell_order)},
        ${toNull(r.spell_key)}, ${toNull(r.spell_name)},
        ${toInt(r.spell_level)}, ${toNull(r.casting_frequency)},
        ${toInt(r.uses_max)}, ${toNull(r.shared_use_group)},
        ${toInt(r.slot_level)}, ${toInt(r.slots_available)},
        ${toBool(r.is_innate)}, ${toBool(r.requires_concentration)},
        ${toNull(r.notes)}
      )
      ON CONFLICT (monster_spell_id) DO UPDATE SET
        spellcasting_id = EXCLUDED.spellcasting_id,
        spell_order = EXCLUDED.spell_order,
        spell_key = EXCLUDED.spell_key,
        spell_name = EXCLUDED.spell_name,
        spell_level = EXCLUDED.spell_level,
        casting_frequency = EXCLUDED.casting_frequency,
        uses_max = EXCLUDED.uses_max,
        shared_use_group = EXCLUDED.shared_use_group,
        slot_level = EXCLUDED.slot_level,
        slots_available = EXCLUDED.slots_available,
        is_innate = EXCLUDED.is_innate,
        requires_concentration = EXCLUDED.requires_concentration,
        notes = EXCLUDED.notes
    `);
    count++;
  }
  return count;
}

export async function seedBestiary() {
  console.log("📖 Starting 5e Bestiary import...\n");

  // Validate all files exist
  for (const [table, file] of Object.entries(FILES)) {
    const fp = path.join(DATA_DIR, file);
    if (!fs.existsSync(fp)) {
      throw new Error(`Missing required CSV: ${fp}`);
    }
  }

  // Parse all CSVs
  console.log("📂 Parsing CSVs...");
  const [monsters, traits, actions, effects, profiles, spells] = await Promise.all([
    parseCSV(path.join(DATA_DIR, FILES.monsters)),
    parseCSV(path.join(DATA_DIR, FILES.monster_traits)),
    parseCSV(path.join(DATA_DIR, FILES.monster_actions)),
    parseCSV(path.join(DATA_DIR, FILES.action_effects)),
    parseCSV(path.join(DATA_DIR, FILES.spellcasting_profiles)),
    parseCSV(path.join(DATA_DIR, FILES.monster_spells)),
  ]);

  console.log(`  monsters: ${monsters.length} rows`);
  console.log(`  traits: ${traits.length} rows`);
  console.log(`  actions: ${actions.length} rows`);
  console.log(`  effects: ${effects.length} rows`);
  console.log(`  spellcasting_profiles: ${profiles.length} rows`);
  console.log(`  monster_spells: ${spells.length} rows`);

  // Filter out rows with empty primary keys
  const validMonsters = monsters.filter(r => r.monster_id?.trim());
  const skippedMonsters = monsters.length - validMonsters.length;
  if (skippedMonsters > 0) console.warn(`  ⚠️  Skipped ${skippedMonsters} monsters with empty monster_id`);

  // Validate: duplicate PKs
  const monsterIds = validMonsters.map(r => r.monster_id.trim());
  const dupMonsters = monsterIds.filter((id, i) => monsterIds.indexOf(id) !== i);
  if (dupMonsters.length > 0) {
    throw new Error(`Duplicate monster_ids: ${dupMonsters.join(", ")}`);
  }

  // Validate: orphan FK check (traits/actions/profiles reference a monster)
  const monsterIdSet = new Set(monsterIds);
  const orphanTraits = traits.filter(r => r.monster_id?.trim() && !monsterIdSet.has(r.monster_id.trim()));
  const orphanActions = actions.filter(r => r.monster_id?.trim() && !monsterIdSet.has(r.monster_id.trim()));
  const orphanProfiles = profiles.filter(r => r.monster_id?.trim() && !monsterIdSet.has(r.monster_id.trim()));
  if (orphanTraits.length > 0) console.warn(`  ⚠️  ${orphanTraits.length} orphan traits (monster not found) — skipping`);
  if (orphanActions.length > 0) console.warn(`  ⚠️  ${orphanActions.length} orphan actions (monster not found) — skipping`);
  if (orphanProfiles.length > 0) console.warn(`  ⚠️  ${orphanProfiles.length} orphan profiles (monster not found) — skipping`);

  // Filter out orphans and rows with empty PKs so FK constraints don't fail
  const validTraits = traits.filter(r => r.trait_id?.trim() && r.monster_id?.trim() && monsterIdSet.has(r.monster_id.trim()));
  const validActions = actions.filter(r => r.action_id?.trim() && r.monster_id?.trim() && monsterIdSet.has(r.monster_id.trim()));
  const validProfiles = profiles.filter(r => r.spellcasting_id?.trim() && r.monster_id?.trim() && monsterIdSet.has(r.monster_id.trim()));
  const validProfileIdSet = new Set(validProfiles.map(r => r.spellcasting_id.trim()));
  const validActionIdSet = new Set(validActions.map(r => r.action_id.trim()));
  const validEffects = effects.filter(r => r.effect_id?.trim() && r.action_id?.trim() && validActionIdSet.has(r.action_id.trim()));
  const validSpells = spells.filter(r => r.monster_spell_id?.trim() && r.spellcasting_id?.trim() && validProfileIdSet.has(r.spellcasting_id.trim()));

  const orphanEffects = effects.filter(r => r.action_id?.trim() && !validActionIdSet.has(r.action_id.trim()));
  const orphanSpells = spells.filter(r => r.spellcasting_id?.trim() && !validProfileIdSet.has(r.spellcasting_id.trim()));
  if (orphanEffects.length > 0) console.warn(`  ⚠️  ${orphanEffects.length} orphan effects (action not found) — skipping`);
  if (orphanSpells.length > 0) console.warn(`  ⚠️  ${orphanSpells.length} orphan spells (profile not found) — skipping`);

  // Import in dependency order
  console.log("\n💾 Importing monsters...");
  await importMonsters(validMonsters);
  console.log(`  ✓ ${monsters.length} monsters`);

  console.log("💾 Importing monster traits...");
  await importTraits(validTraits);
  console.log(`  ✓ ${validTraits.length} traits`);

  console.log("💾 Importing monster actions...");
  await importActions(validActions);
  console.log(`  ✓ ${validActions.length} actions`);

  console.log("💾 Importing action effects...");
  await importEffects(validEffects);
  console.log(`  ✓ ${validEffects.length} effects`);

  console.log("💾 Importing spellcasting profiles...");
  await importSpellcastingProfiles(validProfiles);
  console.log(`  ✓ ${validProfiles.length} profiles`);

  console.log("💾 Importing monster spells...");
  await importMonsterSpells(validSpells);
  console.log(`  ✓ ${validSpells.length} spells`);

  console.log("\n✅ Bestiary import complete!");
  return {
    monsters: monsters.length,
    traits: validTraits.length,
    actions: validActions.length,
    effects: validEffects.length,
    profiles: validProfiles.length,
    spells: validSpells.length,
  };
}

// Run directly
seedBestiary()
  .then(stats => {
    console.log("\n📊 Final counts:", stats);
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Import failed:", err);
    process.exit(1);
  });
