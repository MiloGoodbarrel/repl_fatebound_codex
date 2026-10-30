import type { Campaign, CampaignCharacter, CampaignItem } from "@shared/schema";
import type { CreatureProfile } from "@shared/creatureProfiles";
import type { Alias, SessionDetail } from "@shared/journal";
import type { RollTable } from "@shared/rollTables";
import type { SummaryVersion } from "@shared/sessionSummary";
import type { Appearance } from "@shared/appearance";
import { createDemoState } from "./fixtures";
import { z } from "zod";
import { appearanceSchema } from "@shared/appearance";
import { creatureProfileSchema } from "@shared/creatureProfiles";
import { sectionsSchema } from "@shared/sessionSummary";

export const WORKSPACE_DEMO_KEY = "fatebound:workspace-demo:v2";
export interface DemoHomebrew {
  id: number; campaignId: number; name: string; creatureType: string; size: string;
  armorClass: number; printedAverageHp: number; dexScore: number; challengeRating: string;
  profileData: CreatureProfile; actions: unknown[];
}
export interface DemoLink {
  id: number; campaignId: number; sourceCampaignId: number; sourceCampaignName: string;
  kind: "items" | "npcs"; resourceId: number; name: string;
}
export interface PreparedDemo {
  id: number; campaignId: number; name: string; data: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}
export interface WorkspaceDemoData {
  version: 2; nextId: number; appearance: Appearance;
  campaigns: Campaign[]; characters: CampaignCharacter[]; items: CampaignItem[];
  homebrew: DemoHomebrew[]; links: DemoLink[]; tables: RollTable[];
  encounters: Record<string, { data: unknown; savedAt: string }>;
  prepared: PreparedDemo[]; sessions: SessionDetail[];
  aliases: Record<string, Alias[]>; summaries: Record<string, SummaryVersion[]>;
}

/** Only original fictional fixtures, never fetched or exported from a real account. */
export function createWorkspaceDemo(): WorkspaceDemoData {
  const old = createDemoState();
  const campaigns = old.campaigns.map((c, i) => ({
    ...c, id: i + 1, ownerUserId: null,
  }));
  const campaignId = (id: string) => old.campaigns.findIndex(c => c.id === id) + 1;
  const characters = old.characters.filter(c => c.kind === "PC").map((c, i) => ({
    id: 100 + i, campaignId: campaignId(c.campaignId), name: c.name,
    playerClass: c.role, maxHp: c.hp, ac: c.ac, healingSurgesMax: null, initiativeBonus: 2,
  }));
  const homebrew = old.characters.filter(c => c.kind === "NPC").map((c, i) => {
    const profileData: CreatureProfile = {
      index: `demo-creature-${i}`, name: c.name, hp: c.hp, ac: c.ac, cr: "1",
      type: "humanoid", size: "Medium", dex: 12, source: "Fictional demo",
      description: c.role, disposition: { combatantType: "npc", referenceOnly: false,
        stance: c.disposition === "friendly" ? "ally" : "enemy" },
      actions: [{ name: "Staff", desc: "Melee weapon attack: +3 to hit; 1d6 bludgeoning damage.", attack_bonus: 3,
        damage: [{ damage_dice: "1d6", damage_type: "bludgeoning" }] }],
    };
    return { id: 200 + i, campaignId: campaignId(c.campaignId), name: c.name, creatureType: "humanoid",
      size: "Medium", armorClass: c.ac, printedAverageHp: c.hp, dexScore: 12,
      challengeRating: "1", profileData, actions: [] };
  });
  const items: CampaignItem[] = [
    { id: 300, campaignId: 1, name: "Lantern Lens", category: "Wondrous Item", itemType: null,
      rarity: "Uncommon", description: "An original fictional prism that glows near the tide caves.",
      damage: null, weight: "1 lb.", cost: null, properties: null, attunement: null },
    { id: 301, campaignId: 2, name: "Star Chart Compass", category: "Wondrous Item", itemType: null,
      rarity: "Common", description: "A fictional compass pointing toward the observatory's vanished star.",
      damage: null, weight: null, cost: null, properties: null, attunement: null },
  ];
  const sessions: SessionDetail[] = old.sessions.map(s => ({
    session: { id: s.id, campaignId: campaignId(s.campaignId), title: s.title, date: s.date,
      notes: s.notes, revision: 0, updatedAt: new Date().toISOString() },
    imports: s.sources.map(source => ({ id: source.id, sessionId: s.id, title: source.title,
      kind: "transcript", format: "text", original: source.original, reviewed: source.original,
      suggestions: [], decisions: [], editedText: null, revision: 0 })),
    recordings: [],
  }));
  return {
    version: 2, nextId: 1000, appearance: old.appearance, campaigns, characters, items, homebrew,
    links: [], tables: [], encounters: {}, aliases: {}, summaries: {}, sessions,
    prepared: old.encounters.map((e, i) => ({
      id: 400 + i, campaignId: campaignId(e.campaignId), name: e.name,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      data: {
        round: 1, activeIndex: 0, combatState: "setup", selectedVersions: ["5e"],
        combatants: e.members.map(m => ({
          id: m.id, name: m.name, ac: m.ac, hp: m.hp, maxHp: m.maxHp,
          initiative: m.initiative, combatantType: m.count > 1 ? "monster" : "pc",
          conditions: [], isGroup: m.count > 1, isMonster: m.count > 1, tempHp: 0,
          initiativeRolled: true, isDown: false, deathSaveSuccesses: 0, deathSaveFailures: 0,
          isStable: false, isDead: false,
          memberHp: m.count > 1 ? Array(m.count).fill(m.hp) : undefined,
          memberConditions: m.count > 1 ? Array.from({ length: m.count }, () => []) : undefined,
        })),
      },
    })),
  };
}

