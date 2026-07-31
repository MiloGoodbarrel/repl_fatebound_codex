import { pgTable, text, serial, integer, boolean, numeric } from "drizzle-orm/pg-core";
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

// ─── Draw Options ─────────────────────────────────────────────────────────────

export const drawOptionsSchema = z.object({
  source: z.enum(["5e", "campaign"]),
  campaignId: z.number().optional(),
  editions: z.array(z.string()).optional(),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  rarities: z.array(z.string()).min(1, "Select at least one rarity"),
  sources: z.array(z.string()).optional(),
  count: z.coerce.number().min(1).max(100),
});

export type DrawOptions = z.infer<typeof drawOptionsSchema>;
