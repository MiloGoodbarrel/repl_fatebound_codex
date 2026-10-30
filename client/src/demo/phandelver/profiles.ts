import type { CreatureProfile } from "@shared/creatureProfiles";

const source = "Lost Mine of Phandelver";
type Row = [name: string, hp: number, ac: number, dex: number, cr: string, type: string, size: string, page: number, actions: string[], traits?: string];
// Combat summaries of the supplied adventure's Appendix B, not the sometimes
// different Monster Manual versions (notably Mormesk and the evil mage).
const rows: Record<string, Row> = {
  goblin: ["Goblin", 7, 15, 14, "1/4", "Humanoid", "Small", 58,
    ["Scimitar|+4 to hit; 5 ft.; 1d6+2 slashing.", "Shortbow|+4 to hit; 80/320 ft.; 1d6+2 piercing."], "Nimble Escape: Disengage or Hide as a bonus action."],
  wolf: ["Wolf", 11, 13, 15, "1/4", "Beast", "Medium", 63,
    ["Bite|+4 to hit; 5 ft.; 2d4+2 piercing; DC 11 STR save or prone."], "Pack Tactics; advantage on hearing/smell Perception checks."],
  bugbear: ["Bugbear", 27, 16, 14, "1", "Humanoid", "Medium", 56,
    ["Morningstar|+4 to hit; 5 ft.; 2d8+2 piercing.", "Javelin|+4 to hit; 5 ft. or 30/120 ft.; 2d6+2 piercing in melee, 1d6+2 at range."], "Brute damage is included. Surprise Attack: extra 2d6 on a hit against a surprised creature in the first round."],
  ruffian: ["Redbrand Ruffian", 16, 14, 14, "1/2", "Humanoid", "Medium", 61,
    ["Multiattack|Two melee attacks.", "Shortsword|+4 to hit; 5 ft.; 1d6+2 piercing."]],
  skeleton: ["Skeleton", 13, 13, 14, "1/4", "Undead", "Medium", 62,
    ["Shortsword|+4 to hit; 5 ft.; 1d6+2 piercing.", "Shortbow|+4 to hit; 80/320 ft.; 1d6+2 piercing."], "Vulnerable to bludgeoning; immune to poison damage, exhaustion and poisoned."],
  nothic: ["Nothic", 45, 15, 16, "2", "Aberration", "Medium", 60,
    ["Multiattack|Two claw attacks.", "Claw|+4 to hit; 5 ft.; 1d6+3 slashing.", "Rotting Gaze|One visible creature within 30 ft.; DC 12 CON save or 3d6 necrotic.", "Weird Insight|Opposed Insight vs Deception reveals a secret within 30 ft.; immune-to-charm creatures automatically resist."], "Keen Sight; truesight 120 ft."],
  mage: ["Evil Mage", 22, 12, 14, "1", "Humanoid", "Medium", 57,
    ["Quarterstaff|+1 to hit; 5 ft.; 1d8−1 bludgeoning."], "INT spellcasting: DC 13, +5 spell attacks; 4 first-level and 3 second-level slots. Cantrips: light, mage hand, shocking grasp. First: charm person, magic missile. Second: hold person, misty step. Saves INT +5, WIS +3."],
  zombie: ["Zombie", 22, 8, 6, "1/4", "Undead", "Medium", 63,
    ["Slam|+3 to hit; 5 ft.; 1d6+1 bludgeoning."], "Undead Fortitude: at 0 HP, CON save DC 5 + damage taken to remain at 1 HP unless radiant damage or a critical hit. Immune to poison damage and poisoned."],
  stirge: ["Stirge", 2, 14, 16, "1/8", "Beast", "Tiny", 62,
    ["Blood Drain|+5 to hit; 5 ft.; 1d4+3 piercing, attaches; drains 1d4+3 HP at the start of each stirge turn. Detaches after draining 10 HP or target dies; an action can remove it."], "Walk 10 ft., fly 40 ft."],
  ghoul: ["Ghoul", 22, 12, 15, "1", "Undead", "Medium", 58,
    ["Bite|+2 to hit; 5 ft.; 2d6+2 piercing.", "Claws|+4 to hit; 5 ft.; 2d4+2 slashing. Non-elf, non-undead targets: DC 10 CON save or paralyzed up to 1 minute; repeat save at end of turns."], "Immune to poison damage, charmed, exhaustion and poisoned."],
  ogre: ["Ogre", 59, 11, 8, "2", "Giant", "Large", 60,
    ["Greatclub|+6 to hit; 5 ft.; 2d8+4 bludgeoning.", "Javelin|+6 to hit; 5 ft. or 30/120 ft.; 2d6+4 piercing."]],
  hobgoblin: ["Hobgoblin", 11, 18, 12, "1/2", "Humanoid", "Medium", 59,
    ["Longsword|+3 to hit; 5 ft.; 1d8+1 slashing (1d10+1 two-handed).", "Longbow|+3 to hit; 150/600 ft.; 1d8+1 piercing."], "Martial Advantage: once per turn, extra 2d6 weapon damage when a non-incapacitated ally is within 5 ft. of target."],
  orc: ["Orc", 15, 13, 12, "1/2", "Humanoid", "Medium", 61,
    ["Greataxe|+5 to hit; 5 ft.; 1d12+3 slashing.", "Javelin|+5 to hit; 5 ft. or 30/120 ft.; 1d6+3 piercing."], "Aggressive: bonus-action movement up to speed toward a visible hostile creature."],
  owlbear: ["Owlbear", 59, 13, 12, "3", "Monstrosity", "Large", 61,
    ["Multiattack|One beak and one claws attack.", "Beak|+7 to hit; 5 ft.; 1d10+5 piercing.", "Claws|+7 to hit; 5 ft.; 2d8+5 slashing."], "Keen Sight and Smell."],
  blight: ["Twig Blight", 4, 13, 13, "1/8", "Plant", "Small", 63,
    ["Claws|+3 to hit; 5 ft.; 1d4+1 piercing."], "False Appearance; blindsight 60 ft. (blind beyond). Vulnerable to fire; immune to blinded and deafened."],
  spider: ["Giant Spider", 26, 14, 16, "1", "Beast", "Large", 58,
    ["Bite|+5 to hit; 5 ft.; 1d8+3 piercing plus 2d8 poison (DC 11 CON save halves poison). Poison reducing target to 0 HP stabilizes and poisons/paralyzes it for 1 hour.", "Web (Recharge 5–6)|+5 to hit; 30/60 ft.; restrained. DC 12 STR check to escape; web AC 10, HP 5, vulnerable to fire, immune to bludgeoning/poison/psychic."], "Spider Climb, Web Sense, Web Walker."],
  dragon: ["Young Green Dragon", 136, 18, 12, "8", "Dragon", "Large", 63,
    ["Multiattack|One bite and two claws attacks.", "Bite|+7 to hit; 10 ft.; 2d10+4 piercing plus 2d6 poison.", "Claw|+7 to hit; 5 ft.; 2d6+4 slashing.", "Poison Breath (Recharge 5–6)|30-ft. cone; DC 16 CON save; 12d6 poison, half on success."], "Amphibious; immune to poison damage and poisoned. Walk 40 ft., fly 60 ft., swim 40 ft. Saves DEX +4, CON +6, WIS +4, CHA +5."],
  cultist: ["Cultist", 9, 12, 12, "1/8", "Humanoid", "Medium", 56,
    ["Scimitar|+3 to hit; 5 ft.; 1d6+1 slashing."], "Dark Devotion: advantage on saves against charmed or frightened."],
  grick: ["Grick", 27, 14, 14, "2", "Monstrosity", "Medium", 58,
    ["Multiattack|Tentacles, followed by beak against the same target if tentacles hit.", "Tentacles|+4 to hit; 5 ft.; 2d6+2 slashing.", "Beak|+4 to hit; 5 ft.; 1d6+2 piercing."], "Stone Camouflage; resistance to bludgeoning, piercing and slashing from nonmagical weapons."],
  doppelganger: ["Doppelganger", 52, 14, 18, "3", "Monstrosity", "Medium", 56,
    ["Multiattack|Two melee attacks.", "Slam|+6 to hit; 5 ft.; 1d6+4 bludgeoning.", "Read Thoughts|One visible creature within 60 ft.; surface thoughts, concentration up to 1 minute."], "Shapechanger; Ambusher; Surprise Attack adds 3d6 against surprised creatures in first round. Immune to charmed."],
  jelly: ["Ochre Jelly", 45, 8, 6, "2", "Ooze", "Large", 60,
    ["Pseudopod|+4 to hit; 5 ft.; 2d6+2 bludgeoning plus 1d6 acid."], "Amorphous; Spider Climb; resistant to acid; immune to lightning/slashing. Reaction Split: lightning/slashing damage while Medium or larger with at least 10 HP creates two smaller jellies with half current HP each. Track splits manually."],
  flameskull: ["Flameskull", 40, 13, 17, "4", "Undead", "Tiny", 57,
    ["Multiattack|Two Fire Rays.", "Fire Ray|Ranged spell attack +5; 30 ft.; 3d6 fire."], "Magic Resistance; Rejuvenation after 1 hour unless holy water or dispel magic/remove curse. DC 13, +5 spell attacks; slots 4/3/1. Mage hand; magic missile, shield; blur, flaming sphere; fireball. Immune to cold/fire/poison; resistant to lightning/necrotic/piercing. Fly 40 ft. (hover)."],
  mormesk: ["Mormesk the Wraith", 45, 13, 16, "3", "Undead", "Medium", 59,
    ["Life Drain|+5 to hit; 5 ft.; 3d8+3 necrotic; DC 13 CON save or reduce maximum HP by damage taken until a long rest; death if maximum becomes 0."], "Incorporeal Movement; Sunlight Sensitivity. Immune to necrotic/poison; resistant to acid/cold/fire/lightning/thunder and nonmagical nonsilvered weapon damage. Fly 60 ft. (hover)."],
  spectator: ["Spectator", 39, 14, 14, "3", "Aberration", "Medium", 62,
    ["Bite|+1 to hit; 5 ft.; 1d4−1 piercing.", "Eye Rays|Two DIFFERENT rays at 1–2 visible targets within 90 ft. Confusion: DC 13 WIS. Paralyzing: DC 13 CON. Fear: DC 13 WIS. Wounding: DC 13 CON, 3d10 necrotic, half on success.", "Create Food and Water|Creates enough for itself."], "Spell Reflection reaction: when missed by a spell attack or succeeding on a spell save, redirect to a creature within 30 ft. Fly 30 ft. (hover); telepathy 120 ft."],
  nezznar: ["Nezznar the Black Spider", 27, 11, 13, "2", "Humanoid", "Medium", 59,
    ["Spider Staff|+1 to hit; 5 ft.; 1d6−1 bludgeoning plus 1d6 poison."], "AC 14 with mage armor. Fey Ancestry; Sunlight Sensitivity. Innate (CHA DC 12): dancing lights at will; darkness, faerie fire once/day each. INT DC 13, +5 spell attacks; slots 4/3. Mage hand, ray of frost, shocking grasp; mage armor, magic missile, shield; invisibility, suggestion. Spider staff has 10 charges for spider climb (1) and web (2), DC 15. Saves INT +5, WIS +4."],
  sildar: ["Sildar Hallwinter", 27, 16, 10, "1", "Humanoid", "Medium", 61,
    ["Multiattack|Two melee attacks.", "Longsword|+3 to hit; 5 ft.; 1d8+1 slashing (1d10+1 two-handed).", "Heavy Crossbow|+2 to hit; 100/400 ft.; 1d10 piercing."], "Parry reaction: add 1d6 to AC against a visible melee attack while wielding a melee weapon. Saves STR +3, CON +3. In captivity: 1 current HP and stripped of equipment; do not assume his equipped AC."],
  commoner: ["Commoner", 4, 10, 10, "0", "Humanoid", "Medium", 56,
    ["Club|+2 to hit; 5 ft.; 1d4 bludgeoning."]],
};

