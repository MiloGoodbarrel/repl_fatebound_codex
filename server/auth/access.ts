import type { Express } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "../db";
import { resolveAccount } from "./accounts";
import { currentActor } from "./context";
import { apiPolicy, type AccessRepository } from "./policy";
import { storage } from "../storage";

export const accessRepository: AccessRepository = {
  async campaignOwner(id) {
    return (await pool.query("SELECT owner_user_id FROM campaigns WHERE id=$1", [id])).rows[0]?.owner_user_id ?? null;
  },
  async characterCampaign(id) {
    return (await pool.query("SELECT campaign_id FROM campaign_characters WHERE id=$1", [id])).rows[0]?.campaign_id ?? null;
  },
  async tableCampaign(id) {
    return (await pool.query("SELECT campaign_id FROM roll_tables WHERE id=$1", [id])).rows[0]?.campaign_id ?? null;
  },
};

export function registerAccountPolicy(app: Express) {
  app.use("/api", apiPolicy(async req => {
    const { userId } = getAuth(req);
    return userId ? await resolveAccount(userId) : null;
  }, accessRepository));
  app.get("/api/account", (_req, res) => {
    res.json({ admin: currentActor().admin, legacyOwnershipConfigured: !!process.env.CREATOR_GOOGLE_EMAIL });
  });
  app.delete("/api/account/data", async (_req, res, next) => {
    try {
      for (const campaign of await storage.getCampaigns()) await storage.deleteCampaign(campaign.id);
      await storage.clearHomebrewItems();
      res.sendStatus(204);
    } catch { next(new Error("Could not delete workspace data. Retry before deleting your login account.")); }
  });
}
