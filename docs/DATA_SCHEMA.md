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
- `deadline.backup.preImport` — one-shot pre-import safety net written by `handleConfirmImport`
  (script.js) the moment an import is confirmed: `{ backedUpAt, save: <raw deadline.save string>,
  settings: <raw deadline.settings string> }`. Overwritten by the NEXT import, not rotated/kept as
  history — recovery only, not a version log. See Export/Import below.

## Export/Import ("Backup & Transfer", Milestone 5 first item, 2026-07-20)
Cross-device / cross-build-version save portability (Jeremy: play/test across desktop and phone,
and across in-development builds — no cloud sync, see DECISIONS.md). `js/exportImport.js` (pure
build/validate) + `js/ui/settingsView.js` (Settings window UI + confirm dialog) + script.js's
`handleConfirmImport` (the one stateful step). Full replace, no merge.

Envelope shape (wraps BOTH `deadline.save` and `deadline.settings` as one portable blob):
```js
{
  exportFormatVersion: 1,       // versions the ENVELOPE shape, separate from schemaVersion
  exportedAt: "2026-07-20T...", // ISO
  appSchemaVersion: 13,         // mirrors save.schemaVersion
  summary: {                    // display-only, for the confirm-replace compare — not validated
    daysSurvived, playerLevel, playerXP, playerPoints,
    activeItemCount, habitCount, routineCount,
  },
  save: { schemaVersion: 13, savedAt: "...", ...every deadline.save field },
  settings: { effectsIntensity: "full" },
  checksum: "a1b2c3d4",         // FNV-1a hex over the envelope minus this field — corruption
                                 // detection (catches a truncated paste), NOT cryptographic
}
```

Rules:
- **A newer `save.schemaVersion` (or `exportFormatVersion`) than this build supports is REJECTED
  outright** — never downgrade-mangled. An OLDER schema imports fine: `handleConfirmImport` writes
  `envelope.save` to `deadline.save` RAW (bypassing `Persistence.serialize`, which would re-stamp
  the CURRENT schemaVersion) and reloads, so the exact same migration chain that runs on every
  normal page load runs on the import too.
