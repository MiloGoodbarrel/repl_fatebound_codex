import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, BookOpen, ChevronRight, Clock3, FileAudio, FileText, LockKeyhole, Plus, RefreshCw, Save, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import type { Alias, JournalImport, JournalSession, Reference, Recording, SessionDetail, Suggestion } from "@shared/journal";
import { MAX_AUDIO_BYTES, MAX_TEXT_BYTES, MAX_DOCUMENT_BYTES } from "@shared/journal";
import { useCampaign } from "@/lib/campaignContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SafeMarkdown from "@/components/journal/Markdown";
import SessionSummary from "@/components/journal/SessionSummary";
import { AutosaveCoordinator } from "@/components/journal/autosaveCoordinator";
import { useNavigationBlocker } from "@/lib/navigationGuard";

type Capability = { available: boolean; reason: string; audio: true };
const baseFor = (id: number) => `/api/campaigns/${id}/journal`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message ? `${message} (HTTP ${response.status})` : `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const today = () => new Date().toISOString().slice(0, 10);

function CapabilityLock({ reason }: { reason: string }) {
  return <section className="mx-auto max-w-3xl rounded-xl border border-primary/30 bg-card/70 p-7 shadow-xl">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary"><LockKeyhole /></div>
    <h2 className="mb-2 text-2xl font-display">Private by design</h2>
    <p className="leading-7 text-muted-foreground">{reason || "Journal access is not yet available. Notes, imports, aliases, and recordings remain locked until trusted authorization is available."}</p>
    <p className="mt-4 flex gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4 shrink-0" /> No editable controls or local journal storage are available while this campaign is locked.</p>
  </section>;
}

function OccurrenceCard({ suggestion, item, onDecision, disabled }: { suggestion: Suggestion; item: JournalImport; onDecision: (suggestionId: string, referenceKey: string | null, allMatching?: boolean, undo?: boolean) => void; disabled: boolean }) {
  const current = item.decisions.find(decision => decision.suggestionId === suggestion.id);
  return <article className="rounded-lg border border-border/70 bg-background/50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="font-semibold">“{suggestion.phrase}” <span className="font-mono text-xs text-muted-foreground">· {suggestion.start}–{suggestion.end}</span></p>
        <p className="mt-1 text-sm text-muted-foreground">{suggestion.explanation}</p></div>
      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wider ${suggestion.confidence === "ambiguous" ? "bg-orange-500/15 text-orange-200" : suggestion.confidence === "remembered" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"}`}>{suggestion.confidence}</span>
    </div>
    <div className="mt-3 grid gap-2">
      {suggestion.candidates.map(candidate => <div key={candidate.key} className="rounded-md border border-border/50 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><strong>{candidate.name}</strong><span className="ml-2 text-xs text-muted-foreground">{candidate.source}</span><span className="ml-2 font-mono text-[10px] text-muted-foreground">canonical resource</span></div>
          <div className="flex gap-2"><Button size="sm" variant={current?.referenceKey === candidate.key ? "default" : "outline"} disabled={disabled} onClick={() => onDecision(suggestion.id, current?.referenceKey === candidate.key ? null : candidate.key)}>{current?.referenceKey === candidate.key ? "Accepted" : "Accept occurrence"}</Button><Button size="sm" variant="ghost" disabled={disabled} onClick={() => onDecision(suggestion.id, candidate.key, true)}>Accept all matching</Button></div>
        </div>
        <p className="mt-2 rounded bg-background/50 px-2 py-1 text-xs text-muted-foreground">Context: “{item.original.slice(Math.max(0, suggestion.start - 48), Math.min(item.original.length, suggestion.end + 48))}”</p>
      </div>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant={current?.referenceKey === null ? "destructive" : "ghost"} disabled={disabled} onClick={() => onDecision(suggestion.id, null)}>{current?.referenceKey === null ? "Rejected" : "Reject"}</Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onDecision(suggestion.id, null, true)}>{current?.referenceKey === null ? "Rejected all matching" : "Reject all matching"}</Button>
      {current && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onDecision(suggestion.id, current.referenceKey, false, true)}>Undo this choice</Button>}
      {current && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onDecision(suggestion.id, current.referenceKey, true, true)}>Undo all matching</Button>}
    </div>
  </article>;
}

