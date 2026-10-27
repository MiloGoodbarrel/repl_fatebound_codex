import { z } from "zod";

const actionSchema = z.object({
  name: z.string(), desc: z.string(), attack_bonus: z.number().optional(),
  damage: z.array(z.object({ damage_dice: z.string(), damage_type: z.string() })).optional(),
});
const detailedActionSchema = z.object({
  name: z.string(), description: z.string(), category: z.string(),
  attackBonus: z.number().optional(), reachFt: z.number().optional(),
  saveAbility: z.string().optional(), saveDc: z.number().optional(),
  damageDice: z.string().optional(), damageType: z.string().optional(),
});

export const creatureProfileSchema = z.object({
  index: z.string(), name: z.string().trim().min(1), hp: z.number().finite(),
  ac: z.number().finite(), cr: z.string(), type: z.string(), size: z.string(),
  hit_dice: z.string().optional(), hitDiceCount: z.number().optional(), hitDieSize: z.number().optional(),
  str: z.number().optional(), dex: z.number().optional(), con: z.number().optional(),
  int: z.number().optional(), wis: z.number().optional(), cha: z.number().optional(),
  strMod: z.number().optional(), dexMod: z.number().optional(), conMod: z.number().optional(),
  intMod: z.number().optional(), wisMod: z.number().optional(), chaMod: z.number().optional(),
  savingThrows: z.record(z.string(), z.number()).optional(),
  spellSaveDc: z.number().optional(), spellAttackBonus: z.number().optional(),
  speed: z.record(z.string(), z.string()).optional(),
  resistances: z.array(z.string()).optional(), immunities: z.array(z.string()).optional(),
  conditionImmunities: z.array(z.string()).optional(), vulnerabilities: z.array(z.string()).optional(),
  senses: z.string().optional(), languages: z.string().optional(),
  actions: z.array(actionSchema).optional(),
  special_abilities: z.array(z.object({ name: z.string(), desc: z.string() })).optional(),
  traits: z.array(z.object({ name: z.string(), description: z.string(), type: z.string() })).optional(),
  detailedActions: z.array(detailedActionSchema).optional(),
  source: z.string().optional(), description: z.string().optional(), sourcePage: z.number().optional(),
  imageUrl: z.string().optional(), alignment: z.string().optional(), creatureTags: z.string().optional(),
  disposition: z.object({
    combatantType: z.enum(["monster", "npc"]),
    stance: z.enum(["ally", "neutral", "enemy"]), referenceOnly: z.boolean(),
  }).optional(),
});
export type CreatureProfile = z.infer<typeof creatureProfileSchema>;

export interface CampaignLibraryEntry {
  id: number;
  name: string;
  printedAverageHp: number | null;
  armorClass: number | null;
  hitDice: string | null;
  dexScore: number | null;
  challengeRating: string | null;
  creatureType: string | null;
  size: string | null;
  alignment: string | null;
  profileData?: CreatureProfile | null;
  actions: Array<{ actionName: string | null; actionDescription: string | null; attackBonus: number | null }>;
}

export function campaignProfileToMonster(entry: CampaignLibraryEntry): CreatureProfile {
  if (entry.profileData) {
    return { ...structuredClone(entry.profileData), index: `homebrew-${entry.id}`, name: entry.name };
  }
  return {
    index: `homebrew-${entry.id}`, name: entry.name,
    hp: entry.printedAverageHp ?? 10, ac: entry.armorClass ?? 10,
    hit_dice: entry.hitDice ?? undefined, cr: entry.challengeRating ?? "—",
    type: entry.creatureType ?? "", size: entry.size ?? "",
    alignment: entry.alignment ?? undefined, dex: entry.dexScore ?? undefined,
    dexMod: entry.dexScore != null ? Math.floor((entry.dexScore - 10) / 2) : undefined,
    source: "Homebrew",
    actions: entry.actions.map(action => ({
      name: action.actionName ?? "", desc: action.actionDescription ?? "",
      attack_bonus: action.attackBonus ?? undefined,
    })),
  };
}

export function profileLibraryColumns(profile: CreatureProfile) {
  const referenceOnly = profile.disposition?.referenceOnly;
  return {
    name: profile.name, creatureType: profile.type, size: profile.size,
    alignment: profile.alignment ?? null,
    armorClass: referenceOnly ? null : profile.ac,
    printedAverageHp: referenceOnly ? null : profile.hp,
    hitDice: profile.hit_dice ?? null, dexScore: profile.dex ?? null,
    challengeRating: profile.cr, profileData: profile,
  };
}
