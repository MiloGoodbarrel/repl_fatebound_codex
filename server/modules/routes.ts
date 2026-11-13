import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
import { requestActors } from "../auth/context";
import { ModuleError, ModuleRepository, type ModuleRow } from "./repository";
import { type ModuleObjects, PrivateModuleObjects } from "./storage";
import { validateModule } from "./validate";
import { MAX_MODULE_BYTES } from "../../shared/modules";
import { pool } from "../db";

const publicRow = ({ objectKey: _key, status: _status, ...rest }: ModuleRow) => rest;
const idSchema = z.string().uuid();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  page: z.number().int().min(1).max(2000).optional(),
  bookmarks: z.array(z.object({ id: idSchema, name: z.string().trim().min(1).max(100), page: z.number().int().min(1).max(2000) }).strict()).max(200).optional(),
}).strict().refine(value => Object.keys(value).length > 0);

export function byteRange(value: string | undefined, size: number) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (![start, end].every(Number.isSafeInteger) || start < 0 || end < start || start >= size) return null;
  return { start, end, partial: true };
}

// Mounted only after the normal account policy; all routes inherit campaign
// ownership, stale-identity, same-origin and private/no-store enforcement.
export function registerModuleRoutes(app: Express, repo = new ModuleRepository(pool), objects: ModuleObjects = new PrivateModuleObjects()) {
  const router = express.Router({ mergeParams: true });
  const active = new Set<string>();
  const scope = (req: Request) => {
    const owner = requestActors.get(req)?.userId;
    if (!owner) throw new ModuleError(401, "Sign in to use campaign modules.");
    return { owner, campaign: Number(req.params.id) };
  };
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
  const erase = async (row: ModuleRow) => {
    await repo.tombstone(row.id);
    await objects.delete(row.objectKey);
    await repo.remove(row.id);
  };
  let cleaning = false;
  const cleanup = async () => {
    if (cleaning) return;
    cleaning = true;
    try {
      for (const row of await repo.abandoned()) {
        try { await erase(row); } catch { /* Durable tombstones are retried next sweep. */ }
      }
    } finally { cleaning = false; }
  };
  const timer = setInterval(() => { void cleanup().catch(() => {}); }, 10 * 60_000);
  timer.unref();
  void cleanup().catch(() => {});
  router.get("/", wrap(async (req, res) => {
    const { owner, campaign } = scope(req), value = await repo.list(campaign, owner);
    res.json({ ...value, modules: value.modules.map(publicRow) });
  }));
  router.post("/", wrap(async (req, res) => {
    const { owner, campaign } = scope(req);
    const filename = z.string().min(1).max(180).regex(/^[^/\\\x00-\x1f\x7f]+\.pdf$/i).parse(req.query.filename);
    if (req.get("content-type")?.split(";")[0] !== "application/pdf") throw new ModuleError(415, "Choose a PDF file.");
    const length = Number(req.get("content-length"));
    if (!Number.isSafeInteger(length) || length < 1 || length > MAX_MODULE_BYTES)
      throw new ModuleError(413, "Choose a PDF no larger than 100 MiB.");
    if (active.has(owner) || active.size >= 2) throw new ModuleError(429, "Another module upload is in progress. Retry shortly.");
    active.add(owner);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const abort = () => { if (!res.writableFinished) controller.abort(); };
    req.once("aborted", abort); res.once("close", abort);
    let directory: string | undefined, reserved: ModuleRow | undefined, completed = false;
    try {
      directory = await mkdtemp(path.join(tmpdir(), "fatebound-module-"));
      const target = path.join(directory, "document.pdf");
      let total = 0;
      await pipeline(req, new Transform({ transform(chunk, _encoding, done) {
        total += chunk.length;
        done(total > MAX_MODULE_BYTES ? new ModuleError(413, "PDF exceeds 100 MiB.") : null, chunk);
      } }), createWriteStream(target, { mode: 0o600 }), { signal: controller.signal });
      if (total !== length) throw new ModuleError(400, "Upload interrupted. Choose the file again.");
      await validateModule(target, controller.signal);
      // Fail before reserving database quota if no storage bucket exists.
      await objects.check?.();
      reserved = await repo.reserve(campaign, owner, filename, total);
      await objects.upload(reserved.objectKey, target, controller.signal);
      controller.signal.throwIfAborted();
      const saved = await repo.ready(campaign, owner, reserved.id);
      // If the browser left after the upload, do not retain an unacknowledged module.
      controller.signal.throwIfAborted();
      completed = true;
      res.status(201).json(publicRow(saved));
    } finally {
      clearTimeout(timeout); req.off("aborted", abort); res.off("close", abort);
      active.delete(owner);
      if (reserved && !completed) {
        try { await erase(reserved); } catch { await repo.tombstone(reserved.id).catch(() => {}); }
      }
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }));
  router.patch("/selection", wrap(async (req, res) => {
    const { owner, campaign } = scope(req);
    const { selectedId } = z.object({ selectedId: idSchema.nullable() }).strict().parse(req.body);
    await repo.select(campaign, owner, selectedId); res.json({ selectedId });
  }));
  router.patch("/:mid", wrap(async (req, res) => {
    const { owner, campaign } = scope(req);
    res.json(publicRow(await repo.update(campaign, owner, idSchema.parse(req.params.mid), updateSchema.parse(req.body))));
  }));
  router.delete("/:mid", wrap(async (req, res) => {
    const { owner, campaign } = scope(req);
    // A tombstone is already hidden. Retrying delete also triggers cleanup.
    try { await erase(await repo.get(campaign, owner, idSchema.parse(req.params.mid))); }
    catch (error) {
      if (error instanceof ModuleError) throw error;
      throw new ModuleError(503, "Module hidden. Storage cleanup will retry automatically.");
    }
    res.sendStatus(204);
  }));
  router.get("/:mid/content", wrap(async (req, res) => {
    const { owner, campaign } = scope(req);
    const row = await repo.get(campaign, owner, idSchema.parse(req.params.mid));
    const range = byteRange(req.get("range"), row.size);
    res.set({
      "Content-Type": "application/pdf", "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "X-Frame-Options": "DENY",
    });
    if (!range) { res.status(416).set("Content-Range", `bytes */${row.size}`).end(); return; }
    res.status(range.partial ? 206 : 200).set("Content-Length", String(range.end - range.start + 1));
    if (range.partial) res.set("Content-Range", `bytes ${range.start}-${range.end}/${row.size}`);
    if (req.method === "HEAD") { res.end(); return; }
    const source = await objects.read(row.objectKey, range.start, range.end);
    const abort = () => source.destroy();
    res.once("close", abort);
    try { await pipeline(source, res); }
    finally { res.off("close", abort); source.destroy(); }
  }));
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent || res.destroyed) return;
    const status = error instanceof ModuleError ? error.status : error instanceof z.ZodError ? 400 : 503;
    res.status(status === 499 ? 408 : status).json({ message: error instanceof ModuleError ? error.message :
      status === 400 ? "Check the module name, PDF filename or page details." :
      "Module storage unavailable. Check App Storage setup and retry. Your other campaign data is unchanged." });
  });
  app.use("/api/campaigns/:id/modules", router);
  return { cleanup, dispose: () => clearInterval(timer) };
}
