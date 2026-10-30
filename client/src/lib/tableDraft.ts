export interface TableDraft {
  id?: number;
  name: string;
  description: string;
  category: string;
  mode: "range" | "weighted";
  entries: Array<{ text: string; minRoll: string; maxRoll: string; weight: string }>;
}
/** Reject corrupt or unbounded browser drafts, rather than mounting malformed form data. */
export function parseTableDraft(raw: string | null): TableDraft | null {
  if (!raw || raw.length > 500_000) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || (d.id !== undefined && (!Number.isSafeInteger(d.id) || d.id < 1))
      || !["name", "description", "category"].every(k => typeof d[k] === "string")
      || !["range", "weighted"].includes(d.mode) || !Array.isArray(d.entries) || d.entries.length > 1000
      || !d.entries.every((e: unknown) => e && typeof e === "object"
        && ["text", "minRoll", "maxRoll", "weight"].every(k => typeof (e as Record<string, unknown>)[k] === "string"))) return null;
    return d;
  } catch { return null; }
}
