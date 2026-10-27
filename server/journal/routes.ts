import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { MAX_AUDIO_BYTES, MAX_TEXT_BYTES, importInput, nameKey, notesInput, renderReviewed, sessionInput, suggestNames, validateAudio, validateText, type Reference, type JournalImport } from "@shared/journal";
import type { JournalRepository, StoredImport } from "./repository";
import { MAX_DOCUMENT_BYTES } from "@shared/journal";
import { extractJournalDocument } from "./documents";

export const JOURNAL_PRIVACY_REASON = "Private sessions are locked until sign-in and server-verified campaign permissions are configured. Selecting a campaign is not authorization.";
export interface JournalAccess {
  /** A future account/membership implementation must supply this server-side. Never derive it from a client campaign id/header. */
  authorizeCampaign: (request: Request, campaignId: number) => Promise<boolean>;
  authorizeReference?: (request: Request, campaignId: number, reference: Reference) => Promise<boolean>;
}
class JournalError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new JournalError(status, message); };
const checked = <T>(fn: () => T): T => {
  try { return fn(); } catch (error) { return fail(400, error instanceof Error ? error.message : "Invalid input."); }
};
const decisionInput = z.object({
  revision: z.number().int().nonnegative(), suggestionId: z.string().max(60),
  referenceKey: z.string().max(200).nullable(), allMatching: z.boolean().default(false), undo: z.boolean().default(false),
}).strict();
const aliasInput = z.object({
  phrase: z.string().trim().min(2).max(120).refine(s => new RegExp("^[\\p{L}\\p{N}’' -]+$", "u").test(s) && nameKey(s).length >= 2, "Aliases must be bounded name phrases."),
  referenceKey: z.string().min(1).max(200),
}).strict();
const editInput = z.object({ revision: z.number().int().nonnegative(), text: z.string().max(MAX_TEXT_BYTES).nullable() }).strict();
const safeFilename = (req: Request) => {
  try {
    const value = decodeURIComponent(req.get("x-file-name") ?? "");
    if (!value || value.length > 180 || /[\/\\\u0000-\u001f\u007f]/.test(value)) fail(400, "Provide a valid filename without paths.");
    return value;
  } catch { return fail(400, "Provide a valid encoded filename without paths."); }
};
const wrap = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res)).catch(next); };

