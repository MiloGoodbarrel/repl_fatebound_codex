import { emptySummarySections } from "../../../shared/sessionSummary";
import type { DemoState } from "./model";

/** Original fictional demo material only. Never seed this from a user's database. */
export function createDemoState(): DemoState {
  const sections = emptySummarySections();
  sections[0].text = "The party reached the Lantern Coast and agreed to relight a beacon before the spring tide.";
  sections[0].sourceIds = ["demo-source-lighthouse"];
  sections[1].text = "Keeper Vela revealed that the lens had been carried into the sea caves.";
  sections[2].text = "Keeper Vela — friendly, worried about the missing lens.";
  sections[7].text = "Who moved the lens, and why do the shoreline sentinels guard the caves?";
  sections[8].text = "Explore the flooded passage beneath the old lighthouse.";
  return {
    version: 1, activeCampaignId: "demo-lantern", appearance: { skin: "classic", mode: "dark" },
    campaigns: [
      { id: "demo-lantern", name: "The Lantern Coast", edition: "5e", description: "A fictional coastal mystery: a dark lighthouse, a missing lens, and a promise made before the tide." },
      { id: "demo-observatory", name: "The Ashen Observatory", edition: "5e", description: "An independent fictional campaign about a mountain observatory and its impossible star charts." },
    ],
    characters: [
      { id: "demo-arden", campaignId: "demo-lantern", name: "Arden Vale", role: "Fighter · level 4", kind: "PC", disposition: "friendly", hp: 36, ac: 17 },
      { id: "demo-mira", campaignId: "demo-lantern", name: "Mira Flint", role: "Wizard · level 4", kind: "PC", disposition: "friendly", hp: 24, ac: 13 },
      { id: "demo-vela", campaignId: "demo-lantern", name: "Keeper Vela", role: "Lighthouse keeper · knows the caves", kind: "NPC", disposition: "friendly", hp: 14, ac: 11 },
      { id: "demo-sentinel", campaignId: "demo-lantern", name: "Shorebound Sentinel", role: "Fictional guardian · protects the missing lens", kind: "NPC", disposition: "enemy", hp: 18, ac: 14 },
      { id: "demo-sela", campaignId: "demo-observatory", name: "Sela North", role: "Ranger · level 3", kind: "PC", disposition: "friendly", hp: 27, ac: 15 },
    ],
    encounters: [
      { id: "demo-caves", campaignId: "demo-lantern", name: "Guardians of the Tide Caves", round: 1, turn: 0, running: false, members: [
        { id: "demo-combat-arden", name: "Arden Vale", ac: 17, hp: 36, maxHp: 36, initiative: 18, count: 1, conditions: [] },
        { id: "demo-combat-guardians", name: "Shorebound Sentinels", ac: 14, hp: 18, maxHp: 18, initiative: 14, count: 3, conditions: [] },
        { id: "demo-combat-mira", name: "Mira Flint", ac: 13, hp: 24, maxHp: 24, initiative: 10, count: 1, conditions: [] },
      ] },
      { id: "demo-stairs", campaignId: "demo-observatory", name: "The Broken Stair", round: 1, turn: 0, running: false, members: [
        { id: "demo-combat-sela", name: "Sela North", ac: 15, hp: 27, maxHp: 27, initiative: 16, count: 1, conditions: [] },
        { id: "demo-combat-moths", name: "Whisper Moths", ac: 11, hp: 8, maxHp: 8, initiative: 9, count: 4, conditions: [] },
      ] },
    ],
    items: [
      { id: "demo-dawn-lantern", name: "Lantern of Borrowed Dawn", kind: "Wondrous item", rarity: "Uncommon", description: "An original demo treasure. Its warm light briefly reveals footprints left on wet stone." },
      { id: "demo-tide-ring", name: "Tidekeeper's Band", kind: "Ring", rarity: "Rare", description: "An original demo treasure. The pale stone always points toward the nearest safe landing." },
      { id: "demo-chart", name: "Chart of Wandering Stars", kind: "Wondrous item", rarity: "Uncommon", description: "An original demo treasure. Its ink sketches an unfamiliar constellation at every sunset." },
      { id: "demo-coil", name: "Mariner's Silver Coil", kind: "Adventuring gear", rarity: "Common", description: "An original demo treasure. A small silver charm made from a retired ship's bell." },
    ],
    lootDraw: [], loot: [{ id: "demo-loot-coil", campaignId: "demo-lantern", itemId: "demo-coil", quantity: 1 }],
    tables: [
      { id: "demo-coast-table", campaignId: "demo-lantern", name: "Coastal Discoveries", entries: [
        { id: "demo-table-shell", text: "A shell repeats a sailor's unfinished warning.", weight: 2 },
        { id: "demo-table-map", text: "A waxed map marks a cave exposed only at low tide.", weight: 1 },
        { id: "demo-table-lights", text: "Three amber lights drift beyond the harbor wall.", weight: 1 },
      ] },
      { id: "demo-stars-table", campaignId: "demo-observatory", name: "Observatory Omens", entries: [
        { id: "demo-table-snow", text: "Fresh snow falls upward for a heartbeat.", weight: 1 },
        { id: "demo-table-ink", text: "A blank chart begins drawing itself.", weight: 1 },
      ] },
    ], lastRoll: null,
    sessions: [{
      id: "demo-session-lighthouse", campaignId: "demo-lantern", title: "The Lighthouse Signal", date: "2026-10-29",
      notes: "Arden and Mira met Keeper Vela at the unlit lighthouse. Vela asked them to find the missing lens in the tide caves. The party agreed to return before the spring tide.",
      sections, versions: [{ revision: 1, status: "approved", sections: structuredClone(sections), createdAt: "2026-10-29T18:00:00.000Z" }],
      sources: [{ id: "demo-source-lighthouse", title: "Fictional session transcript", original: "Arden and Meera met keeper Veela at the lighthouse.", reviewed: "Arden and Mira met Keeper Vela at the lighthouse." }],
    }],
  };
}
