---
name: PDF import trust
description: Privacy and fidelity decisions for end-user module imports.
---

PDF library imports must remain usable without an external AI account. External AI is an optional future decision, not an implicit dependency or fallback.

**Why:** The user deferred choosing an AI provider and asked for PDF importing alongside the existing CSV workflow.

**How to apply:** Keep extraction private, require human review before saving, and disclose recognition limits. Do not infer combat statistics or turn unusual module mechanics into conventional fifth-edition statistics without the user's decision. Imported resources belong to the selected campaign and must not overwrite its existing collection.

Authenticated QA must exercise real provider-issued test sessions, normal authorization, and actual persistence using fictional fixtures; simulated principals and mocked responses cannot establish end-to-end account isolation.

**Why:** The user explicitly required authenticated accounts and the actual database, with no auth bypass or real campaign content.

**How to apply:** Restrict identities to temporary development test users, verify records after reload and across separate accounts, and explicitly clean up every fixture, including child rows without cascading foreign keys. Distinguish synthetic/mock coverage from real signed-in evidence in reports.

Retry protection identifies a reviewed save operation, not the PDF or its content.

**Why:** The user requires interrupted saves to be safely retried while deliberately acknowledged duplicate imports remain possible.

**How to apply:** Preserve the operation identity and reviewed payload while the outcome is uncertain. A fresh intentional import must have a new identity even when its content is identical; never replace this with content-based deduplication.

Module reference and content extraction have different trust and fidelity goals.
Preserve adventure layout, maps and handouts in the reader; adapt the surrounding
workspace rather than rewriting the PDF. Uploading or reading is not approval to
change the campaign's game records.

**Why:** The DM wants the selected adventure available during live play, including
large illustrated modules, without disturbing the active fight or prepared content.

**How to apply:** Keep private reference storage and viewer limits independent of
reviewed statblock extraction. Planning exports may become reference documents,
but must not silently become played journal history or library imports.
