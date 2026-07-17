import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertCampaignSchema, insertCampaignCharacterSchema, type InsertItem, type InsertHomebrewItem } from "@shared/schema";
import { seedLootTable } from "./seedLoot";

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
    return {
      index: m.monsterId,
      name: m.name,
      hp: m.printedAverageHp || 0,
      hit_dice: m.hitDiceCount && m.hitDieSize ? `${m.hitDiceCount}d${m.hitDieSize}` : undefined,
      hitDiceCount: m.hitDiceCount,
      hitDieSize: m.hitDieSize,
      ac: m.armorClass || 10,
      cr: "--",
      type: m.creatureType || "",
      size: m.size || "",
      str: m.strScore, dex: m.dexScore, con: m.conScore,
      int: m.intScore, wis: m.wisScore, cha: m.chaScore,
      strMod: m.strMod, dexMod: m.dexMod, conMod: m.conMod,
      intMod: m.intMod, wisMod: m.wisMod, chaMod: m.chaMod,
      alignment: m.alignment,
      creatureTags: m.creatureTags,
      source: m.sourceBook || m.sourceKey || "",
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

  app.get("/api/bestiary/monsters", async (req, res) => {
    try {
      const search = (req.query.search as string) || "";
      const typesParam = (req.query.types as string) || "";
      const types = typesParam ? typesParam.split(",").filter(Boolean) : [];
      const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
      const rows = await storage.searchBestiary(search, types, limit);
      res.json(rows.map(mapMonsterRow));
    } catch (err) {
      res.status(500).json({ message: "Failed to search bestiary" });
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
        detailedActions: (detail.actions || []).map((a: any) => ({
          name: a.actionName || "",
          description: a.actionDescription || "",
          category: a.actionCategory || "action",
          attackBonus: a.attackBonus ?? undefined,
          reachFt: a.reachFt ?? undefined,
          saveAbility: a.saveAbility ?? undefined,
          saveDc: a.saveDc ?? undefined,
          damageDice: a.damageDice ?? undefined,
          damageType: a.damageType ?? undefined,
        })),
        special_abilities: (detail.traits || [])
          .map((t: any) => ({ name: t.traitName || "", desc: t.traitDescription || "" })),
        actions: (detail.actions || [])
          .filter((a: any) => a.actionCategory === "action" || a.actionCategory === "standard")
          .map((a: any) => ({ name: a.actionName || "", desc: a.actionDescription || "", attack_bonus: a.attackBonus })),
      };
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch monster detail" });
    }
  });

  return httpServer;
}
