import { creatureProfileSchema, type CreatureProfile } from "../../shared/creatureProfiles";

export const UNTIL_FIRST_LIGHT_SOURCE = "Until First Light";
const phase = {
  name: "Hybrid activation",
  desc: "Uses the Zombicide: Black Plague Zombies' Phase (Activation, then Spawn), not a normal fifth-edition turn. PCs and NPCs act first in their own initiative order. Roll once per zombie type per target; the players assign attacking zombies to targets in the same zone before rolling. Shield protects against the whole group roll. Miasma limits sight and ranged attacks to 3 zones (45 feet).",
};
const sourceNote = "Aetherfall homebrew; Until First Light, p. 12. Hybrid Zombicide/fifth-edition rules. Ability scores, hit dice, conventional CR and unspecified movement statistics are not printed; none have been invented.";
function zombie(index: string, name: string, ac: number, bonus: number, damage: number, kill: string, lore: string): CreatureProfile {
  return {
    index: `until-first-light-${index}`, name, ac, hp: index === "fatty" ? 2 : 1,
    hpLabel: index === "fatty" ? "2-hit counter (not HP)" : "Any hit kills (1-token counter)",
    type: "undead", size: "", cr: "—", source: UNTIL_FIRST_LIGHT_SOURCE, sourcePage: 12,
    description: `${sourceNote} ${lore} The tracker number is a convenience counter, not printed hit points. Apply the kill rule manually; do not subtract ordinary damage from it.`,
    disposition: { combatantType: "monster", stance: "enemy", referenceOnly: false },
    special_abilities: [
      { name: "Kill rule — apply manually", desc: kill },
      ...(index === "runner" ? [{ name: "Two actions", desc: "Two actions per activation." }] : []),
      phase,
      { name: "Dragon Fire and area spells", desc: "Dragon Fire kills everything in its zone, including allies. An area spell kills a zombie that fails its save; a Fatty dies only if the damage rolled is at least 10. This module does not print zombie saving throw modifiers." },
      { name: "Zombicide experience", desc: "1 kill XP toward Zombicide Danger Level, not a fifth-edition CR or XP award." },
    ],
    actions: [{ name: "Zombie attack", desc: `Attacks a PC or NPC in its zone, +${bonus} to hit; each hit deals ${damage} damage. Damage type is not specified in the module.`, attack_bonus: bonus }],
  };
}
function cellarer(level: 2 | 3): CreatureProfile {
  return {
    index: `until-first-light-cellarer-level-${level}`, name: `The Cellarer (Abomination, level ${level} party)`,
    hp: level === 2 ? 60 : 80, ac: 15, cr: "—", type: "undead", size: "",
    source: UNTIL_FIRST_LIGHT_SOURCE, sourcePage: 12,
    description: `${sourceNote} Brother Ithel, the commandery's cellarer, bloated and blackened after sealing the sick and the last food in the cellar. This is the ${level}${level === 2 ? "nd" : "rd"}-level-party variant.`,
    disposition: { combatantType: "monster", stance: "enemy", referenceOnly: false },
    vulnerabilities: ["fire"],
    special_abilities: [
      { name: "Attacks ignore armor", desc: "Its attacks always hit. Do not roll an attack or invent an attack bonus." },
      { name: "Dragon Fire", desc: "Takes double fire damage. Dragon Fire kills it outright, regardless of remaining HP." },
      phase,
      { name: "Zombicide experience", desc: "5 kill XP toward Zombicide Danger Level, not a fifth-edition CR or XP award." },
    ],
    actions: [{ name: "Abomination attack — automatic hit", desc: "Attacks a target in its zone. Always hits, ignoring armor. Deals 1d4 damage; the module does not specify a damage type." }],
  };
}
function shepherd(level: 2 | 3): CreatureProfile {
  const threshold = level === 2 ? 22 : 30;
  return {
    index: `until-first-light-shepherd-level-${level}`, name: `The Shepherd (level ${level} party)`,
    hp: level === 2 ? 45 : 60, ac: 13, cr: "—", type: "monstrosity", size: "Large",
    source: UNTIL_FIRST_LIGHT_SOURCE, sourcePage: 12,
    description: `${sourceNote} Tall and many-jointed, with a deer's skull for a face. Source discrepancy: the overview table lists AC 12; the detailed Shepherd statblock lists AC 13, used here. This is the ${level}${level === 2 ? "nd" : "rd"}-level-party variant.`,
    disposition: { combatantType: "monster", stance: "neutral", referenceOnly: false },
    speed: { special: "As a Zombicide Necromancer; numerical speed is not printed." },
    conditionImmunities: ["charmed", "frightened"], senses: "truesight 120 ft.",
    special_abilities: [
      { name: "Shepherd of the Dead", desc: "Neutral: it never attacks until Cornered. Arrives with its own Spawn token and flees toward the nearest other Spawn Zone, following Zombicide Necromancer rules." },
      { name: "Cornered", desc: `At ${threshold} HP or fewer, it stops fleeing, moves toward the nearest visible PC or NPC and attacks when sharing their zone. The module explicitly prints ${threshold} as the cutoff for this variant.` },
      { name: "Dread of the Horde", desc: "A PC or NPC starting its turn with the Shepherd in sight makes a DC 12 Wisdom save. On a failure, it is frightened until its next turn and cannot move closer. A success grants immunity for the night." },
      { name: "Legendary actions — Cornered only", desc: "3 per round, one at the end of any PC's or NPC's turn; regained at the start of the Zombies' Phase." },
      { name: "Spawn stakes", desc: "Killing the Shepherd removes a Spawn token of the party's choice. If it escapes, its token becomes a standard Spawn token. If it escapes while 3 Spawn tokens are already on the board, extend the eclipse by 2 rounds." },
      phase,
      { name: "Zombicide experience", desc: "1 kill XP toward Zombicide Danger Level, not a fifth-edition CR or XP award." },
    ],
    actions: [{ name: "Claws — Cornered only", desc: "Two attacks against targets in its zone, +5 to hit, 1d6 + 2 slashing damage each.", attack_bonus: 5, damage: [{ damage_dice: "1d6 + 2", damage_type: "slashing" }] }],
    detailedActions: [
      { name: "Step Through the Miasma (Recharge 5–6)", category: "reaction", description: "When it takes damage, it dissolves and reappears, ignoring walls and doors. Roll d8 for direction (1 N, 2 NE, 3 E, 4 SE, 5 S, 6 SW, 7 W, 8 NW; north is the map's top) and d3 for zones. Stop at the board edge if the move would leave the board. Not used once Cornered." },
      { name: "Blink — Cornered only", category: "legendary", description: "Vanish into the miasma and reappear in any open zone it can see within 3 zones. Uses the printed legendary action rules: 3 per round, one at the end of any PC's or NPC's turn, refreshed at the start of the Zombies' Phase." },
    ],
  };
}

