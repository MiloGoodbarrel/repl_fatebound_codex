import type { Express } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "../db";
import { resolveAccount, legacyOwnershipStatus } from "./accounts";
import { currentActor } from "./context";
import { apiPolicy, type AccessRepository } from "./policy";
import { storage } from "../storage";
import { registerAppearanceRoutes } from "./appearance";

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
  registerAppearanceRoutes(app, {
    async read(userId) {
      return (await pool.query("SELECT appearance FROM app_accounts WHERE user_id=$1", [userId])).rows[0]?.appearance;
    },
    async write(userId, value) {
      await pool.query("UPDATE app_accounts SET appearance=$2::jsonb WHERE user_id=$1", [userId, JSON.stringify(value)]);
    },
  });
  app.get("/api/account", async (_req, res, next) => {
    try {
      const actor = currentActor();
      res.json({ admin: actor.admin, legacyOwnershipConfigured: !!process.env.CREATOR_GOOGLE_EMAIL,
        legacyOwnershipStatus: await legacyOwnershipStatus(actor), environment: process.env.NODE_ENV === "production" ? "published" : "preview" });
    } catch {
      next(new Error("Could not check account setup. Please retry."));
    }
  });
  app.delete("/api/account/data", async (_req, res, next) => {
    try {
      for (const campaign of await storage.getCampaigns()) await storage.deleteCampaign(campaign.id);
      await storage.clearHomebrewItems();
      await pool.query("UPDATE app_accounts SET appearance=NULL WHERE user_id=$1", [currentActor().userId]);
      res.sendStatus(204);
    } catch { next(new Error("Could not delete workspace data. Retry before deleting your login account.")); }
  });
}
