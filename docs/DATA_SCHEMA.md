# Data Schema — State Objects & Persistence

TARGET schema for the persistence work (Milestone 1) and modularization. The monolith's current in-memory shapes differ — reconcile toward these during extraction. Deep detail: Grep PROJECT_SPEC.md section 4 (Data Architecture). If shapes change, update this file in the same session.

## Storage
- `localStorage`, key prefix `deadline.`
- `deadline.save` — full serialized state (JSON) with `schemaVersion` for migrations
- `deadline.settings` — user preferences, SEPARATE from `deadline.save`/`schemaVersion` (not run
  state — survives dev Reset and fresh runs; synchronous read/write, no debounce). First field
  landed ([P2-UI-009], Milestone 4, session 59, 2026-07-19): `effectsIntensity`
  (`'full' | 'reduced' | 'off'`, default `'full'`) gates the streak fire visual — see
  MECHANICS.md/UI_UX.md. `js/settings.js` owns load/save/validation (bad or missing data always
  falls back to `'full'`, never throws).
- Save on every state mutation (debounced), load on boot. Cross-tab sync later via `storage` events.

### schemaVersion 9 (2026-07-19): banked slot points — `routine.boughtHabitSlots`/`boughtTaskSlots` landed
Sub-session 4 of [P1-UI-006] (see docs/HEROES_PLAN.md + docs/ROUTINES.md's "Slot Enforcement —
Banked Slot Points"). Two new fields on `Routine`, both additive ints, default 0:
`boughtHabitSlots`/`boughtTaskSlots` — the count of slots actually PURCHASED with a banked point,
beyond the level-1 baseline of 1 each. Slot capacity = baseline + bought (`Heroes.slotCapacity`).
Deliberately NOT storing a `slotPoints` balance (the plan text's original suggestion): AVAILABLE
points are derived on demand from `routine.level` (`Heroes.availableSlotPoints` = min(level-1, 8)
minus total spent) rather than persisted/incremented, so revisiting a level (via an XP
uncompletion-refund de-level followed by re-completing back up) can never re-mint a point — see
DECISIONS.md session 44 for the exploit this closes. v8→v9 migration in `js/persistence.js` just
seeds both fields to 0 for pre-v9 routines.

### schemaVersion 8 (2026-07-19): hero/routine progression fields landed
Sub-session 1 of [P1-UI-006] (see docs/HEROES_PLAN.md session 41 + docs/ROUTINES.md). Five new
fields on `Routine`, all additive: `xp: number` (earned when member items complete —
`CONFIG.ROUTINE_XP_PER_TASK`/`ROUTINE_XP_PER_HABIT`, 10/5; a frozen or INACTIVE routine earns
nothing via `FrozenSlots.isRoutineSuspended`), `level: number` (DERIVED from xp against
`CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS` — deliberately NOT monotonic like the player's level: an
uncompletion refund can de-level, making complete→uncomplete a perfect round-trip by construction),
`health: number` (seeded 100 = `ROUTINE_MAX_HEALTH`; damage wiring is sub-session 2), `createdAt:
ms` (star-rating window start = `max(createdAt, runStartedAtMs)`; migration seeds pre-v8 routines
with `runStartedAtMs` as best-available birthday), and `koState: { koAt } | null` (set by
sub-session 2's KO-at-0 path; null = fine). Also NEW on completed/active ITEMS (no migration
needed — absent means "nothing awarded"): `routineXpAwarded: number` — a stamp `Items.completeItem`
leaves on a routine-owned item recording exactly what its routine earned, which
`Items.uncompleteItem` refunds off (stamp beats re-checking conditions — a freeze/deactivation
between complete and uncomplete can't break refund symmetry; the streak-bonus-asymmetry lesson).
Star ratings (`Heroes.completionRate`/`starRating`, spec tiers 60/70/80/90/95% → 1-5★) are
computed fresh from habit `occurrenceHistory`, never persisted. v7→v8 migration in
`js/persistence.js`. See DECISIONS.md session 41.

### schemaVersion 6 (2026-07-19): frozen routine slots — `routine.frozenState` + habit `modificationHistory` landed
Sub-session 1 of the "Frozen routine slots + recovery" ticket (see docs/FROZEN_SLOTS_PLAN.md
session 35 Fable + docs/ROUTINES.md). `Routine.frozenState: { frozenBy: habitDefId, frozenAt:
ISOString } | null` — `null` = not frozen; set when a routine-owned negative habit hits
`CONFIG.FREEZE_THRESHOLD_DAYS` (3) consecutive indulged days, cleared by recovery path 2 (3
consecutive avoided days by the SAME habit) via `js/frozenSlots.js`'s pure counting functions.
`Habit.modificationHistory: { timestamp: ISOString, changedFields: string[] }[]` — empty array
seeded now so a later sub-session (recovery path 1, "edit the habit to unfreeze") is
migration-free. Both counts read directly off the existing `occurrenceHistory` array — a
Cheat/Sick/Skip-Day-excused day records no occurrence at all, so it's transparent to both
runs (neither breaks nor advances them) by construction. v5→v6 migration in `js/persistence.js`
seeds `frozenState: null` on every routine and `modificationHistory: []` on every habit def.
Spawn gating (frozen routine stops spawning its OTHER definitions) and the frozen-state UI are
NOT yet built — later sub-sessions. See DECISIONS.md 2026-07-19.

**Sub-session 4 BUILT 2026-07-19 (session 38):** `modificationHistory` is now actually written.
`Routines.editHabitInRoutine` appends one entry per real edit (diffs against the habit's current
values first — a no-op Save appends nothing) and, when the edit is to the habit currently holding
its routine's freeze, clears `frozenState` as recovery path 1. No schema change — the field and its
shape were already seeded by sub-session 1's v5→v6 migration above; this just starts populating it.

### schemaVersion 7 (2026-07-19): Sick Day (global) + Skip Day (per-habit) tokens landed
Sub-session 5 of the "Frozen routine slots + recovery" ticket, the ticket's final piece (see
docs/FROZEN_SLOTS_PLAN.md session 35 Fable fork 4 + docs/ECONOMY.md). Two new fields, additive:
top-level `sickDayDate: ISODateString | null` (GLOBAL — one active Sick Day excuses every habit for
that occurrence date) and `Habit.skipDayDate: ISODateString | null` (PER-HABIT — mirrors
`cheatDayDate`'s shape but pauses the habit entirely rather than excusing an indulgence). "Clear
immediately" model (Jeremy's call, 2026-07-19): unlike Cheat Day, applying either token doesn't wait
for a later indulge/rollover check — it removes every currently-spawned matching habit instance from
the board at the moment of use (`Items.useSickDayGlobally`/`useSkipDayOnItem`), so no occurrence is
ever recorded for that day (streak/points/xp untouched by construction — nothing reaches those
paths). The date fields still matter afterward purely as a same-day spawn-gate
(`Habits.selectHabitDefsToSpawn`'s optional 5th `sickDayDate` param + the per-habit `skipDayDate`
check) so a same-day reload can't respawn a fresh instance in the removed one's place — this
self-expires the next calendar day without any explicit clearing needed. v6→v7 migration in
`js/persistence.js` seeds `sickDayDate: null` at the top level and `skipDayDate: null` on every
habit def. Transparent to freeze/recovery counts (fork 2's principle: no occurrence, nothing to
count). Routine tasks are untouched — Sick Day is habits-only (fork 4). See DECISIONS.md 2026-07-19.

### schemaVersion 4 (2026-07-18): shop `inventory` landed
Top-level `inventory: { [shopItemId]: heldCount }` added for the shop ([P1-UI-008],
SHOP_PLAN.md session 1). Absent key = 0 held. Owned in script.js (`playerInventory`),
threaded via `getPlayerInventory`/`setPlayerInventory` accessor deps, persisted in
`getPersistableState` / restored in `restoreGameState` (both in `js/state.js`), reset to
`{}` by `initGame`. The v3→v4 migration seeds `{}` on older saves; restore guards a
malformed value too. Catalog lives in `CONFIG.SHOP_ITEMS`; pure purchase/price/consume
logic in `js/shop.js` (delegates pricing to `Economy.shopPrice`). See DECISIONS.md 2026-07-18.

### schemaVersion 3 (2026-07-18): recurrence `schedule` + habit `occurrenceHistory` landed
Habits and routine-task definitions carry a `schedule` object (`frequency`/`daysOfWeek`/
`dayOfMonth`) replacing habits' bare `frequency` string; habit defs also carry
`occurrenceHistory`. v2→v3 migration in `js/persistence.js`. See DECISIONS.md.

### schemaVersion 2 (2026-07-18): habit `routineId` landed
The `routineId: string|null` field on `Habit` below is now **live**, ahead of the rest of
this target schema. `null` = standalone (spawns daily on its own); a routine id = owned by
that routine (spawns only while it's `isActive`). The v1→v2 migration in `js/persistence.js`
infers it from existing `routine.habitDefinitionIds` membership. Note that membership is
still many-to-many in the live code (a habit can sit in several routines) while `routineId`
names a single owner, so spawn gating checks both — see `Habits.selectHabitDefsToSpawn`
and DECISIONS.md 2026-07-18.

### IMPLEMENTED (2026-07-17): schemaVersion 1 ≠ this target schema
`js/persistence.js` + `restoreGameState()` in script.js are live. **schemaVersion 1
saves the monolith's CURRENT in-memory shapes as-is** (numeric item ids,
`activeItems`/`completedItems` arrays, `definedHabits`/`definedRoutines`, player
scalars, `itemIdCounter`, `currentGameDate`) — NOT the target objects below.
The objects below remain the goal; migrate toward them during Milestone 2
extractions via schemaVersion bumps + the migration chain in `js/persistence.js`
(decision + implementation notes: DECISIONS.md 2026-07-17). DOM refs
(`element`, `listItemElement`) are stripped on save and rebuilt on load; Dates
round-trip via a strict ISO reviver.

**Additive fields since (no schemaVersion bump — plain properties with safe
fallbacks on read, per DECISIONS.md):**
- `item.offlineDamageCharged` (2026-07-17) — per-item lifetime total of
  back-charged away-from-game damage; reads guard with `|| 0`.
- `runStartedAtMs` (2026-07-18) — wall-clock ms when the run began; source of
  truth for "days survived". Missing in older saves, so `restoreGameState`
  falls back to the save's `savedAt`, then `Date.now()`.

## Objects

```js
Task {
  id: string,              // "task_<timestamp>_<rand>"
  name: string,
  category: Category,      // see enum below
  highPriority: boolean,
  dueDateTime: ISOString,
  subtaskIds: string[],    // empty if none; parent renders larger
  parentId: string|null,   // set if this IS a subtask
  routineId: string|null,
  status: "active"|"completed"|"expired",
  completedAt: ISOString|null,   // supports undo/recently-defeated
  notes: string
}

Habit {
  id: string,
  name: string,
  category: Category,
  polarity: "positive"|"negative",
  schedule: Schedule,       // see below — DESIGNED 2026-07-18, not yet built
  timeOfDay: "HH:MM"|null,
  routineId: string|null,
  streak: number,           // VISUAL layer only as of 2026-07-18 — badge +
                            // on-fire sprite; no economy effect (see below)
  lastCompletionDate: ISOString|null,
  active: boolean,
  // DESIGNED 2026-07-18 (rate-based bonus decision, see DECISIONS.md +
  // MECHANICS.md Habits), NOT YET BUILT. Ships in the SAME schemaVersion 2→3
  // migration as Schedule (one bump, decided 2026-07-18). Rolling record of
  // this habit's scheduled occurrences, newest last, trimmed to the most
  // recent 14 (CONFIG.HABIT_RATE_WINDOW). success = completed (positive
  // habits) / avoided (negative habits). The points multiplier derives from
  // the success fraction: ≥90% → 1.5×, ≥70% → 1.25×, else 1× — all four
  // numbers config-tunable; 1× until ≥7 entries exist
  // (CONFIG.HABIT_RATE_MIN_SAMPLE). Uncompleting today flips today's entry
  // and recomputes (symmetric refunds by construction).
  occurrenceHistory: { date: "YYYY-MM-DD", success: boolean }[],
  // BUILT 2026-07-19 (schemaVersion 6, frozen-slots sub-session 1). Recovery
  // path 1 ("edit the habit to unfreeze") appends one entry per real edit;
  // an edit only unfreezes if changedFields is non-empty (a no-op Save
  // doesn't count). Old/new values + notes deferred — see DECISIONS.md.
  modificationHistory: { timestamp: "ISOString", changedFields: string[] }[]
}

// BUILT 2026-07-18: js/schedule.js + schemaVersion 2→3 migration (session 14),
// scheduling UI in all 5 recurring-definition forms (session 15). Replaces the
// former bare `frequency: 'daily'` string on both `definedHabits` entries and
// routine task definitions (`definedTasks`) — both get this same Schedule
// object, since both are recurring definitions. Deliberately NOT extended to
// one-off standalone tasks (they don't recur). See DECISIONS.md.
Schedule {
  frequency: "daily"|"weekly"|"monthly",
  daysOfWeek: number[],     // 0=Sun..6=Sat. Used for "daily" (default: all 7,
                            // preserves today's every-day behavior) and
                            // "weekly" (default: empty, forces an explicit
                            // pick). Daily and weekly are the SAME generator
                            // mechanism — a day-of-week filter — "weekly" is
                            // just a UI label implying "pick specific days,"
                            // not a separate streak/dedupe system.
  dayOfMonth: number|null   // 1-31, used for "monthly" only. If the target
                            // month is shorter than dayOfMonth, CLAMP to that
                            // month's last day (e.g. 31 → Feb 28/29) rather
                            // than skipping the month.
}

HabitInstance {              // today's spawned copy of a Habit
  id: string,
  habitId: string,
  dueDateTime: ISOString,
  status: "active"|"completed"|"missed",
  completedAt: ISOString|null
}

Routine {
  id: string,
  name: string,
  habitIds: string[],
  taskIds: string[],
  level: number,
  xp: number,
  health: number,          // damaged by enemies inside base
  habitSlots: number,      // grows with level
  taskSlots: number,
  isActive: boolean,
  // BUILT 2026-07-19 (schemaVersion 6, frozen-slots sub-session 1). null =
  // not frozen. Set when a routine-owned negative habit it owns hits
  // CONFIG.FREEZE_THRESHOLD_DAYS (3) consecutive indulged days; cleared by
  // that SAME habit (frozenBy match) hitting CONFIG.RECOVERY_AVOIDED_DAYS
  // (3) consecutive avoided days, or by a real edit to that habit (recovery
  // path 1, later sub-session). See js/frozenSlots.js + DECISIONS.md.
  frozenState: { frozenBy: string, frozenAt: "ISOString" } | null
}

Run {
  id: string,
  startedAt: ISOString,
  endedAt: ISOString|null,
  daysSurvived: number,
  playerLevel: number,
  playerXp: number,
  baseHealth: number,      // 0-100, replenishes daily
  points: number,          // can go negative
  routineIdsUsed: string[],
  killedBy: string[]       // item ids that took the base out
}

TokenInventory {
  cheatDay: number, sickDay: number, skipDay: number, pushback: number,
  purchaseCounts: { [tokenType]: number }   // drives exponential pricing
}

Category = "career"|"creativity"|"financial"|"health"|
           "lifestyle"|"relationships"|"spirituality"|"other"
```

## Root Save Shape

```js
Save {
  schemaVersion: 1,
  tasks: Task[],
  habits: Habit[],
  habitInstances: HabitInstance[],
  routines: Routine[],
  currentRun: Run,
  pastRuns: Run[],          // run history for review
  tokens: TokenInventory,
  lastTickAt: ISOString     // for catching up offline time
}
```

## Rules
- IDs are never reused. Deletion marks status, doesn't splice history.
- All times stored as ISO strings; parse at the edges.
- Migrations: bump `schemaVersion`, add a migration step in `js/persistence.js`, log in DECISIONS.md.
