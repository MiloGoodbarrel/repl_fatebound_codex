import type { CampaignHomebrewAction, CampaignHomebrewMonster } from "../shared/schema";

type LibraryRow = {
  monster: CampaignHomebrewMonster;
  owner: { id: number; name: string } | null;
};

/** Hydrate only already-authorized records in one batch, never one query per creature. */
export async function hydrateHomebrewLibrary(
  rows: LibraryRow[],
  campaignId: number,
  loadActions: (monsterIds: number[]) => Promise<CampaignHomebrewAction[]>,
) {
  if (!rows.length) return [];
  const byMonster = new Map<number, CampaignHomebrewAction[]>(
    rows.map(({ monster }) => [monster.id, []]),
  );
  const actions = await loadActions(Array.from(byMonster.keys()));
  for (const action of actions) byMonster.get(action.monsterRefId)?.push(action);
  return rows.map(({ monster, owner }) => ({
    ...monster,
    actions: byMonster.get(monster.id)!,
    ...(monster.campaignId !== campaignId && owner ? {
      linkedSource: { campaignId: owner.id, campaignName: owner.name },
    } : {}),
  }));
}
