import { appearanceSchema } from "@shared/appearance";
import { drawOptionsSchema, insertCampaignSchema, insertCampaignCharacterSchema, rollTableInputSchema } from "@shared/schema";
import { STOCK_ROLL_TABLES } from "@shared/rollTables";
import { DemoApiError, journalApi, missing } from "./journalApi";
import { createWorkspaceDemo, validateWorkspaceDemo, WORKSPACE_DEMO_KEY, type WorkspaceDemoData } from "./workspaceData";
import { z } from "zod";
import type { ItemResponse } from "@shared/routes";

const MAX_SAVE_BYTES = 1024 * 1024;
export interface DemoStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/** Fail closed: unimplemented API paths never fall through to authenticated services. */
export class WorkspaceDemoApi {
  private data = createWorkspaceDemo();
  private failure = "";
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: DemoStorage, private notify: (message: string) => void = () => {}) {
    try { this.reload(); } catch (error) { this.report(error); }
  }
  get error() { return this.failure; }
  private report(error: unknown) {
    this.failure = error instanceof Error ? error.message : "Browser demo storage unavailable.";
    this.notify(this.failure);
  }
  private reload() {
    const raw = this.storage.getItem(WORKSPACE_DEMO_KEY);
    if (raw) {
      if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) throw new Error("Demo save exceeds 1 MiB. Reset demo to recover.");
      this.data = validateWorkspaceDemo(JSON.parse(raw));
    }
  }
  private save() {
    const raw = JSON.stringify(this.data);
    if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) throw new Error("Demo save exceeds 1 MiB. Remove fictional records or reset demo.");
    this.storage.setItem(WORKSPACE_DEMO_KEY, raw);
  }
  reset() {
    return this.queue = this.queue.catch(() => {}).then(() => {
      this.storage.removeItem(WORKSPACE_DEMO_KEY);
      this.data = createWorkspaceDemo(); this.save(); this.failure = ""; this.notify("");
    });
  }
  request(url: URL, method = "GET", body?: unknown): Promise<Response> {
    const task = this.queue.catch(() => {}).then(async () => {
      try {
        if (this.failure) throw new DemoApiError(507, this.failure);
        try { this.reload(); } catch (e) { this.report(e); throw new DemoApiError(507, this.failure); }
        const previous = structuredClone(this.data);
        try {
          const result = await this.dispatch(url, method.toUpperCase(), body ?? {});
          if (!["GET", "HEAD"].includes(method.toUpperCase())) {
            try { this.save(); } catch (e) { this.report(e); throw new DemoApiError(507, this.failure); }
          }
          return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
        } catch (e) { this.data = previous; throw e; }
      } catch (e) {
        return Response.json({ message: e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Demo operation failed." },
          { status: e instanceof DemoApiError ? e.status : e instanceof z.ZodError ? 400 : 500 });
      }
    });
    this.queue = task;
    return task;
  }
  private async dispatch(url: URL, method: string, body: any): Promise<unknown> {
    const d = this.data, path = url.pathname, q = url.searchParams;
    const id = () => d.nextId++;
    const success = () => ({ message: "Saved in this browser only." });
    if (path === "/api/account/appearance") {
      if (method === "GET") return d.appearance;
      if (method === "PUT") return d.appearance = appearanceSchema.parse(body);
    }
    if (path === "/api/account" && method === "GET")
      return { admin: false, environment: "Browser demo", legacyOwnershipStatus: "demo" };
    if (/^\/api\/(account\/data|admin\/|__clerk|import\/)/.test(path))
      throw new DemoApiError(403, "Account, administration, and server import operations are disabled in the public demo.");
    if (path === "/api/campaigns") {
      if (method === "GET") return d.campaigns;
      if (method === "POST") {
        const input = insertCampaignSchema.parse(body);
        if (!input.name.trim()) throw new DemoApiError(400, "Campaign name required.");
        const campaign = { ...input, edition: input.edition ?? "5e", id: id(), ownerUserId: null, description: input.description ?? null };
        d.campaigns.push(campaign); return campaign;
      }
    }
    const character = path.match(/^\/api\/campaigns\/characters\/(\d+)$/);
    if (character) {
      const row = d.characters.find(c => c.id === Number(character[1])) ?? missing();
      if (method === "DELETE") { d.characters = d.characters.filter(c => c !== row); return success(); }
      if (method === "PATCH") { Object.assign(row, insertCampaignCharacterSchema.partial().parse(body), { id: row.id, campaignId: row.campaignId }); return row; }
    }
    const match = path.match(/^\/api\/campaigns\/(\d+)(?:\/(.*))?$/);
    if (match) {
      const cid = Number(match[1]), rest = (match[2] ?? "").split("/").filter(Boolean).map(decodeURIComponent);
      const campaign = d.campaigns.find(c => c.id === cid) ?? missing();
      const [resource, rid, sub] = rest;
      if (!resource && method === "DELETE") {
        d.campaigns = d.campaigns.filter(c => c !== campaign);
        const removedItems = new Set(d.items.filter(i => i.campaignId === cid).map(i => i.id));
        const removedNpcs = new Set(d.homebrew.filter(i => i.campaignId === cid).map(i => i.id));
        d.links = d.links.filter(l => l.campaignId !== cid && l.sourceCampaignId !== cid &&
          !(l.kind === "items" ? removedItems : removedNpcs).has(l.resourceId));
        d.characters = d.characters.filter(c => c.campaignId !== cid);
        d.items = d.items.filter(c => c.campaignId !== cid);
        d.homebrew = d.homebrew.filter(c => c.campaignId !== cid);
        d.tables = d.tables.filter(c => c.campaignId !== cid);
        d.prepared = d.prepared.filter(c => c.campaignId !== cid);
        d.sessions.filter(s => s.session.campaignId === cid).forEach(s => { delete d.summaries[s.session.id]; });
        d.sessions = d.sessions.filter(s => s.session.campaignId !== cid);
        delete d.encounters[cid]; delete d.aliases[cid]; return success();
      }
      if (resource === "journal") return journalApi(d, cid, rest.slice(1), method, body);
      if (resource === "characters") {
        if (method === "GET") return d.characters.filter(c => c.campaignId === cid);
        if (method === "POST") {
          const row = insertCampaignCharacterSchema.parse({ ...body, campaignId: cid });
          const character = { playerClass: null, healingSurgesMax: null, initiativeBonus: 0, ...row,
            ac: row.ac ?? 10, maxHp: row.maxHp ?? 10, id: id() };
          d.characters.push(character); return character;
        }
      }
      if (resource === "items" || resource === "homebrew-bestiary") {
        const kind = resource === "items" ? "items" : "npcs";
        const rows = kind === "items" ? d.items : d.homebrew;
        if (method === "GET") return rows.filter(r => r.campaignId === cid ||
          d.links.some(l => l.campaignId === cid && l.kind === kind && l.resourceId === r.id)).map(r => {
          const source = d.campaigns.find(c => c.id === r.campaignId);
          return r.campaignId === cid ? r : { ...r, linkedSource: { campaignId: source!.id, campaignName: source!.name } };
        });
        if (method === "DELETE" && !rid) {
          const removed = new Set(rows.filter(r => r.campaignId === cid).map(r => r.id));
          if (kind === "items") d.items = d.items.filter(r => r.campaignId !== cid);
          else d.homebrew = d.homebrew.filter(r => r.campaignId !== cid);
          d.links = d.links.filter(l => l.kind !== kind || !removed.has(l.resourceId));
          return success();
        }
      }
      if (resource === "resources") {
        if (method === "GET") return { items: d.items.filter(i => i.campaignId === cid),
          npcs: d.homebrew.filter(i => i.campaignId === cid), links: d.links.filter(l => l.campaignId === cid) };
        if (rid === "links" && sub && method === "DELETE") {
          d.links = d.links.filter(l => !(l.id === Number(sub) && l.campaignId === cid)); return success();
        }
        if (rid === "links" && method === "POST") {
          const source = d.campaigns.find(c => c.id === body.sourceCampaignId && c.id !== cid) ?? missing();
          const result = { linkedItems: 0, linkedNpcs: 0, existingItems: 0, existingNpcs: 0 };
          for (const kind of ["items", "npcs"] as const) {
            for (const resourceId of Array.from(new Set<number>(body[kind === "items" ? "itemIds" : "npcIds"] ?? []))) {
              const row = (kind === "items" ? d.items : d.homebrew).find(r => r.id === resourceId && r.campaignId === source.id) ?? missing();
              const existing = d.links.some(l => l.campaignId === cid && l.kind === kind && l.resourceId === resourceId);
              if (kind === "items") existing ? result.existingItems++ : result.linkedItems++;
              else existing ? result.existingNpcs++ : result.linkedNpcs++;
              if (!existing) d.links.push({ id: id(), campaignId: cid, sourceCampaignId: source.id,
                sourceCampaignName: source.name, kind, resourceId, name: row.name });
            }
          }
          return result;
        }
      }
      if (resource === "encounter") {
        if (method === "GET") return d.encounters[cid] ?? missing();
        if (method === "PUT") { d.encounters[cid] = { data: body, savedAt: new Date().toISOString() }; return success(); }
        if (method === "DELETE") { delete d.encounters[cid]; return success(); }
      }
      if (resource === "prepared-encounters") {
        if (method === "GET") return d.prepared.filter(e => e.campaignId === cid);
        const input = z.object({ name: z.string().trim().min(1).max(100).optional(), data: z.record(z.string(), z.unknown()).optional() }).parse(body);
        if (input.name && d.prepared.some(e => e.campaignId === cid && e.id !== Number(rid) && e.name.toLowerCase() === input.name!.toLowerCase()))
          throw new DemoApiError(409, "An encounter with that name already exists.");
        if (method === "POST" && input.name && input.data) {
          const e = { id: id(), campaignId: cid, name: input.name, data: input.data,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          d.prepared.push(e); return e;
        }
        const e = d.prepared.find(e => e.campaignId === cid && e.id === Number(rid)) ?? missing();
        if (method === "PUT") { Object.assign(e, input, { updatedAt: new Date().toISOString() }); return e; }
        if (method === "DELETE") { d.prepared = d.prepared.filter(r => r !== e); return success(); }
      }
      if (resource === "import" || rid === "import")
        throw new DemoApiError(403, "CSV uploads are disabled in the public demo. Explore the preloaded fictional libraries instead.");
    }
    if (path.startsWith("/api/roll-tables")) {
      if (method === "GET" && path === "/api/roll-tables") return [...STOCK_ROLL_TABLES, ...d.tables.filter(t => t.campaignId === Number(q.get("campaignId")))];
      const tid = Number(path.split("/").pop());
      if (method === "DELETE") {
        const table = d.tables.find(t => t.id === tid && t.campaignId === Number(q.get("campaignId"))) ?? missing();
        d.tables = d.tables.filter(t => t !== table); return success();
      }
      const input = rollTableInputSchema.parse(body);
      if (!d.campaigns.some(c => c.id === input.campaignId)) return missing();
      const table = { ...input, entries: input.entries.map((e, entryOrder) => ({ ...e, entryOrder })),
        id: method === "POST" ? id() : tid, source: "campaign" as const, description: input.description ?? "" };
      if (method === "POST") d.tables.push(table);
      else if (method === "PUT") {
        const old = d.tables.find(t => t.id === tid && t.campaignId === input.campaignId) ?? missing();
        d.tables[d.tables.indexOf(old)] = table;
      } else return missing();
      return table;
    }
    if (path === "/api/items/5e/sources" && method === "GET") return ["Fictional demo"];
    if (path === "/api/items/5e" && method === "GET") return this.lootItems();
    if (path === "/api/items/draw" && method === "POST") {
      const options = drawOptionsSchema.parse(body);
      const opts = options;
      let rows = opts.source === "campaign" ? [] : this.lootItems();
      if (opts.source === "campaign" && opts.campaignId) rows.push(...d.items.filter(i => i.campaignId === opts.campaignId ||
        d.links.some(l => l.campaignId === opts.campaignId && l.kind === "items" && l.resourceId === i.id))
        .map(i => ({ ...i, edition: "homebrew", source: "Fictional demo" })));
      if (opts.categories?.length) rows = rows.filter(i => opts.categories.includes(i.category));
      if (opts.rarities?.length) rows = rows.filter(i => opts.rarities.includes(i.rarity));
      if (opts.sources?.length) rows = rows.filter(i => opts.sources!.includes(i.source ?? ""));
      if (opts.search) rows = rows.filter(i => i.name.toLowerCase().includes(opts.search!.toLowerCase()));
      if (opts.source === "5e" && opts.editions?.length && !opts.editions.includes("5e")) rows = [];
      return rows.length ? Array.from({ length: opts.count ?? 1 }, () => rows[Math.floor(Math.random() * rows.length)]) : [];
    }
    if (path.startsWith("/api/bestiary/") && method === "GET") {
      let monsters = createWorkspaceDemo().homebrew.map((h, i) => ({
        ...h.profileData, index: `demo-library-${i}`, name: i ? "Tide Cave Guardian" : "Lantern Moth",
        description: "An original fictional creature in the demo's shared bestiary.",
      }));
      if (path.endsWith("/types")) return Array.from(new Set(monsters.map(m => m.type)));
      if (path.endsWith("/cr-values")) return ["1"];
      if (path.endsWith("/sources")) return ["Fictional demo"];
      if (q.get("search")) monsters = monsters.filter(m => m.name.toLowerCase().includes(q.get("search")!.toLowerCase()));
      if (q.get("types")) monsters = monsters.filter(m => q.get("types")!.split(",").includes(m.type ?? ""));
      if (q.get("cr")) monsters = monsters.filter(m => m.cr === q.get("cr"));
      if (q.get("sources")) monsters = monsters.filter(m => q.get("sources")!.split("|").includes(m.source ?? ""));
      if (path.endsWith("/encounter")) return monsters.length ? monsters : missing();
      if (path.endsWith("/random")) return monsters[Math.floor(Math.random() * monsters.length)] ?? missing();
      if (path === "/api/bestiary/monsters") return monsters.slice(0, Math.min(Number(q.get("limit")) || 20, 100));
      return monsters.find(m => m.index === decodeURIComponent(path.split("/").pop()!)) ?? missing();
    }
    throw new DemoApiError(403, "This server operation is unavailable in the browser-only demo. No request was sent to a real account.");
  }
  private lootItems(): ItemResponse[] {
    return [
      ...["Common", "Uncommon", "Rare", "Very Rare", "Legendary"].flatMap((rarity, r) =>
        ["Weapon", "Armor", "Potion", "Wondrous Item", "Ring", "Scroll", "Wand", "Rod", "Staff"].map((category, c) => ({
          id: 10000 + r * 10 + c, name: `${rarity} Lantern ${category}`, category, itemType: null, rarity,
          description: "An original fictional demo item. A faint silver glow reveals its maker's coastal insignia.",
          damage: null, weight: null, cost: null, properties: null, attunement: null, edition: "5e", source: "Fictional demo",
        }))),
    ];
  }
}

let transport: { current: WorkspaceDemoApi | null } | undefined;
export function installDemoTransport(api: WorkspaceDemoApi) {
  if (!transport) {
    const holder = transport = { current: api as WorkspaceDemoApi | null };
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      // Catch all API requests, including Clerk/external APIs; no fallback to real services.
      if (url.pathname.startsWith("/api/")) {
        if (!holder.current || url.origin !== window.location.origin)
          return Response.json({ message: "Server API calls are disabled in this demo document." }, { status: 403 });
        if (init?.signal?.aborted || (input instanceof Request && input.signal.aborted)) throw new DOMException("Aborted", "AbortError");
        const method = init?.method ?? (input instanceof Request ? input.method : "GET");
        let body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
        if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* CSV/binary is explicitly rejected. */ } }
        return holder.current.request(url, method, body);
      }
      return original(input, init);
    };
    document.addEventListener("click", (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (anchor && new URL(anchor.href).pathname.startsWith("/api/")) {
        event.preventDefault(); event.stopImmediatePropagation();
        window.alert("Server downloads are disabled in the demo. No private API was contacted.");
      }
    }, true);
  }
  transport.current = api;
  const holder = transport;
  // Never restore network APIs in this document: child unmount autosaves, queued
  // callbacks, or HMR cleanups must not reach a real account after demo teardown.
  // Exiting to the real app uses a full document navigation.
  return () => { if (holder.current === api) holder.current = null; };
}
