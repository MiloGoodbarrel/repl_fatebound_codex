import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertItemSchema } from "@shared/schema";

const seedData = [
  // 5e - Weapons
  { name: "Dagger", category: "Weapons", rarity: "Common", description: "A simple melee weapon consisting of a short blade with a sharp point and edge. Daggers are versatile weapons useful for both melee combat and ranged throwing. Often favored by rogues and rangers for their finesse and light weight.", version: "5e", attunement: "", weaponType: "Simple Melee", meta: "1d4 piercing, finesse, light" },
  { name: "Longsword", category: "Weapons", rarity: "Common", description: "A versatile sword with a straight blade about 3 feet long. This weapon can be wielded with one or two hands, making it the weapon of choice for many warriors and paladins. Perfectly balanced for both cutting and thrusting attacks.", version: "5e", attunement: "", weaponType: "Martial Melee", meta: "1d8 slashing (1d10 versatile)" },
  { name: "Shortbow", category: "Weapons", rarity: "Common", description: "A simple bow approximately 5 feet in length. Shortbows are quick to draw and fire, making them popular with rangers and hunters. They provide effective ranged coverage without the strength requirements of larger bows.", version: "5e", attunement: "", weaponType: "Simple Ranged", meta: "1d6 piercing, range 80/320" },
  { name: "Greataxe", category: "Weapons", rarity: "Common", description: "A massive two-handed axe with a brutal blade of cruel proportions. Only wielded by warriors with tremendous strength, a greataxe delivers devastating blows capable of cleaving through armor. The weapon of choice for barbarians and powerful fighters.", version: "5e", attunement: "", weaponType: "Martial Melee", meta: "1d12 slashing, heavy, two-handed" },
  { name: "Flame Tongue", category: "Weapons", rarity: "Rare", description: "A magical sword inscribed with eldritch runes of fire. When ignited, the blade erupts in brilliant flames that shed bright light in a 30-foot radius. The flames deal additional fire damage to those struck by the blade.", version: "5e", attunement: "Requires Attunement", weaponType: "Magical Melee", meta: "" },
  { name: "Holy Avenger", category: "Weapons", rarity: "Legendary", description: "A legendary +3 longsword blessed by celestial powers. Holy Avengers glow with divine radiance when wielded by paladins and excel at smiting undead and fiends. Only those of pure conviction can wield this artifact-tier weapon.", version: "5e", attunement: "Requires Attunement by Paladin", weaponType: "Legendary", meta: "" },
  { name: "Vorpal Sword", category: "Weapons", rarity: "Legendary", description: "A legendary blade inscribed with ancient runes of execution. This fearsome sword cuts with such supernatural sharpness that it can sever the head of any creature in a single strike on a critical hit. Few weapons inspire more dread in combat.", version: "5e", attunement: "Requires Attunement", weaponType: "Legendary", meta: "" },
  { name: "Sun Blade", category: "Weapons", rarity: "Rare", description: "A magical sword of radiant power that glows with intense light. The blade is an effective weapon against undead and fiends. When unsheathed, it sheds bright light to 15 feet and dim light 30 feet beyond that.", version: "5e", attunement: "Requires Attunement", weaponType: "Magical Melee", meta: "" },
  { name: "Javelin of Lightning", category: "Weapons", rarity: "Uncommon", description: "A magical weapon that returns to your hand after being thrown. When this javelin strikes a target, it transforms into a bolt of lightning before returning, dealing additional lightning damage. Highly valued by ranged combatants who prefer melee alternatives.", version: "5e", attunement: "", weaponType: "Magical Ranged", meta: "" },

  // 5e - Simple Ranged Weapons
  { name: "Dart", category: "Weapons", rarity: "Common", description: "A small, pointed missile weapon easily concealed and thrown with accuracy. Darts are favored by those who value subtlety and precision over raw damage.", version: "5e", attunement: "", weaponType: "Simple Ranged", meta: "1d4 piercing, range 20/60" },
  { name: "Sling", category: "Weapons", rarity: "Common", description: "A simple weapon consisting of a small pouch attached to two cords. Slings are effective ranged weapons and can be easily improvised from common materials.", version: "5e", attunement: "", weaponType: "Simple Ranged", meta: "1d4 bludgeoning, range 30/120" },

  // 5e - Martial Ranged Weapons
  { name: "Blowgun", category: "Weapons", rarity: "Common", description: "A long tube used to fire tiny darts through lung power. Blowguns are silent and deadly, making them popular with assassins and stealthy hunters.", version: "5e", attunement: "", weaponType: "Martial Ranged", meta: "1d1 piercing, range 25/100" },
  { name: "Hand Crossbow", category: "Weapons", rarity: "Common", description: "A compact crossbow designed for one-handed use. Hand crossbows are favored by those who need ranged capability without sacrificing the use of a shield or other hand weapon.", version: "5e", attunement: "", weaponType: "Martial Ranged", meta: "1d6 piercing, range 30/120" },
  { name: "Heavy Crossbow", category: "Weapons", rarity: "Common", description: "A powerful two-handed crossbow that requires strength and loading time but delivers devastating bolts. Heavy crossbows are the weapon of choice for those seeking maximum ranged damage.", version: "5e", attunement: "", weaponType: "Martial Ranged", meta: "1d12 piercing, range 100/400" },
  { name: "Longbow", category: "Weapons", rarity: "Common", description: "A large, powerful bow standing as tall as a person. Longbows are the classic weapon of archers and rangers, capable of striking targets at impressive distances with considerable force.", version: "5e", attunement: "", weaponType: "Martial Ranged", meta: "1d8 piercing, range 150/600" },
  { name: "Net", category: "Weapons", rarity: "Common", description: "A mesh of cord or rope spread wide to entangle targets. Nets are unusual weapons that prioritize immobilization over damage, making them valuable for those who need to capture rather than kill.", version: "5e", attunement: "", weaponType: "Martial Ranged", meta: "Special, range 5/15" },

  // 5e - Magical Weapon Variants (+1, +2, +3)
  { name: "Longsword +1", category: "Weapons", rarity: "Uncommon", description: "A well-crafted longsword imbued with magical enhancement. The weapon grants a bonus to attack rolls and damage rolls made with it. Balanced between power and accessibility.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+1 to hit and damage" },
  { name: "Longsword +2", category: "Weapons", rarity: "Rare", description: "A finely enchanted longsword with significant magical resonance. This weapon is considerably more powerful than lesser enchanted blades and deals enhanced damage with remarkable accuracy.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+2 to hit and damage" },
  { name: "Longsword +3", category: "Weapons", rarity: "Very Rare", description: "A legendary longsword at the height of magical craftsmanship. This artifact-quality weapon strikes with supernatural accuracy and power, making it a prized possession of great warriors.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+3 to hit and damage" },
  
  { name: "Longbow +1", category: "Weapons", rarity: "Uncommon", description: "A magically enhanced longbow that fires arrows with greater accuracy and force. The wood of the bow shimmers with arcane power.", version: "5e", attunement: "", weaponType: "Magical Ranged", meta: "+1 to hit and damage" },
  { name: "Longbow +2", category: "Weapons", rarity: "Rare", description: "A finely crafted longbow suffused with powerful magic. Arrows fired from this bow strike with exceptional accuracy and devastating power.", version: "5e", attunement: "", weaponType: "Magical Ranged", meta: "+2 to hit and damage" },
  
  { name: "Dagger +1", category: "Weapons", rarity: "Uncommon", description: "A well-balanced dagger enhanced by magical enchantment. The blade gleams with arcane energy and strikes with supernatural precision.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+1 to hit and damage" },
  { name: "Dagger +2", category: "Weapons", rarity: "Rare", description: "A finely honed dagger of exceptional magical craftsmanship. This blade is as reliable as it is deadly, striking true with remarkable force.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+2 to hit and damage" },

  { name: "Greatsword +1", category: "Weapons", rarity: "Uncommon", description: "A massive greatsword enhanced by magical runes. The weapon is perfectly balanced and strikes with both accuracy and devastating force.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+1 to hit and damage" },
  { name: "Greatsword +2", category: "Weapons", rarity: "Rare", description: "A legendary greatsword that towers above most warriors. This weapon, infused with powerful magic, cleaves through enemies with terrible efficiency.", version: "5e", attunement: "", weaponType: "Magical Melee", meta: "+2 to hit and damage" },
  
  // 5e - Armor
  { name: "Leather Armor", category: "Armor", rarity: "Common", description: "Light armor made from supple leather. Leather armor is comfortable and flexible, imposing no strength requirement. Rogues and rangers commonly favor this armor for its balance of protection and mobility.", version: "5e", attunement: "", meta: "AC 11 + Dex" },
  { name: "Chain Mail", category: "Armor", rarity: "Common", description: "Heavy armor consisting of interlocking metal rings. Chain mail provides excellent protection but is noisy and restricts movement. Requires significant strength to wear effectively without hindering combat effectiveness.", version: "5e", attunement: "", meta: "AC 16, Str 13, Stealth Disadv" },
  { name: "Plate Armor", category: "Armor", rarity: "Common", description: "Full body plate armor of gleaming metal. This is the ultimate protection for warriors, covering every vital area with thick metal plates. Despite its weight, trained soldiers move with surprising grace in plate armor.", version: "5e", attunement: "", meta: "AC 18, Str 15, Stealth Disadv" },
  { name: "Shield", category: "Armor", rarity: "Common", description: "A protective device that blocks incoming attacks. Whether wooden with metal reinforcement or solid metal, shields add substantial defense. Most warriors carry shields as a vital piece of their arsenal.", version: "5e", attunement: "", meta: "+2 AC" },
  { name: "Adamantine Armor", category: "Armor", rarity: "Uncommon", description: "Magical armor forged from the incredibly hard metal adamantine. Its supernatural durability makes it nearly impossible for enemies to land critical strikes against the wearer. Highly sought after by adventurers facing dangerous foes.", version: "5e", attunement: "", meta: "Medium or Heavy" },
  { name: "Mithral Armor", category: "Armor", rarity: "Uncommon", description: "Lightweight metallic armor forged from mithral. This silvery metal is as strong as steel but weighs half as much. Mithral armor imposes no disadvantage on stealth checks, making it ideal for subtle warriors.", version: "5e", attunement: "", meta: "No Stealth Disadv" },
  { name: "Armor of Invulnerability", category: "Armor", rarity: "Legendary", description: "A legendary suit of armor providing supernatural protection. The wearer becomes immune to all non-magical damage, making them nearly unstoppable in conventional combat. Only magical weapons can harm one wearing this armor.", version: "5e", attunement: "Requires Attunement", meta: "" },
  
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

interface Roll20ItemData {
  Name: string;
  "Item Rarity"?: string;
  data?: string;
  [key: string]: any;
}

// Map Roll20 rarity to our system
function mapRoll20Rarity(rarity: string): string {
  const rarityMap: Record<string, string> = {
    "none": "Common",
    "common": "Common",
    "uncommon": "Uncommon",
    "rare": "Rare",
    "very rare": "Very Rare",
    "artifact": "Artifact",
    "legendary": "Legendary",
    "unknown": "Unknown",
  };
  return rarityMap[rarity.toLowerCase()] || "Common";
}

// Categorize item based on name
function categorizeItem(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes("weapon") || lowerName.includes("sword") || lowerName.includes("axe") || 
      lowerName.includes("bow") || lowerName.includes("mace") || lowerName.includes("blade") || 
      lowerName.includes("hammer") || lowerName.includes("lance")) {
    return "Weapons";
  } else if (lowerName.includes("armor") || lowerName.includes("mail") || lowerName.includes("plate") ||
             lowerName.includes("leather") || lowerName.includes("cloak") || lowerName.includes("robe") ||
             lowerName.includes("boots") || lowerName.includes("gloves") || lowerName.includes("helm") ||
             lowerName.includes("gauntlets") || lowerName.includes("bracers")) {
    return "Armor";
  } else if (lowerName.includes("ring")) {
    return "Rings";
  } else if (lowerName.includes("scroll")) {
    return "Scrolls";
  } else if (lowerName.includes("potion")) {
    return "Potions";
  } else if (lowerName.includes("rod")) {
    return "Rods";
  } else if (lowerName.includes("staff")) {
    return "Staves";
  } else if (lowerName.includes("wand")) {
    return "Wands";
  }
  return "Magical";
}

