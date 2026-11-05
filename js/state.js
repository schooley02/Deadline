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
    // heroStarMemory, lastAutosaveMs, effectsIntensity — those
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
    let bestRoutineSlots = 0; // run-end carryover (2026-11-03): the most routine slots ever held; survives a new run
    let playerInventory = {};
    let sickDayDate = null;
    // Pushback charges (Build B, 2026-11-02): use timestamps (ms) of the FREE charges spent,
    // per size -- { short: [ts], medium: [ts], long: [ts] }. Daily sizes count the stamps since
    // today's local midnight, Long a rolling 7 days (Pushback.chargesLeft), so nothing needs
    // clearing at rollover. Additive root field, no schema bump; replaces Build 2's
    // `rescheduleFreeUses` (old saves still carry it; it is ignored and dropped on the next save).
    let pushbackUses = { short: [], medium: [], long: [] };
    // Anytime morning-card credits (2026-11-02): use stamps (ms) of the on-time credits spent, a rolling window read by
    // AnytimeCheck.creditInfo. Additive root save field, no schema bump; a fresh run starts with none spent.
    let anytimeCreditUses = [];
    // Priority slots (2026-11-04, docs/PRIORITY_SLOTS_PLAN.md): how many priority slots were SPENT per local due day,
    // { 'YYYY-MM-DD': n } (schema 17). A mark is spent when a task is marked and never given back (PrioritySlots owns the
    // maths). Pruned to yesterday-and-later at rollover; a fresh run (initGame) starts with none spent.
    let priorityMarks = {};
    // Goals (2026-11-05, Goals Build A, docs/GOALS_PLAN.md): the player's goals { bestSlots, active, done, nextId, seeded } (schema 18).
    // CARRIES ACROSS RUNS like lifetimeStats: initGame never resets it, so a lost run keeps every goal, streak and slot.
    let goals = (typeof Goals !== 'undefined') ? Goals.freshGoals() : { bestSlots: 0, active: [], done: [], nextId: 1, seeded: false };
    let currentRunStats = (typeof RunStats !== 'undefined') ? RunStats.freshRunStats() : {};
    let runHistory = [];
    // D2 (2026-10-27, docs/DAILY_RECORD_PLAN.md): the live DailyRecord for the
    // open local day (schema 15 `save.today`). null until ensureToday() runs.
    // LIFETIME data like lifetimeStats: initGame never touches it.
    let today = null;
    let closedDaysCache = null; // goals: the closed days of `deadline.days`, read once per open day (see cachedClosedDays)
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
    // Run-end carryover (2026-11-03, js/runCarryover.js): the most slots ever held rides along in
    // `bestRoutineSlots` (root save field) and a new run never starts below it. The setter keeps the
    // high-water mark, so every path that raises slots (level-up, restore) records it for free.
    const setRoutineSlots = (n) => {
        routineSlots = n;
        if (typeof n === 'number' && isFinite(n) && n > bestRoutineSlots) bestRoutineSlots = Math.floor(n);
    };
    const getBestRoutineSlots = () => bestRoutineSlots;
    const setBestRoutineSlots = (n) => {
        bestRoutineSlots = (typeof RunCarryover !== 'undefined') ? RunCarryover.sanitizeBestSlots(n)
            : ((typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0);
    };
    const getPlayerInventory = () => playerInventory;
    const setPlayerInventory = (obj) => { playerInventory = obj; };
    const getSickDayDate = () => sickDayDate;
    const setSickDayDate = (d) => { sickDayDate = d; };
    const getPushbackUses = () => pushbackUses;
    // Keeps only finite ms stamps for the three known sizes; anything else (junk, old saves) becomes empty.
    const setPushbackUses = (obj) => {
        const out = {};
        ['short', 'medium', 'long'].forEach((z) => {
            out[z] = (obj && Array.isArray(obj[z])) ? obj[z].filter(n => typeof n === 'number' && isFinite(n)) : [];
        });
        pushbackUses = out;
    };
    const getAnytimeCreditUses = () => anytimeCreditUses;
    // Keeps only finite ms stamps; anything else (junk, old saves) becomes empty.
    const setAnytimeCreditUses = (arr) => {
        anytimeCreditUses = Array.isArray(arr) ? arr.filter(n => typeof n === 'number' && isFinite(n)) : [];
    };
    const getPriorityMarks = () => priorityMarks;
    // Keeps only { 'YYYY-MM-DD': n > 0 }; junk and old saves become empty. No-op shape when PrioritySlots isn't loaded (tests).
    const setPriorityMarks = (obj) => {
        priorityMarks = (typeof PrioritySlots !== 'undefined') ? PrioritySlots.sanitizeMarks(obj) : ((obj && typeof obj === 'object') ? obj : {});
    };
    const getGoals = () => goals;
    // Repairs whatever it is given (junk, a pre-18 save -> fresh). Without the Goals module (some tests) it just stores the object.
    const setGoals = (obj) => {
        goals = (typeof Goals !== 'undefined') ? Goals.sanitizeGoals(obj) : ((obj && typeof obj === 'object') ? obj : goals);
    };
    const getCurrentRunStats = () => currentRunStats;
    const setCurrentRunStats = (obj) => { currentRunStats = obj; };
    const getRunHistory = () => runHistory;
    const setRunHistory = (arr) => { runHistory = arr; };
    const getLifetimeStats = () => lifetimeStats;
    const setLifetimeStats = (obj) => { lifetimeStats = obj; };
    const getToday = () => today;
    const setToday = (obj) => { today = obj; closedDaysCache = null; };

    /**
     * ensureToday -- the open day's DailyRecord, created on first use. A null
     * slot (fresh install, or a save migrated from v14) is seeded with the REAL
     * local date, never an older game date, so no phantom past day is ever
     * written at rollover. No-op (returns null) when DailyRecord isn't loaded
     * (tests that don't need it).
     */
    function ensureToday(now) {
        if (typeof DailyRecord === 'undefined') return null;
        if (!today) {
            today = DailyRecord.fresh({
                date: DailyRecord.dateKey(now || new Date()),
                run: (Array.isArray(runHistory) ? runHistory.length : 0) + 1,
                night: daysSurvived,
                lvl: playerLevel,
            });
        }
        return today;
    }

    /**
     * bumpToday -- the ONE entry point every daily-record seam calls (via a
     * `recordDaily` dep; gameplay modules never read State directly). Never
     * throws: a stats bug must not break a game tick.
     */
    function bumpToday(event, payload) {
        try {
            const rec = ensureToday();
            if (!rec) return;
            // An undo whose completion belongs to an already-CLOSED day must not
            // reach into today's record (closed days are never edited).
            // 'goalClear' (v5) is the goal-entry half of the same undo, so it gets the same guard.
            if ((event === 'uncomplete' || event === 'goalClear') && payload && payload.at != null &&
                DailyRecord.dateKey(payload.at) !== rec.date) return;
            DailyRecord.bump(rec, event, payload);
        } catch (e) {
            console.error('Deadline: daily record bump failed', event, e);
        }
    }
    /**
     * adjustDayTimer -- Habit Goals Build 2c (DailyRecord v4). Applies a signed minutes delta (an edited logged time) to the
     * record of `dateKey`: the OPEN day's working record, or that day's CLOSED record in `deadline.days`. Returns true when a
     * record was corrected. A day with no record (the app never saw it, or it was rolled into a month) is left alone: false.
     * A closed record is written back only when the correction actually changed it. Never throws.
     */
    function adjustDayTimer(dateKey, kind, deltaMin) {
        try {
            if (typeof DailyRecord === 'undefined' || !dateKey) return false;
            const rec = ensureToday();
            if (rec && rec.date === dateKey) {
                DailyRecord.adjustTimer(rec, kind, deltaMin);
                return true;
            }
            if (typeof Persistence === 'undefined') return false;
            const store = DailyRecord.normalizeStore(Persistence.loadDays());
            const closed = store.days[dateKey];
            if (!closed || typeof closed !== 'object') return false;
            if (DailyRecord.adjustTimer(closed, kind, deltaMin) === 0) return true; // nothing to change (e.g. already 0 minutes)
            return Persistence.saveDays(store) !== false;
        } catch (e) {
            console.error('Deadline: daily record timer adjust failed', e);
            return false;
        }
    }
    /**
     * updateDayGoalActual -- Habit Goals Build 3 (DailyRecord v5). After an edited logged time, refreshes the `actual` of the
     * habit's ALREADY-recorded goal entry on `dateKey` (the open day's working record, or that day's closed record in
     * `deadline.days`). Same routing as adjustDayTimer; a day or entry that does not exist is left alone (false). Never throws.
     */
    function updateDayGoalActual(dateKey, habitId, actual) {
        try {
            if (typeof DailyRecord === 'undefined' || !dateKey || habitId == null) return false;
            const rec = ensureToday();
            if (rec && rec.date === dateKey) return DailyRecord.setGoalActual(rec, habitId, actual);
            if (typeof Persistence === 'undefined') return false;
            const store = DailyRecord.normalizeStore(Persistence.loadDays());
            const closed = store.days[dateKey];
            if (!closed || typeof closed !== 'object') return false;
            if (!DailyRecord.setGoalActual(closed, habitId, actual)) return false;
            return Persistence.saveDays(store) !== false;
        } catch (e) {
            console.error('Deadline: daily record goal update failed', e);
            return false;
        }
    }
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

    // Slots for a player level: CONFIG.ROUTINE_SLOTS_PER_LEVEL, never below bestRoutineSlots.
    function slotsForLevel(level) {
        const table = CONFIG.ROUTINE_SLOTS_PER_LEVEL;
        if (typeof RunCarryover !== 'undefined') return RunCarryover.slotsFor(level, bestRoutineSlots, table);
        return Math.max((table && table[level]) || 1, bestRoutineSlots);
    }

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
        setPushbackUses(null); // a fresh run: no charges used (Clock tower stars reset too)
        setAnytimeCreditUses(null); // ...and no anytime morning credits spent
        setPriorityMarks(null); // ...and no priority slots spent (a plan for a day that ended the run is moot)
        setSickDayDate(null); // frozen-slots sub-session 5 — fresh run has no active Sick Day
        // Run stats reset with the run; runHistory is deliberately NOT
        // touched here — it must survive restart (session 52, RUN_HISTORY_PLAN).
        setCurrentRunStats(RunStats.freshRunStats());
        // lifetimeStats/achievements are likewise deliberately NOT touched
        // here — lifetime data, must survive restart (session 64,
        // ACHIEVEMENTS_PLAN.md; same reasoning as runHistory above).
        // Run-end carryover (2026-11-03): a new run starts with the table's level-1 slots OR the most
        // the player ever earned, whichever is more (bestRoutineSlots is NOT reset here, like runHistory).
        setRoutineSlots(slotsForLevel(1));
        // Goals (2026-11-05): NOT reset (they carry across runs). Only the slot mark catches up with the level and the suggested
        // starters are added once, on the very first boot (both idempotent).
        syncGoalSlots(1);
        ensureGoalsSeeded();

        deps.updatePlayerDisplays();

        // Initialize base
        setBaseHealth(CONFIG.MAX_BASE_HEALTH);
        deps.baseHealthDisplay.textContent = CONFIG.MAX_BASE_HEALTH;
        if (typeof Damage !== 'undefined' && Damage.applyBaseArt) {
            Damage.applyBaseArt(deps.baseElement, CONFIG.MAX_BASE_HEALTH); // also sets the idle-loop key
        } else {
            deps.baseElement.style.backgroundImage = 'url("Assets/Base/base_100.png")';
        }
        deps.baseElement.classList.remove('base-hit-flash', 'base-hit-shake');

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
            pushbackUses: getPushbackUses(),
            anytimeCreditUses: getAnytimeCreditUses(),
            priorityMarks: getPriorityMarks(),
            goals: getGoals(),
            runHistory: getRunHistory(),
            currentRunStats: getCurrentRunStats(),
            lifetimeStats: getLifetimeStats(),
            today: getToday(),
            achievements: getAchievements(),
            routineSlots: getRoutineSlots(),
            bestRoutineSlots: getBestRoutineSlots(),
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
            // Level perks (2026-10-23): gameOver records the run's peak level
            // (peakPlayerLevel) so a past run's card can show its title.
            getPlayerLevel,
            getDefinedRoutines,
            getDefinedHabits,
            heroesCompletionRate: deps.heroesCompletionRate,
            heroesStarRating: deps.heroesStarRating,
            // Game-over review card (Run history sub-session 4, session 55) —
            // GameOverView.renderReviewCard, pre-bound in script.js since
            // js/ui/*.js loads after js/damage.js.
            renderGameOverReview: deps.renderGameOverReview,
            // Village Build 3 (2026-10-30): script.js's real (non-URL-overridden) tiers, saved on the run record.
            getVillageTiers: deps.getVillageTiers,
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
        setPushbackUses(save.pushbackUses);
        setAnytimeCreditUses(save.anytimeCreditUses);
        setPriorityMarks(save.priorityMarks);
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
        // Daily record accumulator (D2, schema 15). The v14->v15 migration
        // seeds null; ensureToday() builds the record. A malformed object is
        // repaired through DailyRecord.normalize (additive-only fields).
        setToday(
            (typeof DailyRecord !== 'undefined' && save.today && typeof save.today === 'object')
                ? DailyRecord.normalize(save.today)
                : null
        );
        ensureToday();
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
        // Run-end carryover (2026-11-03): the best-ever slot count is restored BEFORE the live count
        // so a saved run never comes back with fewer slots than its routines were built on.
        setBestRoutineSlots(save.bestRoutineSlots);
        setRoutineSlots(slotsForLevel(restoredLevel));
        // Goals (2026-11-05): repaired on the way in; the slot mark catches up with the restored level, and a save that has never seen
        // the suggested starters (a migrated one) gets them now.
        setGoals(save.goals);
        syncGoalSlots(restoredLevel);
        ensureGoalsSeeded();
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
            // Saved damage clock of an item that was ALREADY overdue at save time, so
            // the offline catch-up can resume its partial 5-min countdown (below,
            // restore resets lastDamageTickTime to now; Damage.runOfflineCatchUp
            // moves it back to the last whole tick). 2026-10-13.
            const savedTickMs = (item.isOverdue && typeof item.lastDamageTickTime === 'number' && isFinite(item.lastDamageTickTime))
                ? item.lastDamageTickTime : null;
            deps.addItemToGame(item);
            // KO ghost restored from the save: re-apply the fade + badge to the
            // freshly built element (the agenda row styles itself from state).
            if (item.koGhost && typeof deps.syncGhostLook === 'function') deps.syncGhostLook(item);
            restoredEntries.push({ item, savedX, savedTickMs });
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
        // (settled NEUTRAL since 2026-10-31; was session 26's auto-avoid), positive habits (already
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
                // KO ghosts skip the check-in card (the routine is down) and settle
                // NEUTRAL like any unanswered Break habit (2026-10-31; was auto-avoid).
                const isCheckInEligible = !isExcusedCheatDay && !item.koGhost && item.type === 'habit' && item.isNegative === true &&
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
        // Priority slots: marks older than yesterday can never be read again (a task's slots belong to its due day).
        if (typeof PrioritySlots !== 'undefined') setPriorityMarks(PrioritySlots.prune(getPriorityMarks(), now));
        // Daily record (D2): close the day that just ended. AFTER the settle loop
        // above on purpose -- auto-avoided lurkers and misses it records belong
        // to the closing day. Never allowed to break a rollover.
        try { closeDailyRecord(now, deps); } catch (e) { console.error('Deadline: daily record close failed', e); }
        // Goals (Build A): close every recurring-goal period that just ended, AFTER the day's record is in the store (its numbers are
        // what an aggregate target reads), then bring the open milestones up to date. Never allowed to break a rollover.
        try { closeGoalPeriods(now); settleGoals(now); } catch (e) { console.error('Deadline: goal period close failed', e); }
        return true;
    }

    /**
     * closeDailyRecord -- D2 (2026-10-27, docs/DAILY_RECORD_PLAN.md). Writes the
     * open day's record into `deadline.days` ONCE (the only writer; never on the
     * per-change save path), runs the 18-month roll-up, then seeds a fresh
     * accumulator for the new local day. A multi-day gap closes only the day
     * that was open; days the app never saw simply have no record (a signal).
     * If the days store can't be written (quota), the accumulator is KEPT so
     * nothing is lost silently; the next rollover retries with the same record.
     * No-op when DailyRecord/Persistence aren't loaded (tests), or when the
     * open record already belongs to today's date (fresh seed).
     */
    function closeDailyRecord(now, deps) {
        if (typeof DailyRecord === 'undefined' || typeof Persistence === 'undefined') return false;
        const rec = today;
        const key = DailyRecord.dateKey(now);
        if (!rec) { ensureToday(now); return false; }
        if (rec.date === key) return false;

        const habits = (getDefinedHabits() || []).filter(h => h && !h.archivedAt);
        const tasksDue = getActiveItems().concat(getCompletedItems()).filter(item =>
            item && item.type === 'task' && !item.parentId && item.dueDateTime &&
            DailyRecord.dateKey(new Date(item.dueDateTime)) === rec.date).length;
        // High school v2: the stars every routine banks for the day that just ended. A pre-bound collaborator from
        // script.js (Heroes loads after state.js, the same forward-reference reason as heroesCompletionRate); absent in
        // tests -> nothing banked. Never allowed to break a close.
        let bankedStars;
        try {
            if (deps && typeof deps.routineStarsNow === 'function') bankedStars = deps.routineStarsNow();
        } catch (e) { console.error('Deadline: banked stars failed', e); }
        const closed = DailyRecord.close(rec, {
            stars: bankedStars,
            lvl: getPlayerLevel(),
            run: (Array.isArray(runHistory) ? runHistory.length : 0) + 1,
            night: daysSurvived,
            load: { habits: habits.length, routines: (getDefinedRoutines() || []).length, tasksDue },
            // Denominators: habit instances are removed once settled, so they are
            // derived from what was resolved (done + missed); tasks from the
            // items still on file for that date.
            due: { task: tasksDue, habit: rec.done.habit + rec.missed.habit },
            endHp: getBaseHealth(),
            ptsEnd: getPlayerPoints(),
            bestStreak: habits.reduce((m, h) => Math.max(m, h.streak || 0), 0),
        });

        let store = DailyRecord.normalizeStore(Persistence.loadDays());
        store = DailyRecord.rollUp(DailyRecord.addDay(store, closed), now);
        if (!Persistence.saveDays(store)) return false; // keep `today`; retry next rollover
        // Achievements swap (2026-11-03): feed the closed day to the Honor Roll / Clean Sweep counters. AFTER the save
        // succeeded on purpose: a failed save keeps `today` and retries, so counting earlier would double count.
        try {
            if (deps && typeof deps.recordLifetimeDayClose === 'function') deps.recordLifetimeDayClose(closed);
        } catch (e) { console.error('Deadline: lifetime day close failed', e); }
        today = null;
        closedDaysCache = null; // the store just changed
        ensureToday(now);
        return true;
    }

    // ------------------------------------------------------------------ Goals (Build A, docs/GOALS_PLAN.md)
    // State owns the saved copy (`goals`); js/goals.js holds the rules and js/goalMetrics.js the daily-record numbers. Every function
    // here is a no-op when those modules are not loaded (some Jest suites), and none of them throws.

    const goalsReady = () => typeof Goals !== 'undefined' && typeof GoalMetrics !== 'undefined' && typeof CONFIG !== 'undefined';
    const toMs = (now) => (now instanceof Date) ? now.getTime() : (typeof now === 'number' ? now : Date.now());

    /** How many goal slots the player has at `level` (default: the current level): the table, never below the best ever held. */
    function goalSlotCount(level) {
        if (!goalsReady()) return 0;
        return Goals.slotsAtLevel(typeof level === 'number' ? level : playerLevel, CONFIG.GOAL_SLOTS_PER_LEVEL, goals.bestSlots);
    }

    /** Raises the saved slot high-water mark to the count for `level`; returns the count. Never lowers it. */
    function syncGoalSlots(level) {
        if (!goalsReady()) return 0;
        const n = goalSlotCount(level);
        if (n > goals.bestSlots) goals = Object.assign({}, goals, { bestSlots: n });
        return n;
    }

    /** Adds the suggested starter goals once (into free slots). Returns true when it changed anything. */
    function ensureGoalsSeeded(now) {
        if (!goalsReady() || goals.seeded) return false;
        goals = Goals.seed(goals, CONFIG.GOAL_STARTERS, toMs(now), CONFIG.GOAL_WEEK_STARTS_ON, goalSlotCount());
        return true;
    }

    const metricValue = (rec, id) => GoalMetrics.valueById(CONFIG.GOAL_METRICS, rec, id);

    // The daily records a goal's targets read: the closed days of `deadline.days` plus the open day, between two day keys.
    function recordsForRange(days, startKey, endKey) {
        return GoalMetrics.recordsBetween(days, today, startKey, endKey);
    }
    function loadClosedDays() {
        try {
            if (typeof Persistence === 'undefined' || typeof DailyRecord === 'undefined') return {};
            return DailyRecord.normalizeStore(Persistence.loadDays()).days;
        } catch (e) { return {}; }
    }
    // The pane asks for the views every tick, so the closed days are read from storage once per open day (they only change when a
    // day closes, which also changes the open day's date). `forceReload` is for tests and a failed close.
    function cachedClosedDays(forceReload) {
        const key = today ? today.date : null;
        if (!forceReload && closedDaysCache && closedDaysCache.key === key) return closedDaysCache.days;
        const days = loadClosedDays();
        closedDaysCache = { key, days };
        return days;
    }

    // Goal events (session only): State pushes what happened ('complete' with the roster record, 'period' with a close outcome) and
    // script.js drains them each tick to show the notices, so a completion that lands at rollover or from the pane is told once.
    let goalEvents = [];
    const takeGoalEvents = () => { const out = goalEvents; goalEvents = []; return out; };

    // pg counts (DailyRecord v10): stages climbed / lost, recurring periods met, milestones completed.
    function bumpGoalCounts(counts) {
        if (counts.climb > 0 || counts.drop > 0 || counts.met > 0 || counts.done > 0) bumpToday('pgoal', counts);
    }

    /**
     * Brings every open milestone up to date (its stage follows its progress; a goal whose targets are all at 1 completes into the
     * roster). Returns the roster records of the goals that completed just now ([] when none). Safe to call often; reads
     * `deadline.days` only when an open milestone watches a daily-record number.
     */
    function settleGoals(now, opts) {
        if (!goalsReady() || !goals.active.some(g => g.kind === 'milestone')) return [];
        const nowMs = toMs(now);
        const needsDays = goals.active.some(g => g.kind === 'milestone' && g.targets.some(t => t.type === 'aggregate'));
        const days = needsDays ? loadClosedDays() : {};
        const before = {};
        goals.active.forEach((g) => { before[g.id] = g.stage; });
        const r = Goals.settleMilestones(goals, {
            nowMs,
            runNights: daysSurvived,
            rosterKeep: CONFIG.GOAL_ROSTER_KEEP,
            metricValue,
            recordsFor: (goal) => recordsForRange(days, Goals.dateKey(goal.createdAt), Goals.dateKey(nowMs)),
        });
        if (!r.changed) return [];
        goals = r.goals;
        const counts = { climb: 0, drop: 0, met: 0, done: r.completed.length };
        goals.active.forEach((g) => {
            if (before[g.id] === undefined) return;
            if (g.stage > before[g.id]) counts.climb += g.stage - before[g.id];
            else if (g.stage < before[g.id]) counts.drop += before[g.id] - g.stage;
        });
        r.completed.forEach((rec) => { counts.climb += Math.max(0, Goals.MAX_STAGE - (before[rec.id] || 0)); });
        bumpGoalCounts(counts);
        r.completed.forEach((rec) => goalEvents.push({ type: 'complete', record: rec }));
        if (!(opts && opts.noSave)) saveGame();
        return r.completed;
    }

    /**
     * A task / habit was finished (dir +1) or un-finished (dir -1): `info` = { goalId, goalTargetId, type, definitionId, routineId }.
     * Updates any linked target it counts toward, then settles the milestones. Returns { changed, completed }.
     */
    function applyGoalCompletion(info, dir, now) {
        if (!goalsReady()) return { changed: false, completed: [] };
        const r = Goals.applyCompletion(goals, info, dir);
        if (!r.changed) return { changed: false, completed: [] };
        goals = r.goals;
        const completed = settleGoals(now, { noSave: true });
        saveGame();
        return { changed: true, completed };
    }

    /**
     * Closes every recurring-goal period that ended before `now` (an app closed for weeks closes each one in order). Returns the
     * outcomes [{ goalId, name, key, met, progress, stageBefore, stageAfter, streakAfter }] for the notices Build B shows.
     */
    function closeGoalPeriods(now) {
        if (!goalsReady() || !goals.active.some(g => g.kind === 'recurring')) return [];
        const nowMs = toMs(now);
        const days = loadClosedDays();
        const all = [];
        const counts = { climb: 0, drop: 0, met: 0, done: 0 };
        const active = goals.active.map((goal) => {
            if (goal.kind !== 'recurring') return goal;
            const r = Goals.closePeriods(goal, {
                nowMs,
                weekStartsOn: CONFIG.GOAL_WEEK_STARTS_ON,
                historyKeep: CONFIG.GOAL_HISTORY_KEEP,
                metricValue,
                recordsFor: (key) => {
                    const dayKeys = Goals.periodDayKeys(goal.period, key);
                    if (dayKeys.length === 0) return { records: [], openKey: null };
                    return recordsForRange(days, dayKeys[0], dayKeys[dayKeys.length - 1]);
                },
            });
            r.outcomes.forEach((o) => {
                all.push(Object.assign({ goalId: goal.id, name: goal.name }, o));
                goalEvents.push({ type: 'period', goalId: goal.id, name: goal.name, key: o.key, met: o.met, stageBefore: o.stageBefore, stageAfter: o.stageAfter });
                if (o.met) counts.met += 1;
                if (o.stageAfter > o.stageBefore) counts.climb += o.stageAfter - o.stageBefore;
                if (o.stageAfter < o.stageBefore) counts.drop += o.stageBefore - o.stageAfter;
            });
            return r.goal;
        });
        const changed = active.some((g, i) => g !== goals.active[i]);
        if (!changed) return all;
        goals = Object.assign({}, goals, { active });
        bumpGoalCounts(counts);
        saveGame();
        return all;
    }

    /**
     * What the pane and the card draw: one view per active goal (see Goals.viewFor), plus the slot facts. Cheap enough to call every tick
     * (the closed days are cached per open day).
     */
    function getGoalViews(now) {
        if (!goalsReady()) return [];
        const nowMs = toMs(now);
        const needsDays = goals.active.some(g => g.targets.some(t => t.type === 'aggregate'));
        const days = needsDays ? cachedClosedDays() : {};
        const todayKey = Goals.dateKey(nowMs);
        return goals.active.map(goal => Goals.viewFor(goal, {
            nowMs,
            weekStartsOn: CONFIG.GOAL_WEEK_STARTS_ON,
            slack: CONFIG.GOAL_PACE_SLACK,
            metricValue,
            metricInfo: (id) => GoalMetrics.byId(CONFIG.GOAL_METRICS, id),
            recordsFor: (g) => {
                if (g.kind === 'milestone') return recordsForRange(days, Goals.dateKey(g.createdAt), todayKey);
                const key = Goals.validKey(g.period, g.periodKey) ? g.periodKey : Goals.periodKeyFor(g.period, nowMs, CONFIG.GOAL_WEEK_STARTS_ON);
                const dayKeys = Goals.periodDayKeys(g.period, key);
                return dayKeys.length ? recordsForRange(days, dayKeys[0], dayKeys[dayKeys.length - 1]) : { records: [], openKey: null };
            },
        }));
    }

    /** The slot facts the pane shows: { slots, used, next: { level, slots } | null }. */
    function getGoalSlotInfo() {
        if (!goalsReady()) return { slots: 0, used: 0, next: null };
        const slots = goalSlotCount();
        return { slots, used: goals.active.length, next: Goals.nextUnlockLevel(playerLevel, slots, CONFIG.GOAL_SLOTS_PER_LEVEL) };
    }

    /** Sets a number target's value or flips a yes/no target from the card. Returns { changed, completed } and saves. */
    function updateGoalTarget(goalId, targetId, patch, now) {
        if (!goalsReady()) return { changed: false, completed: [] };
        const r = Goals.updateTarget(goals, goalId, targetId, patch);
        if (!r.changed) return { changed: false, completed: [] };
        goals = r.goals;
        const completed = settleGoals(now, { noSave: true });
        saveGame();
        return { changed: true, completed };
    }

    // ---- Add / Edit (Goals Build B2, 2026-11-05): the form's entry points and the one-off task links ----
    // A one-off task that counts toward a linked target wears `item.goalId` + `item.goalTargetId` (additive item fields, no schema bump).
    // The target keeps an event counter (itemTotal / itemDone, see Goals.applyCompletion); `syncItemLinks` is the ONE place the two are
    // brought back in line: it moves the fields on the open tasks and then sets each touched target's itemTotal from a live count.
    const sameKey = (a, b) => a != null && b != null && String(a) === String(b);
    const clearItemLink = (item) => { item.goalId = null; item.goalTargetId = null; };
    const liveLinkCount = (goalId, targetId) => activeItems.filter(i => sameKey(i.goalId, goalId) && sameKey(i.goalTargetId, targetId)).length;

    // links: [{ targetIndex, itemIds }] -- the open tasks picked for the goal's linked target at that index (a milestone only).
    function syncItemLinks(goalId, links) {
        const goal = goals.active.find(g => sameKey(g.id, goalId));
        if (!goal) return;
        const touched = [];
        const linkedIds = new Set(goal.targets.filter(t => t.type === 'linked').map(t => String(t.id)));
        // A target that was dropped (or changed type) frees the tasks that wore it.
        activeItems.forEach((item) => {
            if (sameKey(item.goalId, goalId) && !linkedIds.has(String(item.goalTargetId))) clearItemLink(item);
        });
        (Array.isArray(links) ? links : []).forEach((link) => {
            const target = link && goal.targets[link.targetIndex];
            if (!target || target.type !== 'linked') return;
            const want = new Set((Array.isArray(link.itemIds) ? link.itemIds : []).map(String));
            activeItems.forEach((item) => {
                if (sameKey(item.goalId, goalId) && sameKey(item.goalTargetId, target.id) && !want.has(String(item.id))) clearItemLink(item);
            });
            want.forEach((idText) => {
                const item = activeItems.find(i => String(i.id) === idText);
                if (!item || !Goals.isLinkableTask(item)) return;
                const same = sameKey(item.goalId, goalId) && sameKey(item.goalTargetId, target.id);
                if (!same && item.goalId != null) touched.push({ goalId: item.goalId, targetId: item.goalTargetId }); // moved off another goal
                item.goalId = goal.id;
                item.goalTargetId = target.id;
            });
        });
        goal.targets.forEach((t) => { if (t.type === 'linked') touched.push({ goalId: goal.id, targetId: t.id }); });
        touched.forEach(p => { goals = Goals.setLinkedTotal(goals, p.goalId, p.targetId, liveLinkCount(p.goalId, p.targetId)); });
    }

    /** Frees every open task that counted toward this goal (it was deleted or retired). */
    function releaseItemLinks(goalId) {
        activeItems.forEach((item) => { if (sameKey(item.goalId, goalId)) clearItemLink(item); });
    }

    /** Adds a goal from the form into the next free slot. Returns { ok, goal } or { ok: false, reason: 'invalid' | 'full' }. */
    function addGoal(fields, links, now) {
        if (!goalsReady()) return { ok: false, reason: 'invalid' };
        const r = Goals.addGoal(goals, fields, goalSlotCount(), toMs(now), CONFIG.GOAL_WEEK_STARTS_ON);
        if (!r.ok) return { ok: false, reason: r.reason };
        goals = r.goals;
        syncItemLinks(r.goal.id, links);
        settleGoals(now, { noSave: true });
        saveGame();
        const goal = goals.active.find(g => g.id === r.goal.id) || r.goal;
        return { ok: true, goal };
    }

    /** Applies the Edit form (name, deadline, targets; kind and period stay). Returns { ok, goal } or { ok: false, reason }. */
    function editGoal(goalId, fields, links, now) {
        if (!goalsReady()) return { ok: false, reason: 'invalid' };
        const r = Goals.editGoal(goals, goalId, fields, toMs(now), CONFIG.GOAL_WEEK_STARTS_ON);
        if (!r.ok) return { ok: false, reason: r.reason };
        goals = r.goals;
        syncItemLinks(r.goal.id, links);
        settleGoals(now, { noSave: true });
        saveGame();
        return { ok: true, goal: goals.active.find(g => g.id === r.goal.id) || r.goal };
    }

    /** What the linked-target picker offers: open one-off tasks, Build Habits (not archived) and routines. */
    function getGoalLinkOptions() {
        const tasks = activeItems.filter(Goals.isLinkableTask).map(i => ({
            id: i.id,
            name: i.name,
            dueDateTime: i.dueDateTime || null,
            goalId: i.goalId != null ? i.goalId : null,
            goalTargetId: i.goalTargetId != null ? i.goalTargetId : null,
        }));
        const habits = (definedHabits || []).filter(h => h && !h.archivedAt && h.isNegative !== true).map(h => ({ id: h.id, name: h.name }));
        const routines = (definedRoutines || []).filter(Boolean).map(r => ({ id: r.id, name: r.name }));
        return { tasks, habits, routines };
    }

    /** { [targetId]: [item ids] } -- the open tasks that currently count toward each of this goal's targets (for the Edit form). */
    function getGoalLinkedItemIds(goalId) {
        const out = {};
        activeItems.forEach((i) => {
            if (sameKey(i.goalId, goalId) && i.goalTargetId != null) (out[i.goalTargetId] = out[i.goalTargetId] || []).push(i.id);
        });
        return out;
    }

    /** The player retires a goal: it moves to the roster of finished goals. Returns the roster record, or null. */
    function retireGoal(goalId, now) {
        if (!goalsReady()) return null;
        const r = Goals.retireGoal(goals, goalId, toMs(now), daysSurvived, CONFIG.GOAL_ROSTER_KEEP);
        if (!r.record) return null;
        goals = r.goals;
        releaseItemLinks(goalId);
        saveGame();
        return r.record;
    }

    /** The player deletes a goal outright (no roster entry). Returns true when one was removed. */
    function deleteGoal(goalId) {
        if (!goalsReady()) return false;
        const next = Goals.removeGoal(goals, goalId);
        if (next === goals) return false;
        goals = next;
        releaseItemLinks(goalId);
        saveGame();
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
        getBestRoutineSlots, setBestRoutineSlots, slotsForLevel,
        getPlayerInventory, setPlayerInventory,
        getSickDayDate, setSickDayDate,
        getPushbackUses, setPushbackUses,
        getAnytimeCreditUses, setAnytimeCreditUses,
        getPriorityMarks, setPriorityMarks,
        getGoals, setGoals, goalSlotCount, syncGoalSlots, ensureGoalsSeeded, settleGoals, applyGoalCompletion, closeGoalPeriods,
        getGoalViews, getGoalSlotInfo, updateGoalTarget, retireGoal, deleteGoal, takeGoalEvents,
        addGoal, editGoal, getGoalLinkOptions, getGoalLinkedItemIds,
        getCurrentRunStats, setCurrentRunStats,
        getRunHistory, setRunHistory,
        getLifetimeStats, setLifetimeStats,
        getToday, setToday, ensureToday, bumpToday, adjustDayTimer, updateDayGoalActual, closeDailyRecord,
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
