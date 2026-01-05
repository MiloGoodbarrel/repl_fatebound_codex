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

// Fetch items from 5e-bits database
async function fetchFrom5eBits() {
  try {
    const url = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/5e-srd/magic_items.json';
    const response = await fetch(url);
    
    if (!response.ok) return [];
    
    const magicItems = await response.json() as Array<{
      index: string;
      name: string;
      rarity?: string;
      url?: string;
    }>;
    
    const items = [];
    
    for (const item of magicItems.slice(0, 50)) { // Limit to 50 to manage duplicates
      // Fetch full item details
      try {
        const detailUrl = `https://www.dnd5eapi.co${item.url || `/api/magic-items/${item.index}`}`;
        const detailRes = await fetch(detailUrl);
        
        if (detailRes.ok) {
          const detail = await detailRes.json() as any;
          const description = detail.desc?.join(" ") || detail.text?.join(" ") || "";
          const rarity = detail.rarity?.name || item.rarity || "unknown";
          
          items.push({
            name: item.name,
            category: categorizeItem(item.name),
            rarity: mapRoll20Rarity(rarity),
            version: "5e",
            description: description || `A magical item from the 5e SRD.`,
            attunement: "",
            meta: "5e-bits SRD",
          });
        }
      } catch (detailError) {
        // Fallback if detail fetch fails
        items.push({
          name: item.name,
          category: categorizeItem(item.name),
          rarity: mapRoll20Rarity(item.rarity || "unknown"),
          version: "5e",
          description: `A magical item from the 5e SRD.`,
          attunement: "",
          meta: "5e-bits SRD",
        });
      }
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    
    return items;
  } catch (error) {
    console.warn("Could not fetch from 5e-bits:", error);
    return [];
  }
}

// Fetch and sync items from multiple sources
async function syncItemsFromApi() {
  try {
    console.log("Syncing items from seed data, 5etools, and 5e-bits...");
    await storage.clearItems();
    
    // First, add all seed data with proper descriptions and rarities
    await storage.createItems(seedData);
    console.log(`Added ${seedData.length} seed items`);
    
    // Fetch from both sources in parallel
    const [toolsItems, bitsItems] = await Promise.all([
      fetchFrom5etools(),
      fetchFrom5eBits()
    ]);
    
    const existingNames = new Set(seedData.map(item => item.name.toLowerCase()));
    
    // Process 5etools items
    const uniqueToolsItems = toolsItems.filter(item => {
      if (existingNames.has(item.name.toLowerCase())) return false;
      existingNames.add(item.name.toLowerCase());
      return true;
    });
    
    if (uniqueToolsItems.length > 0) {
      await storage.createItems(uniqueToolsItems);
      console.log(`Added ${uniqueToolsItems.length} items from 5etools`);
    }
    
    // Process 5e-bits items
    const uniqueBitsItems = bitsItems.filter(item => {
      if (existingNames.has(item.name.toLowerCase())) return false;
      existingNames.add(item.name.toLowerCase());
      return true;
    });
    
    if (uniqueBitsItems.length > 0) {
      await storage.createItems(uniqueBitsItems);
      console.log(`Added ${uniqueBitsItems.length} items from 5e-bits`);
    }
    
    const totalItems = await storage.getItems();
    console.log(`Total items in database: ${totalItems.length}`);
    
  } catch (error) {
    console.error("Error syncing items:", error);
  }
}

// Fetch monsters from 5e API and Open5e
async function fetchMonstersFromApi(versions: string[]) {
  const monsters: any[] = [];
  
  // For 5e and One D&D, use both dnd5eapi and Open5e for more monsters
  if (versions.includes("5e") || versions.includes("onednd")) {
    // Fetch from dnd5eapi (SRD monsters)
    try {
      const response = await fetch("https://www.dnd5eapi.co/api/monsters");
      if (response.ok) {
        const data = await response.json() as { results: Array<{ index: string; name: string; url: string }> };
        
        // Fetch details for all SRD monsters
        const promises = data.results.map(async (m) => {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co${m.url}`);
            if (detailRes.ok) {
              const detail = await detailRes.json() as any;
              return {
                index: m.index,
                name: m.name,
                hp: detail.hit_points || 0,
                ac: detail.armor_class?.[0]?.value || 10,
                cr: detail.challenge_rating?.toString() || "0",
                type: detail.type || "unknown",
                size: detail.size || "Medium",
                resistances: detail.damage_resistances || [],
                immunities: detail.damage_immunities || [],
                vulnerabilities: detail.damage_vulnerabilities || [],
                source: "SRD"
              };
            }
          } catch {
            return null;
          }
        });
        
        const results = await Promise.all(promises);
        monsters.push(...results.filter(Boolean));
      }
    } catch (error) {
      console.warn("Could not fetch 5e SRD monsters:", error);
    }
    
    // Fetch from Open5e API (includes Tome of Beasts and more)
    try {
      // Fetch Tome of Beasts monsters
      const tobResponse = await fetch("https://api.open5e.com/monsters/?document__slug=tob&limit=500");
      if (tobResponse.ok) {
        const tobData = await tobResponse.json() as { results: any[] };
        const tobMonsters = tobData.results.map((m: any) => ({
          index: `tob-${m.slug}`,
          name: m.name,
          hp: m.hit_points || 0,
          ac: m.armor_class || 10,
          cr: m.challenge_rating || "0",
          type: m.type || "unknown",
          size: m.size || "Medium",
          resistances: m.damage_resistances ? m.damage_resistances.split(", ").filter(Boolean) : [],
          immunities: m.damage_immunities ? m.damage_immunities.split(", ").filter(Boolean) : [],
          vulnerabilities: m.damage_vulnerabilities ? m.damage_vulnerabilities.split(", ").filter(Boolean) : [],
          source: "Tome of Beasts"
        }));
        monsters.push(...tobMonsters);
      }
      
      // Fetch Tome of Beasts 2 monsters
      const tob2Response = await fetch("https://api.open5e.com/monsters/?document__slug=tob2&limit=500");
      if (tob2Response.ok) {
        const tob2Data = await tob2Response.json() as { results: any[] };
        const tob2Monsters = tob2Data.results.map((m: any) => ({
          index: `tob2-${m.slug}`,
          name: m.name,
          hp: m.hit_points || 0,
          ac: m.armor_class || 10,
          cr: m.challenge_rating || "0",
          type: m.type || "unknown",
          size: m.size || "Medium",
          resistances: m.damage_resistances ? m.damage_resistances.split(", ").filter(Boolean) : [],
          immunities: m.damage_immunities ? m.damage_immunities.split(", ").filter(Boolean) : [],
          vulnerabilities: m.damage_vulnerabilities ? m.damage_vulnerabilities.split(", ").filter(Boolean) : [],
          source: "Tome of Beasts 2"
        }));
        monsters.push(...tob2Monsters);
      }
      
      // Fetch Creature Codex monsters
      const ccResponse = await fetch("https://api.open5e.com/monsters/?document__slug=cc&limit=500");
      if (ccResponse.ok) {
        const ccData = await ccResponse.json() as { results: any[] };
        const ccMonsters = ccData.results.map((m: any) => ({
          index: `cc-${m.slug}`,
          name: m.name,
          hp: m.hit_points || 0,
          ac: m.armor_class || 10,
          cr: m.challenge_rating || "0",
          type: m.type || "unknown",
          size: m.size || "Medium",
          resistances: m.damage_resistances ? m.damage_resistances.split(", ").filter(Boolean) : [],
          immunities: m.damage_immunities ? m.damage_immunities.split(", ").filter(Boolean) : [],
          vulnerabilities: m.damage_vulnerabilities ? m.damage_vulnerabilities.split(", ").filter(Boolean) : [],
          source: "Creature Codex"
        }));
        monsters.push(...ccMonsters);
      }
    } catch (error) {
      console.warn("Could not fetch Open5e monsters:", error);
    }
  }
  
  // For 3.5 edition, comprehensive SRD monster list
  if (versions.includes("3.5")) {
    const srd35Monsters = [
      // Low CR Humanoids
      { index: "goblin-35", name: "Goblin", hp: 5, ac: 15, cr: "1/3", type: "humanoid", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "hobgoblin-35", name: "Hobgoblin", hp: 6, ac: 15, cr: "1/2", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "bugbear-35", name: "Bugbear", hp: 16, ac: 17, cr: "2", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "orc-35", name: "Orc", hp: 5, ac: 13, cr: "1/2", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "gnoll-35", name: "Gnoll", hp: 11, ac: 15, cr: "1", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "kobold-35", name: "Kobold", hp: 4, ac: 15, cr: "1/4", type: "humanoid", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "lizardfolk-35", name: "Lizardfolk", hp: 11, ac: 15, cr: "1", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "troglodyte-35", name: "Troglodyte", hp: 13, ac: 15, cr: "1", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Giants
      { index: "ogre-35", name: "Ogre", hp: 29, ac: 16, cr: "3", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "troll-35", name: "Troll", hp: 63, ac: 16, cr: "5", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: ["fire", "acid"] },
      { index: "hill-giant-35", name: "Hill Giant", hp: 102, ac: 20, cr: "7", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "stone-giant-35", name: "Stone Giant", hp: 119, ac: 25, cr: "8", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "frost-giant-35", name: "Frost Giant", hp: 133, ac: 21, cr: "9", type: "giant", size: "Large", resistances: [], immunities: ["cold"], vulnerabilities: ["fire"] },
      { index: "fire-giant-35", name: "Fire Giant", hp: 142, ac: 23, cr: "10", type: "giant", size: "Large", resistances: [], immunities: ["fire"], vulnerabilities: ["cold"] },
      { index: "cloud-giant-35", name: "Cloud Giant", hp: 178, ac: 25, cr: "11", type: "giant", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "storm-giant-35", name: "Storm Giant", hp: 199, ac: 27, cr: "13", type: "giant", size: "Huge", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "ettin-35", name: "Ettin", hp: 65, ac: 18, cr: "6", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Undead
      { index: "skeleton-35", name: "Skeleton", hp: 6, ac: 13, cr: "1/3", type: "undead", size: "Medium", resistances: [], immunities: ["cold"], vulnerabilities: [] },
      { index: "zombie-35", name: "Zombie", hp: 16, ac: 11, cr: "1/2", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "ghoul-35", name: "Ghoul", hp: 13, ac: 14, cr: "1", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "ghast-35", name: "Ghast", hp: 29, ac: 17, cr: "3", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "wight-35", name: "Wight", hp: 26, ac: 15, cr: "3", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "wraith-35", name: "Wraith", hp: 32, ac: 15, cr: "5", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "spectre-35", name: "Spectre", hp: 45, ac: 15, cr: "7", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "mummy-35", name: "Mummy", hp: 55, ac: 20, cr: "5", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: ["fire"] },
      { index: "vampire-35", name: "Vampire (5th-level Fighter)", hp: 32, ac: 25, cr: "7", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "lich-35", name: "Lich (11th-level Wizard)", hp: 66, ac: 23, cr: "13", type: "undead", size: "Medium", resistances: [], immunities: ["cold", "electricity", "polymorph"], vulnerabilities: [] },
      { index: "shadow-35", name: "Shadow", hp: 19, ac: 13, cr: "3", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "allip-35", name: "Allip", hp: 26, ac: 15, cr: "3", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "bodak-35", name: "Bodak", hp: 58, ac: 20, cr: "8", type: "undead", size: "Medium", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "devourer-35", name: "Devourer", hp: 78, ac: 21, cr: "11", type: "undead", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "mohrg-35", name: "Mohrg", hp: 91, ac: 23, cr: "8", type: "undead", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "nightwing-35", name: "Nightwing", hp: 144, ac: 28, cr: "14", type: "undead", size: "Huge", resistances: [], immunities: ["cold"], vulnerabilities: [] },
      
      // Aberrations
      { index: "aboleth-35", name: "Aboleth", hp: 76, ac: 16, cr: "7", type: "aberration", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "beholder-35", name: "Beholder", hp: 93, ac: 26, cr: "13", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "mind-flayer-35", name: "Mind Flayer", hp: 44, ac: 15, cr: "8", type: "aberration", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "otyugh-35", name: "Otyugh", hp: 36, ac: 17, cr: "4", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "carrion-crawler-35", name: "Carrion Crawler", hp: 19, ac: 17, cr: "4", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "chuul-35", name: "Chuul", hp: 93, ac: 22, cr: "7", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "gibbering-mouther-35", name: "Gibbering Mouther", hp: 42, ac: 19, cr: "5", type: "aberration", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "grick-35", name: "Grick", hp: 9, ac: 16, cr: "3", type: "aberration", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "rust-monster-35", name: "Rust Monster", hp: 27, ac: 18, cr: "3", type: "aberration", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "umber-hulk-35", name: "Umber Hulk", hp: 71, ac: 18, cr: "7", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Dragons
      { index: "wyrmling-red-35", name: "Red Dragon (Wyrmling)", hp: 66, ac: 17, cr: "4", type: "dragon", size: "Small", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "young-red-35", name: "Red Dragon (Young)", hp: 161, ac: 23, cr: "10", type: "dragon", size: "Medium", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "adult-red-35", name: "Red Dragon (Adult)", hp: 253, ac: 29, cr: "15", type: "dragon", size: "Large", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "ancient-red-35", name: "Red Dragon (Ancient)", hp: 449, ac: 38, cr: "22", type: "dragon", size: "Huge", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "wyrmling-black-35", name: "Black Dragon (Wyrmling)", hp: 45, ac: 16, cr: "3", type: "dragon", size: "Small", resistances: [], immunities: ["acid"], vulnerabilities: [] },
      { index: "young-black-35", name: "Black Dragon (Young)", hp: 104, ac: 22, cr: "8", type: "dragon", size: "Medium", resistances: [], immunities: ["acid"], vulnerabilities: [] },
      { index: "adult-black-35", name: "Black Dragon (Adult)", hp: 195, ac: 28, cr: "13", type: "dragon", size: "Large", resistances: [], immunities: ["acid"], vulnerabilities: [] },
      { index: "wyrmling-blue-35", name: "Blue Dragon (Wyrmling)", hp: 59, ac: 17, cr: "4", type: "dragon", size: "Small", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "young-blue-35", name: "Blue Dragon (Young)", hp: 136, ac: 23, cr: "9", type: "dragon", size: "Medium", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "adult-blue-35", name: "Blue Dragon (Adult)", hp: 230, ac: 29, cr: "14", type: "dragon", size: "Large", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "wyrmling-green-35", name: "Green Dragon (Wyrmling)", hp: 52, ac: 16, cr: "3", type: "dragon", size: "Small", resistances: [], immunities: ["acid"], vulnerabilities: [] },
      { index: "young-green-35", name: "Green Dragon (Young)", hp: 120, ac: 22, cr: "8", type: "dragon", size: "Medium", resistances: [], immunities: ["acid"], vulnerabilities: [] },
      { index: "wyrmling-white-35", name: "White Dragon (Wyrmling)", hp: 37, ac: 15, cr: "2", type: "dragon", size: "Tiny", resistances: [], immunities: ["cold"], vulnerabilities: ["fire"] },
      { index: "young-white-35", name: "White Dragon (Young)", hp: 85, ac: 20, cr: "6", type: "dragon", size: "Small", resistances: [], immunities: ["cold"], vulnerabilities: ["fire"] },
      { index: "adult-white-35", name: "White Dragon (Adult)", hp: 175, ac: 26, cr: "11", type: "dragon", size: "Medium", resistances: [], immunities: ["cold"], vulnerabilities: ["fire"] },
      { index: "wyrmling-gold-35", name: "Gold Dragon (Wyrmling)", hp: 66, ac: 18, cr: "5", type: "dragon", size: "Small", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "young-gold-35", name: "Gold Dragon (Young)", hp: 161, ac: 25, cr: "11", type: "dragon", size: "Medium", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "adult-gold-35", name: "Gold Dragon (Adult)", hp: 297, ac: 32, cr: "17", type: "dragon", size: "Large", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "wyrmling-silver-35", name: "Silver Dragon (Wyrmling)", hp: 59, ac: 17, cr: "4", type: "dragon", size: "Small", resistances: [], immunities: ["cold"], vulnerabilities: [] },
      { index: "young-silver-35", name: "Silver Dragon (Young)", hp: 136, ac: 24, cr: "10", type: "dragon", size: "Medium", resistances: [], immunities: ["cold"], vulnerabilities: [] },
      
      // Magical Beasts
      { index: "basilisk-35", name: "Basilisk", hp: 45, ac: 16, cr: "5", type: "magical beast", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "chimera-35", name: "Chimera", hp: 76, ac: 19, cr: "7", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "cockatrice-35", name: "Cockatrice", hp: 27, ac: 14, cr: "3", type: "magical beast", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "displacer-beast-35", name: "Displacer Beast", hp: 51, ac: 16, cr: "4", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "griffon-35", name: "Griffon", hp: 59, ac: 17, cr: "4", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "hippogriff-35", name: "Hippogriff", hp: 25, ac: 15, cr: "2", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "hydra-5head-35", name: "Hydra (5-headed)", hp: 52, ac: 15, cr: "4", type: "magical beast", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "hydra-12head-35", name: "Hydra (12-headed)", hp: 108, ac: 19, cr: "9", type: "magical beast", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "manticore-35", name: "Manticore", hp: 57, ac: 17, cr: "5", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "owlbear-35", name: "Owlbear", hp: 52, ac: 15, cr: "4", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "pegasus-35", name: "Pegasus", hp: 34, ac: 14, cr: "3", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "phase-spider-35", name: "Phase Spider", hp: 32, ac: 15, cr: "5", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "purple-worm-35", name: "Purple Worm", hp: 200, ac: 19, cr: "12", type: "magical beast", size: "Gargantuan", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "remorhaz-35", name: "Remorhaz", hp: 94, ac: 20, cr: "7", type: "magical beast", size: "Huge", resistances: [], immunities: ["fire", "cold"], vulnerabilities: [] },
      { index: "sphinx-35", name: "Sphinx (Androsphinx)", hp: 135, ac: 27, cr: "10", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "stirge-35", name: "Stirge", hp: 5, ac: 16, cr: "1/2", type: "magical beast", size: "Tiny", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "unicorn-35", name: "Unicorn", hp: 42, ac: 18, cr: "3", type: "magical beast", size: "Large", resistances: [], immunities: ["poison", "charm", "compulsion"], vulnerabilities: [] },
      { index: "winter-wolf-35", name: "Winter Wolf", hp: 51, ac: 15, cr: "5", type: "magical beast", size: "Large", resistances: [], immunities: ["cold"], vulnerabilities: ["fire"] },
      { index: "worg-35", name: "Worg", hp: 30, ac: 14, cr: "2", type: "magical beast", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Outsiders (Demons/Devils)
      { index: "lemure-35", name: "Lemure (Devil)", hp: 9, ac: 14, cr: "1", type: "outsider", size: "Medium", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "imp-35", name: "Imp (Devil)", hp: 13, ac: 20, cr: "2", type: "outsider", size: "Tiny", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "bearded-devil-35", name: "Bearded Devil", hp: 45, ac: 19, cr: "5", type: "outsider", size: "Medium", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "chain-devil-35", name: "Chain Devil", hp: 52, ac: 20, cr: "6", type: "outsider", size: "Medium", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "bone-devil-35", name: "Bone Devil", hp: 95, ac: 25, cr: "9", type: "outsider", size: "Large", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "horned-devil-35", name: "Horned Devil", hp: 137, ac: 28, cr: "12", type: "outsider", size: "Large", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "ice-devil-35", name: "Ice Devil", hp: 147, ac: 32, cr: "13", type: "outsider", size: "Large", resistances: [], immunities: ["fire", "poison", "cold"], vulnerabilities: [] },
      { index: "pit-fiend-35", name: "Pit Fiend", hp: 200, ac: 35, cr: "18", type: "outsider", size: "Large", resistances: [], immunities: ["fire", "poison"], vulnerabilities: [] },
      { index: "dretch-35", name: "Dretch (Demon)", hp: 13, ac: 14, cr: "2", type: "outsider", size: "Small", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "quasit-35", name: "Quasit (Demon)", hp: 13, ac: 18, cr: "2", type: "outsider", size: "Tiny", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "babau-35", name: "Babau (Demon)", hp: 66, ac: 19, cr: "6", type: "outsider", size: "Medium", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "succubus-35", name: "Succubus (Demon)", hp: 33, ac: 20, cr: "7", type: "outsider", size: "Medium", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "vrock-35", name: "Vrock (Demon)", hp: 115, ac: 22, cr: "9", type: "outsider", size: "Large", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "hezrou-35", name: "Hezrou (Demon)", hp: 138, ac: 23, cr: "11", type: "outsider", size: "Large", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "glabrezu-35", name: "Glabrezu (Demon)", hp: 174, ac: 27, cr: "13", type: "outsider", size: "Huge", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "nalfeshnee-35", name: "Nalfeshnee (Demon)", hp: 175, ac: 27, cr: "14", type: "outsider", size: "Huge", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "marilith-35", name: "Marilith (Demon)", hp: 216, ac: 29, cr: "17", type: "outsider", size: "Large", resistances: [], immunities: ["electricity", "poison"], vulnerabilities: [] },
      { index: "balor-35", name: "Balor (Demon)", hp: 290, ac: 35, cr: "20", type: "outsider", size: "Large", resistances: [], immunities: ["electricity", "fire", "poison"], vulnerabilities: [] },
      
      // Elementals
      { index: "earth-elemental-small-35", name: "Earth Elemental (Small)", hp: 11, ac: 17, cr: "1", type: "elemental", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "earth-elemental-large-35", name: "Earth Elemental (Large)", hp: 68, ac: 18, cr: "5", type: "elemental", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "earth-elemental-elder-35", name: "Earth Elemental (Elder)", hp: 228, ac: 22, cr: "11", type: "elemental", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "fire-elemental-small-35", name: "Fire Elemental (Small)", hp: 11, ac: 15, cr: "1", type: "elemental", size: "Small", resistances: [], immunities: ["fire"], vulnerabilities: ["cold"] },
      { index: "fire-elemental-large-35", name: "Fire Elemental (Large)", hp: 60, ac: 18, cr: "5", type: "elemental", size: "Large", resistances: [], immunities: ["fire"], vulnerabilities: ["cold"] },
      { index: "fire-elemental-elder-35", name: "Fire Elemental (Elder)", hp: 204, ac: 25, cr: "11", type: "elemental", size: "Huge", resistances: [], immunities: ["fire"], vulnerabilities: ["cold"] },
      { index: "water-elemental-small-35", name: "Water Elemental (Small)", hp: 13, ac: 17, cr: "1", type: "elemental", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "water-elemental-large-35", name: "Water Elemental (Large)", hp: 68, ac: 20, cr: "5", type: "elemental", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "water-elemental-elder-35", name: "Water Elemental (Elder)", hp: 228, ac: 24, cr: "11", type: "elemental", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "air-elemental-small-35", name: "Air Elemental (Small)", hp: 13, ac: 17, cr: "1", type: "elemental", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "air-elemental-large-35", name: "Air Elemental (Large)", hp: 68, ac: 20, cr: "5", type: "elemental", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "air-elemental-elder-35", name: "Air Elemental (Elder)", hp: 228, ac: 27, cr: "11", type: "elemental", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Constructs
      { index: "animated-object-small-35", name: "Animated Object (Small)", hp: 15, ac: 14, cr: "1", type: "construct", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "animated-object-large-35", name: "Animated Object (Large)", hp: 52, ac: 14, cr: "3", type: "construct", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "golem-flesh-35", name: "Flesh Golem", hp: 79, ac: 18, cr: "7", type: "construct", size: "Large", resistances: [], immunities: ["magic"], vulnerabilities: [] },
      { index: "golem-clay-35", name: "Clay Golem", hp: 90, ac: 22, cr: "10", type: "construct", size: "Large", resistances: [], immunities: ["magic"], vulnerabilities: [] },
      { index: "golem-stone-35", name: "Stone Golem", hp: 107, ac: 26, cr: "11", type: "construct", size: "Large", resistances: [], immunities: ["magic"], vulnerabilities: [] },
      { index: "golem-iron-35", name: "Iron Golem", hp: 129, ac: 30, cr: "13", type: "construct", size: "Large", resistances: [], immunities: ["magic"], vulnerabilities: [] },
      { index: "shield-guardian-35", name: "Shield Guardian", hp: 112, ac: 24, cr: "8", type: "construct", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Beasts/Animals
      { index: "dire-wolf-35", name: "Dire Wolf", hp: 45, ac: 14, cr: "3", type: "animal", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "dire-bear-35", name: "Dire Bear", hp: 105, ac: 17, cr: "7", type: "animal", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "dire-lion-35", name: "Dire Lion", hp: 60, ac: 15, cr: "5", type: "animal", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "dire-tiger-35", name: "Dire Tiger", hp: 120, ac: 17, cr: "8", type: "animal", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "dire-boar-35", name: "Dire Boar", hp: 52, ac: 15, cr: "4", type: "animal", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "dire-rat-35", name: "Dire Rat", hp: 5, ac: 15, cr: "1/3", type: "animal", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "giant-spider-35", name: "Giant Spider (Monstrous)", hp: 22, ac: 14, cr: "2", type: "vermin", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "giant-scorpion-35", name: "Giant Scorpion (Monstrous)", hp: 26, ac: 16, cr: "3", type: "vermin", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "giant-centipede-35", name: "Giant Centipede (Monstrous)", hp: 4, ac: 14, cr: "1/2", type: "vermin", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Oozes
      { index: "gelatinous-cube-35", name: "Gelatinous Cube", hp: 54, ac: 3, cr: "3", type: "ooze", size: "Large", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "black-pudding-35", name: "Black Pudding", hp: 115, ac: 3, cr: "7", type: "ooze", size: "Huge", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "gray-ooze-35", name: "Gray Ooze", hp: 31, ac: 5, cr: "4", type: "ooze", size: "Medium", resistances: [], immunities: ["cold", "fire"], vulnerabilities: [] },
      { index: "ochre-jelly-35", name: "Ochre Jelly", hp: 69, ac: 4, cr: "5", type: "ooze", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Fey
      { index: "dryad-35", name: "Dryad", hp: 14, ac: 17, cr: "3", type: "fey", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "nymph-35", name: "Nymph", hp: 21, ac: 17, cr: "7", type: "fey", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "satyr-35", name: "Satyr", hp: 22, ac: 15, cr: "2", type: "fey", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "pixie-35", name: "Pixie", hp: 3, ac: 16, cr: "4", type: "fey", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "sprite-35", name: "Sprite", hp: 2, ac: 15, cr: "1/2", type: "fey", size: "Tiny", resistances: [], immunities: [], vulnerabilities: [] },
      
      // Classic Monsters
      { index: "mimic-35", name: "Mimic", hp: 52, ac: 15, cr: "4", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "minotaur-35", name: "Minotaur", hp: 39, ac: 14, cr: "4", type: "monstrous humanoid", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "medusa-35", name: "Medusa", hp: 33, ac: 15, cr: "7", type: "monstrous humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "harpy-35", name: "Harpy", hp: 31, ac: 13, cr: "4", type: "monstrous humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "gargoyle-35", name: "Gargoyle", hp: 37, ac: 16, cr: "4", type: "monstrous humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "yuan-ti-35", name: "Yuan-Ti (Halfblood)", hp: 38, ac: 16, cr: "5", type: "monstrous humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "naga-guardian-35", name: "Guardian Naga", hp: 76, ac: 18, cr: "10", type: "aberration", size: "Large", resistances: [], immunities: ["poison"], vulnerabilities: [] },
      { index: "naga-spirit-35", name: "Spirit Naga", hp: 76, ac: 16, cr: "9", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "treant-35", name: "Treant", hp: 66, ac: 20, cr: "8", type: "plant", size: "Huge", resistances: [], immunities: [], vulnerabilities: ["fire"] },
      { index: "shambling-mound-35", name: "Shambling Mound", hp: 60, ac: 20, cr: "6", type: "plant", size: "Large", resistances: [], immunities: ["electricity"], vulnerabilities: [] },
      { index: "roper-35", name: "Roper", hp: 85, ac: 24, cr: "10", type: "magical beast", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "will-o-wisp-35", name: "Will-o'-Wisp", hp: 40, ac: 29, cr: "6", type: "aberration", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "xorn-35", name: "Xorn (Average)", hp: 48, ac: 23, cr: "6", type: "outsider", size: "Medium", resistances: [], immunities: ["fire", "cold"], vulnerabilities: [] },
      { index: "doppelganger-35", name: "Doppelganger", hp: 22, ac: 15, cr: "3", type: "monstrous humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
    ];
    monsters.push(...srd35Monsters);
  }
  
  // For 4th edition, add common monsters
  if (versions.includes("4th")) {
    const monsters4e = [
      { index: "goblin-4e", name: "Goblin Cutter", hp: 23, ac: 14, cr: "1", type: "humanoid", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "goblin-sharpshooter-4e", name: "Goblin Sharpshooter", hp: 26, ac: 15, cr: "2", type: "humanoid", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "hobgoblin-soldier-4e", name: "Hobgoblin Soldier", hp: 48, ac: 18, cr: "3", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "orc-raider-4e", name: "Orc Raider", hp: 57, ac: 16, cr: "3", type: "humanoid", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "kobold-minion-4e", name: "Kobold Minion", hp: 1, ac: 15, cr: "1", type: "humanoid", size: "Small", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "skeleton-4e", name: "Skeleton", hp: 29, ac: 15, cr: "3", type: "undead", size: "Medium", resistances: ["necrotic"], immunities: ["poison"], vulnerabilities: ["radiant"] },
      { index: "zombie-4e", name: "Zombie", hp: 40, ac: 12, cr: "2", type: "undead", size: "Medium", resistances: ["necrotic"], immunities: ["poison"], vulnerabilities: ["radiant"] },
      { index: "ogre-4e", name: "Ogre", hp: 111, ac: 16, cr: "8", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "troll-4e", name: "Troll", hp: 135, ac: 18, cr: "9", type: "giant", size: "Large", resistances: [], immunities: [], vulnerabilities: ["fire", "acid"] },
      { index: "dragon-young-red-4e", name: "Young Red Dragon", hp: 256, ac: 22, cr: "11", type: "dragon", size: "Large", resistances: [], immunities: ["fire"], vulnerabilities: [] },
      { index: "beholder-4e", name: "Beholder", hp: 218, ac: 27, cr: "19", type: "aberration", size: "Large", resistances: [], immunities: [], vulnerabilities: [] },
      { index: "mind-flayer-4e", name: "Mind Flayer", hp: 85, ac: 19, cr: "13", type: "aberration", size: "Medium", resistances: [], immunities: [], vulnerabilities: [] },
    ];
    monsters.push(...monsters4e);
  }
  
  return monsters;
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

  // Monster bestiary endpoint
  app.get("/api/monsters", async (req, res) => {
    try {
      const versions = (req.query.versions as string)?.split(",") || ["5e"];
      const monsters = await fetchMonstersFromApi(versions);
      res.json(monsters);
    } catch (err) {
      console.error("Error fetching monsters:", err);
      res.status(500).json({ message: "Failed to fetch monsters" });
    }
  });

  return httpServer;
}
