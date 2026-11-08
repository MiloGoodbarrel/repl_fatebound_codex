---
name: Encounter save/restore
description: Product intent distinguishing resumable combat state from reusable prepared rosters.
---

## Rule
Resumable combat must preserve the session as played, while prepared encounters are reusable starting rosters. Do not treat saving a reusable roster as permission to overwrite a recoverable combat session.

**Why:** DMs need to close the browser mid-session and pick up exactly where they left off.

**How to apply:** Keep recovery and reusable-template flows distinct. Inspect current autosave behavior before changing persistence; older notes incorrectly described saving as manual-only.

## Multi-editor saves
An increasing client timestamp does not establish that a snapshot includes another editor's changes. Encounter writes and destructive clears require an exact, atomically checked base version, not simply a "newer timestamp wins" rule.

**Why:** The external audit demonstrated a tab with stale HP overwriting another tab's changes when an unrelated combatant was edited.

**How to apply:** Keep a tab's base tied to the snapshot actually loaded or successfully saved. Background reads must not silently authorize saving an older local snapshot against a newer base. On conflict, preserve the local draft and require explicit recovery before allowing further writes. Merely viewing or restoring an unchanged encounter should not write it back.
