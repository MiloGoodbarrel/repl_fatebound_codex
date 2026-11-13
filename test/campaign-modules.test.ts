import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { apiPolicy } from "../server/auth/policy";
import { ModuleRepository, ModuleError, type ModuleRow } from "../server/modules/repository";
import { registerModuleRoutes, byteRange } from "../server/modules/routes";
import { MAX_MODULE_BYTES } from "../shared/modules";
import { pdf } from "./document-fixtures";

test("module byte ranges reject invalid/multiple/empty requests", () => {
  assert.deepEqual(byteRange(undefined, 100), { start: 0, end: 99, partial: false });
  assert.deepEqual(byteRange("bytes=10-19", 100), { start: 10, end: 19, partial: true });
  assert.deepEqual(byteRange("bytes=-10", 100), { start: 90, end: 99, partial: true });
  assert.deepEqual(byteRange("bytes=90-999", 100), { start: 90, end: 99, partial: true });
  for (const range of ["bytes=-0", "bytes=100-", "bytes=10-1", "bytes=-", "bytes=0-2,4-5", "bytes=999999999999999999-"])
    assert.equal(byteRange(range, 100), null);
});

// Unit test only: API policy and real PDF validator, injected repository/object
// store. The separate opt-in authenticated browser regression uses actual services.
test("private module lifecycle, validation, ranges and cleanup fail closed", { timeout: 60_000 }, async () => {
  const rows = new Map<string, ModuleRow>(), files = new Map<string, Buffer>();
  let selectedId: string | null = null, failDelete = false, failUpload = false;
  class Repo extends ModuleRepository {
    async list() { return { modules: [...rows.values()].filter(r => r.status === "ready"), selectedId }; }
    async get(_campaign: number, _owner: string, id: string) {
      const row = rows.get(id);
      if (!row || row.status !== "ready") throw new ModuleError(404, "Missing module.");
      return row;
    }
    async reserve(_c: number, _o: string, filename: string, size: number) {
      const id = randomUUID();
      const row: ModuleRow = { id, filename, name: filename.replace(/\.pdf$/, ""), size, page: 1, bookmarks: [],
        status: "pending", createdAt: new Date().toISOString(), objectKey: `campaign-modules/${id}.pdf` };
      rows.set(id, row); return row;
    }
    async ready(_c: number, _o: string, id: string) { rows.get(id)!.status = "ready"; return rows.get(id)!; }
    async select(_c: number, _o: string, id: string | null) { if (id) await this.get(1, "owner", id); selectedId = id; }
    async update(_c: number, _o: string, id: string, values: any) { const row = await this.get(1, "owner", id); Object.assign(row, values); return row; }
    async tombstone(id: string) { rows.get(id)!.status = "deleting"; if (selectedId === id) selectedId = null; }
    async remove(id: string) { rows.delete(id); }
    async abandoned() { return [...rows.values()].filter(row => row.status === "deleting"); }
  }
  const app = express();
  app.use(express.json());
  app.use("/api", apiPolicy(async req => req.get("x-test-actor") ? { userId: req.get("x-test-actor")!, admin: false } : null, {
    campaignOwner: async id => id === 1 ? "owner" : "other",
    characterCampaign: async () => null, tableCampaign: async () => null,
  }));
  const service = registerModuleRoutes(app, new Repo({} as any), {
    upload: async (key, filename) => { if (failUpload) throw new Error("storage failed"); files.set(key, await readFile(filename)); },
    read: async (key, start, end) => Readable.from(files.get(key)!.subarray(start, end + 1)),
    delete: async key => { if (failDelete) throw new Error("storage failed"); files.delete(key); },
  });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (path = "", init: RequestInit = {}, actor = "owner") => fetch(`${origin}/api/campaigns/1/modules${path}`, {
    ...init, headers: { "x-test-actor": actor, Origin: origin, ...init.headers },
  });
  const json = (method: string, data: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const upload = (bytes: Buffer) => request("?filename=fictional.pdf", { method: "POST", headers: { "Content-Type": "application/pdf" }, body: bytes });
  try {
    assert.equal((await request("", {}, "")).status, 401);
    assert.equal((await request("", {}, "other")).status, 404);
    assert.equal((await request("?filename=fictional.pdf", {
      method: "POST", headers: { "Content-Type": "application/pdf", Origin: "https://evil.example" }, body: pdf("private"),
    })).status, 403);
    for (const bytes of [Buffer.from("not pdf"), Buffer.from("%PDF-1.4\nbroken")]) {
      assert.equal((await upload(bytes)).status, 400); assert.equal(rows.size, 0); assert.equal(files.size, 0);
    }
    assert.equal((await upload(Buffer.alloc(MAX_MODULE_BYTES + 1))).status, 413);
    assert.equal(rows.size, 0);
    failUpload = true;
    assert.equal((await upload(pdf("Synthetic adventure"))).status, 503);
    assert.equal(rows.size, 0, "Failed uploads clean up reservations");
    failUpload = false;
    const bytes = pdf("Synthetic scene one\nOpen the gate", { pages: 3 });
    const response = await upload(bytes);
    assert.equal(response.status, 201);
    const created = await response.json() as ModuleRow;
    assert.equal("objectKey" in created, false);
    assert.equal("status" in created, false);
    const id = created.id;
    assert.equal((await request("/selection", json("PATCH", { selectedId: id }))).status, 200);
    const bookmarks = [{ id: randomUUID(), name: "Scene gate", page: 2 }];
    const changed = await request(`/${id}`, json("PATCH", { name: "Reviewed adventure", page: 2, bookmarks }));
    assert.equal(changed.status, 200);
    const listed = await (await request()).json();
    assert.equal(listed.selectedId, id);
    assert.equal(listed.modules[0].name, "Reviewed adventure");
    assert.equal(listed.modules[0].page, 2);
    assert.deepEqual(listed.modules[0].bookmarks, bookmarks);
    for (const [method, tail, data] of [
      ["GET", "", null], ["GET", `/${id}/content`, null], ["HEAD", `/${id}/content`, null],
      ["PATCH", "/selection", { selectedId: id }], ["PATCH", `/${id}`, { page: 3 }], ["DELETE", `/${id}`, null],
    ] as const) assert.equal((await request(tail, data ? json(method, data) : { method }, "other")).status, 404);
    const content = await request(`/${id}/content`, { headers: { Range: "bytes=20-39" } });
    assert.equal(content.status, 206);
    assert.equal(content.headers.get("content-range"), `bytes 20-39/${bytes.length}`);
    assert.equal(content.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await content.arrayBuffer()), bytes.subarray(20, 40));
    assert.equal((await request(`/${id}/content`, { method: "HEAD" })).headers.get("content-length"), String(bytes.length));
    assert.equal((await request(`/${id}/content`, { headers: { Range: "bytes=9999999-" } })).status, 416);
    assert.equal((await request(`/${id}`, json("PATCH", { objectKey: "other" }))).status, 400);
    failDelete = true;
    assert.equal((await request(`/${id}`, { method: "DELETE" })).status, 503);
    assert.equal((await request(`/${id}/content`)).status, 404, "Tombstoned files never remain readable");
    assert.equal((await (await request()).json()).modules.length, 0);
    assert.equal(files.size, 1, "Cleanup failure retains a durable tombstone");
    failDelete = false; await service.cleanup();
    assert.equal(rows.size, 0); assert.equal(files.size, 0);
    const scan = await upload(pdf(undefined, { imageOnly: true }));
    assert.equal(scan.status, 201, "Scans must be viewable without extraction/OCR");
    const scanned = await scan.json() as ModuleRow;
    assert.equal((await request(`/${scanned.id}`, { method: "DELETE" })).status, 204);
  } finally {
    service.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
