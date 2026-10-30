import type { SessionDetail } from "@shared/journal";
import { PHANDELVER_ENCOUNTERS } from "./encounters";
import { PHANDELVER_PREGENS } from "./pregens";

const briefings: [key: string, title: string, pages: string, body: string, locations: string[]][] = [
  ["overview", "00 — Campaign briefing & demo guide", "2–4, 51",
    `DM PREPARATION — SPOILERS. This is an adventure reference, not a record of completed play.

Gundren Rockseeker hires the party to escort supplies from Neverwinter to Phandalin. His brothers have found Wave Echo Cave, site of the Phandelver's Pact and its lost Forge of Spells. Nezznar, the Black Spider, is using the Cragmaws and Redbrands to seize the mine.

Progression: follow the ambush trail → rescue Sildar → investigate Phandalin and the Redbrands → pursue regional leads and rescue Gundren → confront the Black Spider in Wave Echo Cave. The side quests can be approached in different orders.

DEMO USE: select this campaign, open Initiative → Prepared Encounters, load a roster, adjust groups, roll initiative and start combat. All five original level-one pregens are included in each roster. Later encounters have NOT been rebalanced for level one: advance/edit the party before real play; Wave Echo Cave expects at least level four. Initiative starts unrolled.

Random encounter rosters use explicit illustrative minimum counts; their source dice formulas are listed below. Reroll and resize before play. Optional alternatives are separate rosters, not consecutive extra enemies. Do not duplicate runners or reinforcements.

Journal entries are original condensed DM summaries of the supplied adventure, not a reproduction of the book or invented session transcripts. No play outcomes or loot acquisitions are pre-approved. Use the supplied book for full rules, maps and boxed text.

Only this demo's sample campaign is changed; your account campaigns remain private. A second, clearly fictional resource-linking sandbox is retained to test linked items/NPCs.`,
    []],
  ["party", "01 — Pregenerated party reference", "Starter Set character sheets, pp. 1–10",
    `The supplied sheets leave character names blank. The demo uses descriptive labels rather than inventing names or player identities. All five PCs are level one, at full HP, without temporary HP or death-save failures.

${PHANDELVER_PREGENS.map(p => `${p.name}\nHP ${p.maxHp}; AC ${p.ac}; initiative ${p.initiativeBonus >= 0 ? "+" : ""}${p.initiativeBonus}. Sheet p. ${p.page} (background and advancement on following page).\n${p.notes}`).join("\n\n")}

The party roster stores the fields this app supports (class, maximum HP, AC and initiative modifier). Equipment, traits and spell references are notes, not a newly implemented full character-sheet manager. Consult the supplied sheets for complete preparation and advancement.`,
    []],
  ["arrows", "02 — Goblin Arrows & Cragmaw Hideout", "6–12",
    `Escort the wagon to Barthen's Provisions; the initial contract offers 10 gp per character. The dead horses belong to Gundren and Sildar. The goblin trail leads to the hideout, with a snare and pit on the approach.

Sildar is captive at 1 HP in Yeemik's den; Gundren and the map have already been sent to Cragmaw Castle. Sildar can identify the Rockseekers' discovery, King Grol's role and his own search for Iarno Albrek.

Yeemik may bargain against Klarg but is untrustworthy. Chained wolves can be calmed. The bridge sentry can trigger floods from the pools; handle the environmental effects separately from initiative.

Klarg's stolen goods bear the Lionshield mark. Recovering them creates a lead to Linene Graywind. His treasure includes healing potions and a jade frog; record loot only when found.`,
    ["Goblin Arrows"]],
  ["town", "03 — Phandalin: people, leads & factions", "14–19",
    `Phandalin is the safe hub, not an automatically hostile location.

Toblen Stonehill runs the inn and gathers rumors. Elmar Barthen handles the delivery and knows Gundren is missing. Linene Graywind wants the Lionshield goods recovered. Daran Edermath asks about Old Owl Well. Halia Thornton offers a job concerning Glasstaff and has her own interest in controlling the Redbrands.

Qelline Alderleaf and her son Carp know the secret route beneath Tresendar Manor; Qelline can point the party toward Reidoth in Thundertree. Sister Garaele seeks an answer from Agatha about Bowgentle's spellbook. Harbin Wester posts the Wyvern Tor job. Sildar wants Gundren rescued, Cragmaw Castle found, and Iarno's disappearance investigated.

Keep the factions' invitations and private motives separate from player knowledge. The Redbrands bully townspeople around the Sleeping Giant. Resolve their street confrontation once; do not spawn a duplicate group if the party approaches the tavern.`,
    ["Phandalin"]],
  ["redbrands", "04 — Tresendar Manor & Redbrand Hideout", "20–26",
    `Find the manor entrance or Carp's secret tunnel. Rescue Mirna Dendrar and her children Nars and Nilsa; they are captives, not hostile combatants. Mirna offers a lead to an emerald necklace hidden in her family's Thundertree shop.

Iarno Albrek is Glasstaff. His correspondence links the gang to the Black Spider. His rat familiar can warn him; he may escape through secret passages or surrender when badly hurt. The staff of defense changes his AC; see the roster notes.

Redbrand cloaks/password can bypass the skeletons. The crevasse's nothic can bargain, and Droop can become a frightened guide. Mosk's group consists of three bugbears, including Mosk, not three plus him.

Hazards: corridor pit, bridge/crevasse, and the nothic's insight. Talon lies in the nothic's hidden treasure. Record staff, potions, scrolls and recovered valuables only after the party discovers them.`,
    ["Redbrand Hideout"]],
  ["trail", "05 — Triboar Trail & wilderness preparation", "27–28",
    `Ask for marching order and watches. Check once during the day and once at night: d20 17–20 triggers a wilderness encounter, then roll d12.

DAY d12: 1–2 stirges (1d8+2); 3–4 ogre (1); 5–6 goblins (1d6+3); 7–8 hobgoblins (1d4+2); 9–10 orcs (1d4+2); 11 wolves (1d4+2); 12 owlbear (1).
NIGHT d12: 1–3 stirges (1d8+2); 4 ghouls (1d4+1); 5 goblins (1d6+3); 6 hobgoblins (1d4+2); 7–8 orcs (1d4+2); 9–10 wolves (1d4+2); 11–12 owlbear (1).

These are alternatives, not one combined encounter. The saved examples use minimum counts solely to make the demo deterministic; reroll the source formula and resize the group.`,
    ["Triboar Trail"]],
  ["agatha", "06 — Conyberry & Agatha's lair", "28–29",
    `This is a social/information encounter; no unsupported banshee combat roster is invented.

Respectful conversation and Sister Garaele's silver comb can earn one answer. Agatha knows that Bowgentle's spellbook passed to the necromancer Tsernoth. The party can choose a different question, including a major campaign lead; track which single question they actually ask.

Keep Agatha's answer and the party's report to Garaele in separate notes. Do not mark the quest complete until played.`,
    []],
  ["well", "07 — Old Owl Well", "29",
    `Daran's lead concerns disturbing activity at an old watchtower. Twelve zombies guard Hamun Kost, a Red Wizard studying the ruins.

Kost is willing to call off the undead and bargain. The normal prepared roster contains only the zombies; the optional hostile branch adds Kost, rather than assuming he attacks every visitor. Both rosters describe the SAME encounter.

He wants nearby orcs removed and/or an answer from Agatha about the tower's builder, Arthindol. His possessions include a ring of protection and other valuables; these are not automatic quest rewards or already-acquired party loot.`,
    ["Old Owl Well"]],
  ["thunder", "08 — Thundertree & Venomfang", "30–35",
    `Reidoth is a potential guide to Cragmaw Castle and can offer guidance toward Wave Echo Cave if the dragon menace is dealt with. He is not seeded as a hostile combatant.

The ruined town contains twig blights, ash zombies, giant spiders and six dragon cultists including Favric. Favric prefers an arrangement involving Venomfang; fighting is optional. Venomfang retreats at half HP, and is exceptionally dangerous to the level-one sample party.

Ash zombies add Ash Puff to the printed zombie profile. Reinforcing blights from area 1 are the same creatures if they arrive in area 2. Area 5's prose gives eight blights but a wave schedule totaling twelve: the saved roster uses eight and leaves the scheduling conflict to the DM.

Mirna's necklace is in the old herb/alchemy shop. Hew and other treasure are associated with the dragon's tower. The folk-hero fighter's personal goal concerns restoring this settlement.`,
    ["Thundertree"]],
  ["wyvern", "09 — Wyvern Tor", "35",
    `Track down Brughor's cave for Harbin's job and/or Hamun Kost's favor. A lone sentry stands outside. The cave contains Brughor Axe-Biter (30 HP), SIX ordinary orcs and Gog the ogre.

If the sentry escapes into the cave, add that survivor once. The cave roster does not silently include or duplicate him. Gog fights to the end; surviving orcs flee after Brughor falls.

Record the job reward only after returning to the relevant patron. Perfume and coins are cave treasure, not automatically granted loot.`,
    ["Wyvern Tor"]],
  ["castle", "10 — Cragmaw Castle & Gundren's rescue", "35–41",
    `Goal: rescue Gundren and recover his map. King Grol negotiates with Vyerith, a doppelganger disguised as a drow messenger. Grol has 45 HP and Snarl 18 HP; Gundren is an unconscious captive, not an enemy.

There are two distinct archer posts, with two goblins apiece. Yegg's hall has seven ordinary goblins plus Yegg. Lhupo has two assistants. Avoid double-counting guards who flee to warn the king.

Hazards and alternatives: collapsed passage trap, hidden entrance, grick ambush, shrine, and releasing the trapped owlbear. Sildar's equipment can be recovered. The returning war band is optional: Targor, three ordinary hobgoblins and two wolves; succession talks can avert fighting.

Gundren can guide the party to Wave Echo Cave and promises a share of future mine profits. Record whether he and the map actually survive.`,
    ["Cragmaw Castle"]],
  ["wave", "11 — Wave Echo Cave & the Black Spider", "42–51",
    `Designed for at least level four. The saved level-one pregens are demonstration rosters, not leveled or rebalanced PCs.

Find the Rockseeker brothers: Tharden is dead near the entrance; Nundro is held in area 20. Nezznar directs bugbears and Vhalak while trying to overcome the mine's ancient guardians.

Nezznar and four giant spiders occupy area 19. Vhalak can impersonate Nundro and warn him. Mormesk and the spectator may be negotiated with; those optional fights have separate rosters. The spectator guards the Forge of Spells; convincing it its duty has ended can avoid battle.

Hazards: poisonous fungi (area 8), flooded/booming passages, rift climbs, and the temple's dangerous statue. The flameskull can rejuvenate. Ochre jellies split; track new bodies manually instead of losing the split rule.

Notable finds: boots of striding and springing near the entrance, wand of magic missiles in the dark pool, gauntlets of ogre power in the rift, Lightbringer and Dragonguard at the forge, and Nezznar's spider staff. The forge's temporary enchantment is not permanent. Do not record any as acquired until found.

WANDERING d12: 1–3 stirges (2d4); 4–5 ghouls (1d4); 6 gricks (1d4); 7–8 bugbears (1d4); 9 skeletons (1d6); 10 zombies (1d6); 11–12 ochre jelly (1). Trigger check d20 17–20.

After play, record Nundro's rescue, the fate of Nezznar and the forge, and any agreed mine-profit share. None of these conclusions is pre-entered as a completed event.`,
    ["Wave Echo Cave"]],
];

export function phandelverJournal(): SessionDetail[] {
  return briefings.map(([key, title, pages, body, locations], i) => {
    const encounters = PHANDELVER_ENCOUNTERS.filter(e => locations.includes(e.location));
    return {
      session: { id: `demo-lmop-${key}`, campaignId: 1, title, date: "2026-10-30",
        revision: 0, updatedAt: `2026-10-30T12:${String(i).padStart(2, "0")}:00.000Z`,
        notes: `DEMO / DM PREP — NOT PLAYED\nSource: ${pages.startsWith("Starter") ? pages : `Lost Mine of Phandelver, pp. ${pages}`}. Date is a sample organizer date, not a claimed play date.\n\n${body}` +
          (encounters.length ? "\n\nSAVED ENCOUNTER REFERENCE\n" + encounters.map(e =>
            `${e.name} — p. ${e.page}\n${e.notes || "Use the prepared roster; no outcome has been assumed."}`).join("\n\n") : "") },
      imports: [], recordings: [],
    };
  });
}
