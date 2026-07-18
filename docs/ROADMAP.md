# Roadmap

Work ONE unchecked task per session. Check items off with the date. Ticket IDs reference ACTIONABLE_TICKETS.md.

## Milestone 0 — Restructure & Memory System ✅ (2026-07-16)
- [x] Audit May MPE + July 2025 codebase
- [x] Docs system, CLAUDE.md, commands, agents, balance-tuning skill merged into this repo
- [x] Repo moved to permanent home (Claude\Projects\Deadline); node_modules untracked, .gitignore added

## Milestone 1 — Stabilize ✅ (2026-07-17)
- [x] Fix sub-task duplication bug (2026-07-17, revised) — the `38409ca` guard clauses (`if (!item.parentId) createListItem(...)` etc.) were real but had an untested edge case: task IDs started at 0, and `0` is falsy, so a sub-task of the very first-ever task (id 0) tripped every `if (item.parentId)`/`if (!item.parentId)` check in the file and got rendered as both a nested sub-task AND a standalone top-level task. Only surfaced once script.js could actually parse and Jeremy playtested live (see below) — the old test suite is a self-contained mirror that never exercised id 0. Fixed by starting `itemIdCounter` at 1 instead of 0 (script.js `initGame()`). See DECISIONS.md.
- [x] Decide branch state with Jeremy (2026-07-17) — fast-forward merged `feature/sprite-system-cleanup` → `main` (10 commits, no conflicts), pushed both to GitHub. Also: project home moved from OneDrive to `C:\Users\jscho\Projects\Deadline`; GitHub repo had to be recreated (see DECISIONS.md).
- [x] Create `js/config.js` and move existing gameplay constants from script.js into it (2026-07-17) — moved GAME_TICK_MS, DAY_DURATION_MS, DAMAGE_INTERVAL_MS, OVERDUE_DAMAGE, MAX_BASE_HEALTH, XP_PER_TASK_DEFEAT, XP_PER_HABIT_COMPLETE, POINTS_PER_TASK, POINTS_PER_HABIT, HABIT_STREAK_BONUS_THRESHOLD/POINTS, LEVEL_XP_THRESHOLDS, ROUTINE_SLOTS_PER_LEVEL, ENEMY_WIDTH, HABIT_ENEMY_WIDTH into `CONFIG` object; script.js now reads them from `CONFIG.*` (values unchanged). Wired `js/config.js` into index.html load order (before IdCounter/TaskManager/script.js). Also fixed 4 pre-existing structural defects in script.js that made it fail to parse at all (duplicate itemIdCounter/gameIsOver declarations; 3 missing function-declaration headers — completeItem, uncompleteItem, showCreateSubTaskModal). `node --check script.js` now passes clean. See DECISIONS.md for full detail, including one more bug found but NOT fixed (showForm duplicate/shadowing — functional, not a parse error).
- [x] localStorage persistence (2026-07-17) — `js/persistence.js` (debounced save, flush on hide/close, strict ISO Date reviver, migration scaffold) + `restoreGameState()` in script.js; 13 explicit save hooks + 5s autosave safety net (`CONFIG.PERSISTENCE_AUTOSAVE_MS`). **schemaVersion 1 = current in-memory shapes**, not DATA_SCHEMA.md's target objects — reconcile via migrations during Milestone 2 (see DECISIONS.md 2026-07-17). Restored overdue items don't back-charge offline damage (deferred to offline catch-up task). **Live-verified by Jeremy** — playtested successfully. Committed + pushed (`f657ca8`).
- [x] **Habit-modal-doesn't-close bug (2026-07-17)** — root cause was two habit-unsafe references in `createListItem` (not the modal handler): `subTasks.forEach` on undefined (line 687) + phantom `itemNameContainer` (line 791). Both threw for habits, aborting `createHabitDefinition` before `closeModal()`; the pre-drawn sprite made it look like creation succeeded, so re-clicks duplicated. Fixed (`(itemData.subTasks || [])`; streak badge → `itemDetailsContainer`). Live-verified in Jeremy's browser via Cowork's Chrome control: modal now closes, no duplication, habits render as agenda rows for the first time, zero console exceptions. See DECISIONS.md.
- [x] **`createListItem` hardened into task/habit branches (2026-07-17, same-day follow-up)** — addressed the "task-first, habit-unsafe" pattern the bug above exposed. Shared shell (sprite/name/checkbox/due-date/category) + explicit `task`/`habit`/default branches; default branch warns instead of throwing for any future item type. Also found and fixed a third habit hazard: the edit pencil was hardcoded to the task editor for every row (harmless only because habit rows never used to render); habits now get a real `showEditHabitInstanceModal` → the existing habit-definition editor, and saving syncs the live instance so the agenda row updates immediately. Confirmed routines never reach `createListItem` (no routine branch needed). Regression test added (`test/create-list-item-branching.test.js`, mirror-style like the existing suite). Live-verified: task/habit rows render correctly distinct, both edit pencils open the right editor, habit edits sync live. See DECISIONS.md.
- [x] Offline catch-up on load (2026-07-17) — zombies animate (≤5s, ease-out) from saved to current-time positions on restore; offline overdue damage back-charged per item, capped at 12 HP (`CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM`) for the item's LIFETIME (not per restore/day — revised same-day after a design check). Companion fix: editing an overdue task's due date into the future now correctly clears its overdue state (previously kept ticking damage regardless of the new date). See DECISIONS.md. **Milestone 1 complete.**

