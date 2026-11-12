import { creatureProfileSchema, type CreatureProfile } from "../../shared/creatureProfiles";
import { createPreparedEncounterSnapshot } from "../../shared/encounterRecovery";

// Server-only, campaign-private content. Never import this module into a client/demo bundle.
export const SESSION5_SOURCE = "Aetherfall Session 5 — The Hand That Feeds";
export const SESSION5_IMPORT_KEY = "campaign-content:aetherfall:session-5:the-hand-that-feeds";
const action = (name: string, desc: string, attack_bonus?: number) => ({
  name, desc, ...(attack_bonus === undefined ? {} : { attack_bonus }),
});
const trait = (name: string, desc: string) => ({ name, desc });
const aggressive = trait("Aggressive", "As a bonus action, move up to its speed toward a hostile creature it can see.");
const ashenDeath = trait("Ashen Death", "At 0 hit points, crumbles to grey-white ash. Bears no runes.");
const infect = (uses: number, dc: number, creature: string) => action(`Infect (${uses}/Day)`,
  `Instead of Multiattack, the ${creature} chooses one creature within 5 feet that is below its hit point maximum. DC ${dc} Constitution saving throw or gain 1 stage of Blighted. A creature cannot gain more than 1 stage from Infect in a 24-hour period. Attacks alone never advance anyone to stage 5. Track uses and exposure manually.`);
const base = (index: string, name: string, sourcePage: number): Partial<CreatureProfile> => ({
  index: `aetherfall-s5-${index}`, name, source: SESSION5_SOURCE, sourcePage, speed: { walk: "30 ft." },
});
const axe = action("Greataxe", "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 9 (1d12 + 3) slashing damage.", 5);
const javelin = action("Javelin", "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 6 (1d6 + 3) piercing damage.", 5);

