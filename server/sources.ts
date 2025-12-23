/**
 * Data sources configuration for D&D items across all editions
 * Each source defines where to import items from and how to identify them
 */

export type Edition = "5e" | "3e" | "4e" | "adnd" | "odnd" | "onednd";

export interface DataSource {
  id: string;
  name: string;
  edition: Edition;
  url: string;
  type: "api" | "github" | "html" | "csv" | "json";
  priority: number; // Lower = higher priority for deduplication
  description: string;
  enabled?: boolean;
}

export const SOURCES: Record<Edition, DataSource[]> = {
  "5e": [
    {
      id: "5e_api",
      name: "D&D 5e Official API",
      edition: "5e",
      url: "https://www.dnd5eapi.co/api/2014/magic-items",
      type: "api",
      priority: 1,
      description: "Official D&D 5e API from dnd5eapi.co",
      enabled: true,
    },
    {
      id: "5e_srd",
      name: "5e SRD Equipment & Magic Items",
      edition: "5e",
      url: "https://www.5esrd.com/",
      type: "html",
      priority: 2,
      description: "5e SRD website - Equipment and Magic Items sections",
      enabled: false,
    },
    {
      id: "5e_itemdb",
      name: "Item DB",
      edition: "5e",
      url: "https://github.com/blawson69/ItemDB",
      type: "github",
      priority: 3,
      description: "Comprehensive 5e item database on GitHub",
      enabled: false,
    },
    {
      id: "5e_database",
      name: "5e Database",
      edition: "5e",
      url: "https://github.com/5e-bits/5e-database",
      type: "github",
      priority: 4,
      description: "5e Database JSON files",
      enabled: false,
    },
    {
      id: "5e_giddylimit",
      name: "TheGiddyLimit",
      edition: "5e",
      url: "https://github.com/TheGiddyLimit/TheGiddyLimit.github.io",
      type: "github",
      priority: 5,
      description: "Giddylimit 5e homebrew and official content",
      enabled: false,
    },
  ],

  "3e": [
    {
      id: "3e_d20srd",
      name: "d20 SRD - Magic Items A-Z",
      edition: "3e",
      url: "https://5e.d20srd.org/srd/magicItems/magicItemsAToZ.htm",
      type: "html",
      priority: 1,
      description: "3e SRD magic items alphabetical list",
      enabled: false,
    },
    {
      id: "3e_d20srd_wondrous",
      name: "d20 SRD - Wondrous Items",
      edition: "3e",
      url: "https://5e.d20srd.org/srd/magicItems/wondrousItems.htm",
      type: "html",
      priority: 2,
      description: "3e SRD wondrous items",
      enabled: false,
    },
    {
      id: "3e_d20srd_artifacts",
      name: "d20 SRD - Artifacts",
      edition: "3e",
      url: "https://5e.d20srd.org/srd/magicItems/artifacts.htm",
      type: "html",
      priority: 3,
      description: "3e SRD artifacts",
      enabled: false,
    },
    {
      id: "3e_jwoos",
      name: "d20 SRD JSON",
      edition: "3e",
      url: "https://github.com/jwoos/d20srd",
      type: "github",
      priority: 4,
      description: "d20 SRD data in JSON format",
      enabled: false,
    },
    {
      id: "3e_tgallager",
      name: "d20 SRD Repository",
      edition: "3e",
      url: "https://github.com/tgallager/d20srd",
      type: "github",
      priority: 5,
      description: "Another d20 SRD data repository",
      enabled: false,
    },
  ],

  "4e": [
    {
      id: "4e_sheep",
      name: "D&D 4e Database",
      edition: "4e",
      url: "https://github.com/Sheep-y/trpg-dnd-4e-db",
      type: "github",
      priority: 1,
      description: "Comprehensive 4e D&D database",
      enabled: false,
    },
    {
      id: "4e_iws",
      name: "D&D 4e Tools",
      edition: "4e",
      url: "https://iws.mx/dnd/",
      type: "html",
      priority: 2,
      description: "D&D 4e tools and item lists",
      enabled: false,
    },
  ],

  "adnd": [
    {
      id: "adnd_dragonsfoot",
      name: "Dragon's Foot AD&D Archive",
      edition: "adnd",
      url: "https://www.dragonsfoot.org/ad/index.shtml",
      type: "html",
      priority: 1,
      description: "Dragon's Foot AD&D resource archive",
      enabled: false,
    },
  ],

  "odnd": [
    {
      id: "odnd_osric",
      name: "OSRIC - Old School Rules In Cartloads",
      edition: "odnd",
      url: "https://www.knights-n-knaves.com/osric/",
      type: "html",
      priority: 1,
      description: "OSRIC OD&D compatible ruleset and items",
      enabled: false,
    },
    {
      id: "odnd_swordsandwizardry",
      name: "Swords & Wizardry",
      edition: "odnd",
      url: "https://swordsandwizardry.blogspot.com/",
      type: "html",
      priority: 2,
      description: "Swords & Wizardry OD&D retro-clone",
      enabled: false,
    },
  ],

  "onednd": [
    {
      id: "onednd_api",
      name: "One D&D API (Future)",
      edition: "onednd",
      url: "https://www.dndbeyond.com/",
      type: "api",
      priority: 1,
      description: "One D&D 2024 official content (when available)",
      enabled: false,
    },
  ],
};

/**
 * Get all enabled sources
 */
export function getEnabledSources(): DataSource[] {
  return Object.values(SOURCES)
    .flat()
    .filter((source) => source.enabled !== false);
}

/**
 * Get sources for a specific edition
 */
export function getSourcesForEdition(edition: Edition): DataSource[] {
  return SOURCES[edition] || [];
}

/**
 * Get a source by ID
 */
export function getSourceById(id: string): DataSource | undefined {
  return Object.values(SOURCES)
    .flat()
    .find((source) => source.id === id);
}
