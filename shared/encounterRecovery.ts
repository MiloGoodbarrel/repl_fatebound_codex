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

export interface GroupConditionState {
  conditions: string[];
  conditionDurations?: Record<string, number>;
  memberConditions?: string[][];
  memberConditionDurations?: Array<Record<string, number>>;
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

type PreparedCombatant = {
  initiative: number;
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  initiativeRolled?: boolean;
  conditions?: string[];
  conditionDurations?: Record<string, number>;
  isDown?: boolean;
  isDead?: boolean;
  isStable?: boolean;
  isDisabled?: boolean;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  joiningNextRound?: boolean;
  memberHp?: number[];
  memberConditions?: string[][];
  memberConditionDurations?: Array<Record<string, number>>;
};

export function createPreparedEncounterSnapshot<TCombatant extends PreparedCombatant>(
  input: unknown,
): EncounterSnapshot<TCombatant> | null {
  const snapshot = normalizeEncounterSnapshot<TCombatant>(input);
  if (!snapshot) return null;
  if (snapshot.combatants.some(combatant =>
    !isRecord(combatant)
    || typeof combatant.initiative !== "number"
    || !Number.isFinite(combatant.initiative)
  )) return null;
  return {
    combatants: snapshot.combatants.map(combatant => {
      const cloned = structuredClone(combatant);
      const memberCount = cloned.memberHp?.length ?? 0;
      return {
        ...cloned,
        initiative: 0,
        initiativeRolled: false,
        hp: cloned.maxHp ?? cloned.hp,
        tempHp: 0,
        conditions: [],
        conditionDurations: undefined,
        isDown: false,
        isDead: false,
        isStable: false,
        isDisabled: false,
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        joiningNextRound: false,
        memberHp: memberCount > 0 ? Array(memberCount).fill(cloned.maxHp ?? cloned.hp ?? 0) : cloned.memberHp,
        memberConditions: memberCount > 0 ? Array.from({ length: memberCount }, () => []) : cloned.memberConditions,
        memberConditionDurations: memberCount > 0 ? Array.from({ length: memberCount }, () => ({})) : cloned.memberConditionDurations,
      } as TCombatant;
    }),
    round: 1,
    activeIndex: 0,
    combatState: "setup",
    selectedVersions: [...snapshot.selectedVersions],
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

/**
 * Older saved groups stored one shared condition list. Expand that state into
 * independent member copies before any member is changed.
 */
export function normalizeGroupConditionState(
  state: GroupConditionState,
  memberCount: number,
): NormalizedGroupConditionState {
  return {
    conditions: [],
    conditionDurations: undefined,
    memberConditions: Array.from({ length: memberCount }, (_, index) => [
      ...(state.memberConditions?.[index] ?? state.conditions),
    ]),
    memberConditionDurations: Array.from({ length: memberCount }, (_, index) => ({
      ...(state.memberConditionDurations?.[index] ?? state.conditionDurations ?? {}),
    })),
  };
}

export function setGroupMemberCondition(
  state: GroupConditionState,
  memberCount: number,
  memberIndex: number,
  condition: string,
  durationRounds?: number,
): NormalizedGroupConditionState {
  const normalized = normalizeGroupConditionState(state, memberCount);
  if (memberIndex < 0 || memberIndex >= memberCount) return normalized;

  const conditions = normalized.memberConditions[memberIndex];
  if (conditions.includes(condition)) {
    normalized.memberConditions[memberIndex] = conditions.filter(item => item !== condition);
    delete normalized.memberConditionDurations[memberIndex][condition];
  } else {
    normalized.memberConditions[memberIndex] = [...conditions, condition];
    if (durationRounds !== undefined) {
      normalized.memberConditionDurations[memberIndex][condition] = durationRounds;
    }
  }
  return normalized;
}

export interface GroupConditionTickResult extends NormalizedGroupConditionState {
  expired: Array<{ memberIndex: number; condition: string }>;
}

export function tickGroupMemberConditions(
  state: GroupConditionState,
  memberCount: number,
): GroupConditionTickResult {
  const normalized = normalizeGroupConditionState(state, memberCount);
  const expired: GroupConditionTickResult["expired"] = [];

  normalized.memberConditions.forEach((conditions, memberIndex) => {
    normalized.memberConditions[memberIndex] = conditions.filter(condition => {
      const remainingRounds = normalized.memberConditionDurations[memberIndex][condition];
      if (remainingRounds == null) return true;
      if (remainingRounds <= 1) {
        delete normalized.memberConditionDurations[memberIndex][condition];
        expired.push({ memberIndex, condition });
        return false;
      }
      normalized.memberConditionDurations[memberIndex][condition] = remainingRounds - 1;
      return true;
    });
  });

  return { ...normalized, expired };
}

export interface NormalizedGroupConditionState {
  conditions: [];
  conditionDurations: undefined;
  memberConditions: string[][];
  memberConditionDurations: Array<Record<string, number>>;
}
