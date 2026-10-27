import type { Express } from "express";
import { appearanceSchema, normalizeAppearance, DEFAULT_APPEARANCE } from "../../shared/appearance";
import { currentActor } from "./context";

export interface AppearanceRepository {
  read(userId: string): Promise<unknown>;
  write(userId: string, value: unknown): Promise<void>;
}
// Registered behind apiPolicy: identity always comes from the verified actor.
export function registerAppearanceRoutes(app: Express, repository: AppearanceRepository) {
  app.get("/api/account/appearance", async (_req,res,next)=>{
    try { res.json(normalizeAppearance(await repository.read(currentActor().userId))); }
    catch { next(new Error("Could not load appearance. Please retry.")); }
  });
  app.put("/api/account/appearance", async (req,res,next)=>{
    const parsed=appearanceSchema.safeParse(req.body);
    if(!parsed.success) { res.status(400).json({message:"Choose a valid skin and light or dark mode."}); return; }
    try { await repository.write(currentActor().userId,parsed.data); res.json(parsed.data); }
    catch { next(new Error("Could not save appearance. Please retry.")); }
  });
}
export { DEFAULT_APPEARANCE };