## Milestone 2 — Modularize script.js (incremental; one extraction per session)
Order chosen so each step is small and testable. Tests pass before/after each; commit each.
- [x] Extract clock/time + timeline positioning (2026-07-17) — `calculateTimelinePosition`/`updateMidnightLine` moved to `js/clock.js` (dims passed explicitly, not closure); script.js keeps thin wrappers so call sites are unchanged. Offline catch-up deliberately NOT moved (deferred to the damage/base-health extraction below). See DECISIONS.md.
- [x] Extract enemy spawning + movement (2026-07-17) — `js/movement.js` (getSubTaskClusterOffset, calculateTimelineXWithClustering, getItemTopPosition + internal getVisibleEdges; explicit ctx/dims instead of closures, CONFIG+Clock as globals) and `js/spawning.js` (addItemToGame + pure resolveEnemyVisual, DOM collaborators injected via deps). script.js keeps thin wrappers so all call sites are unchanged. Both wired into index.html after clock.js. Tests: `test/movement.test.js` + `test/spawning.test.js`. Behavior-identical extraction.
- [x] Extract damage/base-health/game-over (2026-07-18) — `js/damage.js`: `damageBase`, `gameOver`, `updateBaseVisuals`, `computeDaysSurvived`, `runOfflineCatchUp`/`applyOfflineDamage`/`computeOfflineOverdueDamage` (the code deferred from clock.js) and `runLiveGapCatchUp`. Pure cores split out for DOM-free testing (`resolveBaseImage`, `computeGapCatchUpHits`, `computeCatchUpDuration`). First module to WRITE script.js-owned state (`baseHealth`, `gameIsOver`) — accessor deps rather than moving ownership; `markAsOverdue` stayed behind (habit-streak coupling). script.js keeps thin wrappers so all call sites are unchanged. `test/damage.test.js` (53 cases). See DECISIONS.md.
- [x] **Bugfix (2026-07-18, not a Milestone item): three overdue-damage bugs from Jeremy's overnight test** — one root cause (a far-past `lastDamageTickTime` makes the live loop pay one damage interval per 50ms tick; the offline cap only guarded the reload path). Fixed: suspended-loop gaps now route through the capped path (`runLiveGapCatchUp`, `CONFIG.LIVE_GAP_THRESHOLD_MS`); items created already-overdue start their clock at spawn; and "days survived" now derives from real elapsed time (`runStartedAtMs` + `CONFIG.MS_PER_REAL_DAY`) instead of the removed 60s-per-day `DAY_DURATION_MS` timer. Also added a dev-only bottom-left reset button. See DECISIONS.md.
- [x] **Bugfix (2026-07-18, not a Milestone item): overdue rows lost their red highlight on rebuild** — found by Jeremy playtesting extraction #3 (sprite showed the red box, agenda row didn't). `createListItem` never derived styling from `isOverdue`; the class came only from `markAsOverdue`, which early-returns when the item is already overdue, so any rebuild of an already-overdue row (edit due date, add sub-task, restore a sub-tasked parent) dropped it. Now derived in `createListItem`. Reproduced and re-verified live in Chrome; 6 regression tests added. See DECISIONS.md.
- [ ] Extract progression (XP, levels, slots)
- [ ] Extract habits + streaks
- [ ] Extract routines
- [ ] Extract UI: forms, agenda list, popups, FAB menu
- [ ] script.js reduced to boot/wiring (<300 lines)
- [ ] Split style.css by component

## Milestone 3 — Core Feature Gaps (P1 tickets)
- [ ] [P1-DATA-004] Sub-task hierarchy system (beyond bug fix: dependent due dates, shrinking parents)
- [ ] [P1-DATA-005] Positive/negative habit distinction (points loss, negative balance)
- [ ] [P1-UI-006] Hero/routine visual system (heroes in base, health, levels)
- [ ] Frozen routine slots + recovery (spec'd: 3+ day negative streak freezes; recover via habit edit or 3-day avoidance; daily check-ins — see docs/ROUTINES.md)
- [ ] [P1-DATA-007] Standardize points/currency system
- [ ] [P1-UI-008] Shop + repair kits + tokens with exponential pricing (see docs/ECONOMY.md)
- [ ] Run history + run review screen

## Milestone 4 — Polish (P2 tickets)
- [ ] [P2-UI-009] Streak visual effects (on-fire habits)
- [ ] [P2-GAME-010] Enemy acceleration mechanics
- [ ] [P2-UI-011] Management window unification
- [ ] [P2-GAME-012] Base healing system
- [ ] [P2-UI-013] Routine transfer system
- [ ] Time slider (Today, then Week/Month scopes)
- [ ] Achievements & badges
- [ ] Mobile UX + accessibility pass; PWA
