import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertItemSchema } from "@shared/schema";

const seedData = [
  // Weapons
  { name: "Dagger", category: "Weapons", rarity: "Common", description: "A simple blade.", version: "5e", attunement: "", meta: "1d4 piercing, finesse, light" },
  { name: "Longsword", category: "Weapons", rarity: "Common", description: "A versatile blade.", version: "5e", attunement: "", meta: "1d8 slashing (1d10 versatile)" },
  { name: "Shortbow", category: "Weapons", rarity: "Common", description: "A small bow.", version: "5e", attunement: "", meta: "1d6 piercing, range 80/320" },
  { name: "Greataxe", category: "Weapons", rarity: "Common", description: "A massive axe.", version: "5e", attunement: "", meta: "1d12 slashing, heavy, two-handed" },
  { name: "Flame Tongue", category: "Weapons", rarity: "Rare", description: "Bursting with flame.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Holy Avenger", category: "Weapons", rarity: "Legendary", description: "A powerful paladin weapon.", version: "5e", attunement: "Requires Attunement by Paladin", meta: "" },
  { name: "Vorpal Sword", category: "Weapons", rarity: "Legendary", description: "Decapitates on a crit.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Sun Blade", category: "Weapons", rarity: "Rare", description: "A blade of pure light.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Javelin of Lightning", category: "Weapons", rarity: "Uncommon", description: "Transforms into a bolt of lightning.", version: "5e", attunement: "", meta: "" },
  
  // Armor
  { name: "Leather Armor", category: "Armor", rarity: "Common", description: "Basic light armor.", version: "5e", attunement: "", meta: "AC 11 + Dex" },
  { name: "Chain Mail", category: "Armor", rarity: "Common", description: "Heavy metal rings.", version: "5e", attunement: "", meta: "AC 16, Str 13, Stealth Disadv" },
  { name: "Plate Armor", category: "Armor", rarity: "Common", description: "Full plate protection.", version: "5e", attunement: "", meta: "AC 18, Str 15, Stealth Disadv" },
  { name: "Shield", category: "Armor", rarity: "Common", description: "A standard shield.", version: "5e", attunement: "", meta: "+2 AC" },
  { name: "Adamantine Armor", category: "Armor", rarity: "Uncommon", description: "Immune to critical hits.", version: "5e", attunement: "", meta: "Medium or Heavy" },
  { name: "Mithral Armor", category: "Armor", rarity: "Uncommon", description: "Light and stealthy.", version: "5e", attunement: "", meta: "No Stealth Disadv" },
  { name: "Armor of Invulnerability", category: "Armor", rarity: "Legendary", description: "Immune to non-magical damage.", version: "5e", attunement: "Requires Attunement", meta: "" },
  
  // Potions
  { name: "Potion of Healing", category: "Potions", rarity: "Common", description: "Restores 2d4+2 HP.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Potion of Greater Healing", category: "Potions", rarity: "Uncommon", description: "Restores 4d4+4 HP.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Potion of Invisibility", category: "Potions", rarity: "Very Rare", description: "Become invisible for 1 hour.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Potion of Speed", category: "Potions", rarity: "Very Rare", description: "Gain the Haste effect.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Elixir of Health", category: "Potions", rarity: "Rare", description: "Cures diseases and conditions.", version: "5e", attunement: "", meta: "Consumable" },

  // Rings
  { name: "Ring of Protection", category: "Rings", rarity: "Rare", description: "Bonus to AC and Saves.", version: "5e", attunement: "Requires Attunement", meta: "+1 AC/Saves" },
  { name: "Ring of Invisibility", category: "Rings", rarity: "Legendary", description: "Turn invisible at will.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Ring of Water Walking", category: "Rings", rarity: "Uncommon", description: "Walk on liquid surfaces.", version: "5e", attunement: "", meta: "" },
  { name: "Ring of Regeneration", category: "Rings", rarity: "Very Rare", description: "Regenerate HP slowly.", version: "5e", attunement: "Requires Attunement", meta: "" },

  // Wondrous
  { name: "Bag of Holding", category: "Wondrous", rarity: "Uncommon", description: "Larger on the inside.", version: "5e", attunement: "", meta: "Holds 500 lbs" },
  { name: "Cloak of Elvenkind", category: "Wondrous", rarity: "Uncommon", description: "Grants advantage on stealth.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Winged Boots", category: "Wondrous", rarity: "Uncommon", description: "Fly speed equal to walking speed.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Apparatus of Kwalish", category: "Wondrous", rarity: "Legendary", description: "A mechanical crab vehicle.", version: "5e", attunement: "", meta: "" },

  // Rods
  { name: "Rod of the Pact Keeper +1", category: "Rods", rarity: "Uncommon", description: "Bonus to Warlock spells.", version: "5e", attunement: "Requires Attunement by Warlock", meta: "" },
  { name: "Rod of Lordly Might", category: "Rods", rarity: "Legendary", description: "Multi-function tool and weapon.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Immovable Rod", category: "Rods", rarity: "Uncommon", description: "Stays fixed in space.", version: "5e", attunement: "", meta: "" },

  // Scrolls
  { name: "Spell Scroll (Cantrip)", category: "Scrolls", rarity: "Common", description: "Cast a cantrip once.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Spell Scroll (1st Level)", category: "Scrolls", rarity: "Common", description: "Cast a 1st level spell once.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Scroll of Protection", category: "Scrolls", rarity: "Rare", description: "Protection from creature types.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Scroll of Tarrasque Summoning", category: "Scrolls", rarity: "Legendary", description: "Do not read this.", version: "5e", attunement: "", meta: "Consumable (Hopefully)" },

  // Staves
  { name: "Staff of Power", category: "Staves", rarity: "Very Rare", description: "Immense magical power.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Staff of the Magi", category: "Staves", rarity: "Legendary", description: "The ultimate spellcaster staff.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Staff of Healing", category: "Staves", rarity: "Rare", description: "Heals wounds.", version: "5e", attunement: "Requires Attunement by Bard, Cleric, Druid", meta: "" },
  { name: "Staff of the Python", category: "Staves", rarity: "Uncommon", description: "Becomes a giant snake.", version: "5e", attunement: "Requires Attunement by Cleric, Druid, Warlock", meta: "" },

  // Wands
  { name: "Wand of Magic Missiles", category: "Wands", rarity: "Uncommon", description: "Casts Magic Missile.", version: "5e", attunement: "", meta: "" },
  { name: "Wand of Fireballs", category: "Wands", rarity: "Rare", description: "Casts Fireball.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Wand of Wonder", category: "Wands", rarity: "Rare", description: "Unpredictable magical effects.", version: "5e", attunement: "Requires Attunement", meta: "" },

  // Magical (General catch-all or specific items not in other cats)
  { name: "Bead of Force", category: "Magical", rarity: "Rare", description: "Explodes in a sphere of force.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Dust of Disappearance", category: "Magical", rarity: "Uncommon", description: "Invisibility dust.", version: "5e", attunement: "", meta: "Consumable" }
];

