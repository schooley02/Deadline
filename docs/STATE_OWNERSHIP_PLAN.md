# State-Ownership Migration Plan

**Sequenced 2026-07-20 (Cowork session, Fable).** Closes the Milestone-2 deferred item: script.js → boot/wiring only. Deferred since session 11 (2026-07-18); state.js's header has anticipated this move since it was written.

## Goal

Move ownership of the persisted/game-lifecycle state `let`s out of script.js's DOMContentLoaded closure into `js/state.js`, then retire the thin wrappers that only exist to bridge that closure. script.js ends as: DOM consts, deps builders (collaborators/DOM only), event wiring, window.* exposures.

## Forks resolved (Fable, 2026-07-20)

1. **Storage location**: `js/state.js` module-scoped `let`s + exported accessor pairs (`State.getPlayerXP`/`State.setPlayerXP`, ...). NOT a bag object (`State.vars.playerXP`) — accessors preserve the exact contract every consumer already holds, so no module outside script.js changes.
2. **`window.definedTasks`: OUT OF SCOPE.** It's genuinely window-owned (no closure `let` exists), works today, and has 15+ read sites across 3+ files. Migrating it is its own future session. The plan must not touch it.
3. **What stays in script.js**: UI/wiring-local vars — `heroStarMemory`, `heroFxMemory`, `lastAutosaveMs`, `effectsIntensity`, `timePreviewActive`, `offlineCatchUpActive`, `attackMode`, `gameLoopInterval`, and the DOM-derived widths (`GAME_SCREEN_WIDTH`, `BASE_WIDTH`, `ENEMY_WIDTH`, `HABIT_ENEMY_WIDTH`). They're not game state; several aren't even in stateDeps today. (`gameLoopInterval` is borderline — it's in stateDeps for damage's `getGameLoopInterval`; keep the accessor sourced from script.js, migrate nothing.)
4. **What migrates** (the persisted + lifecycle set): `baseHealth`, `playerXP`, `playerLevel`, `playerPoints`, `routineSlots`, `playerInventory`, `sickDayDate`, `currentRunStats`, `runHistory`, `lifetimeStats`, `achievements`, `activeItems`, `completedItems`, `definedHabits`, `definedRoutines`, `itemIdCounter`, `gameIsOver`, `daysSurvived`, `currentGameDate`, `runStartedAtMs`, `lastLoopTickMs`, `lastRegenTickMs`.
5. **Wrapper retirement extent**: retire only true one-liner delegation wrappers whose callers are all inside script.js (event wiring / other wrappers) — inline `Module.fn(depsX(), ...)` at the call site. KEEP: every `window.*`-exposed name (inline-onclick contract), the deps builders, and all real-logic orchestrators (routine management, shop handlers, `applyLifetimeProgress`, `checkPlayerLevelUp` — those are candidates for future module extractions, not this migration).

## Hazards (from recon, 2026-07-20)

- **Wholesale reassignment**: `restoreGameState`/`initGame` REPLACE the arrays/objects (never mutate in place). With state.js owning them, its own functions may write the module `let`s directly — but every external consumer must keep getting accessors. The lighter deps builders (`itemsDeps`, `agendaListDeps`) currently pass `activeItems` as a PLAIN REFERENCE — after migration script.js has no binding to pass, so these MUST become getter calls (sub-session 2). Until then script.js keeps a local alias only if provably safe; prefer doing 1+2 back-to-back.
- **`baseWidth`/`gameScreenWidth` by-value in stateDeps** (snapshot per call): unchanged — widths stay script.js-owned per fork 3.
- **Inline onclick names** (`deleteRoutine`, `saveNewHabit/Task`, `saveEditedHabit/Task`, `closeModal`, `closeTopmost`): must survive verbatim.
- **PWA service worker** caches js/ shell files cache-first — every live playtest must confirm the changed files actually loaded (hard-reload / SW update; bumping the sw.js cache name per session is the reliable lever).
- state.js's only window coupling is `window.definedTasks` inside function bodies — Node-safe, untouched.

## Sub-sessions (one per session — persistence/architecture, strict rule)

1. **Ownership move (Sonnet, this plan's first execution)** — add the module `let`s + accessor pairs to state.js; state.js's own functions (`initGame`, `restoreGameState`, `getPersistableState`, rollover) switch from `deps.get*/set*` to direct binding access where the var is now local (keep taking collaborator/UI deps); script.js deletes the migrated `let`s and sources stateDeps()'s accessor entries from `State.*`. All 56 suites must pass unmodified BEFORE the test files are touched at all — the external contract is unchanged. Live playtest: full save→reload→restore, habit complete/uncomplete XP round-trip, dev-Reset, restart-preserves-runHistory.
2. **Plain-reference retirement (Sonnet)** — convert `activeItems` (and any other) plain-reference deps entries in `itemsDeps`/`agendaListDeps`/`loopDeps` to getters off State; kill the restore-staleness class for good. Tests + live playtest (restore mid-session, then complete an item).
3. **Wrapper retirement pass (Sonnet)** — inline the ~55 one-liner wrappers per fork 5; measure script.js line count (target: boot/wiring only; sub-300 is aspirational, honesty over vanity). Tests + smoke playtest (task create, modal flows, FAB windows).
4. **Docs close-out (Sonnet, can fold into 3)** — ARCHITECTURE.md current-state rewrite, ROADMAP items checked, DECISIONS entries.
