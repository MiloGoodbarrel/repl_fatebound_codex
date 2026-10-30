import test from "node:test";
import assert from "node:assert/strict";
import { WorkspaceDemoApi, installDemoTransport, type DemoStorage } from "../client/src/demo/workspaceApi";
import { WORKSPACE_DEMO_KEY, createWorkspaceDemo } from "../client/src/demo/workspaceData";
import { emptySummarySections } from "../shared/sessionSummary";

function setup() {
  const map = new Map<string, string>();
  const storage: DemoStorage = { getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
  const stockCalls: string[] = [];
  const api = new WorkspaceDemoApi(storage, () => {}, async path => {
    stockCalls.push(path);
    if (path === "/api/items/5e") return [
      { id: 9001, name: "Stock potion", category: "Potion", rarity: "Common", edition: "5e", source: "DMG" },
      { id: 9002, name: "Stock scroll", category: "Scroll", rarity: "Very rare", edition: "5e", source: "PHB" },
    ];
    if (path === "/api/items/5e/sources") return ["DMG", "PHB"];
    if (path.includes("/bestiary/")) return [];
    throw new Error(`Unexpected stock read: ${path}`);
  });
  const send = async (path: string, method = "GET", body?: unknown) => {
    const response = await api.request(new URL(path, "https://demo.test"), method, body);
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  return { api, send, storage, map, stockCalls };
}

test("real-screen demo API keeps campaign CRUD, party, saves, prepared groups and appearance browser-only", async () => {
  const { api, send, map, storage } = setup();
  map.set("activeCampaign", "private sentinel");
  const created = await send("/api/campaigns", "POST", { name: "QA fixture" });
  assert.equal(created.data.edition, "5e");
  const cid = created.data.id;
  assert.equal((await send(`/api/campaigns/${cid}/characters`, "POST", { name: "QA Hero", maxHp: 25, ac: 15 })).status, 200);
  assert.equal((await send(`/api/campaigns/${cid}/characters`)).data[0].name, "QA Hero");
  const saved = { combatants: [], round: 5, activeIndex: 0 };
  await send(`/api/campaigns/${cid}/encounter`, "PUT", saved);
  assert.deepEqual((await send(`/api/campaigns/${cid}/encounter`)).data.data, saved);
  const prepared = (await send("/api/campaigns/1/prepared-encounters")).data[0];
  const group = prepared.data.combatants.find((c: any) => c.isGroup);
  assert.deepEqual(group.memberHp, [18, 18, 18]);
  group.memberHp.push(18);
  await send(`/api/campaigns/1/prepared-encounters/${prepared.id}`, "PUT", { data: prepared.data });
  assert.equal((await send("/api/campaigns/1/prepared-encounters")).data[0].data.combatants.find((c: any) => c.isGroup).memberHp.length, 4);
  const appearance = { skin: "illuskian", mode: "light" };
  await send("/api/account/appearance", "PUT", appearance);
  const reloaded = new WorkspaceDemoApi(storage);
  assert.deepEqual(await (await reloaded.request(new URL("https://demo.test/api/account/appearance"))).json(), appearance);
  await send(`/api/campaigns/${cid}`, "DELETE");
  assert.equal((await send(`/api/campaigns/${cid}/characters`)).status, 404);
  await api.reset();
  assert.equal(map.get("activeCampaign"), "private sentinel");
  assert.equal(JSON.parse(map.get(WORKSPACE_DEMO_KEY)!).campaigns.length, 2);
});

test("linked resources reference originals and never link encounters; loot and bestiary filters apply", async () => {
  const { send } = setup();
  const linked = await send("/api/campaigns/1/resources/links", "POST", { sourceCampaignId: 2, itemIds: [301], npcIds: [] });
  assert.equal(linked.data.linkedItems, 1);
  assert.equal((await send("/api/campaigns/1/items")).data.find((i: any) => i.id === 301).linkedSource.campaignId, 2);
  assert.equal((await send("/api/campaigns/1/resources/links", "POST", { sourceCampaignId: 2, itemIds: [301], npcIds: [] })).data.existingItems, 1);
  const items = await send("/api/items/draw", "POST", { source: "campaign", campaignId: 1,
    categories: ["Wondrous Item"], rarities: ["Common"], count: 3 });
  assert.equal(items.data.length, 1);
  assert.ok(items.data.every((i: any) => i.name === "Star Chart Compass"));
  const links = (await send("/api/campaigns/1/resources")).data.links;
  await send(`/api/campaigns/1/resources/links/${links[0].id}`, "DELETE");
  assert.equal((await send("/api/campaigns/2/items")).data.length, 1);
  assert.equal((await send("/api/bestiary/monsters?search=guardian")).data.length, 0);
  assert.equal((await send("/api/bestiary/monsters?cr=20")).data.length, 0);
  assert.equal((await send("/api/bestiary/monsters?types=dragon")).data.length, 0);
});

test("shared table schema validation and campaign scoping are preserved", async () => {
  const { send } = setup();
  const body = { campaignId: 1, name: "QA omens", category: "Omens", mode: "weighted", entries: [{ text: "Snow rises", weight: 2 }] };
  const created = await send("/api/roll-tables", "POST", body);
  assert.equal(created.status, 200);
  assert.equal(created.data.entries[0].entryOrder, 0);
  assert.ok((await send("/api/roll-tables?campaignId=1")).data.some((t: any) => t.id === created.data.id));
  assert.ok(!(await send("/api/roll-tables?campaignId=2")).data.some((t: any) => t.id === created.data.id));
  assert.equal((await send("/api/roll-tables", "POST", { ...body, entries: [{ text: "", weight: 0 }] })).status, 400);
  assert.equal((await send(`/api/roll-tables/${created.data.id}?campaignId=2`, "DELETE")).status, 404);
});

test("demo reads the full shared library, keeps its filters, and never rewrites stock", async () => {
  const { send, stockCalls } = setup();
  assert.deepEqual((await send("/api/items/5e/sources")).data, ["DMG", "PHB"]);
  assert.equal((await send("/api/items/5e")).data.length, 2);
  const draw = (options: object) => send("/api/items/draw", "POST", {
    source: "5e", categories: ["Potion", "Scroll"], rarities: ["Common", "Very Rare"],
    editions: ["5e"], count: 100, ...options,
  });
  assert.deepEqual((await draw({ sources: ["PHB"] })).data.map((i: any) => i.name), ["Stock scroll"]);
  assert.equal((await draw({ editions: ["4e"] })).data.length, 0);
  assert.equal((await draw({ sources: [] })).data.length, 0);
  assert.equal((await draw({ search: "potion" })).data.length, 1);
  assert.equal(stockCalls.filter(p => p === "/api/items/5e").length, 1, "Read-only stock deck is fetched once, not per draw");
  const path = "/api/bestiary/monsters?search=dragon&types=Dragon&sources=Monster%20Manual&cr=5";
  await send(path);
  assert.ok(stockCalls.includes(path), "All bestiary filters must reach the stock-only reader");
  const before = stockCalls.length;
  assert.equal((await send("/api/items/5e", "DELETE")).status, 403);
  assert.equal((await send("/api/bestiary/monsters/secret", "POST")).status, 403);
  assert.equal((await send("/api/bestiary/campaigns/1")).status, 404);
  assert.equal(stockCalls.length, before);
});

test("journal uses real name-review helpers, immutable originals, revision conflicts, summary approval and restore", async () => {
  const { send } = setup();
  const base = "/api/campaigns/1/journal";
  const created = (await send(`${base}/sessions`, "POST", { title: "QA night", date: "2026-10-30" })).data;
  const path = `${base}/sessions/${created.id}`;
  assert.equal((await send(`${path}/notes`, "PUT", { revision: 0, notes: "Mira reached the lighthouse." })).data.revision, 1);
  assert.equal((await send(`${path}/notes`, "PUT", { revision: 0, notes: "Stale draft" })).status, 409);
  const refs = (await send(`${base}/references`)).data;
  const mira = refs.find((r: any) => r.name === "Mira Flint");
  await send(`${base}/aliases`, "POST", { phrase: "Meera Flint", referenceKey: mira.key });
  const imported = (await send(`${path}/imports`, "POST", { title: "Fictional text", kind: "transcript", format: "text", text: "Meera Flint met Keeper Vela." })).data;
  assert.equal(imported.suggestions.length, 1);
  const reviewed = (await send(`${path}/imports/${imported.id}/decisions`, "POST",
    { revision: 0, suggestionId: imported.suggestions[0].id, referenceKey: mira.key })).data;
  assert.equal(reviewed.reviewed, "Mira Flint met Keeper Vela.");
  assert.equal(reviewed.original, "Meera Flint met Keeper Vela.");
  const state = (await send(`${path}/summary`)).data;
  const sections = emptySummarySections();
  sections[0].text = "The party reached the lighthouse.";
  sections[0].sourceIds = [state.sources[0].id];
  const approved = await send(`${path}/summary`, "POST", {
    expectedRevision: 0, sourceFingerprint: state.sourceFingerprint, action: "approve", sections,
  });
  assert.equal(approved.data.approved.revision, 1);
  assert.equal((await send(`${path}/summary`, "POST", {
    expectedRevision: 0, sourceFingerprint: state.sourceFingerprint, action: "save", sections,
  })).status, 409);
  const restored = await send(`${path}/summary/restore`, "POST", {
    expectedRevision: 1, sourceFingerprint: state.sourceFingerprint, revision: 1,
  });
  assert.equal(restored.data.current.revision, 2);
  assert.equal(restored.data.current.action, "restore");
  assert.equal((await send(`${path}/summary/history`)).data.length, 2);
});

test("unknown APIs, provider calls, uploads and admin actions fail closed without fetching", async () => {
  const { send } = setup();
  for (const [path, method] of [
    ["/api/unknown", "GET"], ["/api/__clerk/v1/client", "GET"],
    ["/api/admin/seed-loot/5e", "POST"], ["/api/account/data", "DELETE"],
    ["/api/campaigns/1/journal/sessions/demo-session-lighthouse/recordings", "POST"],
    ["/api/campaigns/1/journal/sessions/demo-session-lighthouse/imports/file", "POST"],
  ]) assert.equal((await send(path, method)).status, 403, path);
});

test("corrupt, oversized or unavailable storage fails explicitly, not as a successful save", async () => {
  const { map, storage } = setup();
  map.set(WORKSPACE_DEMO_KEY, "{");
  let api = new WorkspaceDemoApi(storage);
  assert.equal((await api.request(new URL("https://demo.test/api/campaigns"))).status, 507);
  await api.reset();
  assert.equal((await api.request(new URL("https://demo.test/api/campaigns"))).status, 200);
  map.set(WORKSPACE_DEMO_KEY, "x".repeat(1024 * 1024 + 1));
  api = new WorkspaceDemoApi(storage);
  assert.equal((await api.request(new URL("https://demo.test/api/campaigns"))).status, 507);
  api = new WorkspaceDemoApi({ getItem: () => null, setItem: () => { throw new Error("Storage denied"); }, removeItem: () => {} });
  const response = await api.request(new URL("https://demo.test/api/campaigns"), "POST", { name: "Cannot save" });
  assert.equal(response.status, 507);
  assert.equal(createWorkspaceDemo().campaigns.length, 2);
});

test("demo transport never forwards API calls, even during teardown or with a Request object", async () => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  let networkRequests = 0;
  const fakeWindow = {
    location: { href: "https://demo.test/dev", origin: "https://demo.test" },
    fetch: async (_input: RequestInfo | URL, _init?: RequestInit) => { networkRequests++; return new Response("asset"); },
  };
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
  Object.defineProperty(globalThis, "document", { value: { addEventListener: () => {} }, configurable: true });
  try {
    const { api } = setup();
    const teardown = installDemoTransport(api);
    const intercepted = await fakeWindow.fetch(new Request("https://demo.test/api/campaigns", {
      method: "POST", body: JSON.stringify({ name: "Request-object fixture" }),
    }));
    assert.equal(intercepted.status, 200);
    assert.equal((await intercepted.json()).name, "Request-object fixture");
    assert.equal((await fakeWindow.fetch("/api/account/data", { method: "DELETE" })).status, 403);
    assert.equal((await fakeWindow.fetch("https://other.test/api/campaigns")).status, 403);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(() => fakeWindow.fetch("/api/campaigns", { signal: controller.signal }), { name: "AbortError" });
    teardown();
    assert.equal((await fakeWindow.fetch("/api/campaigns/1/encounter", { method: "PUT" })).status, 403);
    assert.equal(networkRequests, 0);
    const nextTeardown = installDemoTransport(api);
    assert.equal((await fakeWindow.fetch("/api/campaigns")).status, 200);
    nextTeardown();
    await fakeWindow.fetch("/static/example.svg");
    assert.equal(networkRequests, 1, "Only non-API static requests may reach the original transport");
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, "window", savedWindow); else Reflect.deleteProperty(globalThis, "window");
    if (savedDocument) Object.defineProperty(globalThis, "document", savedDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
