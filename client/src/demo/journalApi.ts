import {
  importInput, sessionInput, notesInput, suggestNames, renderReviewed, nameKey, validateText,
  type Reference, type SessionDetail,
} from "@shared/journal";
import {
  emptySummarySections, summaryWriteSchema, summaryRestoreSchema,
  type SummarySource, type SummaryState, type SummaryVersion,
} from "@shared/sessionSummary";
import type { WorkspaceDemoData } from "./workspaceData";

export class DemoApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const missing = () => { throw new DemoApiError(404, "Fictional demo record not found."); };
export function demoReferences(d: WorkspaceDemoData, cid: number): Reference[] {
  const links = d.links.filter(l => l.campaignId === cid);
  return [
    ...d.characters.filter(c => c.campaignId === cid).map(c => ({ key: `character:${c.id}`, name: c.name, source: "Party roster" })),
    ...d.homebrew.filter(c => c.campaignId === cid || links.some(l => l.kind === "npcs" && l.resourceId === c.id))
      .map(c => ({ key: `npc:${c.id}`, name: c.name, source: "Homebrew bestiary" })),
    ...d.items.filter(c => c.campaignId === cid || links.some(l => l.kind === "items" && l.resourceId === c.id))
      .map(c => ({ key: `item:${c.id}`, name: c.name, source: "Campaign item" })),
  ];
}
async function snapshot(detail: SessionDetail) {
  const s = detail.session;
  const sources: SummarySource[] = [
    { id: `notes:${s.id}@${s.revision}`, title: "Live DM notes", kind: "notes", revision: s.revision, text: s.notes },
    ...detail.imports.map(i => ({ id: `import:${i.id}@${i.revision}`, title: i.title,
      kind: "import" as const, importId: i.id, revision: i.revision, text: i.original })),
  ];
  const bytes = new TextEncoder().encode(JSON.stringify({ session: s, imports: detail.imports }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sourceFingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  return { sources, sourceFingerprint };
}
async function summaryState(d: WorkspaceDemoData, detail: SessionDetail): Promise<SummaryState> {
  const versions = d.summaries[detail.session.id] ?? [];
  const current = versions[versions.length - 1] ?? null;
  const approved = versions.filter(v => v.status === "approved").pop() ?? null;
  const source = await snapshot(detail);
  return { current, approved, ...source, stale: !!current && current.sourceFingerprint !== source.sourceFingerprint,
    ai: { available: false, reason: "No AI provider is configured. The demo never calls a paid service." } };
}

/** Same journal UI contracts and review helpers; persistence is fictional and browser-only. */
export async function journalApi(d: WorkspaceDemoData, cid: number, parts: string[], method: string, body: any) {
  const [resource, sid, child, iid, action] = parts;
  const nextId = () => `demo-${d.nextId++}`;
  if (resource === "capabilities" && method === "GET") return { available: true, reason: "", audio: true };
  if (resource === "references" && method === "GET") return demoReferences(d, cid);
  if (resource === "aliases") {
    const aliases = d.aliases[cid] ??= [];
    if (method === "GET") return aliases;
    if (method === "DELETE") { d.aliases[cid] = aliases.filter(a => a.id !== sid); return null; }
    if (method === "POST" || method === "PATCH") {
      if (!body.phrase?.trim() || !demoReferences(d, cid).some(r => r.key === body.referenceKey))
        throw new DemoApiError(400, "Choose an existing campaign reference and a phrase.");
      if (method === "POST") { const a = { id: nextId(), phrase: body.phrase.trim(), referenceKey: body.referenceKey }; aliases.push(a); return a; }
      const a = aliases.find(a => a.id === sid) ?? missing();
      Object.assign(a, { phrase: body.phrase.trim(), referenceKey: body.referenceKey }); return a;
    }
  }
  if (resource !== "sessions") return missing();
  if (!sid) {
    if (method === "GET") return d.sessions.filter(s => s.session.campaignId === cid).map(s => s.session);
    if (method === "POST") {
      const input = sessionInput.parse(body);
      const detail: SessionDetail = { session: { ...input, id: nextId(), campaignId: cid, notes: "",
        revision: 0, updatedAt: new Date().toISOString() }, imports: [], recordings: [] };
      d.sessions.unshift(detail); return detail.session;
    }
  }
  const detail = d.sessions.find(s => s.session.campaignId === cid && s.session.id === sid) ?? missing();
  if (!child) {
    if (method === "GET") return detail;
    if (method === "PATCH") { Object.assign(detail.session, sessionInput.parse(body), { updatedAt: new Date().toISOString() }); return detail.session; }
    if (method === "DELETE") {
      d.sessions = d.sessions.filter(s => s !== detail); delete d.summaries[sid]; return null;
    }
  }
  if (child === "notes" && method === "PUT") {
    const input = notesInput.parse(body);
    if (input.revision !== detail.session.revision) throw new DemoApiError(409, "These notes changed elsewhere. Reload before retrying.");
    Object.assign(detail.session, { notes: validateText(input.notes, true), revision: input.revision + 1, updatedAt: new Date().toISOString() });
    return detail.session;
  }
  if (child === "recordings" || (child === "imports" && iid === "file")) {
    throw new DemoApiError(403, "File and audio uploads are disabled in this public demo. Paste fictional text to test journal imports; no file is sent to a server.");
  }
  if (child === "imports") {
    if (!iid && method === "POST") {
      const input = importInput.parse(body);
      validateText(input.text);
      const item = { id: nextId(), sessionId: sid, title: input.title, kind: input.kind, format: input.format,
        original: input.text, reviewed: input.text,
        suggestions: suggestNames(input.text, demoReferences(d, cid), d.aliases[cid] ?? []),
        decisions: [], revision: 0, editedText: null };
      detail.imports.push(item); return item;
    }
    const item = detail.imports.find(i => i.id === iid) ?? missing();
    if (body.revision !== item.revision) throw new DemoApiError(409, "Review changed elsewhere. Reload before editing.");
    if (action === "edit" && method === "PUT") {
      item.editedText = body.text === null ? null : validateText(body.text, true);
    } else if (action === "decisions" && method === "POST") {
      if (item.editedText !== null) throw new DemoApiError(409, "Discard manual reviewed-text edits before changing decisions.");
      const chosen = item.suggestions.find(s => s.id === body.suggestionId) ?? missing();
      if (body.referenceKey && !chosen.candidates.some(c => c.key === body.referenceKey))
        throw new DemoApiError(400, "Choose an existing candidate.");
      const targets = body.allMatching ? item.suggestions.filter(s => nameKey(s.phrase) === nameKey(chosen.phrase) &&
        (!body.referenceKey || s.candidates.some(c => c.key === body.referenceKey))) : [chosen];
      item.decisions = item.decisions.filter(v => !targets.some(t => t.id === v.suggestionId));
      if (!body.undo) item.decisions.push(...targets.map(t => ({ suggestionId: t.id, referenceKey: body.referenceKey })));
    } else return missing();
    item.revision++;
    item.reviewed = item.editedText ?? renderReviewed(item.original, item.suggestions, item.decisions);
    return item;
  }
  if (child === "summary") {
    const state = await summaryState(d, detail);
    const versions = d.summaries[sid] ??= [];
    if (iid === "history" && method === "GET") {
      if (action) return versions.find(v => v.revision === Number(action)) ?? missing();
      return versions.slice().reverse().map(({ sections, sources, sourceFingerprint, ...metadata }) => metadata);
    }
    if (method === "GET" && !iid) return state;
    if (method !== "POST" || (iid && iid !== "restore")) return missing();
    const restore = iid === "restore";
    const input = restore ? summaryRestoreSchema.parse(body) : summaryWriteSchema.parse(body);
    if (input.expectedRevision !== (state.current?.revision ?? 0) || input.sourceFingerprint !== state.sourceFingerprint)
      throw new DemoApiError(409, "Summary revision or source snapshot changed. Refresh and review before saving.");
    const restored = restore ? versions.find(v => v.revision === body.revision) ?? missing() : null;
    const sections = structuredClone(restored?.sections ?? body.sections ?? emptySummarySections());
    if (!restore && body.action === "approve" && !sections.some((s: { text: string }) => s.text.trim()))
      throw new DemoApiError(400, "Write at least one summary section before approving.");
    const available = new Map([...(state.current?.sources ?? []), ...(restored?.sources ?? []), ...state.sources].map(s => [s.id, s]));
    const ids = Array.from(new Set<string>(sections.flatMap((s: { sourceIds: string[] }) => s.sourceIds)));
    const sources = ids.map(id => available.get(id) ?? missing());
    const version: SummaryVersion = { sessionId: sid, revision: (state.current?.revision ?? 0) + 1,
      status: !restore && body.action === "approve" ? "approved" : "draft",
      action: restore ? "restore" : body.action, sections, sources, sourceFingerprint: state.sourceFingerprint,
      restoredFrom: restored?.revision ?? null, createdAt: new Date().toISOString() };
    versions.push(version);
    return summaryState(d, detail);
  }
  return missing();
}
