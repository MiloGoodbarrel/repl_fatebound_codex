import type { Express } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import type { IStorage } from "./storage";
import { campaigns, campaignItems, campaignHomebrewMonsters, campaignResourceLinks } from "@shared/schema";
import { planResourceLinks, resourceLinkSchema, type LinkedResource } from "@shared/campaignResources";
import { currentActor } from "./auth/context";

class ResourceLinkError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function getLinks(campaignId: number): Promise<LinkedResource[]> {
  const [items, npcs] = await Promise.all([
    db.select({
      id: campaignResourceLinks.id, resourceId: campaignItems.id, name: campaignItems.name,
      sourceCampaignId: campaigns.id, sourceCampaignName: campaigns.name,
    }).from(campaignResourceLinks)
      .innerJoin(campaignItems, eq(campaignResourceLinks.itemId, campaignItems.id))
      .innerJoin(campaigns, eq(campaignItems.campaignId, campaigns.id))
      .where(and(eq(campaignResourceLinks.campaignId, campaignId), eq(campaigns.ownerUserId, currentActor().userId))),
    db.select({
      id: campaignResourceLinks.id, resourceId: campaignHomebrewMonsters.id, name: campaignHomebrewMonsters.name,
      sourceCampaignId: campaigns.id, sourceCampaignName: campaigns.name,
    }).from(campaignResourceLinks)
      .innerJoin(campaignHomebrewMonsters, eq(campaignResourceLinks.npcId, campaignHomebrewMonsters.id))
      .innerJoin(campaigns, eq(campaignHomebrewMonsters.campaignId, campaigns.id))
      .where(and(eq(campaignResourceLinks.campaignId, campaignId), eq(campaigns.ownerUserId, currentActor().userId))),
  ]);
  return [...items.map(row => ({ ...row, kind: "items" as const })), ...npcs.map(row => ({ ...row, kind: "npcs" as const }))];
}

export function registerCampaignResourceRoutes(app: Express, storage: IStorage) {
  app.get("/api/campaigns/:id/resources", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: "Invalid campaign id" });
    try {
      if (!await storage.getCampaign(id)) return res.status(404).json({ message: "Campaign not found" });
      const [items, npcs, links] = await Promise.all([
        storage.getCampaignItems(id), storage.getCampaignHomebrew(id), getLinks(id),
      ]);
      // Only owned originals can be offered as sources; links never form chains.
      res.json({ items: items.filter(row => row.campaignId === id), npcs: npcs.filter(row => row.campaignId === id), links });
    } catch (error) {
      console.error("Could not load campaign resources");
      res.status(500).json({ message: "Could not load campaign resources" });
    }
  });

  // Explicitly retire the copy endpoint, including for stale browser tabs.
  app.post("/api/campaigns/:id/resources/import", (_req, res) => {
    res.status(410).json({ message: "Resource copying is disabled. Refresh and use linked items and NPCs instead." });
  });

  app.post("/api/campaigns/:id/resources/links", async (req, res) => {
    const targetId = Number(req.params.id);
    const parsed = resourceLinkSchema.safeParse(req.body);
    if (!Number.isSafeInteger(targetId) || targetId < 1 || !parsed.success) {
      return res.status(400).json({ message: parsed.success ? "Invalid campaign id" : parsed.error.issues[0].message });
    }
    const { sourceCampaignId, itemIds, npcIds } = parsed.data;
    if (sourceCampaignId === targetId) return res.status(400).json({ message: "Choose a different source campaign" });
    try {
      const result = await db.transaction(async tx => {
        // Serialize link creation in a stable lock order.
        await tx.execute(sql`SELECT id FROM campaigns WHERE id IN (${targetId}, ${sourceCampaignId}) ORDER BY id FOR UPDATE`);
        const found = await tx.select().from(campaigns).where(and(
          inArray(campaigns.id, [targetId, sourceCampaignId]), eq(campaigns.ownerUserId, currentActor().userId),
        ));
        if (found.length !== 2) throw new ResourceLinkError("Source or destination campaign not found", 404);
        const sourceItems = await tx.select({ id: campaignItems.id }).from(campaignItems).where(eq(campaignItems.campaignId, sourceCampaignId));
        const sourceNpcs = await tx.select({ id: campaignHomebrewMonsters.id }).from(campaignHomebrewMonsters).where(eq(campaignHomebrewMonsters.campaignId, sourceCampaignId));
        const existing = await tx.select().from(campaignResourceLinks).where(eq(campaignResourceLinks.campaignId, targetId));
        let itemPlan, npcPlan;
        try {
          itemPlan = planResourceLinks(sourceItems, itemIds, existing.flatMap(link => link.itemId === null ? [] : [link.itemId]));
          npcPlan = planResourceLinks(sourceNpcs, npcIds, existing.flatMap(link => link.npcId === null ? [] : [link.npcId]));
        } catch (error) {
          throw new ResourceLinkError((error as Error).message, 400);
        }
        const links = [
          ...itemPlan.resourceIds.map(itemId => ({ campaignId: targetId, sourceCampaignId, itemId })),
          ...npcPlan.resourceIds.map(npcId => ({ campaignId: targetId, sourceCampaignId, npcId })),
        ];
        if (links.length) await tx.insert(campaignResourceLinks).values(links);
        return {
          linkedItems: itemPlan.resourceIds.length, linkedNpcs: npcPlan.resourceIds.length,
          existingItems: itemPlan.existing, existingNpcs: npcPlan.existing,
        };
      });
      res.json(result);
    } catch (error) {
      if (error instanceof ResourceLinkError) return res.status(error.status).json({ message: error.message });
      console.error("Could not link campaign resources");
      res.status(500).json({ message: "Could not link campaign resources; no links were added." });
    }
  });

  app.delete("/api/campaigns/:id/resources/links/:linkId", async (req, res) => {
    const campaignId = Number(req.params.id), linkId = Number(req.params.linkId);
    if (![campaignId, linkId].every(id => Number.isSafeInteger(id) && id > 0)) {
      return res.status(400).json({ message: "Invalid campaign or link id" });
    }
    try {
      const removed = await db.delete(campaignResourceLinks).where(and(
        eq(campaignResourceLinks.id, linkId), eq(campaignResourceLinks.campaignId, campaignId),
        sql`${campaignResourceLinks.sourceCampaignId} IN (SELECT id FROM campaigns WHERE owner_user_id = ${currentActor().userId})`,
      )).returning();
      if (!removed.length) return res.status(404).json({ message: "Link not found in this campaign" });
      res.json({ message: "Link removed; the source resource is unchanged." });
    } catch (error) {
      console.error("Could not remove resource link");
      res.status(500).json({ message: "Could not remove resource link" });
    }
  });
}
