import type { Express } from "express";
import type { Server } from "http";
import fs from "node:fs";
import path from "node:path";
import { storage } from "./storage";
import { registerCampaignResourceRoutes } from "./campaignResources";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertCampaignSchema, insertCampaignCharacterSchema, rollTableInputSchema, type InsertItem, type InsertHomebrewItem } from "@shared/schema";
import { STOCK_ROLL_TABLES } from "@shared/rollTables";
import { seedLootTable } from "./seedLoot";
import { mapBestiaryActions } from "./bestiaryActions";
import { creatureProfileSchema, profileLibraryColumns } from "@shared/creatureProfiles";

const grimHollowLorePath = path.resolve(process.cwd(), "server/data/bestiary/grim_hollow_lore.json");
const grimHollowLore: Record<string, { description?: string; sourcePage?: number; imageUrl?: string }> =
  fs.existsSync(grimHollowLorePath)
    ? JSON.parse(fs.readFileSync(grimHollowLorePath, "utf8"))
    : {};

function parseCSV(csvText: string): Omit<InsertItem, never>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const requiredHeaders = ['name', 'category', 'rarity'];
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(`Missing required CSV column: "${required}". Required: ${requiredHeaders.join(', ')}`);
    }
  }

  const items: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let inQuote = false;
    let current = '';
    for (const char of line) {
      if (char === '"') { inQuote = !inQuote; }
      else if (char === ',' && !inQuote) { values.push(current.trim()); current = ''; }
      else { current += char; }
    }
    values.push(current.trim());

    const get = (col: string) => values[headers.indexOf(col)]?.trim() || '';
    const name = get('name');
    if (!name) continue;

    items.push({
      name,
      category: get('category') || 'Magical',
      rarity: get('rarity') || 'Common',
      description: get('description') || '',
      itemType: get('item_type') || get('itemtype') || null,
      damage: get('damage') || null,
      weight: get('weight') || null,
      cost: get('cost') || null,
      properties: get('properties') || null,
      attunement: get('attunement') || null,
    });
  }
  return items;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let inQuote = false;
  let current = '';
  for (const char of line) {
    if (char === '"') { inQuote = !inQuote; }
    else if (char === ',' && !inQuote) { values.push(current.trim()); current = ''; }
    else { current += char; }
  }
  values.push(current.trim());
  return values;
}