export function registerJournalRoutes(app: Express, repo: JournalRepository, access?: JournalAccess) {
  // The legacy campaign deletion route cascades into journal tables. Protect that
  // indirect write too, without changing deletion behavior for campaigns without journals.
  app.delete("/api/campaigns/:id", (req, res, next) => {
    Promise.resolve().then(async () => {
      const id = Number(req.params.id);
      // The legacy handler uses parseInt. Reject noncanonical forms here, rather
      // than checking one id while e.g. "1e2" is later deleted as campaign 1.
      if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id)) {
        res.status(400).json({ message: "Invalid campaign id." });
        return;
      }
      if (await repo.hasPrivateData(id) && (!access || !await access.authorizeCampaign(req, id))) {
        res.status(403).json({ message: "This campaign contains private journal data. Verified campaign permission is required to delete it." });
        return;
      }
      next();
    }).catch(() => res.status(503).json({ message: "Campaign deletion is unavailable while private journal protection cannot be checked." }));
  });
  const router = express.Router({ mergeParams: true });
  const campaignId = (req: Request) => {
    const id = Number(req.params.campaignId);
    if (!Number.isSafeInteger(id) || id < 1) fail(400, "Invalid campaign id.");
    return id;
  };
  router.use((_req, res, next) => {
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    next();
  });
  router.get("/capabilities", wrap(async (req, res) => {
    const allowed = !!access && await access.authorizeCampaign(req, campaignId(req));
    res.json({ available: allowed, audio: true, reason: allowed ? "" : JOURNAL_PRIVACY_REASON });
  }));
  // This gate runs BEFORE any journal-specific body parser and before database reads.
  router.use((req, res, next) => {
    Promise.resolve().then(async () => {
      if (!access || !await access.authorizeCampaign(req, campaignId(req))) fail(403, JOURNAL_PRIVACY_REASON);
      next();
    }).catch(next);
  });
  router.use(express.json({ limit: "2mb" }));
  const references = async (req: Request) => {
    const id = campaignId(req);
    const all = await repo.references(id);
    const allowed = await Promise.all(all.map(async ref => {
      const permitted = access?.authorizeReference ? await access.authorizeReference(req, id, ref) :
        ref.campaignId == null || ref.campaignId === id || !!access && await access.authorizeCampaign(req, ref.campaignId);
      return permitted ? ref : null;
    }));
    return allowed.filter((r): r is Reference => r !== null);
  };
  const session = async (req: Request) => {
    const value = await repo.getSession(campaignId(req), req.params.sid);
    return value ?? fail(404, "Session not found in this campaign.");
  };
  const imported = async (req: Request) => {
    await session(req);
    return await repo.getImport(req.params.sid, req.params.iid) ?? fail(404, "Import not found in this session.");
  };
  const hydrate = (row: StoredImport, refs: Reference[]): JournalImport => {
    const byKey = new Map(refs.map(r => [r.key, r]));
    // Re-check *current* access; removed links/revoked grants must not expose cached canonical names.
    const suggestions = row.suggestions.map(s => ({ ...s, candidates: s.candidates.filter(c => byKey.has(c.key)) })).filter(s => s.candidates.length);
    return { ...row, suggestions, reviewed: row.editedText ?? renderReviewed(row.original, suggestions, row.decisions) };
  };
  router.get("/references", wrap(async (req, res) => res.json(await references(req))));
  router.get("/sessions", wrap(async (req, res) => res.json(await repo.listSessions(campaignId(req)))));
  router.post("/sessions", wrap(async (req, res) => {
    const data = sessionInput.parse(req.body);
    res.status(201).json(await repo.createSession({
      ...data, id: randomUUID(), campaignId: campaignId(req), notes: "", revision: 0, updatedAt: new Date().toISOString(),
    }));
  }));
  router.get("/sessions/:sid", wrap(async (req, res) => {
    const value = await session(req);
    const [imports, recordings, refs] = await Promise.all([repo.listImports(value.id), repo.listRecordings(value.id), references(req)]);
    res.json({ session: value, imports: imports.map(i => hydrate(i, refs)), recordings });
  }));
  router.patch("/sessions/:sid", wrap(async (req, res) => {
    await session(req);
    res.json(await repo.updateSession(campaignId(req), req.params.sid, sessionInput.parse(req.body)) ?? fail(404, "Session no longer exists."));
  }));
  router.put("/sessions/:sid/notes", wrap(async (req, res) => {
    await session(req);
    const data = notesInput.parse(req.body);
    checked(() => validateText(data.notes, true));
    res.json(await repo.saveNotes(campaignId(req), req.params.sid, data.revision, data.notes) ??
      fail(409, "These notes changed elsewhere. Reload the saved version before retrying; your unsaved text has not been applied."));
  }));
  router.delete("/sessions/:sid", wrap(async (req, res) => {
    await session(req); await repo.deleteSession(campaignId(req), req.params.sid); res.sendStatus(204);
  }));
  const createImport = async (req: Request, data: z.infer<typeof importInput>) => {
    await session(req); checked(() => validateText(data.text));
    const refs = await references(req), aliases = await repo.listAliases(campaignId(req));
    const row = await repo.createImport({
      id: randomUUID(), sessionId: req.params.sid, title: data.title, kind: data.kind, format: data.format,
      original: data.text, suggestions: suggestNames(data.text, refs, aliases), decisions: [], revision: 0, editedText: null,
    });
    return hydrate(row, refs);
  };
  router.post("/sessions/:sid/imports", wrap(async (req, res) => res.status(201).json(await createImport(req, importInput.parse(req.body)))));
  router.post("/sessions/:sid/imports/file", express.raw({ type: "application/octet-stream", limit: MAX_DOCUMENT_BYTES }), wrap(async (req, res) => {
    await session(req);
    if (!Buffer.isBuffer(req.body)) fail(415, "Send document bytes as application/octet-stream.");
    const title = safeFilename(req);
    if (/\.(txt|md|markdown)$/i.test(title) && req.body.length > MAX_TEXT_BYTES) fail(413, "Text files must be at most 256 KiB.");
    let document;
    try { document = await extractJournalDocument(req.body, title); }
    catch (error) { return fail(400, error instanceof Error ? error.message : "Could not read this document."); }
    res.status(201).json(await createImport(req, importInput.parse({
      title, ...document, kind: req.get("x-import-kind") ?? "transcript",
    })));
  }));
  router.post("/sessions/:sid/imports/:iid/decisions", wrap(async (req, res) => {
    const row = await imported(req), data = decisionInput.parse(req.body), refs = await references(req);
    if (row.editedText !== null) fail(409, "Discard manual reviewed-text edits before changing correction decisions.");
    const view = hydrate(row, refs), chosen = view.suggestions.find(s => s.id === data.suggestionId);
    if (!chosen) fail(400, "Suggestion is no longer available.");
    if (data.referenceKey && !chosen!.candidates.some(c => c.key === data.referenceKey)) fail(400, "Choose a currently authorized candidate.");
    const targets = data.allMatching ? view.suggestions.filter(s => nameKey(s.phrase) === nameKey(chosen!.phrase) &&
      (!data.referenceKey || s.candidates.some(c => c.key === data.referenceKey))) : [chosen!];
    const ids = new Set(targets.map(s => s.id));
    const decisions = row.decisions.filter(d => !ids.has(d.suggestionId));
    if (!data.undo) decisions.push(...targets.map(s => ({ suggestionId: s.id, referenceKey: data.referenceKey })));
    const updated = await repo.updateImport(req.params.sid, row.id, data.revision, { decisions, editedText: null });
    res.json(hydrate(updated ?? fail(409, "Review changed elsewhere. Reload before making another decision."), refs));
  }));
  router.put("/sessions/:sid/imports/:iid/edit", wrap(async (req, res) => {
    const row = await imported(req), data = editInput.parse(req.body);
    if (data.text !== null) checked(() => validateText(data.text!, true));
    const updated = await repo.updateImport(req.params.sid, row.id, data.revision, { decisions: row.decisions, editedText: data.text });
    res.json(hydrate(updated ?? fail(409, "Review changed elsewhere. Reload before editing."), await references(req)));
  }));
  router.get("/aliases", wrap(async (req, res) => {
    const keys = new Set((await references(req)).map(r => r.key));
    res.json((await repo.listAliases(campaignId(req))).filter(a => keys.has(a.referenceKey)));
  }));
  const saveAlias = async (req: Request, res: Response, existing: boolean) => {
    const data = aliasInput.parse(req.body), refs = await references(req);
    if (!refs.some(r => r.key === data.referenceKey)) fail(400, "Reference is not authorized for this campaign.");
    if (refs.some(r => nameKey(r.name) === nameKey(data.phrase) && r.key !== data.referenceKey)) fail(409, "That alias conflicts with an existing canonical name.");
    const alias = { ...data, id: existing ? req.params.aid : randomUUID() };
    res.status(existing ? 200 : 201).json(await repo.saveAlias(campaignId(req), alias, existing) ??
      fail(409, "Alias conflicts with another remembered phrase or no longer exists. Inspect aliases before changing it."));
  };
  router.post("/aliases", wrap((req, res) => saveAlias(req, res, false)));
  router.patch("/aliases/:aid", wrap((req, res) => saveAlias(req, res, true)));
  router.delete("/aliases/:aid", wrap(async (req, res) => { await repo.deleteAlias(campaignId(req), req.params.aid); res.sendStatus(204); }));
  router.post("/sessions/:sid/recordings", express.raw({ type: () => true, limit: MAX_AUDIO_BYTES }), wrap(async (req, res) => {
    await session(req);
    const name = safeFilename(req), type = req.get("content-type")?.split(";")[0] ?? "";
    const id = z.string().uuid().parse(req.get("x-upload-id"));
    if (!Buffer.isBuffer(req.body)) fail(415, "Send recording bytes, not JSON or form data.");
    checked(() => validateAudio(req.body, type));
    const digest = createHash("sha256").update(req.body).digest("hex");
    const stored = (await repo.createRecording({ id, sessionId: req.params.sid, name, type, size: req.body.length, bytes: req.body, digest }) ??
      await repo.getRecording(req.params.sid, id)) ?? fail(409, "Upload identity conflicts with another recording. Choose the file again.");
    if (stored.digest !== digest || stored.type !== type || stored.name !== name) fail(409, "Upload identity conflicts with another recording. Choose the file again.");
    res.status(201).json({ id, sessionId: stored.sessionId, name: stored.name, type: stored.type, size: stored.size });
  }));
  router.get("/sessions/:sid/recordings/:rid", wrap(async (req, res) => {
    await session(req);
    const row = await repo.getRecording(req.params.sid, req.params.rid) ?? fail(404, "Recording not found in this session.");
    res.set({ "Content-Type": row.type, "Accept-Ranges": "bytes", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.name)}` });
    const range = req.get("range");
    if (!range) { res.set("Content-Length", String(row.size)); return res.send(row.bytes); }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) { res.set("Content-Range", `bytes */${row.size}`); return res.sendStatus(416); }
    const start = match[1] ? Number(match[1]) : Math.max(0, row.size - Number(match[2]));
    const end = match[1] ? (match[2] ? Math.min(Number(match[2]), row.size - 1) : row.size - 1) : row.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= row.size) {
      res.set("Content-Range", `bytes */${row.size}`); return res.sendStatus(416);
    }
    res.status(206).set({ "Content-Range": `bytes ${start}-${end}/${row.size}`, "Content-Length": String(end - start + 1) }).send(row.bytes.subarray(start, end + 1));
  }));
  router.delete("/sessions/:sid/recordings/:rid", wrap(async (req, res) => {
    await session(req); await repo.deleteRecording(req.params.sid, req.params.rid); res.sendStatus(204);
  }));
  router.use((_req, res) => res.status(404).json({ message: "Journal endpoint not found." }));
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof JournalError ? error.status : error instanceof z.ZodError ? 400 :
      (error as { type?: string }).type === "entity.too.large" ? 413 :
      error instanceof SyntaxError ? 400 : 500;
    // Never log request/response content, filenames, transcripts, or recording bytes.
    const message = error instanceof JournalError ? error.message : error instanceof z.ZodError ? error.issues[0].message :
      status === 413 ? "File or request exceeds the size limit." : status === 400 ? "Invalid request." :
      "The journal operation failed. Your original text was not replaced. Retry or reload before continuing.";
    res.status(status).json({ message });
  });
  app.use("/api/campaigns/:campaignId/journal", router);
}
