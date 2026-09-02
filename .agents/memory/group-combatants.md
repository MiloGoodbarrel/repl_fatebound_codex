---
name: Group combatants
description: How group/horde combatants work in the Initiative Tracker — data model, functions, and UI.
---

## Rule
A group combatant represents a horde as one initiative entry, but HP, stacked conditions, and timed-condition durations belong to individual members. The focused member receives damage, healing, and condition changes.

**Why:** One initiative slot per creature type is the common DM shorthand, but one restrained or paralyzed creature must not apply that state to the entire group.

**How to apply:** Any member-targeted combat state must follow the focused unit. A group skips its initiative only when every living member is incapacitated or dead.

## Data model additions to Combatant
- `isGroup?: boolean`
- `memberHp?: number[]` — current HP per member; length = member count
- `memberConditions?: string[][]` — stacked conditions for each member
- `memberConditionDurations?: Array<Record<string, number>>` — remaining rounds per member and condition

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
