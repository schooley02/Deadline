/**
 * State — game lifecycle + persistence orchestration (Milestone 2 extraction,
 * session 11, 2026-07-18; ownership moved in Sub-session 1 of
 * docs/STATE_OWNERSHIP_PLAN.md, 2026-07-20).
 *
 * Extracted (session 11): `initGame`, `restoreGameState`, `getPersistableState`,
 * `saveGame`, `buildDamageDeps` (the function script.js's `damageDeps()`
 * wrapper now delegates to).
 *
 * ARCHITECTURE NOTE: session 11 deliberately deferred moving ownership of the
 * state itself — `baseHealth`, `playerXP`, `activeItems`, and 18 other
 * fields stayed `let`s in script.js, reached here only through a `deps`
 * object. Sub-session 1 (2026-07-20) closes that gap: this module now OWNS
 * those 21 fields as its own module-scoped `let`s, with exported accessor
 * pairs (`State.getPlayerXP`/`State.setPlayerXP`, etc. — see the bottom of
 * the IIFE for the full list). initGame/getPersistableState/buildDamageDeps/
 * restoreGameState/sanitizeOrphanedSubTasks read/write those fields directly
 * now instead of going through `deps.getX()`/`deps.setX()`. performDayRollover/
 * checkLiveDayRollover deliberately still take getCurrentGameDate/
 * setCurrentGameDate/getActiveItems/isGameOver through `deps` — production
 * callers pass State.* there too (via script.js's stateDeps()), so behavior
 * is unchanged, but this keeps them independently testable with a synthetic
 * deps object (see test/state-day-rollover.test.js).
 *
 * External contract UNCHANGED: js/damage.js, js/items.js, js/loop.js, and
 * every js/ui/*.js module still only ever receive accessor FUNCTIONS via
 * deps objects built in script.js — never a raw binding — so none of them
 * needed to change for this move. `deps` (still passed into every function
 * below) now carries DOM elements, collaborator functions, and the handful
 * of script.js-owned non-game-state fields (GAME_SCREEN_WIDTH/BASE_WIDTH/
 * ENEMY_WIDTH/HABIT_ENEMY_WIDTH, gameLoopInterval, attackMode,
 * offlineCatchUpActive) — see docs/STATE_OWNERSHIP_PLAN.md fork 3 for why
 * those stayed put. CONFIG stays a bare global here, matching every prior
 * module.
 */
