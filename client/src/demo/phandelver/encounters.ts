export interface PhandelverEncounter {
  key: string; location: string; name: string; page: number;
  enemies: [profile: string, count: number][]; notes: string;
}
type Entry = [key: string, name: string, page: number, enemies: [string, number][], notes?: string];
const groups: [string, Entry[]][] = [
  ["Goblin Arrows", [
    ["ambush", "Goblin Ambush", 6, [["goblin", 4]], "Two goblins on each side of the trail. Last goblin flees after three are defeated; captives can reveal the hideout."],
    ["blind", "Cragmaw Hideout 2 — Goblin Blind", 8, [["goblin", 2]], "Inattentive sentries; stealth and surprise matter."],
    ["kennel", "Cragmaw Hideout 3 — Kennel", 8, [["wolf", 3]], "Chained wolves can be calmed or fed; combat is avoidable."],
    ["overpass", "Cragmaw Hideout 5 — Overpass", 10, [["goblin", 1]], "The sentry can signal the pools to flood the passage. Track flood hazards manually."],
    ["yeemik", "Cragmaw Hideout 6 — Goblin Den", 10, [["goblin", 5], ["yeemik", 1]], "Six goblins TOTAL, including Yeemik (12 HP). Sildar is a hostage at 1 HP, not an enemy; Yeemik can bargain or threaten to throw him from the ledge."],
    ["pools", "Cragmaw Hideout 7 — Twin Pools", 11, [["goblin", 3]], "One goblin can run to warn Klarg. Do not duplicate that same runner in the next fight."],
    ["klarg", "Cragmaw Hideout 8 — Klarg's Cave", 12, [["klarg", 1], ["ripper", 1], ["goblin", 2]], "Klarg may prepare an ambush if warned. He flees if Ripper dies. Supplies bear the Lionshield mark."],
  ]],
  ["Phandalin", [
    ["street", "Phandalin — Redbrand Confrontation", 19, [["ruffian", 4]], "Street/Sleeping Giant confrontation alternatives use the same four ruffians; do not treat them as separate waves. Last survivor flees."],
  ]],
  ["Redbrand Hideout", [
    ["red-barracks", "Redbrand Hideout 2 — Barracks", 20, [["ruffian", 3]]],
    ["crypt", "Redbrand Hideout 4 — Tresendar Crypts", 22, [["skeleton", 3]], "Redbrand cloaks or the password can prevent an attack."],
    ["pens", "Redbrand Hideout 5 — Slave Pens", 22, [["ruffian", 2]], "Mirna, Nars and Nilsa Dendrar are captives, not enemies."],
    ["crevasse", "Redbrand Hideout 8 — Crevasse", 23, [["nothic", 1]], "Nothic may negotiate for food; do not assume a mandatory battle. Talon is in the hidden chest."],
    ["mosk", "Redbrand Hideout 9 — Guard Barracks", 24, [["bugbear", 3]], "Mosk is one of the THREE bugbears. Droop is a frightened goblin helper, not a fourth hostile."],
    ["common", "Redbrand Hideout 10 — Common Room", 24, [["ruffian", 4]], "These ruffians are poisoned from drinking; condition is pre-applied. Recruits' disguises can avoid fighting."],
    ["glasstaff", "Redbrand Hideout 12 — Glasstaff", 25, [["glasstaff", 1]], "Rat familiar in area 11 may warn Iarno. Equipped AC 13 includes staff of defense; mage armor makes AC 16. He surrenders at 8 HP or fewer."],
  ]],
  ["Old Owl Well", [
    ["owl-well", "Old Owl Well — Zombies", 29, [["zombie", 12]], "Hamun Kost can stop the zombies and negotiate; he is NOT automatically an extra enemy."],
    ["kost", "Old Owl Well — Hostile Kost (optional)", 29, [["hamun", 1], ["zombie", 12]], "Alternative hostile branch, not a second wave. Remove any zombies already defeated; talking can still stop combat."],
  ]],
  ["Thundertree", [
    ["thunder-1", "Thundertree 1 — Westernmost Cottage", 30, [["blight", 2]], "These two blights can reinforce area 2; do not count them twice."],
    ["thunder-2", "Thundertree 2 — Blighted Cottages", 30, [["blight", 6]], "Two blights from area 1 can arrive after a round if still alive; add them only once."],
    ["thunder-3", "Thundertree 3 — Brown Horse", 31, [["ashZombie", 4]], "Ash Puff is the adventure's additional zombie trait."],
    ["thunder-5", "Thundertree 5 — Blighted Farmhouse", 32, [["blight", 8]], "SOURCE AMBIGUITY: text gives eight blights, but directs two to each doorway per round for three rounds (twelve). This roster preserves the printed total of eight; DM decides wave timing."],
    ["thunder-6", "Thundertree 6 — Ruined Store", 32, [["spider", 2]], "Webs and concealment can give the spiders surprise."],
    ["venomfang", "Thundertree 7 — Venomfang", 33, [["venomfang", 1]], "Retreats at half HP. The supplied adventure's dragon has fly 60 ft. and DC 16 / 12d6 breath; do not substitute a different edition's statblock."],
    ["thunder-8", "Thundertree 8 — Old Smithy", 33, [["ashZombie", 2]]],
    ["thunder-11", "Thundertree 11 — Old Garrison", 34, [["ashZombie", 5]]],
    ["thunder-12", "Thundertree 12 — Weaver's Cottage", 34, [["blight", 6]], "Noise can alert the cultists in area 13."],
    ["cultists", "Thundertree 13 — Dragon Cultists (optional)", 35, [["cultist", 6]], "Six TOTAL, including Favric. Initially interested in bargaining, not fighting; others flee if Favric falls."],
  ]],
  ["Wyvern Tor", [
    ["orc-sentry", "Wyvern Tor — Orc Sentry", 35, [["orc", 1]], "A separate sentry outside the cave; if he escapes, add that survivor to the cave roster."],
    ["wyvern", "Wyvern Tor — Brughor's Cave", 35, [["brughor", 1], ["orc", 6], ["gog", 1]], "Cave contains Brughor (30 HP), six ordinary orcs and Gog. The outside sentry is separate. Orcs flee if Brughor dies."],
  ]],
  ["Cragmaw Castle", [
    ["archers-n", "Cragmaw Castle 3 — North Archer Post", 36, [["goblin", 2]], "Two goblins in each of two area-3 chambers. Arrow slits provide cover; the other post is a separate roster."],
    ["archers-s", "Cragmaw Castle 3 — South Archer Post", 36, [["goblin", 2]]],
    ["castle-4", "Cragmaw Castle 4 — Ruined Barracks", 37, [["goblin", 3]]],
    ["castle-6", "Cragmaw Castle 6 — Hobgoblin Barracks", 38, [["hobgoblin", 4]]],
    ["yegg", "Cragmaw Castle 7 — Banquet Hall", 38, [["goblin", 7], ["yegg", 1]], "Seven ordinary goblins PLUS Yegg (12 HP), eight total. Survivors flee when Yegg dies."],
    ["castle-8", "Cragmaw Castle 8 — Dark Hall", 38, [["grick", 1]]],
    ["lhupo", "Cragmaw Castle 9 — Goblin Shrine", 39, [["lhupo", 1], ["goblin", 2]], "Lhupo has 12 HP; the two assistants use normal goblin HP."],
    ["castle-12", "Cragmaw Castle 12 — Guard Barracks", 40, [["hobgoblin", 2]], "One can warn King Grol; move that survivor rather than duplicating him."],
    ["castle-13", "Cragmaw Castle 13 — Owlbear Tower", 40, [["owlbear", 1]], "Release without blocking its escape can resolve this encounter."],
    ["grol", "Cragmaw Castle 14 — King's Quarters", 40, [["grol", 1], ["snarl", 1], ["vyerith", 1]], "King Grol has 45 HP; Snarl has 18. Gundren is an unconscious hostage, not an enemy. Vyerith is the Black Spider's doppelganger messenger."],
    ["targor", "Cragmaw Castle — Returning War Band (optional)", 41, [["targor", 1], ["hobgoblin", 3], ["wolf", 2]], "Three ordinary hobgoblins PLUS Targor (20 HP), with two wolves. Negotiation about succession is possible."],
  ]],
  ["Wave Echo Cave", [
    ["wave-2", "Wave Echo Cave 2 — Mine Tunnels", 44, [["jelly", 1]]],
    ["wave-3", "Wave Echo Cave 3 — Old Entrance", 44, [["stirge", 10]]],
    ["wave-4", "Wave Echo Cave 4 — Old Guardroom", 44, [["skeleton", 9]], "Skeletons animate one round after entry."],
    ["wave-6", "Wave Echo Cave 6 — South Barracks", 45, [["ghoul", 3]]],
    ["wave-9", "Wave Echo Cave 9 — Great Cavern", 46, [["ghoul", 7]]],
    ["wave-11", "Wave Echo Cave 11 — North Barracks", 46, [["bugbear", 5]]],
    ["wave-12", "Wave Echo Cave 12 — Smelter", 46, [["zombie", 8], ["flameskull", 1]], "Flameskull's fireball and rejuvenation matter; zombies pursue only briefly beyond their post."],
    ["mormesk", "Wave Echo Cave 14 — Mormesk (optional)", 47, [["mormesk", 1]], "Adventure-specific Mormesk: 45 HP, CR 3, DC 13 Life Drain. Bargaining for treasure/knowledge is possible."],
    ["forge", "Wave Echo Cave 15 — Forge Guardian (optional)", 48, [["spectator", 1]], "Spectator can be persuaded its service has ended; not a compulsory fight. Its printed bite is 1d4−1, not another source's version."],
    ["vhalak", "Wave Echo Cave 18 — Collapsed Cavern", 49, [["bugbear", 3], ["vhalak", 1]], "Vhalak may disguise itself as Nundro and attempt to warn Nezznar."],
    ["nezznar", "Wave Echo Cave 19 — Black Spider", 49, [["nezznar", 1], ["spider", 4]], "Nezznar's base AC is 11, or 14 with mage armor. Consider disguise, web control and escape rather than automatic combat. Nundro is captive in area 20."],
  ]],
];

