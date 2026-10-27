import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { apiPolicy } from "../server/auth/policy";
import { actorContext } from "../server/auth/context";
import { registerJournalRoutes } from "../server/journal/routes";
import { MemoryJournalRepository } from "./journal-fixtures";

test("account policy blocks direct, body, query, character, table, link, file and admin attacks", async () => {
  const owner = new Map([[1, "alice"], [2, "bob"], [3, "alice"], [4, null]]);
  const app = express();
  app.use(express.json());
  app.use("/api", apiPolicy(async req => {
    // Test-only injected verifier; production exclusively calls Clerk getAuth.
    const id = req.get("test-identity");
    return id ? { userId: id, admin: id === "creator" } : null;
  }, {
    campaignOwner: async id => owner.get(id) ?? null,
    characterCampaign: async id => id === 20 ? 2 : 1,
    tableCampaign: async id => id === 30 ? 2 : 1,
  }));
  app.all("/api/*", (_req, res) => res.json({ actor: actorContext.getStore()?.userId }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function request(path: string, method = "GET", actor: string | null = "alice", body?: object, headers?: Record<string, string>) {
    return fetch(origin + "/api" + path, { method, headers: {
      Origin: origin, ...(actor ? { "test-identity": actor } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers,
    }, body: body ? JSON.stringify(body) : undefined });
  }
  try {
    for (const path of ["/campaigns", "/campaigns/1/encounter", "/roll-tables", "/account"]) {
      assert.equal((await request(path, "GET", null)).status, 401, path);
    }
    for (const path of [
      "/campaigns/2/items", "/campaigns/2/characters", "/campaigns/2/encounter",
      "/campaigns/2/prepared-encounters", "/campaigns/2/homebrew-bestiary",
      "/campaigns/2/journal/sessions/guess/recordings/guess",
      "/campaigns/4", "/campaigns/1e2/items", "/campaigns/01/items",
      "/campaigns/characters/20", "/roll-tables/30?campaignId=1", "/roll-tables?campaignId=2",
    ]) {
      assert.equal((await request(path)).status, 404, path);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await request("/campaigns/2", method)).status, 404, method);
    }
    assert.equal((await request("/items/draw", "POST", "alice", { campaignId: 2 })).status, 404);
    assert.equal((await request("/campaigns/1/resources/links", "POST", "alice", { sourceCampaignId: 2 })).status, 404);
    assert.equal((await request("/campaigns/1/resources/links", "POST", "alice", { sourceCampaignId: 3 })).status, 200);
    assert.equal((await request("/campaigns/characters/10", "PATCH", "alice", { campaignId: 2 })).status, 400);
    assert.equal((await request("/admin/seed-loot/5e", "POST")).status, 403);
    assert.equal((await request("/items/5e", "DELETE")).status, 403);
    assert.equal((await request("/admin/seed-loot/5e", "POST", "creator")).status, 200);
    assert.equal((await request("/campaigns/1/encounter", "PUT", "alice", {}, { Origin: "https://attacker.invalid" })).status, 403);
    assert.equal((await request("/campaigns/1/encounter", "PUT", "bob", {}, { "X-Workspace-User": "alice" })).status, 409);
    assert.equal((await request("/unknown-private-module")).status, 404);
    const a = await request("/campaigns/1/encounter");
    assert.equal(a.status, 200); assert.equal((await a.json()).actor, "alice");
    assert.equal(a.headers.get("cache-control"), "private, no-store");
    assert.equal((await request("/campaigns/2/encounter", "GET", "bob")).status, 200);
    assert.equal((await request("/bestiary/types", "GET", null)).status, 200);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
