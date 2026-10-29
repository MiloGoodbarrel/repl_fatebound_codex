import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { registerJournalRoutes } from "../server/journal/routes";
import { MemoryJournalRepository } from "./journal-fixtures";
import { MemorySummaryRepository } from "./summary-fixtures";
import { emptySummarySections, sectionsSchema, type SummaryState } from "../shared/sessionSummary";
import { nextSummaryVersion, summarySources } from "../server/journal/summary";

async function fixture(authorized = true) {
  const repo = new MemoryJournalRepository(), summaries = new MemorySummaryRepository(repo);
  for (const campaignId of [1, 2]) await repo.createSession({
    id: `session-${campaignId}`, campaignId, title: `Session ${campaignId}`, date: "2026-10-29",
    notes: `Campaign ${campaignId} private notes`, revision: 0, updatedAt: "",
  });
  const app = express();
  registerJournalRoutes(app, repo, authorized ? { authorizeCampaign: async (_req, id) => id === 1 } : undefined, summaries);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/campaigns`;
  const request = (suffix = "/1/journal/sessions/session-1/summary", method = "GET", body?: unknown) =>
    fetch(base + suffix, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  return {
    repo, summaries, request,
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }),
  };
}
const path = "/1/journal/sessions/session-1/summary";
test("summary endpoints deny unauthorized campaigns before reads or body parsing", async () => {
  const f = await fixture(false);
  try {
    f.summaries.load = async () => { throw new Error("Must not read"); };
    for (const [method, suffix] of [["GET", ""], ["POST", ""], ["GET", "/history"], ["GET", "/history/1"], ["POST", "/restore"]]) {
      const response = await f.request(path + suffix, method, method === "POST" ? { invalid: true } : undefined);
      assert.equal(response.status, 403);
      assert.match(response.headers.get("cache-control")!, /no-store/);
    }
  } finally { await f.close(); }
});
test("summary drafts, approvals, locks, annotations, historical snapshots and restore persist separately", async () => {
  const f = await fixture();
  try {
    const first = await (await f.request()).json() as SummaryState;
    assert.equal(first.current, null);
    assert.equal(first.ai.available, false);
    const sections = emptySummarySections();
    sections[0] = { ...sections[0], text: "The party reached the lighthouse.", annotation: "Do not reveal the keeper's secret.", locked: true, sourceIds: [first.sources[0].id] };
    let result = await f.request(path, "POST", { expectedRevision: 0, sourceFingerprint: first.sourceFingerprint, action: "save", sections });
    assert.equal(result.status, 200);
    let state = await result.json() as SummaryState;
    assert.equal(state.current?.revision, 1);
    assert.equal(state.current?.status, "draft");
    assert.deepEqual(state.current?.sections, sections);
    result = await f.request(path, "POST", { expectedRevision: 1, sourceFingerprint: state.sourceFingerprint, action: "approve", sections });
    state = await result.json() as SummaryState;
    assert.equal(state.approved?.revision, 2);
    await f.repo.saveNotes(1, "session-1", 0, "New note, not the old citation.");
    state = await (await f.request()).json() as SummaryState;
    assert.equal(state.stale, true);
    assert.equal(state.current?.sources[0].text, "Campaign 1 private notes");
    assert.equal(state.sources[0].text, "New note, not the old citation.");
    const newer = structuredClone(sections);
    newer[0].text = "Manually revised, locked sections remain explicitly editable.";
    result = await f.request(path, "POST", { expectedRevision: 2, sourceFingerprint: state.sourceFingerprint, action: "save", sections: newer });
    state = await result.json() as SummaryState;
    assert.equal(state.approved?.revision, 2);
    assert.equal(state.current?.revision, 3);
    result = await f.request(path + "/restore", "POST", { expectedRevision: 3, sourceFingerprint: state.sourceFingerprint, revision: 1 });
    state = await result.json() as SummaryState;
    assert.equal(state.current?.revision, 4);
    assert.equal(state.current?.status, "draft");
    assert.equal(state.current?.restoredFrom, 1);
    assert.deepEqual(state.current?.sections, sections);
    assert.equal(state.approved?.revision, 2);
    const history = await (await f.request(path + "/history")).json();
    assert.deepEqual(history.map((v: any) => v.revision), [4, 3, 2, 1]);
    assert.equal("sections" in history[0], false);
    const originalVersion = await (await f.request(path + "/history/1")).json();
    assert.equal(originalVersion.sections[0].text, sections[0].text);
    assert.equal(originalVersion.sources[0].text, "Campaign 1 private notes");
  } finally { await f.close(); }
});
test("summary writes reject stale revisions, stale sources, forged citations and malformed sections", async () => {
  const f = await fixture();
  try {
    const state = await (await f.request()).json() as SummaryState;
    const sections = emptySummarySections();
    const body = { expectedRevision: 0, sourceFingerprint: state.sourceFingerprint, action: "save", sections };
    const writes = await Promise.all([f.request(path, "POST", body), f.request(path, "POST", body)]);
    assert.deepEqual(writes.map(value => value.status).sort(), [200, 409]);
    assert.equal((await f.request(path, "POST", { ...body, expectedRevision: 1, action: "approve" })).status, 400, "empty summaries cannot be approved");
    sections[0].sourceIds = ["import:another-campaign@0"];
    assert.equal((await f.request(path, "POST", { ...body, expectedRevision: 1, sections })).status, 400);
    sections[0].sourceIds = [];
    await f.repo.saveNotes(1, "session-1", 0, "Changed");
    assert.equal((await f.request(path, "POST", { ...body, expectedRevision: 1 })).status, 409);
    assert.equal((await f.request("/2/journal/sessions/session-2/summary")).status, 403);
    assert.equal((await f.request("/1/journal/sessions/session-2/summary")).status, 404);
    assert.equal((await f.request(path + "/history/1e1")).status, 400);
    assert.equal((await f.request(path + "/history/999")).status, 404);
    assert.equal((await f.request(path, "POST", { ...body, extra: true })).status, 400);
    assert.equal(sectionsSchema.safeParse([...sections.slice(0, 8), sections[0]]).success, false);
  } finally { await f.close(); }
});
test("summary source fingerprints include review changes but citation snapshots keep imported originals", async () => {
  const session = { id: "s", campaignId: 1, title: "T", date: "2026-10-29", notes: "", revision: 0, updatedAt: "" };
  const source = { id: "import", sessionId: "s", title: "Echo", kind: "transcript" as const, format: "text" as const, original: "Quil arrived.", suggestions: [], decisions: [], editedText: null as string | null, revision: 0 };
  const before = summarySources(session, [source]);
  const after = summarySources(session, [{ ...source, revision: 1, editedText: "Quill arrived." }]);
  assert.notEqual(before.sourceFingerprint, after.sourceFingerprint);
  assert.equal(after.sources[0].text, "Quil arrived.");
  const sections = emptySummarySections(); sections[0].text = "Source-backed"; sections[0].sourceIds = [after.sources[0].id];
  const result = nextSummaryVersion("s", { expectedRevision: 0, sourceFingerprint: after.sourceFingerprint, action: "save", sections }, null, after);
  assert.equal(result.sources[0].text, source.original);
  assert.equal(source.editedText, null);
});