const State = (() => {

    // --- Owned state (Sub-session 1 of docs/STATE_OWNERSHIP_PLAN.md,
    // 2026-07-20) ---
    // These 21 `let`s used to live in script.js's DOMContentLoaded closure,
    // reached here only through a `deps` object built by script.js's
    // stateDeps() (and 12 other deps builders). Ownership has now moved
    // HERE — state.js's own functions read/write them directly; every
    // OTHER module (js/damage.js, js/items.js, js/loop.js, js/ui/*.js)
    // still only ever receives accessor FUNCTIONS via deps objects built in
    // script.js, so nothing outside script.js/state.js changes. See
    // docs/STATE_OWNERSHIP_PLAN.md fork 1.
    //
    // NOT migrated (see plan fork 3 — UI/wiring-local, not game state):
    // GAME_SCREEN_WIDTH/BASE_WIDTH/ENEMY_WIDTH/HABIT_ENEMY_WIDTH,
    // gameLoopInterval, attackMode, offlineCatchUpActive, timePreviewActive,
    // heroStarMemory, heroFxMemory, lastAutosaveMs, effectsIntensity — those
    // stay script.js `let`s, reached the same accessor way they are today.
    //
    // RunStats.freshRunStats()/Achievements.freshLifetimeStats()/
    // freshUnlocked() are guarded (typeof check) rather than called bare at
    // module-load time: some Jest suites (test/state-day-rollover.test.js,
    // test/subtask-lifecycle.test.js) `require` this file without first
    // defining those globals, and a real boot always calls initGame() before
    // anything reads these fields anyway (matching script.js's original
    // load-time behavior, since its DOMContentLoaded closure only ran after
    // every <script> tag — including runStats.js/achievements.js — had
    // already executed).
    let baseHealth, playerXP, playerLevel, playerPoints, routineSlots;
    let playerInventory = {};
    let sickDayDate = null;
    let currentRunStats = (typeof RunStats !== 'undefined') ? RunStats.freshRunStats() : {};
    let runHistory = [];
    let lifetimeStats = (typeof Achievements !== 'undefined') ? Achievements.freshLifetimeStats() : {};
    let achievements = (typeof Achievements !== 'undefined') ? Achievements.freshUnlocked() : {};
    let activeItems = [];
    let completedItems = [];
    let definedHabits = [];
    let definedRoutines = [];
    let itemIdCounter, gameIsOver, daysSurvived, currentGameDate;
    let runStartedAtMs = null;
    let lastLoopTickMs = null;
    let lastRegenTickMs = null;

    const getBaseHealth = () => baseHealth;
    const setBaseHealth = (n) => { baseHealth = n; };
    const getPlayerXP = () => playerXP;
    const setPlayerXP = (n) => { playerXP = n; };
    const getPlayerLevel = () => playerLevel;
    const setPlayerLevel = (n) => { playerLevel = n; };
    const getPlayerPoints = () => playerPoints;
    const setPlayerPoints = (n) => { playerPoints = n; };
    const getRoutineSlots = () => routineSlots;
    const setRoutineSlots = (n) => { routineSlots = n; };
    const getPlayerInventory = () => playerInventory;
    const setPlayerInventory = (obj) => { playerInventory = obj; };
    const getSickDayDate = () => sickDayDate;
    const setSickDayDate = (d) => { sickDayDate = d; };
    const getCurrentRunStats = () => currentRunStats;
    const setCurrentRunStats = (obj) => { currentRunStats = obj; };
    const getRunHistory = () => runHistory;
    const setRunHistory = (arr) => { runHistory = arr; };
    const getLifetimeStats = () => lifetimeStats;
    const setLifetimeStats = (obj) => { lifetimeStats = obj; };
    const getAchievements = () => achievements;
    const setAchievements = (obj) => { achievements = obj; };
    const getActiveItems = () => activeItems;
    const setActiveItems = (arr) => { activeItems = arr; };
    const getCompletedItems = () => completedItems;
    const setCompletedItems = (arr) => { completedItems = arr; };
    const getDefinedHabits = () => definedHabits;
    const setDefinedHabits = (arr) => { definedHabits = arr; };
    const getDefinedRoutines = () => definedRoutines;
    const setDefinedRoutines = (arr) => { definedRoutines = arr; };
    const getItemIdCounter = () => itemIdCounter;
    const setItemIdCounter = (n) => { itemIdCounter = n; };
    const isGameOver = () => gameIsOver;
    const setGameIsOver = (v) => { gameIsOver = v; };
    const setGameOver = () => { gameIsOver = true; };
    const getDaysSurvived = () => daysSurvived;
    const setDaysSurvived = (n) => { daysSurvived = n; };
    const getCurrentGameDate = () => currentGameDate;
    const setCurrentGameDate = (d) => { currentGameDate = d; };
    const getRunStartedAtMs = () => runStartedAtMs;
    const setRunStartedAtMs = (n) => { runStartedAtMs = n; };
    const getLastLoopTickMs = () => lastLoopTickMs;
    const setLastLoopTickMs = (n) => { lastLoopTickMs = n; };
    const getLastRegenTickMs = () => lastRegenTickMs;
    const setLastRegenTickMs = (n) => { lastRegenTickMs = n; };

    function initGame(deps) {
        // Calculate dimensions
        deps.setGameScreenWidth(deps.gameCanvas.offsetWidth);
        deps.setBaseWidth(deps.baseElement.offsetWidth);
        deps.setEnemyWidth(CONFIG.ENEMY_WIDTH);
        deps.setHabitEnemyWidth(CONFIG.HABIT_ENEMY_WIDTH);

        // Initialize player stats
        setPlayerXP(0);
        setPlayerLevel(1);
        setPlayerPoints(0);
        setPlayerInventory({}); // shop inventory — fresh run starts empty
        setSickDayDate(null); // frozen-slots sub-session 5 — fresh run has no active Sick Day
        // Run stats reset with the run; runHistory is deliberately NOT
        // touched here — it must survive restart (session 52, RUN_HISTORY_PLAN).
        setCurrentRunStats(RunStats.freshRunStats());
        // lifetimeStats/achievements are likewise deliberately NOT touched
        // here — lifetime data, must survive restart (session 64,
        // ACHIEVEMENTS_PLAN.md; same reasoning as runHistory above).
        setRoutineSlots(CONFIG.ROUTINE_SLOTS_PER_LEVEL[1] || 1);

        deps.updatePlayerDisplays();

        // Initialize base
        setBaseHealth(CONFIG.MAX_BASE_HEALTH);
        deps.baseHealthDisplay.textContent = CONFIG.MAX_BASE_HEALTH;
        deps.baseElement.style.backgroundImage = "url('base_100.png')";
        deps.baseElement.classList.remove('base-hit-flash');

        // Reset UI state
        if (deps.gameOverMessage) deps.gameOverMessage.classList.add('hidden');
        if (deps.levelUpMessage) deps.levelUpMessage.classList.add('hidden');
        if (deps.restartButton) deps.restartButton.classList.add('hidden');

        // Clear active items
        getActiveItems().forEach(item => {
            if (item.element) item.element.remove();
            if (item.listItemElement) item.listItemElement.remove();
        });
        setActiveItems([]);
        setCompletedItems([]);
        if (deps.activeItemsListUL) deps.activeItemsListUL.innerHTML = '';

        // Hide completed tasks section at game start
        const completedTasksSection = document.getElementById('completedTasksSection');
        if (completedTasksSection) completedTasksSection.classList.add('hidden');

        // Reset game state
        setItemIdCounter(1); // never 0 — many parentId checks use truthy tests (`if (item.parentId)`), and 0 is falsy
        setGameIsOver(false);
        setDaysSurvived(0);
        setRunStartedAtMs(Date.now());
        setLastLoopTickMs(null); // first tick after init establishes the baseline
        deps.setAttackMode(false);
        if (deps.attackButton) deps.attackButton.classList.remove('active');

        // Initialize game date
        const newGameDate = new Date();
        newGameDate.setHours(0, 0, 0, 0);
        setCurrentGameDate(newGameDate);

        deps.generateDailyHabitInstances(newGameDate);
        deps.generateDailyRoutineTaskInstances(newGameDate);
        deps.updateTaskCountDisplay();
        deps.updateRoutineDisplay();

        // Start game loop
        if (deps.getGameLoopInterval()) clearInterval(deps.getGameLoopInterval());
        deps.setGameLoopInterval(setInterval(deps.updateGame, CONFIG.GAME_TICK_MS));

        // No day timer: daysSurvived is derived from real elapsed time via
        // computeDaysSurvived(), so it stays correct across sleep/suspension
        // (a timer only advances while the tab is awake). See DECISIONS.md.
    }

    // --- Persistence (js/persistence.js) ---
    // schemaVersion 1 persists the CURRENT in-memory shapes as-is; see
    // docs/DATA_SCHEMA.md + DECISIONS.md (2026-07-17). Call saveGame() after
    // every state mutation — Persistence debounces the actual write.

    function getPersistableState(deps) {
        return {
            baseHealth: getBaseHealth(),
            playerXP: getPlayerXP(),
            playerLevel: getPlayerLevel(),
            playerPoints: getPlayerPoints(),
            inventory: getPlayerInventory(),
            sickDayDate: getSickDayDate(),
            runHistory: getRunHistory(),
            currentRunStats: getCurrentRunStats(),
            lifetimeStats: getLifetimeStats(),
            achievements: getAchievements(),
            routineSlots: getRoutineSlots(),
            itemIdCounter: getItemIdCounter(),
            gameIsOver: isGameOver(),
            daysSurvived: getDaysSurvived(),
            runStartedAtMs: getRunStartedAtMs(),
            currentGameDate: getCurrentGameDate(),
            activeItems: getActiveItems(),
            completedItems: getCompletedItems(),
            definedHabits: getDefinedHabits(),
            definedRoutines: getDefinedRoutines(),
            // Routine TASK definitions. Previously omitted while
            // routine.taskDefinitionIds WAS saved, so a refresh left those ids
            // dangling against nothing. Additive — no schemaVersion bump needed;
            // older saves simply restore an empty array. See DECISIONS.md.
            definedTasks: window.definedTasks || []
        };
    }

    function saveGame(deps) {
        if (typeof Persistence !== 'undefined') {
            Persistence.requestSave(() => getPersistableState(deps));
        }
    }

    // --- Damage / base health deps (js/damage.js) ---
    // Milestone 2 extraction #3 (2026-07-18) established this shape in
    // script.js's damageDeps(); moved here session 11 since it's part of the
    // same state-orchestration surface. js/damage.js is the only OTHER module
    // that writes script.js-owned state (baseHealth, gameIsOver), so it gets
    // accessor deps rather than raw values — see that module's header for why
    // ownership didn't move. Rebuilt per call because BASE_WIDTH and the DOM
    // handles aren't resolved until initGame() runs.
    function buildDamageDeps(deps) {
        return {
            getBaseHealth,
            setBaseHealth,
            isGameOver,
            setGameOver,
            getActiveItems,
            getRunStartedAtMs,
            setDaysSurvived,
            setOfflineCatchUpActive: deps.setOfflineCatchUpActive,
            getGameLoopInterval: deps.getGameLoopInterval,
            baseWidth: deps.baseWidth,
            // [P1-DATA-005] session 29 — the negative-habit lurker's fixed x
            // anchors to the far right of the canvas, not the base.
            gameScreenWidth: deps.gameScreenWidth,
            baseElement: deps.baseElement,
            baseHealthDisplay: deps.baseHealthDisplay,
            gameOverMessage: deps.gameOverMessage,
            restartButton: deps.restartButton,
            markAsOverdue: deps.markAsOverdue,
            getSubTaskClusterOffset: deps.getSubTaskClusterOffset,
            calculateTimelineXWithClustering: deps.calculateTimelineXWithClustering,
            enableFormControls: deps.enableFormControls,
            saveGame: deps.saveGame,
            // [P1-DATA-005] session 27 — negative-habit lurkers are excluded
            // from both catch-up paths' damage/positioning; see damage.js's
            // header comment.
            isNonThreatening: deps.isNonThreatening,
            // [P1-UI-006] sub-session 2, 2026-07-19 — routine health damage/KO
            // for both catch-up paths (they share js/damage.js's applyOfflineDamage).
            damageRoutineForItem: deps.damageRoutineForItem,
            // Run-history sub-session 2, 2026-07-19 session 53 — blame
            // attribution for both catch-up paths (same sharing as above).
            recordRunDamage: deps.recordRunDamage,
            // Run-history sub-session 2 — gameOver's finalize step.
            getCurrentRunStats,
            getRunHistory,
            setRunHistory,
            getDefinedRoutines,
            getDefinedHabits,
            heroesCompletionRate: deps.heroesCompletionRate,
            heroesStarRating: deps.heroesStarRating,
            // Game-over review card (Run history sub-session 4, session 55) —
            // GameOverView.renderReviewCard, pre-bound in script.js since
            // js/ui/*.js loads after js/damage.js.
            renderGameOverReview: deps.renderGameOverReview,
            // Sub-session 4, session 55 — read back on gameOver(deps, true)
            // (restoring an already-dead save) instead of recomputing a
            // drifted day count. See js/damage.js's gameOver() header.
            getDaysSurvived,
            // Regen clock passthrough ([P2-GAME-012], 2026-07-18) — lets
            // runOfflineCatchUp/runLiveGapCatchUp apply offline/suspended-gap
            // regen and reset the live loop's regen clock afterward.
            getLastRegenTickMs,
            setLastRegenTickMs,
        };
    }

    // Runs ONCE on boot, right after initGame() has reset to a fresh state.
    // Returns true if a save was restored.
    /**
     * [P1-DATA-004] sub-session 1 (2026-07-19): heals a save where a task's
     * `parentId` doesn't resolve to a live parent task in `activeItems`
     * (parent deleted before items.js's deletion cascade existed, or any
     * other stale-parentId edge case). MECHANICS.md's nested-only agenda
     * rendering means such an item would otherwise be invisible forever —
     * reachable only by clicking its battlefield sprite — while still
     * counting toward base damage (the "orphan hole," see
     * SUBTASKS_PLAN.md/DECISIONS.md session 46). Promotes it to standalone
     * (`parentId = null`) so it regains a normal agenda row. Pure (mutates
     * only the items it's given, no DOM/deps reads), idempotent (a second
     * pass over already-promoted items is a no-op — they have no parentId
     * left to fail resolution), no schema change (parentId already exists
     * on every task). Returns the promoted items so the caller can build
     * their list items — `Spawning.addItemToGame` skipped `createListItem`
     * for them while `parentId` was still set (it only builds a row for
     * top-level items).
     */
    function sanitizeOrphanedSubTasks(activeItems) {
        const promoted = [];
        activeItems.forEach(item => {
            if (item.parentId) {
                const parent = activeItems.find(p => p.id === item.parentId && p.type === 'task');
                if (!parent) {
                    item.parentId = null;
                    promoted.push(item);
                }
            }
        });
        return promoted;
    }

    function restoreGameState(deps) {
        if (typeof Persistence === 'undefined') return false;
        const save = Persistence.load();
        if (!save) return false;

        // Offline window: elapsed time since the save was written, capped at
        // the spec's 3-day max offline progression (CONFIG.OFFLINE_MAX_MS).
        const restoreNowMs = Date.now();
        const savedAtMs = (save.savedAt instanceof Date) ? save.savedAt.getTime() : null;
        const offlineMs = (savedAtMs !== null)
            ? Math.min(Math.max(0, restoreNowMs - savedAtMs), CONFIG.OFFLINE_MAX_MS)
            : 0;
        const restoredEntries = []; // { item, savedX } for the catch-up animation

        // Scalars (initGame just set the fresh-game defaults; overwrite them)
        const restoredLevel = save.playerLevel || 1;
        setPlayerXP(save.playerXP || 0);
        setPlayerLevel(restoredLevel);
        setPlayerPoints(save.playerPoints || 0);
        // Shop inventory. The v3→v4 migration seeds {} on older saves, but guard
        // here too (non-object / absent) so a malformed save can never crash boot.
        setPlayerInventory((save.inventory && typeof save.inventory === 'object') ? save.inventory : {});
        // Sick Day (frozen-slots sub-session 5, 2026-07-19). The v6→v7
        // migration seeds null on older saves, but guard here too (any
        // non-string, e.g. malformed data) so a bad save can never crash boot.
        setSickDayDate((typeof save.sickDayDate === 'string') ? save.sickDayDate : null);
        // Run history (session 52, docs/RUN_HISTORY_PLAN.md). The v9→v10
        // migration seeds both, but guard here too so a malformed save can
        // never crash boot. currentRunStats keeps accruing across a mid-run
        // reload; runHistory survives everything (including restart — see
        // the restart button in script.js).
        setRunHistory(Array.isArray(save.runHistory) ? save.runHistory : []);
        setCurrentRunStats(
            (save.currentRunStats && typeof save.currentRunStats === 'object')
                ? save.currentRunStats
                : RunStats.freshRunStats()
        );
        // Achievements & badges (session 64, docs/ACHIEVEMENTS_PLAN.md). The
        // v10→v11 migration seeds both on older saves, but guard here too so
        // a malformed save can never crash boot (same convention as every
        // other field above). lifetimeStats/achievements survive everything
        // (including restart) — never touched by initGame.
        const restoredLifetimeStats =
            (save.lifetimeStats && typeof save.lifetimeStats === 'object')
                ? save.lifetimeStats
                : Achievements.freshLifetimeStats();
        const restoredAchievements =
            (save.achievements && typeof save.achievements === 'object')
                ? save.achievements
                : Achievements.freshUnlocked();
        setLifetimeStats(restoredLifetimeStats);
        // One-time-per-load evaluate pass (sub-session 1's "retro sweep" —
        // see ACHIEVEMENTS_PLAN.md fork 4). Idempotent by construction
        // (Achievements.evaluateAll only returns tiers not already in the
        // unlocked map), so running it on every restore is safe and needs
        // no separate "have I swept already" flag: it fires real unlocks
        // right after the migration derives retroactive lifetimeStats, and
        // is a no-op on every subsequent load until sub-session 2 wires
        // live bumps to lifetimeStats. Deliberately NO toast/notification
        // here — that's sub-session 2's event-driven wiring; this session
        // only persists the unlock, silently.
        const newlyCrossed = Achievements.evaluateAll(
            CONFIG.ACHIEVEMENTS, restoredLifetimeStats, restoredAchievements
        );
        setAchievements(
            Achievements.recordUnlocks(restoredAchievements, newlyCrossed, new Date().toISOString())
        );
        setRoutineSlots(CONFIG.ROUTINE_SLOTS_PER_LEVEL[restoredLevel] || 1);
        setBaseHealth((typeof save.baseHealth === 'number') ? save.baseHealth : CONFIG.MAX_BASE_HEALTH);
        setItemIdCounter(save.itemIdCounter || 1);
        setDaysSurvived(save.daysSurvived || 0);
        // Saves written before 2026-07-18 have no runStartedAtMs (days were
        // counted by the old accelerated timer). Fall back to the save's own
        // timestamp so a restored run doesn't report a bogus day count.
        setRunStartedAtMs(
            (typeof save.runStartedAtMs === 'number')
                ? save.runStartedAtMs
                : ((save.savedAt instanceof Date && !isNaN(save.savedAt.getTime()))
                    ? save.savedAt.getTime()
                    : Date.now())
        );
        if (save.currentGameDate instanceof Date && !isNaN(save.currentGameDate.getTime())) {
            setCurrentGameDate(save.currentGameDate);
        }

        // Plain-data collections (no DOM refs to rebuild)
        setDefinedHabits(save.definedHabits || []);
        setDefinedRoutines(save.definedRoutines || []);
        // Orphaned-habit sweep (2026-07-19, see DECISIONS.md + ROADMAP.md
        // Known bugs): deleteRoutine now releases its own habits to
        // standalone at delete time, but this heals any save written before
        // that fix existed (or any other edge case that produced a dangling
        // routineId) — runs on every load, no schema bump needed (data
        // shape unchanged, just a stale value corrected).
        Routines.releaseOrphanedHabits(save.definedHabits || [], save.definedRoutines || []);
        // Saves written before 2026-07-18 have no definedTasks — restore empty
        // rather than leaving whatever the previous page load put on window.
        window.definedTasks = save.definedTasks || [];
        setCompletedItems((save.completedItems || []).map(item => {
            item.element = null;
            item.listItemElement = null;
            return item;
        }));

        // Active items: rebuild DOM via addItemToGame (it pushes into activeItems,
        // which initGame just emptied). Saved order preserves parents-before-subtasks.
        (save.activeItems || []).forEach(item => {
            item.element = null;
            item.listItemElement = null;
            // [P2-GAME-010] Stage 1 (2026-07-19, session 60): urgencyTier is
            // a live render-diff cache (loop.js only touches classList when
            // the computed tier CHANGES from this field), not real game
            // state — but persistence.js only strips element/listItemElement,
            // so the plain string value survives the save/restore round trip
            // while the DOM element above does NOT (it's rebuilt fresh by
            // addItemToGame below). Found live in Chrome: a restored item
            // whose tier happened to compute the SAME on the first post-
            // restore tick never got its class applied to the new element at
            // all, since the stale cached value made the diff check think
            // nothing had changed. Reset alongside the DOM refs so the next
            // tick always (re)applies the class to the fresh element.
            item.urgencyTier = null;
            const savedX = (typeof item.x === 'number') ? item.x : null;
            deps.addItemToGame(item);
            restoredEntries.push({ item, savedX });
            // item.isOverdue here covers BOTH items saved as overdue (markAsOverdue
            // early-returned; re-apply its visual state) and items whose due date
            // passed while offline (addItemToGame just marked them — but with
            // lastDamageTickTime = dueDateTime, which would make the live loop
            // hammer one tick per game tick until "caught up"). Either way:
            // reset the live damage clock to now. The offline window's damage is
            // back-charged separately — capped per item — by runOfflineCatchUp
            // (policy decided 2026-07-17, see DECISIONS.md).
            if (item.isOverdue) {
                if (item.element) item.element.classList.add('enemy-at-base');
                if (item.listItemElement) item.listItemElement.classList.add('overdue-list-item');
                item.lastDamageTickTime = Date.now();
            }
        });

        // Orphan sanitizer ([P1-DATA-004] sub-session 1) — runs after every
        // saved item is back in activeItems (so parent lookups see everyone)
        // and before the parent list-item rebuild below, so a promoted item
        // is treated as an ordinary top-level task from here on: it needs a
        // list item built now (addItemToGame skipped it while parentId was
        // still set), same as any other top-level item that just entered
        // the game.
        sanitizeOrphanedSubTasks(getActiveItems()).forEach(item => {
            deps.createListItem(item);
        });

        // Parents' list items were built before their sub-tasks existed in
        // activeItems — rebuild those list items now that everything is loaded.
        getActiveItems().forEach(item => {
            if (!item.parentId && item.subTasks && item.subTasks.length > 0 && item.listItemElement) {
                item.listItemElement.remove();
                deps.createListItem(item);
            }
        });

        // Day rollover (restore path) — day-advance mechanism, 2026-07-19.
        // If real time has crossed into a later calendar day than the save's
        // currentGameDate, close out the PRIOR day's recurring instances BEFORE
        // spawning today's, then advance currentGameDate so the generators below
        // use today. Without this, currentGameDate stayed frozen at the save's
        // value and today's habit/routine-task instances never spawned (the
        // whole bug this fixes). Runs AFTER the re-add loop (so a positive
        // habit's miss is recorded by markAsOverdue) and BEFORE the generators.
        // Skipped for a game-over save (no settling a dead run). Base HP / offline
        // damage / regen / days-survived are unaffected — all derive from real
        // elapsed time, not the game day. LIVE mid-session crossing is a later
        // version; a running tab rolls over on its next reload. See DECISIONS.md.
        //
        // Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): a stale
        // negative-habit lurker no longer always auto-avoids. The SINGLE most
        // recent prior day (DayRollover.isFromPreviousDay) routes through
        // Items.markPendingCheckIn instead — the player answers it via the
        // check-in surface (js/ui/checkIn.js) rather than a silent
        // auto-resolve. Everything else — negative lurkers from OLDER days
        // (session 26's generous default), positive habits (already
        // miss-recorded above), routine tasks — still goes through
        // Items.settleStaleRecurringInstance exactly as before.
        //
        // Sub-session 5 (Cheat Day token, 2026-07-19): now a THREE-way fork,
        // checked in this order. A stale negative-habit lurker whose day has
        // an ACTIVE Cheat Day (deps.isCheatDayExcusedForItem) is EXCUSED
        // first — ahead of both the check-in-eligible and auto-avoid checks
        // — via Items.settleExcusedCheatDay, per NEGATIVE_HABITS_PLAN.md's
        // "the check-in card for that day auto-resolves as excused."
        if (!save.gameIsOver) {
            const rolloverNow = new Date();
            if (performDayRollover(deps, rolloverNow)) {
                // Drop settled (now-removed) items from the catch-up entry set so
                // runOfflineCatchUp below doesn't animate/position ghosts whose DOM
                // elements were just detached. Damage already reads live
                // activeItems, so this is purely to keep the animation clean.
                const liveItems = getActiveItems();
                for (let i = restoredEntries.length - 1; i >= 0; i--) {
                    if (!liveItems.includes(restoredEntries[i].item)) restoredEntries.splice(i, 1);
                }
            }
        }

        // Spawn today's habit + routine-task instances the save doesn't already
        // contain (both generators dedupe against activeItems/completedItems)
        deps.generateDailyHabitInstances(getCurrentGameDate());
        deps.generateDailyRoutineTaskInstances(getCurrentGameDate());

        // Refresh every display touched above
        deps.updatePlayerDisplays();
        if (deps.baseHealthDisplay) deps.baseHealthDisplay.textContent = getBaseHealth();
        deps.updateBaseVisuals();
        deps.updateTaskCountDisplay();
        deps.updateRoutineDisplay();
        deps.renderDefinedRoutines();
        deps.renderCompletedItems();
        deps.sortAndRenderActiveList();

        // `true` = alreadyOver (sub-session 4, session 55): this restores an
        // ALREADY-finished run's UI, it doesn't end a new one — the actual
        // finalize+append into runHistory happened the first time this run
        // died, live. Without this flag, every reload of a dead save (before
        // clicking Restart) re-finalized and appended a duplicate history
        // record — found live in Chrome this session. See js/damage.js's
        // gameOver() header comment for the full explanation.
        if (save.gameIsOver) deps.gameOver(true);

        // Offline catch-up: animate zombies from their saved positions to now,
        // then back-charge capped offline overdue damage (see DECISIONS.md).
        if (!isGameOver()) deps.runOfflineCatchUp(restoredEntries, offlineMs);
        return true;
    }

    /**
     * performDayRollover — the settle-and-advance fork shared by the
     * restore path (above) and LIVE mid-session rollover (loop.js, via
     * checkLiveDayRollover below). Day-advance mechanism, restore-path-only
     * originally (2026-07-19); extracted 2026-07-20 so the live path can't
     * drift from the restore path's settlement rules (cheat-day-excused →
     * check-in-eligible → auto-avoid). Pure orchestration — no DOM, no
     * caller-specific cleanup (restoredEntries pruning stays in
     * restoreGameState, since live rollover has no such list).
     *
     * Returns true if a rollover happened (caller should treat the day as
     * having just advanced — spawn today's instances, refresh displays,
     * save), false if `now` is still the same calendar day as
     * deps.getCurrentGameDate() (the common case, almost every tick).
     *
     * deps (subset of restoreGameState's / loopDeps' contract): getCurrentGameDate,
     * getActiveItems, isCheatDayExcusedForItem, settleExcusedCheatDay,
     * markPendingCheckIn, settleStaleRecurringInstance, setCurrentGameDate.
     */
    function performDayRollover(deps, now) {
        if (!DayRollover.hasDayRolledOver(deps.getCurrentGameDate(), now)) return false;
        DayRollover.selectStaleRecurringInstances(deps.getActiveItems(), now)
            .forEach(item => {
                const isExcusedCheatDay = item.type === 'habit' && item.isNegative === true &&
                    deps.isCheatDayExcusedForItem(item);
                const isCheckInEligible = !isExcusedCheatDay && item.type === 'habit' && item.isNegative === true &&
                    DayRollover.isFromPreviousDay(item.originalDueDate, now);
                if (isExcusedCheatDay) {
                    deps.settleExcusedCheatDay(item);
                } else if (isCheckInEligible) {
                    deps.markPendingCheckIn(item);
                } else {
                    deps.settleStaleRecurringInstance(item);
                }
            });
        deps.setCurrentGameDate(DayRollover.startOfDay(now));
        return true;
    }

    /**
     * checkLiveDayRollover — LIVE mid-session midnight crossing (deferred
     * from session 32, built 2026-07-20; see ROADMAP.md/DECISIONS.md). A
     * session left running past midnight previously only rolled over on its
     * NEXT reload (restore path above); this closes that gap by running the
     * same performDayRollover fork from loop.js's per-tick updateGame, so a
     * tab left open overnight sees yesterday's recurring instances settle
     * and today's spawn without a reload.
     *
     * Called as an OPTIONAL loop.js collaborator (omitted = no-op, matching
     * checkDayPagerRollover's existing tolerance) so loop.test.js's existing
     * deps objects don't need updating for this alone. Guards isGameOver
     * itself for clarity/defense-in-depth even though a dead run's
     * gameLoopInterval is already cleared (damage.js's gameOver), so this
     * can't actually fire post-death in practice — matches the restore
     * path's explicit "skipped for a game-over save" comment.
     *
     * No offline-catch-up animation here (nothing was offline — the tab was
     * live the whole time); instead spawns today's instances and refreshes
     * the same displays the restore path's rollover branch feeds into,
     * then saves immediately (autosave's 5s window could otherwise lose a
     * rollover that happens right before a crash/close).
     *
     * deps: everything performDayRollover needs, plus isGameOver,
     * generateDailyHabitInstances, generateDailyRoutineTaskInstances,
     * updateTaskCountDisplay, updateRoutineDisplay, renderDefinedRoutines,
     * renderCompletedItems, sortAndRenderActiveList, saveGame.
     */
    function checkLiveDayRollover(deps) {
        if (deps.isGameOver()) return;
        const now = new Date();
        if (!performDayRollover(deps, now)) return;

        deps.generateDailyHabitInstances(deps.getCurrentGameDate());
        deps.generateDailyRoutineTaskInstances(deps.getCurrentGameDate());

        deps.updateTaskCountDisplay();
        deps.updateRoutineDisplay();
        deps.renderDefinedRoutines();
        deps.renderCompletedItems();
        deps.sortAndRenderActiveList();

        deps.saveGame();
    }

    return {
        initGame,
        getPersistableState,
        saveGame,
        buildDamageDeps,
        restoreGameState,
        sanitizeOrphanedSubTasks,
        performDayRollover,
        checkLiveDayRollover,

        // Ownership-move accessors (Sub-session 1, docs/STATE_OWNERSHIP_PLAN.md,
        // 2026-07-20) — script.js's deps builders (stateDeps() and every other
        // deps builder that used to close over its own local `let`s for these
        // 21 fields) now source these keys directly from State.* instead.
        getBaseHealth, setBaseHealth,
        getPlayerXP, setPlayerXP,
        getPlayerLevel, setPlayerLevel,
        getPlayerPoints, setPlayerPoints,
        getRoutineSlots, setRoutineSlots,
        getPlayerInventory, setPlayerInventory,
        getSickDayDate, setSickDayDate,
        getCurrentRunStats, setCurrentRunStats,
        getRunHistory, setRunHistory,
        getLifetimeStats, setLifetimeStats,
        getAchievements, setAchievements,
        getActiveItems, setActiveItems,
        getCompletedItems, setCompletedItems,
        getDefinedHabits, setDefinedHabits,
        getDefinedRoutines, setDefinedRoutines,
        getItemIdCounter, setItemIdCounter,
        isGameOver, setGameIsOver, setGameOver,
        getDaysSurvived, setDaysSurvived,
        getCurrentGameDate, setCurrentGameDate,
        getRunStartedAtMs, setRunStartedAtMs,
        getLastLoopTickMs, setLastLoopTickMs,
        getLastRegenTickMs, setLastRegenTickMs,
    };
})();

// [P1-DATA-004] sub-session 1 (2026-07-19): state.js had no module.exports
// before this session — nothing in it was unit-testable from test/. Adding
// it here (matching every other js/*.js module's guarded-export footer) is
// safe for Node `require`: the only DOM/window reference in the whole file
// (`window.definedTasks = ...`) lives inside restoreGameState's function
// body, not at module-load time, so requiring this file in a node
// testEnvironment never touches it unless restoreGameState is actually
// called (which no current test does — only the pure sanitizeOrphanedSubTasks
// is exercised).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = State;
}
