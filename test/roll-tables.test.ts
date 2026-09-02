import assert from "node:assert/strict";
import test from "node:test";
import { STOCK_ROLL_TABLES, type RollTable } from "../shared/rollTables";
import { selectRollTableEntry } from "../shared/rollTableDraw";
import { rollTableInputSchema } from "../shared/schema";

test("stock catalog covers the core DM table categories", () => {
  const categories = new Set(STOCK_ROLL_TABLES.map(table => table.category));
  for (const category of ["Trinkets", "Magic", "Wilderness", "NPCs", "Settlements", "Dungeons", "Adventure", "Social"]) {
    assert.equal(categories.has(category), true, `missing ${category}`);
  }
  assert.ok(STOCK_ROLL_TABLES.length >= 20);
  assert.ok(STOCK_ROLL_TABLES.every(table => table.entries.length >= 10));
});

test("range draws honor the first and last result bounds", () => {
  const table = STOCK_ROLL_TABLES.find(candidate => candidate.id === "stock-trinkets");
  assert.ok(table);
  const first = selectRollTableEntry(table, () => 0);
  const last = selectRollTableEntry(table, () => 0.999999);
  assert.equal(first.roll, 1);
  assert.equal(first.entry.text, table.entries[0].text);
  assert.equal(last.roll, 12);
  assert.equal(last.entry.text, table.entries[11].text);
});

test("weighted draws honor entry weights", () => {
  const table: RollTable = {
    id: "weighted",
    name: "Weighted",
    description: "",
    category: "Test",
    mode: "weighted",
    source: "stock",
    entries: [
      { entryOrder: 0, text: "common", weight: 3 },
      { entryOrder: 1, text: "rare", weight: 1 },
    ],
  };
  assert.equal(selectRollTableEntry(table, () => 0).entry.text, "common");
  assert.equal(selectRollTableEntry(table, () => 0.74).entry.text, "common");
  assert.equal(selectRollTableEntry(table, () => 0.99).entry.text, "rare");
});

test("custom table input accepts ranges and rejects blank entries", () => {
  const valid = rollTableInputSchema.safeParse({
    campaignId: 1,
    name: "Road Events",
    description: "",
    category: "Travel",
    mode: "range",
    entries: [{ text: "A merchant approaches.", minRoll: 1, maxRoll: 2 }],
  });
  assert.equal(valid.success, true);

  const invalid = rollTableInputSchema.safeParse({
    campaignId: 1,
    name: "Broken",
    category: "Travel",
    mode: "weighted",
    entries: [{ text: "", weight: 1 }],
  });
  assert.equal(invalid.success, false);
});

test("custom range tables reject gaps and overlaps", () => {
  const base = {
    campaignId: 1,
    name: "Road Events",
    description: "",
    category: "Travel",
    mode: "range" as const,
  };
  const gap = rollTableInputSchema.safeParse({
    ...base,
    entries: [
      { text: "One", minRoll: 1, maxRoll: 1 },
      { text: "Three", minRoll: 3, maxRoll: 3 },
    ],
  });
  const overlap = rollTableInputSchema.safeParse({
    ...base,
    entries: [
      { text: "Low", minRoll: 1, maxRoll: 3 },
      { text: "High", minRoll: 3, maxRoll: 4 },
    ],
  });
  assert.equal(gap.success, false);
  assert.equal(overlap.success, false);
});

test("range draws fail explicitly when an uncovered value reaches the draw engine", () => {
  const malformed: RollTable = {
    id: "malformed",
    name: "Malformed",
    description: "",
    category: "Test",
    mode: "range",
    source: "stock",
    entries: [
      { entryOrder: 0, text: "One", minRoll: 1, maxRoll: 1 },
      { entryOrder: 1, text: "Three", minRoll: 3, maxRoll: 3 },
    ],
  };
  assert.throws(() => selectRollTableEntry(malformed, () => 0.5), /No roll table entry covers result 2/);
});