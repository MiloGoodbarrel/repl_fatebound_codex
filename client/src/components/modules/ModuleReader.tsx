import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_MODULE_BYTES, type CampaignModule as ModuleRecord, type ModuleBookmark as Bookmark } from "@shared/modules";
import {
  BookmarkPlus, BookOpen, ChevronLeft, ChevronRight, FileText, Minus, Plus, Search,
  Trash2, Upload, X, Pencil, Check, Ban,
} from "lucide-react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { registerWorkspaceAbort } from "@/lib/workspaceRequests";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RenderTask } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = workerUrl;

type LibraryResponse = { modules: ModuleRecord[]; selectedId: string | null };

const api = (campaignId: string, suffix = "") => `/api/campaigns/${encodeURIComponent(campaignId)}/modules${suffix}`;
const PDF_ASSETS = "/pdf-assets/";
const MAX_CANVAS_PIXELS = 12_000_000;
const MAX_CANVAS_EDGE = 8192;
const MAX_DISPLAY_PIXELS = 40_000_000;
const MAX_DISPLAY_EDGE = 12_000;
const MAX_THUMB_PIXELS = 240_000;
const MAX_THUMB_EDGE = 512;
const MAX_SEARCH_PAGE_CHARS = 100_000;
const MAX_SEARCH_TEXT_ITEMS = 20_000;
const areaScaleLimit = (pixels: number, width: number, height: number) =>
  Math.sqrt(pixels / Math.max(1, width)) / Math.sqrt(Math.max(1, height));

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong while opening the module.";
}
function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}
function buttonClass(extra = "") {
  return `module-icon-button ${extra}`;
}

