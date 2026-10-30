import { Router } from "express";
import type { storage } from "./storage";
import { mapBestiaryActions } from "./bestiaryActions";
import fs from "node:fs";
import path from "node:path";

// No campaigns, homebrew, accounts, journal repositories, or write methods may
// be accessed here. This is a deliberately public, read-only stock catalog.
type StockReader = Pick<typeof storage, "getItems5e" | "getSources5e" | "getBestiaryTypes" |
  "getBestiaryCRs" | "getBestiarySources" | "searchBestiary" | "getRandomBestiaryMonster" |
  "getEncounterGroup" | "getBestiaryMonsterDetail">;
export type StockLore = Record<string, { description?: string; sourcePage?: number; imageUrl?: string }>;
const lorePath = path.resolve(process.cwd(), "server/data/bestiary/grim_hollow_lore.json");
export const stockLore: StockLore = fs.existsSync(lorePath) ? JSON.parse(fs.readFileSync(lorePath, "utf8")) : {};

export function stockMonster(m: any, lore: StockLore = {}) {
  const content = lore[m.monsterId];
  return {
    index: m.monsterId, name: m.name, hp: m.printedAverageHp || 0,
    hit_dice: m.hitDiceCount && m.hitDieSize ? `${m.hitDiceCount}d${m.hitDieSize}` : undefined,
    hitDiceCount: m.hitDiceCount, hitDieSize: m.hitDieSize, ac: m.armorClass || 10,
    cr: m.challengeRating || "--", type: m.creatureType || "", size: m.size || "",
    str: m.strScore, dex: m.dexScore, con: m.conScore, int: m.intScore, wis: m.wisScore, cha: m.chaScore,
    strMod: m.strMod, dexMod: m.dexMod, conMod: m.conMod, intMod: m.intMod, wisMod: m.wisMod, chaMod: m.chaMod,
    alignment: m.alignment, creatureTags: m.creatureTags, source: m.sourceBook || m.sourceKey || "",
    description: content?.description || undefined, sourcePage: content?.sourcePage || m.sourcePage || undefined,
    imageUrl: content?.imageUrl || undefined,
  };
}

export function stockMonsterDetail(detail: any, lore: StockLore = {}) {
  return {
    ...stockMonster(detail, lore),
    traits: (detail.traits || []).map((t: any) => ({
      name: t.traitName || "", description: t.traitDescription || "", type: t.traitType || "passive",
    })),
    ...mapBestiaryActions(detail.actions || []),
    special_abilities: (detail.traits || []).map((t: any) => ({ name: t.traitName || "", desc: t.traitDescription || "" })),
  };
}

export function publicStockLibrary(reader: StockReader, lore: StockLore = stockLore) {
  const router = Router();
  router.use((req, res, next) => {
    res.set({ "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" });
    if (!["GET", "HEAD"].includes(req.method)) {
      res.set("Allow", "GET, HEAD").status(405).json({ message: "The stock demo library is read-only." }); return;
    }
    next();
  });
  const read = (path: string, handler: (req: any) => Promise<unknown>) =>
    router.get(path, async (req, res) => {
      try {
        const data = await handler(req);
        if (data == null) { res.status(404).json({ message: "No stock creature matches these filters." }); return; }
        res.json(data);
      } catch {
        res.status(503).json({ message: "The shared stock library is unavailable. Please retry." });
      }
    });
  read("/items/5e", () => reader.getItems5e());
  read("/items/5e/sources", () => reader.getSources5e());
  read("/bestiary/types", () => reader.getBestiaryTypes());
  read("/bestiary/cr-values", () => reader.getBestiaryCRs());
  read("/bestiary/sources", () => reader.getBestiarySources());
  const filters = (req: any) => ({
    search: String(req.query.search ?? "").trim().slice(0, 200),
    types: String(req.query.types ?? "").split(",").filter(Boolean).slice(0, 40),
    sources: String(req.query.sources ?? "").split("|").filter(Boolean).slice(0, 100),
    cr: req.query.cr ? String(req.query.cr).slice(0, 10) : undefined,
  });
  read("/bestiary/monsters", async req => {
    const f = filters(req);
    const limit = Math.max(1, Math.min(Math.floor(Number(req.query.limit)) || 20, 100));
    return (await reader.searchBestiary(f.search, f.types, limit, f.cr, f.sources)).map(m => stockMonster(m, lore));
  });
  read("/bestiary/monsters/random", async req => {
    const f = filters(req), m = await reader.getRandomBestiaryMonster(f.types, f.cr, f.sources);
    return m ? stockMonster(m, lore) : null;
  });
  read("/bestiary/monsters/encounter", async req => {
    const f = filters(req);
    const rows = await reader.getEncounterGroup(f.cr ?? "1", f.types, f.sources, f.search);
    return rows.length ? rows.map(m => stockMonster(m, lore)) : null;
  });
  read("/bestiary/monsters/:id", async req => {
    const detail = await reader.getBestiaryMonsterDetail(req.params.id);
    return detail ? stockMonsterDetail(detail, lore) : null;
  });
  // Unknown paths never fall through to a SPA document or private route.
  router.use((_req, res) => { res.status(404).json({ message: "Unknown stock library resource." }); });
  return router;
}