interface DnD5eEquipment {
  index: string;
  name: string;
  equipment_category?: {
    name: string;
  };
}

interface DnD5eMagicItem {
  index: string;
  name: string;
  rarity?: {
    name: string;
  };
}

// Map D&D 5e API equipment to our schema
function mapEquipmentToItem(equipment: DnD5eEquipment) {
  const categoryMap: Record<string, string> = {
    "adventuring-gear": "Wondrous",
    "armor": "Armor",
    "weapon": "Weapons",
    "melee-weapons": "Weapons",
    "ranged-weapons": "Weapons",
    "ammunition": "Weapons",
  };

  const category = equipment.equipment_category?.name || "Wondrous";
  const mappedCategory = categoryMap[category.toLowerCase().replace(/ /g, "-")] || "Wondrous";

  return {
    name: equipment.name,
    category: mappedCategory,
    rarity: "Common",
    version: "5e",
    description: `SRD equipment item: ${equipment.name}`,
    attunement: "",
    meta: "From D&D 5e SRD",
  };
}

// Map magic items to our schema
function mapMagicItemToItem(item: DnD5eMagicItem) {
  const rarityMap: Record<string, string> = {
    "common": "Common",
    "uncommon": "Uncommon",
    "rare": "Rare",
    "very rare": "Very Rare",
    "legendary": "Legendary",
    "artifact": "Legendary",
  };

  const rarity = item.rarity?.name || "Common";
  const mappedRarity = rarityMap[rarity.toLowerCase()] || "Common";

  return {
    name: item.name,
    category: "Magical",
    rarity: mappedRarity,
    version: "5e",
    description: `SRD magic item: ${item.name}`,
    attunement: "",
    meta: "From D&D 5e SRD",
  };
}

