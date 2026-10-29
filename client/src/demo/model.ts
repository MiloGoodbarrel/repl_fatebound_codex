import { z } from "zod";
import { appearanceSchema } from "../../../shared/appearance";
import { sectionsSchema } from "../../../shared/sessionSummary";
export { isDemoPath } from "../../../shared/demoPath";

const id = z.string().startsWith("demo-").max(100);
const text = z.string().max(2000);
const member = z.object({
  id, name: text, ac: z.number().int().min(0).max(40),
  hp: z.number().int().min(0).max(999), maxHp: z.number().int().min(1).max(999),
  initiative: z.number().int().min(-30).max(99), count: z.number().int().min(1).max(30),
  conditions: z.array(z.string().max(50)).max(12),
});
export const demoSchema = z.object({
  version: z.literal(1),
  activeCampaignId: id,
  appearance: appearanceSchema,
  campaigns: z.array(z.object({ id, name: z.string().min(1).max(100), description: text, edition: z.literal("5e") })).min(1).max(8),
  characters: z.array(z.object({ id, campaignId: id, name: text, role: text, kind: z.enum(["PC", "NPC"]), disposition: z.enum(["friendly", "neutral", "enemy"]), hp: z.number().int().min(1).max(999), ac: z.number().int().min(0).max(40) })).max(60),
  encounters: z.array(z.object({ id, campaignId: id, name: text, round: z.number().int().min(1).max(9999), turn: z.number().int().min(0), running: z.boolean(), members: z.array(member).max(30) })).max(20),
  items: z.array(z.object({ id, name: text, rarity: text, kind: text, description: text })).max(40),
  lootDraw: z.array(id).max(12),
  loot: z.array(z.object({ id, campaignId: id, itemId: id, quantity: z.number().int().min(1).max(99) })).max(100),
  tables: z.array(z.object({ id, campaignId: id, name: text, entries: z.array(z.object({ id, text, weight: z.number().int().min(1).max(100) })).min(1).max(40) })).max(30),
  lastRoll: z.object({ tableId: id, entryId: id, roll: z.number().int().min(1) }).nullable(),
  sessions: z.array(z.object({
    id, campaignId: id, title: z.string().min(1).max(150), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(12000), sections: sectionsSchema,
    versions: z.array(z.object({ revision: z.number().int().positive(), status: z.enum(["draft", "approved"]), sections: sectionsSchema, createdAt: z.string().max(50) })).max(10),
    sources: z.array(z.object({ id: z.string().max(100), title: text, original: z.string().max(12000), reviewed: z.string().max(12000) })).max(5),
  })).max(40),
}).superRefine((value, ctx) => {
  const campaigns = new Set(value.campaigns.map(c => c.id));
  if (!campaigns.has(value.activeCampaignId)) ctx.addIssue({ code: "custom", message: "Choose an existing demo campaign." });
  for (const collection of [value.characters, value.encounters, value.loot, value.tables, value.sessions]) {
    for (const entry of collection) if (!campaigns.has(entry.campaignId)) ctx.addIssue({ code: "custom", message: "Demo records must belong to an existing demo campaign." });
  }
  for (const encounter of value.encounters) {
    if (encounter.turn >= Math.max(1, encounter.members.length)) ctx.addIssue({ code: "custom", message: "Select an existing combatant." });
    for (const m of encounter.members) if (m.hp > m.maxHp) ctx.addIssue({ code: "custom", message: "HP cannot exceed maximum HP." });
  }
  const items = new Set(value.items.map(item => item.id));
  if ([...value.lootDraw, ...value.loot.map(entry => entry.itemId)].some(key => !items.has(key))) ctx.addIssue({ code: "custom", message: "Loot must reference a demo item." });
});
export type DemoState = z.infer<typeof demoSchema>;
export const DEMO_STORAGE_KEY = "fatebound:public-demo:v1";
export const DEMO_MAX_BYTES = 1_000_000;
export function parseDemoState(raw: string): DemoState {
  if (new TextEncoder().encode(raw).length > DEMO_MAX_BYTES) throw new Error("Demo storage limit reached. Remove some demo records or reset the demo.");
  return demoSchema.parse(JSON.parse(raw));
}
export function demoId() { return `demo-${crypto.randomUUID()}`; }
export function drawWeighted(entries: { id: string; weight: number }[], random = Math.random()) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total || random < 0 || random >= 1) throw new Error("A roll needs weighted demo entries.");
  const roll = Math.floor(random * total) + 1;
  let cumulative = 0;
  const entry = entries.find(entry => (cumulative += entry.weight) >= roll)!;
  return { entryId: entry.id, roll };
}
