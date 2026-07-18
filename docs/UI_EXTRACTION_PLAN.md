# UI Extraction Plan (Milestone 2 — final item)

Planning session 2026-07-18. Supersedes the single ROADMAP line "Extract UI: forms, agenda list, popups, FAB menu",
which turned out to cover ~2,500 lines across seven clusters — far too much for the one-system-per-session rule.

Target layout is already prescribed by `ARCHITECTURE.md`: `js/ui/` with `forms`, `agendaList`, `canvasView`, `hud`,
`popups`, `fabMenu`. This plan sequences how to get there.

**Line numbers below are as of commit `d2825e4` and WILL drift as sessions land. Always re-Grep before trusting them.**

---

## The UI surface, mapped

| Cluster | Functions | ~Lines |
|---|---|---|
| **F. Routine UI** (left behind by routines.js) | `attachRoutineManagementListeners` (1889), `renderDefinedRoutines` (2009, **206 lines**), `populateHabitSelectDropdown` (2215), `showAddItemToRoutineModal` (2270), `updateRoutineDisplay` (2364), `showCreateHabitForm` (2371), `showCreateTaskForm` (2435), `showEditHabitForm` (2475), `showEditTaskForm` (2539), `showRoutineManagement` (2894), `populateRoutineHabits` (2949), `populateRoutineTasks` (2980) | ~854 |
| **A. Modal forms** | `showFormModal` (3012), `createTaskFormHtml` (3058), `createHabitFormHtml` (3102), `createRoutineFormHtml` (3161), `attachModalEventListeners` (3175, **366 lines**) | ~529 |
| **C. Agenda list / rows** | `showEditHabitInstanceModal` (608), `createListItem` (617, **268 lines**), `sortAndRenderActiveList` (1407), `resetAllSubTaskCheckboxes` (1429), `renderCompletedItems` (1459) | ~429 |
| **D. Popups / item modals** | `handleEnemyClick` (885), `showTaskDetailsPopup` (892), `showEditTaskModal` (943), `createSubTaskPrompt` (1141), `showCreateSubTaskModal` (1145) | ~298 |
| **E. Mgmt windows + FAB** | `toggleFabMenu` (2705), `closeFabMenu` (2717), `openManagementWindow` (2722), `closeAllManagementWindows` (2759), `closeManagementWindow` (2770), `populateTasksWindow` (2789), `populateHabitsWindow` (2811), `populateRoutinesWindow` (2833) | ~189 |
| **B. Legacy inline forms** | `showForm` #1 (423), `clearFormInputs` (452), `enableFormControls` (471), `showForm` #2 (3541) + ~30 DOM consts (15–47) + listeners (~3419–3480) | ~150 |
| **G. HUD / displays** | `updatePlayerDisplays` (226), `updateTaskCountDisplay` (233), `showLevelUpMessage` (508), `showDebugInfo` (3551) | ~60 |

---

## Two findings that shape the order

### 1. `closeModal` is a shared primitive in the wrong place
Defined as `window.closeModal` at line **2671** — buried inside the routine edit-form code (cluster F) — but every
cluster depends on it: all **18 inline `onclick="closeModal()"` sites** span clusters A, C, D, E, and F.
It must be extracted into a shared modal foundation **first**, or every subsequent extraction creates a
cross-module dependency on routine code.

### 2. The legacy inline form system is dead, and we're deleting it
`showForm` is declared twice in the same `DOMContentLoaded` scope. Function declarations hoist, so the 5-line legacy
stub at 3541 **shadows** the real 28-line implementation at 423. Consequences:

- `showForm('task')` / `showForm('habit')` are silent no-ops, including the `initGame` call at line 172.
- The real `showForm`'s button logic was inert anyway — `showTaskFormButton` / `showHabitFormButton` /
  `showRoutineFormButton` **do not exist in index.html**.
- The only reachable creation path is the modal system (FAB → `showFormModal`).
- But the inline form markup IS still in index.html (151, 191, 249), and `addTaskButton` / `addHabitButton`
  listeners (3419 / 3451) still run and still call `clearFormInputs()`.

