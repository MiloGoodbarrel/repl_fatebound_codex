---
name: Dependency override verification
description: Why dependency security fixes require checking resolved packages, not only override declarations.
---

Verify every installed and locked copy after adding dependency overrides, including copies at the root.

**Why:** npm 10 retained vulnerable root copies after adding version-qualified overrides, even though nested copies were updated and installation succeeded. Unqualified overrides resolved the affected copies.

**How to apply:** For security updates, inspect the dependency tree and lockfile and compare all copies against the advisory's patched ranges before declaring the fix complete.