export const session5CombatProfiles: CreatureProfile[] = [
  {
    ...base("sergeant", "Enthralled Sergeant", 9), hp: 38, ac: 14, cr: "2",
    hit_dice: "5d8 + 15", size: "Medium", type: "humanoid (orc, Enthralled)", alignment: "chaotic evil",
    str: 16, dex: 12, con: 16, int: 9, wis: 11, cha: 12,
    resistances: ["necrotic"], senses: "darkvision 60 ft., passive Perception 10", languages: "Common, Orc",
    description: "Blight stage 5 (Enthralled). Intimidation +3. AC includes hide armor and blackened hide. Directs the loading at Felin Grange. Recognizes Ruadh and prioritizes killing him. Always hostile; never joins the truce. At the start of round 3 OR on first reaching 19 HP or less, whichever comes first, calls the Ashen over the north wall. This trigger is manual.",
    special_abilities: [aggressive,
      trait("Brood-Known", "Ashborn never willingly target the sergeant with attacks or Infect."),
      trait("The Hunger", "Advantage on attack rolls against a creature that has fewer than half its hit points."),
      trait("Runes in the Black", "At 0 HP, faint runes flare briefly in the black of his chest, then gutter out. The body stays. In that instant only, DC 20 Perception notices eight marks; a reader of Draconic sees a T in the familiar three-slash pillar rune. DC 15 Intelligence afterward can sketch the familiar rune and two others. Describe shapes only.")],
    actions: [axe, javelin, action("Point the Brood (Bonus Action)",
      "Point at a creature the sergeant can see. One Ashborn within 60 feet that can see the sergeant may use its reaction to move up to half its speed toward that creature and make one Bite or Claw attack. Cannot use this and Aggressive on the same turn.")],
  },
  {
    ...base("ashborn-hobgoblin", "Ashborn Hobgoblin", 9), hp: 30, ac: 15, cr: "1",
    hit_dice: "4d8 + 12", size: "Medium", type: "monstrosity (Ashborn)", alignment: "neutral evil",
    str: 15, dex: 12, con: 16, int: 8, wis: 10, cha: 8,
    resistances: ["necrotic"], senses: "darkvision 60 ft., passive Perception 10",
    languages: "understands Common but cannot speak",
    description: "Session 5 printed version replaces this campaign's earlier Ashborn Hobgoblin library statistics. Three visible black veins indicate remaining Infect uses. Roll a d3 each turn: 1 bite, 2 claw, 3 Infect; if Infect is unavailable, use Multiattack. The behavior table says claw, but this printed statblock has Longsword instead of Claw: no Claw action has been invented. Resolve that discrepancy manually. Goes for wounded creatures and captives; does not willingly target the sergeant.",
    special_abilities: [ashenDeath, trait("Pitch Frenzy",
      "When no Infect uses remain OR at 15 HP or less, becomes frenzied until death: advantage on melee attack rolls, and attack rolls against it have advantage.")],
    actions: [action("Multiattack", "Makes one Bite attack and one Longsword attack."),
      action("Bite", "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.", 4),
      action("Longsword", "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.", 4),
      infect(3, 13, "hobgoblin")],
  },
  {
    ...base("ashborn-goblin", "Ashborn Goblin", 10), hp: 16, ac: 13, cr: "1/2",
    hit_dice: "3d6 + 6", size: "Small", type: "monstrosity (Ashborn)", alignment: "neutral evil",
    str: 10, dex: 14, con: 14, int: 6, wis: 8, cha: 6,
    resistances: ["necrotic"], senses: "darkvision 60 ft., passive Perception 9", languages: "—",
    description: "Session 5 printed version replaces the earlier campaign library statistics. One visible black vein indicates its one Infect use. Roll d3 each turn: 1 bite, 2 claw, 3 Infect. If Infect is unavailable, use Multiattack. Prefers wounded creatures and captives. No Pitch Frenzy is printed for this creature.",
    special_abilities: [ashenDeath],
    actions: [action("Multiattack", "Makes one Bite attack and one Claw attack."),
      action("Bite", "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) piercing damage.", 4),
      action("Claw", "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 4 (1d4 + 2) slashing damage.", 4),
      infect(1, 12, "goblin")],
  },
  {
    ...base("orc", "Orc", 10), hp: 15, ac: 13, cr: "1/2", hit_dice: "2d8 + 6",
    size: "Medium", type: "humanoid (orc)", alignment: "chaotic evil",
    str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10,
    senses: "darkvision 60 ft., passive Perception 10", languages: "Common, Orc",
    description: "Session 5 appendix version. Intimidation +2. Three orcs in the yard (two at carts; one at captives), plus one additional orc mounted on a worg at the road. When Ashen arrive, surviving yard orcs cease attacking the party. DC 12 Persuasion or Intimidation makes them active allies; automatic if Ruadh calls in Orc. Without a truce they defend themselves or flee. Afterward take one cart unless stopped. The rider bolts with its worg.",
    special_abilities: [aggressive], actions: [axe, javelin],
  },
  {
    ...base("worg", "Worg", 10), hp: 26, ac: 13, cr: "1/2", hit_dice: "4d10 + 4",
    size: "Large", type: "monstrosity", alignment: "neutral evil", speed: { walk: "50 ft." },
    str: 16, dex: 13, con: 13, int: 7, wis: 11, cha: 8,
    senses: "darkvision 60 ft., passive Perception 14", languages: "Goblin, Worg",
    description: "Perception +4. Waits outside the road gate with its orc rider; balks at the Ashen and bolts with the rider when they arrive.",
    special_abilities: [trait("Keen Hearing and Smell", "Advantage on Wisdom (Perception) checks relying on hearing or smell.")],
    actions: [action("Bite", "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage. A creature hit must succeed on a DC 13 Strength saving throw or be knocked prone.", 5)],
  },
  {
    ...base("boar", "Boar", 10), hp: 11, ac: 11, cr: "1/4", hit_dice: "2d8 + 2",
    size: "Medium", type: "beast", alignment: "unaligned", speed: { walk: "40 ft." },
    str: 13, dex: 11, con: 12, int: 2, wis: 9, cha: 5,
    senses: "passive Perception 9", languages: "—",
    description: "Two boars in harness at Felin Grange. A charm, fright or cut trace stampedes them through the yard. They are a neutral harness team, not additional mandatory enemies.",
    special_abilities: [
      trait("Charge", "If the boar moves at least 20 feet straight toward a target and hits it with Tusk that turn, deal an extra 3 (1d6) slashing damage. A creature target must make a DC 11 Strength saving throw or be knocked prone."),
      trait("Relentless (Recharges after a Short or Long Rest)", "Damage of 7 or less that would reduce the boar to 0 HP reduces it to 1 HP instead.")],
    actions: [action("Tusk", "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.", 3)],
  },
  {
    ...base("liora", "Liora Holdt", 12), hp: 13, ac: 13, cr: "—", hit_dice: "3d8",
    size: "Small", type: "humanoid (human child, about 11); Expert sidekick (3rd level)",
    str: 8, dex: 14, con: 10, int: 15, wis: 13, cha: 12, savingThrows: { dex: 4 },
    description: "Printed Expert sidekick, not a pregen PC. Proficiency +2; Investigation +6, Insight +3, Medicine +5, Stealth +4; healer's kit and herbalism kit. No challenge rating, alignment or senses are printed. Act I healing is herbs and a healer's kit, never spellcasting. Protects/rescues captives instead of taking the front line. If Garran drops to 0 HP, ears ring for everyone within 30 ft., nobody is knocked prone, and the source is not apparent. Secret: Blight does not progress in creatures remaining near her; do not reveal why. No lessons are marked learned automatically.",
    disposition: { combatantType: "npc", stance: "ally", referenceOnly: false },
    special_abilities: [
      trait("Helpful", "Can take the Help action as a bonus action."),
      trait("Cunning Action", "Can take Dash, Disengage or Hide as a bonus action."),
      trait("Expertise", "Doubled proficiency bonus for Investigation and Medicine (already included in printed skills)."),
      trait("Hedge Healer", "As an action, expend one healer's-kit use: a creature regains 1d6 + 2 HP. Once per creature per short rest. Nonmagical; no cast check."),
      trait("Down, Not Dead", "At 0 HP, falls unconscious and stabilizes automatically. Track this manually; normal tracker death rules do not implement it automatically.")],
    actions: [action("Smallsword", "Melee Weapon Attack: +2 to hit (+4 once Hold the Blade is learned), reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage. Lesson acquisition is the table's choice.", 2),
      action("Dagger", "Melee or Ranged Weapon Attack: +4 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.", 4)],
  },
].map(p => creatureProfileSchema.parse(p));

