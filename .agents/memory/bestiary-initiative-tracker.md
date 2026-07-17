---
name: Bestiary Initiative Tracker integration
description: How the Initiative Tracker sources monster data and renders statblocks
---

## What was done
- Replaced external `dnd5eapi.co` monster source with local `bestiary_*` tables (1,367 monsters, 5e 2014 MM + expansion data).
- Added 3 backend routes under `/api/bestiary/`: `types`, `monsters` (search), `monsters/:id` (full detail with traits+actions).
- Storage methods: `getBestiaryTypes()`, `searchBestiary(search, types, limit)`, `getBestiaryMonsterDetail(monsterId)`.
- Frontend: live debounced search (300ms), collapsible type-filter checkboxes, selection preview card, `MonsterStatblock` component in each combat card.

## Key decisions

**No CR in bestiary CSV** — The `bestiary_monsters` table has no `challenge_rating` column (CSV stops at `cha_mod`). CR is shown as `"--"` in the UI.

**Why:** Source CSV simply doesn't include CR. Confirmed by checking 30-column CSV header.

**How to apply:** Don't add CR filtering/sorting features without first adding the column to the DB schema and re-seeding.

---

**OCR-corrupted creature types cleaned with SQL UPDATEs** — 15+ corrupted values (e.g., "Beas'T", "El~Mental", "Numanoid") were fixed with targeted UPDATE statements.

**Why:** CSV was OCR-scanned; some values were garbled.

**How to apply:** If new bestiary data is imported, run a similar cleanup pass on `creature_type` before exposing to the filter UI. Final clean types: Aberration, Beast, Celestial, Construct, Dragon, Elemental, Fey, Fiend, Fiend (Demon), Giant, Humanoid, Humanoid (Bullywug), Humanoid (Human), Monstrosity, Monstrosity (Shapechanger), Ooze, Plant, Swarm, Swarm of Tiny Beasts, Undead.

---

**Action categories in DB** — `bestiary_monster_actions.action_category` values are: `action` (2121), `legendary_action` (222), `reaction` (69), `lair_action` (24), `bonus_action` (17). `MonsterStatblock` shows `action` category in the main Actions section; others are summarized as "+ N bonus/legendary actions".

---

**Monster interface extended** — Added `strMod/dexMod/conMod/intMod/wisMod/chaMod`, `traits: BestiaryTrait[]`, `detailedActions: BestiaryDetailedAction[]`, `alignment`, `creatureTags`, `hitDiceCount`, `hitDieSize` fields to the existing `Monster` interface. Existing fields (`str`, `dex`, etc.) kept for backward compatibility.

---

**selectedMonsterId state** — The `selectedMonster` is now a React Query result fetched from `/api/bestiary/monsters/:id`. State is `selectedMonsterId: string | null`. When user clicks a search result, `setSelectedMonsterId(monster.index)` is called. `addMonster()` calls `setSelectedMonsterId(null)` to reset.
