import type { RollTable, RollTableEntry } from "./rollTables";

export interface RollTableSelection {
  roll: number;
  entry: RollTableEntry;
}

export function selectRollTableEntry(
  table: Pick<RollTable, "mode" | "entries">,
  random: () => number = Math.random,
): RollTableSelection {
  const entries = table.entries.filter(entry => entry.text.trim());
  if (entries.length === 0) throw new Error("Cannot draw from an empty roll table");

  if (table.mode === "weighted") {
    const totalWeight = entries.reduce((sum, entry) => sum + Math.max(1, entry.weight ?? 1), 0);
    const roll = Math.floor(random() * totalWeight) + 1;
    let cumulativeWeight = 0;
    const entry = entries.find(candidate => {
      cumulativeWeight += Math.max(1, candidate.weight ?? 1);
      return roll <= cumulativeWeight;
    }) ?? entries[entries.length - 1];
    return { roll, entry };
  }

  const min = Math.min(...entries.map((entry, index) => entry.minRoll ?? index + 1));
  const max = Math.max(...entries.map((entry, index) => entry.maxRoll ?? index + 1));
  const roll = Math.floor(random() * (max - min + 1)) + min;
  const entry = entries.find((candidate, index) => {
    const low = candidate.minRoll ?? index + 1;
    const high = candidate.maxRoll ?? low;
    return roll >= low && roll <= high;
  });
  if (!entry) throw new Error(`No roll table entry covers result ${roll}`);
  return { roll, entry };
}