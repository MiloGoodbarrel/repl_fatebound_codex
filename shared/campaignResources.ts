import { z } from "zod";

const ids = z.array(z.number().int().positive()).max(500).default([])
  .transform(values => Array.from(new Set(values)));

export const resourceLinkSchema = z.object({
  sourceCampaignId: z.number().int().positive(),
  itemIds: ids,
  npcIds: ids,
}).strict().refine(value => value.itemIds.length + value.npcIds.length > 0, {
  message: "Select at least one item or NPC.",
});

export interface ResourceLinkResult {
  linkedItems: number;
  linkedNpcs: number;
  existingItems: number;
  existingNpcs: number;
}

export interface LinkedResource {
  id: number;
  kind: "items" | "npcs";
  resourceId: number;
  name: string;
  sourceCampaignId: number;
  sourceCampaignName: string;
}

export const resourceNameKey = (name: string) => name.trim().toLocaleLowerCase("en-US");

/** Link by identity, not name: no statistics, actions, or source records are copied. */
export function planResourceLinks(
  source: { id: number }[], selectedIds: number[], existingIds: number[],
) {
  const selected = Array.from(new Set(selectedIds));
  const byId = new Map(source.map(row => [row.id, row]));
  if (selected.some(id => !byId.has(id))) {
    throw new Error("A selected resource no longer belongs to the source campaign. Refresh and try again.");
  }
  const existing = new Set(existingIds);
  const resourceIds = selected.filter(id => !existing.has(id));
  return { resourceIds, existing: selected.length - resourceIds.length };
}
