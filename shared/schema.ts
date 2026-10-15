import { pgTable, text, serial, integer, boolean, numeric, timestamp, uniqueIndex, jsonb, check } from "drizzle-orm/pg-core";
import type { CreatureProfile } from "./creatureProfiles";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── 5e Compendium ────────────────────────────────────────────────────────────

const itemColumns = {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  itemType: text("item_type"),
  rarity: text("rarity").notNull().default("Common"),
  description: text("description").notNull().default(""),
  damage: text("damage"),
  weight: text("weight"),
  cost: text("cost"),
  properties: text("properties"),
  attunement: text("attunement"),
  edition: text("edition").notNull().default("5e"),
  source: text("source"),
};

export const items5e = pgTable("items_5e", itemColumns);

export const insertItem5eSchema = createInsertSchema(items5e).omit({ id: true });
export type Item = typeof items5e.$inferSelect;
export type InsertItem = z.infer<typeof insertItem5eSchema>;

// ─── Homebrew Items ────────────────────────────────────────────────────────────

export const homebrewItems = pgTable("homebrew_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  itemType: text("item_type"),
  rarity: text("rarity").notNull().default("Common"),
  description: text("description").notNull().default(""),
  damage: text("damage"),
  weight: text("weight"),
  cost: text("cost"),
  properties: text("properties"),
  attunement: text("attunement"),
  edition: text("edition").notNull().default("homebrew"),
  source: text("source").default("Homebrew"),
});

export const insertHomebrewItemSchema = createInsertSchema(homebrewItems).omit({ id: true });
export type HomebrewItem = typeof homebrewItems.$inferSelect;
export type InsertHomebrewItem = z.infer<typeof insertHomebrewItemSchema>;

// ─── Campaigns ────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  edition: text("edition").notNull().default("5e"),
  description: text("description"),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

// ─── Campaign Items (homebrew) ─────────────────────────────────────────────────

export const campaignItems = pgTable("campaign_items", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  itemType: text("item_type"),
  rarity: text("rarity").notNull().default("Common"),
  description: text("description").notNull().default(""),
  damage: text("damage"),
  weight: text("weight"),
  cost: text("cost"),
  properties: text("properties"),
  attunement: text("attunement"),
});

export const insertCampaignItemSchema = createInsertSchema(campaignItems).omit({ id: true });
export type CampaignItem = typeof campaignItems.$inferSelect;
export type InsertCampaignItem = z.infer<typeof insertCampaignItemSchema>;

// ─── Campaign Characters (PCs) ─────────────────────────────────────────────────

export const campaignCharacters = pgTable("campaign_characters", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  playerClass: text("player_class"),
  maxHp: integer("max_hp").notNull().default(10),
  ac: integer("ac").notNull().default(10),
  healingSurgesMax: integer("healing_surges_max"),
  initiativeBonus: integer("initiative_bonus").default(0),
});

export const insertCampaignCharacterSchema = createInsertSchema(campaignCharacters).omit({ id: true });
export type CampaignCharacter = typeof campaignCharacters.$inferSelect;
export type InsertCampaignCharacter = z.infer<typeof insertCampaignCharacterSchema>;

// ─── 5e Bestiary ──────────────────────────────────────────────────────────────

export const bestiaryMonsters = pgTable("bestiary_monsters", {
  monsterId: text("monster_id").primaryKey(),
  systemKey: text("system_key"),
  editionKey: text("edition_key"),
  sourceKey: text("source_key"),
  sourceBook: text("source_book"),
  sourcePage: integer("source_page"),
  name: text("name").notNull(),
  variantName: text("variant_name"),
  size: text("size"),
  creatureType: text("creature_type"),
  creatureTags: text("creature_tags"),
  alignment: text("alignment"),
  armorClass: integer("armor_class"),
  armorNotes: text("armor_notes"),
  hitDiceCount: integer("hit_dice_count"),
  hitDieSize: integer("hit_die_size"),
  printedAverageHp: integer("printed_average_hp"),
  hpFormulaOverride: text("hp_formula_override"),
  strScore: integer("str_score"),
  strMod: integer("str_mod"),
  dexScore: integer("dex_score"),
  dexMod: integer("dex_mod"),
  conScore: integer("con_score"),
  conMod: integer("con_mod"),
  intScore: integer("int_score"),
  intMod: integer("int_mod"),
  wisScore: integer("wis_score"),
  wisMod: integer("wis_mod"),
  chaScore: integer("cha_score"),
  chaMod: integer("cha_mod"),
  challengeRating: text("challenge_rating"),
});

