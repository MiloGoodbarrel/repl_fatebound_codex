---
name: Campaign content is additive
description: Defines how campaign selection affects shared content libraries.
---

## Rule
Selecting a campaign must never replace or hide the shared compendium, bestiary, loot deck, or stock roll tables. Campaign-owned content is an additional layer merged into the relevant global library.

**Why:** Custom campaigns may have no campaign-owned records yet. Treating campaign selection as a source switch makes otherwise healthy global tools appear empty or broken.

**How to apply:** Keep global content queries active whenever a campaign is selected. Pass the campaign identity only to include matching additions and enable campaign-scoped creation or management.

## Optional cross-campaign resources
Cross-campaign access is opt-in and limited to **linked**, not copied, items and NPCs/creatures. Do not share prepared encounters, party/player rosters, active combat saves, or loot/roll tables.

**Why:** After limiting scope to items and NPCs so users can make their own encounters and loot tables, the user corrected the sharing model: “Correction, linked items and NPCs not copied I miss spoke.”

**How to apply:** Resolve selected originals from their source campaign instead of cloning records. Source edits affect linked libraries; removing a link must not modify or delete the original. Source deletion removes its links. Keep source identity visible and do not create chained links. Existing encounter snapshots retain combat state rather than being rewritten when library data changes, because encounters remain campaign-owned.