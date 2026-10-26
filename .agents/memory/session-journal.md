---
name: Session journal needs
description: User's requested campaign session notes workflow and recording source.
---

The user needs a place for DM notes during gameplay and records sessions using Echo – AI Meeting Note Taker by Tappz Labs (App Store ID 6738732089). They approved proceeding with the session journal/import direction and campaign-aware spelling correction review.

**Why:** The user identified this need from actual D&D play and described a meeting-facilitator-style workflow.

**How to apply:** Preserve original imported text separately from corrected text. Suggest names from the selected campaign's existing resources, including explicit resource links, and let the DM review ambiguous matches, approve occurrences, undo corrections, and explicitly remember campaign-specific aliases. Do not silently rewrite source records or unrelated campaigns. Direct Echo synchronization and in-app recording remain unapproved; avoid promising export formats that have not been verified.

Recordings are deliberately limited to small, private durable database-backed files instead of introducing a separate storage service. Correction candidates preserve import-time canonical-name snapshots; current authorization must still be checked before showing or applying them.

**Why:** The journal must remain auditable if campaign resources are renamed, and recordings must not depend on a public file URL or temporary application disk. The existing database provides persistence and deletion together without a new integration.

**How to apply:** Do not silently switch to public/static recording storage or recompute already approved names from renamed resources. Revisit the bounded database-file choice if the product needs large recording archives.

Private drafts must stay recoverable during every in-app navigation path, not just clicked links.

**Why:** SPA browser Back/Forward and programmatic route changes do not trigger `beforeunload`; best-effort saving on unmount cannot preserve a draft when that save fails.

**How to apply:** Keep the existing workspace mounted until a route transition passes its draft guard, including history navigation. Exercise failed saves with browser Back and non-anchor route changes when changing journal navigation.