export const bestiaryMonsterTraits = pgTable("bestiary_monster_traits", {
  traitId: text("trait_id").primaryKey(),
  monsterId: text("monster_id").notNull(),
  traitOrder: integer("trait_order"),
  traitType: text("trait_type"),
  traitName: text("trait_name"),
  traitDescription: text("trait_description"),
});

export const bestiaryMonsterActions = pgTable("bestiary_monster_actions", {
  actionId: text("action_id").primaryKey(),
  monsterId: text("monster_id").notNull(),
  actionOrder: integer("action_order"),
  actionCategory: text("action_category"),
  actionName: text("action_name"),
  actionDescription: text("action_description"),
  activationCondition: text("activation_condition"),
  actionCost: integer("action_cost"),
  isAttack: boolean("is_attack"),
  attackType: text("attack_type"),
  attackAbility: text("attack_ability"),
  attackBonus: integer("attack_bonus"),
  reachFt: integer("reach_ft"),
  rangeNormalFt: integer("range_normal_ft"),
  rangeLongFt: integer("range_long_ft"),
  targetText: text("target_text"),
  targetCount: integer("target_count"),
  saveAbility: text("save_ability"),
  saveDc: integer("save_dc"),
  saveOnSuccess: text("save_on_success"),
  usesMax: integer("uses_max"),
  usesPeriod: text("uses_period"),
  rechargeMin: integer("recharge_min"),
  rechargeMax: integer("recharge_max"),
  linkedActionIds: text("linked_action_ids"),
  notes: text("notes"),
});

export const bestiaryActionEffects = pgTable("bestiary_action_effects", {
  effectId: text("effect_id").primaryKey(),
  actionId: text("action_id").notNull(),
  effectOrder: integer("effect_order"),
  effectTiming: text("effect_timing"),
  effectType: text("effect_type"),
  diceCount: integer("dice_count"),
  dieSize: integer("die_size"),
  flatModifier: integer("flat_modifier"),
  printedAverage: integer("printed_average"),
  damageType: text("damage_type"),
  saveAbility: text("save_ability"),
  saveDc: integer("save_dc"),
  successResult: text("success_result"),
  conditionApplied: text("condition_applied"),
  durationText: text("duration_text"),
  repeatTiming: text("repeat_timing"),
  areaShape: text("area_shape"),
  areaSizeFt: integer("area_size_ft"),
  forcedMovementFt: integer("forced_movement_ft"),
  escapeDc: integer("escape_dc"),
  effectDescription: text("effect_description"),
  notes: text("notes"),
});

export const bestiarySpellcastingProfiles = pgTable("bestiary_spellcasting_profiles", {
  spellcastingId: text("spellcasting_id").primaryKey(),
  monsterId: text("monster_id").notNull(),
  profileOrder: integer("profile_order"),
  profileName: text("profile_name"),
  castingType: text("casting_type"),
  spellcastingAbility: text("spellcasting_ability"),
  casterLevel: integer("caster_level"),
  spellSaveDc: integer("spell_save_dc"),
  spellAttackBonus: integer("spell_attack_bonus"),
  spellcastingClass: text("spellcasting_class"),
  componentsRequired: text("components_required"),
  concentrationLimit: integer("concentration_limit"),
  profileDescription: text("profile_description"),
  notes: text("notes"),
});

export const bestiaryMonsterSpells = pgTable("bestiary_monster_spells", {
  monsterSpellId: text("monster_spell_id").primaryKey(),
  spellcastingId: text("spellcasting_id").notNull(),
  spellOrder: integer("spell_order"),
  spellKey: text("spell_key"),
  spellName: text("spell_name"),
  spellLevel: integer("spell_level"),
  castingFrequency: text("casting_frequency"),
  usesMax: integer("uses_max"),
  sharedUseGroup: text("shared_use_group"),
  slotLevel: integer("slot_level"),
  slotsAvailable: integer("slots_available"),
  isInnate: boolean("is_innate"),
  requiresConcentration: boolean("requires_concentration"),
  notes: text("notes"),
});

// ─── Campaign Saved Encounters ────────────────────────────────────────────────