- Importing a save from a save that's AHEAD in wall-clock time is NOT special-cased — normal
  offline catch-up (js/damage.js) runs exactly as it would after closing the app for that long,
  same per-item lifetime cap as always (Jeremy's call).
- Reload, not hot-swap: `handleConfirmImport` writes localStorage then `window.location.reload()`s
  so `restoreGameState`/migrate/offline-catch-up/achievements-sweep all run through their one real
  code path. **Found live in Chrome:** `reload()` is async — a pending debounced
  `Persistence.requestSave`/the 5s autosave/the beforeunload flush can fire in the gap and
  re-serialize the LIVE pre-import state right over the just-written import. Fixed by neutering
  `Persistence.requestSave`/`Persistence.flush` to no-ops immediately before the write (module
  state is thrown away by the reload regardless — same class of hazard as the session-52
  stub-before-edit trick, see CLAUDE.md's Cowork section).

### schemaVersion 17 (BUILT 2026-11-04, priority slots Build A; docs/PRIORITY_SLOTS_PLAN.md)
- Root `priorityMarks`: `{ 'YYYY-MM-DD': n }`, the priority slots SPENT per local DUE day (n > 0, whole numbers; junk keys dropped by `PrioritySlots.sanitizeMarks`). A mark is spent when a task is marked and is never given back; `available = CONFIG.PRIORITY_SLOTS_PER_DAY * (1 + floor(done / perDay)) - marks`, where `done` is derived from the completed list (priority tasks that took a slot, by due day), so nothing else is stored. Pruned to yesterday-and-later at `performDayRollover`; `State.initGame` (new run / Reset Game) clears it. Carried by Backup & Transfer with the rest of the save.
- Items: `item.priorityInherited = true` marks a sub-task whose `isHighPriority` came from its priority parent (so unmarking or moving the parent takes back exactly those); absent = false, additive.
- The v16 -> v17 migration seeds `priorityMarks: {}` and sets `isHighPriority = false` on every saved `definedTasks` entry (a routine task DEFINITION is never priority; instances already on the board keep their flag).
- DailyRecord v9: `pri` = { m, d, s } (marks spent today / priority tasks finished today that took a slot / full sets of three, written at close). Older records read as zeros.

### schemaVersion 16 (2026-11-03, achievements swap): `lifetimeStats` counters for Honor Roll / Clean Sweep / Iron Will
- `lifetimeStats.steadyRoutineRuns` is REMOVED (Steady Hands retired). New numbers: `heroHonorDays`, `cleanDays`, `breaksResisted` (all >= 0, lifetime, survive a restart, wiped only by dev-Reset). `achievements` is untouched (old `steady_hands_*` keys stay, harmlessly).
- The v15 -> v16 migration seeds them once from `deadline.days` (closed days: routines with `stars` >= 3, days with `due` > 0 and `missed` = 0, `lurk.avoided`), plus the open `save.today`'s `lurk.avoided` unless its date is already closed. Counters that already exist are never overwritten. `Persistence.migrate(save, daysStore?)` takes an optional days store for tests. (Schema 15, the `today` slot, is described under DailyRecord.)
- Live: honor/clean from `State.closeDailyRecord` -> `recordLifetimeDayClose`; resisted from `Items` -> `recordLifetime('breakResisted', +/-1)`. DailyRecord is unchanged (no `v` bump): every field used already exists.

### schemaVersion 14 (BUILT 2026-10-25, KO-ghosts build; only `koGhost` is read by code so far — the timer/reschedule fields are defaults until Builds 2-4): timers, reschedule tracking, KO ghosts
- `item.koGhost: boolean` (default false) — true while the owning routine is KO'd; set on KO, cleared on revive; persisted so a reload can't un-ghost.
- `item.timer: { startedAt: ISO } | null`, `item.timerMsBanked: number` (default 0), `item.timerMinutes: number | null` (one-off tasks' optional target).
- `item.rescheduleCount: number` (default 0) — +1 on every later-move of the due time, paid or free.
- `habitDef.timerMode: 'work' | 'limit' | null`, `habitDef.timerMinutes: number | null`; the same two fields on routine `taskDefinitions`.
- Root save: `rescheduleFreeUses: number[]` (Build 2) was REPLACED 2026-11-02 by `pushbackUses` (below). Old saves still carry the dead field; `State` ignores it and the next save drops it. `item.rescheduleCount` increments on every later-move; run stats gained `reschedules` (absent = 0; in `freshRunStats`, `finalizeRun` totals and `deltasVsLastRun`). Run stats and `lifetimeStats` also gained `subtasksCompleted` (2026-10-27; additive, absent = 0, no schema bump): sub-task completions count there and no longer in `tasksCompleted`.
- **Pushback charges (Build B, 2026-11-02; additive, NO schema bump):** root save `pushbackUses: { short: number[], medium: number[], long: number[] }` = ms timestamps of the FREE charges spent (`State.getPushbackUses/setPushbackUses`: finite numbers for the three sizes only, absent / junk = empty, reset in `initGame` = a new run). Daily sizes count the stamps since today's local midnight and Long a rolling 7 days (`Pushback.chargesLeft`), so rollover clears nothing; `Pushback.apply` prunes stamps older than 7 days when it writes. `item.pushedLate: true` (optional, absent = false) is set by a paid-zone move (charge, token or points; never by an earlier, calm or grace move) and is read at completion (`Items.dailyIsLate`) to record `done.late`; items are saved whole so it round-trips. Held pushback tokens are ordinary `inventory` keys `pushback_short / pushback_medium / pushback_long`.
- **Run-end carryover (2026-11-03; additive, NO schema bump):** root save `bestRoutineSlots: number` = the most routine slots ever held (`State.setRoutineSlots` raises it, never lowers; `initGame` does NOT reset it; a dev Reset zeroes it). Absent / junk = 0. A new run starts at `max(CONFIG.ROUTINE_SLOTS_PER_LEVEL[level], bestRoutineSlots)` (`State.slotsForLevel`), and restore sets it BEFORE the live `routineSlots`. Open one-off tasks (`type:'task'`, `definitionId == null`, not `koGhost`) and their sub-tasks are carried by `script.js startNextRun` with their ids (the `itemIdCounter` is kept so ids never collide); `CONFIG.SHOP_ITEMS[].keptAcrossRuns === true` rows survive in `inventory`.
- **Village tier drops ledger (2026-11-03; additive, NO schema bump):** `currentRunStats.villageDropsPaid: { "<building kind>": 1..5 }` = the highest village star already PAID for that building this run (`VillageDrops.settle`, script.js `payVillageDrops`). Only ever rises; `RunStats.freshRunStats()` rebuilds it as `{}` at every new run, so each run pays every star once. Absent / malformed = nothing paid (an older run is paid the stars it already has, once). Not copied into run records (`finalizeRun` copies fields explicitly).
- Migration 13 → 14 (`js/persistence.js`, idempotent — never overwrites) fills the item and definition defaults only (no routine can hold live items while KO'd under the pre-14 rule, so `koGhost` is false everywhere). Spec: `docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md`.

### schemaVersion 13 (2026-10-21): `routine.heroCategory`
Which of the 8 category heroes (`CONFIG.HERO_CATEGORIES`: other, career, creativity, financial, health, lifestyle, relationships, spirituality) represents a routine. Player-picked (Create Routine + Manage Routine "Hero type" select); NEW routines default to `'other'`. The 12 -> 13 migration SEEDS every existing routine ONCE from its dominant category across habit members (`routineId` or `habitDefinitionIds`, archived excluded) AND task members (`taskDefinitionIds`); ties go to the category counted first (habits in `definedHabits` order, then tasks); no categorised members -> `'other'`. A missing/unknown value reads as `'other'` (`Heroes.heroCategoryFor`). Replaces the old "dominant habit category" rule for hero art (docs/HERO_SPOTLIGHT_PLAN.md).

### schemaVersion 12 (2026-10-13): list-order layering — optional `listRank` / `listRankDue` on active items
Hand-ordering inside a 30-min tie group (`js/listOrder.js`, `CONFIG.LIST_TIE_WINDOW_MIN`). Both fields are OPTIONAL numbers on an active item (top-level rows only; absent = plain due-time order):
- `listRank` — the due time (ms, + idx/1000 to keep equal dues distinct) of the SLOT the item occupies after the group's sorted due times are re-dealt in the manual order. Slot-time ranks mean merged groups and groups that later split keep each former group's internal order with no bookkeeping.
- `listRankDue` — the item's OWN due time (ms) when the rank was stamped. A rank is valid only while this still equals the item's current due time, so ANY due-time change (edit popup, pushback token, sub-task clamp) clears the rank implicitly — no call site has to remember to.
Migration v11→v12 only stamps the version (items already serialize whole, so the fields round-trip). Stamping (`ListOrder.stampManualGroups`) runs in `sortAndRenderActiveList` ONLY for hand-ordered groups containing a member without a valid rank (a new/edited item just slotted in); a fully ranked group is never re-stamped, because restore adds saved items one at a time and re-stamping a partial group destroyed the saved order (found live 2026-10-13). See DECISIONS.md.

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
Session 62 ([P2-UI-013]) added a sibling stamp, same additive/no-migration pattern:
`routineXpRoutineId: string` — WHICH routine earned it, so the refund debits the earner even if
the definition was transferred to another routine in between; refund falls back to re-resolving
ownership when the id stamp is absent (pre-transfer-era saves).
Star ratings (`Heroes.completionRate`/`starRating`, spec tiers 60/70/80/90/95% → 1-5★) are
computed fresh from habit `occurrenceHistory`, never persisted. v7→v8 migration in
`js/persistence.js`. See DECISIONS.md session 41. Since 2026-10-31 the rate also reads routine
TASK definitions' `occurrenceHistory` (see "Routine task definitions" below).

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
  archivedAt?: ISOString,   // 2026-10-16: set by "Delete Habit" (Routines.archiveHabit);
                            // absent = live. Archived defs never spawn and are hidden
                            // from all lists/pickers; history is kept. No schema bump.
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

// Routine task definitions (`definedTasks`) -- ADDITIVE 2026-10-31, no schema
// bump (High school v2 step 0): `occurrenceHistory` with the SAME
// { date: "YYYY-MM-DD", success: boolean }[] shape as a habit's. Written by
// js/items.js: success on completion (a late completion overwrites the day's
// miss), miss when the instance goes overdue or is still undone at rollover
// with no entry yet, the day's entry removed on an undo before the due time.
// KO ghosts and Skip Day record nothing. Trimmed to CONFIG.HERO_STAR_RATE_WINDOW
// (22; was 28 until 2026-11-03). Read only by Heroes.completionRate (hero star rate). Missing reads as
// [] -- defs saved earlier simply start with no history.
//
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
  frozenState: { frozenBy: string, frozenAt: "ISOString" } | null,
  heroCategory: "other" | "career" | "creativity" | "financial" | "health" | "lifestyle" | "relationships" | "spirituality"  // schemaVersion 13; which category hero represents this routine
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

- **Timer fields now live (Build 3, 2026-10-25):** `item.timer {startedAt, checkedAt, promptedAt} | null` (ms epoch), `item.timerMsBanked`, `item.timerMinutes` (set from the Add/Edit Task forms; new items are created with the schema-14 defaults). `habitDef/taskDef.timerMode/timerMinutes` are still unread. **`item.goalAcked: boolean` (Habit Goals Build 2, 2026-11-01; additive, absent = false, no schema bump):** set when the player answers the goal-reached popup with Keep going / Pause, so it does not re-ask; cleared by "Started by mistake" when the logged time falls back under the goal. **`item.timerPaused: boolean` (2026-11-01; additive, absent = false, no schema bump):** true after Pause (resumable, shown as Resume); cleared by Start/Resume and by every Stop/auto-stop/discard.
- **Timer sessions (Build A, 2026-11-04; additive, NO schema bump, no migration pass):** `item.timerSessions: [{ start, end, attack: [[from, to], ...] }]` (ms epoch, oldest first; `attack` = windows inside the session where the zombie was attacking while the timer ran) and `item.timerUntimedMs: number` (time with no start / stop: everything banked before this shipped, a typed total, a span under 1 s). **Invariant: `item.timerMsBanked` = sum of (end - start) + `timerUntimedMs`** (everything else still reads `timerMsBanked`). Old items have neither field; `TimerSessions.ensure` creates them lazily the first time the item is stopped or its total edited (banked time -> `timerUntimedMs`). While a timer runs, `item.timer` also carries `attackFrom` / `attackSeen` / `attack` (open window, last tick, closed windows); they move into the session on stop. A session's minutes are split at local midnight across the days it covers (2026-11-04). Plan: docs/TIMER_SESSIONS_PLAN.md.
- **Logged-time edits + Break answers kept (Habit Goals Build 2c, 2026-11-01; additive, no schema bump):** the logged time is still `item.timerMsBanked`; it can now be edited at any time (not while the timer runs) through `Items.setLoggedTime` (active or completed items), which corrects the daily record by the difference (below). **`item.outcome: 'avoided' | 'indulged'`** on a Break habit's entry in `completedItems` (UI words Resisted / Slipped); absent on tasks, Build habits and every older entry (absent = plain done). A Slipped habit is now KEPT in `completedItems` with `outcome 'indulged'` and `completedAt` = when it was answered, plus **`item.cheatDayExcused: true`** when a Cheat Day covered it. A Slipped entry is not a completion: nothing counting completions reads habit entries from that list, and it has no undo. **`habitDef.pendingCheckIn.entry`** `{ name, category, goal, timerMinutes, timerMsBanked }` (plain values, saved by `Items.markPendingCheckIn`) lets a Slipped answer on the next-morning check-in card rebuild its Completed entry once the lurker is gone; markers saved before 2c have no `entry` and fall back to the habit definition with no logged time. A check-in **Resisted** answer is kept too (2026-11-01, Jeremy): `outcome 'avoided'` plus **`fromCheckIn: true`** (no undo, no checkbox: the lurker is gone and points/streak were settled at answer time); `uncompleteItem` refuses it.
- **Definition timer fields now live (Build 4):** `habitDef.timerMinutes` (1-600 | null) and `habitDef.timerMode` ('limit' for negative, 'work' for positive, null if no minutes); spawned habit instances copy `timerMinutes`. Routine `taskDef.timerMode/timerMinutes` remain unread.
- **Habit Goals Build 1 (2026-11-01, additive, no schema bump):** `habitDef.goal` / `item.goal` = `{ type: 'none'|'time'|'amount'|'note', amount, unit, note }` (Time = minutes, `unit: 'min'`). `Habits.goalOf(def)` falls back to a Time goal derived from an old `timerMinutes`. A Time goal keeps `timerMinutes`/`timerMode` in step (`Habits.applyGoalToDef`); other goal types leave them null. Build 2 + 3 (docs/HABIT_GOALS_PLAN.md) add the actual-amount record (`item.goalActual`) and DailyRecord v4. **Build 3 (2026-11-01, no schema bump):** `item.goalActual` (number, only for an Amount goal; set when the player typed a How much? on a Resisted / Slipped / done answer; a Time goal's How much? is `timerMsBanked` instead); `deadline.settings.eveningCheckTime` ("HH:MM", default "21:00"); DailyRecord v5 `goals` (below).
- **Developer tools switch (2026-11-03, no schema bump):** `deadline.settings.devTools` (boolean, strictly `true` or absent / false; per device). It shows the DEV button (`js/ui/devPanel.js`). It is NOT part of a Backup & Transfer export (script.js strips it) and an import never sets it. The demo values the panel sets (forced weather band + trend, pretend village star) live in memory in `js/devDemo.js` only: never in `deadline.save`, `deadline.days` or an export.

## Daily record (BUILT 2026-10-27, D2 steps 1-4 -- `docs/DAILY_RECORD_PLAN.md`)
- `save.today` (schema 15): the in-progress `DailyRecord` for the current local day. The v14->v15
  migration seeds `null`; `State.ensureToday` builds the record (dated by the REAL local day, never an
  older game date, so no phantom past day is written).
- Separate localStorage key `deadline.days` (`Persistence.DAYS_KEY`): `{ v, days: {date: DailyRecord}, months: {ym: totals} }`,
  written ONCE per day by `State.closeDailyRecord` (inside `performDayRollover`, after the settle loop);
  18-month daily retention, then monthly roll-up (`DailyRecord.rollUp`: counters + hour arrays summed,
  `active` first/last min/max, `base` averaged, `tz` dropped, plus `days` = days folded in); lifetime data
  (survives Reset Game / new run -- `Persistence.clear()` removes only `deadline.save`).
- Backup & Transfer: the envelope gains an OPTIONAL `days` field (checksummed; `EXPORT_FORMAT_VERSION` stays 1).
  Import MERGES by date (`DailyRecord.mergeStores`) -- a day already on the device is never overwritten.
- `DailyRecord` v1 fields are additive and versioned (`v`); a missing field reads as 0/empty
  (`DailyRecord.normalize`). Semantics worth knowing:
  - `done.*` = task / subtask / habit completions; an AVOIDED negative habit ("lurker") counts in
    `lurk.avoided` (hours / byCat / pts still bump), never in `done.*`. `lurk.slipped` = real indulgences
    (a cheat-day-excused indulge records nothing).
  - `dmg.taken/hits` + `hoursDmg` + `byCat[2]` = LIVE overdue ticks; `dmg.offline` = offline / live-gap
    back-charge (kept apart: hour of day is meaningless for a batch). Both feed `base.minHp`.
  - `missed.*` / `hoursMissed` hour = the item's DUE-time hour (when it went wrong), not when it was noticed.
    A habit edited into the past (`skipHabitMiss`) records no miss.
  - `tokens.*` = token USES (cheat / sick / skip / pushback / kit); `pts.spent` = shop purchases, pushbacks
    and paid reschedules. `timer.workMin/limitMin` = minutes banked by `Timer.stop` (via `Timer.onSpan`).
  - `active` = throttled (30 s) pointerdown window: first/last hour + count.
  - `due.task` = non-sub tasks with a due time on that day still on file at close; `due.habit` = done + missed
    (habit instances are removed once settled).
  - A check-in answer for yesterday's lurker lands in TODAY's record; the silent rollover auto-avoid lands in
    the day that just ended. An undo whose completion belongs to a closed day is skipped.
  - **v2 (2026-10-30, village High school; additive, no schema bump):** `att { active, perfect }` on CLOSED days =
    routine attendance: `active` = routines with any activity that day, `perfect` = how many of those had every item
    finished (an item that went overdue and was finished late still counts). A day is "perfect attendance" when
    `active >= 1 && perfect === active` (`DailyRecord.isPerfectAttendance`). `rt { "<routineId>": [done, missed, lateDone] }`
    is the OPEN day's working tally (opaque ids, no names; real routine ids are strings like `routine_0_1730...`), fed by the optional `routineId` on the
    `complete` / `uncomplete` / `overdue` / `lurk` (slipped) events that `Items` now sends (`dailyRoutineId`);
    `close()` folds it into `att` and clears it (so closed days carry `rt: {}`). A bad habit avoided inside a routine is a
    done item; a slip is a miss. Frozen routines' tasks do not spawn, KO ghosts never go overdue. Month roll-up sums `att`.
    Older v1 days simply have no `att` and never count as perfect.
  - **v3 (2026-10-31, High school v2; additive, `V` 3):** `stars { "<routineId>": 0..5 }` on CLOSED days = the hero star rating each
    routine banked when the day closed (`Heroes.bankedStars`: the chip rate/window, habits + tasks; an inactive, frozen or KO'd routine
    banks 0). Written once by `DailyRecord.close` from `ctx.stars` (`State.closeDailyRecord` passes `deps.routineStarsNow()`); opaque
    ids, no names. `DailyRecord.starsTotal(rec)` sums a day. The High school counter = the sum over this run's closed days. Older
    days have no field and read as none. The month roll-up does not carry per-routine stars. `att` is kept but no longer drives a counter.
- `goals` (v5, 2026-11-01, Habit Goals Build 3): `{ "<habitDefId>": { type: 'time'|'amount'|'note', amount, unit, met, actual } }`, one entry per habit that had a goal and was ANSWERED that day (Build habit done; Break habit Resisted / Slipped, evening check, next-morning card or popup). `met` is the player's own answer, never computed from `actual`. `actual` = the typed How much? (Amount) or the logged minutes (Time; kept in step when the logged time is edited later, `DailyRecord.setGoalActual` / `State.updateDayGoalActual`); a Note goal has no amount, unit or actual. Opaque ids and numbers only: `unit` is stored only if it is one of `Habits.GOAL_UNIT_SUGGESTIONS` (else `'other'`); a Time goal stores no unit. Events `goal` (write / overwrite) and `goalClear` (an undone Build answer). Not summed into the monthly roll-up (same as `stars` / `rt`); day-level detail is kept 18 months.
- `pb` (v6, 2026-11-02, Pushback charges Build B): `{ late, short: { charge, token, points }, medium: {...}, long: {...} }` = paid-zone pushbacks (a due time moved later while the item was 4 h or less from due, or overdue), counted in UNITS per size and per payment source (a 3-day move is 3 Longs: e.g. 1 charge + 2 points); `late` = how many such MOVES there were (each flags the item `pushedLate`). Free moves (earlier, calm, grace) appear only in `resched`. Event `pushback {size, charges, tokens, points}` (script.js `commitReschedule`). `tokens.pushback` is kept in the shape for older days but is no longer bumped (v6: use `pb`). `pts.spent` still includes the points paid. Summed into the monthly roll-up (`late` + every size/source cell). Older days lack `pb` and read as 0.
- `tcorr` (v8, 2026-11-04, Timer sessions): `{ n, hp }` = corrections that took halved damage back (a timer session shortened or deleted over minutes when its zombie was attacking): `n` = corrections charged, `hp` = HP actually taken (after the 1 HP floor). Bumped by the `tcorr` event (`{ hp }`; zero / junk ignored); summed by the month roll-up; older days read as zero. **Build B (2026-11-04) calls it: `Items.changeSession` bumps `tcorr` with the HP actually charged.**
- `drops` (v7, 2026-11-03, Village tier drops): `{ n, pts }` = the free items a village building paid that day (`n` = items added to the held inventory, `pts` = their shop value, baseCost x count). Bumped by the `drop` event from script.js `payVillageDrops`; summed by the month roll-up; older days have no field and read as zero. Kept apart from `pts.spent` (bought) and `tokens` (used).
  - **v4 (2026-11-01, Habit Goals Build 2c; additive, `V` 4):** `timer.edits` (count of logged-time corrections) and `timer.editMin` (signed net minutes actually applied) beside `timer.workMin` / `limitMin`, so insights can tell measured time (`workMin - editMin`) from corrected time. Written by `DailyRecord.adjustTimer(rec, kind, deltaMin)` (pure; minutes never go below 0; a correction the floor swallows counts nothing), reached through `State.adjustDayTimer(dateKey, kind, deltaMin)`: an active item corrects TODAY's open record; a completed item corrects the day of its `completedAt` (the open record, or that day's CLOSED record in `deadline.days`, written back). A day with no record (never seen, or rolled into a month) is left alone. `kind` = `Timer.recordKind(item)` ('limit' for Break habits, else 'work'). An older day lacks the counters (reads as 0); the month roll-up sums them. Known imprecision: a check-in Slipped entry is dated when it was answered, so editing its time corrects that day, not the day the time was measured.
- **Rule:** a mechanic that changes what can happen in a day adds its counter in the same session
  (`DailyRecord.bump` event + a `recordDaily`/`State.bumpToday` seam) and bumps `DailyRecord.V`.

### Start time fields (2026-11-01, additive, NO schema bump)
- `item.startDateTime: Date | null` on tasks / sub-tasks / routine task instances (ISO string on disk, revived to a Date by the persistence reviver like `dueDateTime`). Missing or null = no work window. Only honoured while strictly before `dueDateTime` (`Clock.hasWorkWindow`). Old saves load unchanged.
- `taskDefinition.defaultStartTime: "HH:MM" | null` -- copied onto each spawned instance for its own day (`Routines.getRoutineTaskInstanceStartTime`).
- Build B (2026-11-01): `habitDef.timeOfDay` may be `'custom'` (Build habits only), with `habitDef.startTime: "HH:MM" | null` (optional) and `habitDef.endTime: "HH:MM" | null` (the due time; required when custom). Both are null for every other bucket and absent on older saves (read as null). Habit instances carry `startDateTime` like tasks. Additive, no schema bump (`Habits.normalizeCustomTimes` is the single sanitizer).
