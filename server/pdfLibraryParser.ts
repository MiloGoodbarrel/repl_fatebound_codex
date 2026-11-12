import { z } from "zod";
import { creatureProfileSchema } from "../shared/creatureProfiles";

export const pdfItemSchema = z.object({
  name: z.string().trim().min(1).max(250),
  category: z.string().trim().min(1).max(100),
  rarity: z.string().trim().min(1).max(100),
  description: z.string().max(60000),
  source: z.string().max(250).optional(),
  sourcePage: z.number().int().positive().optional(),
  itemType: z.string().max(250).nullable().optional(),
  damage: z.string().max(500).nullable().optional(),
  weight: z.string().max(250).nullable().optional(),
  cost: z.string().max(250).nullable().optional(),
  properties: z.string().max(2000).nullable().optional(),
  attunement: z.string().max(500).nullable().optional(),
});

export const pdfCommitSchema = z.discriminatedUnion("kind", [
  z.object({ idempotencyKey: z.uuid(), kind: z.literal("creatures"), entries: z.array(creatureProfileSchema.extend({
    hp: z.number().finite().nonnegative(), ac: z.number().finite().nonnegative(),
    name: z.string().trim().min(1).max(250),
  })).min(1).max(100) }),
  z.object({ idempotencyKey: z.uuid(), kind: z.literal("items"), entries: z.array(pdfItemSchema).min(1).max(100) }),
]);

export type PdfCommit = z.infer<typeof pdfCommitSchema>;

/** Conservative, provider-free recognition. Never invent missing combat stats. */
export function recognizePdfLibrary(text: string, filename: string, kind: "creatures" | "items") {
  const candidates: Record<string, unknown>[] = [];
  const pages = text.split(/\[\[Page (\d+)\]\]/);
  const warnings = [
    "Automatic recognition is not a complete module conversion. Review every entry against the source before saving.",
    "Columns, tables, spells and unusual rules may not parse correctly. Undetected entries can be added manually; scanned PDFs need OCR first.",
    "Entries append to this campaign only. The PDF itself is not retained.",
  ];
  for (let p = 1; p < pages.length && candidates.length < 100; p += 2) {
    const page = Number(pages[p]);
    const lines = (pages[p + 1] ?? "").replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean);
    const starts: number[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (kind === "creatures"
        ? /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+\w.+,\s*.+$/i.test(lines[i])
        : /^(Wondrous item|Weapon(?:\s*\([^)]*\))?|Armor(?:\s*\([^)]*\))?|Potion|Ring|Rod|Staff|Wand|Scroll),\s*(?:common|uncommon|rare|very rare|legendary|artifact)\b/i.test(lines[i])) {
        starts.push(i - 1);
      }
    }
    for (let j = 0; j < starts.length && candidates.length < 100; j++) {
      const block = lines.slice(starts[j], starts[j + 1] ?? lines.length);
      const name = block[0];
      const raw = block.join("\n");
      if (!name || name.length > 250) continue;
      if (kind === "creatures") {
        const ac = /\bArmor Class\s+(\d+)/i.exec(raw);
        const hp = /\bHit Points\s+(\d+)(?:\s*\(([^)]+)\))?/i.exec(raw);
        const cr = /\bChallenge\s+(\d+(?:\/\d+)?)/i.exec(raw);
        const shape = /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(.+?),\s*(.+)$/i.exec(block[1]);
        if (!ac || !hp || !cr || !shape) {
          warnings.push(`Page ${page}: "${name}" was not auto-added because required combat statistics could not be read.`);
          continue;
        }
        const profile: Record<string, unknown> = {
          index: `pdf-${page}-${j}`, name, ac: Number(ac[1]), hp: Number(hp[1]),
          cr: cr[1], size: shape[1], type: shape[2], alignment: shape[3],
          source: filename, sourcePage: page, description: raw,
          hit_dice: hp[2], actions: [],
        };
        // Ability score tables are optional: only copy a complete six-score row.
        const abilities = /STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\s+([\s\S]+)/i.exec(raw);
        const scores = abilities?.[1].match(/\d+\s*\([+\-−]?\d+\)/g)?.slice(0, 6);
        if (scores?.length === 6) {
          ["str", "dex", "con", "int", "wis", "cha"].forEach((key, i) => { profile[key] = Number(/^\d+/.exec(scores[i])![0]); });
        }
        const actionStart = block.findIndex(l => /^Actions$/i.test(l));
        if (actionStart >= 0) {
          const actionText = block.slice(actionStart + 1).join("\n");
          profile.actions = [{ name: "Imported actions — review source", desc: actionText }];
        }
        const checked = creatureProfileSchema.safeParse(profile);
        if (checked.success) candidates.push(checked.data);
      } else {
        const info = /^([^,]+),\s*(common|uncommon|rare|very rare|legendary|artifact)\b(.*)$/i.exec(block[1]);
        if (!info) continue;
        const category = /^Wondrous/i.test(info[1]) ? "Wondrous Items" : /^Staff/i.test(info[1]) ? "Staves" : info[1].split("(")[0].trim();
        candidates.push({ name, category, rarity: info[2].replace(/\b\w/g, c => c.toUpperCase()),
          description: raw, source: filename, sourcePage: page,
          attunement: /attunement/i.test(info[3]) ? info[3].trim() : null });
      }
    }
  }
  if (candidates.length === 100) warnings.push("Preview limited to 100 entries. Split larger documents into smaller PDFs.");
  if (!candidates.length) warnings.push("No reliable entries recognized. Use the extracted text to create entries manually, or use CSV.");
  return { candidates, warnings };
}