function JournalWorkspace({ embedded = false, onClose, registerCloseRequest }: { embedded?: boolean; onClose?: () => void; registerCloseRequest?: (request: (() => void) | null) => void }) {
  const { activeCampaign } = useCampaign();
  const campaignId = activeCampaign?.id;
  const base = campaignId ? baseFor(campaignId) : "";
  const [capability, setCapability] = useState<Capability | null>(null);
  const [capError, setCapError] = useState("");
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [notesState, setNotesState] = useState<"saved" | "saving" | "failed">("saved");
  const [notesError, setNotesError] = useState("");
  const [notesConflict, setNotesConflict] = useState(false);
  const [selectionPending, setSelectionPending] = useState(false);
  const [summaryDirty, setSummaryDirty] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [manualDrafts, setManualDrafts] = useState<Record<string, string>>({});
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [importTitle, setImportTitle] = useState("");
  const [importKind, setImportKind] = useState<"transcript" | "summary">("transcript");
  const [importFormat, setImportFormat] = useState<"text" | "markdown">("text");
  const [importText, setImportText] = useState("");
  const [aliasPhrase, setAliasPhrase] = useState("");
  const [aliasKey, setAliasKey] = useState("");
  const [aliasDrafts, setAliasDrafts] = useState<Record<string, { phrase: string; referenceKey: string }>>({});
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const [toastError, setToastError] = useState("");
  const [workspaceCampaignId, setWorkspaceCampaignId] = useState<number | undefined>(campaignId);
  const campaignGenerationRef = useRef(0);
  const observedCampaignRef = useRef<number | undefined>(campaignId);
  const sessionListRequestRef = useRef(0);
  const selectionRequestRef = useRef(0);
  const selectionPendingRef = useRef(false);
  const bypassAnchorRef = useRef(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  if (observedCampaignRef.current !== campaignId) {
    observedCampaignRef.current = campaignId;
    campaignGenerationRef.current += 1;
    selectionRequestRef.current += 1;
  }
  const coordinatorRef = useRef<AutosaveCoordinator | null>(null);
  const audioUploadIdsRef = useRef(new Map<string, string>());
  const detailRef = useRef<SessionDetail | null>(null);
  detailRef.current = detail;
  if (!coordinatorRef.current) {
    coordinatorRef.current = new AutosaveCoordinator(async payload => {
      const [campaign, ...sessionParts] = payload.scope.split(":");
      const sid = sessionParts.join(":");
      const saved = await api<JournalSession>(`${baseFor(Number(campaign))}/sessions/${encodeURIComponent(sid)}/notes`, json("PUT", { revision: payload.revision, notes: payload.notes }));
      return { revision: saved.revision, notes: saved.notes };
    }, (status, error) => {
      if (!mountedRef.current) return;
      setNotesState(status);
      setNotesError(error);
      setNotesConflict(status === "failed" && (/\b409\b/.test(error) || /stale revision/i.test(error)));
    });
  }
  const coordinator = coordinatorRef.current;
  const hasManualDrafts = !!detail?.imports.some(item => {
    const draft = manualDrafts[item.id];
    return draft !== undefined && draft !== (item.editedText ?? item.reviewed);
  });
  const manualDraftsDirtyRef = useRef(hasManualDrafts);
  manualDraftsDirtyRef.current = hasManualDrafts;
  const summaryDirtyRef = useRef(summaryDirty);
  summaryDirtyRef.current = summaryDirty;
  const summaryBusyRef = useRef(summaryBusy);
  summaryBusyRef.current = summaryBusy;
  const manualDraftIsDirty = (item: JournalImport) => manualDrafts[item.id] !== undefined && manualDrafts[item.id] !== (item.editedText ?? item.reviewed);

  const refreshSessions = useCallback(async () => {
    if (!campaignId) return;
    const generation = campaignGenerationRef.current;
    const requestId = ++sessionListRequestRef.current;
    const result = await api<JournalSession[]>(`${base}/sessions`);
    if (!mountedRef.current || generation !== campaignGenerationRef.current || requestId !== sessionListRequestRef.current) return;
    setSessions(result);
  }, [base, campaignId]);

  const loadDetail = useCallback(async (sid: string, generation = campaignGenerationRef.current, selectionToken?: number) => {
    const result = await api<SessionDetail>(`${base}/sessions/${encodeURIComponent(sid)}`);
    if (!mountedRef.current || generation !== campaignGenerationRef.current || (selectionToken !== undefined && selectionToken !== selectionRequestRef.current)) return false;
    if (!coordinator.setScope(`${campaignId}:${sid}`, result.session.revision, result.session.notes)) {
      return false;
    }
    setDetail(result);
    setSessionTitle(result.session.title);
    setSessionDate(result.session.date);
    setNotes(result.session.notes);
    setNotesState("saved");
    setNotesError("");
    setNotesConflict(false);
    setManualDrafts(Object.fromEntries(result.imports.map(item => [item.id, item.editedText ?? item.reviewed])));
    setExpandedImport(current => current && result.imports.some(i => i.id === current) ? current : result.imports[0]?.id ?? null);
    return true;
  }, [base, campaignId, coordinator]);

  useEffect(() => {
    if (workspaceCampaignId === campaignId) return;
    if (coordinator.isDirty || coordinator.isSaving || hasManualDrafts || summaryDirtyRef.current || summaryBusyRef.current || busy) return;
    selectionPendingRef.current = false;
    setSelectionPending(false);
    setWorkspaceCampaignId(campaignId);
    setCapability(null); setCapError(""); setSessions([]); setSelected(null); setDetail(null); setReferences([]); setAliases([]);
  }, [busy, campaignId, coordinator, hasManualDrafts, notesState, summaryBusy, summaryDirty, workspaceCampaignId]);

  useEffect(() => {
    if (workspaceCampaignId !== campaignId) return;
    let live = true;
    setCapability(null); setCapError("");
    if (!campaignId) return () => { live = false; };
    const generation = campaignGenerationRef.current;
    api<Capability>(`${base}/capabilities`).then(value => { if (live && generation === campaignGenerationRef.current) setCapability(value); }).catch(error => { if (live && generation === campaignGenerationRef.current) setCapError(error instanceof Error ? error.message : "Could not check journal access."); });
    return () => { live = false; };
  }, [base, campaignId, workspaceCampaignId]);

  useEffect(() => {
    if (!capability?.available || !campaignId) return;
    let live = true;
    const generation = campaignGenerationRef.current;
    const requestId = ++sessionListRequestRef.current;
    Promise.all([api<JournalSession[]>(`${base}/sessions`), api<Reference[]>(`${base}/references`), api<Alias[]>(`${base}/aliases`)]).then(([s, r, a]) => {
      if (live && generation === campaignGenerationRef.current && requestId === sessionListRequestRef.current) { setSessions(s); setReferences(r); setAliases(a); setLoadError(""); }
    }).catch(error => { if (live && generation === campaignGenerationRef.current && requestId === sessionListRequestRef.current) setLoadError(error instanceof Error ? error.message : "Unable to load journal data."); });
    return () => { live = false; };
  }, [base, campaignId, capability]);

  useEffect(() => {
    mountedRef.current = true;
    coordinator.activate();
    return () => {
      mountedRef.current = false;
      coordinator.dispose();
    };
  }, [coordinator]);

  const flushNotes = useCallback(() => coordinator.flush(), [coordinator]);

  const downloadNotesCopy = () => {
    const text = coordinator.currentValue;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(detail?.session.title || "session-notes").replace(/[^a-z0-9-_]+/gi, "-")}-draft.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const saveManualDrafts = async (_isCurrent: () => boolean = () => true) => {
    const active = detailRef.current;
    if (!active) return;
    const draftImports = active.imports.filter(item => {
      const draft = manualDrafts[item.id];
      return draft !== undefined && draft !== (item.editedText ?? item.reviewed);
    });
    for (const item of draftImports) {
      const text = manualDrafts[item.id] ?? item.reviewed;
      const updated = await api<JournalImport>(`${baseFor(active.session.campaignId)}/sessions/${encodeURIComponent(active.session.id)}/imports/${encodeURIComponent(item.id)}/edit`, json("PUT", { revision: item.revision, text }));
      if (!mountedRef.current || detailRef.current?.session.id !== active.session.id || detailRef.current.session.campaignId !== active.session.campaignId) return;
      setDetail(previous => previous?.session.id === active.session.id ? { ...previous, imports: previous.imports.map(value => value.id === updated.id ? updated : value) } : previous);
      setManualDrafts(previous => ({ ...previous, [item.id]: updated.editedText ?? updated.reviewed }));
    }
  };
  const guardNavigation = async () => {
    if (summaryDirtyRef.current || summaryBusyRef.current) {
      setToastError("Save or discard the session summary before navigating or closing the journal.");
      return false;
    }
    if (busyRef.current) {
      setToastError("Wait for the journal request to finish before navigating or closing the panel.");
      return false;
    }
    if (coordinator.currentStatus === "failed") {
      setToastError("The notes save failed. Download, reload, or reconcile the draft before navigating.");
      return false;
    }
    if (coordinator.isDirty && !coordinator.isSaving) void flushNotes();
    for (let attempt = 0; coordinator.isSaving && attempt < 250; attempt++) await new Promise(resolve => window.setTimeout(resolve, 40));
    if (coordinator.isSaving || coordinator.isDirty) {
      setToastError("Navigation is blocked until the notes are saved. Your draft remains open.");
      return false;
    }
    if (manualDraftsDirtyRef.current) {
      setToastError("Save or explicitly discard the manual reviewed-text draft before navigating.");
      return false;
    }
    return true;
  };
  const requestPanelClose = async () => {
    if (await guardNavigation()) onClose?.();
  };
  useNavigationBlocker(guardNavigation);
  useEffect(() => {
    if (!registerCloseRequest) return;
    registerCloseRequest(() => { void requestPanelClose(); });
    return () => registerCloseRequest(null);
  }, [registerCloseRequest, coordinator, hasManualDrafts, notesState]);
  const discardManualDrafts = () => {
    if (!detail || !window.confirm("Discard unsaved manual reviewed-text changes? Server-saved edits and originals will remain unchanged.")) return;
    setManualDrafts(Object.fromEntries(detail.imports.map(item => [item.id, item.editedText ?? item.reviewed])));
  };
  const discardManualDraft = (item: JournalImport) => {
    setManualDrafts(previous => ({ ...previous, [item.id]: item.editedText ?? item.reviewed }));
  };
  const reloadServerNotes = () => {
    if (!detail || !window.confirm("Replace the editor with the latest saved server copy? Download the unsaved draft first if you may need it.")) return;
    void run(async isCurrent => {
      const fresh = await api<SessionDetail>(`${base}/sessions/${encodeURIComponent(detail.session.id)}`);
      if (!isCurrent() || detailRef.current?.session.id !== detail.session.id) return;
      if (!coordinator.reload(fresh.session.revision, fresh.session.notes)) throw new Error("A save is still in progress. Try again when it finishes.");
      setDetail(fresh); setNotes(fresh.session.notes); setSessionTitle(fresh.session.title); setSessionDate(fresh.session.date);
      setNotesConflict(false); setNotesError("");
    });
  };
  const reconcileDraft = () => {
    if (!detail) return;
    void run(async isCurrent => {
      const fresh = await api<SessionDetail>(`${base}/sessions/${encodeURIComponent(detail.session.id)}`);
      if (!isCurrent() || detailRef.current?.session.id !== detail.session.id) return;
      setDetail(fresh);
      await coordinator.reconcile(fresh.session.revision);
      if (coordinator.isDirty && !coordinator.isSaving) throw new Error("The local draft is preserved; the server changed again. Download it or reconcile again deliberately.");
    });
  };
  const reconcilePreviousCampaignDraft = () => {
    const [previousCampaign, ...sessionParts] = coordinator.currentScope.split(":");
    const sid = sessionParts.join(":");
    if (!previousCampaign || !sid) return;
    void run(async isCurrent => {
      const fresh = await api<SessionDetail>(`${baseFor(Number(previousCampaign))}/sessions/${encodeURIComponent(sid)}`);
      if (!isCurrent()) return;
      await coordinator.reconcile(fresh.session.revision);
    });
  };
  const discardPreviousCampaignDraft = () => {
    if (!window.confirm("Discard unsaved notes and reviewed-text drafts in this tab and switch campaigns? Download any copy you may need first.")) return;
    if (!coordinator.discard()) { setToastError("A save is still in progress. Wait for it to finish before switching."); return; }
    setNotes("");
    if (detail) setManualDrafts(Object.fromEntries(detail.imports.map(item => [item.id, item.editedText ?? item.reviewed])));
  };

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (coordinator.isDirty || coordinator.isSaving || hasManualDrafts || summaryDirtyRef.current || summaryBusyRef.current || busyRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [coordinator, hasManualDrafts]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (bypassAnchorRef.current) { bypassAnchorRef.current = false; return; }
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
       if (!coordinator.isDirty && !coordinator.isSaving && !hasManualDrafts && !summaryDirtyRef.current && !summaryBusyRef.current && !busyRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void guardNavigation().then(allowed => {
        if (allowed && mountedRef.current && anchor.isConnected) {
          bypassAnchorRef.current = true;
          anchor.click();
        } else bypassAnchorRef.current = false;
      });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  });

  const run = async (action: (isCurrent: () => boolean) => Promise<void>, allowSelection = false) => {
    if (busyRef.current || (selectionPendingRef.current && !allowSelection)) return;
    const generation = campaignGenerationRef.current;
    busyRef.current = true;
    setToastError(""); setBusy(true);
    const isCurrent = () => mountedRef.current && generation === campaignGenerationRef.current;
    try { await action(isCurrent); } catch (error) { if (isCurrent()) setToastError(error instanceof Error ? error.message : "The journal request failed."); }
    finally { busyRef.current = false; if (mountedRef.current) setBusy(false); }
  };
  const selectSession = async (sid: string) => {
    if (busyRef.current || selectionPendingRef.current) return;
    if (summaryDirtyRef.current || summaryBusyRef.current) { setToastError("Save or discard the session summary before changing sessions."); return; }
    if (hasManualDrafts) { setToastError("Save or discard the manual reviewed-text draft before changing sessions."); return; }
    const generation = campaignGenerationRef.current;
    const requestToken = ++selectionRequestRef.current;
    selectionPendingRef.current = true;
    setSelectionPending(true);
    if (coordinator.isDirty || coordinator.isSaving) {
      if (coordinator.currentStatus === "failed") {
        setToastError("This session stays open while a failed draft is unresolved. Download, explicitly reload, or reconcile it before navigating.");
        selectionPendingRef.current = false; setSelectionPending(false);
        return;
      }
      if (coordinator.isDirty && !coordinator.isSaving) void flushNotes();
      for (let attempt = 0; coordinator.isSaving && attempt < 250; attempt++) await new Promise(resolve => window.setTimeout(resolve, 40));
      if (generation !== campaignGenerationRef.current || requestToken !== selectionRequestRef.current) { selectionPendingRef.current = false; setSelectionPending(false); return; }
      if (coordinator.isSaving) { selectionPendingRef.current = false; setSelectionPending(false); return; }
      if (coordinator.isDirty) {
        setToastError("This session is staying open because its notes are unsaved. Download the draft, then explicitly reload the server copy or resolve the save before navigating.");
        selectionPendingRef.current = false; setSelectionPending(false);
        return;
      }
    }
    setSelected(sid); setDetail(null);
    await run(async isCurrent => {
      const loaded = await loadDetail(sid, generation, requestToken);
      if (isCurrent() && loaded) setSelected(sid);
    }, true);
    if (requestToken === selectionRequestRef.current) { selectionPendingRef.current = false; setSelectionPending(false); }
  };
  const createSession = () => run(async isCurrent => {
    if (summaryDirtyRef.current || summaryBusyRef.current) throw new Error("Save or discard the session summary before opening another session.");
    const created = await api<JournalSession>(`${base}/sessions`, json("POST", { title: newTitle.trim(), date: newDate }));
    if (!isCurrent()) return;
    const generation = campaignGenerationRef.current;
    const requestToken = ++selectionRequestRef.current;
    setNewTitle(""); await refreshSessions();
    if (isCurrent() && await loadDetail(created.id, generation, requestToken)) setSelected(created.id);
  });
  const updateSession = () => run(async isCurrent => {
    if (!detail) return;
    const sessionId = detail.session.id;
    const saved = await api<JournalSession>(`${base}/sessions/${encodeURIComponent(sessionId)}`, json("PATCH", { title: sessionTitle.trim(), date: sessionDate }));
    if (!isCurrent() || detailRef.current?.session.id !== sessionId) return;
    setDetail(prev => prev?.session.id === sessionId ? { ...prev, session: saved } : prev); await refreshSessions();
  });
  const deleteSession = (sid: string) => {
    if (!window.confirm("Delete this session, its notes, imports, decisions, and recordings? This cannot be undone.")) return;
    void run(async isCurrent => {
      if (selected === sid && (coordinator.isDirty || coordinator.isSaving || hasManualDrafts || summaryDirtyRef.current || summaryBusyRef.current)) {
        if (summaryDirtyRef.current || summaryBusyRef.current) {
          setToastError("Save or discard the session summary before deleting this session.");
          return;
        }
        if (coordinator.currentStatus === "failed" || hasManualDrafts) {
          setToastError("The session cannot be deleted while its failed notes draft is unresolved.");
          return;
        }
        if (coordinator.isDirty && !coordinator.isSaving) void flushNotes();
        for (let attempt = 0; coordinator.isSaving && attempt < 250; attempt++) await new Promise(resolve => window.setTimeout(resolve, 40));
        if (coordinator.isSaving) return;
        if (coordinator.isDirty) {
          setToastError("The session cannot be deleted while its notes are unsaved. Download the draft and explicitly reload the server copy first.");
          return;
        }
      }
      await api<void>(`${base}/sessions/${encodeURIComponent(sid)}`, { method: "DELETE" });
      if (!isCurrent()) return;
      if (selected === sid) { setSelected(null); setDetail(null); setManualDrafts({}); }
      await refreshSessions();
    });
  };
  const saveImport = () => run(async isCurrent => {
    if (!detail) return;
    const sid = detail.session.id;
    if (new TextEncoder().encode(importText).length > MAX_TEXT_BYTES) throw new Error("Text must be at most 256 KiB.");
    const item = await api<JournalImport>(`${base}/sessions/${encodeURIComponent(sid)}/imports`, json("POST", { title: importTitle.trim(), kind: importKind, format: importFormat, text: importText }));
    if (!isCurrent() || detailRef.current?.session.id !== sid) return;
    setDetail(previous => previous?.session.id === sid ? { ...previous, imports: [...previous.imports, item] } : previous);
    setManualDrafts(previous => ({ ...previous, [item.id]: item.editedText ?? item.reviewed }));
    setExpandedImport(item.id); setImportTitle(""); setImportText("");
  });
  const uploadTextFile = (file?: File) => file && run(async isCurrent => {
    if (!detail) return;
    const sid = detail.session.id;
    if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Documents must be at most 10 MiB.");
    if (!/\.(pdf|docx|txt|md|markdown)$/i.test(file.name)) throw new Error("Choose PDF, DOCX, TXT or Markdown. Export legacy DOC, RTF or Pages files to a supported format first.");
    const item = await api<JournalImport>(`${base}/sessions/${encodeURIComponent(sid)}/imports/file`, {
      method: "POST", headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name), "x-import-kind": importKind }, body: await file.arrayBuffer(),
    });
    if (!isCurrent() || detailRef.current?.session.id !== sid) return;
    setDetail(prev => prev?.session.id === sid ? { ...prev, imports: [...prev.imports, item] } : prev);
    setManualDrafts(previous => ({ ...previous, [item.id]: item.editedText ?? item.reviewed }));
    setExpandedImport(item.id);
  });
  const uploadAudio = (file?: File) => file && run(async isCurrent => {
    if (!detail) return;
    const sessionId = detail.session.id;
    if (file.size > MAX_AUDIO_BYTES) throw new Error("Audio files must be 20 MiB or smaller.");
    const extensionType: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm" };
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const contentType = file.type || extensionType[extension];
    if (!contentType) throw new Error("This recording format is unsupported. Choose a recognized MP3, M4A, MP4 audio, WAV, Ogg, or WebM file.");
    const fingerprint = `${campaignId}:${sessionId}:${file.name}:${file.size}:${file.lastModified}`;
    const uploadId = audioUploadIdsRef.current.get(fingerprint) ?? crypto.randomUUID();
    audioUploadIdsRef.current.set(fingerprint, uploadId);
    const record = await api<Recording>(`${base}/sessions/${encodeURIComponent(sessionId)}/recordings`, {
      method: "POST", headers: { "Content-Type": contentType, "x-file-name": encodeURIComponent(file.name), "x-upload-id": uploadId }, body: await file.arrayBuffer(),
    });
    audioUploadIdsRef.current.delete(fingerprint);
    if (!isCurrent() || detailRef.current?.session.id !== sessionId) return;
    setDetail(prev => prev?.session.id === sessionId ? { ...prev, recordings: prev.recordings.some(value => value.id === record.id) ? prev.recordings : [...prev.recordings, record] } : prev);
  });
  const decide = (item: JournalImport, suggestionId: string, referenceKey: string | null, allMatching?: boolean, undo?: boolean) => run(async isCurrent => {
    const updated = await api<JournalImport>(`${base}/sessions/${encodeURIComponent(item.sessionId)}/imports/${encodeURIComponent(item.id)}/decisions`, json("POST", { revision: item.revision, suggestionId, referenceKey, ...(allMatching ? { allMatching: true } : {}), ...(undo ? { undo: true } : {}) }));
    if (!isCurrent() || detailRef.current?.session.id !== item.sessionId) return;
    setDetail(prev => prev?.session.id === item.sessionId ? { ...prev, imports: prev.imports.map(value => value.id === updated.id ? updated : value) } : prev);
    setManualDrafts(prev => ({ ...prev, [updated.id]: updated.editedText ?? updated.reviewed }));
  });
  const editImport = (item: JournalImport, text: string | null) => run(async isCurrent => {
    const updated = await api<JournalImport>(`${base}/sessions/${encodeURIComponent(item.sessionId)}/imports/${encodeURIComponent(item.id)}/edit`, json("PUT", { revision: item.revision, text }));
    if (!isCurrent() || detailRef.current?.session.id !== item.sessionId) return;
    setDetail(prev => prev?.session.id === item.sessionId ? { ...prev, imports: prev.imports.map(value => value.id === updated.id ? updated : value) } : prev);
    setManualDrafts(prev => ({ ...prev, [updated.id]: updated.editedText ?? updated.reviewed }));
  });
  const saveAlias = (phrase: string, referenceKey: string) => run(async isCurrent => {
    const alias = await api<Alias>(`${base}/aliases`, json("POST", { phrase, referenceKey }));
    if (!isCurrent()) return;
    setAliases(prev => [...prev, alias]); setAliasPhrase(""); setAliasKey("");
  });
  const updateAlias = (id: string) => run(async isCurrent => {
    const draft = aliasDrafts[id]; if (!draft) return;
    const updated = await api<Alias>(`${base}/aliases/${encodeURIComponent(id)}`, json("PATCH", { phrase: draft.phrase, referenceKey: draft.referenceKey }));
    if (!isCurrent()) return;
    setAliases(prev => prev.map(value => value.id === id ? updated : value));
  });
  const deleteAlias = (id: string) => {
    if (!window.confirm("Remove this approved campaign alias?")) return;
    void run(async isCurrent => { await api<void>(`${base}/aliases/${encodeURIComponent(id)}`, { method: "DELETE" }); if (isCurrent()) setAliases(prev => prev.filter(value => value.id !== id)); });
  };
  const deleteRecording = (recording: Recording) => {
    if (!window.confirm(`Delete recording “${recording.name}”?`)) return;
    void run(async isCurrent => { await api<void>(`${base}/sessions/${encodeURIComponent(recording.sessionId)}/recordings/${encodeURIComponent(recording.id)}`, { method: "DELETE" }); if (isCurrent() && detailRef.current?.session.id === recording.sessionId) setDetail(prev => prev?.session.id === recording.sessionId ? { ...prev, recordings: prev.recordings.filter(value => value.id !== recording.id) } : prev); });
  };
  const rememberSuggestion = (suggestion: Suggestion, key: string) => { setAliasPhrase(suggestion.phrase); setAliasKey(key); };
  const selectedTitle = useMemo(() => sessions.find(s => s.id === selected)?.title, [sessions, selected]);

  return <div className={`${embedded ? "min-h-full" : "min-h-[100dvh]"} bg-background text-foreground`}>
    {!embedded && <header className="border-b border-border/70 bg-card/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <div><Link href="/" className="mb-2 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> Toolkit</Link>
          <h1 className="flex items-center gap-3 text-3xl font-display"><BookOpen className="h-7 w-7 text-primary" /> Session journal</h1>
           <p className="mt-1 text-sm text-muted-foreground">{workspaceCampaignId !== campaignId && detail ? "Finish the previous campaign’s unsaved journal draft before switching." : activeCampaign ? activeCampaign.name : "Choose a campaign to open its private journal"}</p></div>
        <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary md:flex"><ShieldCheck className="h-4 w-4" /> Campaign-scoped archive</div>
      </div>
    </header>}
    {embedded && <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur"><div><p className="font-display">Campaign journal</p><p className="text-xs text-muted-foreground">{workspaceCampaignId !== campaignId && detail ? "Finish the previous campaign’s unsaved draft" : activeCampaign?.name ?? "No campaign selected"}</p></div><Button size="sm" variant="outline" onClick={() => void requestPanelClose()}><X className="mr-1 h-4 w-4" />Close</Button></div>}
    <main className={`mx-auto grid max-w-7xl gap-6 px-5 py-7 [overflow-wrap:anywhere] ${embedded ? "grid-cols-1" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
      {(capability?.available || (workspaceCampaignId !== campaignId && (summaryDirty || summaryBusy))) && selected && detail && <div className={`min-w-0 ${embedded ? "" : "lg:col-start-2 lg:row-start-1"}`}>
        {workspaceCampaignId !== campaignId && <p role="status" className="mb-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">Finish the previous campaign’s summary below. Its draft remains attached to that session, not the newly selected campaign.</p>}
        <SessionSummary key={`${detail.session.campaignId}:${detail.session.id}`} campaignId={detail.session.campaignId} sessionId={detail.session.id}
          sourceRevisionKey={`${coordinator.currentRevision}:${detail.session.title}:${detail.session.date}:${detail.imports.map(item => `${item.id}-${item.revision}`).join(",")}`}
          onUnsavedChange={(dirty, inFlight) => {
            summaryDirtyRef.current = dirty;
            summaryBusyRef.current = inFlight;
            setSummaryDirty(dirty);
            setSummaryBusy(inFlight);
          }} />
      </div>}
      {workspaceCampaignId !== campaignId ? coordinator.isDirty || coordinator.isSaving || hasManualDrafts || summaryDirty || summaryBusy ? <section role="alert" className="mx-auto max-w-2xl rounded-xl border border-destructive/40 bg-card p-6 lg:col-span-2">
        <LockKeyhole className="mb-3 h-7 w-7 text-primary" /><h2 className="font-display text-xl">Unsaved journal edits are holding this campaign switch</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The previous campaign’s drafts remain in this tab, separate from the newly selected campaign. Save or reconcile them, or explicitly download and discard them before switching.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={downloadNotesCopy}>Download preserved draft</Button>
          {notesConflict ? <Button size="sm" variant="outline" disabled={busy || coordinator.isSaving} onClick={reconcilePreviousCampaignDraft}>Reconcile previous campaign draft</Button> : <Button size="sm" variant="outline" disabled={busy || coordinator.isSaving} onClick={() => void flushNotes()}>Save previous campaign draft</Button>}
          {hasManualDrafts && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(saveManualDrafts)}>Save reviewed-text drafts</Button>}
          {hasManualDrafts && <Button size="sm" variant="ghost" disabled={busy} onClick={discardManualDrafts}>Discard reviewed-text drafts</Button>}
          <Button size="sm" variant="ghost" disabled={busy || coordinator.isSaving || summaryDirty || summaryBusy} onClick={discardPreviousCampaignDraft}>Discard and switch</Button>
        </div>
        {notesConflict && <p className="mt-3 text-xs text-muted-foreground">A stale revision is never retried automatically. Reconcile fetches that campaign’s latest revision, then makes one compare-and-swap attempt.</p>}
      </section> : <div className="animate-pulse rounded-xl border border-border p-8 lg:col-span-2"><div className="h-4 w-1/3 rounded bg-muted" /></div> : !campaignId ? <div className="rounded-xl border border-dashed border-border p-10 text-center lg:col-span-2"><BookOpen className="mx-auto mb-4 h-8 w-8 text-primary" /><h2 className="font-display text-xl">Select a campaign first</h2><p className="mt-2 text-muted-foreground">Session records are always attached to one campaign.</p><Link href="/" className="mt-4 inline-block text-primary underline">Choose campaign</Link></div> : <>
        <aside className={`space-y-4 ${embedded ? "" : `lg:col-start-1 lg:row-start-1 ${selected && detail ? "lg:row-span-2" : ""}`}`}>
          {capError && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm">{capError} <Button size="sm" variant="ghost" onClick={() => { const generation = campaignGenerationRef.current; setCapError(""); setCapability(null); void api<Capability>(`${base}/capabilities`).then(value => { if (generation === campaignGenerationRef.current) setCapability(value); }).catch(e => { if (generation === campaignGenerationRef.current) setCapError(String(e)); }); }}><RefreshCw className="mr-1 h-3 w-3" /> Retry</Button></div>}
          {capability?.available && <div className="rounded-xl border border-border bg-card/50 p-4">
            <h2 className="mb-3 font-display text-lg">New session</h2>
            <Label htmlFor="session-title">Session name</Label><Input id="session-title" className="my-2" value={newTitle} maxLength={150} onChange={e => setNewTitle(e.target.value)} placeholder="The night at Hollowbridge" />
            <Label htmlFor="session-date">Date</Label><Input id="session-date" type="date" className="my-2" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <Button className="mt-2 w-full" disabled={busy || hasManualDrafts || coordinator.isDirty || coordinator.isSaving || summaryDirty || summaryBusy || !newTitle.trim()} onClick={createSession}><Plus className="mr-2 h-4 w-4" /> Create session</Button>
          </div>}
          {capability?.available && <div className="space-y-2">
            <div className="flex items-center justify-between px-1"><h2 className="font-display text-lg">Campaign sessions</h2><span className="font-mono text-xs text-muted-foreground">{sessions.length}</span></div>
            {loadError && <div className="rounded-lg border border-destructive/40 p-3 text-sm">{loadError}<Button size="sm" variant="ghost" onClick={() => void run(refreshSessions)}>Retry</Button></div>}
            {sessions.map(session => <div key={session.id} className={`group flex items-center gap-2 rounded-lg border p-3 ${selected === session.id ? "border-primary/50 bg-primary/10" : "border-border/60 bg-card/30 hover:bg-card/70"}`}>
              <button disabled={busy || selectionPending || summaryDirty || summaryBusy} className="min-w-0 flex-1 text-left disabled:opacity-60" onClick={() => void selectSession(session.id)}><span className="block truncate font-semibold">{session.title}</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{session.date}</span></button>
              <Button size="icon" variant="ghost" disabled={busy || selectionPending || (selected === session.id && (summaryDirty || summaryBusy))} aria-label={`Delete ${session.title}`} onClick={() => deleteSession(session.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
            </div>)}
            {!sessions.length && !loadError && <div className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No sessions yet. Start a campaign chronicle above.</div>}
          </div>}
        </aside>
        <div className={`min-w-0 space-y-5 ${embedded ? "" : `lg:col-start-2 ${selected && detail ? "lg:row-start-2" : "lg:row-start-1"}`}`}>
          {!capability && !capError && <div className="animate-pulse space-y-3 rounded-xl border border-border bg-card/40 p-7"><div className="h-5 w-1/3 rounded bg-muted" /><div className="h-3 w-2/3 rounded bg-muted" /></div>}
          {capability && !capability.available && <CapabilityLock reason={capability.reason} />}
          {capability?.available && toastError && <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{toastError}</span><button onClick={() => setToastError("")} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}
          {capability?.available && !selected && <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/20 p-8 text-center"><BookOpen className="mb-4 h-10 w-10 text-primary/70" /><h2 className="font-display text-2xl">A record of what happened</h2><p className="mt-2 max-w-md text-muted-foreground">Choose a session to open its living notes, reviewed source material, and private recordings.</p></div>}
          {capability?.available && selected && detail && <div key={`${campaignId}:${selected}`} className="space-y-5">
            <section className="rounded-xl border border-border bg-card/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1"><p className="mb-2 text-xs uppercase tracking-[.2em] text-primary">Session record</p><Label htmlFor="edit-session-title">Session name</Label><Input id="edit-session-title" value={sessionTitle} maxLength={150} onChange={e => setSessionTitle(e.target.value)} aria-label="Session title" className="border-0 bg-transparent px-0 font-display text-2xl focus-visible:ring-0" /><div className="mt-2 flex flex-wrap items-end gap-3"><div><Label htmlFor="edit-session-date">Session date</Label><Input id="edit-session-date" type="date" className="w-auto" value={sessionDate} onChange={e => setSessionDate(e.target.value)} /></div><Button size="sm" variant="outline" disabled={busy || !sessionTitle.trim()} onClick={updateSession}>Save details</Button></div></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Save className="h-4 w-4" />{notesState === "saving" ? "Saving…" : notesState === "failed" ? "Save failed" : "All notes saved"}</div>
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card/40 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-xl">Live notes</h2><p className="text-xs text-muted-foreground">Editable campaign notes · autosaved with revision protection</p></div><span className="font-mono text-xs text-muted-foreground">{new TextEncoder().encode(notes).length.toLocaleString()} / {MAX_TEXT_BYTES.toLocaleString()} bytes</span></div>
              <textarea disabled={busy || selectionPending} aria-label="Session notes" className="min-h-64 w-full resize-y rounded-lg border border-border bg-background/60 p-4 leading-7 outline-none focus:border-primary/60 disabled:opacity-70" value={notes} onChange={e => { const value = e.target.value; setNotes(value); coordinator.edit(value); }} placeholder="What did the party discover? Leave a trail for the next session." />
              {notesState === "failed" && <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="text-destructive">{notesConflict ? "Revision conflict: your unsaved text is preserved in this editor and was not overwritten." : notesError}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={downloadNotesCopy}>Download my draft</Button>
                  {notesConflict ? <>
                    <Button size="sm" variant="outline" onClick={reconcileDraft}>Reconcile: keep my draft over latest</Button>
                  </> : <Button size="sm" variant="outline" onClick={() => void flushNotes()}>Retry save</Button>}
                  <Button size="sm" variant="ghost" onClick={reloadServerNotes}>{notesConflict ? "Reload server copy" : "Discard draft and reload saved copy"}</Button>
                </div>
                {notesConflict && <p className="mt-2 text-xs text-muted-foreground">Reconcile fetches the newest server revision once, then submits your draft once. A new conflict stops for another explicit choice.</p>}
              </div>}
            </section>
             <details className="rounded-xl border border-border bg-card/40">
               <summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-display text-xl">Sources &amp; review<ChevronRight className="ml-auto h-4 w-4" /></summary>
               <div className="space-y-5 border-t border-border/60 p-5">
               <section className="rounded-xl border border-border/70 bg-card/30 p-4">
               <div className="mb-4"><h2 className="font-display text-xl">Add source material</h2><p className="mt-1 text-sm text-muted-foreground">Import PDF, Word DOCX, UTF-8 TXT or Markdown, or paste notes below. Documents: up to 10 MiB; PDF: up to 100 pages; extracted text: up to 256 KiB. Scans need OCR first. Extracted text is preserved for correction review; original document files and layout are not retained. Audio is stored privately only—no transcription. Name matching scans up to 500 suggestions.</p></div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-border/70 p-4">
                  <div className="flex gap-2"><Input placeholder="Import title" aria-label="Import title" value={importTitle} onChange={e => setImportTitle(e.target.value)} /><select aria-label="Import kind" className="rounded-md border border-border bg-background px-2" value={importKind} onChange={e => setImportKind(e.target.value as "transcript" | "summary")}><option value="transcript">Transcript</option><option value="summary">Summary</option></select></div>
                  <div className="flex flex-wrap gap-2"><select aria-label="Text format" className="rounded-md border border-border bg-background px-2" value={importFormat} onChange={e => setImportFormat(e.target.value as "text" | "markdown")}><option value="text">Plain text</option><option value="markdown">Markdown</option></select><label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Upload className="h-4 w-4" />Import document<input className="sr-only" type="file" aria-label="Import journal document" accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" disabled={busy} onChange={e => { uploadTextFile(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
                  <textarea className="min-h-28 w-full rounded-md border border-border bg-background/60 p-3 text-sm" placeholder="Paste UTF-8 notes or an exported summary…" value={importText} onChange={e => setImportText(e.target.value)} />
                  <Button disabled={busy || !importTitle.trim() || !importText.trim()} onClick={saveImport}><FileText className="mr-2 h-4 w-4" />Add immutable source</Button>
                </div>
                <div className="space-y-3 rounded-lg border border-border/70 p-4">
                  <h3 className="font-display">Private audio archive</h3><p className="text-xs text-muted-foreground">MP3, M4A/MP4, WAV, Ogg, or WebM · 20 MiB max. Upload retries use a stable request ID.</p>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 p-4 text-sm hover:bg-primary/5"><FileAudio className="h-4 w-4 text-primary" />Choose recording<input className="sr-only" type="file" accept="audio/*" onChange={e => uploadAudio(e.target.files?.[0])} /></label>
                  {detail.recordings.map(recording => <div key={recording.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 p-2 text-sm"><span className="truncate">{recording.name} <small className="text-muted-foreground">· {(recording.size / 1024 / 1024).toFixed(1)} MiB</small></span><div className="flex items-center gap-2"><audio controls preload="none" className="h-8 max-w-40" src={`${base}/sessions/${encodeURIComponent(recording.sessionId)}/recordings/${encodeURIComponent(recording.id)}`} onError={() => setToastError(`Could not play private recording “${recording.name}”.`)} /><Button size="icon" variant="ghost" aria-label={`Delete ${recording.name}`} onClick={() => deleteRecording(recording)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}
                </div>
              </div>
               </section>
            <section className="space-y-3">
              <div><h2 className="font-display text-xl">Originals & reviewed text</h2><p className="text-sm text-muted-foreground">Original source is immutable. Decisions only affect the reviewed copy; nothing is inferred or substituted automatically.</p></div>
              {detail.imports.map(item => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card/40">
                <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setExpandedImport(expandedImport === item.id ? null : item.id)}><span><strong>{item.title}</strong><span className="ml-2 rounded bg-secondary px-2 py-1 text-[10px] uppercase">{item.kind}</span><span className="ml-2 text-xs text-muted-foreground">{item.suggestions.length} review suggestions</span></span><ChevronRight className={`h-4 w-4 transition-transform ${expandedImport === item.id ? "rotate-90" : ""}`} /></button>
                {expandedImport === item.id && <div className="space-y-4 border-t border-border/60 p-4">
                  <div className="grid gap-4 xl:grid-cols-2"><div><h3 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Immutable original</h3>{item.format === "markdown" ? <div className="max-h-80 overflow-auto rounded bg-background/40 p-3"><SafeMarkdown text={item.original} /></div> : <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-background/40 p-3 text-sm">{item.original}</pre>}</div>
                    <div><h3 className="mb-2 text-xs uppercase tracking-wider text-primary">Reviewed copy</h3>{item.format === "markdown" ? <div className="max-h-80 overflow-auto rounded border border-primary/20 bg-background/40 p-3"><SafeMarkdown text={item.reviewed} /></div> : <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-primary/20 bg-background/40 p-3 text-sm">{item.reviewed}</pre>}</div></div>
                  <div className="rounded-lg border border-border/70 p-3"><h3 className="mb-2 font-display">Manual reviewed-text edit</h3><p className="mb-2 text-xs text-muted-foreground">This draft is separate from the immutable original and server-reviewed copy. Unsaved edits block navigation.</p><textarea disabled={busy} aria-label={`Manual reviewed edit for ${item.title}`} className="min-h-24 w-full rounded border border-border bg-background/50 p-3 text-sm disabled:opacity-60" value={manualDrafts[item.id] ?? item.editedText ?? item.reviewed} onChange={e => setManualDrafts(prev => ({ ...prev, [item.id]: e.target.value }))} /><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={busy || !manualDraftIsDirty(item)} onClick={() => editImport(item, manualDrafts[item.id] ?? item.reviewed)}>Save manual edit</Button>{manualDraftIsDirty(item) && <Button size="sm" variant="outline" disabled={busy} onClick={() => discardManualDraft(item)}>Discard unsaved draft</Button>}{item.editedText !== null && <Button size="sm" variant="ghost" disabled={busy || manualDraftIsDirty(item)} onClick={() => editImport(item, null)}>Discard saved edit & enable decisions</Button>}</div></div>
                  <div className="space-y-3"><h3 className="font-display">Review each name · {item.suggestions.length}</h3>{(item.editedText !== null || manualDraftIsDirty(item)) && <p className="text-sm text-orange-200">Decisions are disabled until the manual edit is discarded.</p>}
                    {item.suggestions.map(suggestion => <div key={suggestion.id}><OccurrenceCard suggestion={suggestion} item={item} disabled={busy || item.editedText !== null || manualDraftIsDirty(item)} onDecision={(sid, key, all, undo) => decide(item, sid, key, all, undo)} />{item.decisions.some(decision => decision.suggestionId === suggestion.id && decision.referenceKey) && <Button className="mt-1" size="sm" variant="ghost" disabled={busy} onClick={() => { const refKey = item.decisions.find(d => d.suggestionId === suggestion.id)?.referenceKey; if (refKey) rememberSuggestion(suggestion, refKey); }}>Remember this approved correction as an alias</Button>}</div>)}
                    {!item.suggestions.length && <p className="text-sm text-muted-foreground">No possible resource-name matches were found.</p>}</div>
                </div>}
              </article>)}
              {!detail.imports.length && <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">No imported material yet. Your original sources and live notes stay separate.</div>}
            </section>
            <section className="rounded-xl border border-border bg-card/40 p-5">
              <h2 className="font-display text-xl">Approved campaign aliases</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">Aliases are explicit, campaign-wide approvals. Conflicting phrases are rejected by the server.</p>
              <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input aria-label="Alias phrase" placeholder="Phrase to remember" value={aliasPhrase} onChange={e => setAliasPhrase(e.target.value)} /><select aria-label="Alias target" className="rounded-md border border-border bg-background px-3" value={aliasKey} onChange={e => setAliasKey(e.target.value)}><option value="">Choose resource</option>{references.map(ref => <option value={ref.key} key={ref.key}>{ref.name} · {ref.source}</option>)}</select><Button disabled={busy || !aliasPhrase.trim() || !aliasKey} onClick={() => saveAlias(aliasPhrase.trim(), aliasKey)}>Approve alias</Button></div>
              <div className="space-y-2">{aliases.map(alias => { const draft = aliasDrafts[alias.id] ?? alias; return <div key={alias.id} className="grid gap-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"><Input aria-label={`Alias ${alias.phrase}`} value={draft.phrase} onChange={e => setAliasDrafts(prev => ({ ...prev, [alias.id]: { ...draft, phrase: e.target.value } }))} /><select aria-label={`Reference for ${alias.phrase}`} className="rounded-md border border-border bg-background px-3" value={draft.referenceKey} onChange={e => setAliasDrafts(prev => ({ ...prev, [alias.id]: { ...draft, referenceKey: e.target.value } }))}>{references.map(ref => <option key={ref.key} value={ref.key}>{ref.name} · {ref.source}</option>)}</select><Button size="sm" variant="outline" onClick={() => updateAlias(alias.id)}>Save</Button><Button size="icon" variant="ghost" aria-label={`Delete alias ${alias.phrase}`} onClick={() => deleteAlias(alias.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>; })}</div>
            </section>
               </div>
             </details>
          </div>}
          {capability?.available && selected && !detail && !busy && <div className="rounded-lg border border-border p-5 text-muted-foreground">Could not open {selectedTitle ?? "session"}. <Button variant="outline" size="sm" onClick={() => void run(async () => { await loadDetail(selected); })}>Retry</Button></div>}
        </div>
      </>}
    </main>
  </div>;
}

export default function Sessions() {
  return <JournalWorkspace />;
}

export function EmbeddedJournal({ onClose, onRegisterCloseRequest }: { onClose: () => void; onRegisterCloseRequest: (request: (() => void) | null) => void }) {
  return <JournalWorkspace embedded onClose={onClose} registerCloseRequest={onRegisterCloseRequest} />;
}
