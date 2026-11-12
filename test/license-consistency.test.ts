import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("application and lockfile declare the owner-selected GPL v3 only license", () => {
  const manifest = JSON.parse(read("package.json"));
  const lockfile = JSON.parse(read("package-lock.json"));
  assert.equal(manifest.license, "GPL-3.0-only");
  assert.equal(lockfile.packages[""].license, manifest.license);
  assert.match(read("LICENSE"), /GNU GENERAL PUBLIC LICENSE\s+Version 3, 29 June 2007/);
  assert.match(read("LICENSE"), /Copyright \(C\) 2007 Free Software Foundation, Inc\./);
});

test("README states GPL v3 only and excludes third-party rights from its grant", () => {
  const readme = read("README.md");
  assert.match(readme, /GPL-3\.0-only/);
  assert.match(readme, /not\s+version 3 or any later version/);
  assert.match(readme, /© 2026 Luis Ramirez/);
  assert.match(readme, /does \*\*not\*\* grant rights to third-party game\s+material/);
  assert.match(readme, /Dependencies retain their own licenses/);
  assert.match(readme, /Source citations identify provenance, not permission to redistribute/);
});
