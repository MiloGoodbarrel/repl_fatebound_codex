import { createHash } from "node:crypto";
import type { Router, Request } from "express";
import type { JournalSession } from "@shared/journal";
import type { SummaryHistoryEntry, SummarySection, SummarySource, SummaryState, SummaryVersion } from "@shared/sessionSummary";
import { SUMMARY_SECTIONS, summaryWriteSchema, summaryRestoreSchema } from "@shared/sessionSummary";
import type { StoredImport } from "./repository";

export class SummaryError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export const AI_SUMMARY_UNAVAILABLE = {
  available: false as const,
  reason: "AI drafting is not connected. You can write, edit, save, and approve a structured summary without an AI account. No session content is sent to an AI provider.",
};
export function summarySources(session: JournalSession, imports: StoredImport[]) {
  // Historical citations never cache names taken from cross-campaign links.
  // Imports preserve their immutable original; reviewed text remains in the
  // existing permission-checked source panel.
  const sources: SummarySource[] = [
    ...(session.notes.trim() ? [{ id: `notes@${session.revision}`, title: "Live notes", kind: "notes" as const, revision: session.revision, text: session.notes }] : []),
    ...imports.slice().sort((a, b) => a.id.localeCompare(b.id)).map(item => ({
      id: `import:${item.id}@${item.revision}`, title: item.title, kind: "import" as const,
      importId: item.id, revision: item.revision, text: item.original,
    })),
  ];
  const sourceFingerprint = createHash("sha256").update(JSON.stringify({
    title: session.title, date: session.date, revision: session.revision, notes: session.notes,
    imports: imports.slice().sort((a, b) => a.id.localeCompare(b.id)).map(item => ({
      id: item.id, title: item.title, revision: item.revision, original: item.original,
      decisions: item.decisions, editedText: item.editedText,
    })),
  })).digest("hex");
  return { sources, sourceFingerprint };
}
export interface SummaryMutation {
  expectedRevision: number;
  sourceFingerprint: string;
  action: "save" | "approve" | "restore";
  sections?: SummarySection[];
  restoreRevision?: number;
}
export interface SummaryRepository {
  load(campaignId: number, sid: string): Promise<SummaryState>;
  history(campaignId: number, sid: string): Promise<SummaryHistoryEntry[]>;
  version(campaignId: number, sid: string, revision: number): Promise<SummaryVersion | undefined>;
  write(campaignId: number, sid: string, mutation: SummaryMutation): Promise<SummaryState>;
}
export function summaryState(current: SummaryVersion | null, approved: SummaryVersion | null, sources: ReturnType<typeof summarySources>): SummaryState {
  return { current, approved, ...sources, stale: !!current && current.sourceFingerprint !== sources.sourceFingerprint, ai: AI_SUMMARY_UNAVAILABLE };
}
export function nextSummaryVersion(
  sid: string, mutation: SummaryMutation, current: SummaryVersion | null,
  snapshot: ReturnType<typeof summarySources>, restore?: SummaryVersion,
): SummaryVersion {
  if ((current?.revision ?? 0) !== mutation.expectedRevision) throw new SummaryError(409, "The summary changed in another tab. Refresh references and review the saved version; your draft has not been applied.");
  if (snapshot.sourceFingerprint !== mutation.sourceFingerprint) throw new SummaryError(409, "Session sources changed. Refresh source references and review your draft before saving or approving.");
  const input = mutation.action === "restore" ? restore?.sections : mutation.sections;
  if (!input) throw new SummaryError(404, "That summary revision does not exist in this session.");
  const sections = SUMMARY_SECTIONS.map(({ id }) => {
    const section = input.find(value => value.id === id);
    if (!section) throw new SummaryError(400, "A summary section is missing.");
    return { ...section, sourceIds: Array.from(new Set(section.sourceIds)) };
  });
  if (mutation.action === "approve" && !sections.some(section => section.text.trim())) {
    throw new SummaryError(400, "Write at least one summary section before approving.");
  }
  const cited = new Set(sections.flatMap(section => section.sourceIds));
  const available = new Map([
    ...(current?.sources ?? []),
    ...(mutation.action === "restore" ? restore?.sources ?? [] : []),
    ...snapshot.sources,
  ].map(source => [source.id, source]));
  for (const id of Array.from(cited)) if (!available.has(id)) throw new SummaryError(400, "A source reference does not belong to this session or summary revision.");
  // Store only cited snapshots, not the entire transcript collection on every edit.
  const sources = Array.from(cited).map(id => available.get(id)!);
  if (Buffer.byteLength(JSON.stringify(sources)) > 1024 * 1024) throw new SummaryError(413, "Cited source snapshots exceed 1 MiB. Use fewer source documents in this revision.");
  return {
    sessionId: sid, revision: (current?.revision ?? 0) + 1,
    status: mutation.action === "approve" ? "approved" : "draft", action: mutation.action,
    sections, sources, sourceFingerprint: snapshot.sourceFingerprint,
    createdAt: new Date().toISOString(), restoredFrom: mutation.action === "restore" ? mutation.restoreRevision ?? null : null,
  };
}
export function registerSummaryRoutes(
  router: Router, assertSession: (req: Request) => Promise<unknown>, repo?: SummaryRepository,
) {
  const scope = async (req: Request) => {
    await assertSession(req);
    if (!repo) throw new SummaryError(503, "Structured summaries are unavailable. Existing notes and imported originals are unchanged.");
    return { campaignId: Number(req.params.campaignId), sid: req.params.sid, repo };
  };
  const wrap = (fn: (req: Request, res: import("express").Response) => Promise<unknown>) =>
    (req: Request, res: import("express").Response, next: import("express").NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
  router.get("/sessions/:sid/summary", wrap(async (req, res) => {
    const s = await scope(req); res.json(await s.repo.load(s.campaignId, s.sid));
  }));
  router.post("/sessions/:sid/summary", wrap(async (req, res) => {
    const s = await scope(req), data = summaryWriteSchema.parse(req.body);
    res.json(await s.repo.write(s.campaignId, s.sid, data));
  }));
  router.get("/sessions/:sid/summary/history", wrap(async (req, res) => {
    const s = await scope(req); res.json(await s.repo.history(s.campaignId, s.sid));
  }));
  router.get("/sessions/:sid/summary/history/:revision", wrap(async (req, res) => {
    const s = await scope(req), revision = Number(req.params.revision);
    if (!/^[1-9]\d*$/.test(req.params.revision) || !Number.isSafeInteger(revision)) throw new SummaryError(400, "Invalid summary revision.");
    const value = await s.repo.version(s.campaignId, s.sid, revision);
    if (!value) throw new SummaryError(404, "Summary revision not found in this session.");
    res.json(value);
  }));
  router.post("/sessions/:sid/summary/restore", wrap(async (req, res) => {
    const s = await scope(req), data = summaryRestoreSchema.parse(req.body);
    res.json(await s.repo.write(s.campaignId, s.sid, {
      expectedRevision: data.expectedRevision, sourceFingerprint: data.sourceFingerprint,
      action: "restore", restoreRevision: data.revision,
    }));
  }));
}
