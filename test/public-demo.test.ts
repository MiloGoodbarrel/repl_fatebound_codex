import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../client/src/demo/fixtures";
import { DEMO_MAX_BYTES, DEMO_STORAGE_KEY, drawWeighted, isDemoPath, parseDemoState } from "../client/src/demo/model";
import { isDemoDocument } from "../shared/demoPath";

test("public demo fixtures are valid, original, independent snapshots", () => {
  const one = createDemoState(), two = createDemoState();
  assert.deepEqual(parseDemoState(JSON.stringify(one)), one);
  one.sessions[0].notes = "Changed only this fixture";
  one.sessions[0].sections[0].text = "Changed draft";
  assert.notEqual(one.sessions[0].notes, two.sessions[0].notes);
  assert.notEqual(one.sessions[0].sections[0].text, one.sessions[0].versions[0].sections[0].text);
  for (const c of one.campaigns) assert.ok(c.id.startsWith("demo-"));
  assert.notEqual(DEMO_STORAGE_KEY, "activeCampaign");
});
test("demo parser refuses live campaign IDs, broken references, malformed state, and oversized snapshots", () => {
  const state = createDemoState();
  assert.throws(() => parseDemoState("{"));
  assert.throws(() => parseDemoState(JSON.stringify({ ...state, activeCampaignId: "42" })));
  assert.throws(() => parseDemoState(JSON.stringify({ ...state, activeCampaignId: "demo-no-such-campaign" })));
  assert.throws(() => parseDemoState(JSON.stringify({ ...state, lootDraw: ["demo-no-such-item"] })));
  state.encounters[0].members[0].count = 0;
  assert.throws(() => parseDemoState(JSON.stringify(state)));
  assert.throws(() => parseDemoState(" ".repeat(DEMO_MAX_BYTES + 1)));
});
test("weighted demo rolls cover each exact interval and reject invalid randomness", () => {
  const entries = [{ id: "demo-a", weight: 2 }, { id: "demo-b", weight: 1 }];
  assert.deepEqual(drawWeighted(entries, 0), { entryId: "demo-a", roll: 1 });
  assert.deepEqual(drawWeighted(entries, .5), { entryId: "demo-a", roll: 2 });
  assert.deepEqual(drawWeighted(entries, .999), { entryId: "demo-b", roll: 3 });
  assert.throws(() => drawWeighted([], 0));
  assert.throws(() => drawWeighted(entries, 1));
});
test("only /dev and its descendants enter demo mode, including a deployment base path", () => {
  for (const path of ["/dev", "/dev/", "/dev/sessions", "/dev/settings"]) assert.equal(isDemoPath(path), true);
  for (const path of ["/developer", "/devil", "/campaigns", "/api/dev", "/sessions"]) assert.equal(isDemoPath(path), false);
  assert.equal(isDemoPath("/codex/dev/loot", "/codex"), true);
  assert.equal(isDemoPath("/dev", "/codex"), false);
  assert.equal(isDemoDocument("GET", "/dev/sessions"), true);
  assert.equal(isDemoDocument("HEAD", "/dev"), true);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(isDemoDocument(method, "/dev"), false);
  for (const path of ["/api/campaigns", "/api/dev", "/developer", "/sessions", "/__clerk/v1/client"]) assert.equal(isDemoDocument("GET", path), false);
});
