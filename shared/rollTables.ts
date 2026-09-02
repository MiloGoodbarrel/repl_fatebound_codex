export type RollTableMode = "range" | "weighted";
export type RollTableSource = "stock" | "campaign";

export interface RollTableEntry {
  id?: number;
  tableId?: number | string;
  entryOrder: number;
  text: string;
  minRoll?: number;
  maxRoll?: number;
  weight?: number;
}

export interface RollTable {
  id: string | number;
  name: string;
  description: string;
  category: string;
  mode: RollTableMode;
  source: RollTableSource;
  campaignId?: number;
  entries: RollTableEntry[];
}

const d12 = (texts: string[]): RollTableEntry[] =>
  texts.map((text, index) => ({
    entryOrder: index,
    text,
    minRoll: index + 1,
    maxRoll: index + 1,
  }));

const table = (
  id: string,
  name: string,
  category: string,
  description: string,
  texts: string[],
): RollTable => ({
  id,
  name,
  category,
  description,
  mode: "range",
  source: "stock",
  entries: d12(texts),
});

// Original, system-neutral starter content. These are deliberately compact so
// each result can be read at the table without opening a separate reference.
export const STOCK_ROLL_TABLES: RollTable[] = [
  table("stock-trinkets", "Trinkets & Oddities", "Trinkets", "Small curiosities with a story waiting to be discovered.", [
    "A brass key warm to the touch, marked with a moon that is not in the sky.",
    "A pressed flower that never fades, tucked inside a cracked locket.",
    "A glass marble containing a tiny drifting snowstorm.",
    "A one-page diary written in your own handwriting, dated tomorrow.",
    "A smooth river stone that hums near open flames.",
    "A child’s wooden crown with the name of an unknown king carved inside.",
    "A silver button bearing a family crest nobody recognizes.",
    "A map of the local area with one extra road drawn in red ink.",
    "A thimble that fills with seawater at dawn.",
    "A black feather that always points toward the nearest lie.",
    "A copper coin stamped with a face that changes when unwatched.",
    "A tiny portrait whose painted subject slowly turns to look at you.",
  ]),
  table("stock-wild-magic", "Wild Magic Surges", "Magic", "Chaotic magical side effects for an unexpected arcane turn.", [
    "Every unattended flame burns blue and whispers the name of a nearby creature.",
    "The caster becomes weightless for one minute.",
    "A harmless rain cloud follows the caster for an hour.",
    "The next spoken sentence comes out in the voice of a random ally.",
    "All metal within 20 feet briefly becomes warm as fresh bread.",
    "A spectral door appears on the nearest solid surface, then vanishes.",
    "The caster’s shadow acts out a different version of the last minute.",
    "A shower of flower petals fills the space; they smell faintly of ozone.",
    "The caster trades places with a random unattended object within 30 feet.",
    "All creatures nearby sneeze glitter for one round.",
    "A distant thunderclap answers the caster’s next question.",
    "The magic succeeds, but leaves behind a visible sigil that lasts until dawn.",
  ]),
  table("stock-wilderness-events", "Wilderness Events", "Wilderness", "Travel complications, discoveries, and quiet moments on the road.", [
    "A flock of birds takes flight in perfect silence, all facing the same direction.",
    "A fresh campsite lies abandoned, with a warm kettle still hanging over the coals.",
    "The party finds a trail of bright blue mushrooms leading off the road.",
    "A sudden fog reduces visibility and carries distant bell sounds.",
    "A wounded traveler asks for help, but refuses to say what is chasing them.",
    "An old milestone has been turned around; the distances now point somewhere impossible.",
    "A harmless animal follows the party and seems determined to lead them somewhere.",
    "Rain reveals a set of footprints that are not visible when the ground is dry.",
    "A fallen tree exposes a sealed stone niche containing a single written warning.",
    "The wind carries the smell of a familiar meal from a direction with no settlement.",
    "A bridge is sound but freshly painted with a warning in an unknown language.",
    "The party reaches a fork where both paths show recent tracks from their own boots.",
  ]),
  table("stock-npc-ancestry", "NPC Ancestry", "NPCs", "A quick ancestry prompt for a memorable nonplayer character.", [
    "Human with a strong regional accent", "Elf with an old-fashioned manner", "Dwarf with a meticulous travel kit",
    "Halfling who knows every local shortcut", "Orc who speaks softly and listens carefully", "Gnome carrying too many inventions",
    "Tiefling with a carefully cultivated respectable image", "Dragonborn whose scales show signs of old repairs",
    "Aasimar hiding a conspicuous celestial birthmark", "Half-elf caught between two family traditions",
    "Reborn person with gaps in their recent memory", "Mixed ancestry that the NPC describes as ordinary and private",
  ]),
  table("stock-npc-first-name", "NPC First Names", "NPCs", "First names for allies, rivals, witnesses, and passersby.", [
    "Alden", "Briala", "Corren", "Dema", "Edrin", "Fara", "Garrick", "Hesta", "Iven", "Jora", "Kest", "Luma",
  ]),
  table("stock-npc-surname", "NPC Surnames", "NPCs", "Surnames with a little texture built in.", [
    "Ashgrove", "Bellweather", "Cinder", "Duskvale", "Emberhand", "Farstep", "Greymantle", "Holloway", "Ironreed", "Mossbarrel", "Rook", "Thornmere",
  ]),
  table("stock-npc-role", "NPC Roles & Classes", "NPCs", "A practical role to anchor an improvised character.", [
    "Retired caravan guard", "Apprentice apothecary", "Disgraced noble", "Village priest with a side business",
    "Bounty hunter between contracts", "Sailor who has never seen the sea", "Street performer and rumor broker",
    "Scholar researching a forbidden local custom", "Blacksmith who makes ceremonial weapons", "Courier carrying the wrong letter",
    "Innkeeper quietly sheltering a fugitive", "Thief trying very hard to become an honest merchant",
  ]),
  table("stock-npc-background", "NPC Backgrounds", "NPCs", "A past life that explains a skill, contact, or old complication.", [
    "Raised in a traveling theater troupe.", "Former clerk for a powerful guild.", "Sole survivor of a failed expedition.",
    "Grew up in a remote religious community.", "Inherited a trade they never wanted.", "Served as an assistant to a minor noble.",
    "Spent years working aboard river barges.", "Was once celebrated for a talent they no longer use.",
    "Came to town as a refugee and built a new life.", "Descended from a family with a notorious reputation.",
    "Learned their profession while serving a prison sentence.", "Claims to be self-taught, but clearly had an exceptional mentor.",
  ]),
  table("stock-npc-appearance", "NPC Appearance", "NPCs", "One visual detail to make an improvised NPC easy to remember.", [
    "Always wears one glove, even while eating.", "Has ink-stained fingertips and immaculate clothes.",
    "Keeps their hair tied with a strip of faded banner.", "Wears spectacles with one lens replaced by colored glass.",
    "Has a careful scar shaped like a crescent.", "Carries a coat two sizes too large.",
    "Decorates their boots with tiny brass bells.", "Has mismatched eyes and avoids comments about them.",
    "Wears several keys on a cord around their neck.", "Smells faintly of cedar smoke.",
    "Has a beautifully embroidered sleeve on an otherwise plain outfit.", "Keeps a fresh flower tucked behind one ear.",
  ]),
  table("stock-npc-personality", "NPC Personality", "NPCs", "A roleplay cue that can be layered onto any NPC.", [
    "Warmly curious, even when it is inappropriate.", "Suspicious of easy answers but eager to help.",
    "Speaks in precise lists and hates being interrupted.", "Makes jokes whenever a conversation becomes serious.",
    "Treats every stranger like a potential old friend.", "Never sits with their back to a door.",
    "Apologizes before asking for anything.", "Turns every problem into a competition.",
    "Quietly sentimental about ordinary objects.", "Cannot resist correcting small inaccuracies.",
    "Projects confidence while watching everyone for approval.", "Answers questions with a story from their childhood.",
  ]),
  table("stock-npc-motivation", "NPC Motivation", "NPCs", "What this NPC wants right now, whether or not they admit it.", [
    "To prove they are useful to someone important.", "To buy back a family heirloom.",
    "To find the person who vanished from their village.", "To earn enough to leave the region forever.",
    "To conceal a mistake before anyone notices.", "To make amends without revealing why.",
    "To protect a place that only they still remember.", "To test whether the adventurers are trustworthy.",
    "To gain status through one spectacular success.", "To settle an old debt with a dangerous person.",
    "To keep a promise made to someone who is dead.", "To discover whether a persistent rumor is true.",
  ]),
  table("stock-npc-secret", "NPC Secrets", "NPCs", "A hidden truth that can turn a simple conversation into a plot.", [
    "They have been forging letters in a respected person’s name.",
    "They witnessed a crime and identified the wrong suspect.",
    "They are protecting a minor relic from someone who thinks it is valuable.",
    "They owe favors to two rival factions.",
    "They are using a false surname to escape a family feud.",
    "They know a local landmark is not what it appears to be.",
    "They accidentally started the rumor everyone is repeating.",
    "They have been meeting a monster that is kinder than the townsfolk.",
    "They are carrying a message they are afraid to deliver.",
    "They once betrayed the party’s current employer.",
    "They have already visited the place the party is trying to reach.",
    "They are not the person their disguise is meant to imitate.",
  ]),
  table("stock-settlement-name", "Settlement Names", "Settlements", "Names for villages, crossroads, ports, and growing towns.", [
    "Ashmere", "Bellhollow", "Candleford", "Dunbarrow", "Evershade", "Foxglade",
    "Goldwake", "Hearthfall", "Juniper Rest", "Mirewatch", "Northglass", "Stonewake",
  ]),
  table("stock-settlement-feature", "Settlement Features", "Settlements", "A distinctive detail visible within minutes of arrival.", [
    "Every roof is painted a different shade of blue.", "A dry fountain is treated as a civic shrine.",
    "The main street is built over a shallow running stream.", "Residents leave small offerings on windowsills.",
    "A watchtower leans but has never fallen.", "The market only opens after sunset.",
    "A huge tree grows through the town hall.", "The settlement has no central square; paths spiral inward.",
    "A bell rings whenever a stranger enters.", "Old walls surround the town, but no one remembers building them.",
    "One bridge is considered unlucky and carefully avoided.", "The local calendar is marked by colored lanterns.",
  ]),
  table("stock-settlement-scale", "Settlement Size & Rule", "Settlements", "A quick sense of scale and who actually makes decisions.", [
    "Roadside hamlet governed by the eldest household.", "Farming village led by an elected reeve.",
    "Walled village controlled by a hereditary magistrate.", "Busy crossroads overseen by a council of tradespeople.",
    "River town effectively run by the dockworkers’ union.", "Mining town governed from a distant noble estate.",
    "Market town where temple officials settle civic disputes.", "Frontier settlement led by whoever commands the watch.",
    "Small city divided among three rival district councils.", "Pilgrimage town administered by rotating guest-priests.",
    "Fortified town under temporary military law.", "Growing port whose richest shipping families buy every major vote.",
  ]),
  table("stock-settlement-problem", "Settlement Problems", "Settlements", "A pressure point the party can discover or become involved in.", [
    "The wells are producing clean water that tastes faintly of ash.",
    "Two families claim ownership of the same abandoned building.",
    "A respected leader has stopped appearing in public.",
    "Travelers vanish only on the final night before leaving.",
    "A new road has brought prosperity and a dangerous outside influence.",
    "The town’s protective tradition has become an excuse for cruelty.",
    "A harvest celebration is being used to hide a quiet evacuation.",
    "A local guild has begun charging for an essential service.",
    "The cemetery gates are found open every morning.",
    "A beloved public statue has started changing pose.",
    "The settlement is divided over whether to shelter a wanted stranger.",
    "A neighboring community is sending increasingly desperate requests.",
  ]),
  table("stock-storefronts", "Storefronts & Buildings", "Settlements", "A useful, unusual, or suspicious place to add to a settlement.", [
    "A general store that sells only items with a story attached.",
    "A shuttered bathhouse with fresh footprints inside.",
    "A mapmaker’s shop where every map omits the same street.",
    "A cooper that doubles as a quiet meeting hall.",
    "A tiny bakery famous for one seasonal pastry.",
    "A pawnshop whose owner refuses to buy anything made of silver.",
    "A stable with more locked rooms than horses.",
    "A tailor offering uniforms for an organization that does not exist.",
    "A bookbinder repairing a volume that whispers when opened.",
    "A public kitchen run by a retired adventuring party.",
    "A watch post converted into a flower shop.",
    "An empty storefront with a sign that reads ‘Opening Soon’ in three languages.",
  ]),
  table("stock-occupations", "Local Occupations", "Settlements", "The work that keeps a settlement alive and gives its people local expertise.", [
    "Reed cutter and basket maker", "River pilot and ferry keeper", "Charcoal burner", "Beekeeper and candle maker",
    "Stone salvager", "Letter writer for hire", "Roof thatcher", "Herbal brewer", "Cartwright", "Grave tender",
    "Bell founder", "Seasonal monster guide",
  ]),
  table("stock-merchant-detail", "Merchant Details", "Settlements", "A hook for the person behind the counter.", [
    "Keeps meticulous notes on every customer’s favorite item.",
    "Will barter for stories but not coin on market days.",
    "Has a rival in the next town and mentions them constantly.",
    "Insists one ordinary product is secretly magical.",
    "Is friendly to everyone except members of one local family.",
    "Offers a discount for anyone who can solve a riddle.",
    "Has recently inherited the business and is clearly overwhelmed.",
    "Knows the party’s names before they introduce themselves.",
    "Keeps a locked case labeled ‘paid in full.’",
    "Will only conduct business outdoors.",
    "Is secretly gathering supplies for an evacuation.",
    "Has one empty shelf that they dust every morning.",
  ]),
  table("stock-dungeon-rooms", "Dungeon Rooms", "Dungeons", "A room purpose for when the map needs one more discovery.", [
    "A chamber built around a dry well with voices far below.", "A barracks whose beds are made despite being abandoned.",
    "A shrine where every offering has been carefully catalogued.", "A workshop with one unfinished object on the bench.",
    "A library with books arranged by the date they were burned.", "A gallery of portraits with the faces scratched away.",
    "A storage room containing supplies for an expedition that never returned.", "A circular room with doors at floor and ceiling.",
    "A dining hall set for a feast that smells freshly served.", "A prison cell with a comfortable chair inside.",
    "A flooded chamber where something keeps moving beneath the surface.", "An observatory aimed at a patch of sky that is always dark.",
  ]),
  table("stock-dungeon-dressing", "Dungeon Dressing", "Dungeons", "Small environmental details to make an otherwise plain room memorable.", [
    "Thin roots have pushed through the mortar in deliberate patterns.",
    "A brass plaque lists names and dates, all recently polished.",
    "Dust gathers everywhere except around one child-sized footprint.",
    "The air smells of rain despite there being no opening above.",
    "Old chalk marks repeat a simple warning in several hands.",
    "A ceiling chain sways without making a sound.",
    "The room is warmer near a wall covered in faded arrows.",
    "A single chair faces the corner as if someone is still seated there.",
    "The floor has been swept into a careful spiral.",
    "A faint melody can be heard whenever everyone stops speaking.",
    "A sealed jar contains a miniature version of the room.",
    "Several objects have been arranged to point toward the exit.",
  ]),
  table("stock-hazards", "Traps & Hazards", "Dungeons", "A complication for exploration that rewards attention over brute force.", [
    "A pressure plate releases a blinding cloud of harmless dust.",
    "A corridor slowly tilts toward a pit that is hidden by darkness.",
    "A door remembers the last creature that opened it and calls their name.",
    "Loose stones fall only after the party believes the passage is safe.",
    "A harmless-looking pool reflects the room as it was an hour ago.",
    "A bell wire runs through the hinges of every door in the area.",
    "The floor is safe except for the tiles that show familiar symbols.",
    "A sealed chest grows heavier each time it is moved.",
    "A magical draft pushes creatures toward the nearest locked door.",
    "A staircase changes its destination when climbed in silence.",
    "A patch of moss repeats the sound of the last loud noise.",
    "The hazard is obvious, but bypassing it alerts something elsewhere.",
  ]),
  table("stock-adventure-hooks", "Adventure Hooks", "Adventure", "Immediate reasons for the party to get involved.", [
    "A message arrives from someone who has been dead for a year.",
    "A local celebration will end in disaster unless one small tradition is restored.",
    "A valuable map is being auctioned, but the buyer is missing.",
    "A monster is blamed for attacks that show signs of an intelligent culprit.",
    "A road has shifted overnight and now leads somewhere uncharted.",
    "A patron offers a generous reward for a problem they refuse to describe.",
    "A child’s imaginary friend has begun leaving real footprints.",
    "A respected institution asks the party to retrieve something it publicly denies losing.",
    "A rival adventuring group returned with one extra member.",
    "A storm uncovers a doorway beneath a familiar landmark.",
    "A series of ordinary accidents form a pattern visible only from above.",
    "A stranger recognizes one party member and immediately asks for forgiveness.",
  ]),
  table("stock-tavern-rumors", "Tavern Patrons & Rumors", "Social", "A conversational spark heard over a crowded table.", [
    "A tired courier claims the next town has moved three miles overnight.",
    "A card player insists the mayor keeps a second ledger under the floor.",
    "A traveler is searching for the inn where they stayed last winter, but it never existed.",
    "A cook swears the local river runs uphill once each month.",
    "A retired guard offers directions and warns the party not to thank them.",
    "A singer has a verse about the party before meeting them.",
    "A merchant quietly asks whether the party has seen a red umbrella.",
    "A regular patron pays for a stranger’s meal every night, though the seat stays empty.",
    "A bartender is collecting names of people who dream about the same tower.",
    "A loud storyteller is wrong about every detail except the final one.",
    "A nervous pilgrim says the road is safe only when nobody travels alone.",
    "A child at the next table draws a surprisingly accurate map of a nearby ruin.",
  ]),
  table("stock-weather", "Travel Weather", "Wilderness", "Atmosphere and travel pressure for the next stretch of road.", [
    "Clear, cold air and excellent visibility.", "Warm rain that leaves metallic spots on stone.",
    "A heavy wind carrying leaves from a season that has not arrived.",
    "Low fog that breaks only around living creatures.", "Bright sun with a distant thunderstorm that never approaches.",
    "Intermittent sleet and sudden pockets of perfect calm.", "A dry heat that makes every shadow look too long.",
    "Fine ash falls for an hour, though no fire is visible.", "Clouds form a slow spiral around the party’s route.",
    "A crisp night arrives several hours early.", "Rain falls upward from puddles for a few minutes.",
    "A gentle snowfall muffles every sound except whispered conversation.",
  ]),
];