const referenceNPC = (name: string, description: string, sourcePage: number, stance: "ally" | "neutral" = "neutral") =>
  creatureProfileSchema.parse({ ...base(`reference-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, sourcePage),
    hp: 0, ac: 0, cr: "—", size: "—", type: "NPC reference; no printed combat statistics",
    description: `Reference only: this chapter supplies no combat statblock. ${description}`,
    disposition: { combatantType: "npc", stance, referenceOnly: true }, actions: [] });
export const session5ReferenceProfiles = [
  referenceNPC("Sergeant-Brother Iestyn", "Restored Ilmater knight of Llwyncoed. Quiet, careful, close to breaking; wants the Sword of Answering returned and the dead properly buried. DC 13 Insight sees his strain. Will not fight the party over the relic. If carried under oath, rides as witness and Liora's teacher. Knows the Chapel of the Last Oath in Siorlas, but does not promise the sword's brother survives. Does not replace any actual knight statblock.", 3),
  referenceNPC("Brother Cadfael", "Llwyncoed's almoner; dead at the ford for about two weeks, with two lay brothers. Satchel contains Emerus's sealed second letter. Deceased reference, not a combatant.", 5),
  referenceNPC("Brother Hywel", "Hallowmere brother; dead at the ford for about three weeks, with three lay brothers and two burned wagons. Gethin's reply is sewn into his tabard. Grain stolen; purses and iron fittings untouched. Deceased reference.", 5),
  referenceNPC("Prior Gethin", "Offstage prior answering for Hallowmere's absent Abbot. Plain, honest and worried; wants his houses fed through winter. His reply proves Hallowmere answered Emerus. The Abbot went to Calladris; two brothers sent after him have not returned.", 11),
  referenceNPC("The Convoy Captain", "Warm, tired and proud of feeding raided farms. Leads six grain wagons and twelve riders bearing a wheat sheaf bound in a gold chain. Says the king is ill and the Marrow will make the roads safe as Protector. Do not conflate with the first-light captain.", 4),
  referenceNPC("Ruadh", "Gormach archer who fled the caravan fight. Hungry, wary and blunt; stole bread and his captain's last letter. Wants to live and not be made quiet. Will guide the party to Felin Grange in exchange for freedom; will not betray them, but the band recognizes him. His Orc-language truce call succeeds automatically. He is not assigned the generic Orc statistics without the DM's choice.", 5),
  referenceNPC("Reeve Ifor", "Brodyr reeve of Felin Grange. Proud, then shaken. Captive with five tenants and two Hallowmere lay brothers: eight captives TOTAL. Recognizes the tally as houses and counts he gave the duke's steward at Harvest-tide. Offers the loft for the night. If Solene triggers, the heirloom is his grandmother's pewter-and-stone brooch.", 6),
  referenceNPC("The Riders' Captain", "The duke's man arriving at Felin at first light. Hearty, generous, too quick to ask for the tally and letters 'for my lord's justice'. Riders return stolen grain as charity and burn Ashen remains knowingly. DC 14 Insight notices the captain has done this before; he keeps his gloves on. No combat block or rider count is printed for this arrival.", 8),
  referenceNPC("Garran", "Travels with the party and Liora. This chapter does not provide his combat statistics: use his established campaign version, not invented values. Knows Ruadh's company caged the prisoners. Can teach Liora, but his sword stays off-limits until after Doras na Sióg. At 0 HP triggers Liora's small echo, not her full surge.", 11, "ally"),
];

export const session5Notes = `# Session 5 — The Hand That Feeds
DM PREPARATION / ADVENTURE REFERENCE — not a record of completed play.
Source: Aetherfall_Session_5.pdf, 16 PDF pages. Printed page numbers match PDF pages.
Act I, Part One: The Ash Road. About three hours; four 3rd-level characters plus Garran and Liora.

## Run order and continuity (pp. 2–8)
1. The Rider at Dusk: camp outside Llwyncoed after the siege; Iestyn reckons with the relic.
2. The Ash Road: column's trail, returning Blight, relief convoy.
3. The Ford: crossed letters and dead couriers.
4. The Archer at the Fire: Ruadh, the treaty and the steward's letter. Can precede The Ford if the party camps early.
5. Felin Grange: raid, Ashen reinforcements, grain choice, tally and runes.
6. Dawn/fork: Hallowmere (default), the column east, or the grain south.
Freed Session 3 prisoners who survived Chapter 4 remain at Llwyncoed. Do not add them to this encounter. Garran and Liora travel with the party.
Before play: decide whether Emerus was the first necromancer; confirm Esteros's boons were not spent; ready Blight stages; track who recognizes the Marrow seal. Reeve Ifor's loft offers a night's shelter.

## Secrets and house rules
Never reveal Sideron's name, a link to the Chancellor, the duke's personal name, that the king is stone, or the runes' identities. Public knowledge: the king is ill. Identify the duchy only as the Marrow. Describe rune shapes, never their cosmology.
DM truth: the Duke of the Marrow pays starving Gormach orcs in grain to raid northern houses, then returns stolen grain as charity. Hallowmere is spared for his staged rescue and bid to become Lord Protector. Sideron licensed auxiliaries under the King's Peace; the writ's rune grants the shamans exemption. The Maw is unaware of these individuals but feeds through the Blight. The duke is Blighted stage 4; corrupted orcs stages 2–3; the Felin sergeant is stage 5 (Enthralled). The absent Abbot reached Calladris and is already stone; do not hint.
Cast checks resume off Llwyncoed's ground; scrolls are exempt but spells learned from scrolls are not. Loot stays kept. Natural 1s still succeed with consequences. First frost now; save first snow for the session end or next time.
The first patron/oath-granted power used on blighted ground (seals, invocations, smite) rolls its damage twice and keeps the lower: dimmer, cold-ash smell. Once this session only; do not explain it.
Solene: if carried, roll DC 17 at the start; on a hit use Ifor's grandmother's pewter-and-stone brooch. The concession lands mid-raid or after with grieving Ifor. Esteros does not collect; save for Calladris.

## The Rider at Dusk (pp. 3–4)
Iestyn is not an accuser and will not fight the party. DC 13 Wisdom (Insight): barely holding together.
If Emerus was the first necromancer: "We found the prior by the east wall, in his habit, with his crook. He told us it was wolves." Otherwise: "The prior is gone. No body."
Return the Sword of Answering: witness under Ilmater's open hand; arrive as the ones who ended the night; he freely mentions the brother.
Carry under oath: may wield, not keep; Iestyn accompanies as witness and Liora's teacher.
Refuse: he rides ahead; arrive as relic thieves; no information about the brother.
Never took it: he asks its last location and searches; no witness/relic-thief outcome.
Outside the order the sword remains cold and unanswering. Its brother belonged to an order of judgment rather than mercy; last sanctum is the Chapel of the Last Oath across the river in Siorlas. Later-arc seed, not an acquired item or a guaranteed blade.
Either way he mentions Cadfael's missing letter and Hallowmere's apparent silence, the back road past Felin, and prayers for the king since Harvest-tide. If he stays, gives Liora a novice smallsword and teaches Hold the Blade at camp.

## The Ash Road (p. 4)
DC 12 Survival follows heavy cart ruts; DC 15 also finds the smaller band splitting toward Felin. DC 13 Survival reads goblin-sized bare footprints with too many toes, following the column a day behind. Ash is the same as Ashborn death at Redhold. Birds present but silent; no insects or wind in leaves.
Relief convoy: six wagons, twelve riders, wheat sheaf in gold chain. Captain says "The crown sends prayers. My lord sends bread. When he is Protector, these roads will be safe." King: "Ill. The Seven keep him." DC 12 History recognizes the Marrow badge; record the player. DC 15 Investigation finds farm-branded sacks heading toward raided farms, not away from a granary.

## The Ford (pp. 4–5)
Two burned wagons: Hywel and three Hallowmere lay brothers, dead about three weeks; grain gone, coins/fittings untouched (DC 12 Investigation); Prior's reply sewn in Hywel's tabard.
Dead horse: Cadfael and two Llwyncoed lay brothers, dead about two weeks; satchel untouched, Emerus's sealed second letter inside.
Three-slash arrow fletching at both sites. DC 14 Insight or Investigation concludes someone knew both couriers used the back road. Hallowmere answered; the answer died yards from the unanswered plea. Gethin says the Abbot and two searchers have not returned from Calladris.

## Ruadh at the fire (pp. 5–6; map p. 15, 5-foot squares)
Horses scream; hungry injured Ruadh is caught with stolen bread. Older blue clan paint remains beneath his black rune. Treaty-breakers are "made quiet"; do not explain.
Trust reveals: Gormach shamans lost magic, pitch-sick herds died, a steward offered grain, king's seal-men inked the writ; marked shamans still cast. Ashborn wounds bring black skin and cruelty; some become calm and the Ashborn leave them alone. Nobody has seen the master; letters know the grain and pay is grain. Ruadh has the captain's last letter. A smaller band hits Felin at dusk led by a black one.
Guide to Felin in exchange for walking free; he will not betray them. Garran remembers the cages: killing, binding or trusting him are player choices. The sergeant recognizes him and prioritizes killing him. Ruadh's Orc-language truce call automatically rallies surviving orcs against the Ashen.

## Felin Grange — raid and wave management (pp. 6–10; map p. 16)
STANDARD D&D, NOT ZOMBICIDE. Dusk yard is dim; barn and granary dark. Timber granary burns easily; winter grain is the cost of fire. Eight captives: Ifor + five tenants + two Hallowmere lay brothers, unarmed and roped by the barn. No captive combat stats are printed.
Raid: 1 Enthralled Sergeant; 3 yard orcs (2 loading, 1 guarding captives); 1 additional mounted orc and its separate worg outside the road gate; 2 harness boars. The mounted orc is NOT an extra fifth orc. Liora helps free captives and treat wounds. Add the actual party and Garran from the campaign yourself; no PC roster is overwritten.
Wave trigger: START OF ROUND 3 OR the FIRST time the sergeant reaches 19/38 HP or less, whichever occurs first. Add 1 Ashborn Hobgoblin and 3 Ashborn Goblins from Homebrew to the ongoing tracker. They cross the NORTH wall behind the barn, ignore grain, and target wounded creatures/captives. The source's reinforcements are not active at round 1.
Prepared reinforcement rosters are references/standalone setup aids: loading a prepared encounter replaces the current tracker. Do NOT load them on top of the active raid. Add the matching creatures with the mid-combat Homebrew controls instead; preserve the ongoing round/HP/conditions.
At their arrival, surviving yard orcs stop attacking the party. DC 12 Persuasion/Intimidation or Ruadh calling in Orc creates active allies for the rest of the fight; change stance manually. Without truce they defend themselves/flee. Sergeant stays hostile; worg bolts with rider. Afterward orcs take one cart unless stopped.
Difficulty: raid alone about Hard for four level-3 PCs and Garran. Ashen substitute for pressure from the orcs, not a stacked mandatory hostile army. Lighter: 2 goblins instead of 3. Harder: Ashen at round 2 instead of 3.
Boars stampede if charmed, frightened or traces cut. Two loaded carts; stone reeve's house has one door; barn north, raised granary east, reeve's house southwest, gate south, Ashen over north wall.
Any victory counts: free captives, save carts, rout band, or defeat Ashen.

## Blight and special mechanics — manual tracking (pp. 3, 7, 9–12)
Only Ashborn infect living bodies. Black Pitch alone never infects; Blighted and Enthralled creatures cannot infect.
Infect REPLACES Multiattack, requires a target within 5 feet below its HP maximum, and expends a use: goblin 1/day DC 12 CON; hobgoblin 3/day DC 13 CON. Failure adds one Blighted stage; maximum one stage from Infect in 24 hours; attacks never advance to stage 5. Describe a visible black vein dimming each use. The PDF gives no full stage 1–4 mechanical penalties or progression schedule; do not invent them.
Ashborn AI d3: 1 bite, 2 claw, 3 Infect; if no valid Infect use, Multiattack. SOURCE DISCREPANCY: hobgoblin block has Longsword, not Claw; resolve the behavior table manually, never invent a Claw attack.
Hobgoblin Pitch Frenzy at 15 HP or less or zero Infect uses; grants and suffers melee attack advantage until death. Goblin has NO printed Pitch Frenzy.
Brood-Known protects sergeant from willing Ashborn targeting. Point the Brood is a bonus action, chosen instead of Aggressive; an Ashborn within 60 feet that can see him spends its reaction to move half speed and Bite or Claw.
Secret: infection does not progress near Liora; nobody notices and no explanation is given.
Garran at 0 HP triggers Liora's small echo: ears ring within 30 feet; nobody prone. Save full surge for Doras na Sióg.
Liora at 0 HP stabilizes automatically. Her Hedge Healer is nonmagical, healer's kit 1 use, 1d6+2 HP, once per creature per short rest. Track manually.
Sergeant dies bodily: runes flare briefly. Only then DC 20 Perception glimpses eight marks; Draconic identifies a T in the familiar three-slash pillar. DC 15 Intelligence afterward sketches that and two others. Shapes only. Ashborn have no runes and crumble to ash.

## Liora's lessons (pp. 11–12)
One per long rest, player-run teaching scene; none auto-awarded in the library. Hold the Blade occurs at the first camp if the story permits; players choose lesson at Ruadh's camp. No Act I spellcasting; she pockets one scrap after each fight for later Machinist stock.
- Hold the Blade, Garran/sword-user: rapier proficiency; printed Smallsword attack increases from +2 to +4, damage stays 1d8+2.
- Stand Your Ground, Garran: reaction +2 AC against one melee attack while holding a rapier.
- Fight Ugly, brawler: once/short rest, advantage attacking a creature that hit her since her last turn.
- Sigils, wizard/Illrigger: Arcana proficiency, read/copy seals and spellbook script, cannot empower them.
- How It Works, firearm/tinker's tools user: tinker's tools; action fixes adjacent ally's weapon after natural-1 malfunction.
- Songs and Brass, bard/performer: History proficiency; once/session recall a ballad clue; once/long rest ally adds 1d4 to one roll.
Garran's sword is not hers until after Doras na Sióg.

## Handouts — transcribed from embedded images (pp. 13–14)
### The Prior's Letter — sewn into Hywel's tabard
To Emerus, Prior of Llwyncoed,
from Gethin, Prior of Hallowmere,
in the open hand of Ilmater.
"Your letter of the 18th reached us, and I thank God your wood is clean, for little else is. Ash has fallen on the villages west of us since harvest. Some were raided; some simply sickened. Their people come to our gate asking what is happening, and we have no answer to give them. We are four hundred under this roof and more each week.
When the first villages fell, our Father Abbot went to Calladris to seek counsel of the Grand Master and the Bishop, for if anyone knows what this is, they will. That was before the feast of Harvest-tide. He has not returned, and we have had no word. I sent two brothers after him; they have not returned either. I tell the house he is detained in council. I pray it is so.
Until he returns, I answer for him. Two wagons of grain go with this letter under Brother Hywel, though we can ill spare them, by the back road; the river road is not safe. Keep the gates. Keep the sick. Write to me again if you are able, and pray for our Father."
The 26th of Mistvale, 1426 A.E. — Gethin.
### Emerus's Second Letter — Cadfael's sealed satchel
"Father, I write again having had no answer to my last.
The wood is still clean, but I no longer think it kind.
There are no birds. There have been none since harvest,
and I do not know when I stopped hearing them.
The sick die easily here, in their sleep, without struggle.
Twice now the bodies have been gone from their pallets by
morning. The brothers on watch saw nothing. I
have told the house it was wolves. I ask you, as my superior,
to tell me what I should have told them."
Address: To the Reverend Abbot of Hallowmere, by the hand of Brother Cadfael, Almoner of Llwyncoed.
### The Steward's Letter — Ruadh's stolen letter
"To the captain of the painted company.
Felin holds four hundred bushels by the reeve's own count. Llwyncoed and Hallowmere send by the back road, never the King's road; hold the ford. Let nothing pass between the houses.
Take the grain.
Hallowmere itself is not to be touched.
Leave the reeve and his people alive. My lord's riders come to Felin at first light after. Your pay is at the usual place, as before."
### The Tally — charcoal on hide carried by the sergeant
Crossed out: Cil-y-Dŵr grange; Pont Hen mill; Llwyncoed road.
Remaining: Felin.
"Hallowmere — last. Not to be touched."
The prose says house counts match Ifor's records; the handout image contains no numerical counts. Preserve that discrepancy rather than adding invented numbers.

## Dawn, evidence and next session (p. 8)
Riders arrive too late, return stolen grain as charity, burn Ashen remains without comment. DC 13 Investigation identifies Cil-y-Dŵr/Pont Hen sack marks; DC 14 Insight sees the captain's familiarity. He wants tally and letters; handing them over is a genuine evidence choice.
If the party refused the relic, the sergeant carries a novice smallsword for Liora taken from a dead lay brother. Do not award it again if Iestyn already gave one.
Default Hallowmere: escort captives and grain, letters/tally/sword; the column gains ground. Follow column east: speed/surprise if Ruadh guides, but captives/grain are undefended and passes close. Follow grain south: Marrow trail toward Calladris, furthest from Osric's charge; steer first to Hallowmere. Each unpursued session costs another house on the tally. If accompanying them, Iestyn can take captives to the abbey.
Maps remain in the supplied PDF: party camp p. 15, Felin Grange p. 16. Handouts are adventure evidence, not automatic loot draws. No completed-play history, lesson choices, infection stages, party membership or active combat has been changed by this import.`;

function combatant(profile: CreatureProfile, key: string, count = 1, name = profile.name, stance: "ally" | "neutral" | "enemy" = "enemy") {
  return {
    id: `aetherfall-s5-${key}`, name, hp: profile.hp, maxHp: profile.hp, ac: profile.ac,
    initiative: 0, initiativeRolled: false, conditions: [], tempHp: 0, isDown: false,
    deathSaveSuccesses: 0, deathSaveFailures: 0, isStable: false, isDead: false,
    combatantType: profile.disposition?.combatantType ?? "monster", isMonster: !profile.disposition,
    stance, monsterData: { ...profile, dexMod: Math.floor(((profile.dex ?? 10) - 10) / 2) },
    isGroup: count > 1,
    ...(count > 1 ? { memberHp: Array(count).fill(profile.hp), memberMaxHp: Array(count).fill(profile.hp),
      memberConditions: Array.from({ length: count }, () => []), memberConditionDurations: Array.from({ length: count }, () => ({})) } : {}),
  };
}
export function session5PreparedEncounters() {
  const [sergeant, hobgoblin, goblin, orc, worg, boar, liora] = session5CombatProfiles;
  const entries = [
    { name: "Session 5 — Felin Grange — Raid", combatants: [
      combatant(sergeant, "sergeant"), combatant(orc, "yard-orcs", 3, "Orc — yard"),
      combatant(orc, "mounted-orc", 1, "Orc — worg rider"), combatant(worg, "worg"),
      combatant(boar, "boar-team", 2, "Boar — harness team", "neutral"),
      combatant(liora, "liora", 1, liora.name, "ally"),
    ], notes: "Raid: 1 sergeant, 4 orcs TOTAL including mounted rider, 1 worg, 2 neutral boars, and Liora as ally. Add your PCs and Garran separately. At start of round 3 OR sergeant first at 19 HP or lower: add 1 Ashborn Hobgoblin + 3 Ashborn Goblins using Homebrew mid-combat controls. DO NOT load a reinforcement template over active combat. Apply truce, worg flight, infection and triggers manually; see Session 5 DM notes." },
    { name: "Session 5 — Felin Grange — Ashen Reinforcements (roster only)", combatants: [
      combatant(hobgoblin, "wave2-hobgoblin"), combatant(goblin, "wave2-goblins", 3),
    ], notes: "Reinforcement roster ONLY. Loading replaces the current tracker: add these 4 creatures via Homebrew during the active raid instead. Start of round 3 OR sergeant at 19 HP or less. Orcs cease attacking party; DC 12 truce or Ruadh auto-success makes them allies; sergeant remains hostile and mounted pair flees." },
    { name: "Session 5 — Felin Grange — Lighter Ashen Reinforcements (roster only)", combatants: [
      combatant(hobgoblin, "light-hobgoblin"), combatant(goblin, "light-goblins", 2),
    ], notes: "Source's lighter option: 1 hobgoblin + 2 goblins INSTEAD OF normal reinforcements; never add both variants. Loading replaces current tracker, so add via Homebrew mid-combat. Source's harder option changes arrival to round 2; it does not add extra creatures." },
  ];
  return entries.map(entry => {
    const data = createPreparedEncounterSnapshot<ReturnType<typeof combatant>>({ combatants: entry.combatants, round: 1, activeIndex: 0,
      combatState: "setup", selectedVersions: ["5e"] });
    if (!data) throw new Error("Invalid Session 5 prepared roster");
    // Put guidance inside visible profiles as well as metadata, which the tracker may normalize away.
    data.combatants[0].monsterData.description += `\nENCOUNTER PREP: ${entry.notes}`;
    return { name: entry.name, data: { ...data, source: SESSION5_SOURCE, sourcePage: 6, prepNotes: entry.notes } };
  });
}
