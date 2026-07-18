# Routines — Heroes, Slots, Leveling, Frozen Recovery

## Concept
Routines are "Heroes" living in the Base, with health, XP, and levels. They organize habits (and tasks) into meaningful groups.

## Creation & Membership
- Create a routine from existing habits or by creating new habits inside it.
- Routine habits are tagged with the routine name; the Habits tab still lists ALL habits.
- Routine habits are created/managed under the Routine tab.

## Slots & Leveling
- Routine starts at level 1 with 1 habit slot + 1 task slot; each level unlocks more slots.
- Routines earn XP when their tasks/habits are completed.
- PLAYER level-ups unlock additional routine slots (more concurrent routines); base visuals upgrade to house more heroes.

## Health
Enemies that get inside the base (item overdue > 1 hour) damage the health of the routine they belong to.

## Spawning (implemented 2026-07-18)
Both routine habits and routine tasks spawn DAILY. Habits use their `timeOfDay` bucket (morning/afternoon/evening/anytime); tasks use the definition's `HH:MM` `defaultDueTime`. Instances are ordinary `type: 'habit'`/`type: 'task'` items carrying a `definitionId`, so damage, completion and sorting treat them like any manually-created item. Each generator dedupes per day against `activeItems` (already spawned) and completion (habits via `lastCompletionDate`, tasks via `completedItems`).

## Activation & Deactivation
Routines can be deactivated (vacation/seasonal) and reactivated; deactivated routines spawn no enemies.

> **NOT YET IMPLEMENTED (as of 2026-07-18).** `isActive` is currently inert: both generators iterate every definition regardless of routine membership or active state, and `toggleRoutineActive` only flips the flag. Tracked as a ROADMAP item — see DECISIONS.md 2026-07-18.

## Frozen Routine Slots (canonical spec — from PROJECT_SPEC.md)
- A NEGATIVE habit streak of 3+ days (indulging 3 days running) FREEZES the associated routine slot.
- Frozen slots appear greyed out, with a notification explaining the freeze and recovery options. Frozen routines remain viewable so the user can identify needed adjustments.
- **Recovery, two paths:**
  1. Edit the habit's details (any change counts; change tracking records what was modified), OR
  2. Successfully avoid the negative habit for 3 consecutive days while it stays active.
- Daily check-in prompt (morning or first login) asks individual confirmation for each incomplete negative habit, validating avoidance streaks.

## Routine A/B Testing
Run one routine variant for 6 weeks, another for the next 6; compare streaks/performance. Routine View ranks routines by level (top performers first).