const numericId = z.number().int().positive();
const ref = z.object({ key: z.string(), name: z.string(), source: z.string() });
const source = z.object({ id: z.string(), title: z.string(), kind: z.enum(["notes", "import"]),
  revision: z.number().int().nonnegative(), text: z.string() });
const version = z.object({ sessionId: z.string(), revision: numericId, status: z.enum(["draft", "approved"]),
  action: z.enum(["save", "approve", "restore"]), sections: sectionsSchema, sources: z.array(source),
  sourceFingerprint: z.string(), createdAt: z.string(), restoredFrom: z.number().nullable() });
const demoSaveSchema = z.object({
  version: z.literal(2), nextId: numericId, appearance: appearanceSchema,
  campaigns: z.array(z.object({ id: numericId, name: z.string(), edition: z.string(), description: z.string().nullable(), ownerUserId: z.null() })),
  characters: z.array(z.object({ id: numericId, campaignId: numericId, name: z.string(), maxHp: z.number(), ac: z.number() })),
  items: z.array(z.object({ id: numericId, campaignId: numericId, name: z.string(), category: z.string(), rarity: z.string(), description: z.string() })),
  homebrew: z.array(z.object({ id: numericId, campaignId: numericId, name: z.string(), profileData: creatureProfileSchema, actions: z.array(z.unknown()) })),
  links: z.array(z.object({ id: numericId, campaignId: numericId, sourceCampaignId: numericId, sourceCampaignName: z.string(),
    resourceId: numericId, kind: z.enum(["items", "npcs"]), name: z.string() })),
  tables: z.array(z.object({ id: numericId, campaignId: numericId, name: z.string(), category: z.string(),
    mode: z.enum(["range", "weighted"]), source: z.literal("campaign"), description: z.string(),
    entries: z.array(z.object({ entryOrder: z.number(), text: z.string(), minRoll: z.number().optional(), maxRoll: z.number().optional(), weight: z.number().optional() })) })),
  encounters: z.record(z.string(), z.object({ data: z.record(z.string(), z.unknown()), savedAt: z.string() })),
  prepared: z.array(z.object({ id: numericId, campaignId: numericId, name: z.string(),
    data: z.record(z.string(), z.unknown()), createdAt: z.string(), updatedAt: z.string() })),
  aliases: z.record(z.string(), z.array(z.object({ id: z.string(), phrase: z.string(), referenceKey: z.string() }))),
  summaries: z.record(z.string(), z.array(version)),
  sessions: z.array(z.object({
    session: z.object({ id: z.string(), campaignId: numericId, title: z.string(), date: z.string(), notes: z.string(),
      revision: z.number().int().nonnegative(), updatedAt: z.string() }),
    imports: z.array(z.object({ id: z.string(), sessionId: z.string(), title: z.string(), kind: z.enum(["transcript", "summary"]),
      format: z.enum(["text", "markdown"]), original: z.string(), reviewed: z.string(), editedText: z.string().nullable(),
      revision: z.number().int().nonnegative(),
      suggestions: z.array(z.object({ id: z.string(), start: z.number(), end: z.number(), phrase: z.string(), candidates: z.array(ref),
        confidence: z.enum(["remembered", "likely", "ambiguous"]), explanation: z.string() })),
      decisions: z.array(z.object({ suggestionId: z.string(), referenceKey: z.string().nullable() })) })),
    recordings: z.array(z.unknown()),
  })),
});

export function validateWorkspaceDemo(value: unknown): WorkspaceDemoData {
  // Validate every persisted collection before the shared screens can consume it.
  if (!demoSaveSchema.safeParse(value).success) throw new Error("Stored demo data is invalid. Reset demo to recover.");
  return value as WorkspaceDemoData;
}
