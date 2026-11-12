import { useEffect, useMemo, useRef, useState } from "react";
import { creatureProfileSchema } from "@shared/creatureProfiles";
import { AlertCircle, FileUp, Loader2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type PdfImportKind = "creatures" | "items";
type ImportEntry = Record<string, unknown>;

interface PreviewResponse {
  text: string;
  candidates: object[];
  warnings: string[];
  existingNames: string[];
}

interface PdfLibraryImportProps {
  campaignId: number;
  kind: PdfImportKind;
  disabled?: boolean;
  onImported?: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function entryName(entry: ImportEntry): string {
  return typeof entry.name === "string" ? entry.name.trim() : "";
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "issues" in value && Array.isArray(value.issues)) {
    const issue = value.issues.find(item => item && typeof item === "object"
      && "message" in item && typeof item.message === "string");
    if (issue) {
      const pathValue = "path" in issue
        ? Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path ?? "")
        : "";
      return pathValue ? `${pathValue}: ${issue.message}` : issue.message;
    }
  }
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
    return value.message;
  }
  return fallback;
}

export function PdfLibraryImport({ campaignId, kind, disabled = false, onImported }: PdfLibraryImportProps) {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [entryJson, setEntryJson] = useState<string[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [manualEntryIndexes, setManualEntryIndexes] = useState<Set<number>>(new Set());
  const [acknowledgeDuplicates, setAcknowledgeDuplicates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [pendingSave, setPendingSave] = useState(false);
  const pendingBody = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const requestSequence = useRef(0);
  const liveScope = useRef({ campaignId, kind });
  liveScope.current = { campaignId, kind };
  const { toast } = useToast();

  const currentNames = useMemo(() => entryJson.map(value => {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? entryName(parsed as ImportEntry)
        : "";
    } catch {
      return "";
    }
  }), [entryJson]);
  const duplicateReasons = useMemo(() => {
    const existing = new Set(existingNames.map(name => name.trim().toLocaleLowerCase()).filter(Boolean));
    const counts = new Map<string, number>();
    selected.forEach((isSelected, index) => {
      const normalized = currentNames[index]?.trim().toLocaleLowerCase();
      if (isSelected && normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
    const reasons = new Map<number, string>();
    currentNames.forEach((name, index) => {
      if (!selected[index] || !name.trim()) return;
      const normalized = name.trim().toLocaleLowerCase();
      if (existing.has(normalized)) {
        reasons.set(index, `Existing campaign entry: ${existingNames.find(value => value.trim().toLocaleLowerCase() === normalized)}`);
      } else if ((counts.get(normalized) ?? 0) > 1) {
        reasons.set(index, "Another selected entry has the same name.");
      }
    });
    return reasons;
  }, [currentNames, existingNames, selected]);
  const duplicateIndexes = Array.from(duplicateReasons.keys());
  const selectedDuplicateIndexes = duplicateIndexes.filter(index => selected[index]);
  const selectedCount = selected.filter(Boolean).length;
  const title = kind === "creatures" ? "Import creatures from PDF" : "Import items from PDF";

  const resetReview = () => {
    pendingBody.current = null;
    setPendingSave(false);
    setFilename("");
    setSourceText("");
    setWarnings([]);
    setExistingNames([]);
    setEntries([]);
    setEntryJson([]);
    setSelected([]);
    setManualEntryIndexes(new Set());
    setAcknowledgeDuplicates(false);
    setReviewError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    requestSequence.current += 1;
    resetReview();
    setOpen(false);
    setBusy(false);
    submitLock.current = false;
    // A campaign switch must not leave a review tied to the prior library.
  }, [campaignId, kind]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (busy) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      requestSequence.current += 1;
      resetReview();
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    resetReview();
    setFilename(file.name);
    setOpen(true);
    if (file.size > MAX_FILE_BYTES) {
      setReviewError("This PDF is larger than the 10 MiB upload limit. Choose a smaller file.");
      return;
    }
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setReviewError("Choose a PDF file.");
      return;
    }

    const requestCampaignId = campaignId;
    const requestKind = kind;
    const requestId = ++requestSequence.current;
    setBusy(true);
    try {
      const query = new URLSearchParams({ kind: requestKind, filename: file.name });
      const response = await fetch(`/api/campaigns/${requestCampaignId}/pdf-import/preview?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      const payload = await response.json().catch(() => null);
      if (requestSequence.current !== requestId
        || liveScope.current.campaignId !== requestCampaignId
        || liveScope.current.kind !== requestKind) return;
      if (!response.ok) {
        throw new Error(errorMessage(payload, `PDF preview failed (${response.status}).`));
      }
      const preview = payload as PreviewResponse;
      if (!preview || typeof preview.text !== "string" || !Array.isArray(preview.candidates)) {
        throw new Error("The preview response was incomplete. Try the PDF again.");
      }
      setSourceText(preview.text);
      setWarnings(Array.isArray(preview.warnings) ? preview.warnings.filter(item => typeof item === "string") : []);
      setExistingNames(Array.isArray(preview.existingNames) ? preview.existingNames.filter(item => typeof item === "string") : []);
      const normalized = preview.candidates.map(candidate => {
        const entry = candidate && typeof candidate === "object" ? { ...(candidate as ImportEntry) } : {};
        if (typeof entry.source !== "string" || !entry.source.trim()) entry.source = file.name;
        return entry;
      });
      setEntries(normalized);
      setEntryJson(normalized.map(entry => JSON.stringify(entry, null, 2)));
      setSelected(normalized.map(() => true));
      if (normalized.length === 0) {
        setReviewError("No entries were detected. Add a blank entry and use the extracted text below to build one.");
      }
    } catch (error) {
      if (requestSequence.current === requestId
        && liveScope.current.campaignId === requestCampaignId
        && liveScope.current.kind === requestKind) {
        setReviewError(error instanceof Error ? error.message : "Could not preview this PDF. Try again.");
      }
    } finally {
      if (requestSequence.current === requestId
        && liveScope.current.campaignId === requestCampaignId
        && liveScope.current.kind === requestKind) setBusy(false);
    }
  };

  const addBlankEntry = () => {
    const entry: ImportEntry = kind === "creatures"
      ? { index: "", name: "", hp: "", ac: "", cr: "", type: "", size: "", source: filename }
      : { name: "", category: "", rarity: "", description: "", source: filename };
    setManualEntryIndexes(previous => new Set(previous).add(entries.length));
    setEntries(previous => [...previous, entry]);
    setEntryJson(previous => [...previous, JSON.stringify(entry, null, 2)]);
    setSelected(previous => [...previous, true]);
    setReviewError("");
  };

  const updateJson = (index: number, value: string) => {
    setEntryJson(previous => previous.map((current, i) => i === index ? value : current));
    setAcknowledgeDuplicates(false);
    setReviewError("");
  };

  const readEntry = (index: number): ImportEntry => {
    try {
      const parsed = JSON.parse(entryJson[index] ?? "") as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as ImportEntry;
    } catch {
      // Keep form fields usable as a way to recover from malformed advanced JSON.
    }
    return entries[index] ?? {};
  };

  const updateField = (index: number, field: string, value: unknown) => {
    const updated = { ...readEntry(index) };
    if (value === undefined) delete updated[field];
    else updated[field] = value;
    updateJson(index, JSON.stringify(updated, null, 2));
  };

  const handleCommit = async () => {
    if (submitLock.current || busy) return;
    if (selectedCount === 0) {
      setReviewError("Select at least one entry to save.");
      return;
    }
    if (selectedDuplicateIndexes.length > 0 && !acknowledgeDuplicates) {
      setReviewError("Review the duplicate-name matches and acknowledge them before saving.");
      return;
    }

    const parsedEntries: ImportEntry[] = [];
    for (let index = 0; index < entries.length; index++) {
      if (!selected[index]) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(entryJson[index] ?? "");
      } catch {
        setReviewError(`Entry ${index + 1} is not valid JSON. Correct it before saving.`);
        return;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setReviewError(`Entry ${index + 1} must be a JSON object.`);
        return;
      }
      const entry = parsed as ImportEntry;
      if (kind === "creatures") {
        const result = creatureProfileSchema.safeParse(entry);
        if (!result.success) {
          setReviewError(`Creature entry ${index + 1} needs correction: ${result.error.issues[0]?.message ?? "invalid profile"}.`);
          return;
        }
        parsedEntries.push(result.data as ImportEntry);
      } else {
        if (!entryName(entry) || typeof entry.category !== "string" || !entry.category.trim()
          || typeof entry.rarity !== "string" || !entry.rarity.trim()
          || typeof entry.description !== "string") {
          setReviewError(`Item entry ${index + 1} needs a name, category, rarity, and description text.`);
          return;
        }
        parsedEntries.push(entry);
      }
    }

    const requestCampaignId = campaignId;
    const requestKind = kind;
    const requestId = ++requestSequence.current;
    submitLock.current = true;
    setBusy(true);
    setReviewError("");
    // Keep the exact operation after an uncertain response, not a new import.
    // A new review (after success, cancel, upload or scope change) gets a new key.
    pendingBody.current ??= JSON.stringify({
      idempotencyKey: crypto.randomUUID(), kind: requestKind, entries: parsedEntries,
    });
    setPendingSave(true);
    try {
      const response = await fetch(`/api/campaigns/${requestCampaignId}/pdf-import/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingBody.current,
      });
      const result = await response.json().catch(() => null);
      if (requestSequence.current !== requestId
        || liveScope.current.campaignId !== requestCampaignId
        || liveScope.current.kind !== requestKind) return;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          pendingBody.current = null;
          setPendingSave(false);
        }
        throw new Error(errorMessage(result, `Could not save entries (${response.status}).`));
      }
      if (!result || typeof result.count !== "number" || typeof result.message !== "string") {
        throw new Error("Could not confirm this import. Retry Save with this unchanged review; it will not add the same import twice.");
      }
      toast({
        title: "PDF import saved",
        description: result && typeof result.message === "string"
          ? result.message
          : `${typeof result?.count === "number" ? result.count : parsedEntries.length} entries added to this campaign.`,
      });
      setOpen(false);
      resetReview();
      onImported?.();
    } catch (error) {
      if (requestSequence.current === requestId
        && liveScope.current.campaignId === requestCampaignId
        && liveScope.current.kind === requestKind) {
        setReviewError(pendingBody.current
          ? "Could not confirm this import. Retry Save with this unchanged review; it will not add the same import twice."
          : error instanceof Error ? error.message : "Could not save these entries. Your review is still here.");
      }
    } finally {
      if (requestSequence.current === requestId
        && liveScope.current.campaignId === requestCampaignId
        && liveScope.current.kind === requestKind) {
        submitLock.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
        disabled={disabled || busy}
        aria-label={`Choose a PDF for ${kind} import`}
      />
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={disabled || busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="mr-2 h-4 w-4" />
          Import PDF
        </Button>
        {disabled && (
          <p className="text-xs text-muted-foreground">
            PDF imports are disabled in the public demo. Use a signed-in campaign to import {kind}.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <DialogTitle className="font-display">{title}</DialogTitle>
            <DialogDescription>
              Review and correct every entry before saving. Nothing is added until you choose Save.
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy || pendingSave} className="min-h-0 min-w-0 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-background/50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Source PDF</p>
                <p className="truncate text-sm font-medium" title={filename}>{filename || "No file selected"}</p>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">10 MiB maximum</span>
            </div>

            {busy && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-3 text-sm text-muted-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading PDF and preparing a review…
              </div>
            )}
            {reviewError && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{reviewError}</span>
              </div>
            )}
            {warnings.length > 0 && (
              <section className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 p-3" aria-label="Import warnings">
                <h3 className="text-sm font-semibold">Extraction notes</h3>
                <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                  {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              </section>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Entries to review</h3>
                <p className="text-xs text-muted-foreground">{selectedCount} selected · {entries.length} detected</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addBlankEntry} disabled={busy || pendingSave}>
                <Plus className="mr-1.5 h-4 w-4" /> Add blank
              </Button>
            </div>

            {entries.map((_, index) => {
              const name = currentNames[index] || "";
              const duplicate = duplicateReasons.has(index);
              const current = readEntry(index);
              const renderInput = (
                field: string,
                label: string,
                options: { numeric?: boolean; required?: boolean } = {},
              ) => {
                const rawValue = current[field];
                const value = typeof rawValue === "number" || typeof rawValue === "string" ? String(rawValue) : "";
                const id = `pdf-${kind}-${campaignId}-${index}-${field}`;
                return (
                  <label key={field} htmlFor={id} className="block space-y-1">
                    <span className="text-xs font-medium text-foreground/80">
                      {label}{options.required && <span className="text-destructive"> *</span>}
                    </span>
                    <input
                      id={id}
                      type={options.numeric ? "number" : "text"}
                      step={options.numeric ? "any" : undefined}
                      inputMode={options.numeric ? "decimal" : undefined}
                      value={value}
                      onChange={event => {
                        const nextValue = event.target.value;
                        updateField(index, field, options.numeric
                          ? nextValue === "" ? (options.required ? "" : undefined) : Number(nextValue)
                          : nextValue);
                      }}
                      aria-required={options.required}
                      disabled={busy || pendingSave}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </label>
                );
              };
              return (
                <article key={index} className="space-y-2 rounded-md border border-border/70 bg-background/40 p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`pdf-entry-${campaignId}-${kind}-${index}`}
                      checked={selected[index] ?? false}
                      onCheckedChange={value => {
                        setSelected(previous => previous.map((current, i) => i === index ? value === true : current));
                        setAcknowledgeDuplicates(false);
                      }}
                      aria-label={`Select entry ${index + 1}`}
                      disabled={busy}
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`pdf-entry-${campaignId}-${kind}-${index}`} className="block cursor-pointer text-sm font-semibold">
                        {manualEntryIndexes.has(index)
                          ? `Manual ${kind === "creatures" ? "creature" : "item"} template — fill required fields`
                          : name || `Untitled entry ${index + 1}`}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Source: {typeof current.source === "string" ? current.source : filename}
                        {typeof current.sourcePage === "number" ? ` · page ${current.sourcePage}` : ""}
                      </p>
                    </div>
                    {duplicate && <span className="rounded border border-amber-500/40 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300">Name match</span>}
                  </div>
                  {duplicate && (
                    <p className="ml-7 text-xs text-amber-700 dark:text-amber-300">
                      {duplicateReasons.get(index)}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {renderInput("name", "Name", { required: true })}
                    {kind === "creatures" ? (
                      <>
                        {renderInput("hp", "Hit points (HP)", { numeric: true, required: true })}
                        {renderInput("ac", "Armor class (AC)", { numeric: true, required: true })}
                        {renderInput("cr", "Challenge rating (CR)", { required: true })}
                        {renderInput("type", "Creature type", { required: true })}
                        {renderInput("size", "Size", { required: true })}
                      </>
                    ) : (
                      <>
                        {renderInput("category", "Category", { required: true })}
                        {renderInput("rarity", "Rarity", { required: true })}
                      </>
                    )}
                    {renderInput("source", "Source")}
                    {renderInput("sourcePage", "Source page", { numeric: true })}
                  </div>
                  <label htmlFor={`pdf-description-${campaignId}-${kind}-${index}`} className="block space-y-1">
                    <span className="text-xs font-medium text-foreground/80">
                      Description{kind === "items" && <span className="text-destructive"> *</span>}
                    </span>
                    <Textarea
                      id={`pdf-description-${campaignId}-${kind}-${index}`}
                      value={typeof current.description === "string" ? current.description : ""}
                      onChange={event => updateField(index, "description", event.target.value)}
                      aria-required={kind === "items"}
                      className="min-h-20 resize-y text-sm"
                      disabled={busy}
                    />
                  </label>
                  <details className="rounded-md border border-border/60 bg-background/50">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                      Advanced JSON editor
                    </summary>
                    <div className="px-3 pb-3">
                      <Textarea
                        value={entryJson[index] ?? ""}
                        onChange={event => updateJson(index, event.target.value)}
                        aria-label={`Advanced JSON editor for entry ${index + 1}`}
                        spellCheck={false}
                        className="min-h-36 resize-y font-mono text-xs leading-relaxed"
                        disabled={busy}
                      />
                    </div>
                  </details>
                </article>
              );
            })}
            {selectedDuplicateIndexes.length > 0 && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <Checkbox
                  checked={acknowledgeDuplicates}
                  onCheckedChange={value => setAcknowledgeDuplicates(value === true)}
                  disabled={busy || pendingSave}
                  aria-label="Acknowledge importing duplicate names"
                />
                <span>I reviewed the name matches and explicitly want to import the selected duplicates.</span>
              </label>
            )}

            <section className="space-y-2 border-t border-border/70 pt-4">
              <div>
                <h3 className="text-sm font-semibold">Extracted source text</h3>
                <p className="text-xs text-muted-foreground">Check the original wording here to correct fields or restore details missed during extraction.</p>
              </div>
              <Textarea
                value={sourceText}
                readOnly
                aria-label="Extracted PDF source text"
                className="h-36 min-h-28 max-h-56 resize-y overflow-y-auto font-mono text-xs leading-relaxed"
              />
            </section>
          </fieldset>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-5 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCommit}
              disabled={busy || selectedCount === 0 || (selectedDuplicateIndexes.length > 0 && !acknowledgeDuplicates)}
            >
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {busy ? "Saving…" : `Save ${selectedCount} ${kind === "creatures" ? "creature" : "item"}${selectedCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
