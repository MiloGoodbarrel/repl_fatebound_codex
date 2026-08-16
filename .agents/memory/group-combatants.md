---
name: Group combatants
description: How group/horde combatants work in the Initiative Tracker — data model, functions, and UI.
---

## Rule
A group combatant (`isGroup: true`) represents a horde (e.g. 5 goblins) as one initiative entry. Per-member HP is tracked individually via `memberHp: number[]`. `maxHp` is the shared per-member max (monster stat-block average). `focusedMember` is UI-only state, kept in `groupFocused: Record<string, number>` (component state, not on the Combatant).

**Why:** One initiative slot per creature type is the common DM shorthand; individual HP still matters so you know when each one dies.

## Data model additions to Combatant
- `isGroup?: boolean`
- `memberHp?: number[]` — current HP per member; length = member count

## Key functions (InitiativeTracker.tsx)
- `addGroupToEncounter(monster, count, initiative?)` — creates the group combatant with individually rolled `memberHp` values
- `applyGroupDamage(id)` / `applyGroupHeal(id)` — operate on `memberHp[groupFocused[id]]`
- `addGroupMember(id)` / `removeGroupMember(id)` — grow/shrink the group at runtime
- `addHomebrewMonster(m, count?)` — count>1 routes to `addGroupToEncounter`

## UI
- Count stepper (−/+, 1–20) appears in the selected-monster preview and homebrew preview cards
- Button label changes to "Add Group ×N" when count > 1
- Combat card HP section: group shows clickable member token grid (`G1 9`, `G2 ☠`, …); clicking a token focuses it for damage/heal
- Subtitle under name shows `×N · M alive`
- HP controls: Dmg/Heal route to group functions; Temp HP hidden for groups; +/− buttons manage member count

## Group lifecycle
- All members dead → `isDown: true`, `isDead: true` (group removed from order on next render)
- Auto-focus advances to next alive member after a kill
