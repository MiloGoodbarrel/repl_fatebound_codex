import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { z } from "zod";
import { insertCampaignSchema } from "../shared/schema";

test("all locked copies of the affected dependencies include the security fixes", () => {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const floors = {
    "body-parser": [1, 20, 9],
    "postcss-selector-parser": [6, 1, 5],
    zod: [4, 6, 6],
  };
  for (const [name, floor] of Object.entries(floors)) {
    const copies = Object.entries(lock.packages).filter(([path]) => path.endsWith(`/node_modules/${name}`) || path === `node_modules/${name}`);
    assert.ok(copies.length > 0, `${name} must be present in the lockfile`);
    for (const [path, pkg] of copies) {
      const version = (pkg as { version: string }).version;
      const parts = version.split(".").map(Number);
      const comparison = parts[0] - floor[0] || parts[1] - floor[1] || parts[2] - floor[2];
      assert.ok(comparison >= 0 && !version.includes("-"), `${path}@${version} is below the patched release`);
    }
  }
});

test("bounded collection validation rejects oversized input before validating elements", () => {
  let visits = 0;
  const schema = z.array(z.string().superRefine(() => { visits++; })).max(2);
  const result = schema.safeParse(Array(1000).fill("entry"));
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.issues[0].code, "too_big");
  assert.equal(visits, 0);
});

test("Drizzle insert schemas use the same Zod errors as route handlers", () => {
  const valid = insertCampaignSchema.parse({ name: "Campaign", edition: "5e" });
  assert.equal(valid.name, "Campaign");
  const result = insertCampaignSchema.safeParse({ name: 123 });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error instanceof z.ZodError);
    assert.deepEqual(result.error.issues[0].path, ["name"]);
  }
});
