---
name: Encounter save/restore
description: Mid-session encounter persistence — how combat state is saved to and restored from the DB.
---

## Rule
Full combat state is serialised to JSON and stored in `campaign_saved_encounters` (one row per campaign, upserted). Saving is explicit (button press), not auto-save. Restore banner appears automatically on load when a save exists and no combatants are in the tracker.

**Why:** DMs need to close the browser mid-session and pick up exactly where they left off.

## Schema
`campaign_saved_encounters`: `id`, `campaignId` (unique), `encounterData` (text/JSON), `savedAt` (timestamp)

## API routes (server/routes.ts)
- `GET  /api/campaigns/:id/encounter` — returns parsed JSON or null
- `PUT  /api/campaigns/:id/encounter` — upserts full combat state blob
- `DELETE /api/campaigns/:id/encounter` — clears the save

## Serialised payload
`{ combatants, round, activeIndex, combatState, selectedVersions }`

## Frontend (InitiativeTracker.tsx)
- `savedEncounterResult` query (`staleTime: Infinity`) — checked on mount
- `saveCurrentEncounter()` — PUT; shows toast on success
- `restoreEncounter()` — restores all state setters; hides banner
- `clearSavedEncounterRemote()` — DELETE; called by `resetCombat()`
- `showRestoreBanner` state — shown when save exists and combatants are empty
- Save button: gold outline, only visible when `combatState === "active" && activeCampaign`
