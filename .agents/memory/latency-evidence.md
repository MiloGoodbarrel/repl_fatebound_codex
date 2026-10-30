---
name: Latency evidence boundaries
description: Interpreting sparse latency alerts and choosing safe campaign-library performance fixes.
---

Do not equate a slow API-handler log with the full latency reported by endpoint telemetry, or treat a mixed-route p95 based on very few requests as proof of one common cause.

**Why:** An investigation found independently slow homebrew reads and authentication-provider proxy requests. The API handler logs exclude earlier authorization work, and reducing database round trips could not establish the cause of the separate proxy delay.

**How to apply:** Separate measured query amplification from unproven upstream or cold-start effects. Validate query counts, returned data, ordering and authorization in the workspace; do not claim a handler optimization proves end-to-end recovery.

Prefer request-local batching of associated library data after ownership filtering over a shared cache of private campaign records.

**Why:** Batching removes serial database round trips without introducing stale permissions or cross-account cache-key risks.

**How to apply:** First determine the authorized record IDs, then fetch their associated rows together. Preserve per-record ordering, linked-source metadata and error propagation, including the empty-library case.