const abilities: Record<string, number[]> = {
  goblin: [8, 14, 10, 10, 8, 8], wolf: [12, 15, 12, 3, 12, 6], bugbear: [15, 14, 13, 8, 11, 9],
  ruffian: [11, 14, 12, 9, 9, 11], skeleton: [10, 14, 15, 6, 8, 5], nothic: [14, 16, 16, 13, 10, 8],
  mage: [9, 14, 11, 17, 12, 11], zombie: [13, 6, 16, 3, 6, 5], stirge: [4, 16, 11, 2, 8, 6],
  ghoul: [13, 15, 10, 7, 10, 6], ogre: [19, 8, 16, 5, 7, 7], hobgoblin: [13, 12, 12, 10, 10, 9],
  orc: [16, 12, 16, 7, 11, 10], owlbear: [20, 12, 17, 3, 12, 7], blight: [6, 13, 12, 4, 8, 3],
  spider: [14, 16, 12, 2, 11, 4], dragon: [19, 12, 17, 16, 13, 15], cultist: [11, 12, 10, 10, 11, 10],
  grick: [14, 14, 11, 3, 14, 5], doppelganger: [11, 18, 14, 11, 12, 14], jelly: [15, 6, 14, 2, 6, 1],
  flameskull: [1, 17, 14, 16, 10, 11], mormesk: [6, 16, 16, 12, 14, 15], spectator: [8, 14, 14, 13, 14, 11],
  nezznar: [9, 13, 10, 16, 14, 13], sildar: [13, 10, 12, 10, 11, 10], commoner: [10, 10, 10, 10, 10, 10],
};
export const PHANDELVER_PROFILES: Record<string, CreatureProfile> = Object.fromEntries(Object.entries(rows).map(([key, r]) => {
  const [name, hp, ac, dex, cr, type, size, sourcePage, actions, traits] = r;
  const [str, , con, int, wis, cha] = abilities[key];
  return [key, { index: `demo-lmop-${key}`, name, hp, ac, dex, cr, type, size, source, sourcePage,
    str, con, int, wis, cha, strMod: Math.floor((str - 10) / 2), dexMod: Math.floor((dex - 10) / 2),
    conMod: Math.floor((con - 10) / 2), intMod: Math.floor((int - 10) / 2),
    wisMod: Math.floor((wis - 10) / 2), chaMod: Math.floor((cha - 10) / 2),
    actions: actions.map(text => { const [name, desc] = text.split("|"); const bonus = /^\+(\d+) to hit/.exec(desc);
      return { name, desc, ...(bonus ? { attack_bonus: Number(bonus[1]) } : {}) }; }),
    special_abilities: traits ? [{ name: "Combat reference", desc: traits }] : [],
  }];
}));
PHANDELVER_PROFILES.mage.savingThrows = { int: 5, wis: 3 };
PHANDELVER_PROFILES.mage.spellSaveDc = 13;
PHANDELVER_PROFILES.mage.spellAttackBonus = 5;
PHANDELVER_PROFILES.nezznar.savingThrows = { int: 5, wis: 4 };
PHANDELVER_PROFILES.nezznar.spellSaveDc = 13;
PHANDELVER_PROFILES.nezznar.spellAttackBonus = 5;
PHANDELVER_PROFILES.flameskull.spellSaveDc = 13;
PHANDELVER_PROFILES.flameskull.spellAttackBonus = 5;
PHANDELVER_PROFILES.sildar.savingThrows = { str: 3, con: 3 };
PHANDELVER_PROFILES.dragon.savingThrows = { dex: 4, con: 6, wis: 4, cha: 5 };

