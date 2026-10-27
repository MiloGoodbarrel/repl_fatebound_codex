import type { RequestHandler } from "express";
import type { Actor } from "./context";
import { actorContext, requestActors } from "./context";

export interface AccessRepository {
  campaignOwner(id: number): Promise<string | null>;
  characterCampaign(id: number): Promise<number | null>;
  tableCampaign(id: number): Promise<number | null>;
}
export const positiveId = (value: unknown) => typeof value === "number" ?
  (Number.isSafeInteger(value) && value > 0 ? value : null) :
  typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

export function apiPolicy(
  identify: (req: Parameters<RequestHandler>[0]) => Promise<Actor | null>,
  repo: AccessRepository,
): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      // Scope mounted at /api. Public reads are exclusively static compendia/templates.
      const path = req.path;
      if (["GET", "HEAD"].includes(req.method) && (
        /^\/bestiary(?:\/|$)/.test(path) || /^\/items\/5e(?:\/sources)?\/?$/.test(path) ||
        path === "/homebrew-bestiary/template.csv"
      )) { next(); return; }
      const actor = await identify(req);
      if (!actor) { res.status(401).json({ message: "Sign in to access your workspace." }); return; }
      // Extra race protection, never an identity source or access grant.
      const expectedActor = req.get("x-workspace-user");
      if (expectedActor && expectedActor !== actor.userId) {
        res.status(409).json({ message: "Your account changed. Reload before continuing." }); return;
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        // All browser writes are same-origin, including raw uploads and keepalive autosaves.
        const origin = req.get("origin");
        const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
        let valid = false;
        try { valid = !!origin && new URL(origin).host === host && ["https:", "http:"].includes(new URL(origin).protocol); } catch {}
        if (!valid || req.get("sec-fetch-site") === "cross-site") {
          res.status(403).json({ message: "Use this app's own page to make changes." }); return;
        }
      }
      const own = async (value: unknown) => {
        const id = positiveId(value);
        return id !== null && await repo.campaignOwner(id) === actor.userId;
      };
      const deny = () => { res.status(404).json({ message: "Resource not found in your workspace." }); };
      const campaign = /^\/campaigns\/([^/]+)/.exec(path);
      if (campaign && campaign[1] !== "characters" && !await own(campaign[1])) { deny(); return; }
      const character = /^\/campaigns\/characters\/([^/]+)/.exec(path);
      if (character) {
        const id = positiveId(character[1]);
        if (!id || !await own(await repo.characterCampaign(id))) { deny(); return; }
        // Never allow a character to be moved via an arbitrary update body.
        if (req.body && ("campaignId" in req.body || "id" in req.body)) {
          res.status(400).json({ message: "Character identity cannot be changed." }); return;
        }
      }
      for (const value of [req.query.campaignId, req.body?.campaignId, req.body?.sourceCampaignId]) {
        if (value !== undefined && !await own(value)) { deny(); return; }
      }
      const table = /^\/roll-tables\/([^/]+)/.exec(path);
      if (table) {
        const id = positiveId(table[1]);
        if (!id || !await own(await repo.tableCampaign(id))) { deny(); return; }
      }
      if ((path.startsWith("/admin/") || (req.method === "DELETE" && path === "/items/5e")) && !actor.admin) {
        res.status(403).json({ message: "Administrator access required." }); return;
      }
      // Fail closed for unknown routes; adding new private modules requires explicit classification.
      if (!/^\/(campaigns(?:\/|$)|roll-tables(?:\/|$)|items\/draw\/?$|import\/5e\/?$|items\/(?:homebrew|5e)\/?$|account(?:\/|$)|admin\/seed-loot\/)/.test(path)) {
        res.status(404).json({ message: "API endpoint not found." }); return;
      }
      requestActors.set(req, actor);
      actorContext.run(actor, next);
    })().catch(() => res.status(503).json({ message: "Account permissions could not be verified. Please retry." }));
  };
}