// Fetch and sync items from D&D 5e API
async function syncItemsFromApi() {
  try {
    console.log("Syncing items from D&D 5e API...");
    
    const equipmentRes = await fetch("https://www.dnd5eapi.co/api/equipment");
    const equipmentData = await equipmentRes.json();
    
    const magicItemsRes = await fetch("https://www.dnd5eapi.co/api/magic-items");
    const magicItemsData = await magicItemsRes.json();
    
    const allItems = [];
    
    // Map equipment
    if (equipmentData.results) {
      for (const equipment of equipmentData.results) {
        allItems.push(mapEquipmentToItem(equipment));
      }
    }
    
    // Map magic items
    if (magicItemsData.results) {
      for (const item of magicItemsData.results) {
        allItems.push(mapMagicItemToItem(item));
      }
    }
    
    if (allItems.length > 0) {
      // Clear existing items and insert new ones
      await storage.clearItems();
      await storage.createItems(allItems);
      console.log(`Successfully synced ${allItems.length} items from D&D 5e API`);
    }
    
  } catch (error) {
    console.error("Error syncing items from D&D 5e API:", error);
  }
}

// Parse CSV and validate
function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) throw new Error("CSV must have at least a header row and one data row");
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const requiredHeaders = ['item name', 'item description', 'category', 'rarity', 'version', 'attunement'];
  
  // Check that all required headers are present
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(`Missing required CSV header: ${required}`);
    }
  }
  
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.some(v => !v)) continue; // Skip empty rows
    
    const itemNameIdx = headers.indexOf('item name');
    const descIdx = headers.indexOf('item description');
    const catIdx = headers.indexOf('category');
    const rarityIdx = headers.indexOf('rarity');
    const versionIdx = headers.indexOf('version');
    const attunementIdx = headers.indexOf('attunement');
    
    items.push({
      name: values[itemNameIdx],
      description: values[descIdx],
      category: values[catIdx],
      rarity: values[rarityIdx],
      version: values[versionIdx],
      attunement: values[attunementIdx] || "",
      meta: "",
    });
  }
  
  return items;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Sync on startup
  await syncItemsFromApi();

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

  app.get(api.items.list.path, async (req, res) => {
      const items = await storage.getItems();
      res.json(items);
  });

  // Manual sync endpoint
  app.post("/api/sync-items", async (req, res) => {
    await syncItemsFromApi();
    res.json({ message: "Items synced successfully" });
  });

  // CSV upload endpoint
  app.post("/api/import-homebrew", async (req, res) => {
    try {
      let csvText = '';
      
      // Collect data from request body or stream
      req.setEncoding('utf8');
      req.on('data', chunk => {
        csvText += chunk;
      });
      
      req.on('end', async () => {
        try {
          const parsedItems = parseCSV(csvText);
          const itemsToInsert = parsedItems.map(item => ({
            name: item.name,
            category: item.category,
            rarity: item.rarity,
            description: item.description,
            version: item.version,
            attunement: item.attunement || "",
            meta: "",
          }));
          
          await storage.createItems(itemsToInsert);
          res.json({ 
            message: `Successfully imported ${itemsToInsert.length} homebrew items`,
            count: itemsToInsert.length
          });
        } catch (err) {
          res.status(400).json({ 
            message: err instanceof Error ? err.message : "Error parsing CSV" 
          });
        }
      });
    } catch (err) {
      res.status(400).json({ 
        message: err instanceof Error ? err.message : "Error processing upload" 
      });
    }
  });

  return httpServer;
}
