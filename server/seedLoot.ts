import fs from "fs";
import path from "path";
import { db } from "./db";
import { items5e } from "@shared/schema";
import { eq, count } from "drizzle-orm";

// Positional columns in the 5e_loot.csv (no header row):
// 0:name  1:category  2:rarity  3:description  4:item_type
// 5:damage  6:damage_type  7:weapon_type  8:weight  9:cost
// 10:properties  11:attunement  12:source  13:page  14:edition
// 15:tags  16:(empty)  17:notes

const EDITION_MAP: Record<string, string> = {
  "5e 2014": "5e",
  "5e": "5e",
  "one d&d": "onednd",
  "onednd": "onednd",
  "2024": "onednd",
  "4th edition": "4e",
  "4e": "4e",
  "3.5 edition": "3.5e",
  "3.5e": "3.5e",
  "3rd edition": "3e",
  "3e": "3e",
  "ad&d": "adnd",
  "adnd": "adnd",
};

function normalizeEdition(raw: string): string {
  return EDITION_MAP[raw.toLowerCase().trim()] ?? "5e";
}

function normalizeAttunement(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v || v === "false" || v === "no") return null;
  if (v === "true" || v === "yes") return "Requires Attunement";
  // Preserve custom text like "Requires attunement by a spellcaster"
  return raw.trim();
}

function normalizeRarity(raw: string): string {
  if (!raw.trim()) return "Mundane";
  // Capitalise first letter, lowercase rest
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
}

function parsePositionalCSV(text: string) {
  const rows: any[] = [];
  const seen = new Set<string>();

  let inQuote = false;
  let current = "";
  const cells: string[] = [];
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      row.push(current.trim());
      current = "";
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(current.trim());
      current = "";

      const get = (idx: number) => (row[idx] ?? "").replace(/^"|"$/g, "").trim();
      const name = get(0);
      if (name) {
        const dedupeKey = `${name.toLowerCase()}|${get(1).toLowerCase()}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          rows.push({
            name,
            category: get(1) || "Miscellaneous",
            rarity: normalizeRarity(get(2)),
            description: get(3) || "",
            itemType: get(4) || null,
            damage: get(5) || get(6) || null,
            weight: get(8) || null,
            cost: get(9) || null,
            properties: get(10) || null,
            attunement: normalizeAttunement(get(11)),
            source: get(12) || null,
            edition: normalizeEdition(get(14)),
          });
        }
      }
      row = [];
    } else {
      current += ch;
    }
  }
  // flush last row if no trailing newline
  if (row.length > 0 || current.trim()) {
    row.push(current.trim());
    const get = (idx: number) => (row[idx] ?? "").replace(/^"|"$/g, "").trim();
    const name = get(0);
    if (name) {
      const dedupeKey = `${name.toLowerCase()}|${get(1).toLowerCase()}`;
      if (!seen.has(dedupeKey)) {
        rows.push({
          name,
          category: get(1) || "Miscellaneous",
          rarity: normalizeRarity(get(2)),
          description: get(3) || "",
          itemType: get(4) || null,
          damage: get(5) || get(6) || null,
          weight: get(8) || null,
          cost: get(9) || null,
          properties: get(10) || null,
          attunement: normalizeAttunement(get(11)),
          source: get(12) || null,
          edition: normalizeEdition(get(14)),
        });
      }
    }
  }

  return rows;
}

export async function seedLootTable(edition: string = "5e", force = false): Promise<{ inserted: number; skipped: boolean }> {
  // Both configured launch commands run from the project root. Keep the seed
  // asset path independent of ESM versus the bundled CommonJS output directory.
  const csvPath = path.resolve(process.cwd(), "server", "data", `${edition}_loot.csv`);
  if (!fs.existsSync(csvPath)) {
    console.warn(`[seed] No loot file found at ${csvPath}`);
    return { inserted: 0, skipped: true };
  }

  if (!force) {
    const [{ value }] = await db.select({ value: count() }).from(items5e);
    if (Number(value) > 0) {
      console.log(`[seed] items_5e already has ${value} rows — skipping auto-seed.`);
      return { inserted: 0, skipped: true };
    }
  }

  if (force) {
    await db.delete(items5e).where(eq(items5e.edition, edition));
    console.log(`[seed] Cleared existing ${edition} items.`);
  }

  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parsePositionalCSV(text);

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(items5e).values(rows.slice(i, i + BATCH));
    inserted += rows.slice(i, i + BATCH).length;
  }

  console.log(`[seed] Imported ${inserted} items from ${edition}_loot.csv`);
  return { inserted, skipped: false };
}
