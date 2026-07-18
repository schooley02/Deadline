# Data Schema — State Objects & Persistence

TARGET schema for the persistence work (Milestone 1) and modularization. The monolith's current in-memory shapes differ — reconcile toward these during extraction. Deep detail: Grep PROJECT_SPEC.md section 4 (Data Architecture). If shapes change, update this file in the same session.

## Storage
- `localStorage`, key prefix `deadline.`
- `deadline.save` — full serialized state (JSON) with `schemaVersion` for migrations
- `deadline.settings` — user settings (demo clock on/off, etc.) — not yet implemented
- Save on every state mutation (debounced), load on boot. Cross-tab sync later via `storage` events.

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
  streak: number,
  lastCompletionDate: ISOString|null,
  active: boolean
}

// DESIGNED 2026-07-18 (decided with Jeremy, see DECISIONS.md), NOT YET BUILT.
// Replaces the current live schema's bare `frequency: 'daily'` string on both
// `definedHabits` entries and routine task definitions (`definedTasks`) — both
// get this same Schedule object, since both are recurring definitions.
// Deliberately NOT extended to one-off standalone tasks (they don't recur today
// and this doesn't add that capability).
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
  frozen: boolean          // frozen-recovery mechanic (spec pending)
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
