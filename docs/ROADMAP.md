# Roadmap

Work ONE unchecked task per session. Check items off with the date. Ticket IDs reference ACTIONABLE_TICKETS.md.

## Milestone 0 — Restructure & Memory System ✅ (2026-07-16)
- [x] Audit May MPE + July 2025 codebase
- [x] Docs system, CLAUDE.md, commands, agents, balance-tuning skill merged into this repo
- [x] Repo moved to permanent home (Claude\Projects\Deadline); node_modules untracked, .gitignore added

## Milestone 1 — Stabilize (CURRENT)
- [x] Fix sub-task duplication bug (2026-07-17) — already fixed in commit `38409ca` (Jul 29 2025), predates the M0 repo move; verified via `test/subtask-creation.test.js` (14/14 passing), no new code change needed. See DECISIONS.md.
- [x] Decide branch state with Jeremy (2026-07-17) — fast-forward merged `feature/sprite-system-cleanup` → `main` (10 commits, no conflicts), pushed both to GitHub. Also: project home moved from OneDrive to `C:\Users\jscho\Projects\Deadline`; GitHub repo had to be recreated (see DECISIONS.md).
- [ ] Create `js/config.js` and move existing gameplay constants from script.js into it
- [ ] localStorage persistence per docs/DATA_SCHEMA.md (save on mutation, load on boot, schemaVersion) — biggest missing feature; a refresh currently loses everything
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
