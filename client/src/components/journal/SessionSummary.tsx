import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Archive, BookOpen, Check, ChevronDown, Download, Eye, History, LockKeyhole, Pencil, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { SUMMARY_SECTIONS, emptySummarySections, type SummaryHistoryEntry, type SummarySection, type SummarySource, type SummaryState, type SummaryVersion } from "@shared/sessionSummary";
import { Button } from "@/components/ui/button";

type Props = {
  campaignId: number;
  sessionId: string;
  sourceRevisionKey: string;
  onUnsavedChange?: (dirty: boolean, busy: boolean) => void;
};

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string };
      if (body.message) message = body.message;
    } catch {
      const text = await response.text().catch(() => "");
      if (text) message = text;
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

const endpoint = (campaignId: number, sessionId: string) =>
  `/api/campaigns/${campaignId}/journal/sessions/${encodeURIComponent(sessionId)}`;
const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const cloneSections = (sections: SummarySection[]) => sections.map(section => ({ ...section, sourceIds: [...section.sourceIds] }));
const currentSections = (state: SummaryState | null) =>
  state?.current ? cloneSections(state.current.sections) : emptySummarySections();

function downloadDraft(sessionId: string, sections: SummarySection[]) {
  const content = SUMMARY_SECTIONS.map(({ id, title }) => {
    const section = sections.find(value => value.id === id);
    return `## ${title}\n\n${section?.text || "(not recorded)"}${section?.annotation ? `\n\nAnnotation: ${section.annotation}` : ""}`;
  }).join("\n\n");
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sessionId.replace(/[^a-z0-9-_]+/gi, "-")}-summary-draft.md`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SessionSummary({ campaignId, sessionId, sourceRevisionKey, onUnsavedChange }: Props) {
  const [state, setState] = useState<SummaryState | null>(null);
  const [sections, setSections] = useState<SummarySection[]>(emptySummarySections);
  const [history, setHistory] = useState<SummaryHistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(true);
  const [needsSourceReview, setNeedsSourceReview] = useState(false);
  const [sourceRefreshComplete, setSourceRefreshComplete] = useState(false);
  const [inspected, setInspected] = useState<SummaryVersion | null>(null);
  const initializedRef = useRef(false);
  const dirtyRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const inspectSequenceRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const mutationRef = useRef(false);
  const refreshAfterMutationRef = useRef(false);
  const needsSourceReviewRef = useRef(needsSourceReview);
  needsSourceReviewRef.current = needsSourceReview;

  const dirty = useMemo(() => {
    if (!initializedRef.current) return false;
    return JSON.stringify(sections) !== JSON.stringify(currentSections(state));
  }, [sections, state]);
  dirtyRef.current = dirty;
  const sources = useMemo(() => {
    const unique = new Map<string, SummarySource>();
    for (const source of [...(state?.current?.sources ?? []), ...(state?.sources ?? [])]) unique.set(source.id, source);
    return Array.from(unique.values());
  }, [state]);

  useLayoutEffect(() => {
    onUnsavedChange?.(dirty, saving);
  }, [dirty, saving, onUnsavedChange]);

  const load = useCallback(async (signal: AbortSignal, sequence: number): Promise<boolean> => {
    setLoading(true);
    if (!needsSourceReviewRef.current) setError("");
    try {
      const [freshState, freshHistory] = await Promise.all([
        request<SummaryState>(`${endpoint(campaignId, sessionId)}/summary`, { signal }),
        request<SummaryHistoryEntry[]>(`${endpoint(campaignId, sessionId)}/summary/history`, { signal }),
      ]);
      if (signal.aborted || sequence !== requestSequenceRef.current) return false;
      if (mutationRef.current) return false;
      setState(freshState);
      setHistory(freshHistory);
      if (!dirtyRef.current) {
        setSections(currentSections(freshState));
        initializedRef.current = true;
        setEditing(!freshState.current);
      }
      return true;
    } catch (cause) {
      if (!signal.aborted && sequence === requestSequenceRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not load the session summary.");
      }
      return false;
    } finally {
      if (!signal.aborted && sequence === requestSequenceRef.current) setLoading(false);
    }
  }, [campaignId, sessionId]);

  useEffect(() => {
    if (mutationRef.current) {
      refreshAfterMutationRef.current = true;
      return;
    }
    if (needsSourceReviewRef.current) setSourceRefreshComplete(false);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequenceRef.current;
    void load(controller.signal, sequence).then(loaded => {
      if (loaded && needsSourceReviewRef.current) setSourceRefreshComplete(true);
    });
    return () => controller.abort();
  }, [load, sourceRevisionKey]);

  useEffect(() => () => {
    requestSequenceRef.current += 1;
    inspectSequenceRef.current += 1;
    abortRef.current?.abort();
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
  }, []);

  const updateSection = (id: SummarySection["id"], patch: Partial<SummarySection>) => {
    if (saving || loading || !state) return;
    const updated = sections.map(section => section.id === id ? { ...section, ...patch } : section);
    const nextDirty = JSON.stringify(updated) !== JSON.stringify(currentSections(state));
    dirtyRef.current = nextDirty;
    setSections(updated);
    onUnsavedChange?.(nextDirty, saving);
  };

  const beginMutation = () => {
    mutationRef.current = true;
    refreshAfterMutationRef.current = false;
    abortRef.current?.abort();
    requestSequenceRef.current += 1;
    setLoading(false);
    setSaving(true);
    onUnsavedChange?.(dirtyRef.current, true);
  };

  const refresh = () => {
    if (mutationRef.current) {
      refreshAfterMutationRef.current = true;
      return;
    }
    abortRef.current?.abort();
    if (needsSourceReviewRef.current) setSourceRefreshComplete(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequenceRef.current;
    void load(controller.signal, sequence).then(loaded => {
      if (loaded && needsSourceReviewRef.current) setSourceRefreshComplete(true);
    });
  };

  const finishMutation = () => {
    mutationRef.current = false;
    setSaving(false);
    onUnsavedChange?.(dirtyRef.current, false);
    if (refreshAfterMutationRef.current) {
      refreshAfterMutationRef.current = false;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        refresh();
      }, 0);
    }
  };

  const write = async (action: "save" | "approve") => {
    if (!state || saving || loading || needsSourceReview) return;
    beginMutation();
    setError("");
    try {
      const result = await request<SummaryState>(`${endpoint(campaignId, sessionId)}/summary`, postJson({
        expectedRevision: state.current?.revision ?? 0,
        sourceFingerprint: state.sourceFingerprint,
        action,
        sections,
      }));
      setState(result);
      setSections(currentSections(result));
      initializedRef.current = true;
      dirtyRef.current = false;
      setEditing(false);
      setHistory(await request<SummaryHistoryEntry[]>(`${endpoint(campaignId, sessionId)}/summary/history`));
    } catch (cause) {
      const message = cause instanceof ApiError && cause.status === 409
        ? `The save conflicted with a newer server revision or source snapshot. Your edits are preserved; refresh and review the latest references before trying again. (${cause.message})`
        : cause instanceof Error ? cause.message : "The summary could not be saved.";
      setError(message);
      if (cause instanceof ApiError && cause.status === 409) {
        setNeedsSourceReview(true);
        needsSourceReviewRef.current = true;
        setSourceRefreshComplete(false);
        refreshAfterMutationRef.current = true;
      }
    } finally {
      finishMutation();
    }
  };

  const inspectRevision = async (revision: number) => {
    const sequence = ++inspectSequenceRef.current;
    setError("");
    try {
      const version = await request<SummaryVersion>(`${endpoint(campaignId, sessionId)}/summary/history/${revision}`);
      if (sequence === inspectSequenceRef.current) setInspected(version);
    } catch (cause) {
      if (sequence === inspectSequenceRef.current) setError(cause instanceof Error ? cause.message : "Could not inspect that version.");
    }
  };

  const restoreRevision = async (revision: number) => {
    if (!state || saving || loading || dirty || needsSourceReview || !window.confirm(`Restore revision ${revision} as a new draft? Existing history will remain unchanged.`)) return;
    beginMutation();
    setError("");
    try {
      const result = await request<SummaryState>(`${endpoint(campaignId, sessionId)}/summary/restore`, postJson({
        expectedRevision: state.current?.revision ?? 0,
        sourceFingerprint: state.sourceFingerprint,
        revision,
      }));
      setState(result);
      setSections(currentSections(result));
      initializedRef.current = true;
      dirtyRef.current = false;
      setEditing(false);
      setInspected(null);
      setHistory(await request<SummaryHistoryEntry[]>(`${endpoint(campaignId, sessionId)}/summary/history`));
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setNeedsSourceReview(true);
        needsSourceReviewRef.current = true;
        setSourceRefreshComplete(false);
        refreshAfterMutationRef.current = true;
        setError(`Restore conflicted with a newer summary revision or source snapshot. Refresh and review the latest references before trying again. (${cause.message})`);
      } else setError(cause instanceof Error ? cause.message : "The version could not be restored.");
    } finally {
      finishMutation();
    }
  };

  const discard = () => {
    if (saving || loading || !state) return;
    if (dirty && !window.confirm("Discard your unsaved summary edits?")) return;
    setSections(currentSections(state));
    initializedRef.current = true;
    setEditing(!state?.current);
    dirtyRef.current = false;
    onUnsavedChange?.(false, saving);
    setError("");
  };

  return <section className="rounded-xl border border-primary/30 bg-card/70 p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-primary"><ShieldCheck className="h-3.5 w-3.5" />Private session record</p>
        <h2 className="font-display text-2xl">Session summary</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">A deliberate, recoverable account of the session. Empty sections mean they have not been recorded.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {state?.stale && <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2.5 py-1 text-xs text-orange-200">Sources changed</span>}
        {state?.current && <span className={`rounded-full px-2.5 py-1 text-xs ${state.current.status === "approved" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"}`}>{state.current.status === "approved" ? "Approved" : "Draft"} · rev {state.current.revision}</span>}
        {state && <Button size="sm" variant="outline" disabled={saving || loading || dirty} onClick={() => setEditing(value => !value)}>{editing ? <><BookOpen className="mr-2 h-4 w-4" />Read summary</> : <><Pencil className="mr-2 h-4 w-4" />Edit summary</>}</Button>}
        <Button size="sm" variant="ghost" aria-label="Refresh summary sources" disabled={loading || saving} onClick={refresh}><RefreshCw className="h-4 w-4" /></Button>
      </div>
    </div>

    <div className="mt-4 flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-3 text-sm">
      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p><strong className="font-medium">Automatic summary generation is unavailable.</strong> {state?.ai.reason || "No AI provider is configured. This summary is written and saved by you."}</p>
    </div>
    {state?.stale && <p className="mt-3 flex items-center gap-2 text-sm text-orange-200"><AlertTriangle className="h-4 w-4" /> The source snapshot changed since this version. Review citations before approving.</p>}
    {needsSourceReview && <div className="mt-3 rounded-lg border border-orange-400/30 bg-orange-400/5 p-3 text-sm">
      <p className="text-orange-100">The server rejected this change because the summary revision or source snapshot changed. Any unsaved edits are preserved. {sourceRefreshComplete ? "The latest saved summary and source metadata are refreshed without replacing your edits." : "Refresh the latest saved summary and source metadata without replacing your edits."} Review the saved copies and current snapshots, then acknowledge to enable another save or restore.</p>
      <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={loading || saving} onClick={refresh}>Refresh latest metadata</Button><Button size="sm" variant="outline" disabled={!sourceRefreshComplete || loading || saving} onClick={() => setNeedsSourceReview(false)}>I reviewed the latest summary and sources</Button></div>
    </div>}
    {error && <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <p className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>
      {dirty && <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => downloadDraft(sessionId, sections)}><Download className="mr-2 h-4 w-4" />Download unsaved draft</Button><Button size="sm" variant="ghost" disabled={loading || saving} onClick={refresh}>Refresh source references</Button></div>}
    </div>}

    {loading && !state ? <div className="mt-5 animate-pulse space-y-3" aria-label="Loading summary"><div className="h-4 w-1/3 rounded bg-muted" /><div className="h-24 rounded-lg bg-muted/70" /><div className="h-24 rounded-lg bg-muted/70" /></div> :
      !state ? <div className="mt-5 rounded-lg border border-dashed border-border p-5 text-sm">
        <p className="text-muted-foreground">The saved summary could not be loaded. Editing is paused until a server copy and source fingerprint are available.</p>
        <Button className="mt-3" size="sm" variant="outline" disabled={loading} onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
      </div> :
      editing ? <div className="mt-5 space-y-3">
        {SUMMARY_SECTIONS.map(({ id, title }, index) => {
          const section = sections.find(item => item.id === id) ?? emptySummarySections()[index];
          const savedSection = state.current?.sections.find(item => item.id === id);
          return <article key={id} className="rounded-lg border border-border/70 bg-background/35 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg">{title}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <input id={`summary-lock-${id}`} type="checkbox" aria-label={`Lock ${title} from future automatic updates`} checked={section.locked} disabled={saving || loading} onChange={event => updateSection(id, { locked: event.target.checked })} className="accent-primary" />
                <label htmlFor={`summary-lock-${id}`} className="flex cursor-pointer items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" />Locked</label>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,.65fr)]">
              <div>
                {savedSection && (savedSection.text.trim() || savedSection.annotation.trim()) && <div className="mb-2 rounded-md border border-primary/15 bg-primary/5 p-3 text-sm leading-6 whitespace-pre-wrap"><span className="mb-1 block text-[10px] uppercase tracking-wider text-primary">Saved copy</span>{savedSection.text || "(not recorded)"}{savedSection.annotation && <p className="mt-2 border-t border-primary/15 pt-2 text-xs text-muted-foreground">Annotation: {savedSection.annotation}</p>}</div>}
                <label htmlFor={`summary-text-${id}`} className="mb-1 block text-xs text-muted-foreground">Editable summary</label>
                <textarea id={`summary-text-${id}`} aria-label={`${title} editable summary`} disabled={saving || loading} maxLength={12000} value={section.text} onChange={event => updateSection(id, { text: event.target.value })} placeholder="Not recorded yet. Write the account you want to keep." className="min-h-24 w-full resize-y rounded-md border border-border bg-background/70 p-3 text-sm leading-6 outline-none focus:border-primary/60 disabled:opacity-60" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`summary-annotation-${id}`}>Annotation</label>
                <textarea id={`summary-annotation-${id}`} aria-label={`${title} annotation`} disabled={saving || loading} maxLength={2000} value={section.annotation} onChange={event => updateSection(id, { annotation: event.target.value })} placeholder="Private context or reminder…" className="min-h-24 w-full resize-y rounded-md border border-border bg-background/60 p-3 text-sm outline-none focus:border-primary/60 disabled:opacity-60" />
                <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{section.text.length.toLocaleString()} / 12,000</p>
              </div>
            </div>
            {!!sources.length && <fieldset disabled={saving || loading} className="mt-3 border-t border-border/60 pt-3 disabled:opacity-60">
              <legend className="text-xs text-muted-foreground">Cite source snapshot</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((source, sourceIndex) => {
                  const citationId = `summary-cite-${id}-${sourceIndex}`;
                  return <label key={source.id} htmlFor={citationId} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                    <input id={citationId} type="checkbox" aria-label={`Cite ${source.title} for ${title}`} checked={section.sourceIds.includes(source.id)} disabled={!section.sourceIds.includes(source.id) && section.sourceIds.length >= 40} onChange={event => {
                      const sourceIds = event.target.checked ? [...section.sourceIds, source.id] : section.sourceIds.filter(value => value !== source.id);
                      updateSection(id, { sourceIds });
                    }} className="accent-primary" />
                    {source.title}
                  </label>;
                })}
              </div>
            </fieldset>}
          </article>;
        })}
      </div> : <div className="mt-5 space-y-3">
        {SUMMARY_SECTIONS.map(({ id, title }, index) => {
          const section = state.current?.sections.find(item => item.id === id) ?? emptySummarySections()[index];
          const citations = sources.filter(source => section.sourceIds.includes(source.id));
          return <article key={id} className="rounded-lg border border-border/70 bg-background/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg">{title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{section.text || <span className="italic text-muted-foreground">Not recorded</span>}</p>
                {section.annotation && <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-6 text-muted-foreground">{section.annotation}</p>}
                {!!citations.length && <div className="mt-3 flex flex-wrap gap-1.5">{citations.map(source => <span key={source.id} className="rounded bg-secondary px-2 py-1 text-[10px] text-secondary-foreground">{source.title}</span>)}</div>}
              </div>
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"><LockKeyhole className="h-3 w-3" />{section.locked ? "Locked" : "Editable"}</span>
            </div>
          </article>;
        })}
      </div>}

    {state?.current && state.current.status === "draft" && state.approved && <details className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4 text-primary" />Last approved version · rev {state.approved.revision}<ChevronDown className="ml-auto h-4 w-4" /></summary>
      <div className="mt-3 space-y-3">{state.approved.sections.map(section => <div key={section.id}><h4 className="text-xs uppercase tracking-wider text-primary">{SUMMARY_SECTIONS.find(value => value.id === section.id)?.title}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{section.text || "(not recorded)"}</p>{section.annotation && <p className="mt-1 text-xs text-muted-foreground">Annotation: {section.annotation}</p>}</div>)}</div>
    </details>}

    <details className="mt-4 rounded-lg border border-border/70 bg-background/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium"><Archive className="h-4 w-4 text-primary" />Sources &amp; review<ChevronDown className="ml-auto h-4 w-4" /></summary>
      <div className="space-y-3 border-t border-border/60 p-3">
        <p className="text-xs leading-5 text-muted-foreground">Each citation is a saved live-notes revision or an immutable imported original. Corrections, aliases, recordings, and reviewed copies remain managed in the existing review tools below.</p>
        {!sources.length ? <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No source snapshots available yet. Live notes and imports can be added below.</p> : sources.map(source => <details key={source.id} className="rounded-md border border-border/60 bg-card/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm"><span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase">{source.kind}</span><strong className="min-w-0 flex-1 truncate">{source.title}</strong><span className="font-mono text-[10px] text-muted-foreground">rev {source.revision}</span><ChevronDown className="h-4 w-4" /></summary>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-border/60 p-3 text-xs leading-5">{source.text || "(empty source snapshot)"}</pre>
        </details>)}
        <div className="border-t border-border/60 pt-3">
          <h3 className="flex items-center gap-2 font-display"><History className="h-4 w-4 text-primary" />Version history</h3>
          {!history.length ? <p className="mt-2 text-sm text-muted-foreground">Saved versions will appear here.</p> : <div className="mt-2 space-y-2">{history.map(version => <div key={version.revision} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-2">
            <span className="text-sm">Revision {version.revision} <span className="text-xs text-muted-foreground">· {version.status} · {version.action} · {new Date(version.createdAt).toLocaleString()}</span></span>
            <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={saving || loading} onClick={() => void inspectRevision(version.revision)}>Inspect</Button><Button size="sm" variant="outline" disabled={saving || loading || dirty || needsSourceReview} onClick={() => void restoreRevision(version.revision)}>Restore as draft</Button></div>
          </div>)}</div>}
        </div>
      </div>
    </details>
    {inspected && <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display">Revision {inspected.revision} · {inspected.status}</h3><div className="flex gap-2"><Button size="sm" variant="outline" disabled={saving || loading || dirty || needsSourceReview} onClick={() => void restoreRevision(inspected.revision)}>Restore as draft</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => { inspectSequenceRef.current += 1; setInspected(null); }}>Close</Button></div></div>
      <div className="mt-3 space-y-3">{inspected.sections.map(section => <div key={section.id}><h4 className="text-xs uppercase tracking-wider text-primary">{SUMMARY_SECTIONS.find(value => value.id === section.id)?.title}</h4><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{section.text || "(not recorded)"}</p>{section.annotation && <p className="mt-1 text-xs text-muted-foreground">Annotation: {section.annotation}</p>}</div>)}</div>
      {!!inspected.sources.length && <details className="mt-4 border-t border-border/60 pt-3"><summary className="cursor-pointer text-sm">Citation snapshot text</summary><div className="mt-2 space-y-2">{inspected.sources.map(source => <div key={source.id} className="rounded border border-border/60 p-2"><strong className="text-xs">{source.title}</strong><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-5">{source.text || "(empty)"}</pre></div>)}</div></details>}
    </div>}
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
      <Button disabled={saving || loading || !dirty || needsSourceReview} onClick={() => void write("save")}><Save className="mr-2 h-4 w-4" />Save draft</Button>
      <Button variant="outline" disabled={saving || loading || needsSourceReview || (!dirty && state?.current?.status !== "draft")} onClick={() => void write("approve")}><Check className="mr-2 h-4 w-4" />Approve version</Button>
      <Button variant="ghost" disabled={saving || loading || !dirty} onClick={discard}>Discard edits</Button>
      {dirty && <span className="text-xs text-muted-foreground">Unsaved changes stay in this editor until saved or explicitly discarded.</span>}
      {saving && <span role="status" className="text-xs text-muted-foreground">Saving version…</span>}
    </div>
  </section>;
}
