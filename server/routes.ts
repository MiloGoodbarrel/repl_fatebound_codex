import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

function parseCSV(csvText: string) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const requiredHeaders = ['name', 'description', 'category', 'rarity', 'version'];

  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(`Missing required CSV header: "${required}". Required headers: ${requiredHeaders.join(', ')}`);
    }
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted CSV values
    const values: string[] = [];
    let inQuote = false;
    let current = '';
    for (const char of line) {
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const get = (col: string) => values[headers.indexOf(col)]?.trim() || '';

    const name = get('name');
    if (!name) continue;

    items.push({
      name,
      description: get('description'),
      category: get('category') || 'Magical',
      rarity: get('rarity') || 'Common',
      version: get('version') || '5e',
      attunement: get('attunement') || '',
      meta: get('meta') || '',
    });
  }

  return items;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Draw random items matching criteria
  app.post(api.items.draw.path, async (req, res) => {
    try {
      const input = api.items.draw.input.parse(req.body);
      const items = await storage.drawItems(input);
      res.json(items);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // List all items
  app.get(api.items.list.path, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });

  // Clear all items
  app.delete("/api/items", async (req, res) => {
    try {
      await storage.clearItems();
      res.json({ message: "All items cleared" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to clear items" });
    }
  });

  // Import items from CSV
  app.post("/api/import-csv", async (req, res) => {
    try {
      let csvText = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { csvText += chunk; });
      req.on('end', async () => {
        try {
          const parsedItems = parseCSV(csvText);
          await storage.createItems(parsedItems);
          res.json({
            message: `Successfully imported ${parsedItems.length} items`,
            count: parsedItems.length,
          });
        } catch (err) {
          res.status(400).json({
            message: err instanceof Error ? err.message : "Error parsing CSV",
          });
        }
      });
    } catch (err) {
      res.status(400).json({
        message: err instanceof Error ? err.message : "Error processing upload",
      });
    }
  });

  // Monster bestiary — fetches live from dnd5eapi.co for the Initiative Tracker
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
                    name: a.name,
                    desc: a.desc,
                    attack_bonus: a.attack_bonus,
                    damage: a.damage?.map((d: any) => ({
                      damage_dice: d.damage_dice,
                      damage_type: d.damage_type?.name,
                    })) || [],
                  })),
                  special_abilities: (detail.special_abilities || []).map((a: any) => ({
                    name: a.name,
                    desc: a.desc,
                  })),
                  source: "SRD",
                };
              }
            } catch {
              return null;
            }
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
