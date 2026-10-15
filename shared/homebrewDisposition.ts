/** Profile labels distinguish social NPCs and un-statted references from enemy stat blocks. */
export function homebrewDisposition(actions: Array<{ actionName: string | null }>, profile?: {
  disposition?: { combatantType: "monster" | "npc"; stance: "ally" | "neutral" | "enemy"; referenceOnly: boolean };
} | null): {
  combatantType: "monster" | "npc";
  stance: "ally" | "neutral" | "enemy";
  referenceOnly: boolean;
} {
  if (profile?.disposition) return profile.disposition;
  const names = new Set(actions.map(action => action.actionName));
  if (names.has("Reference Only — No Printed Stat Block")) {
    return { combatantType: "npc", stance: "neutral", referenceOnly: true };
  }
  if (names.has("Friendly NPC Profile")) {
    return { combatantType: "npc", stance: "ally", referenceOnly: false };
  }
  if (names.has("Neutral NPC Profile")) {
    return { combatantType: "npc", stance: "neutral", referenceOnly: false };
  }
  return { combatantType: "monster", stance: "enemy", referenceOnly: false };
}
