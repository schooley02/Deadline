# Data Schema — State Objects & Persistence

TARGET schema for the persistence work (Milestone 1) and modularization. The monolith's current in-memory shapes differ — reconcile toward these during extraction. Deep detail: Grep PROJECT_SPEC.md section 4 (Data Architecture). If shapes change, update this file in the same session.

## Storage
- `localStorage`, key prefix `deadline.`
- `deadline.save` — full serialized state (JSON) with `schemaVersion` for migrations
- `deadline.settings` — user settings (demo clock on/off, etc.)
- Save on every state mutation (debounced), load on boot. Cross-tab sync later via `storage` events.

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
  frequency: "daily"|"weekly"|{ days: number[] },  // days: 0-6
  timeOfDay: "HH:MM"|null,
  routineId: string|null,
  streak: number,
  lastCompletionDate: ISOString|null,
  active: boolean
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
