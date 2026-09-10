import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  applyGroupDamage,
  completeEncounterQuery,
  completeEncounterReset,
  createPreparedEncounterSnapshot,
  createEncounterRestoreState,
  shouldApplyEncounterRevision,
  sortCombatantsPreservingActiveTurn,
} from "../shared/encounterRecovery";
import { encounterRevisionConflictPredicate } from "../server/encounterPersistence";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

test("restores the current autosaved encounter snapshot", () => {
  const combatant = { id: "goblin", initiative: 18, hp: 7 };
  const snapshot = createEncounterRestoreState({
    data: {
      combatants: [combatant],
      round: 4,
      activeIndex: 0,
      combatState: "active",
      selectedVersions: ["5e"],
      saveRevision: 42,
    },
    savedAt: "2026-08-30T12:00:00.000Z",
  });

  assert.deepEqual(snapshot, {
    combatants: [combatant],
    round: 4,
    activeIndex: 0,
    combatState: "active",
    selectedVersions: ["5e"],
    saveRevision: 42,
    showVersionDialog: false,
    showRestoreBanner: false,
    autoSaveReady: true,
  });
});

test("restores legacy snapshots without autosave metadata", () => {
  const combatant = { id: "fighter", initiative: 12, hp: 10 };
  const snapshot = createEncounterRestoreState({
    combatants: [combatant],
  });

  assert.deepEqual(snapshot, {
    combatants: [combatant],
    round: 1,
    activeIndex: 0,
    combatState: "active",
    selectedVersions: [],
    saveRevision: undefined,
    showVersionDialog: false,
    showRestoreBanner: false,
    autoSaveReady: true,
  });
});

test("an older save revision cannot overwrite a newer snapshot", () => {
  assert.equal(shouldApplyEncounterRevision({ saveRevision: 12 }, { saveRevision: 11 }), false);
  assert.equal(shouldApplyEncounterRevision({ saveRevision: 12 }, { saveRevision: 12 }), true);
  assert.equal(shouldApplyEncounterRevision({ saveRevision: 12 }, { saveRevision: 13 }), true);
  assert.equal(shouldApplyEncounterRevision({ combatants: [] }, { combatants: [] }), true);

  const dialect = new PgDialect();
  const generated = dialect.sqlToQuery(encounterRevisionConflictPredicate(11));
  assert.match(generated.sql, /encounter_data.*saveRevision.*<= \$1/);
  assert.deepEqual(generated.params, [11]);
});

test("a pending saved encounter result is ignored after switching campaigns", async () => {
  let activeCampaignId = 1;
  const pendingQuery = deferred<{ combatants: string[] }>();
  const guardedResult = pendingQuery.promise.then(result =>
    completeEncounterQuery(1, activeCampaignId, result),
  );

  activeCampaignId = 2;
  pendingQuery.resolve({ combatants: ["stale goblin"] });

  assert.equal(await guardedResult, null);
});

test("a pending reset cannot re-enable autosave for a different campaign", async () => {
  let activeCampaignId = 1;
  const pendingReset = deferred<void>();
  const finishReset = pendingReset.promise.then(() =>
    completeEncounterReset(1, activeCampaignId),
  );

  activeCampaignId = 2;
  pendingReset.resolve();

  assert.equal(await finishReset, null);
});

test("initiative correction preserves the combatant currently taking a turn", () => {
  const combatants = [
    { id: "active", initiative: 10 },
    { id: "other", initiative: 20 },
    { id: "third", initiative: 5 },
  ];
  const result = sortCombatantsPreservingActiveTurn(
    combatants,
    { id: "third", initiative: 30 },
    "active",
  );

  assert.deepEqual(result.combatants.map(combatant => combatant.id), ["third", "other", "active"]);
  assert.equal(result.activeIndex, 2);
});

test("group remains active when one member reaches 0 HP", () => {
  const result = applyGroupDamage([8, 6, 7], 1, 6);
  assert.deepEqual(result.memberHp, [8, 0, 7]);
  assert.equal(result.isDown, false);
  assert.equal(result.isDead, false);
});

test("loading a prepared encounter creates a fresh setup copy with unrolled initiative", () => {
  const source = {
    combatants: [{
      id: "wolf-pack",
      initiative: 18,
      hp: 4,
      maxHp: 11,
      conditions: ["Poisoned"],
      isDown: true,
      isDead: false,
      isStable: false,
      deathSaveSuccesses: 1,
      deathSaveFailures: 2,
      memberHp: [0, 7, 11],
      memberConditions: [["Unconscious"], ["Poisoned"], []],
      memberConditionDurations: [{}, { Poisoned: 2 }, {}],
    }],
    round: 5,
    activeIndex: 2,
    combatState: "active",
    selectedVersions: ["5e"],
  };

  const prepared = createPreparedEncounterSnapshot(source);
  assert.ok(prepared);
  assert.equal(prepared.combatState, "setup");
  assert.equal(prepared.round, 1);
  assert.equal(prepared.activeIndex, 0);
  assert.equal(prepared.combatants[0].initiative, 0);
  assert.equal(prepared.combatants[0].hp, 11);
  assert.deepEqual(prepared.combatants[0].memberHp, [11, 11, 11]);
  assert.deepEqual(prepared.combatants[0].memberConditions, [[], [], []]);
  assert.deepEqual(source.combatants[0].memberHp, [0, 7, 11]);
  assert.deepEqual(source.combatants[0].conditions, ["Poisoned"]);
});