# Architecture — Current State, Target, Refactor Rules

## Current State (July 2025 codebase)
- `index.html` (266 lines) + `script.js` (~3,420 lines) + `style.css` (~2,035 lines) — a working DOM-rendered monolith.
- `js/TaskManager.js`, `js/IdCounter.js` — first extractions already made.
- `server.js` — tiny static server (`node server.js` → http://localhost:8000). `npx serve .` also works.
- `test/` — Jest tests (subtask creation) + puppeteer visual tests. `npm install` then `npm test`.
- No persistence (localStorage is Milestone 1). No build step — keep it that way.

## Why we refactor
The 3,420-line script.js forced every Claude session to re-read one giant file — that's what degraded the July 2025 sessions. Modules mean a session loads only what its task touches.

## Refactor Strategy: incremental extraction (decided 2026-07-16; step 3 superseded 2026-07-17)
NOT a big-bang rewrite. One system per session:
1. Identify the functions for one system (Grep script.js — don't read it whole).
2. Move them to a module under `js/`, exporting what script.js needs. If the moved functions closed over script.js's module-scoped state (e.g. DOM-derived `let`s like `GAME_SCREEN_WIDTH`), take that state as explicit function parameters instead — don't recreate the closure across files. script.js can keep a thin wrapper at the original call sites so nothing else has to change.
3. Load via `<script>` tag order (index.html) — **the planned ES module conversion is CANCELLED (2026-07-17, see DECISIONS.md)**. Staying with the global + `module.exports` pattern already proven by `js/config.js`/`js/persistence.js`: no build step, and test files `require()` modules directly in Node.
4. `npm test` + manual smoke test pass before AND after. Commit each extraction.

## Target Layout
```
js/
├── config.js          # ALL gameplay numbers (create in Milestone 1)
├── state.js           # central state + mutation functions (only place state changes)
├── persistence.js     # localStorage save/load + schemaVersion migrations
├── clock.js           # real time, timeline positions, midnight line (IMPLEMENTED 2026-07-17 — see DECISIONS.md). Offline catch-up deliberately stayed in script.js for now; moves to damage.js instead when that extraction happens (too tangled with damage/DOM animation to split off cleanly in clock.js's first session)
├── spawning.js        # enemy creation/admission (IMPLEMENTED 2026-07-17 — addItemToGame + pure resolveEnemyVisual; DOM collaborators injected via deps)
├── movement.js        # timeline-based positioning (IMPLEMENTED 2026-07-17 — getSubTaskClusterOffset/calculateTimelineXWithClustering/getItemTopPosition + internal getVisibleEdges; state/dims passed explicitly, CONFIG+Clock as globals)
├── damage.js          # overdue damage, base HP, game over, both catch-up paths (IMPLEMENTED 2026-07-18 — damageBase/gameOver/updateBaseVisuals/computeDaysSurvived + runOfflineCatchUp (moved here from clock.js's original scope, see clock.js note above) + runLiveGapCatchUp. Pure cores split out for testing: resolveBaseImage, computeGapCatchUpHits, computeOfflineOverdueDamage, computeCatchUpDuration, computeDaysSurvived. FIRST module to WRITE script.js-owned state (baseHealth, gameIsOver) — reached via accessor deps rather than moving ownership; see DECISIONS.md 2026-07-18. markAsOverdue stayed in script.js (it also resets habit streaks → belongs with the habits extraction) and arrives as a dep.
├── progression.js     # XP, levels, slots
├── habits.js          # habit instances, streaks, pos/neg logic
├── routines.js        # heroes, slots, frozen recovery
├── economy.js         # points, shop, exponential pricing
├── TaskManager.js     # (exists) task CRUD
├── IdCounter.js       # (exists) id generation
└── ui/                # forms, agendaList, canvasView, hud, popups, fabMenu
```
`script.js` ends as boot/wiring only (<300 lines). `style.css` splits per component after JS is done.

## Conventions
- Balance numbers only in `js/config.js`. UI never mutates state directly. Max ~300 lines/file.
- Real timestamps in logic; accelerated demo time only behind a config flag.
- No new dependencies without a DECISIONS.md entry.
- Old prototype `Deadline-MPE/` is frozen reference — never modify.

## Testing
- Jest for logic; keep tests running through every extraction. Add tests for each extracted module (movement math, damage ticks, pricing curve, streak resets, persistence round-trip).
- `playtester` agent runs `npm test` + `node --check` on changed files before handoff.
