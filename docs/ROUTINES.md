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

## Activation & Deactivation (implemented 2026-07-18)
Routines can be deactivated (vacation/seasonal) and reactivated. Deactivating a routine does two things immediately, via `toggleRoutineActive`:
- **Stops future spawning** — `generateDailyRoutineTaskInstances` only spawns task definitions belonging to a currently-active routine. For habits, gating applies only to habits a routine actually OWNS (`habitDef.routineId`, or membership in `habitDefinitionIds`): a STANDALONE habit — created outside any routine — always spawns daily and is unaffected by routine state. Removing a habit from a routine (`removeHabitFromRoutine`) RELEASES it to standalone, keeping its streak and resuming daily spawns; it does not go inert. (Revised 2026-07-18 — the earlier "orphaned definitions are inert" rule also silently blocked every standalone habit. See DECISIONS.md.) Orphaned routine TASK definitions are still inert, since there's no standalone task-definition concept.
- **Recalls active enemies** — any of the routine's habit/task instances currently on the board are removed immediately (`clearActiveInstancesForRoutine`), including any sub-tasks of a recalled routine task. This is a pure removal: no completion credit, no XP/points, no streak change, no damage penalty — the routine "went on vacation," it didn't get finished. Uses the same `removeItem()` path as any other removal.

**Reactivating a routine spawns today's due instances immediately** (fixed 2026-07-18, same day as the gating fix above — the first version of this made activation spawn nothing until the next daily pass/reload, which Jeremy hit live: create a routine, add a task, activate it, nothing appeared). `toggleRoutineActive` calls both daily generators on the inactive→active transition, the direct counterpart to the immediate recall on active→inactive.

## Frozen Routine Slots (canonical spec — from PROJECT_SPEC.md)
- A NEGATIVE habit streak of 3+ days (indulging 3 days running) FREEZES the associated routine slot.
- Frozen slots appear greyed out, with a notification explaining the freeze and recovery options. Frozen routines remain viewable so the user can identify needed adjustments.
- **Recovery, two paths:**
  1. Edit the habit's details (any change counts; change tracking records what was modified), OR
  2. Successfully avoid the negative habit for 3 consecutive days while it stays active.
- Daily check-in prompt (morning or first login) asks individual confirmation for each incomplete negative habit, validating avoidance streaks.
  **BUILT 2026-07-19 (sub-session 4, [P1-DATA-005]):** the check-in SURFACE only
  (frozen slots themselves remain unbuilt — separate ticket above). At restore-path
  rollover, the negative habit's lurker instance for the SINGLE most recent prior
  day is no longer silently auto-resolved — `js/dayRollover.js`'s
  `isFromPreviousDay` + `state.js`'s rollover routing instead route it to
  `Items.markPendingCheckIn`, which records an additive `pendingCheckIn:
  { originalDueDate }` marker on the habit definition (no schema bump — absent on
  every pre-existing habit/save, same precedent as `definedTasks`) and removes the
  lurker so today's fresh one spawns without a duplicate. On next page load,
  `js/ui/checkIn.js`'s `showCheckInModal` renders one card per pending habit:
  "Did you successfully avoid [name] yesterday?" with **Successfully avoided** /
  **I indulged** buttons (`Items.resolvePendingCheckIn`, mirroring
  `settleStaleRecurringInstance`'s avoid path / `indulgeHabit`'s debit path
  respectively) plus the spec's "I'll check this later" snooze — a plain
  in-session `setTimeout` (`CONFIG.CHECK_IN_SNOOZE_MS`, 4 hours), NOT persisted
  across reload (a reload before 4 hours just re-prompts immediately; this ticket
  built the surface, not a scheduling system). Days OLDER than the previous day
  still auto-resolve as avoided via the existing `settleStaleRecurringInstance`
  path (session 26's generous default) — this surface never sees those.

## Routine A/B Testing
Run one routine variant for 6 weeks, another for the next 6; compare streaks/performance. Routine View ranks routines by level (top performers first).