export const PHANDELVER_ENCOUNTERS: PhandelverEncounter[] = groups.flatMap(([location, entries]) =>
  entries.map(([key, name, page, enemies, notes = ""]) => ({ key, location, name, page, enemies, notes })));

const wandering: [string, string, number, string, number, string][] = [
  ["trail-stirge", "Triboar Trail — Stirges", 27, "stirge", 3, "1d8+2"],
  ["trail-ghoul", "Triboar Trail — Ghouls (night)", 27, "ghoul", 2, "1d4+1"],
  ["trail-ogre", "Triboar Trail — Ogre (day)", 27, "ogre", 1, "1"],
  ["trail-goblin", "Triboar Trail — Goblins", 27, "goblin", 4, "1d6+3"],
  ["trail-hobgoblin", "Triboar Trail — Hobgoblins", 27, "hobgoblin", 3, "1d4+2"],
  ["trail-orc", "Triboar Trail — Orcs", 27, "orc", 3, "1d4+2"],
  ["trail-wolf", "Triboar Trail — Wolves", 27, "wolf", 3, "1d4+2"],
  ["trail-owlbear", "Triboar Trail — Owlbear", 27, "owlbear", 1, "1"],
  ["mine-stirge", "Wave Echo wandering — Stirges", 42, "stirge", 2, "2d4"],
  ["mine-ghoul", "Wave Echo wandering — Ghouls", 42, "ghoul", 1, "1d4"],
  ["mine-grick", "Wave Echo wandering — Gricks", 42, "grick", 1, "1d4"],
  ["mine-bugbear", "Wave Echo wandering — Bugbears", 42, "bugbear", 1, "1d4"],
  ["mine-skeleton", "Wave Echo wandering — Skeletons", 42, "skeleton", 1, "1d6"],
  ["mine-zombie", "Wave Echo wandering — Zombies", 42, "zombie", 1, "1d6"],
  ["mine-jelly", "Wave Echo wandering — Ochre Jelly", 42, "jelly", 1, "1"],
];
PHANDELVER_ENCOUNTERS.push(...wandering.map(([key, name, page, profile, count, formula]) => ({
  key, name, page, location: page === 27 ? "Triboar Trail" : "Wave Echo Cave",
  enemies: [[profile, count]] as [string, number][],
  notes: `Wandering encounter. Printed count: ${formula}. This saved demo uses ${count}, an illustrative minimum, NOT a fixed source count; roll the formula and adjust member count before play. Trigger check: d20 17–20.`,
})));
