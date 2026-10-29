import { z } from "zod";

export const SUMMARY_SECTIONS = [
  { id: "overview", title: "Session Overview" },
  { id: "events", title: "Major Events" },
  { id: "npcs", title: "NPCs Encountered" },
  { id: "locations", title: "Locations Visited" },
  { id: "quests", title: "Quests & Objectives" },
  { id: "items", title: "Important Items & Rewards" },
  { id: "consequences", title: "Consequences" },
  { id: "threads", title: "Unresolved Threads" },
  { id: "next", title: "Next Session" },
] as const;
export type SummarySectionId = typeof SUMMARY_SECTIONS[number]["id"];
export const sectionSchema = z.object({
  id: z.enum(["overview", "events", "npcs", "locations", "quests", "items", "consequences", "threads", "next"]),
  text: z.string().max(12000),
  annotation: z.string().max(2000),
  locked: z.boolean(),
  sourceIds: z.array(z.string().min(1).max(180)).max(40),
}).strict();
export const sectionsSchema = z.array(sectionSchema).length(9).refine(
  sections => new Set(sections.map(section => section.id)).size === 9,
  "Provide each summary section exactly once.",
);
export type SummarySection = z.infer<typeof sectionSchema>;
export function emptySummarySections(): SummarySection[] {
  return SUMMARY_SECTIONS.map(({ id }) => ({ id, text: "", annotation: "", locked: false, sourceIds: [] }));
}
export interface SummarySource {
  id: string;
  title: string;
  kind: "notes" | "import";
  importId?: string;
  revision: number;
  /** Snapshot of live notes or immutable imported original, never linked resource data. */
  text: string;
}
export interface SummaryVersion {
  sessionId: string;
  revision: number;
  status: "draft" | "approved";
  action: "save" | "approve" | "restore";
  sections: SummarySection[];
  sources: SummarySource[];
  sourceFingerprint: string;
  createdAt: string;
  restoredFrom: number | null;
}
export type SummaryHistoryEntry = Omit<SummaryVersion, "sections" | "sources" | "sourceFingerprint">;
export interface SummaryState {
  current: SummaryVersion | null;
  approved: SummaryVersion | null;
  sources: SummarySource[];
  sourceFingerprint: string;
  stale: boolean;
  ai: { available: false; reason: string };
}
export const summaryWriteSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum(["save", "approve"]),
  sections: sectionsSchema,
}).strict();
export const summaryRestoreSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().positive(),
}).strict();
