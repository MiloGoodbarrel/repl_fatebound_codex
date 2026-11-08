/** "none" means the editor observed no saved encounter; missing is not consent. */
export function parseEncounterRevision(value: string | null): number | null | undefined {
  if (value === "none") return null;
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const revision = Number(value);
  return Number.isSafeInteger(revision) ? revision : undefined;
}

export function encounterRevision(data: any): number {
  return Number.isSafeInteger(data?.saveRevision) && data.saveRevision >= 0 ? data.saveRevision : 0;
}

export function nextEncounterRevision(previous: number | null, data: unknown): number {
  return Math.max(Date.now(), (previous ?? 0) + 1, encounterRevision(data));
}

/** Ignore transport revision metadata when deciding whether a restored view is dirty. */
export function encounterContent(data: any): string {
  return JSON.stringify({
    combatants: data?.combatants ?? [], round: data?.round ?? 1,
    activeIndex: data?.activeIndex ?? 0, combatState: data?.combatState ?? "active",
    selectedVersions: data?.selectedVersions ?? [],
    loadedPreparedEncounter: data?.loadedPreparedEncounter === true,
    rescuedCaptives: data?.rescuedCaptives ?? 0,
  });
}