// Extract plain text description from Roll20 HTML
function extractDescription(htmlContent: string): string {
  if (!htmlContent) return "";
  // Remove HTML tags
  let text = htmlContent.replace(/<[^>]*>/g, "");
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text.substring(0, 500); // Limit to 500 chars
}

// Fetch item from Roll20 Compendium
async function fetchFromRoll20(itemName: string): Promise<{
  description: string;
  rarity: string;
  source: string;
} | null> {
  try {
    const encodedName = encodeURIComponent(itemName);
    const url = `https://app.roll20.net/compendium/dnd5e/${encodedName}.json`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json() as Roll20ItemData;
    
    const description = data.data ? extractDescription(data.data) : "";
    const rarity = data["Item Rarity"] || "None";
    
    return {
      description: description || `A magical item from the D&D 5e SRD.`,
      rarity: mapRoll20Rarity(rarity),
      source: "D&D 5e SRD",
    };
  } catch (error) {
    console.warn(`Could not fetch ${itemName} from Roll20:`, error);
    return null;
  }
}

// Fetch all items from 5etools
async function fetchFrom5etools() {
  try {
    const url = 'https://raw.githubusercontent.com/TheGiddyLimit/TheGiddyLimit.github.io/master/data/items.json';
    const response = await fetch(url);
    
    if (!response.ok) return [];
    
    const data = await response.json() as { item: Array<{
      name: string;
      rarity?: string;
      source: string;
      entries?: string[];
      type?: string;
    }> };
    
    const items = [];
    const magicItems = data.item.filter(item => 
      item.rarity && item.rarity !== 'none' && item.rarity !== 'unknown'
    );
    
    for (const item of magicItems.slice(0, 100)) { // Limit to 100 to avoid duplicates
      const description = item.entries 
        ? item.entries.map((e: string) => extractDescription(e)).join(" ")
        : "";
      
      items.push({
        name: item.name,
        category: categorizeItem(item.name),
        rarity: mapRoll20Rarity(item.rarity || "none"),
        version: "5e",
        description: description || `A magical item from 5etools.`,
        attunement: "",
        meta: `5etools - ${item.source}`,
      });
    }
    
    return items;
  } catch (error) {
    console.warn("Could not fetch from 5etools:", error);
    return [];
  }
}

// Fetch and sync items from multiple sources
async function syncItemsFromApi() {
  try {
    console.log("Syncing items from seed data, Roll20 Compendium, and 5etools...");
    await storage.clearItems();
    
    // First, add all seed data with proper descriptions and rarities
    await storage.createItems(seedData);
    console.log(`Added ${seedData.length} seed items`);
    
    // Fetch from 5etools (comprehensive)
    const toolsItems = await fetchFrom5etools();
    const existingNames = new Set(seedData.map(item => item.name.toLowerCase()));
    
    const uniqueToolsItems = toolsItems.filter(item => {
      if (existingNames.has(item.name.toLowerCase())) return false;
      existingNames.add(item.name.toLowerCase());
      return true;
    });
    
    if (uniqueToolsItems.length > 0) {
      await storage.createItems(uniqueToolsItems);
      console.log(`Added ${uniqueToolsItems.length} items from 5etools`);
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