**Jeremy's decision (2026-07-18): delete it.** Done as its own session before any extraction begins, so dead code
isn't carried into `js/ui/`. See DECISIONS.md.

---

## Session sequence

Each row is one session: one system, tests green before and after, its own commit.
Ordered foundation-first, then smallest/lowest-risk to establish the pattern, then the two monsters last.

| # | Session | Scope | Model |
|---|---|---|---|
| **0** | **Delete legacy inline forms** | Remove `showForm` #1 + the stub, `clearFormInputs`, `enableFormControls`, the unused DOM consts, the dead listeners, and the inline form markup in index.html. Fix the `initGame` line-172 call. Closes the 2026-07-17 shadowing flag. | Sonnet |
| **1** | `js/ui/modal.js` | The foundation: `closeModal`, modal-overlay create/teardown, and a helper for the `window.*` exposure that inline `onclick=` requires. Pull `closeModal` out of the routine code at 2671. ~80 lines. | Sonnet |
| **2** | `js/ui/hud.js` | Cluster G — displays, level-up message, task count, debug panel. Small, near-zero risk, confirms the pattern. | Sonnet |
| **3** | `js/ui/fabMenu.js` + `js/ui/managementWindows.js` | Cluster E — self-contained, no logic entanglement. | Sonnet |
| **4** | `js/ui/forms.js` | Cluster A. `attachModalEventListeners` (366 lines) splits per form type. **Also reconcile** the `createRoutineFormHtml` inline duplicate of `Routines.createRoutineDefinition` flagged 2026-07-18 (still missing its `saveGame()`). | Opus → Sonnet |
| **5** | `js/ui/popups.js` | Cluster D — enemy click, task details, edit task, sub-task creation modal. | Sonnet |
| **6** | `js/ui/agendaList.js` (part 1) | `createListItem` (268 lines) only — the task/habit branching shell and row construction. | Opus → Sonnet |
| **7** | `js/ui/agendaList.js` (part 2) | `sortAndRenderActiveList`, `renderCompletedItems`, `resetAllSubTaskCheckboxes`, `showEditHabitInstanceModal`. | Sonnet |
| **8** | `js/ui/routineViews.js` (part 1) | Rendering half of cluster F: `renderDefinedRoutines`, `populateRoutinesWindow`, `showRoutineManagement`, `populateRoutineHabits` / `populateRoutineTasks`, `updateRoutineDisplay`. | Sonnet |
| **9** | `js/ui/routineViews.js` (part 2) | Form half of cluster F: `showCreateHabitForm` / `showCreateTaskForm` / `showEditHabitForm` / `showEditTaskForm`, `showAddItemToRoutineModal`, `attachRoutineManagementListeners`, `populateHabitSelectDropdown`, and the four `window.save*` handlers. | Sonnet |
| **10** | script.js → boot/wiring only | Verify the `<300 lines` roadmap goal; mop up whatever's left. | Sonnet |

---

## Standing hazards for every session in this sequence

- **Inline `onclick=` needs `window.*` exposure.** The whole file is wrapped in a `DOMContentLoaded` closure, so
  nothing is global by default. Any function referenced from an `onclick="..."` string must be explicitly assigned
  to `window`. This already caused the `deleteRoutine` bug (2026-07-18). Session 1's exposure helper exists to make
  this systematic rather than ad-hoc.
- **Prefer real listeners over inline `onclick`** when a session is already rewriting the markup — but never mix
  both for one control.
- **DOM element consts** at the top of script.js are closure-scoped. Per ARCHITECTURE.md's refactor rule, pass them
  explicitly or resolve them inside the module; don't recreate the closure across files.
- **Cached script.js has bitten multiple sessions** — hard-reload before doubting a fix.
- **UI extractions are less unit-testable than logic extractions.** Expect to lean on `node --check` plus Jeremy's
  live smoke test more than on Jest. Where a cluster has a pure core (HTML-string builders, sort comparators,
  branching predicates), split it out and test it — that's the same pattern damage.js/habits.js used.
