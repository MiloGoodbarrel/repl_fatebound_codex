import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertItemSchema } from "@shared/schema";

const seedData = [
  // 5e - Weapons
  { name: "Dagger", category: "Weapons", rarity: "Common", description: "A simple blade.", version: "5e", attunement: "", meta: "1d4 piercing, finesse, light" },
  { name: "Longsword", category: "Weapons", rarity: "Common", description: "A versatile blade.", version: "5e", attunement: "", meta: "1d8 slashing (1d10 versatile)" },
  { name: "Shortbow", category: "Weapons", rarity: "Common", description: "A small bow.", version: "5e", attunement: "", meta: "1d6 piercing, range 80/320" },
  { name: "Greataxe", category: "Weapons", rarity: "Common", description: "A massive axe.", version: "5e", attunement: "", meta: "1d12 slashing, heavy, two-handed" },
  { name: "Flame Tongue", category: "Weapons", rarity: "Rare", description: "Bursting with flame.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Holy Avenger", category: "Weapons", rarity: "Legendary", description: "A powerful paladin weapon.", version: "5e", attunement: "Requires Attunement by Paladin", meta: "" },
  { name: "Vorpal Sword", category: "Weapons", rarity: "Legendary", description: "Decapitates on a crit.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Sun Blade", category: "Weapons", rarity: "Rare", description: "A blade of pure light.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Javelin of Lightning", category: "Weapons", rarity: "Uncommon", description: "Transforms into a bolt of lightning.", version: "5e", attunement: "", meta: "" },
  
  // 5e - Armor
  { name: "Leather Armor", category: "Armor", rarity: "Common", description: "Basic light armor.", version: "5e", attunement: "", meta: "AC 11 + Dex" },
  { name: "Chain Mail", category: "Armor", rarity: "Common", description: "Heavy metal rings.", version: "5e", attunement: "", meta: "AC 16, Str 13, Stealth Disadv" },
  { name: "Plate Armor", category: "Armor", rarity: "Common", description: "Full plate protection.", version: "5e", attunement: "", meta: "AC 18, Str 15, Stealth Disadv" },
  { name: "Shield", category: "Armor", rarity: "Common", description: "A standard shield.", version: "5e", attunement: "", meta: "+2 AC" },
  { name: "Adamantine Armor", category: "Armor", rarity: "Uncommon", description: "Immune to critical hits.", version: "5e", attunement: "", meta: "Medium or Heavy" },
  { name: "Mithral Armor", category: "Armor", rarity: "Uncommon", description: "Light and stealthy.", version: "5e", attunement: "", meta: "No Stealth Disadv" },
  { name: "Armor of Invulnerability", category: "Armor", rarity: "Legendary", description: "Immune to non-magical damage.", version: "5e", attunement: "Requires Attunement", meta: "" },
  
  // 5e - Potions
  { name: "Potion of Healing", category: "Potions", rarity: "Common", description: "Restores 2d4+2 HP.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Potion of Greater Healing", category: "Potions", rarity: "Uncommon", description: "Restores 4d4+4 HP.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Potion of Invisibility", category: "Potions", rarity: "Very Rare", description: "Become invisible for 1 hour.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Potion of Speed", category: "Potions", rarity: "Very Rare", description: "Gain the Haste effect.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Elixir of Health", category: "Potions", rarity: "Rare", description: "Cures diseases and conditions.", version: "5e", attunement: "", meta: "Consumable" },

  // 5e - Rings
  { name: "Ring of Protection", category: "Rings", rarity: "Rare", description: "Bonus to AC and Saves.", version: "5e", attunement: "Requires Attunement", meta: "+1 AC/Saves" },
  { name: "Ring of Invisibility", category: "Rings", rarity: "Legendary", description: "Turn invisible at will.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Ring of Water Walking", category: "Rings", rarity: "Uncommon", description: "Walk on liquid surfaces.", version: "5e", attunement: "", meta: "" },
  { name: "Ring of Regeneration", category: "Rings", rarity: "Very Rare", description: "Regenerate HP slowly.", version: "5e", attunement: "Requires Attunement", meta: "" },

  // 5e - Wondrous Items
  { name: "Bag of Holding", category: "Wondrous Items", rarity: "Uncommon", description: "Larger on the inside.", version: "5e", attunement: "", meta: "Holds 500 lbs" },
  { name: "Cloak of Elvenkind", category: "Wondrous Items", rarity: "Uncommon", description: "Grants advantage on stealth.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Winged Boots", category: "Wondrous Items", rarity: "Uncommon", description: "Fly speed equal to walking speed.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Apparatus of Kwalish", category: "Wondrous Items", rarity: "Legendary", description: "A mechanical crab vehicle.", version: "5e", attunement: "", meta: "" },

  // 5e - Rods
  { name: "Rod of the Pact Keeper +1", category: "Rods", rarity: "Uncommon", description: "Bonus to Warlock spells.", version: "5e", attunement: "Requires Attunement by Warlock", meta: "" },
  { name: "Rod of Lordly Might", category: "Rods", rarity: "Legendary", description: "Multi-function tool and weapon.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Immovable Rod", category: "Rods", rarity: "Uncommon", description: "Stays fixed in space.", version: "5e", attunement: "", meta: "" },

  // 5e - Scrolls
  { name: "Spell Scroll (Cantrip)", category: "Scrolls", rarity: "Common", description: "Cast a cantrip once.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Spell Scroll (1st Level)", category: "Scrolls", rarity: "Common", description: "Cast a 1st level spell once.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Scroll of Protection", category: "Scrolls", rarity: "Rare", description: "Protection from creature types.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Scroll of Tarrasque Summoning", category: "Scrolls", rarity: "Legendary", description: "Do not read this.", version: "5e", attunement: "", meta: "Consumable (Hopefully)" },

  // 5e - Staves
  { name: "Staff of Power", category: "Staves", rarity: "Very Rare", description: "Immense magical power.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Staff of the Magi", category: "Staves", rarity: "Legendary", description: "The ultimate spellcaster staff.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Staff of Healing", category: "Staves", rarity: "Rare", description: "Heals wounds.", version: "5e", attunement: "Requires Attunement by Bard, Cleric, Druid", meta: "" },
  { name: "Staff of the Python", category: "Staves", rarity: "Uncommon", description: "Becomes a giant snake.", version: "5e", attunement: "Requires Attunement by Cleric, Druid, Warlock", meta: "" },

  // 5e - Wands
  { name: "Wand of Magic Missiles", category: "Wands", rarity: "Uncommon", description: "Casts Magic Missile.", version: "5e", attunement: "", meta: "" },
  { name: "Wand of Fireballs", category: "Wands", rarity: "Rare", description: "Casts Fireball.", version: "5e", attunement: "Requires Attunement", meta: "" },
  { name: "Wand of Wonder", category: "Wands", rarity: "Rare", description: "Unpredictable magical effects.", version: "5e", attunement: "Requires Attunement", meta: "" },

  // 5e - Magical
  { name: "Bead of Force", category: "Magical", rarity: "Rare", description: "Explodes in a sphere of force.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Dust of Disappearance", category: "Magical", rarity: "Uncommon", description: "Invisibility dust.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Alchemy Jug", category: "Magical", rarity: "Uncommon", description: "Produces magical liquids.", version: "5e", attunement: "", meta: "" },
  { name: "Decanter of Endless Water", category: "Magical", rarity: "Uncommon", description: "Produces water endlessly.", version: "5e", attunement: "", meta: "" },
  { name: "Eversmoking Bottle", category: "Magical", rarity: "Uncommon", description: "Creates perpetual smoke.", version: "5e", attunement: "", meta: "" },
  { name: "Necklace of Fireballs", category: "Magical", rarity: "Rare", description: "Launches fireballs.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Dust of Sneezing and Choking", category: "Magical", rarity: "Uncommon", description: "Causes sneezing fits.", version: "5e", attunement: "", meta: "Consumable" },
  { name: "Crystal Ball", category: "Magical", rarity: "Very Rare", description: "Scrying device.", version: "5e", attunement: "Requires Attunement", meta: "" },
  
  // 3rd Edition items
  { name: "Iron Bands of Bilarro", category: "Wondrous Items", rarity: "Uncommon", description: "Magical bindings from 3e.", version: "3rd Edition", attunement: "", meta: "3e Classic" },
  { name: "Amulet of Health", category: "Wondrous Items", rarity: "Rare", description: "Boosts constitution.", version: "3rd Edition", attunement: "Requires Attunement", meta: "3e Classic" },
  { name: "Cloak of Charisma", category: "Armor", rarity: "Very Rare", description: "Enhances personal magnetism.", version: "3rd Edition", attunement: "Requires Attunement", meta: "3e Classic" },
  { name: "Boots of Speed", category: "Armor", rarity: "Uncommon", description: "Travel faster.", version: "3rd Edition", attunement: "Requires Attunement", meta: "3e Classic" },
  
  // 4th Edition items
  { name: "Flaming Longsword +1", category: "Weapons", rarity: "Rare", description: "Infused with fire.", version: "4th Edition", attunement: "", meta: "4e Magic Item" },
  { name: "Cloak of Protection +1", category: "Armor", rarity: "Uncommon", description: "Enhances defense.", version: "4th Edition", attunement: "", meta: "4e Magic Item" },
  { name: "Potion of Healing", category: "Potions", rarity: "Common", description: "Restores health.", version: "4th Edition", attunement: "", meta: "4e Consumable" },
  
  // AD&D items
  { name: "Holy Avenger Sword", category: "Weapons", rarity: "Very Rare", description: "Ancient paladin weapon.", version: "AD&D", attunement: "", meta: "AD&D Artifact" },
  { name: "Bag of Holding", category: "Wondrous Items", rarity: "Rare", description: "Extradimensional storage.", version: "AD&D", attunement: "", meta: "AD&D Wondrous" },
  
  // OD&D items
  { name: "Wand of Wonder", category: "Wands", rarity: "Rare", description: "Original D&D wand.", version: "OD&D", attunement: "", meta: "OD&D Classic" },
  { name: "Ring of Invisibility", category: "Rings", rarity: "Very Rare", description: "Ancient invisibility ring.", version: "OD&D", attunement: "", meta: "OD&D Classic" },
  
  // One D&D items
  { name: "Blade of Broken Bonds", category: "Weapons", rarity: "Uncommon", description: "One D&D era weapon.", version: "One D&D", attunement: "Requires Attunement", meta: "One D&D" },
  { name: "Cloak of the Manta Ray", category: "Armor", rarity: "Uncommon", description: "Allows water travel.", version: "One D&D", attunement: "", meta: "One D&D" },
  { name: "Scroll of Fireball", category: "Scrolls", rarity: "Uncommon", description: "Ancient spell knowledge.", version: "One D&D", attunement: "", meta: "One D&D" }
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

// Map magic items to our schema with better categorization
function mapMagicItemToItem(item: DnD5eMagicItem) {
  const rarityMap: Record<string, string> = {
    "common": "Common",
    "uncommon": "Uncommon",
    "rare": "Rare",
    "very rare": "Very Rare",
    "legendary": "Legendary",
    "artifact": "Legendary",
  };

  // Categorize based on item name patterns
  let category = "Wondrous Items";
  const name = item.name.toLowerCase();

  if (name.includes("weapon") || name.includes("sword") || name.includes("axe") || 
      name.includes("bow") || name.includes("mace") || name.includes("staff") ||
      name.includes("wand") || name.includes("blade") || name.includes("hammer")) {
    category = "Weapons";
  } else if (name.includes("armor") || name.includes("mail") || name.includes("plate") ||
             name.includes("leather") || name.includes("cloak") || name.includes("robe") ||
             name.includes("boots") || name.includes("gloves") || name.includes("helm")) {
    category = "Armor";
  } else if (name.includes("ring")) {
    category = "Rings";
  } else if (name.includes("scroll")) {
    category = "Scrolls";
  } else if (name.includes("potion")) {
    category = "Potions";
  } else if (name.includes("rod")) {
    category = "Rods";
  } else if (name.includes("staff")) {
    category = "Staves";
  } else if (name.includes("wand")) {
    category = "Wands";
  }

  const rarity = item.rarity?.name || "Common";
  const mappedRarity = rarityMap[rarity.toLowerCase()] || "Common";

  return {
    name: item.name,
    category,
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
    console.log("Syncing items from D&D 5e API and seed data...");
    await storage.clearItems();
    
    // First, add all seed data
    await storage.createItems(seedData);
    console.log(`Added ${seedData.length} seed items`);
    
    // Then try to fetch additional items from API
    try {
      const magicItemsRes = await fetch("https://www.dnd5eapi.co/api/2014/magic-items");
      const magicItemsData = await magicItemsRes.json();
      
      const apiItems = [];
      if (magicItemsData.results && Array.isArray(magicItemsData.results)) {
        for (const item of magicItemsData.results) {
          apiItems.push(mapMagicItemToItem(item));
        }
      }
      
      if (apiItems.length > 0) {
        await storage.createItems(apiItems);
        console.log(`Added ${apiItems.length} items from D&D 5e API`);
      }
    } catch (apiError) {
      console.warn("Could not sync from D&D 5e API, using seed data only:", apiError);
    }
    
    const totalItems = await storage.getItems();
    console.log(`Total items in database: ${totalItems.length}`);
    
  } catch (error) {
    console.error("Error syncing items:", error);
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
