import assert from "node:assert/strict";
import test from "node:test";
import { homebrewDisposition } from "../shared/homebrewDisposition";

test("module civilian NPCs join as allies rather than enemies", () => {
  assert.deepEqual(homebrewDisposition([{ actionName: "Friendly NPC Profile" }]), {
    combatantType: "npc", stance: "ally", referenceOnly: false,
  });
});

test("neutral townfolk stay neutral while ordinary stat blocks stay enemies", () => {
  assert.equal(homebrewDisposition([{ actionName: "Neutral NPC Profile" }]).stance, "neutral");
  assert.deepEqual(homebrewDisposition([{ actionName: "Painted Slam" }]), {
    combatantType: "monster", stance: "enemy", referenceOnly: false,
  });
});

test("un-statted reference figures cannot silently become fabricated enemies", () => {
  assert.equal(homebrewDisposition([{ actionName: "Reference Only — No Printed Stat Block" }]).referenceOnly, true);
  assert.equal(homebrewDisposition([]).referenceOnly, false);
});
