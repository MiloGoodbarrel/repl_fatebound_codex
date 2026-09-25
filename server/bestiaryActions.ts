const GRIM_HOLLOW_PREFIX = "dnd_5e2014_ghmg_";

type ActionRow = Record<string, string>;

// The base CSV contains an older Grim Hollow extraction with different IDs.
// Only the dedicated, restored file is authoritative for these creatures.
export function combineBestiaryActions<T extends ActionRow>(base: T[], grimHollow: T[]): T[] {
  const actions = [
    ...base.filter(row => !row.monster_id.startsWith(GRIM_HOLLOW_PREFIX)),
    ...grimHollow,
  ];
  const ids = new Set<string>();
  for (const action of actions) {
    if (!action.action_id?.trim() || ids.has(action.action_id)) {
      throw new Error(`Missing or duplicate bestiary action ID: ${action.action_id}`);
    }
    ids.add(action.action_id);
  }
  return actions;
}

type DetailAction = {
  actionName?: string | null;
  actionDescription?: string | null;
  actionCategory?: string | null;
  attackBonus?: number | null;
  reachFt?: number | null;
  saveAbility?: string | null;
  saveDc?: number | null;
  damageDice?: string | null;
  damageType?: string | null;
};

export function mapBestiaryActions(actions: DetailAction[]) {
  return {
    detailedActions: actions.map(a => ({
      name: a.actionName || "",
      description: a.actionDescription || "",
      category: a.actionCategory || "action",
      attackBonus: a.attackBonus ?? undefined,
      reachFt: a.reachFt ?? undefined,
      saveAbility: a.saveAbility ?? undefined,
      saveDc: a.saveDc ?? undefined,
      damageDice: a.damageDice ?? undefined,
      damageType: a.damageType ?? undefined,
    })),
    actions: actions
      .filter(a => a.actionCategory === "action" || a.actionCategory === "standard")
      .map(a => ({ name: a.actionName || "", desc: a.actionDescription || "", attack_bonus: a.attackBonus })),
  };
}