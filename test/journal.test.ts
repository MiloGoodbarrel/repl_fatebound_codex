import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { registerJournalRoutes, type JournalAccess } from "../server/journal/routes";
import { MemoryJournalRepository } from "./journal-fixtures";
import { MAX_TEXT_BYTES, MAX_AUDIO_BYTES, decodeTextFile, renderReviewed, suggestNames, validateAudio, type JournalImport, type JournalSession, type Reference, type SessionDetail } from "../shared/journal";
import { AutosaveCoordinator, type SavePayload, type SaveResult } from "../client/src/components/journal/autosaveCoordinator";
import SafeMarkdown from "../client/src/components/journal/Markdown";

const ref: Reference = { key: "character:1", name: "Quill", source: "Party character", campaignId: 1 };
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
async function fixture(access?: JournalAccess) {
  const repo = new MemoryJournalRepository(); repo.refs = [{ ...ref }];
  const app = express(); registerJournalRoutes(app, repo, access);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/campaigns`;
  return { repo, request: (path: string, init?: RequestInit) => fetch(url + path, init), close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
const access: JournalAccess = { authorizeCampaign: async (_req, c) => c === 1 || c === 2 };
const create = async (f: Awaited<ReturnType<typeof fixture>>, campaign = 1) => {
  const res = await f.request(`/${campaign}/journal/sessions`, json("POST", { title: "Synthetic session", date: "2026-10-26" }));
  assert.equal(res.status, 201); return await res.json() as JournalSession;
};
const addImport = async (f: Awaited<ReturnType<typeof fixture>>, sid: string, text = "Quil met Quil.") => {
  const res = await f.request(`/1/journal/sessions/${sid}/imports`, json("POST", { title: "Synthetic source", kind: "transcript", format: "text", text }));
  assert.equal(res.status, 201); return await res.json() as JournalImport;
};

test("default-deny blocks every private read/write/file route before repository or body parsing", async () => {
  const f = await fixture();
  try {
    f.repo.listSessions = async () => { throw new Error("Must not touch database"); };
    assert.equal((await (await f.request("/1/journal/capabilities")).json()).available, false);
    for (const [method, path] of [
      ["GET", "/sessions"], ["POST", "/sessions"], ["GET", "/sessions/private"],
      ["PATCH", "/sessions/private"], ["PUT", "/sessions/private/notes"], ["DELETE", "/sessions/private"],
      ["POST", "/sessions/private/imports"], ["POST", "/sessions/private/imports/file"],
      ["POST", "/sessions/private/imports/i/decisions"], ["PUT", "/sessions/private/imports/i/edit"],
      ["GET", "/references"], ["GET", "/aliases"], ["POST", "/aliases"], ["PATCH", "/aliases/a"], ["DELETE", "/aliases/a"],
      ["POST", "/sessions/private/recordings"], ["GET", "/sessions/private/recordings/r"], ["DELETE", "/sessions/private/recordings/r"],
    ]) {
      const response = await f.request(`/1/journal${path}`, { method, ...(method === "GET" ? {} : { body: "{bad json", headers: { "content-type": "application/json" } }) });
      assert.equal(response.status, 403, `${method} ${path}`);
      assert.match(response.headers.get("cache-control")!, /no-store/);
    }
  } finally { await f.close(); }
});

test("session CRUD is scoped, dates validated, CAS notes survive refresh and delayed writes cannot overwrite", async () => {
  const f = await fixture(access);
  try {
    const s = await create(f), other = await create(f, 2);
    assert.equal((await f.request("/3/journal/sessions")).status, 403);
    assert.equal((await f.request(`/2/journal/sessions/${s.id}`)).status, 404);
    assert.equal((await f.request(`/2/journal/sessions/${s.id}/notes`, json("PUT", { revision: 0, notes: "leak" }))).status, 404);
    assert.equal((await f.request(`/1/journal/sessions/${s.id}`, json("PATCH", { title: "Renamed", date: "2026-10-27" }))).status, 200);
    assert.equal((await f.request(`/1/journal/sessions/${s.id}`, json("PATCH", { title: "Bad", date: "2026-02-30" }))).status, 400);
    const path = `/1/journal/sessions/${s.id}/notes`;
    const saves = await Promise.all(["latest", "delayed"].map(notes => f.request(path, json("PUT", { revision: 0, notes }))));
    assert.deepEqual(saves.map(r => r.status).sort(), [200, 409]);
    const detail = await (await f.request(`/1/journal/sessions/${s.id}`)).json() as SessionDetail;
    assert.equal(detail.session.revision, 1);
    assert.equal(detail.session.title, "Renamed");
    assert.equal(detail.session.notes, "latest");
    assert.equal((await f.request(path, json("PUT", { revision: 0, notes: "stale" }))).status, 409);
    assert.equal((await f.request(path, json("PUT", { revision: 1, notes: "   " }))).status, 200);
    assert.equal((await f.request(path, json("PUT", { revision: 2, notes: "" }))).status, 200);
    assert.equal((await f.request(`/1/journal/sessions/${other.id}`, { method: "DELETE" })).status, 404);
    assert.equal((await f.request(`/1/journal/sessions/${s.id}`, { method: "DELETE" })).status, 204);
    assert.equal((await f.request(`/1/journal/sessions/${s.id}`)).status, 404);
    assert.equal((await f.request(`/2/journal/sessions/${other.id}`)).status, 200);
  } finally { await f.close(); }
});

test("legacy campaign deletion cannot indirectly erase private journals without authorization", async () => {
  const f = await fixture();
  try {
    await f.repo.createSession({ id: "private", campaignId: 1, title: "Private", date: "2026-10-26", notes: "secret", revision: 0, updatedAt: "" });
    assert.equal((await f.request("/1", { method: "DELETE" })).status, 403);
    for (const malformed of ["1junk", "1e2", "0x1", "1.5"]) {
      assert.equal((await f.request(`/${malformed}`, { method: "DELETE" })).status, 400);
    }
    assert.equal(f.repo.sessions.size, 1);
    assert.equal((await f.request("/2", { method: "DELETE" })).status, 404); // no journal; reaches legacy handler/catch-all
  } finally { await f.close(); }
});

test("immutable additive imports, stable correction ranges, per-occurrence and bulk reject/undo, independent edits", async () => {
  const f = await fixture(access);
  try {
    const s = await create(f), original = "Quil met Quil. Unknown Zarathrust stayed intact.";
    let item = await addImport(f, s.id, original);
    const second = await addImport(f, s.id, "A separate summary.");
    assert.equal(item.suggestions.length, 2);
    const decide = async (input: object, expected = 200) => {
      const res = await f.request(`/1/journal/sessions/${s.id}/imports/${item.id}/decisions`, json("POST", { revision: item.revision, ...input }));
      assert.equal(res.status, expected); if (expected === 200) item = await res.json() as JournalImport;
    };
    await decide({ suggestionId: item.suggestions[0].id, referenceKey: ref.key });
    assert.equal(item.reviewed, "Quill met Quil. Unknown Zarathrust stayed intact.");
    await decide({ suggestionId: item.suggestions[1].id, referenceKey: ref.key });
    assert.equal(item.reviewed, "Quill met Quill. Unknown Zarathrust stayed intact.");
    await decide({ suggestionId: item.suggestions[0].id, referenceKey: null, allMatching: true });
    assert.equal(item.reviewed, original);
    assert.equal(item.decisions.length, 2);
    await decide({ suggestionId: item.suggestions[0].id, referenceKey: null, allMatching: true, undo: true });
    assert.deepEqual(item.decisions, []);
    await decide({ suggestionId: item.suggestions[0].id, referenceKey: ref.key, allMatching: true });
    assert.match(item.reviewed, /^Quill met Quill/);
    f.repo.refs[0].name = "Renamed resource";
    const renamedRead = await (await f.request(`/1/journal/sessions/${s.id}`)).json() as SessionDetail;
    assert.match(renamedRead.imports.find(i => i.id === item.id)!.reviewed, /^Quill met Quill/);
    const editUrl = `/1/journal/sessions/${s.id}/imports/${item.id}/edit`;
    const edited = await f.request(editUrl, json("PUT", { revision: item.revision, text: "Deliberately edited reviewed copy" }));
    assert.equal(edited.status, 200); item = await edited.json() as JournalImport;
    assert.equal(item.original, original);
    assert.equal(item.reviewed, "Deliberately edited reviewed copy");
    await decide({ suggestionId: item.suggestions[0].id, referenceKey: null }, 409);
    const reset = await f.request(editUrl, json("PUT", { revision: item.revision, text: null }));
    item = await reset.json() as JournalImport; assert.match(item.reviewed, /^Quill met Quill/);
    assert.equal((await f.request(editUrl, json("PUT", { revision: item.revision, text: null, original: "overwrite" }))).status, 400);
    const all = await (await f.request(`/1/journal/sessions/${s.id}`)).json() as SessionDetail;
    assert.equal(all.imports.length, 2); assert.equal(all.session.notes, "");
    assert.equal(all.imports.find(i => i.id === item.id)?.original, original);
    assert.equal(all.imports.find(i => i.id === second.id)?.original, "A separate summary.");
    assert.equal((await f.request(`/2/journal/sessions/${s.id}/imports/${item.id}/decisions`, json("POST", { revision: item.revision, suggestionId: item.suggestions[0].id, referenceKey: ref.key }))).status, 404);
  } finally { await f.close(); }
});

test("conservative name matching handles phonetics, ambiguous identities, common prose and bounded ranges", () => {
  const refs = [ref, { ...ref, key: "creature:2", name: "Quell" }];
  const suggestions = suggestNames("Quil spoke. The fire was light. Quil again. Xyzzy remains.", refs, []);
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].confidence, "ambiguous");
  assert.equal(suggestions[0].candidates.length, 2);
  assert.equal(suggestNames("the and that fire light shield guard", [{ ...ref, name: "Fyre" }], []).length, 0);
  assert.equal(suggestNames("Quill knows Quill", [ref], []).length, 0);
  const sound = suggestNames("Katerin arrived.", [{ ...ref, name: "Katherine" }], []);
  assert.equal(sound.length, 1);
  const alias = suggestNames("the fire waits.", [ref], [{ id: "a", phrase: "the fire", referenceKey: ref.key }]);
  assert.equal(alias[0].confidence, "remembered");
  assert.equal(renderReviewed("Quil met Quil", suggestNames("Quil met Quil", [ref], []), [{ suggestionId: "0:4", referenceKey: ref.key }, { suggestionId: "9:13", referenceKey: ref.key }]), "Quill met Quill");
  const many = suggestNames("Quil ".repeat(900), [ref], []);
  assert.equal(many.length, 500);
  assert.throws(() => renderReviewed("Quil", [{ ...many[0], phrase: "Wrong" }], [{ suggestionId: many[0].id, referenceKey: ref.key }]), /Invalid correction range/);
});

test("aliases are explicit, campaign scoped, editable and conflicting aliases never replace silently", async () => {
  const f = await fixture(access);
  try {
    const s = await create(f);
    const added = await f.request("/1/journal/aliases", json("POST", { phrase: "kwil", referenceKey: ref.key }));
    assert.equal(added.status, 201); const alias = await added.json();
    assert.equal((await f.request("/1/journal/aliases", json("POST", { phrase: "KWIL", referenceKey: ref.key }))).status, 409);
    assert.equal((await f.request("/1/journal/aliases", json("POST", { phrase: "Zed", referenceKey: "other:999" }))).status, 400);
    f.repo.refs.push({ ...ref, key: "creature:4", name: "Wren" });
    assert.equal((await f.request("/1/journal/aliases", json("POST", { phrase: "Wren", referenceKey: ref.key }))).status, 409);
    let item = await addImport(f, s.id, "kwil arrived.");
    assert.equal(item.suggestions[0].confidence, "remembered"); assert.equal(item.reviewed, item.original);
    assert.deepEqual(await (await f.request("/2/journal/aliases")).json(), []);
    assert.equal((await f.request(`/2/journal/aliases/${alias.id}`, json("PATCH", { phrase: "kweel", referenceKey: ref.key }))).status, 409);
    assert.equal((await f.request(`/1/journal/aliases/${alias.id}`, json("PATCH", { phrase: "kweel", referenceKey: ref.key }))).status, 200);
    assert.equal((await f.request(`/1/journal/aliases/${alias.id}`, { method: "DELETE" })).status, 204);
    item = await addImport(f, s.id, "kweel arrived."); assert.equal(item.suggestions.length, 0);
  } finally { await f.close(); }
});

test("linked resource authorization is checked on every reference, alias and cached correction response", async () => {
  let allowLinked = true;
  const policy: JournalAccess = {
    authorizeCampaign: async (_r, c) => c === 1,
    authorizeReference: async (_r, _c, r) => r.campaignId === 1 || (allowLinked && r.key === "item:2"),
  };
  const f = await fixture(policy);
  try {
    f.repo.refs.push({ key: "item:2", name: "Silverthorn", source: "Explicit link", campaignId: 2 },
      { key: "item:3", name: "Secretartifact", source: "Other campaign", campaignId: 3 });
    let refs = await (await f.request("/1/journal/references")).json() as Reference[];
    assert.deepEqual(refs.map(r => r.key), ["character:1", "item:2"]);
    const s = await create(f);
    let item = await addImport(f, s.id, "Silverthron was found. Secretartifect was not indexed.");
    assert.equal(item.suggestions.length, 1);
    assert.equal(item.suggestions[0].candidates[0].key, "item:2");
    const res = await f.request(`/1/journal/sessions/${s.id}/imports/${item.id}/decisions`, json("POST", { revision: 0, suggestionId: item.suggestions[0].id, referenceKey: "item:2" }));
    item = await res.json() as JournalImport; assert.match(item.reviewed, /^Silverthorn/);
    assert.equal((await f.request("/1/journal/aliases", json("POST", { phrase: "silver thron", referenceKey: "item:2" }))).status, 201);
    allowLinked = false;
    const detail = await (await f.request(`/1/journal/sessions/${s.id}`)).json() as SessionDetail;
    assert.equal(detail.imports[0].suggestions.length, 0);
    assert.equal(detail.imports[0].reviewed, detail.imports[0].original);
    assert.deepEqual(await (await f.request("/1/journal/aliases")).json(), []);
    assert.equal((await f.request("/1/journal/aliases", json("POST", { phrase: "silver thron", referenceKey: "item:2" }))).status, 400);
  } finally { await f.close(); }
});

test("text and Markdown imports validate size, encoding, format, unsafe text and remain literal rather than executable", async () => {
  const encode = (s: string) => new TextEncoder().encode(s);
  assert.equal(decodeTextFile(encode("# Summary\r\nQuil"), "echo.md"), "# Summary\r\nQuil");
  assert.throws(() => decodeTextFile(encode("x"), "echo.pdf"), /Only UTF-8/);
  assert.throws(() => decodeTextFile(Uint8Array.from([255, 254, 0]), "echo.txt"), /not valid UTF-8/);
  assert.throws(() => decodeTextFile(encode("a\u0000b"), "echo.txt"), /valid UTF-8/);
  assert.throws(() => decodeTextFile(new Uint8Array(MAX_TEXT_BYTES + 1), "echo.md"), /256 KiB/);
  const unsafe = '# <script>alert(1)</script>\n\n[click](javascript:alert(1))\n- <img src=x onerror=alert(1)>\n**bold**';
  const markup = renderToStaticMarkup(React.createElement(SafeMarkdown, { text: unsafe }));
  assert.ok(!markup.includes("<script>")); assert.ok(!markup.includes("<img"));
  assert.ok(!markup.includes('href="javascript:')); assert.ok(markup.includes("&lt;script&gt;"));
  assert.ok(markup.includes("<strong>bold</strong>"));
  const f = await fixture(access);
  try {
    const s = await create(f), url = `/1/journal/sessions/${s.id}/imports/file`;
    const upload = (name: string, body: Uint8Array) => f.request(url, { method: "POST", headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(name) }, body });
    assert.equal((await upload("echo.md", encode(unsafe))).status, 201);
    assert.equal((await upload("echo.pdf", encode("Not a transcript"))).status, 400);
    assert.equal((await upload("echo.txt", Uint8Array.from([255]))).status, 400);
    assert.equal((await upload("echo.txt", new Uint8Array(MAX_TEXT_BYTES + 1))).status, 413);
    assert.equal((await upload("../private.txt", encode("x"))).status, 400);
    const res = await f.request(`/1/journal/sessions/${s.id}/imports`, json("POST", { title: "x", kind: "summary", format: "markdown", text: "😀".repeat(MAX_TEXT_BYTES / 3) }));
    assert.equal(res.status, 400);
    const detail = await (await f.request(`/1/journal/sessions/${s.id}`)).json() as SessionDetail;
    assert.equal(detail.imports[0].original, unsafe);
  } finally { await f.close(); }
});

test("private audio validates type/size, safely retries, supports ranges and delete cascades without leaking bytes", async () => {
  const wav = Buffer.from("RIFF0000WAVEfmt synthetic-not-a-real-session");
  assert.doesNotThrow(() => validateAudio(wav, "audio/wav"));
  assert.throws(() => validateAudio(wav, "audio/mpeg"), /Unsupported/);
  assert.throws(() => validateAudio(new Uint8Array(MAX_AUDIO_BYTES + 1), "audio/wav"), /20 MiB/);
  const f = await fixture(access);
  try {
    const s = await create(f), other = await create(f), id = randomUUID();
    const path = `/1/journal/sessions/${s.id}/recordings`;
    const send = (body: Buffer, type = "audio/wav", uploadId = id) => f.request(path, { method: "POST", headers: { "content-type": type, "x-upload-id": uploadId, "x-file-name": "synthetic.wav" }, body });
    const first = await send(wav); assert.equal(first.status, 201);
    const metadata = await first.json(); assert.equal(metadata.bytes, undefined); assert.equal(metadata.digest, undefined);
    assert.equal((await send(wav)).status, 201);
    assert.equal(f.repo.audio.size, 1);
    assert.equal((await send(Buffer.concat([wav, Buffer.from("changed")]))).status, 409);
    assert.equal((await send(Buffer.from("<html>unsafe"), "audio/wav", randomUUID())).status, 400);
    const url = `${path}/${id}`;
    const full = await f.request(url); assert.equal(full.status, 200); assert.match(full.headers.get("cache-control")!, /no-store/);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), wav);
    const range = await f.request(url, { headers: { range: "bytes=0-3" } }); assert.equal(range.status, 206); assert.equal(await range.text(), "RIFF");
    assert.equal((await f.request(url, { headers: { range: "bytes=9999-" } })).status, 416);
    assert.equal((await f.request(`/2/journal/sessions/${s.id}/recordings/${id}`)).status, 404);
    assert.equal((await f.request(`/1/journal/sessions/${other.id}/recordings/${id}`)).status, 404);
    assert.equal((await f.request(`/3/journal/sessions/${s.id}/recordings/${id}`)).status, 403);
    assert.equal((await f.request(url, { method: "DELETE" })).status, 204);
    assert.equal((await f.request(url)).status, 404);
    await send(wav);
    await f.request(`/1/journal/sessions/${s.id}`, { method: "DELETE" });
    assert.equal(f.repo.audio.size, 0);
  } finally { await f.close(); }
});

test("autosave serializes revisions, refuses dirty scope switches and retains failed drafts", async () => {
  let resolve!: (value: SaveResult) => void;
  const writes: SavePayload[] = [], states: string[] = [];
  const c = new AutosaveCoordinator(payload => { writes.push(payload); return new Promise(r => { resolve = r; }); }, s => states.push(s), 100000);
  assert.equal(c.setScope("1:session-a", 0, ""), true);
  c.edit("first");
  const pending = c.flush();
  assert.equal(c.setScope("2:session-b", 0, "private-b"), false);
  c.edit("second");
  resolve({ revision: 1, notes: "first" }); await pending;
  assert.equal(c.isDirty, true); assert.equal(c.currentRevision, 1);
  const second = c.flush();
  assert.deepEqual(writes.map(w => [w.scope, w.revision, w.notes]), [["1:session-a", 0, "first"], ["1:session-a", 1, "second"]]);
  resolve({ revision: 2, notes: "second" }); await second;
  assert.equal(c.isDirty, false);
  assert.equal(c.setScope("2:session-b", 8, "private-b"), true);
  assert.equal(c.currentValue, "private-b"); assert.equal(c.currentRevision, 8);
  assert.ok(states.includes("saving")); assert.equal(states.at(-1), "saved"); c.dispose();
  let fail = true;
  const f = new AutosaveCoordinator(async p => { if (fail) throw new Error("409 revision conflict"); return { revision: p.revision + 1, notes: p.notes }; }, () => {}, 100000);
  f.setScope("1:a", 0, "saved"); f.edit("unsaved"); await f.flush();
  assert.equal(f.currentStatus, "failed"); assert.equal(f.currentValue, "unsaved");
  assert.equal(f.setScope("2:b", 0, ""), false);
  fail = false; await f.reconcile(4);
  assert.equal(f.currentRevision, 5); assert.equal(f.currentStatus, "saved"); f.dispose();
});
