import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertCampaignSchema, insertCampaignCharacterSchema, type InsertItem } from "@shared/schema";
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

  app.post("/api/import/5e", async (req, res) => {
    try {
      const csvText = await readBody(req);
      const items = parseCSV(csvText);
      await storage.createItems5e(items);
      res.json({ message: `Imported ${items.length} items into 5e compendium`, count: items.length });
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Error parsing CSV" });
    }
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

  app.get("/api/monsters", async (req, res) => {
    try {
      const versions = (req.query.versions as string)?.split(",") || ["5e"];
      const monsters: any[] = [];

      if (versions.includes("5e") || versions.includes("onednd")) {
        const response = await fetch("https://www.dnd5eapi.co/api/monsters");
        if (response.ok) {
          const data = await response.json() as { results: Array<{ index: string; name: string; url: string }> };
          const promises = data.results.map(async (m) => {
            try {
              const detailRes = await fetch(`https://www.dnd5eapi.co${m.url}`);
              if (detailRes.ok) {
                const detail = await detailRes.json() as any;
                return {
                  index: m.index,
                  name: m.name,
                  hp: detail.hit_points || 0,
                  hit_dice: detail.hit_dice || "",
                  ac: detail.armor_class?.[0]?.value || 10,
                  cr: detail.challenge_rating?.toString() || "0",
                  type: detail.type || "unknown",
                  size: detail.size || "Medium",
                  speed: detail.speed || {},
                  str: detail.strength || 10,
                  dex: detail.dexterity || 10,
                  con: detail.constitution || 10,
                  int: detail.intelligence || 10,
                  wis: detail.wisdom || 10,
                  cha: detail.charisma || 10,
                  resistances: detail.damage_resistances || [],
                  immunities: detail.damage_immunities || [],
                  vulnerabilities: detail.damage_vulnerabilities || [],
                  actions: (detail.actions || []).map((a: any) => ({
                    name: a.name, desc: a.desc, attack_bonus: a.attack_bonus,
                    damage: a.damage?.map((d: any) => ({ damage_dice: d.damage_dice, damage_type: d.damage_type?.name })) || [],
                  })),
                  special_abilities: (detail.special_abilities || []).map((a: any) => ({ name: a.name, desc: a.desc })),
                  source: "SRD",
                };
              }
            } catch { return null; }
          });
          const results = await Promise.all(promises);
          monsters.push(...results.filter(Boolean));
        }
      }
      res.json(monsters);
    } catch (err) {
      console.error("Error fetching monsters:", err);
      res.status(500).json({ message: "Failed to fetch monsters" });
    }
  });

  return httpServer;
}