export const untilFirstLightProfiles: CreatureProfile[] = [
  zombie("walker", "Walker (Until First Light)", 8, 3, 1, "Any hit kills. The tracker starts at 1 only as an alive/dead counter, not printed HP.", "The Walkers were refugees: farmers, mothers and a tinker, some wearing the commandery's open-hand alms badge."),
  zombie("runner", "Runner (Until First Light)", 12, 4, 1, "Any hit kills. The tracker starts at 1 only as an alive/dead counter, not printed HP.", "The Runners were the commandery's fitter, faster lay brothers in black tabards."),
  zombie("fatty", "Fatty (Until First Light)", 10, 5, 2, "Killed by one hit dealing 10+ damage OR two hits in the SAME turn. No cumulative HP is printed. The tracker starts at 2 as an optional hit counter: decrement per hit, not per damage point; reset the counter to 2 after each turn if still alive. A 10+ damage hit kills immediately.", "The Fatties are the drowned, swollen from the well."),
  cellarer(2), cellarer(3), shepherd(2), shepherd(3),
  {
    index: "until-first-light-survivor-group", name: "Survivor Group (Until First Light, 3 people)",
    hp: 12, ac: 10, cr: "—", type: "humanoid", size: "", source: UNTIL_FIRST_LIGHT_SOURCE, sourcePage: 11,
    description: "A survivor token represents 3 villagers, stragglers or prisoners. The module uses 4 such tokens for 12 survivors. This is one token, not an individual or a player character. No ability scores, hit dice, numerical speed or CR are printed.",
    disposition: { combatantType: "npc", stance: "ally", referenceOnly: false },
    actions: [],
    special_abilities: [
      { name: "Noncombatants", desc: "No attacks. AC 10 and 12 HP are per three-person token." },
      { name: "Every 4 HP lost", desc: "One person dies for every 4 HP the token loses and rises as a Walker in that zone at the next Spawn step." },
      { name: "Rescue and movement", desc: "A PC in the same zone with no zombies can spend an action to take a group under their lead; it then moves with that PC. Orcs can claim groups in the same way. Taking an orc-led group requires bargain or force." },
      { name: "Noise", desc: "Each group counts as 1 Noise, like any miniature." },
      { name: "Zombie targets", desc: "The players may assign zombie attacks to survivor groups." },
    ],
  },
].map(profile => creatureProfileSchema.parse(profile));
