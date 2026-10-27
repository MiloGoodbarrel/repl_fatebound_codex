import test from "node:test";
import assert from "node:assert/strict";

test("account transitions abort requests, remove legacy campaign cache, and block queued autosaves", async () => {
  const sent: { headers: Headers; signal: AbortSignal }[] = [];
  let removed = "";
  const realWindow = globalThis.window;
  const realStorage = globalThis.localStorage;
  Object.assign(globalThis, { localStorage: { removeItem: (key: string) => { removed = key; } }, window: {
    location: { origin: "https://codex.example.invalid" },
    fetch: async (_url: unknown, init: RequestInit) => {
      sent.push({ headers: new Headers(init.headers), signal: init.signal! });
      return new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Closed", "AbortError"))));
    },
  } });
  try {
    const { activateWorkspace, closeWorkspace } = await import("../client/src/lib/workspaceRequests");
    activateWorkspace("alice");
    const pending = window.fetch("/api/campaigns/1/encounter", { method: "PUT" });
    assert.equal(sent[0].headers.get("x-workspace-user"), "alice");
    closeWorkspace();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(removed, "activeCampaign");
    await assert.rejects(window.fetch("/api/campaigns/1/encounter", { method: "PUT" }), { name: "AbortError" });
    assert.equal(sent.length, 1);
  } finally { Object.assign(globalThis, { window: realWindow, localStorage: realStorage }); }
});