function parseHomebrewCSV(csvText: string): { monster: any; actions: any[] }[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  if (!headers.includes("name")) throw new Error('Missing required column "name"');

  const results: { monster: any; actions: any[] }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const get = (col: string) => {
      const idx = headers.indexOf(col);
      return idx >= 0 ? (values[idx] ?? "").trim() : "";
    };
    const name = get("name");
    if (!name) continue;

    const monster = {
      name,
      creatureType: get("type") || null,
      size: get("size") || null,
      alignment: get("alignment") || null,
      armorClass: parseInt(get("ac")) || null,
      printedAverageHp: parseInt(get("hp")) || null,
      hitDice: get("hit_dice") || null,
      dexScore: parseInt(get("dex")) || null,
      challengeRating: get("cr") || null,
    };

    const actions: any[] = [];
    for (let j = 1; j <= 5; j++) {
      const aName = get(`action${j}_name`);
      if (!aName) continue;
      actions.push({
        actionOrder: j - 1,
        actionName: aName,
        actionDescription: get(`action${j}_desc`) || null,
        attackBonus: parseInt(get(`action${j}_attack_bonus`)) || null,
      });
    }

    results.push({ monster, actions });
  }

  return results;
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerCampaignResourceRoutes(app, storage);

  // ── 5e Compendium ────────────────────────────────────────────────────────

  app.get("/api/items/5e", async (req, res) => {
    const items = await storage.getItems5e();
    res.json(items);
  });

  app.get("/api/items/5e/sources", async (req, res) => {
    const sources = await storage.getSources5e();
    res.json(sources);
  });

  app.post("/api/import/5e", async (req, res) => {
    try {
      const csvText = await readBody(req);
      const items = parseCSV(csvText) as Omit<InsertHomebrewItem, "source">[];
      await storage.addHomebrewItems(items);
      res.json({ message: `Added ${items.length} items to Homebrew table`, count: items.length });
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Error parsing CSV" });
    }
  });

  app.delete("/api/items/homebrew", async (req, res) => {
    await storage.clearHomebrewItems();
    res.json({ message: "Homebrew table cleared" });
  });

  app.delete("/api/items/5e", async (req, res) => {
    await storage.clearItems5e();
    res.json({ message: "5e compendium cleared" });
  });

  app.post("/api/admin/seed-loot/:edition", async (req, res) => {
    const { edition } = req.params;
    try {
      const result = await seedLootTable(edition, true);
      res.json({ message: `Seeded ${result.inserted} items for edition "${edition}"`, ...result });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Seed failed" });
    }
  });

  // ── Draw ─────────────────────────────────────────────────────────────────

  app.post(api.items.draw.path, async (req, res) => {
    try {
      const input = api.items.draw.input.parse(req.body);
      const items = await storage.drawItems(input);
      res.json(items);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // ── Campaigns ─────────────────────────────────────────────────────────────

  app.get("/api/campaigns", async (req, res) => {
    const all = await storage.getCampaigns();
    res.json(all);
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const data = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(data);
      res.json(campaign);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Failed to create campaign" });
      }
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    await storage.deleteCampaign(id);
    res.json({ message: "Campaign deleted" });
  });

  // ── Campaign Items ────────────────────────────────────────────────────────

  app.get("/api/campaigns/:id/items", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    const items = await storage.getCampaignItems(id);
    res.json(items);
  });

  app.post("/api/campaigns/:id/import", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      const csvText = await readBody(req);
      const items = parseCSV(csvText);
      await storage.clearCampaignItems(id);
      await storage.importCampaignItems(id, items);
      res.json({ message: `Imported ${items.length} items into campaign`, count: items.length });
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Error parsing CSV" });
    }
  });

  app.delete("/api/campaigns/:id/items", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    await storage.clearCampaignItems(id);
    res.json({ message: "Campaign items cleared" });
  });

  // ── Campaign Characters ───────────────────────────────────────────────────

  app.get("/api/campaigns/:id/characters", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    const chars = await storage.getCampaignCharacters(id);
    res.json(chars);
  });

  app.post("/api/campaigns/:id/characters", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      const data = insertCampaignCharacterSchema.parse({ ...req.body, campaignId: id });
      const char = await storage.upsertCampaignCharacter(data);
      res.json(char);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Failed to save character" });
      }
    }
  });

  app.patch("/api/campaigns/characters/:charId", async (req, res) => {
    const charId = parseInt(req.params.charId);
    if (isNaN(charId)) return res.status(400).json({ message: "Invalid character id" });
    try {
      const char = await storage.updateCampaignCharacter(charId, req.body);
      res.json(char);
    } catch (err) {
      res.status(500).json({ message: "Failed to update character" });
    }
  });

  app.delete("/api/campaigns/characters/:charId", async (req, res) => {
    const charId = parseInt(req.params.charId);
    if (isNaN(charId)) return res.status(400).json({ message: "Invalid character id" });
    await storage.deleteCampaignCharacter(charId);
    res.json({ message: "Character removed from campaign" });
  });

  // ── Monster Bestiary ──────────────────────────────────────────────────────

  function mapMonsterRow(m: any) {
    const sourceContent = grimHollowLore[m.monsterId];
    return {
      index: m.monsterId,
      name: m.name,
      hp: m.printedAverageHp || 0,
      hit_dice: m.hitDiceCount && m.hitDieSize ? `${m.hitDiceCount}d${m.hitDieSize}` : undefined,
      hitDiceCount: m.hitDiceCount,
      hitDieSize: m.hitDieSize,
      ac: m.armorClass || 10,
      cr: m.challengeRating || "--",
      type: m.creatureType || "",
      size: m.size || "",
      str: m.strScore, dex: m.dexScore, con: m.conScore,
      int: m.intScore, wis: m.wisScore, cha: m.chaScore,
      strMod: m.strMod, dexMod: m.dexMod, conMod: m.conMod,
      intMod: m.intMod, wisMod: m.wisMod, chaMod: m.chaMod,
      alignment: m.alignment,
      creatureTags: m.creatureTags,
      source: m.sourceBook || m.sourceKey || "",
      description: sourceContent?.description || undefined,
      sourcePage: sourceContent?.sourcePage || m.sourcePage || undefined,
      imageUrl: sourceContent?.imageUrl || undefined,
    };
  }

  app.get("/api/bestiary/types", async (_req, res) => {
    try {
      const types = await storage.getBestiaryTypes();
      res.json(types);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch creature types" });
    }
  });

  app.get("/api/bestiary/cr-values", async (_req, res) => {
    try {
      const crs = await storage.getBestiaryCRs();
      res.json(crs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch CR values" });
    }
  });

  app.get("/api/bestiary/sources", async (_req, res) => {
    try {
      const sources = await storage.getBestiarySources();
      res.json(sources);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sources" });
    }
  });

  app.get("/api/bestiary/encounter", async (req, res) => {
    try {
      const typesParam = (req.query.types as string) || "";
      const sourcesParam = (req.query.sources as string) || "";
      const types = typesParam ? typesParam.split(",").filter(Boolean) : [];
      const sources = sourcesParam ? sourcesParam.split("|").filter(Boolean) : [];
      const cr = (req.query.cr as string) || "1";
      const search = (req.query.search as string) || "";
      const group = await storage.getEncounterGroup(cr, types, sources, search);
      if (group.length === 0) return res.status(404).json({ message: "No monsters found matching filters" });
      res.json(group.map(mapMonsterRow));
    } catch (err) {
      res.status(500).json({ message: "Failed to build encounter" });
    }
  });

  app.get("/api/bestiary/monsters/random", async (req, res) => {
    try {
      const typesParam = (req.query.types as string) || "";
      const sourcesParam = (req.query.sources as string) || "";
      const types = typesParam ? typesParam.split(",").filter(Boolean) : [];
      const sources = sourcesParam ? sourcesParam.split("|").filter(Boolean) : [];
      const cr = (req.query.cr as string) || undefined;
      const monster = await storage.getRandomBestiaryMonster(types, cr, sources);
      if (!monster) return res.status(404).json({ message: "No monsters found matching filters" });
      res.json(mapMonsterRow(monster));
    } catch (err) {
      res.status(500).json({ message: "Failed to get random monster" });
    }
  });

  app.get("/api/bestiary/monsters", async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const typesParam = (req.query.types as string) || "";
      const sourcesParam = (req.query.sources as string) || "";
      const types = typesParam ? typesParam.split(",").filter(Boolean) : [];
      const sources = sourcesParam ? sourcesParam.split("|").filter(Boolean) : [];
      const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
      const cr = (req.query.cr as string) || undefined;
      const rows = await storage.searchBestiary(search, types, limit, cr, sources);
      res.json(rows.map(mapMonsterRow));
    } catch (err) {
      res.status(500).json({ message: "Failed to search bestiary" });
    }
  });

  // ── Campaign Homebrew Bestiary ────────────────────────────────────────────

  // CSV template download
  app.get("/api/homebrew-bestiary/template.csv", (_req, res) => {
    const header = [
      "name","type","size","cr","ac","hp","hit_dice","dex","alignment",
      "action1_name","action1_desc","action1_attack_bonus",
      "action2_name","action2_desc","action2_attack_bonus",
      "action3_name","action3_desc","action3_attack_bonus",
      "action4_name","action4_desc","action4_attack_bonus",
      "action5_name","action5_desc","action5_attack_bonus",
    ].join(",");
    const example = [
      "Brigand Chief","Humanoid","Medium","1","14","22","4d8+4","12","neutral evil",
      "Longsword","\"Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8+2) slashing damage.\"","4",
      "Heavy Crossbow","\"Ranged Weapon Attack: +4 to hit, range 100/400 ft., one target. Hit: 7 (1d10+2) piercing damage.\"","4",
      "","","","","","","","","",
    ].join(",");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=\"homebrew-bestiary-template.csv\"");
    res.send(`${header}\n${example}\n`);
  });

  app.get("/api/campaigns/:id/homebrew-bestiary", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      const monsters = await storage.getCampaignHomebrew(id);
      res.json(monsters);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch homebrew bestiary" });
    }
  });

  app.post("/api/campaigns/:id/homebrew-bestiary/import", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      if (req.is("application/json")) {
        const { profiles } = z.object({ profiles: z.array(creatureProfileSchema).min(1).max(200) }).parse(req.body);
        const parsed = profiles.map(profile => ({
          monster: profileLibraryColumns(profile),
          actions: (profile.actions ?? []).map((action, actionOrder) => ({
            actionOrder, actionName: action.name, actionDescription: action.desc,
            attackBonus: action.attack_bonus ?? null,
          })),
        }));
        const count = await storage.importCampaignHomebrew(id, parsed);
        return res.json({ message: `Imported ${count} complete profiles`, count });
      }
      const csvText = await readBody(req);
      const parsed = parseHomebrewCSV(csvText);
      if (parsed.length === 0) return res.status(400).json({ message: "No valid rows found in CSV" });
      const count = await storage.importCampaignHomebrew(id, parsed);
      res.json({ message: `Imported ${count} monsters`, count });
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Error parsing CSV" });
    }
  });

  app.patch("/api/campaigns/:id/homebrew-bestiary/:monsterId/profile", async (req, res) => {
    const campaignId = Number(req.params.id);
    const monsterId = Number(req.params.monsterId);
    if (!Number.isInteger(campaignId) || !Number.isInteger(monsterId)) {
      return res.status(400).json({ message: "Invalid campaign or creature id" });
    }
    try {
      const profile = creatureProfileSchema.parse(req.body);
      const updated = await storage.updateCampaignHomebrewProfile(campaignId, monsterId, profileLibraryColumns(profile));
      if (!updated) return res.status(404).json({ message: "Campaign creature not found" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid creature profile" });
    }
  });

  app.delete("/api/campaigns/:id/homebrew-bestiary", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      await storage.clearCampaignHomebrew(id);
      res.json({ message: "Homebrew bestiary cleared" });
    } catch (err) {
      res.status(500).json({ message: "Failed to clear homebrew bestiary" });
    }
  });

  // ── Campaign Saved Encounters ─────────────────────────────────────────────

  app.get("/api/campaigns/:id/encounter", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      const saved = await storage.getSavedEncounter(id);
      if (!saved) return res.status(404).json({ message: "No saved encounter" });
      res.json({ data: saved.data, savedAt: saved.savedAt });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch saved encounter" });
    }
  });

  app.put("/api/campaigns/:id/encounter", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      await storage.saveEncounter(id, req.body);
      res.json({ message: "Encounter saved" });
    } catch (err) {
      res.status(500).json({ message: "Failed to save encounter" });
    }
  });

  app.delete("/api/campaigns/:id/encounter", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      await storage.clearSavedEncounter(id);
      res.json({ message: "Saved encounter cleared" });
    } catch (err) {
      res.status(500).json({ message: "Failed to clear saved encounter" });
    }
  });

  const preparedCombatant = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    initiative: z.number().finite(),
    hp: z.number().finite(),
    maxHp: z.number().finite(),
    combatantType: z.enum(["monster", "npc", "pc"]),
  }).passthrough();

  const preparedEncounterData = z.object({
    combatants: z.array(preparedCombatant).min(1).max(200),
    round: z.number().int().positive().default(1),
    activeIndex: z.number().int().nonnegative().default(0),
    combatState: z.enum(["setup", "active", "ended"]).default("setup"),
    selectedVersions: z.array(z.string()).default([]),
  }).passthrough();

  const preparedEncounterBody = z.object({
    name: z.string().trim().min(1).max(100),
    data: preparedEncounterData,
  });

  app.get("/api/campaigns/:id/prepared-encounters", async (req, res) => {
    const campaignId = Number(req.params.id);
    if (!Number.isInteger(campaignId)) return res.status(400).json({ message: "Invalid campaign id" });
    res.json(await storage.getPreparedEncounters(campaignId));
  });

  app.post("/api/campaigns/:id/prepared-encounters", async (req, res) => {
    const campaignId = Number(req.params.id);
    if (!Number.isInteger(campaignId)) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      const body = preparedEncounterBody.parse(req.body);
      const existing = await storage.getPreparedEncounters(campaignId);
      if (existing.some(encounter => encounter.name.toLowerCase() === body.name.toLowerCase())) {
        return res.status(409).json({ message: "An encounter with that name already exists" });
      }
      res.status(201).json(await storage.createPreparedEncounter(campaignId, body.name, body.data));
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        return res.status(409).json({ message: "An encounter with that name already exists" });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid prepared encounter" });
    }
  });

  app.put("/api/campaigns/:id/prepared-encounters/:encounterId", async (req, res) => {
    const campaignId = Number(req.params.id);
    const encounterId = Number(req.params.encounterId);
    if (!Number.isInteger(campaignId) || !Number.isInteger(encounterId)) {
      return res.status(400).json({ message: "Invalid encounter id" });
    }
    try {
      const body = z.object({
        name: z.string().trim().min(1).max(100).optional(),
        data: preparedEncounterData.optional(),
      }).refine(value => value.name !== undefined || value.data !== undefined, "No changes supplied").parse(req.body);
      if (body.name) {
        const existing = await storage.getPreparedEncounters(campaignId);
        if (existing.some(encounter => encounter.id !== encounterId && encounter.name.toLowerCase() === body.name!.toLowerCase())) {
          return res.status(409).json({ message: "An encounter with that name already exists" });
        }
      }
      const updated = await storage.updatePreparedEncounter(encounterId, campaignId, body);
      if (!updated) return res.status(404).json({ message: "Prepared encounter not found" });
      res.json(updated);
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") {
        return res.status(409).json({ message: "An encounter with that name already exists" });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid prepared encounter" });
    }
  });

  app.delete("/api/campaigns/:id/prepared-encounters/:encounterId", async (req, res) => {
    const campaignId = Number(req.params.id);
    const encounterId = Number(req.params.encounterId);
    if (!Number.isInteger(campaignId) || !Number.isInteger(encounterId)) {
      return res.status(400).json({ message: "Invalid encounter id" });
    }
    const deleted = await storage.deletePreparedEncounter(encounterId, campaignId);
    if (!deleted) return res.status(404).json({ message: "Prepared encounter not found" });
    res.json({ message: "Prepared encounter deleted" });
  });

  // ── Roll Tables ────────────────────────────────────────────────────────────

  app.get("/api/roll-tables", async (req, res) => {
    const campaignId = req.query.campaignId == null ? undefined : parseInt(String(req.query.campaignId));
    if (campaignId !== undefined && isNaN(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign id" });
    }
    try {
      const custom = campaignId === undefined ? [] : await storage.getRollTables(campaignId);
      res.json([...STOCK_ROLL_TABLES, ...custom]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch roll tables" });
    }
  });

  app.post("/api/roll-tables", async (req, res) => {
    try {
      const data = rollTableInputSchema.parse(req.body);
      const campaign = await storage.getCampaign(data.campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const table = await storage.createRollTable(data);
      res.status(201).json(table);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to create roll table" });
    }
  });

  app.put("/api/roll-tables/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid roll table id" });
    try {
      const data = rollTableInputSchema.parse(req.body);
      const campaign = await storage.getCampaign(data.campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const table = await storage.updateRollTable(id, data);
      if (!table) return res.status(404).json({ message: "Roll table not found" });
      res.json(table);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to update roll table" });
    }
  });

  app.delete("/api/roll-tables/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const campaignId = parseInt(String(req.query.campaignId ?? req.body?.campaignId));
    if (isNaN(id) || isNaN(campaignId)) {
      return res.status(400).json({ message: "A valid roll table and campaign id are required" });
    }
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const deleted = await storage.deleteRollTable(id, campaignId);
      if (!deleted) return res.status(404).json({ message: "Roll table not found" });
      res.json({ message: "Roll table deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete roll table" });
    }
  });

  app.get("/api/bestiary/monsters/:id", async (req, res) => {
    try {
      const detail = await storage.getBestiaryMonsterDetail(req.params.id);
      if (!detail) return res.status(404).json({ message: "Monster not found" });
      const base = mapMonsterRow(detail);
      const result = {
        ...base,
        traits: (detail.traits || []).map((t: any) => ({
          name: t.traitName || "",
          description: t.traitDescription || "",
          type: t.traitType || "passive",
        })),
        ...mapBestiaryActions(detail.actions || []),
        special_abilities: (detail.traits || [])
          .map((t: any) => ({ name: t.traitName || "", desc: t.traitDescription || "" })),
      };
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch monster detail" });
    }
  });

  return httpServer;
}
