import type { CreatureProfile } from "./creatureProfiles";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

export function normalizeRescuedCaptives(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1000, Math.floor(value))) : 0;
}

export function hasFreedomWeakening(profile?: CreatureProfile): boolean {
  return !!profile && [
    ...(profile.special_abilities ?? []), ...(profile.traits ?? []),
  ].some(trait => trait.name.toLowerCase() === "weakened by freedom");
}

/** Positive printed bonuses stop at +1; never raise a zero or negative modifier. */
function reduceBonus(base: number, count: number): number {
  return base > 0 ? Math.max(1, base - count) : base - count;
}

/** Always derive from the stored, unmodified stat block, never a previously weakened copy. */
export function applyFreedomWeakening(profile: CreatureProfile, rescued: number): CreatureProfile {
  if (!hasFreedomWeakening(profile)) return profile;
  const count = normalizeRescuedCaptives(rescued);
  const sourceText = [
    profile.description ?? "",
    ...(profile.special_abilities ?? []).map(trait => trait.desc),
    ...(profile.traits ?? []).map(trait => trait.description),
  ].join(" ");
  const saves: Record<string, number> = Object.fromEntries(ABILITIES.map(key => [
    key, profile[`${key}Mod`] ?? Math.floor(((profile[key] ?? 10) - 10) / 2),
  ]));
  // Legacy prepared encounters already retain their printed header in source notes.
  const printed = sourceText.match(/\bSaves\s+((?:(?:Str|Dex|Con|Int|Wis|Cha)\s+[+-]\d+(?:,\s*)?)+)/i)?.[1] ?? "";
  for (const match of Array.from(printed.matchAll(/\b(Str|Dex|Con|Int|Wis|Cha)\s+([+-]\d+)/gi))) {
    saves[match[1].toLowerCase()] = Number(match[2]);
  }
  Object.assign(saves, profile.savingThrows);
  const dc = profile.spellSaveDc ?? Number(sourceText.match(/spell save DC\s+(\d+)/i)?.[1] || 0);
  const spellAttack = profile.spellAttackBonus
    ?? Number(sourceText.match(/([+-]\d+) to hit with spell attacks/i)?.[1] || 0);
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
  const attackText = (text: string) => text.replace(
    /([+-]\d+)(?= to hit)/gi, (_, value) => signed(reduceBonus(Number(value), count)),
  );
  const spellText = (text: string) => attackText(text).replace(
    /(\bspell save DC\s+)(\d+)/gi, (_, prefix, value) => prefix + Math.max(1, Number(value) - count),
  );
  return {
    ...profile,
    savingThrows: Object.fromEntries(Object.entries(saves).map(([key, value]) => [key, reduceBonus(value, count)])),
    spellSaveDc: dc ? Math.max(1, dc - count) : undefined,
    spellAttackBonus: spellAttack ? reduceBonus(spellAttack, count) : undefined,
    actions: profile.actions?.map(action => ({
      ...action, desc: attackText(action.desc),
      attack_bonus: action.attack_bonus == null ? undefined : reduceBonus(action.attack_bonus, count),
    })),
    detailedActions: profile.detailedActions?.map(action => ({
      ...action, description: attackText(action.description),
      attackBonus: action.attackBonus == null ? undefined : reduceBonus(action.attackBonus, count),
    })),
    special_abilities: profile.special_abilities?.map(trait =>
      trait.name.toLowerCase() === "spellcasting" ? { ...trait, desc: spellText(trait.desc) } : trait),
    traits: profile.traits?.map(trait =>
      trait.name.toLowerCase() === "spellcasting" ? { ...trait, description: spellText(trait.description) } : trait),
  };
}