function variant(key: string, base: string, name: string, patch: Partial<CreatureProfile> = {}) {
  PHANDELVER_PROFILES[key] = { ...structuredClone(PHANDELVER_PROFILES[base]), index: `demo-lmop-${key}`, name, ...patch };
}
variant("yeemik", "goblin", "Yeemik", { hp: 12 });
variant("klarg", "bugbear", "Klarg");
variant("ripper", "wolf", "Ripper");
variant("glasstaff", "mage", "Iarno “Glasstaff” Albrek", { ac: 13,
  description: "Staff of defense grants +1 AC (included); 10 charges for mage armor (1) or shield (2). AC 16 with mage armor. Surrenders at 8 HP or fewer; familiar may warn him to escape. Adventure pp. 25–26." });
variant("hamun", "mage", "Hamun Kost", { disposition: { combatantType: "npc", stance: "neutral", referenceOnly: false } });
variant("ashZombie", "zombie", "Ash Zombie", { special_abilities: [...PHANDELVER_PROFILES.zombie.special_abilities!,
  { name: "Ash Puff", desc: "First time damaged: creatures within 5 ft. make DC 10 CON save or have disadvantage on attack rolls, saves and ability checks for 1 minute; repeat save at end of turns." }] });
variant("venomfang", "dragon", "Venomfang", { description: "Retreats when reduced to half HP; not a balanced fight for level-one pregens." });
variant("brughor", "orc", "Brughor Axe-Biter", { hp: 30 });
variant("gog", "ogre", "Gog");
variant("yegg", "goblin", "Yegg", { hp: 12 });
variant("lhupo", "goblin", "Lhupo", { hp: 12 });
variant("grol", "bugbear", "King Grol", { hp: 45 });
variant("snarl", "wolf", "Snarl", { hp: 18 });
variant("vyerith", "doppelganger", "Vyerith");
variant("vhalak", "doppelganger", "Vhalak");
variant("targor", "hobgoblin", "Targor Bloodsword", { hp: 20 });
variant("droop", "goblin", "Droop", { disposition: { combatantType: "npc", stance: "ally", referenceOnly: true },
  description: "Bullied goblin helper; not an additional enemy in the guard-barracks encounter." });
variant("gundren", "commoner", "Gundren Rockseeker", { disposition: { combatantType: "npc", stance: "ally", referenceOnly: true } });
variant("nundro", "commoner", "Nundro Rockseeker", { disposition: { combatantType: "npc", stance: "ally", referenceOnly: true } });
PHANDELVER_PROFILES.sildar.disposition = { combatantType: "npc", stance: "ally", referenceOnly: false };
