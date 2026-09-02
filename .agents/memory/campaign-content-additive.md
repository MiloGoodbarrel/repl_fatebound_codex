---
name: Campaign content is additive
description: Defines how campaign selection affects shared content libraries.
---

## Rule
Selecting a campaign must never replace or hide the shared compendium, bestiary, loot deck, or stock roll tables. Campaign-owned content is an additional layer merged into the relevant global library.

**Why:** Custom campaigns may have no campaign-owned records yet. Treating campaign selection as a source switch makes otherwise healthy global tools appear empty or broken.

**How to apply:** Keep global content queries active whenever a campaign is selected. Pass the campaign identity only to include matching additions and enable campaign-scoped creation or management.