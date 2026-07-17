# Roadmap

Work ONE unchecked task per session. Check items off with the date. Ticket IDs reference ACTIONABLE_TICKETS.md.

## Milestone 0 — Restructure & Memory System ✅ (2026-07-16)
- [x] Audit May MPE + July 2025 codebase
- [x] Docs system, CLAUDE.md, commands, agents, balance-tuning skill merged into this repo
- [x] Repo moved to permanent home (Claude\Projects\Deadline); node_modules untracked, .gitignore added

## Milestone 1 — Stabilize (CURRENT)
- [x] Fix sub-task duplication bug (2026-07-17, revised) — the `38409ca` guard clauses (`if (!item.parentId) createListItem(...)` etc.) were real but had an untested edge case: task IDs started at 0, and `0` is falsy, so a sub-task of the very first-ever task (id 0) tripped every `if (item.parentId)`/`if (!item.parentId)` check in the file and got rendered as both a nested sub-task AND a standalone top-level task. Only surfaced once script.js could actually parse and Jeremy playtested live (see below) — the old test suite is a self-contained mirror that never exercised id 0. Fixed by starting `itemIdCounter` at 1 instead of 0 (script.js `initGame()`). See DECISIONS.md.
- [x] Decide branch state with Jeremy (2026-07-17) — fast-forward merged `feature/sprite-system-cleanup` → `main` (10 commits, no conflicts), pushed both to GitHub. Also: project home moved from OneDrive to `C:\Users\jscho\Projects\Deadline`; GitHub repo had to be recreated (see DECISIONS.md).
- [x] Create `js/config.js` and move existing gameplay constants from script.js into it (2026-07-17) — moved GAME_TICK_MS, DAY_DURATION_MS, DAMAGE_INTERVAL_MS, OVERDUE_DAMAGE, MAX_BASE_HEALTH, XP_PER_TASK_DEFEAT, XP_PER_HABIT_COMPLETE, POINTS_PER_TASK, POINTS_PER_HABIT, HABIT_STREAK_BONUS_THRESHOLD/POINTS, LEVEL_XP_THRESHOLDS, ROUTINE_SLOTS_PER_LEVEL, ENEMY_WIDTH, HABIT_ENEMY_WIDTH into `CONFIG` object; script.js now reads them from `CONFIG.*` (values unchanged). Wired `js/config.js` into index.html load order (before IdCounter/TaskManager/script.js). Also fixed 4 pre-existing structural defects in script.js that made it fail to parse at all (duplicate itemIdCounter/gameIsOver declarations; 3 missing function-declaration headers — completeItem, uncompleteItem, showCreateSubTaskModal). `node --check script.js` now passes clean. See DECISIONS.md for full detail, including one more bug found but NOT fixed (showForm duplicate/shadowing — functional, not a parse error).
- [x] localStorage persistence (2026-07-17) — `js/persistence.js` (debounced save, flush on hide/close, strict ISO Date reviver, migration scaffold) + `restoreGameState()` in script.js; 13 explicit save hooks + 5s autosave safety net (`CONFIG.PERSISTENCE_AUTOSAVE_MS`). **schemaVersion 1 = current in-memory shapes**, not DATA_SCHEMA.md's target objects — reconcile via migrations during Milestone 2 (see DECISIONS.md 2026-07-17). Restored overdue items don't back-charge offline damage (deferred to offline catch-up task). Awaiting Jeremy's live browser verification.
- [ ] Offline catch-up on load (paused zombies animate to current position, max 5s — spec'd in PROJECT_SPEC.md)

## Milestone 2 — Modularize script.js (incremental; one extraction per session)
Order chosen so each step is small and testable. Tests pass before/after each; commit each.
- [ ] Extract clock/time + timeline positioning (`calculateTimelinePosition`, `updateMidnightLine`)
- [ ] Extract enemy spawning + movement
- [ ] Extract damage/base-health/game-over
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
