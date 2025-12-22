import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertItemSchema } from "@shared/schema";

const seedData = [
  // Weapons
  { name: "Dagger", category: "Weapons", rarity: "Common", description: "A simple blade.", meta: "1d4 piercing, finesse, light" },
  { name: "Longsword", category: "Weapons", rarity: "Common", description: "A versatile blade.", meta: "1d8 slashing (1d10 versatile)" },
  { name: "Shortbow", category: "Weapons", rarity: "Common", description: "A small bow.", meta: "1d6 piercing, range 80/320" },
  { name: "Greataxe", category: "Weapons", rarity: "Common", description: "A massive axe.", meta: "1d12 slashing, heavy, two-handed" },
  { name: "Flame Tongue", category: "Weapons", rarity: "Rare", description: "Bursting with flame.", meta: "Requires Attunement" },
  { name: "Holy Avenger", category: "Weapons", rarity: "Legendary", description: "A powerful paladin weapon.", meta: "Requires Attunement by Paladin" },
  { name: "Vorpal Sword", category: "Weapons", rarity: "Legendary", description: "Decapitates on a crit.", meta: "Requires Attunement" },
  { name: "Sun Blade", category: "Weapons", rarity: "Rare", description: "A blade of pure light.", meta: "Requires Attunement" },
  { name: "Javelin of Lightning", category: "Weapons", rarity: "Uncommon", description: "Transforms into a bolt of lightning.", meta: "" },
  
  // Armor
  { name: "Leather Armor", category: "Armor", rarity: "Common", description: "Basic light armor.", meta: "AC 11 + Dex" },
  { name: "Chain Mail", category: "Armor", rarity: "Common", description: "Heavy metal rings.", meta: "AC 16, Str 13, Stealth Disadv" },
  { name: "Plate Armor", category: "Armor", rarity: "Common", description: "Full plate protection.", meta: "AC 18, Str 15, Stealth Disadv" },
  { name: "Shield", category: "Armor", rarity: "Common", description: "A standard shield.", meta: "+2 AC" },
  { name: "Adamantine Armor", category: "Armor", rarity: "Uncommon", description: "Immune to critical hits.", meta: "Medium or Heavy" },
  { name: "Mithral Armor", category: "Armor", rarity: "Uncommon", description: "Light and stealthy.", meta: "No Stealth Disadv" },
  { name: "Armor of Invulnerability", category: "Armor", rarity: "Legendary", description: "Immune to non-magical damage.", meta: "Requires Attunement" },
  
  // Potions
  { name: "Potion of Healing", category: "Potions", rarity: "Common", description: "Restores 2d4+2 HP.", meta: "Consumable" },
  { name: "Potion of Greater Healing", category: "Potions", rarity: "Uncommon", description: "Restores 4d4+4 HP.", meta: "Consumable" },
  { name: "Potion of Invisibility", category: "Potions", rarity: "Very Rare", description: "Become invisible for 1 hour.", meta: "Consumable" },
  { name: "Potion of Speed", category: "Potions", rarity: "Very Rare", description: "Gain the Haste effect.", meta: "Consumable" },
  { name: "Elixir of Health", category: "Potions", rarity: "Rare", description: "Cures diseases and conditions.", meta: "Consumable" },

  // Rings
  { name: "Ring of Protection", category: "Rings", rarity: "Rare", description: "Bonus to AC and Saves.", meta: "+1 AC/Saves, Attunement" },
  { name: "Ring of Invisibility", category: "Rings", rarity: "Legendary", description: "Turn invisible at will.", meta: "Requires Attunement" },
  { name: "Ring of Water Walking", category: "Rings", rarity: "Uncommon", description: "Walk on liquid surfaces.", meta: "" },
  { name: "Ring of Regeneration", category: "Rings", rarity: "Very Rare", description: "Regenerate HP slowly.", meta: "Requires Attunement" },

  // Wondrous
  { name: "Bag of Holding", category: "Wondrous", rarity: "Uncommon", description: "Larger on the inside.", meta: "Holds 500 lbs" },
  { name: "Cloak of Elvenkind", category: "Wondrous", rarity: "Uncommon", description: "Grants advantage on stealth.", meta: "Requires Attunement" },
  { name: "Winged Boots", category: "Wondrous", rarity: "Uncommon", description: "Fly speed equal to walking speed.", meta: "Requires Attunement" },
  { name: "Apparatus of Kwalish", category: "Wondrous", rarity: "Legendary", description: "A mechanical crab vehicle.", meta: "" },

  // Rods
  { name: "Rod of the Pact Keeper +1", category: "Rods", rarity: "Uncommon", description: "Bonus to Warlock spells.", meta: "Requires Attunement by Warlock" },
  { name: "Rod of Lordly Might", category: "Rods", rarity: "Legendary", description: "Multi-function tool and weapon.", meta: "Requires Attunement" },
  { name: "Immovable Rod", category: "Rods", rarity: "Uncommon", description: "Stays fixed in space.", meta: "" },

  // Scrolls
  { name: "Spell Scroll (Cantrip)", category: "Scrolls", rarity: "Common", description: "Cast a cantrip once.", meta: "Consumable" },
  { name: "Spell Scroll (1st Level)", category: "Scrolls", rarity: "Common", description: "Cast a 1st level spell once.", meta: "Consumable" },
  { name: "Scroll of Protection", category: "Scrolls", rarity: "Rare", description: "Protection from creature types.", meta: "Consumable" },
  { name: "Scroll of Tarrasque Summoning", category: "Scrolls", rarity: "Legendary", description: "Do not read this.", meta: "Consumable (Hopefully)" },

  // Staves
  { name: "Staff of Power", category: "Staves", rarity: "Very Rare", description: "Immense magical power.", meta: "Requires Attunement" },
  { name: "Staff of the Magi", category: "Staves", rarity: "Legendary", description: "The ultimate spellcaster staff.", meta: "Requires Attunement" },
  { name: "Staff of Healing", category: "Staves", rarity: "Rare", description: "Heals wounds.", meta: "Requires Attunement by Bard, Cleric, Druid" },
  { name: "Staff of the Python", category: "Staves", rarity: "Uncommon", description: "Becomes a giant snake.", meta: "Requires Attunement by Cleric, Druid, Warlock" },

  // Wands
  { name: "Wand of Magic Missiles", category: "Wands", rarity: "Uncommon", description: "Casts Magic Missile.", meta: "" },
  { name: "Wand of Fireballs", category: "Wands", rarity: "Rare", description: "Casts Fireball.", meta: "Requires Attunement" },
  { name: "Wand of Wonder", category: "Wands", rarity: "Rare", description: "Unpredictable magical effects.", meta: "Requires Attunement" },

  // Magical (General catch-all or specific items not in other cats)
  { name: "Bead of Force", category: "Magical", rarity: "Rare", description: "Explodes in a sphere of force.", meta: "Consumable" },
  { name: "Dust of Disappearance", category: "Magical", rarity: "Uncommon", description: "Invisibility dust.", meta: "Consumable" }
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed data if empty
  const existing = await storage.getItems();
  if (existing.length === 0) {
    console.log("Seeding database...");
    await storage.createItems(seedData);
    console.log("Seeding complete.");
  }

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

  return httpServer;
}
