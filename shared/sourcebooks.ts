/** Display names only. Filter values always remain the original catalog codes. */
export const SOURCEBOOK_NAMES: Record<string, string> = {
  PHB: "Player's Handbook",
  DMG: "Dungeon Master's Guide",
  MM: "Monster Manual",
  AAG: "Astral Adventurer's Guide",
  AQI: "Acquisitions Incorporated",
  BAM: "Boo's Astral Menagerie",
  BGG: "Bigby Presents: Glory of the Giants",
  BOMT: "The Book of Many Things",
  CM: "Candlekeep Mysteries",
  COS: "Curse of Strahd",
  CRCN: "Critical Role: Call of the Netherdeep",
  DIA: "Baldur's Gate: Descent into Avernus",
  DLCT: "Descent into the Lost Caverns of Tsojcanth",
  DNDC: "D&D Celebration",
  DPM: "Dragon+ Magazine",
  DSDQ: "Dragonlance: Shadow of the Dragon Queen",
  EEPC: "Elemental Evil Player's Companion",
  EGW: "Explorer's Guide to Wildemount",
  ERLW: "Eberron: Rising from the Last War",
  FTD: "Fizban's Treasury of Dragons",
  GGR: "Guildmasters' Guide to Ravnica",
  GHCG: "Grim Hollow: The Campaign Guide",
  GHMG: "Grim Hollow: The Monster Grimoire",
  GHPG: "Grim Hollow: The Players Guide",
  GOS: "Ghosts of Saltmarsh",
  HFSCM: "Heroes' Feast: Saving the Children's Menu",
  HOTDQ: "Hoard of the Dragon Queen",
  JITR: "Journey into the Realms",
  JRC: "Journeys through the Radiant Citadel",
  KFTGV: "Keys from the Golden Vault",
  LLOK: "Lost Laboratory of Kwalish",
  LMI: "Legendary Magic Items",
  LMOP: "Lost Mine of Phandelver",
  LOX: "Light of Xaryxis",
  MOOT: "Mythic Odysseys of Theros",
  MTF: "Mordenkainen's Tome of Foes",
  OGA: "One Grung Above",
  OOTA: "Out of the Abyss",
  PABTSO: "Phandelver and Below: The Shattered Obelisk",
  POTA: "Princes of the Apocalypse",
  QIS: "Quests from the Infinite Staircase",
  ROT: "The Rise of Tiamat",
  ROTFM: "Icewind Dale: Rime of the Frostmaiden",
  SATO: "Planescape: Sigil and the Outlands",
  SCAG: "Sword Coast Adventurer's Guide",
  SCOC: "Strixhaven: A Curriculum of Chaos",
  SDW: "Sleeping Dragon's Wake",
  SHOPCAT: "Shop Catalog (supplemental crafting and market entries)",
  SKT: "Storm King's Thunder",
  "SKT-GUIDE": "Storm King's Thunder — supplemental guide",
  TCE: "Tasha's Cauldron of Everything",
  TOA: "Tomb of Annihilation",
  TP: "The Tortle Package",
  TYP: "Tales from the Yawning Portal",
  VEOR: "Vecna: Eve of Ruin",
  VGM: "Volo's Guide to Monsters",
  VNEE: "Vecna: Nest of the Eldritch Eye",
  VRGR: "Van Richten's Guide to Ravenloft",
  WBW: "The Wild Beyond the Witchlight",
  WDDMM: "Waterdeep: Dungeon of the Mad Mage",
  WDH: "Waterdeep: Dragon Heist",
  WGE: "Wayfinder's Guide to Eberron",
  XGE: "Xanathar's Guide to Everything",
  AETHERFALL: "Aetherfall (homebrew setting)",
  HOMEBREW: "Homebrew — custom campaign content",
};

export function sourcebookName(source: string): string {
  const code = source.trim();
  const known = SOURCEBOOK_NAMES[code.toUpperCase()];
  if (known) return known;
  if (/[+/]/.test(code)) return code.split(/([+/])/).map(part =>
    part === "+" ? " + " : part === "/" ? " / " : sourcebookName(part)).join("");
  // Full names and unrecognized third-party identifiers are never guessed.
  return code;
}

export function sourcebookMatches(source: string, search: string) {
  const query = search.trim().toLowerCase();
  return source.toLowerCase().includes(query) || sourcebookName(source).toLowerCase().includes(query);
}