export function ModuleReader({
  campaignId, storageScope, onClose, mobile,
}: {
  campaignId: string | null; storageScope: string; onClose: () => void; mobile: boolean;
}) {
  const [library, setLibrary] = useState<LibraryResponse>({ modules: [], selectedId: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfAttempt, setPdfAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [pageEntry, setPageEntry] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [outline, setOutline] = useState<{ title: string; page: number }[]>([]);
  const [textAvailable, setTextAvailable] = useState<boolean | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchCursor, setSearchCursor] = useState(1);
  const [searching, setSearching] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [bookmarkValue, setBookmarkValue] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [deleteCandidate, setDeleteCandidate] = useState<ModuleRecord | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const previousFocus = useRef<HTMLElement | null>(null);
  const scopeAbortRef = useRef(new AbortController());
  const uploadAbortRef = useRef<AbortController | null>(null);
  const userCancelledUpload = useRef(false);
  const pdfTaskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const searchToken = useRef(0);
  const deleteCandidateRef = useRef<ModuleRecord | null>(null);
  deleteCandidateRef.current = deleteCandidate;
  const uploadGeneration = useRef(0);
  const selected = library.modules.find(module => module.id === library.selectedId) ?? null;
  const userId = storageScope.startsWith("account:") ? storageScope.slice("account:".length) : "";
  const thumbStart = pdf ? Math.max(1, Math.min(page - 2, pdf.numPages - 4)) : 1;
  const visibleThumbPages = pdf ? Array.from({ length: Math.min(5, pdf.numPages) }, (_, index) => thumbStart + index) : [];

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(path, { credentials: "include", ...init, signal: scopeAbortRef.current.signal });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = await response.json() as { error?: string; message?: string };
        detail = payload.error ?? payload.message ?? "";
      } catch { /* response may not be JSON */ }
      throw new Error(detail || `Request failed (${response.status}).`);
    }
    return response;
  }, []);

  const refresh = useCallback(async () => {
    if (!campaignId) { setLibrary({ modules: [], selectedId: null }); return; }
    setBusy(true);
    setError("");
    try {
      const response = await request(api(campaignId));
      const data = await response.json() as LibraryResponse;
      setLibrary({ modules: Array.isArray(data.modules) ? data.modules : [], selectedId: data.selectedId ?? null });
    } catch (caught) {
      if ((caught as Error).name !== "AbortError") setError(errorMessage(caught));
    } finally {
      if (!scopeAbortRef.current.signal.aborted) setBusy(false);
    }
  }, [campaignId, request]);

  useEffect(() => {
    scopeAbortRef.current = new AbortController();
    void refresh();
    return () => {
      scopeAbortRef.current.abort();
      uploadGeneration.current++;
      searchToken.current++;
      void pdfTaskRef.current?.destroy();
      pdfTaskRef.current = null;
      setPdf(null);
      setThumbs({});
      uploadAbortRef.current?.abort();
    };
  }, [campaignId, storageScope, refresh]);

  useEffect(() => {
    if (!mobile) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex='-1'])") ?? []);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusables()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      // Radix owns the nested confirmation's focus trap while it is mounted.
      if (deleteCandidateRef.current) return;
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [mobile]);

  useEffect(() => {
    searchToken.current++;
    setSearching(false);
    setSearchCursor(1);
    setSearchStatus("");
    if (!selected || !campaignId) {
      setPdf(null); setPage(1); setPageEntry("1"); setBookmarks([]);
      return;
    }
    let live = true;
    let destroyed = false;
    const workspaceController = new AbortController();
    const releaseWorkspaceAbort = registerWorkspaceAbort(workspaceController);
    if (workspaceController.signal.aborted) {
      releaseWorkspaceAbort();
      return () => { live = false; };
    }
    const task = getDocument({
      url: api(campaignId, `/${encodeURIComponent(selected.id)}/content`),
      withCredentials: true,
      httpHeaders: userId ? { "X-Workspace-User": userId } : {},
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: true,
      rangeChunkSize: 64 * 1024,
      cMapUrl: `${PDF_ASSETS}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDF_ASSETS}standard_fonts/`,
      wasmUrl: `${PDF_ASSETS}wasm/`,
    });
    const destroyTask = () => {
      if (destroyed) return;
      destroyed = true;
      void task.destroy();
    };
    workspaceController.signal.addEventListener("abort", destroyTask, { once: true });
    pdfTaskRef.current = task;
    setPdf(null); setPdfError(""); setOutline([]); setThumbs({}); setTextAvailable(null);
    setBookmarks(selected.bookmarks ?? []);
    setPage(1);
    setPageEntry("1");
    task.promise.then(async doc => {
      if (!live) { await doc.destroy(); return; }
      const initialPage = Math.min(doc.numPages, Math.max(1, selected.page || 1));
      setPage(initialPage);
      setPageEntry(String(initialPage));
      setPdf(doc);
      try {
        const entries = await doc.getOutline();
        const flat: { title: string; page: number }[] = [];
        let visited = 0;
        const collect = async (nodes: NonNullable<typeof entries>) => {
          for (const node of nodes) {
            if (++visited > 400 || flat.length >= 300) return;
            if (node.dest) {
              try {
                const dest = typeof node.dest === "string" ? await doc.getDestination(node.dest) : node.dest;
                const ref = dest?.[0];
                if (ref && typeof ref === "object") {
                  const pageIndex = await doc.getPageIndex(ref);
                  if (pageIndex >= 0 && pageIndex < doc.numPages) flat.push({ title: node.title, page: pageIndex + 1 });
                } else if (typeof ref === "number" && ref >= 0 && ref < doc.numPages) flat.push({ title: node.title, page: ref + 1 });
              } catch { /* Ignore malformed or non-internal destinations. */ }
            }
            if (node.items?.length) await collect(node.items);
          }
        };
        if (entries) await collect(entries);
        if (live) setOutline(flat.slice(0, 300));
      } catch { /* An absent/broken outline is not a document failure. */ }
    }).catch(caught => {
      if (live && !workspaceController.signal.aborted && caught?.name !== "AbortException") setPdfError(errorMessage(caught));
    });
    return () => {
      live = false;
      searchToken.current++;
      workspaceController.signal.removeEventListener("abort", destroyTask);
      workspaceController.abort();
      releaseWorkspaceAbort();
      destroyTask();
      if (pdfTaskRef.current === task) pdfTaskRef.current = null;
    };
  }, [campaignId, selected?.id, userId, pdfAttempt]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    const paint = async () => {
      let pdfPage: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | undefined;
      let completed = false;
      try {
        pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const naturalViewport = pdfPage.getViewport({ scale: 1 });
        if (!Number.isFinite(naturalViewport.width) || !Number.isFinite(naturalViewport.height) || naturalViewport.width <= 0 || naturalViewport.height <= 0) {
          throw new Error("This page has dimensions that cannot be safely rendered.");
        }
        const availableWidth = canvas.parentElement?.clientWidth ?? naturalViewport.width;
        const naturalWidth = Math.max(1, naturalViewport.width);
        const naturalHeight = Math.max(1, naturalViewport.height);
        const displayScaleLimit = Math.min(
          MAX_DISPLAY_EDGE / naturalWidth,
          MAX_DISPLAY_EDGE / naturalHeight,
          areaScaleLimit(MAX_DISPLAY_PIXELS, naturalWidth, naturalHeight),
        );
        const fitScale = Math.min(1, Math.max(0.001, (availableWidth - 8) / naturalWidth), displayScaleLimit);
        const viewport = pdfPage.getViewport({ scale: Math.min(fitScale * zoom, displayScaleLimit) });
        const pixelScale = Math.min(
          Math.min(window.devicePixelRatio || 1, 2),
          MAX_CANVAS_EDGE / viewport.width,
          MAX_CANVAS_EDGE / viewport.height,
          Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, viewport.width * viewport.height)),
        );
        canvas.width = Math.max(1, Math.floor(viewport.width * pixelScale));
        canvas.height = Math.max(1, Math.floor(viewport.height * pixelScale));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) return;
        renderTask?.cancel();
        const currentTask = pdfPage.render({ canvasContext: context, viewport, canvas, transform: pixelScale === 1 ? undefined : [pixelScale, 0, 0, pixelScale, 0, 0] });
        renderTask = currentTask;
        await currentTask.promise;
        if (cancelled) return;
        const text = await pdfPage.getTextContent();
        const hasText = text.items.slice(0, MAX_SEARCH_TEXT_ITEMS).some(item => "str" in item && item.str.trim().length > 0);
        setTextAvailable(current => current === null ? hasText : current || hasText);
        completed = true;
      } catch (caught) {
        if (!cancelled && (caught as Error).name !== "RenderingCancelledException") setPdfError(errorMessage(caught));
      } finally {
        if (cancelled || completed) pdfPage?.cleanup();
      }
    };
    void paint();
    const stage = canvasRef.current?.parentElement;
    const observer = stage && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { void paint(); }) : null;
    if (stage && observer) observer.observe(stage);
    return () => { cancelled = true; observer?.disconnect(); renderTask?.cancel(); };
  }, [pdf, page, zoom]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    const first = Math.max(1, Math.min(page - 2, pdf.numPages - 4));
    const pages = Array.from({ length: Math.min(5, pdf.numPages) }, (_, index) => first + index);
    const renderTasks: RenderTask[] = [];
    const canvases = new Set<HTMLCanvasElement>();
    setThumbs(current => Object.fromEntries(Object.entries(current).filter(([key]) => pages.includes(Number(key)))));
    void (async () => {
      for (const number of pages) {
        if (cancelled) return;
        let pdfPage: Awaited<ReturnType<PDFDocumentProxy["getPage"]>> | undefined;
        let canvas: HTMLCanvasElement | undefined;
        try {
          pdfPage = await pdf.getPage(number);
          const naturalViewport = pdfPage.getViewport({ scale: 1 });
          const naturalWidth = Math.max(1, naturalViewport.width);
          const naturalHeight = Math.max(1, naturalViewport.height);
          const scale = Math.min(
            0.22,
            MAX_THUMB_EDGE / naturalWidth,
            MAX_THUMB_EDGE / naturalHeight,
            areaScaleLimit(MAX_THUMB_PIXELS, naturalWidth, naturalHeight),
          );
          const viewport = pdfPage.getViewport({ scale });
          canvas = document.createElement("canvas");
          canvases.add(canvas);
          canvas.width = Math.max(1, Math.ceil(viewport.width));
          canvas.height = Math.max(1, Math.ceil(viewport.height));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) continue;
          const task = pdfPage.render({ canvasContext: context, viewport, canvas });
          renderTasks.push(task);
          await task.promise;
          if (!cancelled) setThumbs(current => ({ ...current, [number]: canvas!.toDataURL("image/jpeg", 0.72) }));
        } catch { /* Thumbnails are an enhancement; keep page navigation available. */ }
        finally {
          if (canvas) { canvas.width = 0; canvas.height = 0; canvases.delete(canvas); }
          pdfPage?.cleanup();
        }
      }
    })();
    return () => {
      cancelled = true;
      renderTasks.forEach(task => task.cancel());
      canvases.forEach(canvas => { canvas.width = 0; canvas.height = 0; });
      canvases.clear();
    };
  }, [pdf, page]);

  const patchModule = useCallback(async (moduleId: string, patch: Partial<Pick<ModuleRecord, "name" | "page" | "bookmarks">>) => {
    if (!campaignId) return;
    const response = await request(api(campaignId, `/${encodeURIComponent(moduleId)}`), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const updated = await response.json() as ModuleRecord;
    setLibrary(current => ({ ...current, modules: current.modules.map(item => item.id === moduleId ? updated : item) }));
    return updated;
  }, [campaignId, request]);

  const chooseModule = async (moduleId: string | null) => {
    if (!campaignId) return;
    setError("");
    try {
      await request(api(campaignId, "/selection"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedId: moduleId }) });
      setLibrary(current => ({ ...current, selectedId: moduleId }));
    } catch (caught) { setError(errorMessage(caught)); }
  };

  const upload = async (candidate = uploadFile) => {
    if (!campaignId || !candidate) return;
    if (candidate.size > MAX_MODULE_BYTES) { setUploadError("That PDF is larger than the 100 MiB library limit."); return; }
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) { setUploadError("Choose a PDF file."); return; }
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const release = registerWorkspaceAbort(controller);
    const generation = ++uploadGeneration.current;
    const isCurrent = () => uploadGeneration.current === generation;
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    if (controller.signal.aborted) {
      controller.signal.removeEventListener("abort", abort);
      release();
      uploadAbortRef.current = null;
      return;
    }
    userCancelledUpload.current = false;
    setUploading(true); setUploadProgress(0); setUploadError("");
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      controller.signal.removeEventListener("abort", abort);
      xhr.upload.onprogress = null;
      release();
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
    };
    xhr.open("POST", `${api(campaignId)}?filename=${encodeURIComponent(candidate.name)}`);
    xhr.withCredentials = true;
    if (userId) xhr.setRequestHeader("X-Workspace-User", userId);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    if (controller.signal.aborted) {
      finish();
      return;
    }
    xhr.upload.onprogress = event => {
      if (isCurrent() && !controller.signal.aborted && event.lengthComputable) {
        setUploadProgress(Math.round(event.loaded / event.total * 100));
      }
    };
    xhr.onload = () => {
      if (!isCurrent() || scopeAbortRef.current.signal.aborted) { finish(); return; }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const created = JSON.parse(xhr.responseText) as ModuleRecord;
          setLibrary(current => ({ ...current, modules: [created, ...current.modules] }));
          setUploadFile(null); setUploadProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          void chooseModule(created.id);
        } catch { setUploadError("The upload finished, but the library returned an unreadable response. Refresh to check whether it was saved."); }
      } else {
        let message = `Upload failed (${xhr.status}).`;
        if (xhr.status === 503) message = "Private file storage is temporarily unavailable. Your PDF was not added; retry shortly.";
        try {
          const payload = JSON.parse(xhr.responseText) as { error?: string; message?: string };
          message = payload.error ?? payload.message ?? message;
        } catch { /* Keep status-based message. */ }
        setUploadError(message);
      }
      setUploading(false); finish();
    };
    xhr.onerror = () => {
      if (isCurrent() && !scopeAbortRef.current.signal.aborted) {
        setUploadError("Network trouble interrupted the upload. Retry when your connection is ready.");
        setUploading(false);
      }
      finish();
    };
    xhr.onabort = () => {
      if (isCurrent() && userCancelledUpload.current && !scopeAbortRef.current.signal.aborted) {
        setUploadError("Upload cancelled.");
        setUploading(false);
        setUploadProgress(null);
      }
      finish();
    };
    try {
      if (controller.signal.aborted) { finish(); return; }
      xhr.send(candidate);
    } catch (caught) {
      if (isCurrent()) {
        setUploadError(errorMessage(caught));
        setUploading(false);
      }
      finish();
    }
  };

  const cancelUpload = () => { userCancelledUpload.current = true; uploadAbortRef.current?.abort(); };
  const goToPage = async (target: number) => {
    if (!pdf || target < 1 || target > pdf.numPages) return;
    setPage(target); setPageEntry(String(target));
    if (selected) {
      try { await patchModule(selected.id, { page: target }); } catch (caught) { setError(errorMessage(caught)); }
    }
  };
  const removeModule = async (module: ModuleRecord) => {
    if (!campaignId) return;
    try {
      await request(api(campaignId, `/${encodeURIComponent(module.id)}`), { method: "DELETE" });
      setLibrary(current => ({ ...current, modules: current.modules.filter(item => item.id !== module.id), selectedId: current.selectedId === module.id ? null : current.selectedId }));
    } catch (caught) { setError(errorMessage(caught)); }
  };
  const rename = async () => {
    if (!renameId || !renameValue.trim()) return;
    try { await patchModule(renameId, { name: renameValue.trim() }); setRenameId(null); }
    catch (caught) { setError(errorMessage(caught)); }
  };
  const addBookmark = async () => {
    if (!selected || !bookmarkValue.trim()) return;
    const next = [...bookmarks, { id: crypto.randomUUID(), name: bookmarkValue.trim(), page }];
    try { const updated = await patchModule(selected.id, { bookmarks: next }); setBookmarks(updated?.bookmarks ?? next); setBookmarkValue(""); }
    catch (caught) { setError(errorMessage(caught)); }
  };
  const deleteBookmark = async (id: string) => {
    if (!selected) return;
    const next = bookmarks.filter(bookmark => bookmark.id !== id);
    try { const updated = await patchModule(selected.id, { bookmarks: next }); setBookmarks(updated?.bookmarks ?? next); }
    catch (caught) { setError(errorMessage(caught)); }
  };
  const search = async () => {
    if (!pdf || !searchValue.trim()) return;
    const token = ++searchToken.current;
    const start = searchCursor > pdf.numPages ? 1 : Math.max(1, searchCursor);
    const end = Math.min(pdf.numPages, start + 79);
    setSearching(true); setSearchStatus(`Searching pages ${start}–${end}…`);
    try {
      let found = 0;
      let hasSelectableText = false;
      let pageTextTruncated = false;
      const needle = searchValue.trim().replace(/\s+/g, "").toLocaleLowerCase();
      for (let index = start; index <= end; index++) {
        if (token !== searchToken.current) return;
        const pdfPage = await pdf.getPage(index);
        let pageText = "";
        try {
          const content = await pdfPage.getTextContent();
          if (content.items.length > MAX_SEARCH_TEXT_ITEMS) pageTextTruncated = true;
          const strings: string[] = [];
          let charCount = 0;
          for (const item of content.items.slice(0, MAX_SEARCH_TEXT_ITEMS)) {
            if (!("str" in item) || !item.str) continue;
            hasSelectableText ||= item.str.trim().length > 0;
            const remaining = MAX_SEARCH_PAGE_CHARS - charCount;
            if (remaining <= 0) { pageTextTruncated = true; break; }
            const part = item.str.slice(0, remaining);
            strings.push(part);
            charCount += part.length;
            if (part.length < item.str.length) { pageTextTruncated = true; break; }
          }
          pageText = strings.join("").replace(/\s+/g, "").toLocaleLowerCase();
        } finally {
          pdfPage.cleanup();
        }
        if (pageText.includes(needle)) {
          found = index; break;
        }
        if ((index - start + 1) % 8 === 0) setSearchStatus(`Searched ${index - start + 1} of ${end - start + 1} pages…`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (token !== searchToken.current) return;
      if (found) {
        setSearchCursor(found + 1);
        setSearchStatus(`Match on page ${found}. Continue to find the next match.`);
        await goToPage(found);
      } else {
        const hasMore = end < pdf.numPages;
        setSearchCursor(hasMore ? end + 1 : 1);
        const range = `pages ${start}–${end}`;
        const densityNote = pageTextTruncated ? " Search text was capped on a dense page." : "";
        if (!hasSelectableText) {
          setSearchStatus(`No selectable text in ${range}; image-only scans remain viewable but cannot be text-searched.${hasMore ? ` Continue at page ${end + 1}.` : " Document end reached; next search starts over."}${densityNote}`);
        } else {
          setSearchStatus(`No match in ${range}.${hasMore ? ` Continue at page ${end + 1}.` : " Document end reached; next search starts over."}${densityNote}`);
        }
      }
    } catch (caught) { if (token === searchToken.current) setSearchStatus(errorMessage(caught)); }
    finally { if (token === searchToken.current) setSearching(false); }
  };

  return (
    <div ref={panelRef} className={`module-reader ${mobile ? "module-reader-mobile" : ""}`}>
      <header className="module-reader-header">
        <div className="module-reader-brand"><span className="module-brand-mark"><BookOpen size={17} /></span><div><p className="module-eyebrow">Campaign reference</p><h2>Adventure folio</h2></div></div>
        <button type="button" className={buttonClass()} aria-label="Close adventure reference" onClick={onClose}><X size={18} /></button>
      </header>
      {!campaignId ? (
        <div className="module-empty-state"><FileText size={28} /><h3>Choose a campaign</h3><p>Your private module library appears when a campaign is active.</p></div>
      ) : (
        <>
          <section className="module-library">
            <div className="module-section-title"><div><span className="module-eyebrow">PRIVATE LIBRARY</span><h3>Campaign modules</h3></div>
              <button type="button" className="module-primary-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}><Upload size={15} /> Add PDF</button>
              <input ref={fileInputRef} className="sr-only" type="file" accept="application/pdf,.pdf" aria-label="Choose PDF to add" onChange={event => { const file = event.target.files?.[0] ?? null; setUploadFile(file); setUploadError(""); if (file) void upload(file); }} />
            </div>
            <p className="module-subtle">Private to this campaign · up to 100 MiB per PDF</p>
            {uploading && <div className="module-upload-line"><div className="module-progress-track" role="progressbar" aria-label="PDF upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress ?? 0}><span style={{ width: `${uploadProgress ?? 0}%` }} /></div><span>{uploadProgress ?? 0}%</span><button type="button" className="module-text-button" onClick={cancelUpload}>Cancel</button></div>}
            {uploadError && <div className="module-alert" role="alert"><span>{uploadError}</span>{uploadFile && !uploading && <button type="button" className="module-text-button" onClick={() => void upload()}>Retry</button>}</div>}
            {error && <div className="module-alert" role="alert"><span>{error}</span><button type="button" className="module-text-button" onClick={() => void refresh()}>Retry</button></div>}
            {busy ? <div className="module-list-skeleton" role="status"><i /><i /><i /></div> : library.modules.length ? (
              <ul className="module-library-list">
                {library.modules.map(item => (
                  <li className={`module-library-item ${selected?.id === item.id ? "is-selected" : ""}`} key={item.id}>
                    <button type="button" className="module-select" onClick={() => void chooseModule(item.id)} aria-pressed={selected?.id === item.id}>
                      <span className="module-file-icon"><FileText size={18} /></span>
                      <span className="module-file-copy"><strong>{item.name}</strong><small>{item.filename} · {formatSize(item.size)}</small></span>
                    </button>
                    <span className="module-item-actions">
                      {renameId === item.id ? <>
                        <input className="module-rename-input" aria-label="Module name" value={renameValue} onChange={event => setRenameValue(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void rename(); if (event.key === "Escape") setRenameId(null); }} autoFocus />
                        <button type="button" className={buttonClass()} aria-label="Save module name" onClick={() => void rename()}><Check size={15} /></button>
                      </> : <button type="button" className={buttonClass()} aria-label={`Rename ${item.name}`} onClick={() => { setRenameId(item.id); setRenameValue(item.name); }}><Pencil size={15} /></button>}
                      <button type="button" className={buttonClass("module-danger-button")} aria-label={`Delete ${item.name}`} onClick={() => setDeleteCandidate(item)}><Trash2 size={15} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <div className="module-library-empty"><FileText size={18} /><span>No adventures in this campaign yet.</span></div>}
          </section>

          {selected && <section className="module-viewer" aria-label="PDF reader">
            <div className="module-document-heading"><span className="module-eyebrow">NOW PLAYING</span><strong title={selected.name}>{selected.name}</strong><span>{pdf ? `${pdf.numPages} pages` : "Opening PDF…"}</span><button type="button" className="module-text-button" onClick={() => void chooseModule(null)}>Stop reading</button></div>
            {pdfError && <div className="module-alert" role="alert"><span>{pdfError}</span><button type="button" className="module-text-button" onClick={() => setPdfAttempt(value => value + 1)}>Retry</button></div>}
            {!pdf && !pdfError && <div className="module-document-loading" role="status"><div className="module-page-skeleton"><i /><i /><i /><i /></div><span>Fetching secure document…</span></div>}
            {pdf && <>
              <div className="module-toolbar" aria-label="PDF controls">
                <button type="button" className={buttonClass()} aria-label="Previous page" disabled={page <= 1} onClick={() => void goToPage(page - 1)}><ChevronLeft size={17} /></button>
                <form className="module-page-form" onSubmit={event => { event.preventDefault(); void goToPage(Number(pageEntry)); }}><input aria-label="Page number" inputMode="numeric" value={pageEntry} onChange={event => setPageEntry(event.target.value.replace(/[^\d]/g, ""))} /><span>of {pdf.numPages}</span></form>
                <button type="button" className={buttonClass()} aria-label="Next page" disabled={page >= pdf.numPages} onClick={() => void goToPage(page + 1)}><ChevronRight size={17} /></button>
                <span className="module-toolbar-divider" />
                <button type="button" className={buttonClass()} aria-label="Zoom out" disabled={zoom <= 0.55} onClick={() => setZoom(value => Math.max(0.55, Number((value - 0.1).toFixed(2))))}><Minus size={16} /></button>
                <span className="module-zoom-value">{Math.round(zoom * 100)}%</span>
                <button type="button" className={buttonClass()} aria-label="Zoom in" disabled={zoom >= 1.8} onClick={() => setZoom(value => Math.min(1.8, Number((value + 0.1).toFixed(2))))}><Plus size={16} /></button>
              </div>
              <div className="module-search-row">
                <Search size={15} aria-hidden="true" /><input aria-label="Search document text" placeholder="Search all pages…" value={searchValue} onChange={event => { searchToken.current++; setSearching(false); setSearchCursor(1); setSearchStatus(""); setSearchValue(event.target.value); }} onKeyDown={event => { if (event.key === "Enter") void search(); }} />
                {searching ? <button type="button" className="module-text-button" onClick={() => { searchToken.current++; setSearching(false); setSearchStatus(`Search cancelled. Resume from page ${searchCursor}.`); }}>Cancel</button> : <button type="button" className="module-text-button" onClick={() => void search()} disabled={!searchValue.trim()}>{searchCursor > 1 ? "Continue" : "Find"}</button>}
              </div>
              {searchStatus && <p className="module-search-status" role="status">{searchStatus}</p>}
              {textAvailable === false && <p className="module-scan-note">No selectable text detected on this page. Scanned artwork remains readable; text search may not find image-only pages.</p>}
              <div className="module-content-grid">
                <nav className="module-thumb-rail" aria-label="Nearby pages">
                  {visibleThumbPages.map(number => <button type="button" key={number} className={`module-thumb ${number === page ? "is-current" : ""}`} onClick={() => void goToPage(number)} aria-label={`Go to page ${number}`} aria-current={number === page ? "page" : undefined}>{thumbs[number] ? <img src={thumbs[number]} alt="" /> : <span>{number}</span>}<small>{number}</small></button>)}
                </nav>
                <div className="module-page-stage"><canvas ref={canvasRef} aria-label={`PDF page ${page}`} /></div>
              </div>
              {(outline.length > 0 || bookmarks.length > 0) && <div className="module-reference-lists">
                {outline.length > 0 && <details><summary>Contents <span>{outline.length}</span></summary><ul>{outline.map((item, index) => <li key={`${item.page}-${index}`}><button type="button" onClick={() => void goToPage(item.page)}>{item.title}<small>p. {item.page}</small></button></li>)}</ul></details>}
                <details open><summary>Bookmarks <span>{bookmarks.length}</span></summary><ul>{bookmarks.map(bookmark => <li key={bookmark.id}><button type="button" onClick={() => void goToPage(bookmark.page)}>{bookmark.name}<small>p. {bookmark.page}</small></button><button type="button" className={buttonClass("module-danger-button")} aria-label={`Delete bookmark ${bookmark.name}`} onClick={() => void deleteBookmark(bookmark.id)}><X size={13} /></button></li>)}</ul></details>
              </div>}
              <form className="module-bookmark-form" onSubmit={event => { event.preventDefault(); void addBookmark(); }}><input aria-label="Bookmark name" placeholder="Name this page…" value={bookmarkValue} onChange={event => setBookmarkValue(event.target.value)} maxLength={80} /><button className="module-primary-button" type="submit" disabled={!bookmarkValue.trim()}><BookmarkPlus size={15} /> Bookmark page</button></form>
            </>}
          </section>}
        </>
      )}
      <footer className="module-reader-footer"><span><Ban size={13} /> Private campaign file · no links or scripts run</span>{mobile && <button type="button" className="module-text-button" onClick={onClose}>Close reader</button>}</footer>
      <AlertDialog open={!!deleteCandidate} onOpenChange={open => { if (!open) setDeleteCandidate(null); }}>
        <AlertDialogContent className="module-alert-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this adventure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate ? `“${deleteCandidate.name}” will be removed from this campaign. This cannot be undone.` : "This module will be removed from this campaign."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep module</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteCandidate) void removeModule(deleteCandidate); setDeleteCandidate(null); }} className="module-delete-action">
              Delete module
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
