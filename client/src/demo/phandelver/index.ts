import type { WorkspaceDemoData, DemoHomebrew } from "../workspaceData";
import { PHANDELVER_PREGENS } from "./pregens";
import { PHANDELVER_PROFILES } from "./profiles";
import { PHANDELVER_ENCOUNTERS } from "./encounters";
import { phandelverJournal } from "./journal";

/** Curated uploaded-module fixtures; never an export of an account campaign. */
export function seedPhandelverDemo(data: WorkspaceDemoData): WorkspaceDemoData {
  data.campaigns[0] = { id: 1, ownerUserId: null, name: "Lost Mine of Phandelver", edition: "5e",
    description: "Starter Set adventure demo · Five level-one pregens · Saved encounters and spoiler-filled DM preparation in Sessions. Later encounters require advancing the party; no completed play is assumed." };
  data.campaigns[1].description = "Original fictional resource-linking sandbox, not part of Lost Mine of Phandelver.";
  data.characters = [
    ...PHANDELVER_PREGENS.map(({ id, name, playerClass, maxHp, ac, initiativeBonus }) =>
      ({ id, campaignId: 1, name, playerClass, maxHp, ac, initiativeBonus, healingSurgesMax: null })),
    ...data.characters.filter(c => c.campaignId !== 1).map((c, i) => ({ ...c, id: 150 + i })),
  ];
  data.homebrew = [
    ...data.homebrew.filter(c => c.campaignId !== 1),
    ...Object.values(PHANDELVER_PROFILES).map((profile, i): DemoHomebrew => ({
      id: 2000 + i, campaignId: 1, name: profile.name, creatureType: profile.type,
      size: profile.size, armorClass: profile.ac, printedAverageHp: profile.hp,
      dexScore: profile.dex ?? 10, challengeRating: profile.cr,
      profileData: structuredClone(profile), actions: [],
    })),
  ];
  data.items = data.items.filter(i => i.campaignId !== 1);
  data.items.push({ id: 300, campaignId: 1, name: "Talon", category: "Weapons", itemType: "Longsword",
    rarity: "Uncommon", description: "Adventure reference, NOT acquired loot: a +1 longsword associated with Tresendar Manor, hidden in the nothic's treasure (p. 23).",
    damage: "1d8+1 slashing (1d10+1 two-handed), plus wielder's modifier", weight: "3 lb.", cost: null,
    properties: "Versatile, magic weapon (+1 to attack and damage)", attunement: null, source: "LMoP · p. 23" });
  const fresh = () => ({
    initiative: 0, initiativeRolled: false, conditions: [] as string[], tempHp: 0,
    isDown: false, deathSaveSuccesses: 0, deathSaveFailures: 0, isStable: false, isDead: false,
  });
  data.prepared = [
    ...PHANDELVER_ENCOUNTERS.map((encounter, i) => ({
      id: 400 + i, campaignId: 1, name: encounter.name, createdAt: "2026-10-30T12:00:00.000Z", updatedAt: "2026-10-30T12:00:00.000Z",
      data: {
        round: 1, activeIndex: 0, combatState: "setup", selectedVersions: ["5e"],
        source: "Lost Mine of Phandelver", sourcePage: encounter.page, prepNotes: encounter.notes,
        combatants: [
          ...PHANDELVER_PREGENS.map(pc => ({
            ...fresh(), id: `demo-lmop-pc-${pc.id}`, name: pc.name, ac: pc.ac, hp: pc.maxHp, maxHp: pc.maxHp,
            combatantType: "pc", isMonster: false, isGroup: false, campaignCharacterId: pc.id,
            abilityModifierOverrides: { dex: pc.initiativeBonus },
          })),
          ...encounter.enemies.map(([key, count]) => {
            const monster = structuredClone(PHANDELVER_PROFILES[key]);
            if (!monster) throw new Error(`Missing Phandelver profile: ${key}`);
            monster.dexMod = Math.floor(((monster.dex ?? 10) - 10) / 2);
            const conditions = encounter.key === "common" ? ["Poisoned"] : [];
            return {
              ...fresh(), id: `demo-lmop-${encounter.key}-${key}`, name: monster.name,
              ac: monster.ac, hp: monster.hp, maxHp: monster.hp,
              combatantType: "monster", isMonster: true, monsterData: monster, conditions: count === 1 ? conditions : [],
              isGroup: count > 1,
              ...(count > 1 ? { memberHp: Array(count).fill(monster.hp),
                memberConditions: Array.from({ length: count }, () => [...conditions]) } : {}),
            };
          }),
        ],
      },
    })),
    ...data.prepared.filter(p => p.campaignId !== 1).map((p, i) => ({ ...p, id: 900 + i })),
  ];
  data.sessions = [...phandelverJournal(), ...data.sessions.filter(s => s.session.campaignId !== 1)];
  data.nextId = 10000;
  return data;
}