export const campaignSavedEncounters = pgTable("campaign_saved_encounters", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().unique(),
  encounterData: text("encounter_data").notNull(), // JSON blob of full combat state
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

export type CampaignSavedEncounter = typeof campaignSavedEncounters.$inferSelect;

// ─── Campaign Prepared Encounters ─────────────────────────────────────────────

export const campaignPreparedEncounters = pgTable("campaign_prepared_encounters", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  encounterData: text("encounter_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  uniqueIndex("campaign_prepared_encounters_campaign_name_unique")
    .on(table.campaignId, sql`lower(${table.name})`),
]);

export type CampaignPreparedEncounter = typeof campaignPreparedEncounters.$inferSelect;

// ─── Roll Tables ──────────────────────────────────────────────────────────────

export const rollTables = pgTable("roll_tables", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Custom"),
  mode: text("mode").notNull().default("range"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rollTableEntries = pgTable("roll_table_entries", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => rollTables.id, { onDelete: "cascade" }),
  entryOrder: integer("entry_order").notNull().default(0),
  text: text("text").notNull(),
  minRoll: integer("min_roll"),
  maxRoll: integer("max_roll"),
  weight: integer("weight"),
});

export const rollTableModeSchema = z.enum(["range", "weighted"]);

export const rollTableEntryInputSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  minRoll: z.number().int().min(1).optional(),
  maxRoll: z.number().int().min(1).optional(),
  weight: z.number().int().min(1).max(1000).optional(),
});

export const rollTableInputSchema = z.object({
  campaignId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  category: z.string().trim().min(1).max(50).default("Custom"),
  mode: rollTableModeSchema.default("range"),
  entries: z.array(rollTableEntryInputSchema).min(1).max(200),
}).superRefine((table, context) => {
  table.entries.forEach((entry, index) => {
    if (table.mode === "weighted" && entry.weight == null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Weighted entries require a positive weight", path: ["entries", index, "weight"] });
    }
    if (table.mode === "range") {
      if (entry.minRoll == null || entry.maxRoll == null) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Range entries require minimum and maximum rolls", path: ["entries", index] });
      } else if (entry.maxRoll < entry.minRoll) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Maximum roll must be at least the minimum roll", path: ["entries", index, "maxRoll"] });
      }
    }
  });
  if (table.mode === "range" && table.entries.every(entry => entry.minRoll != null && entry.maxRoll != null)) {
    const sorted = [...table.entries].sort((a, b) => a.minRoll! - b.minRoll!);
    for (let index = 1; index < sorted.length; index++) {
      if (sorted[index].minRoll !== sorted[index - 1].maxRoll! + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ranges must be sequential without gaps or overlaps",
          path: ["entries"],
        });
        break;
      }
    }
  }
});

export type RollTableRow = typeof rollTables.$inferSelect;
export type RollTableEntryRow = typeof rollTableEntries.$inferSelect;

// ─── Campaign Homebrew Bestiary ───────────────────────────────────────────────

export const campaignHomebrewMonsters = pgTable("campaign_homebrew_monsters", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  creatureType: text("creature_type"),
  size: text("size"),
  alignment: text("alignment"),
  armorClass: integer("armor_class"),
  printedAverageHp: integer("printed_average_hp"),
  hitDice: text("hit_dice"),
  dexScore: integer("dex_score"),
  challengeRating: text("challenge_rating"),
  profileData: jsonb("profile_data").$type<CreatureProfile>(),
});

export const campaignHomebrewActions = pgTable("campaign_homebrew_actions", {
  id: serial("id").primaryKey(),
  monsterRefId: integer("monster_ref_id").notNull(),
  actionOrder: integer("action_order").notNull().default(0),
  actionName: text("action_name"),
  actionDescription: text("action_description"),
  attackBonus: integer("attack_bonus"),
});

export type CampaignHomebrewMonster = typeof campaignHomebrewMonsters.$inferSelect;
export type CampaignHomebrewAction = typeof campaignHomebrewActions.$inferSelect;

// Links point directly to source records; there are no copied stats or chained links.
export const campaignResourceLinks = pgTable("campaign_resource_links", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  sourceCampaignId: integer("source_campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => campaignItems.id, { onDelete: "cascade" }),
  npcId: integer("npc_id").references(() => campaignHomebrewMonsters.id, { onDelete: "cascade" }),
}, table => [
  uniqueIndex("campaign_resource_link_item_unique").on(table.campaignId, table.itemId),
  uniqueIndex("campaign_resource_link_npc_unique").on(table.campaignId, table.npcId),
  check("campaign_resource_link_one_target", sql`(${table.itemId} IS NOT NULL)::int + (${table.npcId} IS NOT NULL)::int = 1`),
  check("campaign_resource_link_different_campaign", sql`${table.campaignId} <> ${table.sourceCampaignId}`),
]);

// ─── Draw Options ─────────────────────────────────────────────────────────────

export const drawOptionsSchema = z.object({
  source: z.enum(["5e", "campaign"]),
  campaignId: z.number().optional(),
  editions: z.array(z.string()).optional(),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  rarities: z.array(z.string()).min(1, "Select at least one rarity"),
  sources: z.array(z.string()).optional(),
  count: z.coerce.number().min(1).max(100),
  search: z.string().optional(),
});

export type DrawOptions = z.infer<typeof drawOptionsSchema>;
