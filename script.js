document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const gameCanvas = document.getElementById('gameCanvas');
    const baseElement = document.getElementById('base');
    const baseHealthDisplay = document.getElementById('baseHealthDisplay');
    const playerXpDisplay = document.getElementById('playerXpDisplay');
    const playerLevelDisplay = document.getElementById('playerLevelDisplay');
    const playerPointsDisplay = document.getElementById('playerPointsDisplay');
    // [P1-DATA-005] sub-session 3, 2026-07-19 — negative-balance red styling + nudge.
    const playerPointsStat = document.getElementById('playerPointsStat');
    const playerPointsNudge = document.getElementById('playerPointsNudge');
    const gameOverMessage = document.getElementById('gameOverMessage');
    const levelUpMessage = document.getElementById('levelUpMessage');
    const activeItemsListUL = document.getElementById('activeItemsList');
    const taskCountDisplay = document.getElementById('taskCountDisplay');
    // [P1-UI-006] sub-session 3, 2026-07-19 — hero chips container over the base.
    const heroBaseZoneEl = document.getElementById('heroBaseZone');
    // Time slider (Milestone 4, 2026-07-20) — canvas/list seam, Today scope.
    const timeSliderEl = document.getElementById('timeSlider');
    const timeSliderLabelEl = document.getElementById('timeSliderLabel');
    // Day pager (Week scope sub-session 2, 2026-07-20).
    const dayPagerPrevBtn = document.getElementById('dayPagerPrev');
    const dayPagerNextBtn = document.getElementById('dayPagerNext');
    const dayPagerLabelEl = document.getElementById('dayPagerLabel');
    const taskSectionTitleEl = document.getElementById('taskSectionTitle');
    // Week strip (sub-session 4, phase 2, 2026-07-20).
    const weekStripRowEl = document.getElementById('weekStripRow');

    // Routine elements
    const routineNameInput = document.getElementById('routineName');
    const createRoutineButton = document.getElementById('createRoutineButton');
    const definedRoutinesListUL = document.getElementById('definedRoutinesList');
    const activeRoutineCountDisplay = document.getElementById('activeRoutineCountDisplay');
    const totalRoutineSlotsDisplay = document.getElementById('totalRoutineSlotsDisplay');
    
    // Control buttons
    const attackButton = document.getElementById('attackButton');
    const restartButton = document.getElementById('restartButton');

    // Category styling configuration
    const categoryStyles = {
        "other": { bgColor: "#90ee90", textColorClass: "category-other-text" },
        "career": { bgColor: "#4a90e2" },
        "creativity": { bgColor: "#f5a623" },
        "financial": { bgColor: "#50e3c2" },
        "health": { bgColor: "#e91e63" },
        "lifestyle": { bgColor: "#bd10e0" },
        "relationships": { bgColor: "#f8e71c", textColorClass: "category-relationships-text" },
        "spirituality": { bgColor: "#7ed321" }
    };

    // (The old SUBTASK CREATION CALL CHAIN MAP comment lived here 2025-07 →
    // 2026-07-18. Every line number and location in it was stale — the code it
    // described now lives in js/items.js, js/spawning.js, and js/ui/popups.js.
    // See docs/ARCHITECTURE.md for the current module map.)

    // [P2-UI-009] session 59: user preference, NOT part of the game save —
    // loaded from js/settings.js's separate `deadline.settings` key at boot
    // and applied to <body> immediately (see DOMContentLoaded below), so it
    // survives a dev Reset / fresh run the same as any other browser setting.
    let effectsIntensity = Settings.load().effectsIntensity;
    // script.js loads at the end of <body> (index.html), so document.body
    // already exists here — no need to wait for DOMContentLoaded.
    Settings.applyEffectsIntensity(effectsIntensity);
    // Ownership of baseHealth, playerXP, playerLevel, playerPoints,
    // routineSlots, playerInventory, sickDayDate, currentRunStats,
    // runHistory, lifetimeStats, achievements, activeItems, completedItems,
    // definedHabits, definedRoutines, itemIdCounter, gameIsOver,
    // daysSurvived, currentGameDate, runStartedAtMs, lastLoopTickMs, and
    // lastRegenTickMs moved to js/state.js (State.getX/State.setX) —
    // Sub-session 1, docs/STATE_OWNERSHIP_PLAN.md, 2026-07-20. Every deps
    // builder below now sources those keys from State.* directly instead of
    // closing over a local `let`.
    let gameLoopInterval;
    let attackMode = false;
    // [P1-UI-006] sub-session 3, 2026-07-19 — ephemeral (NOT persisted, no
    // schema bump this session) per-routine star-rating memory for
    // HeroesView's star-threshold-crossed notice. See js/ui/heroes.js header.
    let heroStarMemory = {};
    // [P1-UI-006] sub-session 5, 2026-07-19 — ephemeral (NOT persisted)
    // per-routine FX timestamps: { [routineId]: { damagedAt, celebratedAt } }.
    // Stamped by itemsDeps' onRoutineDamaged/onRoutineCelebrate, read by
    // renderHeroesAtBase each tick to keep flinch/celebrate animations
    // continuous across the 50ms full-rebuild renders. See js/ui/heroes.js.
    let heroFxMemory = {};


    // --- Game Settings ---
    // Values live in js/config.js (CONFIG) — never hardcode a balance number here.
    const XP_PER_TASK_DEFEAT = CONFIG.XP_PER_TASK_DEFEAT;
    const XP_PER_HABIT_COMPLETE = CONFIG.XP_PER_HABIT_COMPLETE;
    const POINTS_PER_TASK = CONFIG.POINTS_PER_TASK;
    const POINTS_PER_HABIT = CONFIG.POINTS_PER_HABIT;
    const HABIT_STREAK_BONUS_THRESHOLD = CONFIG.HABIT_STREAK_BONUS_THRESHOLD;
    const HABIT_STREAK_STRONG_THRESHOLD = CONFIG.HABIT_STREAK_STRONG_THRESHOLD;
    const LEVEL_XP_THRESHOLDS = CONFIG.LEVEL_XP_THRESHOLDS;
    const ROUTINE_SLOTS_PER_LEVEL = CONFIG.ROUTINE_SLOTS_PER_LEVEL;
    const MAX_PLAYER_LEVEL = LEVEL_XP_THRESHOLDS.length;

    let GAME_SCREEN_WIDTH, BASE_WIDTH, ENEMY_WIDTH, HABIT_ENEMY_WIDTH;

    // Real implementation lives in js/state.js (Milestone 2 extraction,
    // session 11, 2026-07-18) — thin wrapper so this call site is unchanged.
    // Storage for the state it touches stays in script.js (see stateDeps()
    // and js/state.js's header for why ownership didn't move this session).
    function initGame() {
        // [P1-UI-006] sub-session 3, 2026-07-19 — a fresh/reset run starts
        // with no crossing history (the dev Reset button re-calls initGame
        // without a full page reload, so this can't rely on module-load init
        // alone).
        heroStarMemory = {};
        heroFxMemory = {};
        State.initGame(stateDeps());
    }

    // (computeDaysSurvived wrapper inlined at its one call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/damage.js, Milestone 2 extraction #3, 2026-07-18.)

    // (updatePlayerDisplays/updateTaskCountDisplay wrappers inlined at their
    // call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/ui/hud.js, Milestone 2 UI extraction
    // session 2, 2026-07-18.)

    // --- Persistence (js/persistence.js) ---
    // schemaVersion 1 persists the CURRENT in-memory shapes as-is; see
    // docs/DATA_SCHEMA.md + DECISIONS.md (2026-07-17). Call saveGame() after
    // every state mutation — Persistence debounces the actual write.

    // (getPersistableState wrapper was dead code — no call sites in script.js,
    // state.js's own saveGame/rollover call their local getPersistableState
    // directly — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    function saveGame() {
        State.saveGame(stateDeps());
    }

    // Safety net: some edit paths (routine editors, task edit modal) don't call
    // saveGame() directly yet — a periodic save bounds any loss to a few seconds.
    let lastAutosaveMs = 0;

    // True while the offline catch-up animation owns enemy positions;
    // updateActiveItems() skips position/damage work until it finishes.
    let offlineCatchUpActive = false;

    // True while the time slider is being scrubbed (Milestone 4, 2026-07-20)
    // — same "one owner at a time" contract as offlineCatchUpActive above.
    // updateActiveItems() skips position/damage/regen work until release;
    // js/ui/timeSliderView.js owns element.style.left directly while this
    // flag is set.
    let timePreviewActive = false;

    // --- Damage / base health (js/damage.js) ---
    // Milestone 2 extraction #3 (2026-07-18). js/damage.js is the only module so
    // far that WRITES script.js-owned state (baseHealth, gameIsOver), so it gets
    // accessors rather than raw values; see the header comment in js/damage.js
    // for why ownership didn't move. Rebuilt per call because BASE_WIDTH and the
    // DOM handles aren't resolved until initGame() runs.
    function damageDeps() {
        return State.buildDamageDeps(stateDeps());
    }

    // (restoreGameState wrapper inlined at its one call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — runs ONCE on boot, right after
    // initGame() has reset to a fresh state; see the call site near the
    // bottom of this file.)

    // Builds the deps object for js/state.js's initGame/restoreGameState/
    // getPersistableState/saveGame/buildDamageDeps (Milestone 2 extraction,
    // session 11, 2026-07-18). Rebuilt per call, same reasoning as
    // itemsDeps()/damageDeps(): BASE_WIDTH/GAME_SCREEN_WIDTH aren't resolved
    // until initGame() runs, and several fields (completedItems,
    // definedHabits, currentGameDate, etc.) are REASSIGNED elsewhere
    // (new-game reset, restoreGameState itself), so they're threaded through
    // as get/set accessor pairs rather than plain values — extending the
    // js/damage.js precedent for script.js-owned state a module needs to
    // both read and write.
    // Achievements sub-session 2 (session 65, docs/ACHIEVEMENTS_PLAN.md):
    // the single owner-side seam every live lifetime-stats bump funnels
    // through. Mutate → evaluate → record → toast, in that order, so an
    // unlock can never be persisted without having fired its one-time
    // notice (and vice versa). Callers (completeItem/uncompleteItem/
    // resolvePendingCheckIn/gameOver) all call saveGame() themselves after
    // their seam fires, so the mutated lifetimeStats/achievements are
    // picked up by the very next collectGameState — no save call here.
    // FrozenNotice called as a bare stable global (loads before script.js),
    // same pattern as onRoutineFrozen/onStreakMilestone below.
    function applyLifetimeProgress(mutator) {
        const lifetimeStats = State.getLifetimeStats();
        mutator(lifetimeStats);
        const newlyCrossed = Achievements.evaluateAll(CONFIG.ACHIEVEMENTS, lifetimeStats, State.getAchievements());
        if (newlyCrossed.length) {
            State.setAchievements(Achievements.recordUnlocks(State.getAchievements(), newlyCrossed, new Date().toISOString()));
            FrozenNotice.showAchievementUnlockNotice(newlyCrossed);
        }
    }

    // The items.js-facing dispatcher (see completeItem's deps doc for the
    // event vocabulary). Counters clamp at 0 on symmetric decrements;
    // bestHabitStreak is a high-water mark and never rolls back.
    function recordLifetime(event, value) {
        applyLifetimeProgress((stats) => {
            if (event === 'taskCompleted') {
                stats.tasksCompleted = Math.max(0, (stats.tasksCompleted || 0) + value);
            } else if (event === 'habitCompleted') {
                stats.habitsCompleted = Math.max(0, (stats.habitsCompleted || 0) + value);
            } else if (event === 'streakReached') {
                stats.bestHabitStreak = Math.max(stats.bestHabitStreak || 0, value || 0);
            } else if (event === 'pointsRecovered') {
                stats.pointsRecoveries = (stats.pointsRecoveries || 0) + 1;
            }
        });
    }

    function stateDeps() {
        return {
            // DOM
            gameCanvas, baseElement, baseHealthDisplay, gameOverMessage,
            levelUpMessage, restartButton, activeItemsListUL, attackButton,

            // state getters (State.* — ownership moved to js/state.js,
            // Sub-session 1, docs/STATE_OWNERSHIP_PLAN.md, 2026-07-20)
            getBaseHealth: State.getBaseHealth,
            getPlayerXP: State.getPlayerXP,
            getPlayerLevel: State.getPlayerLevel,
            getPlayerPoints: State.getPlayerPoints,
            getRoutineSlots: State.getRoutineSlots,
            getPlayerInventory: State.getPlayerInventory,
            getSickDayDate: State.getSickDayDate,
            getCurrentRunStats: State.getCurrentRunStats,
            getRunHistory: State.getRunHistory,
            getLifetimeStats: State.getLifetimeStats,
            getAchievements: State.getAchievements,
            // Run history sub-session 2 (session 53) — Heroes loads AFTER
            // damage.js in index.html, so gameOver's finalize step reaches
            // Heroes' math through these pre-bound functions rather than a
            // bare-global reference (same reasoning as every other
            // "collaborator from a later-loading module" in damage.js).
            heroesCompletionRate: (routine, habits, windowStartMs) =>
                Heroes.completionRate(routine, habits, windowStartMs),
            heroesStarRating: (rate) => Heroes.starRating(rate, CONFIG.HERO_STAR_TIERS),
            // Game-over review card (Run history sub-session 4, session 55):
            // GameOverView (js/ui/gameOverView.js) loads after js/damage.js,
            // so it's reached through this pre-bound function — same
            // forward-reference reasoning as heroesCompletionRate/
            // heroesStarRating above.
            renderGameOverReview: (deps) => GameOverView.renderReviewCard(deps),
            // Achievements sub-session 2 (session 65): run-end lifetime bump,
            // called by js/damage.js's gameOver ONLY on a real death (never
            // on an alreadyOver restore — gating lives at the call site).
            // Steady Hands rule (CONFIG.STEADY_HANDS_MIN_DAYS survived,
            // routine rate ≥ CONFIG.STEADY_HANDS_MIN_RATE) and the
            // {rate, samples} unwrap MIRROR the v10→v11 retro sweep in
            // js/persistence.js — if one changes, change both (the migration
            // inlines the same values as literals by Persistence's
            // no-module-deps convention).
            recordLifetimeRunEnd: (record, days) => applyLifetimeProgress((stats) => {
                stats.bestRunDaysSurvived = Math.max(stats.bestRunDaysSurvived || 0, days || 0);
                if ((days || 0) >= CONFIG.STEADY_HANDS_MIN_DAYS) {
                    const qualifying = ((record && record.routines) || []).filter((r) => {
                        const rate = r.completionRate && typeof r.completionRate.rate === 'number'
                            ? r.completionRate.rate
                            : null;
                        return rate !== null && rate >= CONFIG.STEADY_HANDS_MIN_RATE;
                    }).length;
                    stats.steadyRoutineRuns = (stats.steadyRoutineRuns || 0) + qualifying;
                }
            }),
            getItemIdCounter: State.getItemIdCounter,
            getDaysSurvived: State.getDaysSurvived,
            getRunStartedAtMs: State.getRunStartedAtMs,
            getCurrentGameDate: State.getCurrentGameDate,
            getActiveItems: State.getActiveItems,
            getCompletedItems: State.getCompletedItems,
            getDefinedHabits: State.getDefinedHabits,
            getDefinedRoutines: State.getDefinedRoutines,
            getGameLoopInterval: () => gameLoopInterval,
            isGameOver: State.isGameOver,
            baseWidth: BASE_WIDTH,
            gameScreenWidth: GAME_SCREEN_WIDTH,

            // state setters (State.* — see getters comment above)
            setGameScreenWidth: (n) => { GAME_SCREEN_WIDTH = n; },
            setBaseWidth: (n) => { BASE_WIDTH = n; },
            setEnemyWidth: (n) => { ENEMY_WIDTH = n; },
            setHabitEnemyWidth: (n) => { HABIT_ENEMY_WIDTH = n; },
            setPlayerXP: State.setPlayerXP,
            setPlayerLevel: State.setPlayerLevel,
            setPlayerPoints: State.setPlayerPoints,
            setRoutineSlots: State.setRoutineSlots,
            setPlayerInventory: State.setPlayerInventory,
            setSickDayDate: State.setSickDayDate,
            setCurrentRunStats: State.setCurrentRunStats,
            setRunHistory: State.setRunHistory,
            setLifetimeStats: State.setLifetimeStats,
            setAchievements: State.setAchievements,
            setBaseHealth: State.setBaseHealth,
            setActiveItems: State.setActiveItems,
            setCompletedItems: State.setCompletedItems,
            setDefinedHabits: State.setDefinedHabits,
            setDefinedRoutines: State.setDefinedRoutines,
            setItemIdCounter: State.setItemIdCounter,
            setGameIsOver: State.setGameIsOver,
            setGameOver: State.setGameOver,
            setDaysSurvived: State.setDaysSurvived,
            setRunStartedAtMs: State.setRunStartedAtMs,
            setLastLoopTickMs: State.setLastLoopTickMs,
            getLastRegenTickMs: State.getLastRegenTickMs,
            setLastRegenTickMs: State.setLastRegenTickMs,
            setAttackMode: (v) => { attackMode = v; },
            setCurrentGameDate: State.setCurrentGameDate,
            setGameLoopInterval: (id) => { gameLoopInterval = id; },
            setOfflineCatchUpActive: (v) => { offlineCatchUpActive = v; },

            // collaborators
            updatePlayerDisplays: () => Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge }),
            updateTaskCountDisplay,
            updateRoutineDisplay,
            updateBaseVisuals: () => Damage.updateBaseVisuals(damageDeps()),
            generateDailyHabitInstances: (forWhichGameDay) => Habits.generateDailyHabitInstances(forWhichGameDay, habitInstanceDeps()),
            generateDailyRoutineTaskInstances: (forWhichGameDay) => Routines.generateDailyRoutineTaskInstances(forWhichGameDay, routineTaskInstanceDeps()),
            // Day-advance mechanism (2026-07-19): restore-path day rollover.
            settleStaleRecurringInstance: (item) => Items.settleStaleRecurringInstance(item, itemsDeps()),
            // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): the
            // check-in-eligible counterpart, called instead for the single
            // most-recent prior day's negative-habit lurker.
            markPendingCheckIn: (item) => Items.markPendingCheckIn(item, itemsDeps()),
            // Sub-session 5 (Cheat Day token, 2026-07-19): checked FIRST,
            // ahead of the check-in-eligible fork above.
            isCheatDayExcusedForItem,
            settleExcusedCheatDay: (item) => Items.settleExcusedCheatDay(item, itemsDeps()),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => Popups.handleEnemyClick(itemId, popupsDeps()), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay: () => Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay }), sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()),
            renderDefinedRoutines: () => RoutineViews.renderDefinedRoutines(routineViewsDeps()),
            renderCompletedItems: () => AgendaList.renderCompletedItems(agendaListDeps()),
            sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()),
            gameOver: (alreadyOver) => Damage.gameOver(damageDeps(), alreadyOver),
            runOfflineCatchUp: (entries, offlineMs) => Damage.runOfflineCatchUp(entries, offlineMs, damageDeps()),
            updateGame,

            // damage-deps passthrough
            markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()),
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            enableFormControls,
            saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurker exclusion
            isNonThreatening: Items.isNonThreatening,
            // [P1-UI-006] sub-session 2, 2026-07-19 — routine health damage/KO
            damageRoutineForItem: (item, amount) => Items.damageRoutineForItem(item, amount, itemsDeps()),
            // Run history sub-session 2, 2026-07-19 session 53 — blame
            // attribution for both offline/live-gap catch-up paths.
            recordRunDamage: (item, amount, nowMs) => Items.recordRunDamageForItem(item, amount, nowMs, itemsDeps()),
        };
    }

    // (computeOfflineOverdueDamage's own wrapper was dead code — no call
    // sites in script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.
    // applyOfflineDamage/runOfflineCatchUp wrappers were ALSO dead code — every
    // real call site is the inlined arrow in stateDeps() above — deleted
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md. Math/animation live in
    // js/damage.js, Milestone 2 extraction #3, 2026-07-18.)

    // Level-up math lives in js/progression.js (Milestone 2 extraction,
    // 2026-07-18) — thin wrapper so this call site is unchanged. A single
    // completion can cross more than one threshold; Progression.checkLevelUp
    // walks all of them in one call instead of the old recursive self-call.
    // No-op since the 2026-07-18 legacy-inline-form deletion (see DECISIONS.md)
    // removed the only elements this ever disabled — a hidden, unreachable
    // form div, never the live FAB/modal buttons. Kept only because
    // js/damage.js's gameOver() still calls deps.enableFormControls(false)
    // unconditionally; real behavior (disabling creation on game over, if
    // wanted at all) belongs to the future UI extraction, not this cleanup.
    function enableFormControls(enabled) {}

    function checkPlayerLevelUp() {
        const result = Progression.checkLevelUp(
            { level: State.getPlayerLevel(), xp: State.getPlayerXP(), slots: State.getRoutineSlots() },
            LEVEL_XP_THRESHOLDS, ROUTINE_SLOTS_PER_LEVEL, MAX_PLAYER_LEVEL
        );

        if (!result.leveledUp) return false;

        State.setPlayerLevel(result.level);
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
        Hud.showLevelUpMessage({ playerLevel: State.getPlayerLevel(), levelUpMessage });

        if (result.slotsUnlocked) {
            State.setRoutineSlots(result.slots);
            Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
            updateRoutineDisplay();
        }

        return true;
    }

    // (showLevelUpMessage wrapper inlined at its one call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/ui/hud.js, Milestone 2 UI extraction session 2, 2026-07-18.)

    // --- Items (js/items.js) ---
    // Milestone 2 extraction session 10, 2026-07-18 — see js/items.js's header
    // comment for the full rationale (this was never part of the UI extraction
    // plan; found during session 10's scoping, see docs/DECISIONS.md/ROADMAP.md).
    //
    // activeItems is a plain reference (agendaListDeps() precedent).
    // completedItems/definedHabits are GETTERS (reassigned elsewhere — new-game
    // reset, restoreGameState). gameIsOver is a GETTER for the same reason
    // js/spawning.js uses one (handlers can outlive the call). playerXP/
    // playerPoints get get/set accessor pairs, matching js/damage.js's
    // baseHealth/gameIsOver precedent for script.js-owned state a module needs
    // to WRITE. gameScreenWidth/baseWidth/enemyWidth/habitEnemyWidth are plain
    // values rebuilt fresh on every call (not resolved until initGame() runs —
    // same reasoning as damageDeps()). Habits/CONFIG are called as bare stable
    // globals inside js/items.js itself, not threaded through here.
    // definedRoutines is a GETTER too (added "Frozen routine slots" sub-session
    // 1, 2026-07-19) — same reassignment reason as definedHabits. FrozenSlots
    // is called as a bare stable global inside js/items.js, same as Habits/CONFIG.
    function itemsDeps() {
        return {
            activeItems: State.getActiveItems(),
            completedItems: () => State.getCompletedItems(),
            definedHabits: () => State.getDefinedHabits(),
            // Frozen routine slots ("Frozen routine slots + recovery" ticket,
            // sub-session 1, 2026-07-19): items.js looks up a negative
            // habit's owning routine to check/clear frozenState. GETTER for
            // the same reassignment reason as definedHabits above.
            definedRoutines: () => State.getDefinedRoutines(),
            // Sub-session 3 (2026-07-19): notifies the player exactly once
            // when a routine freezes. FrozenNotice is a small dedicated UI
            // module (js/ui/frozenNotice.js), same "module called as a bare
            // stable global from inside a script.js wrapper" pattern as
            // CheckIn.showCheckInModal above.
            onRoutineFrozen: (routine, habitDef) => {
                FrozenNotice.showFrozenRoutineNotice(routine.name, habitDef.name);
            },
            // Routine health damage + KO ([P1-UI-006] sub-session 2,
            // 2026-07-19): the recall machinery a KO reuses, and the
            // one-time notice, same "module called as a bare stable global
            // from inside a script.js wrapper" pattern as onRoutineFrozen.
            clearActiveInstancesForRoutine,
            onRoutineKo: (routine) => {
                FrozenNotice.showRoutineKoNotice(routine.name);
            },
            // Interaction FX ([P1-UI-006] sub-session 5, 2026-07-19): stamp
            // ephemeral timestamps for HeroesView's flinch/celebrate
            // animations — no DOM here, render reads them each tick.
            onRoutineDamaged: (routine) => {
                (heroFxMemory[routine.id] = heroFxMemory[routine.id] || {}).damagedAt = Date.now();
            },
            onRoutineCelebrate: (routine) => {
                (heroFxMemory[routine.id] = heroFxMemory[routine.id] || {}).celebratedAt = Date.now();
            },
            isGameOver: State.isGameOver,
            getPlayerXP: State.getPlayerXP,
            setPlayerXP: State.setPlayerXP,
            getPlayerPoints: State.getPlayerPoints,
            setPlayerPoints: State.setPlayerPoints,
            // Run history (session 53, docs/RUN_HISTORY_PLAN.md sub-session
            // 2): recordRunDamageForItem/completion-counter call sites read
            // the live accumulator through this getter (same "owned in
            // script.js, reached via accessor" pattern as everything else
            // here — the object itself is mutated in place, no setter needed).
            getCurrentRunStats: State.getCurrentRunStats,
            // Frozen-slots sub-session 5 (2026-07-19): Items.useSickDayGlobally
            // writes the global Sick Day marker through this setter.
            setSickDayDate: State.setSickDayDate,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH,
            habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD,
            habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD,
            // [P2-UI-009] session 59: fires a one-time toast the moment a
            // habit's streak crosses a visual tier (3 = on-fire, 7 =
            // blazing). Optional dep — tests that don't pass it simply skip
            // the notification (items.js guards with typeof === 'function').
            onStreakMilestone: (habitName, streak, tier) => {
                FrozenNotice.showStreakMilestoneNotice(habitName, streak, tier);
            },
            // Achievements sub-session 2 (session 65): the lifetime-stats
            // dispatcher (see recordLifetime above / completeItem's deps doc).
            recordLifetime,
            xpPerTaskDefeat: XP_PER_TASK_DEFEAT,
            xpPerHabitComplete: XP_PER_HABIT_COMPLETE,
            pointsPerTask: POINTS_PER_TASK,
            pointsPerHabit: POINTS_PER_HABIT,
            getNextId: () => {
                const n = State.getItemIdCounter();
                State.setItemIdCounter(n + 1);
                return n;
            },
            gameCanvas,
            handleEnemyClick, createListItem, sortAndRenderActiveList,
            resetAllSubTaskCheckboxes, updateTaskCountDisplay, renderCompletedItems,
            updatePlayerDisplays: () => Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge }), checkPlayerLevelUp, saveGame,
            calculateTimelineXWithClustering, getSubTaskClusterOffset, getItemTopPosition
        };
    }

    // (createTaskItemData/damageRoutineForItem/recordRunDamage wrappers
    // inlined at their call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md
    // — real implementations live in js/items.js.)

    // (addItemToGame wrapper inlined at its call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/spawning.js, Milestone 2 extraction, 2026-07-17.)

    // Thin wrappers — real implementations live in js/ui/agendaList.js
    // (Milestone 2 UI extraction sessions 6-7, 2026-07-18). Call sites
    // unchanged.
    //
    // isGameOver is passed as a GETTER, not a boolean: createListItem attaches
    // click handlers that outlive this call (the "+ Sub-task" button reads the
    // flag when clicked), so a snapshotted value would go stale after game
    // over. Same reason js/spawning.js passes `isGameOver: () => gameIsOver`.
    // activeItems and categoryStyles are stable bindings, so plain references
    // are correct for those. completedItems and definedHabits are GETTERS
    // (session 7) because both are REASSIGNED elsewhere (new-game reset,
    // restoreGameState) rather than only mutated in place.
    function agendaListDeps() {
        return {
            activeItems: State.getActiveItems(), categoryStyles,
            completeItem: (itemId) => Items.completeItem(itemId, itemsDeps()),
            isGameOver: State.isGameOver,
            showEditTaskModal: (item) => Popups.showEditTaskModal(item, popupsDeps()),
            showEditHabitInstanceModal: (itemData) => AgendaList.showEditHabitInstanceModal(itemData, agendaListDeps()),
            createSubTaskPrompt: (parentId) => Popups.createSubTaskPrompt(parentId, popupsDeps()),
            activeItemsListUL,
            completedItems: () => State.getCompletedItems(),
            uncompleteItem: (itemId) => Items.uncompleteItem(itemId, itemsDeps()),
            definedHabits: () => State.getDefinedHabits(),
            showEditHabitForm: (routineId, habitDef) => RoutineViews.showEditHabitForm(routineId, habitDef)
        };
    }

    // (createListItem/showEditHabitInstanceModal wrappers inlined at their
    // call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/ui/agendaList.js, Milestone 2 UI extraction
    // sessions 6-7, 2026-07-18.)

    // Thin wrappers — real implementations live in js/ui/popups.js
    // (Milestone 2 UI extraction session 5, 2026-07-18). Call sites
    // unchanged. Two dead local `today` variables (computed, never used)
    // were dropped during the move — zero behavior effect, verified by
    // Grep before removing.
    function popupsDeps() {
        return {
            gameIsOver: State.isGameOver(), activeItems: State.getActiveItems(),
            completeItem: (itemId) => Items.completeItem(itemId, itemsDeps()),
            indulgeHabit: (itemId) => Items.indulgeHabit(itemId, itemsDeps()),
            createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()),
            sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()),
            saveGame, recomputeOverdueStateAfterEdit: (item) => Items.recomputeOverdueStateAfterEdit(item, itemsDeps()),
            createTaskItemData: (name, category, isHighPriority, dueDateStr, dueTimeStr, parentId) => Items.createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, itemsDeps()),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => Popups.handleEnemyClick(itemId, popupsDeps()), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay: () => Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay }), sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            // Pushback ([P1-UI-008] session 4): the pushback tiers, a live
            // points getter (popup re-checks affordability after each buy),
            // and the handler that pays + shifts the target's due date.
            pushbackCatalog: CONFIG.SHOP_ITEMS.filter(i => i.category === 'pushback'),
            getPlayerPoints: State.getPlayerPoints,
            onPushback: handlePushback,
            // Cheat Day targeting ([P1-DATA-005] sub-session 5, 2026-07-19):
            // held count for the popup's "Use Cheat Day (N held)" button,
            // whether THIS lurker's day already has one active (shows the
            // "active" note instead), and the handler that consumes a token
            // + sets the target habit definition's cheatDayDate.
            getCheatDayHeldCount: () => Shop.heldCount(State.getPlayerInventory(), 'cheat_day'),
            isCheatDayActiveForItem: (item) => {
                const habitDef = State.getDefinedHabits().find(def => def.id === item.definitionId);
                return !!habitDef && Items.isCheatDayExcused(habitDef, item.originalDueDate);
            },
            onUseCheatDay: handleUseCheatDay,
            // Skip Day targeting (frozen-slots sub-session 5, 2026-07-19):
            // held count for the popup's "Use Skip Day (N held)" button
            // (shown for ANY habit type, not just negative — see popups.js's
            // buildSkipDaySectionHtml) and the handler that consumes a token
            // + excuses + removes the targeted instance.
            getSkipDayHeldCount: () => Shop.heldCount(State.getPlayerInventory(), 'skip_day'),
            onUseSkipDay: handleUseSkipDay,
            // Dependent due dates ([P1-DATA-004] sub-session 2): after a
            // PARENT's deadline is edited, re-clamp any children now due
            // later than it (Jeremy's clamp model — earlier allowed, later
            // never; parent-pull re-clamps, parent-push leaves children).
            clampSubTaskDueDates: (parentItem) => Items.clampSubTasksToParentDeadline(parentItem, itemsDeps())
        };
    }

    // (handleEnemyClick/showEditTaskModal wrappers inlined at their call
    // sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // (completeItem/indulgeHabit/removeItem wrappers inlined at their call
    // sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/items.js, Milestone 2 extraction
    // session 10, 2026-07-18 / sub-session 2b, 2026-07-19.)

    // (settleStaleRecurringInstance wrapper inlined at its call site
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real implementation
    // lives in js/items.js, day-advance mechanism, 2026-07-19.)

    // (markPendingCheckIn/resolvePendingCheckIn wrappers inlined at their
    // call sites sub-session 3, docs/STATE_OWNERSHIP_PLAN.md — real
    // implementations live in js/items.js, sub-session 4, [P1-DATA-005],
    // 2026-07-19, check-in prompt.)

    // Thin wrappers — real implementations live in js/items.js (sub-session 5,
    // [P1-DATA-005], 2026-07-19, Cheat Day token). Called by state.js's
    // restoreGameState (stateDeps()) ahead of the check-in-eligible fork.
    function isCheatDayExcusedForItem(item) {
        const habitDef = State.getDefinedHabits().find(def => def.id === item.definitionId);
        return !!habitDef && Items.isCheatDayExcused(habitDef, item.originalDueDate);
    }

    // (settleExcusedCheatDay wrapper inlined at its call site sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)

    // Builds the deps object for js/ui/checkIn.js's showCheckInModal
    // (sub-session 4, [P1-DATA-005], 2026-07-19). definedHabits is a GETTER
    // (reassigned on new-game reset / restoreGameState), matching the
    // itemsDeps() precedent.
    function checkInDeps() {
        return {
            getDefinedHabits: State.getDefinedHabits,
            resolvePendingCheckIn: (habitDefId, outcome) => Items.resolvePendingCheckIn(habitDefId, outcome, itemsDeps()),
        };
    }

    // Shows the check-in modal if restoring the save left any pendingCheckIn
    // markers (state.js's rollover routing). Safe to call unconditionally —
    // CheckIn.showCheckInModal no-ops when nothing is pending.
    function showCheckInIfPending() {
        if (typeof CheckIn !== 'undefined') {
            CheckIn.showCheckInModal(checkInDeps());
        }
    }

    // (createSubTaskPrompt/uncompleteItem/resetAllSubTaskCheckboxes/
    // renderCompletedItems wrappers inlined at their call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)

    // The following wrappers are kept as REAL functions (NOT inlined,
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md) — each is referenced as a
    // bare identifier (object-shorthand deps entry, e.g. `{ createListItem }`,
    // not just a direct call) at multiple deps-builder sites, so inlining
    // would mean rewriting every one of those into an arrow (increases line
    // count, same reasoning saveGame was left alone for). A first attempt
    // this sub-session deleted these wrappers but missed the bare-reference
    // call sites, leaving real ReferenceErrors that only surfaced live in
    // Chrome (Jest never loads script.js) — a systematic re-check of every
    // "inlined at call sites" claim found 6 total broken this way (this one
    // plus createListItem, handleEnemyClick, removeItem, renderCompletedItems,
    // resetAllSubTaskCheckboxes below); all restored + verified live before
    // commit.
    function sortAndRenderActiveList() {
        AgendaList.sortAndRenderActiveList(agendaListDeps());
    }

    function createListItem(itemData) {
        return AgendaList.createListItem(itemData, agendaListDeps());
    }

    function handleEnemyClick(itemId) {
        Popups.handleEnemyClick(itemId, popupsDeps());
    }

    function removeItem(itemId) {
        Items.removeItem(itemId, itemsDeps());
    }

    function renderCompletedItems() {
        AgendaList.renderCompletedItems(agendaListDeps());
    }

    function resetAllSubTaskCheckboxes() {
        AgendaList.resetAllSubTaskCheckboxes();
    }

    // Single choke point (2026-07-20, Milestone 5 UX batch — playtest
    // finding #1): every deps.updateTaskCountDisplay() call site across
    // items.js/spawning.js/state.js resolves here. Previously two separate
    // inline closures called Hud.updateTaskCountDisplay directly and never
    // touched the week strip, so completing/creating a task left the strip's
    // per-day counts stale until the next pager navigation. DayPagerView's
    // refreshWeekStrip() is a no-op if weekStripRowEl isn't wired (module
    // not yet init'd) or the row itself is absent, matching renderWeekStrip's
    // own guard.
    function updateTaskCountDisplay() {
        Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay });
        DayPagerView.refreshWeekStrip();
    }

    // (markAsOverdue wrapper inlined at its one call site (loopDeps) sub-session
    // 3, docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/items.js, Milestone 2 extraction session 10, 2026-07-18.)

    // Re-derives isOverdue from the item's CURRENT dueDateTime — call after any
    // edit that changes an item's due date, since isOverdue is otherwise only
    // ever set forward by Items.markAsOverdue/updateActiveItems and never
    // re-checked. Without this, editing an overdue task's deadline into the
    // future left it camped at the base still taking damage (see
    // showEditTaskModal save handler, DECISIONS.md 2026-07-17).
    // (Wrapper inlined at its two call sites (popupsDeps, handlePushback)
    // sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // Sub-task cluster offset + visible-edge math live in js/movement.js
    // (Milestone 2 extraction, 2026-07-17). Thin wrapper — call site unchanged.
    function getSubTaskClusterOffset(item) {
        return Movement.getSubTaskClusterOffset(item, {
            activeItems: State.getActiveItems(),
            enemyWidth: ENEMY_WIDTH
        });
    }

    // Growing/shrinking parent visuals ([P1-DATA-004] sub-session 4,
    // 2026-07-19) — pure math lives in js/movement.js. Thin wrapper, called
    // per tick from loopDeps().
    function getParentRenderWidth(item) {
        return Movement.getParentRenderWidth(item, ENEMY_WIDTH);
    }

    // Sub-task clustering vs own-urgency logic lives in js/movement.js
    // (Milestone 2 extraction, 2026-07-17). Thin wrapper — call site unchanged.
    function calculateTimelineXWithClustering(item, currentTime) {
        return Movement.calculateTimelineXWithClustering(item, currentTime, {
            activeItems: State.getActiveItems(),
            dims: {
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                enemyWidth: ENEMY_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH
            }
        });
    }

    // Sub-task-vs-parent vertical alignment lives in js/movement.js (Milestone 2
    // extraction, 2026-07-17). Wrapper reads the live canvas height (DOM) here;
    // call site unchanged.
    function getItemTopPosition(item, itemHeight) {
        return Movement.getItemTopPosition(item, itemHeight, {
            activeItems: State.getActiveItems(),
            canvasHeight: gameCanvas.offsetHeight
        });
    }

    // Timeline position math lives in js/clock.js (Milestone 2 extraction,
    // 2026-07-17) — thin wrapper so every existing call site is unchanged.
    function calculateTimelinePosition(item, currentTime) {
        return Clock.calculateTimelinePosition(item, currentTime, {
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH
        });
    }

    // --- Game loop (js/loop.js) ---
    // Milestone 2 extraction session 12, 2026-07-18 — the per-tick loop
    // (updateGame/updateActiveItems) was the last real game logic in this
    // file. Thin wrappers so all call sites (setInterval in state.js's
    // initGame via stateDeps().updateGame, offline catch-up) are unchanged.
    function loopDeps() {
        return {
            isGameOver: State.isGameOver,
            isOfflineCatchUpActive: () => offlineCatchUpActive,
            // Time slider (Milestone 4, 2026-07-20) — REQUIRED, same
            // "one owner at a time" contract as isOfflineCatchUpActive above.
            isTimePreviewActive: () => timePreviewActive,
            activeItems: State.getActiveItems(),
            baseWidth: BASE_WIDTH,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            getLastLoopTickMs: State.getLastLoopTickMs,
            setLastLoopTickMs: State.setLastLoopTickMs,
            getLastRegenTickMs: State.getLastRegenTickMs,
            setLastRegenTickMs: State.setLastRegenTickMs,
            getLastAutosaveMs: () => lastAutosaveMs,
            setLastAutosaveMs: (n) => { lastAutosaveMs = n; },
            markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()),
            getSubTaskClusterOffset,
            calculateTimelineXWithClustering,
            damageBase: (amount) => Damage.damageBase(amount, damageDeps()),
            damageRoutineForItem: (item, amount) => Items.damageRoutineForItem(item, amount, itemsDeps()),
            // Run history sub-session 2, 2026-07-19 session 53 — live-tick
            // blame attribution (loop.js's own overdue-damage call site).
            recordRunDamage: (item, amount, nowMs) => Items.recordRunDamageForItem(item, amount, nowMs, itemsDeps()),
            healBase: (amount) => Damage.healBase(amount, damageDeps()),
            updateMidnightLine,
            runLiveGapCatchUp: () => Damage.runLiveGapCatchUp(damageDeps()),
            saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurker exclusion
            isNonThreatening: Items.isNonThreatening,
            // [P1-DATA-004] sub-session 4, 2026-07-19 — growing parent visuals
            getParentRenderWidth,
            // Time slider (Milestone 4, 2026-07-20) — keeps the handle/label
            // creeping forward with live time when nobody's scrubbing it.
            // OPTIONAL in loop.js (omitted = no-op) so loop.test.js's
            // existing deps objects don't need updating for this alone.
            updateTimeSliderHandle: (time) => TimeSliderView.syncHandle(time),
            // Day pager (Week scope sub-session 2, 2026-07-20) — MUST run
            // even while previewing (see js/loop.js's updateGame comment for
            // why); OPTIONAL so loop.test.js's existing deps objects don't
            // need updating for this alone.
            checkDayPagerRollover: () => DayPagerView.checkRolloverReset(),
            // LIVE mid-session day rollover (2026-07-20) — stateDeps()
            // already carries every field State.checkLiveDayRollover needs
            // (it's the same deps shape restoreGameState's rollover branch
            // uses), so this reuses the existing builder rather than
            // duplicating fields here. See js/loop.js's updateGame comment.
            checkLiveDayRollover: () => State.checkLiveDayRollover(stateDeps()),
        };
    }

    // (updateActiveItems wrapper was dead code — no call sites in script.js
    // — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    // Midnight-line math lives in js/clock.js (Milestone 2 extraction,
    // 2026-07-17) — thin wrapper so the call site is unchanged.
    function updateMidnightLine(currentTime) {
        Clock.updateMidnightLine(currentTime, {
            gameScreenWidth: GAME_SCREEN_WIDTH,
            baseWidth: BASE_WIDTH
        });
    }

    // Time slider (Milestone 4, 2026-07-20) — deps for js/ui/timeSliderView.js.
    // dims is a FUNCTION, not a plain object, because GAME_SCREEN_WIDTH/
    // BASE_WIDTH/HABIT_ENEMY_WIDTH aren't resolved until initGame() runs
    // (same reasoning as loopDeps()'s baseWidth/gameScreenWidth rebuild —
    // here it has to be re-evaluated on every scrub event too, not just once
    // at init time, since a window resize between events would otherwise go
    // stale).
    function timeSliderDeps() {
        return {
            sliderEl: timeSliderEl,
            labelEl: timeSliderLabelEl,
            getActiveItems: State.getActiveItems,
            isNonThreatening: Items.isNonThreatening,
            calculateTimelineXWithClustering,
            updateMidnightLine,
            dims: () => ({
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH,
            }),
            setTimePreviewActive: (v) => { timePreviewActive = v; },

            // Damage/routine-HP projection (2026-07-20, same session —
            // Jeremy's follow-up: "the preview also needs to show base
            // damage and freezes"). One optional-collaborator group, see
            // timeSliderView.js's header for the full contract.
            getBaseHealth: State.getBaseHealth,
            getLastRegenTickMs: State.getLastRegenTickMs,
            baseElement,
            baseHealthDisplayEl: baseHealthDisplay,
            resolveBaseImage: Damage.resolveBaseImage,
            getDefinedRoutines: State.getDefinedRoutines,
            getRoutineIdForItem: (item) => {
                const routine = Items.findRoutineForItem(item, {
                    definedHabits: State.getDefinedHabits,
                    definedRoutines: State.getDefinedRoutines,
                });
                return routine ? routine.id : null;
            },
            renderHeroesAtBase,
            heroBaseZoneEl,
        };
    }

    // Day pager (Week scope sub-session 2, 2026-07-20) — deps for
    // js/ui/dayPagerView.js. Every def/item collection arrives as a GETTER
    // (definedHabits/definedRoutines/completedItems are REASSIGNED on
    // restore/reset; activeItems is a getter here too for symmetry, though
    // it's actually a stable reference — matches agendaListDeps()'s own
    // getter-vs-plain-reference split reasoning).
    function dayPagerViewDeps() {
        return {
            prevBtn: dayPagerPrevBtn,
            nextBtn: dayPagerNextBtn,
            labelEl: dayPagerLabelEl,
            taskSectionTitleEl,
            gameCanvasEl: gameCanvas,
            activeItemsListEl: activeItemsListUL,
            timeSliderEl,
            weekStripRowEl,
            // 2026-07-20 Milestone 5 UX batch (playtest finding #3): the
            // header count previously always showed Hud's global activeItems
            // count regardless of viewed day. taskCountDisplayEl lets
            // dayPagerView set a day-scoped count on ghost/snapshot pages;
            // updateTaskCountDisplay restores the real global count on
            // return to Today (Today itself must keep counting activeItems
            // directly — same convention DayPager.weekStripSummary already
            // uses for Today, see js/dayPager.js).
            taskCountDisplayEl: taskCountDisplay,
            updateTaskCountDisplay,
            completedTasksSectionEl: document.getElementById('completedTasksSection'),
            getCurrentGameDate: State.getCurrentGameDate,
            getDefinedHabits: State.getDefinedHabits,
            getDefinedRoutines: State.getDefinedRoutines,
            getDefinedTasks: () => window.definedTasks || [],
            getCompletedItems: State.getCompletedItems,
            getActiveItems: State.getActiveItems,
            getSickDayDate: State.getSickDayDate,
            dims: () => ({
                gameScreenWidth: GAME_SCREEN_WIDTH,
                baseWidth: BASE_WIDTH,
                enemyWidth: ENEMY_WIDTH,
                habitEnemyWidth: HABIT_ENEMY_WIDTH,
            }),
            setTimePreviewActive: (v) => { timePreviewActive = v; },
            renderTodayAgenda: () => sortAndRenderActiveList(),
        };
    }

    // Base sprite / damage / game-over all live in js/damage.js (Milestone 2
    // extraction #3, 2026-07-18).
    // (updateBaseVisuals's own wrapper was dead code — every real call site
    // is the inlined arrow in stateDeps() above — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. damageBase/healBase/runLiveGapCatchUp
    // wrappers inlined at their call sites — loopDeps() and handleShopUse's
    // repair-kit branch — same session.)

    // (gameOver's own wrapper was dead code — every real call site is the
    // inlined arrow in stateDeps() above (`gameOver: (alreadyOver) =>
    // Damage.gameOver(damageDeps(), alreadyOver)`) — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. alreadyOver (sub-session 4, session 55):
    // forwarded from State.restoreGameState's restore-time re-call — see
    // js/damage.js's gameOver() header for why this distinction exists.)

    function updateGame() {
        Loop.updateGame(loopDeps());
        // [P1-UI-006] sub-session 3, 2026-07-19 — hero chips render from
        // state only, so a per-tick call keeps them live across every event
        // that can change a routine's health/XP/level/star rate/frozen/KO/
        // active state, without new render hooks inside the pure modules.
        renderHeroesAtBase();
    }

    // Habit system functions
    function createHabitDefinition(name, category, scheduleOrFrequency, timeOfDay, isNegative = false) {
        const newHabitDef = {
            id: `habitDef_${State.getDefinedHabits().length}_${Date.now()}`,
            name,
            category,
            // Recurrence is a `schedule` object as of schemaVersion 3 (2026-07-18).
            // Schedule.normalize accepts either a full schedule object (the
            // scheduling UI, session 15) or a legacy bare frequency string
            // (any older caller), so this one call handles both.
            schedule: Schedule.normalize(scheduleOrFrequency),
            timeOfDay,
            isNegative,
            // null = standalone (not owned by any routine), so it spawns daily
            // regardless of routine state. See docs/DATA_SCHEMA.md's Habit shape
            // and Habits.selectHabitDefsToSpawn.
            routineId: null,
            streak: 0,
            lastCompletionDate: null,
            // Seeded empty; the rate-based points bonus (future session) records
            // into this. See DECISIONS.md 2026-07-18.
            occurrenceHistory: [],
            // [P1-DATA-005] sub-session 5 (Cheat Day token, 2026-07-19,
            // schemaVersion 5): null = no active excused day. Only meaningful
            // for negative habits, but seeded on every habit for shape
            // consistency with the persisted/migrated form.
            cheatDayDate: null,
            // Frozen routine slots (schemaVersion 6, 2026-07-19): recovery
            // path 1 (edit-to-unfreeze) appends to this. See js/frozenSlots.js.
            // Only meaningful for routine-owned negative habits, seeded on
            // every habit for shape consistency (same reasoning as cheatDayDate).
            modificationHistory: [],
            // Frozen-slots sub-session 5 (Sick/Skip Day tokens, 2026-07-19,
            // schemaVersion 7): null = no active excused day for THIS habit.
            // Seeded on every habit (not just negative ones — Skip Day
            // applies to any habit type). See js/items.js's useSkipDayOnItem.
            skipDayDate: null
        };

        State.getDefinedHabits().push(newHabitDef);
        generateDailyHabitInstances(State.getCurrentGameDate());
        saveGame();
    }

    // Habit instance creation, daily spawn selection, and streak math live in
    // js/habits.js (Milestone 2 extraction, 2026-07-18) — the functions below
    // are thin wrappers so every existing call site is unchanged. See
    // js/habits.js's header comment for the deps shape and the one
    // deliberately-preserved pre-existing bug (streak-bonus asymmetry).
    function habitInstanceDeps() {
        return {
            getNextId: () => {
                const n = State.getItemIdCounter();
                State.setItemIdCounter(n + 1);
                return n;
            },
            calculateTimelinePosition,
            gameScreenWidth: GAME_SCREEN_WIDTH,
            habitEnemyWidth: HABIT_ENEMY_WIDTH,
            // [P1-DATA-005] session 27, repositioned session 29 — a negative
            // habit's fixed lurk x anchors to the far right of the canvas
            // (gameScreenWidth above), not the base.
            negativeLurkRightMarginPx: CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX,
            definedHabits: State.getDefinedHabits(),
            definedRoutines: State.getDefinedRoutines(),
            activeItems: State.getActiveItems(),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => Popups.handleEnemyClick(itemId, popupsDeps()), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay: () => Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay }), sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            sortAndRenderActiveList,
            // Frozen-slots sub-session 5 (2026-07-19): the global Sick Day
            // spawn gate — see Habits.selectHabitDefsToSpawn.
            sickDayDate: State.getSickDayDate()
        };
    }

    // (getHabitInstanceDueTime/createHabitInstanceData wrappers were dead
    // code — no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)
    function generateDailyHabitInstances(forWhichGameDay) {
        Habits.generateDailyHabitInstances(forWhichGameDay, habitInstanceDeps());
    }

    // --- Routine task instances (2026-07-18) ---
    // Routine TASKS previously had no spawn path at all: createNewTaskInRoutine
    // stored a definition in definedTasks and nothing ever turned it into a live
    // item, so a task added through a routine could never appear on the board or
    // in the agenda (see docs/DECISIONS.md). Routine tasks recur DAILY, the same
    // as routine habits — decided with Jeremy 2026-07-18.

    // Routine task instance helpers now live in js/routines.js (Milestone 2
    // extraction #6, 2026-07-18) — thin wrappers so every call site is
    // unchanged. See docs/ARCHITECTURE.md / DECISIONS.md.
    function routineTaskInstanceDeps() {
        return {
            getNextId: () => {
                const n = State.getItemIdCounter();
                State.setItemIdCounter(n + 1);
                return n;
            },
            gameScreenWidth: GAME_SCREEN_WIDTH,
            enemyWidth: ENEMY_WIDTH,
            calculateTimelineXWithClustering,
            definedTasks: window.definedTasks || (window.definedTasks = []),
            definedRoutines: State.getDefinedRoutines(),
            activeItems: State.getActiveItems(),
            completedItems: State.getCompletedItems(),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => Popups.handleEnemyClick(itemId, popupsDeps()), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay: () => Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay }), sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            sortAndRenderActiveList
        };
    }

    // (getRoutineTaskInstanceDueTime/createRoutineTaskInstanceData wrappers
    // were dead code — no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md.)
    // Daily spawn pass for routine tasks, mirroring generateDailyHabitInstances.
    function generateDailyRoutineTaskInstances(forWhichGameDay) {
        Routines.generateDailyRoutineTaskInstances(forWhichGameDay, routineTaskInstanceDeps());
    }

    // Routine management functions
    function createRoutineDefinition() {
        const result = Routines.createRoutineDefinition(routineNameInput.value, State.getDefinedRoutines());
        if (!result.ok) {
            alert(result.reason === 'empty' ? "Please enter a routine name." : "Routine name already exists.");
            return;
        }

        State.getDefinedRoutines().push(result.routine);
        routineNameInput.value = '';
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        saveGame();
    }

    function deleteRoutine(routineId) {
        const routine = State.getDefinedRoutines().find(r => r.id === routineId);
        if (!routine) return;

        if (confirm(`Are you sure you want to delete the routine "${routine.name}"?`)) {
            // Recalls active habit/task instances before removing the routine
            // — see js/routines.js's deleteRoutine for the bugfix rationale
            // and DECISIONS.md.
            Routines.deleteRoutine(routineId, { definedRoutines: State.getDefinedRoutines(), activeItems: State.getActiveItems(), removeItem, definedHabits: State.getDefinedHabits() });
            saveGame();

            // Update routines window if open
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }
    // Pre-existing bug (found live 2026-07-18, right after the routines
    // extraction): showRoutineManagement's Delete Routine button uses an
    // inline onclick="deleteRoutine(...)" string, which runs in GLOBAL scope
    // — but deleteRoutine was only ever a closure-scoped function inside this
    // DOMContentLoaded wrapper, never attached to window like its siblings
    // (window.closeModal, window.saveNewHabit, window.saveNewTask,
    // window.saveEditedHabit, window.saveEditedTask). The click silently
    // failed to find the function. Not introduced by the routines.js
    // extraction — the function body moved, but its scope didn't change.
    window.deleteRoutine = deleteRoutine;
    
    // (attachRoutineManagementListeners wrapper was dead code — no call
    // sites in script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function removeHabitFromRoutine(routineId, habitDefId) {
        if (Routines.removeHabitFromRoutine(routineId, habitDefId, State.getDefinedRoutines(), State.getDefinedHabits())) {
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
            saveGame();
        }
    }

    function createNewHabitInRoutine(routineId, habitData) {
        const newHabit = Routines.createNewHabitInRoutine(routineId, habitData, State.getDefinedRoutines(), State.getDefinedHabits());
        if (!newHabit) return;

        generateDailyHabitInstances(State.getCurrentGameDate());
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        saveGame();
    }

    function createNewTaskInRoutine(routineId, taskData) {
        if (!window.definedTasks) window.definedTasks = [];
        const newTaskDef = Routines.createNewTaskInRoutine(routineId, taskData, State.getDefinedRoutines(), definedTasks);
        if (!newTaskDef) return;

        // Spawn today's instance immediately, matching createNewHabitInRoutine.
        // Without this the definition existed but never became a live enemy —
        // the task appeared in the routine window only. See DECISIONS.md.
        generateDailyRoutineTaskInstances(State.getCurrentGameDate());
        RoutineViews.renderDefinedRoutines(routineViewsDeps());
        saveGame();
    }

    // Sub-session 4 (2026-07-19): passes definedRoutines + an
    // onRoutineUnfrozen notifier so a real edit to the habit that froze its
    // routine clears frozenState and shows the one-time unfreeze notice
    // (recovery path 1, docs/FROZEN_SLOTS_PLAN.md). Same
    // "module called as bare stable global" pattern as itemsDeps()'s
    // onRoutineFrozen.
    function editHabitInRoutine(habitId, updatedData) {
        if (Routines.editHabitInRoutine(habitId, updatedData, State.getDefinedHabits(), State.getDefinedRoutines(), {
            onRoutineUnfrozen: (routine, habitDef) => {
                FrozenNotice.showRoutineUnfrozenNotice(routine.name, habitDef.name);
            }
        })) {
            RoutineViews.renderDefinedRoutines(routineViewsDeps());

            // Update the FAB->Routines popup if open — same staleness fix as
            // deleteRoutine (it's a separate windowing system from Modal's
            // overlays, so renderDefinedRoutines() alone doesn't touch it).
            // See docs/ROADMAP.md Known bugs / DECISIONS.md session 38/40.
            setTimeout(() => {
                if (managementWindows.routines && !managementWindows.routines.classList.contains('hidden')) {
                    populateRoutinesWindow();
                }
            }, 100);
        }
    }

    function editTaskInRoutine(taskId, updatedData) {
        if (Routines.editTaskInRoutine(taskId, updatedData, definedTasks)) {
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
        }
    }

    function removeTaskFromRoutine(routineId, taskId) {
        Routines.removeTaskFromRoutine(routineId, taskId, State.getDefinedRoutines());
    }

    // ------------------------------------------------------------------
    // Routine transfer ([P2-UI-013], session 62). Pure move lives in
    // js/routines.js; these wrappers own the board reconciliation:
    //
    // 1. If the DESTINATION wouldn't spawn the definition (inactive, frozen,
    //    KO'd), its live instances are recalled — same pure-removal
    //    semantics as deactivation's recall (no XP/streak/damage change),
    //    via the same removeItem path. Habits use isRoutineUsableForHabit
    //    (a frozen dest still spawns its own offender's lurker); tasks use
    //    the no-exception isRoutineSuspended.
    // 2. Then BOTH daily generators run — if the destination IS active and
    //    the source wasn't, today's due instance should appear now, the
    //    same immediate-spawn courtesy toggleRoutineActive gives
    //    reactivation. Both generators dedupe per day, so this is safe to
    //    call unconditionally.
    // ------------------------------------------------------------------
    function recallInstancesIfRoutineUnusable(destRoutineId, definitionId, type) {
        const dest = State.getDefinedRoutines().find(r => r.id === destRoutineId);
        if (!dest) return;
        const usable = type === 'habit'
            ? FrozenSlots.isRoutineUsableForHabit(dest, definitionId)
            : !FrozenSlots.isRoutineSuspended(dest);
        if (usable) return;
        Routines.selectActiveInstanceIdsForDefinition(State.getActiveItems(), definitionId, type)
            .forEach(id => removeItem(id));
    }

    function transferHabitBetweenRoutines(sourceRoutineId, destRoutineId, habitDefId) {
        const result = Routines.transferHabitBetweenRoutines(
            sourceRoutineId, destRoutineId, habitDefId, State.getDefinedRoutines(), State.getDefinedHabits());
        if (result.ok) {
            recallInstancesIfRoutineUnusable(destRoutineId, habitDefId, 'habit');
            generateDailyHabitInstances(State.getCurrentGameDate());
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
            saveGame();
        }
        return result;
    }

    function transferTaskBetweenRoutines(sourceRoutineId, destRoutineId, taskId) {
        const result = Routines.transferTaskBetweenRoutines(
            sourceRoutineId, destRoutineId, taskId, State.getDefinedRoutines());
        if (result.ok) {
            recallInstancesIfRoutineUnusable(destRoutineId, taskId, 'task');
            generateDailyRoutineTaskInstances(State.getCurrentGameDate());
            RoutineViews.renderDefinedRoutines(routineViewsDeps());
            saveGame();
        }
        return result;
    }

    // Thin wrappers — real implementations live in js/ui/routineViews.js
    // (Milestone 2 UI extraction sessions 8-9, 2026-07-18). Call sites
    // unchanged.
    //
    // definedRoutines/definedHabits cross in as GETTERS (reassigned
    // elsewhere in script.js — new-game reset, restoreGameState), matching
    // agendaList.js part 2's precedent (session 7). definedTasks has no
    // local declaration at all (always `window.definedTasks`), so the
    // module reads it as a bare global directly — no dep needed. activeItems
    // is a plain reference, matching agendaListDeps()'s established
    // precedent (see that function's comment above).
    // definedRoutinesListUL/activeRoutineCountDisplay/managementWindows are
    // stable const DOM refs.
    //
    // Session 9 moved cluster F's form half into the module — the six
    // formerly-passed function refs (showEditHabitForm,
    // populateHabitSelectDropdown, showCreateHabitForm, showEditTaskForm,
    // showCreateTaskForm, attachRoutineManagementListeners) are now
    // module-internal calls and no longer appear here. Added instead:
    // managementWindows/populateRoutinesWindow (routine-status-toggle
    // refresh), saveGame, createNewHabitInRoutine/createNewTaskInRoutine/
    // editHabitInRoutine/editTaskInRoutine (the four save* handlers),
    // activeItems/createListItem/sortAndRenderActiveList (saveEditedHabit's
    // live-instance sync).
    function routineViewsDeps() {
        return {
            definedRoutinesListUL, activeRoutineCountDisplay, managementWindows,
            definedRoutines: State.getDefinedRoutines,
            definedHabits: State.getDefinedHabits,
            toggleRoutineActive, deleteRoutine, removeHabitFromRoutine, removeTaskFromRoutine,
            addHabitToRoutine, populateRoutinesWindow, saveGame,
            // [P2-UI-013] session 62 — transfer wrappers (recall/spawn/save
            // reconciliation lives up in the wrappers, not the modal).
            transferHabitBetweenRoutines, transferTaskBetweenRoutines,
            createNewHabitInRoutine, createNewTaskInRoutine, editHabitInRoutine, editTaskInRoutine,
            activeItems: State.getActiveItems(), createListItem, sortAndRenderActiveList,
            // [P1-UI-006] sub-session 4, 2026-07-19 — star-rating window start
            // for the Manage modal's hero stats block (buildHeroStatsHtml).
            runStartedAtMs: State.getRunStartedAtMs()
        };
    }

    // (renderDefinedRoutines wrapper inlined at its call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/ui/routineViews.js.)
    // (populateHabitSelectDropdown wrapper was dead code — no call sites in
    // script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function addHabitToRoutine(routineId, habitDefId) {
        const result = Routines.addHabitToRoutine(routineId, habitDefId, State.getDefinedRoutines(), State.getDefinedHabits());
        if (!result.ok) {
            alert(result.reason === 'not-found' ? 'Error finding routine or habit.' : 'Habit already in routine.');
            return;
        }

        RoutineViews.renderDefinedRoutines(routineViewsDeps());
    }

    // selectActiveItemIdsToClearForRoutine/clearActiveInstancesForRoutine/
    // toggleRoutineActive now live in js/routines.js (Milestone 2 extraction
    // #6, 2026-07-18) — thin wrappers so every call site is unchanged. See
    // docs/ARCHITECTURE.md / DECISIONS.md.
    // (selectActiveItemIdsToClearForRoutine wrapper was dead code — no call
    // sites in script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function clearActiveInstancesForRoutine(routineId) {
        Routines.clearActiveInstancesForRoutine(routineId, { definedRoutines: State.getDefinedRoutines(), activeItems: State.getActiveItems(), removeItem });
    }

    function toggleRoutineActive(routineId) {
        Routines.toggleRoutineActive(routineId, {
            definedRoutines: State.getDefinedRoutines(),
            routineSlots: State.getRoutineSlots(),
            activeItems: State.getActiveItems(),
            removeItem,
            alert,
            generateDailyHabitInstances,
            generateDailyRoutineTaskInstances,
            currentGameDate: State.getCurrentGameDate(),
            saveGame
        });
    }
    
    // (showAddItemToRoutineModal wrapper was dead code — no call sites in
    // script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)
    function updateRoutineDisplay() {
        RoutineViews.updateRoutineDisplay(routineViewsDeps());
        // [P1-UI-006] sub-session 3, 2026-07-19 — paint hero chips immediately
        // whenever routine displays refresh (init/restore/level-up); the
        // per-tick call in updateGame() keeps them live the rest of the time.
        renderHeroesAtBase();
    }

    // Thin wrapper over js/ui/heroes.js — renders from state only, no new
    // mechanics. Called once per game-loop tick (see updateGame() below) so
    // hero chips reflect completion/damage/freeze/KO/deactivate within one
    // 50ms tick without threading a UI dependency through items.js/routines.js/
    // damage.js (see js/ui/heroes.js header for the full rationale).
    // routinesOverride (Milestone 4 time slider, 2026-07-20, optional):
    // lets js/ui/timeSliderView.js draw PROJECTED per-routine health during
    // a scrub by passing a shallow-cloned routines array with `health`
    // patched — HeroesView itself is unchanged, it just renders whatever
    // array it's given. Omitted (every existing call site) renders the real
    // live definedRoutines, unchanged behavior.
    function renderHeroesAtBase(routinesOverride) {
        HeroesView.renderHeroesAtBase({
            containerEl: heroBaseZoneEl,
            definedRoutines: routinesOverride || State.getDefinedRoutines(),
            definedHabits: State.getDefinedHabits(),
            config: CONFIG,
            runStartedAtMs: State.getRunStartedAtMs(),
            starMemory: heroStarMemory,
            onStarThresholdCrossed: (routine, stars) => {
                FrozenNotice.showHeroStarUpNotice(routine.name, stars);
            },
            // Sub-session 5: flinch/celebrate FX timestamps (see itemsDeps).
            fxMemory: heroFxMemory,
        });
    }

    // Thin wrappers — real implementations live in js/ui/routineViews.js
    // (Milestone 2 UI extraction session 9, 2026-07-18.)
    // showCreateHabitForm/showCreateTaskForm/showEditTaskForm wrappers were
    // dead code — no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. showEditHabitForm was inlined at its one
    // real call site (agendaListDeps(), passed through to js/ui/agendaList.js)
    // — same session.

    // Global functions for modal interactions — thin wrappers, real
    // implementations live in js/ui/routineViews.js (session 9, 2026-07-18).
    // Kept as window.* (not plain functions) because the create/edit form
    // HTML's inline onclick="saveNewHabit(...)" etc. needs the window-level
    // name, same reasoning as window.closeModal/window.deleteRoutine above.
    window.saveNewHabit = function(routineId) {
        RoutineViews.saveNewHabit(routineId, routineViewsDeps());
    };

    window.saveNewTask = function(routineId) {
        RoutineViews.saveNewTask(routineId, routineViewsDeps());
    };

    window.saveEditedHabit = function(habitId) {
        RoutineViews.saveEditedHabit(habitId, routineViewsDeps());
    };

    window.saveEditedTask = function(taskId) {
        RoutineViews.saveEditedTask(taskId, routineViewsDeps());
    };

    // Thin wrapper — real implementation lives in js/ui/modal.js
    // (Milestone 2 UI extraction session 1, 2026-07-18). Call site unchanged.
    window.closeModal = Modal.closeModal;
    // closeTopmost is for stacked-context Cancel buttons (e.g. the routine
    // addItemModal, which sits ON TOP of the routine management modal —
    // closeModal() there killed both). [P2-UI-011] Stage 1, session 61.
    window.closeTopmost = Modal.closeTopmost;

    // ESC / backdrop-click / Tab-trap / focus handling all live in
    // js/ui/modal.js now ([P2-UI-011] Stage 1, session 61) — wired below,
    // after managementWindows/closeFabMenu are defined (see
    // Modal.initDismissHandlers call near the event-listener block).

    // Floating Action Button and Window Management
    const fabButton = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');
    console.log('FAB Button found:', fabButton);
    console.log('FAB Menu found:', fabMenu);
    const managementWindows = {
        tasks: document.getElementById('tasksWindow'),
        habits: document.getElementById('habitsWindow'),
        routines: document.getElementById('routinesWindow'),
        shop: document.getElementById('shopWindow'),
        stats: document.getElementById('statsWindow'),
        settings: document.getElementById('settingsWindow')
    };
    
    // Thin wrappers — real implementations live in js/ui/fabMenu.js and
    // js/ui/managementWindows.js (Milestone 2 UI extraction session 3,
    // 2026-07-18). toggleFabMenu's 6 debug console.log lines were removed as
    // pure noise during the move — see fabMenu.js header.
    // (toggleFabMenu wrapper inlined at its one call site (fabButton's click
    // listener) sub-session 3, docs/STATE_OWNERSHIP_PLAN.md. closeFabMenu is
    // NOT inlined — one of its three call sites is a bare reference inside
    // openManagementWindow(), an explicitly-protected orchestrator; left
    // alone rather than partially retiring it, see report.)
    function closeFabMenu() {
        FabMenu.closeFabMenu({ fabMenu, fabButton });
    }

    function openManagementWindow(type) {
        ManagementWindows.openManagementWindow(type, {
            managementWindows, closeFabMenu, activeItems: State.getActiveItems(), definedHabits: State.getDefinedHabits(),
            definedRoutines: State.getDefinedRoutines(), routineSlots: State.getRoutineSlots(), showRoutineManagement, toggleRoutineActive,
            runStartedAtMs: State.getRunStartedAtMs(),
            shopCatalog: CONFIG.SHOP_ITEMS, playerInventory: State.getPlayerInventory(), playerPoints: State.getPlayerPoints(), baseHealth: State.getBaseHealth(),
            onShopBuy: handleShopPurchase, onShopUse: handleShopUse,
            currentRunStats: State.getCurrentRunStats(), runHistory: State.getRunHistory(), daysSurvivedSoFar: Damage.computeDaysSurvived(State.getRunStartedAtMs(), Date.now(), CONFIG.MS_PER_REAL_DAY),
            achievementsCatalog: CONFIG.ACHIEVEMENTS, lifetimeStats: State.getLifetimeStats(), achievements: State.getAchievements(),
            currentEffectsIntensity: effectsIntensity,
            onChangeEffectsIntensity: handleEffectsIntensityChange,
            // Export/Import (Milestone 5 first item, 2026-07-20) — see
            // js/exportImport.js header + handleConfirmImport below.
            buildExportEnvelope: () => ExportImport.buildEnvelope({
                getPersistableState: () => State.getPersistableState(),
                getSettings: () => Settings.load(),
            }),
            currentSummary: ExportImport.buildSummary(State.getPersistableState()),
            onConfirmImport: handleConfirmImport,
        });
    }

    // [Milestone 5, 2026-07-20] SettingsView's onConfirmImport — the one
    // truly stateful step of export/import (everything else in
    // js/exportImport.js/js/ui/settingsView.js is pure build/validate/DOM).
    // Full replace, no merge (Jeremy's call, see js/exportImport.js header):
    // back up whatever's currently on this device first (one-shot, not
    // rotated — a second import overwrites the previous backup, which is
    // fine for "oops, wrong file" recovery, not a version history), write
    // the imported save/settings RAW (NOT re-run through
    // Persistence.serialize, which would re-stamp the CURRENT schemaVersion
    // and defeat importing an older export through the normal migration
    // chain on load), then hard-reload so restoreGameState/migrate/offline
    // catch-up/achievements-sweep all run exactly as they do on any other
    // page load — no separate hot-swap code path to maintain or trust.
    function handleConfirmImport(envelope) {
        try {
            const currentSaveRaw = localStorage.getItem(Persistence.SAVE_KEY);
            const currentSettingsRaw = localStorage.getItem(Settings.SETTINGS_KEY);
            localStorage.setItem('deadline.backup.preImport', JSON.stringify({
                backedUpAt: new Date().toISOString(),
                save: currentSaveRaw,
                settings: currentSettingsRaw,
            }));
        } catch (e) {
            console.error('Deadline: pre-import backup failed (continuing with import anyway)', e);
        }

        // Found live in Chrome (2026-07-20): window.location.reload() is
        // ASYNC — JS keeps running for a few more ms, long enough for a
        // pending debounced Persistence.requestSave, the 5s
        // CONFIG.PERSISTENCE_AUTOSAVE_MS safety net, or the beforeunload/
        // visibilitychange flush hook to fire and re-serialize the LIVE
        // (pre-import) in-memory state right over our just-written import —
        // the save silently reverted to the old data every time. Same class
        // of hazard as the session-52 "stub flush/requestSave before a
        // direct localStorage edit" trick documented in CLAUDE.md; applying
        // it here too. Module state is thrown away by the reload regardless,
        // so neutering these is safe.
        Persistence.requestSave = function () {};
        Persistence.flush = function () {};

        localStorage.setItem(Persistence.SAVE_KEY, JSON.stringify(envelope.save));
        Settings.save(envelope.settings || Settings.DEFAULTS);
        window.location.reload();
    }

    // [P2-UI-009] session 59: SettingsView's onChangeIntensity callback —
    // persist (js/settings.js, separate key from the game save), apply to
    // the live DOM immediately, and update the in-memory var so the next
    // openManagementWindow('settings') re-render shows the right radio
    // checked without needing a page reload.
    function handleEffectsIntensityChange(intensity) {
        effectsIntensity = intensity;
        Settings.save({ effectsIntensity: intensity });
        Settings.applyEffectsIntensity(intensity);
    }

    // (closeAllManagementWindows wrapper inlined at its one call site
    // (Modal.initDismissHandlers) sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // (closeManagementWindow wrapper inlined at its call sites sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md — real implementation lives in
    // js/ui/managementWindows.js.)

    function populateTasksWindow() {
        ManagementWindows.populateTasksWindow({ activeItems: State.getActiveItems() });
    }

    function populateHabitsWindow() {
        ManagementWindows.populateHabitsWindow({ definedHabits: State.getDefinedHabits() });
    }

    function populateRoutinesWindow() {
        ManagementWindows.populateRoutinesWindow({
            definedRoutines: State.getDefinedRoutines(), definedHabits: State.getDefinedHabits(), routineSlots: State.getRoutineSlots(), showRoutineManagement, toggleRoutineActive,
            runStartedAtMs: State.getRunStartedAtMs()
        });
    }

    // Shop ([P1-UI-008] SHOP_PLAN.md session 2, 2026-07-18). populateShopWindow
    // mirrors the populateTasksWindow/populateHabitsWindow wrappers above, but
    // calls ShopView (a different module) directly rather than routing back
    // through ManagementWindows, since ShopView owns no per-type dispatch logic
    // of its own to reuse.
    function populateShopWindow() {
        ShopView.renderShopWindow({
            catalog: CONFIG.SHOP_ITEMS, inventory: State.getPlayerInventory(), playerPoints: State.getPlayerPoints(), baseHealth: State.getBaseHealth(),
            onBuy: handleShopPurchase, onUse: handleShopUse
        });
    }

    // Buy-one-unit handler wired to every catalog card's Buy button (session 2).
    // Shop.purchase is pure — this applies its result to state, persists, and
    // re-renders both the shop grid (new price/held count) and the points HUD.
    // Pushback targeting is session 4 — buying only fills playerInventory
    // today; repair-kit USE (below) closes the loop for repair kits.
    function handleShopPurchase(itemId) {
        const result = Shop.purchase(itemId, CONFIG.SHOP_ITEMS, State.getPlayerInventory(), State.getPlayerPoints());
        if (!result.ok) {
            // Buy button is disabled whenever unaffordable, so this is a
            // defensive no-op guard (e.g. a stale render) rather than the
            // expected path — still give feedback if it happens.
            ShopView.showShopMessage('Not enough points for that.');
            return;
        }

        State.setPlayerPoints(result.newPoints);
        State.setPlayerInventory(result.newInventory);
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
        saveGame();

        // Deferred, not synchronous: populateShopWindow() replaces
        // #shopWindowList's innerHTML, which DETACHES the very Buy button
        // that's still bubbling this click event up to document's "click
        // outside closes windows" listener (script.js, ~line 1086). That
        // listener does `e.target.closest('.management-window')` — on a
        // button already removed from the DOM this returns null, so it reads
        // as an outside click and closes the window immediately after every
        // purchase. Found live-testing this session (see DECISIONS.md).
        // setTimeout(0) lets the click finish bubbling before the rebuild.
        setTimeout(populateShopWindow, 0);
    }

    // Use-one-held-unit handler wired to each repair-kit card's Use button
    // (session 3, SHOP_PLAN.md, 2026-07-19; extended sub-session 5, 2026-07-19
    // to Sick Day — same card-Use shape, different category branch). Shop.consume
    // is pure — decrements the held count (never below zero); the actual effect
    // branches on category:
    //   - repair (healAmount): existing healBase(amount) wrapper (script.js,
    //     ~line 569 — built for base regen [P2-GAME-012]), which clamps at
    //     CONFIG.MAX_BASE_HEALTH, updates the health display/sprite, and
    //     calls saveGame() internally.
    //   - sickDay: handleUseSickDay() (global excuse-and-sweep, see its own
    //     comment) — no per-item effect payload, just the category check.
    // playerInventory is updated BEFORE calling either effect so its internal
    // save (repair) or the explicit saveGame() (sick day) already captures the
    // decremented count.
    function handleShopUse(itemId) {
        const item = Shop.getItem(itemId, CONFIG.SHOP_ITEMS);
        if (!item || !item.consumable) return;
        const isRepairKit = item.effect && typeof item.effect.healAmount === 'number';
        const isSickDay = item.category === 'sickDay';
        if (!isRepairKit && !isSickDay) return;

        const result = Shop.consume(itemId, State.getPlayerInventory());
        if (!result.ok) {
            // Use button is only rendered when held > 0, so this is a
            // defensive no-op guard rather than the expected path.
            ShopView.showShopMessage("You don't have one of those to use.");
            return;
        }

        State.setPlayerInventory(result.newInventory);
        if (isRepairKit) {
            Damage.healBase(item.effect.healAmount, damageDeps());
        } else {
            handleUseSickDay();
        }

        // Same event-bubbling hazard as handleShopPurchase (see its comment
        // above, and SHOP_PLAN.md's hazards list) — defer the rebuild so the
        // click finishes bubbling with its target still attached.
        setTimeout(populateShopWindow, 0);
    }

    // Pushback handler wired to each enemy popup's tier buttons (session 4,
    // SHOP_PLAN.md). Called with the shop item id + the TARGET enemy the popup
    // is about. Pays via Shop.purchase (pushback is non-consumable, so
    // inventory is returned unchanged — it just does the affordability check +
    // point math in one place), then shifts the target's due date later by the
    // tier's amount (pure Shop.pushedBackDueDate), re-derives overdue state
    // (un-camps + repositions the zombie if it crossed into the future), and
    // re-renders the agenda row. Pricing is flat this session (Jeremy's call
    // 2026-07-19) — no per-run inflation; that's a session-5 balance decision.
    // Returns { ok } so the popup can refresh its UI in place. Stacking is
    // allowed (ECONOMY.md) — repeated calls just push the same item further.
    function handlePushback(itemId, targetItem) {
        const item = Shop.getItem(itemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'pushback' || !item.effect || typeof item.effect.pushbackMs !== 'number') {
            return { ok: false };
        }
        if (!targetItem) return { ok: false };

        const result = Shop.purchase(itemId, CONFIG.SHOP_ITEMS, State.getPlayerInventory(), State.getPlayerPoints());
        if (!result.ok) {
            // Tier buttons are disabled when unaffordable, so this is a
            // defensive guard rather than the expected path.
            return { ok: false };
        }

        State.setPlayerPoints(result.newPoints);
        targetItem.dueDateTime = Shop.pushedBackDueDate(targetItem.dueDateTime, item.effect.pushbackMs);

        // Dependent due dates ([P1-DATA-004] sub-session 2): a SUB-TASK can't
        // be pushed past its parent's deadline — the pushed date clamps to the
        // parent's (pure Items.clampedSubTaskDueDate). Pushing a PARENT later
        // never touches its children (they're then "earlier", which is legal).
        if (targetItem.parentId) {
            const pushParent = State.getActiveItems().find(i => i.id === targetItem.parentId && i.type === 'task');
            if (pushParent) {
                targetItem.dueDateTime = Items.clampedSubTaskDueDate(targetItem.dueDateTime, pushParent);
            }
        }

        // Re-derive overdue state from the NEW due date — same reasoning as the
        // Edit Task save path (js/ui/popups.js showEditTaskModal): without this
        // a pushed-back overdue zombie stays camped at the base ticking damage.
        // A non-overdue item pushed further out just gets repositioned by the
        // next 50ms game-loop tick (Loop.updateActiveItems).
        Items.recomputeOverdueStateAfterEdit(targetItem, itemsDeps());

        // Refresh the target's agenda row (its due time changed) + re-sort.
        if (targetItem.listItemElement) {
            targetItem.listItemElement.remove();
            if (!targetItem.parentId) createListItem(targetItem);
        }
        sortAndRenderActiveList();
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
        saveGame();

        return { ok: true, newPoints: State.getPlayerPoints() };
    }

    // Cheat Day targeting handler ([P1-DATA-005] sub-session 5, 2026-07-19),
    // wired to a negative-habit lurker popup's "Use Cheat Day" button
    // (js/ui/popups.js). Mirrors handlePushback's shape (called with the shop
    // item id + the TARGET instance), but Cheat Day is a HELD consumable —
    // the button only renders once you already hold one, so this goes
    // through Shop.consume (decrement), not Shop.purchase (buy). Sets the
    // target habit definition's `cheatDayDate` to the lurker's occurrence
    // date (Habits.toOccurrenceDate) — items.js's indulgeHabit/
    // resolvePendingCheckIn check this to excuse that day's indulgence for
    // free (no debit, no occurrence, streak untouched — session 26, Fable).
    // Returns { ok } so the popup can rebuild itself (deferred via
    // setTimeout(0) — see popups.js's comment on why in-place isn't safe here).
    function handleUseCheatDay(cheatDayItemId, targetItem) {
        const item = Shop.getItem(cheatDayItemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'cheatDay') return { ok: false };
        if (!targetItem || targetItem.type !== 'habit' || !targetItem.isNegative) return { ok: false };

        const habitDef = State.getDefinedHabits().find(def => def.id === targetItem.definitionId);
        if (!habitDef) return { ok: false };

        const result = Shop.consume(cheatDayItemId, State.getPlayerInventory());
        if (!result.ok) {
            // Button is only rendered when held > 0, so this is a defensive
            // guard rather than the expected path.
            return { ok: false };
        }

        State.setPlayerInventory(result.newInventory);
        habitDef.cheatDayDate = Habits.toOccurrenceDate(targetItem.originalDueDate);

        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
        saveGame();

        return { ok: true };
    }

    // Skip Day targeting handler (frozen-slots sub-session 5, 2026-07-19),
    // wired to ANY habit instance's popup "Use Skip Day" button (js/ui/
    // popups.js) — not restricted to negative lurkers, unlike Cheat Day.
    // Same held-consumable shape as handleUseCheatDay (Shop.consume, not
    // Shop.purchase), but the actual excuse-and-remove logic lives in
    // Items.useSkipDayOnItem ("clear immediately" model, Jeremy's call,
    // 2026-07-19) since — unlike Cheat Day — there's no later indulge/
    // complete/rollover branch to also wire; the instance is gone the
    // moment the token lands.
    function handleUseSkipDay(skipDayItemId, targetItem) {
        const item = Shop.getItem(skipDayItemId, CONFIG.SHOP_ITEMS);
        if (!item || item.category !== 'skipDay') return { ok: false };
        if (!targetItem || targetItem.type !== 'habit') return { ok: false };

        const result = Shop.consume(skipDayItemId, State.getPlayerInventory());
        if (!result.ok) {
            // Button is only rendered when held > 0, so this is a defensive
            // guard rather than the expected path.
            return { ok: false };
        }

        State.setPlayerInventory(result.newInventory);
        Items.useSkipDayOnItem(targetItem, itemsDeps());

        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
        saveGame();

        return { ok: true };
    }

    // Sick Day GLOBAL apply handler (frozen-slots sub-session 5, 2026-07-19),
    // wired to the Sick Day shop card's own "Use" button (js/ui/shopView.js's
    // handleShopUse sick-day branch) — untargeted, unlike Cheat/Skip Day.
    // Sets the global sickDayDate marker + sweeps every currently active
    // habit instance for today off the board (Items.useSickDayGlobally,
    // "clear immediately" model). Routine tasks are untouched (fork 4,
    // docs/FROZEN_SLOTS_PLAN.md — Sick Day is habits-only).
    function handleUseSickDay() {
        Items.useSickDayGlobally(State.getCurrentGameDate(), itemsDeps());
        Hud.updatePlayerDisplays({ playerXP: State.getPlayerXP(), playerLevel: State.getPlayerLevel(), playerPoints: State.getPlayerPoints(), routineSlots: State.getRoutineSlots(), pointsPerTask: POINTS_PER_TASK, playerXpDisplay, playerLevelDisplay, playerPointsDisplay, totalRoutineSlotsDisplay, playerPointsStat, playerPointsNudge });
        saveGame();
    }

    function showRoutineManagement(routineId) {
        RoutineViews.showRoutineManagement(routineId, routineViewsDeps());
    }

    // (populateRoutineHabits/populateRoutineTasks wrappers were dead code —
    // no call sites in script.js, js/ui/routineViews.js does this
    // internally now — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.)

    // Thin wrappers — real implementations live in js/ui/forms.js
    // (Milestone 2 UI extraction session 4, 2026-07-18). Call sites
    // unchanged. The routine-creation branch was reconciled to call
    // Routines.createRoutineDefinition (adds a previously-missing
    // saveGame() call) — see js/ui/forms.js header and DECISIONS.md.
    function formsDeps() {
        return {
            createTaskItemData: (name, category, isHighPriority, dueDateStr, dueTimeStr, parentId) => Items.createTaskItemData(name, category, isHighPriority, dueDateStr, dueTimeStr, parentId, itemsDeps()),
            addItemToGame: (itemData) => Spawning.addItemToGame(itemData, { gameCanvas, activeItems: State.getActiveItems(), baseWidth: BASE_WIDTH, dims: { enemyWidth: ENEMY_WIDTH, habitEnemyWidth: HABIT_ENEMY_WIDTH, subtaskEnemyWidth: CONFIG.SUBTASK_ENEMY_WIDTH, habitStreakBonusThreshold: HABIT_STREAK_BONUS_THRESHOLD, habitStreakStrongThreshold: HABIT_STREAK_STRONG_THRESHOLD }, getItemTopPosition, getSubTaskClusterOffset, handleEnemyClick: (itemId) => Popups.handleEnemyClick(itemId, popupsDeps()), createListItem: (itemData) => AgendaList.createListItem(itemData, agendaListDeps()), markAsOverdue: (item, currentTime) => Items.markAsOverdue(item, currentTime, itemsDeps()), updateTaskCountDisplay: () => Hud.updateTaskCountDisplay({ activeItems: State.getActiveItems(), taskCountDisplay }), sortAndRenderActiveList: () => AgendaList.sortAndRenderActiveList(agendaListDeps()), saveGame, isGameOver: State.isGameOver }),
            sortAndRenderActiveList,
            managementWindows, populateTasksWindow,
            createHabitDefinition, populateHabitsWindow,
            definedRoutines: State.getDefinedRoutines(), saveGame, populateRoutinesWindow, openManagementWindow
        };
    }

    // Note: createTaskFormHtml/createHabitFormHtml/createRoutineFormHtml had
    // no callers outside showFormModal's old switch statement (verified by
    // Grep before removing them here) — Forms.showFormModal now calls its
    // own module-scoped copies internally, so no script.js wrapper is
    // needed for them. (attachModalEventListeners wrapper was dead code —
    // no call sites in script.js — deleted sub-session 3,
    // docs/STATE_OWNERSHIP_PLAN.md. showFormModal was inlined at its three
    // call sites below — same session.)

    // Forms are now handled through dedicated modal functions above
    
    // Event Listeners
    if (fabButton) {
        fabButton.addEventListener('click', () => FabMenu.toggleFabMenu({ fabMenu, fabButton }));
    } else {
        console.error('FAB button not found — creation UI unavailable');
    }
    
    // FAB menu item listeners
    document.querySelectorAll('.fab-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.type;
            openManagementWindow(type);
        });
    });
    
    // Close window listeners
    document.querySelectorAll('.close-window').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const windowId = e.target.dataset.window;
            ManagementWindows.closeManagementWindow(windowId, { managementWindows });
        });
    });
    
    // Unified dismiss + focus behavior ([P2-UI-011] Stage 1, session 61):
    // ESC (topmost overlay first, then windows/FAB), backdrop click
    // (clicked overlay only), Tab trap, focus return, role/aria on open —
    // all centralized in js/ui/modal.js. Replaces the previous inline ESC
    // keydown + click-outside handlers here and the per-popup backdrop
    // listeners in popups.js.
    Modal.initDismissHandlers({
        closeAllManagementWindows: () => ManagementWindows.closeAllManagementWindows({ managementWindows }),
        closeFabMenu,
        isAnyManagementWindowOpen: () => Object.values(managementWindows).some(w =>
            w && !w.classList.contains('hidden')
        ),
    });
    Modal.initFocusManagement();
    
    // Add new item button listeners
    const addNewTaskButton = document.getElementById('addNewTaskButton');
    const addNewHabitButton = document.getElementById('addNewHabitButton');
    const addNewRoutineButton = document.getElementById('addNewRoutineButton');
    
    if (addNewTaskButton) {
        addNewTaskButton.addEventListener('click', () => {
            ManagementWindows.closeManagementWindow('tasksWindow', { managementWindows });
            Forms.showFormModal('task', formsDeps());
        });
    }
    
    if (addNewHabitButton) {
        addNewHabitButton.addEventListener('click', () => {
            ManagementWindows.closeManagementWindow('habitsWindow', { managementWindows });
            Forms.showFormModal('habit', formsDeps());
        });
    }
    
    if (addNewRoutineButton) {
        addNewRoutineButton.addEventListener('click', () => {
            ManagementWindows.closeManagementWindow('routinesWindow', { managementWindows });
            Forms.showFormModal('routine', formsDeps());
        });
    }
    
    // Close FAB menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fab-container')) {
            closeFabMenu();
        }
    });

    if (createRoutineButton) {
        createRoutineButton.addEventListener('click', createRoutineDefinition);
    }

    if (attackButton) {
        attackButton.addEventListener('click', () => {
            attackMode = !attackMode;
            attackButton.classList.toggle('active', attackMode);
            gameCanvas.style.cursor = attackMode ? 'crosshair' : 'default';
        });
    }

    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // A restart abandons the dead run — clear its save so a reload
            // before the first new mutation doesn't resurrect it.
            if (typeof Persistence !== 'undefined') Persistence.clear();
            initGame();
            saveGame();
        });
    }

    // Dev/testing only: full reset to a fresh, empty game. Unlike the restart
    // button (which keeps habit/routine DEFINITIONS and re-seeds today's habit
    // instances via initGame), this also wipes definedHabits/definedRoutines so
    // the next generateDailyHabitInstances() has nothing to re-create. Clears
    // the save and persists the empty state, so no reload or flush-guard needed.
    const resetTestButton = document.getElementById('resetTestButton');
    if (resetTestButton) {
        resetTestButton.addEventListener('click', () => {
            if (!confirm('Reset the game to a fresh state? This clears all tasks, habits, routines, and progress.')) return;
            State.setDefinedHabits([]);
            State.setDefinedRoutines([]);
            window.definedTasks = [];
            // Dev reset wipes run history too — unlike the restart button,
            // which deliberately preserves it (session 52, RUN_HISTORY_PLAN:
            // dev-reset runs are abandoned AND a dev wipe means everything).
            State.setRunHistory([]);
            // Same reasoning extends to achievements (session 64,
            // ACHIEVEMENTS_PLAN.md): lifetime data, wiped only here.
            State.setLifetimeStats(Achievements.freshLifetimeStats());
            State.setAchievements(Achievements.freshUnlocked());
            if (typeof Persistence !== 'undefined') Persistence.clear();
            initGame();
            saveGame();
        });
    }

    // Initialize definedTasks array
    if (!window.definedTasks) window.definedTasks = [];
    
    // (showDebugInfo wrapper was dead code — unreferenced anywhere in
    // script.js — deleted sub-session 3, docs/STATE_OWNERSHIP_PLAN.md.
    // Hud.showDebugInfo itself is untouched, still exported for future use.)

    // Initialize the game
    initGame();
    State.restoreGameState(stateDeps());
    // Time slider (Milestone 4, 2026-07-20) — after initGame() so
    // GAME_SCREEN_WIDTH/BASE_WIDTH/HABIT_ENEMY_WIDTH are resolved (deps.dims()
    // is still a live function, so a later resize is fine too; this ordering
    // only matters for the initial syncHandle() call inside init()).
    TimeSliderView.init(timeSliderDeps());
    // Day pager (Week scope sub-session 2, 2026-07-20) — after
    // restoreGameState() so getCurrentGameDate()/getDefinedHabits() etc.
    // read POST-restore state on their first render, not fresh-boot
    // defaults (mirrors TimeSliderView.init's own ordering note above).
    DayPagerView.init(dayPagerViewDeps());
    // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): if the
    // rollover just ran (above) and left any negative-habit pendingCheckIn
    // markers, prompt for them now.
    showCheckInIfPending();

    // Flush any pending debounced save when the page hides or closes.
    // visibilitychange covers mobile Chrome, where beforeunload is unreliable.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && typeof Persistence !== 'undefined') {
            Persistence.flush();
        }
    });
    window.addEventListener('beforeunload', () => {
        if (typeof Persistence !== 'undefined') Persistence.flush();
    });
});
