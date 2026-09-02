export type EncounterState = "setup" | "active" | "ended";

export interface EncounterSnapshot<TCombatant = unknown> {
  combatants: TCombatant[];
  round: number;
  activeIndex: number;
  combatState: EncounterState;
  selectedVersions: string[];
  saveRevision?: number;
}

export interface GroupDamageResult {
  memberHp: number[];
  isDown: boolean;
  isDead: boolean;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

/**
 * Saved encounters before autosave used the same state shape without
 * saveRevision. Keep those snapshots restorable while applying safe defaults
 * to partially populated legacy data.
 */
export function normalizeEncounterSnapshot<TCombatant = unknown>(
  input: unknown,
): EncounterSnapshot<TCombatant> | null {
  const candidate = isRecord(input) && isRecord(input.data) && !Array.isArray(input.combatants)
    ? input.data
    : input;
  if (!isRecord(candidate) || !Array.isArray(candidate.combatants)) return null;

  return {
    combatants: candidate.combatants as TCombatant[],
    round: typeof candidate.round === "number" ? candidate.round : 1,
    activeIndex: typeof candidate.activeIndex === "number" ? candidate.activeIndex : 0,
    combatState: candidate.combatState === "setup"
      || candidate.combatState === "ended"
      || candidate.combatState === "active"
      ? candidate.combatState
      : "active",
    selectedVersions: Array.isArray(candidate.selectedVersions)
      ? candidate.selectedVersions.filter((version): version is string => typeof version === "string")
      : [],
    saveRevision: typeof candidate.saveRevision === "number" && Number.isFinite(candidate.saveRevision)
      ? candidate.saveRevision
      : undefined,
  };
}

export interface EncounterRestoreState<TCombatant = unknown> extends EncounterSnapshot<TCombatant> {
  showVersionDialog: false;
  showRestoreBanner: false;
  autoSaveReady: true;
}

export function createEncounterRestoreState<TCombatant = unknown>(
  input: unknown,
): EncounterRestoreState<TCombatant> | null {
  const snapshot = normalizeEncounterSnapshot<TCombatant>(input);
  if (!snapshot) return null;
  return {
    ...snapshot,
    showVersionDialog: false,
    showRestoreBanner: false,
    autoSaveReady: true,
  };
}

export function getEncounterSaveRevision(input: unknown): number {
  if (!isRecord(input)) return 0;
  return typeof input.saveRevision === "number" && Number.isFinite(input.saveRevision)
    ? input.saveRevision
    : 0;
}

/**
 * The database update condition is inclusive: equal revisions are safe to
 * apply, while an older request must never replace the newer snapshot.
 */
export function shouldApplyEncounterRevision(
  current: unknown,
  incoming: unknown,
): boolean {
  return getEncounterSaveRevision(incoming) >= getEncounterSaveRevision(current);
}

/**
 * Async encounter work captures its campaign id. Its result may only update
 * state if the user is still viewing that campaign.
 */
export function isCurrentEncounterCampaign(
  requestCampaignId: number,
  activeCampaignId: number | null | undefined,
): boolean {
  return activeCampaignId === requestCampaignId;
}

export function completeEncounterQuery<T>(
  requestCampaignId: number,
  activeCampaignId: number | null | undefined,
  result: T,
): T | null {
  return isCurrentEncounterCampaign(requestCampaignId, activeCampaignId) ? result : null;
}

export interface EncounterResetCompletion {
  autoSaveReady: true;
  shouldRefetch: true;
}

export function completeEncounterReset(
  requestCampaignId: number,
  activeCampaignId: number | null | undefined,
): EncounterResetCompletion | null {
  if (!isCurrentEncounterCampaign(requestCampaignId, activeCampaignId)) return null;
  return { autoSaveReady: true, shouldRefetch: true };
}

export function sortCombatantsPreservingActiveTurn<T extends { id: string; initiative: number }>(
  combatants: T[],
  updatedCombatant: T,
  activeCombatantId: string | undefined,
): { combatants: T[]; activeIndex: number | null } {
  const sorted = combatants
    .map(combatant => combatant.id === updatedCombatant.id ? updatedCombatant : combatant)
    .sort((a, b) => b.initiative - a.initiative);
  if (!activeCombatantId) return { combatants: sorted, activeIndex: null };

  const activeIndex = sorted.findIndex(combatant => combatant.id === activeCombatantId);
  return { combatants: sorted, activeIndex: activeIndex >= 0 ? activeIndex : null };
}

export function applyGroupDamage(
  memberHp: number[],
  focusedMember: number,
  damage: number,
): GroupDamageResult {
  const nextMemberHp = [...memberHp];
  if (focusedMember >= 0 && focusedMember < nextMemberHp.length && damage > 0) {
    nextMemberHp[focusedMember] = Math.max(0, nextMemberHp[focusedMember] - damage);
  }
  const allDead = nextMemberHp.every(hp => hp <= 0);
  return {
    memberHp: nextMemberHp,
    isDown: allDead,
    isDead: allDead,
  };
}