/**
 * Loop tests (Milestone 2 extraction session 12, 2026-07-18).
 *
 * js/loop.js references the global CONFIG (loaded before it via <script> tags
 * in the browser). In Node we bind that global from the real module before
 * requiring loop.js, then exercise the real module directly through a fake
 * deps bag — same approach as damage.test.js, not a hand-maintained mirror.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js'); // [P2-GAME-010] Stage 1, session 60 — loop.js reads Clock as a bare global
const Loop = require('../js/loop.js');

const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;
const DMG = CONFIG.OVERDUE_DAMAGE;

// Minimal classList shim (Set-backed) so urgency-tier class add/remove is
// assertable without a real DOM ([P2-GAME-010] Stage 1, session 60).
function fakeEl() {
    const classes = new Set();
    return {
        style: {},
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            contains: (c) => classes.has(c),
            _classes: classes,
        },
    };
}

function makeItem(overrides = {}) {
    return {
        id: 1,
        isOverdue: false,
        dueDateTime: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
        lastDamageTickTime: 0,
        x: 0,
        element: fakeEl(),
        ...overrides,
    };
}

function makeDeps(overrides = {}) {
    const state = {
        gameIsOver: false,
        offlineCatchUpActive: false,
        timePreviewActive: false,
        activeItems: [],
        lastLoopTickMs: null,
        lastRegenTickMs: null,
        lastAutosaveMs: 0,
        damageDealt: 0,
        healDealt: 0,
        gapCatchUps: 0,
        saves: 0,
        midnightUpdates: 0,
        overdueMarks: [],
        ...overrides.state,
    };

    const deps = {
        _state: state,
        isGameOver: () => state.gameIsOver,
        isOfflineCatchUpActive: () => state.offlineCatchUpActive,
        // Time slider, 2026-07-20 — REQUIRED, same contract as
        // isOfflineCatchUpActive above.
        isTimePreviewActive: () => state.timePreviewActive,
        activeItems: state.activeItems,
        baseWidth: 100,
        gameScreenWidth: 1200, // [P1-DATA-005] session 29 — lurker's far-right anchor
        getLastLoopTickMs: () => state.lastLoopTickMs,
        setLastLoopTickMs: (n) => { state.lastLoopTickMs = n; },
        getLastRegenTickMs: () => state.lastRegenTickMs,
        setLastRegenTickMs: (n) => { state.lastRegenTickMs = n; },
        getLastAutosaveMs: () => state.lastAutosaveMs,
        setLastAutosaveMs: (n) => { state.lastAutosaveMs = n; },
        markAsOverdue: (item, t) => {
            item.isOverdue = true;
            item.lastDamageTickTime = t.getTime();
            state.overdueMarks.push(item.id);
        },
        getSubTaskClusterOffset: () => 0,
        calculateTimelineXWithClustering: () => 500,
        damageBase: (n) => { state.damageDealt += n; },
        healBase: (n) => { state.healDealt += n; },
        updateMidnightLine: () => { state.midnightUpdates++; },
        runLiveGapCatchUp: () => { state.gapCatchUps++; },
        saveGame: () => { state.saves++; },
        // [P1-DATA-005] session 27 — matches Items.isNonThreatening
        isNonThreatening: (item) => item.type === 'habit' && item.isNegative === true,
        ...overrides.deps,
    };
    return deps;
}

function makeLurker(overrides = {}) {
    return makeItem({
        type: 'habit',
        isNegative: true,
        dueDateTime: new Date(Date.now() - 60 * 60 * 1000), // already "due" — must NOT go overdue
        isOverdue: false,
        ...overrides,
    });
}

describe('Loop.updateActiveItems', () => {
    test('no-op when game is over', () => {
        const deps = makeDeps({ state: { gameIsOver: true, activeItems: [makeItem()] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.midnightUpdates).toBe(0);
    });

    test('no-op while offline catch-up animation owns the board', () => {
        const deps = makeDeps({ state: { offlineCatchUpActive: true, activeItems: [makeItem()] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.midnightUpdates).toBe(0);
    });

    // Time slider, 2026-07-20 — same "one owner at a time" contract as the
    // offline catch-up test above.
    test('no-op while the time slider is being scrubbed', () => {
        const item = makeItem();
        const deps = makeDeps({ state: { timePreviewActive: true, activeItems: [item] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.midnightUpdates).toBe(0);
        expect(item.x).toBe(0); // untouched
    });

    test('calls the optional updateTimeSliderHandle hook when idle (not previewing)', () => {
        let synced = null;
        const deps = makeDeps({
            state: { activeItems: [makeItem()] },
            deps: { updateTimeSliderHandle: (t) => { synced = t; } },
        });
        Loop.updateActiveItems(deps);
        expect(synced).toBeInstanceOf(Date);
    });

    test('omitting updateTimeSliderHandle is a silent no-op', () => {
        const deps = makeDeps({ state: { activeItems: [makeItem()] } });
        expect(() => Loop.updateActiveItems(deps)).not.toThrow();
    });

    test('positions a future item on the timeline and syncs its element', () => {
        const item = makeItem();
        const deps = makeDeps({ state: { activeItems: [item] } });
        Loop.updateActiveItems(deps);
        expect(item.x).toBe(500);
        expect(item.element.style.left).toBe('500px');
        expect(item.isOverdue).toBe(false);
        expect(deps._state.midnightUpdates).toBe(1);
    });

    test('element.style.left is clamped to baseWidth', () => {
        const item = makeItem();
        const deps = makeDeps({
            state: { activeItems: [item] },
            deps: { calculateTimelineXWithClustering: () => 40 }, // < baseWidth 100
        });
        Loop.updateActiveItems(deps);
        expect(item.x).toBe(40);
        expect(item.element.style.left).toBe('100px');
    });

    test('item crossing its due time is parked at the base and marked overdue', () => {
        const item = makeItem({ dueDateTime: new Date(Date.now() - 1000) });
        const deps = makeDeps({ state: { activeItems: [item] } });
        Loop.updateActiveItems(deps);
        expect(item.isOverdue).toBe(true);
        expect(item.x).toBe(100); // baseWidth + 0 cluster offset
        expect(deps._state.overdueMarks).toEqual([1]);
    });

    // [P2-GAME-010] Stage 1, session 60
    describe('urgency-tier class wiring', () => {
        test('assigns urgency-urgent for an item due within 2 hours', () => {
            const item = makeItem({ dueDateTime: new Date(Date.now() + 60 * 60 * 1000) });
            const deps = makeDeps({ state: { activeItems: [item] } });
            Loop.updateActiveItems(deps);
            expect(item.urgencyTier).toBe('urgent');
            expect(item.element.classList.contains('urgency-urgent')).toBe(true);
        });

        test('assigns urgency-calm for an item due more than 4 hours out', () => {
            const item = makeItem({ dueDateTime: new Date(Date.now() + 6 * 60 * 60 * 1000) });
            const deps = makeDeps({ state: { activeItems: [item] } });
            Loop.updateActiveItems(deps);
            expect(item.urgencyTier).toBe('calm');
            expect(item.element.classList.contains('urgency-calm')).toBe(true);
        });

        test('swaps the class (not stacks) as the tier changes tick to tick', () => {
            const dueDateTime = new Date(Date.now() + 3 * 60 * 60 * 1000); // 'approaching'
            const item = makeItem({ dueDateTime });
            const deps = makeDeps({ state: { activeItems: [item] } });
            Loop.updateActiveItems(deps);
            expect(item.urgencyTier).toBe('approaching');
            expect(item.element.classList.contains('urgency-approaching')).toBe(true);

            // due date doesn't move, but "now" does — simulate crossing into 'urgent'
            // by rewriting dueDateTime relative to "now" at call time instead of
            // faking timers: 90 minutes out is within the 2h urgent band.
            item.dueDateTime = new Date(Date.now() + 90 * 60 * 1000);
            Loop.updateActiveItems(deps);
            expect(item.urgencyTier).toBe('urgent');
            expect(item.element.classList.contains('urgency-urgent')).toBe(true);
            expect(item.element.classList.contains('urgency-approaching')).toBe(false);
        });

        test('no urgency class churn on unchanged tier across repeated ticks', () => {
            const item = makeItem({ dueDateTime: new Date(Date.now() + 60 * 60 * 1000) });
            const deps = makeDeps({ state: { activeItems: [item] } });
            Loop.updateActiveItems(deps);
            const addSpy = jest.spyOn(item.element.classList, 'add');
            Loop.updateActiveItems(deps);
            expect(addSpy).not.toHaveBeenCalled();
        });

        // Clearing the urgency-tier class on the overdue transition is
        // markAsOverdue's job (js/items.js), not loop.js's — centralized
        // there because recomputeOverdueStateAfterEdit calls markAsOverdue
        // directly too, bypassing this module entirely (found live in
        // Chrome, session 60: an edit-triggered overdue transition left a
        // stale urgency class on the element when the clear lived only
        // here). This module's fake markAsOverdue collaborator intentionally
        // does NOT mimic that clearing — real coverage is in
        // items-lurker.test.js's markAsOverdue/recomputeOverdueStateAfterEdit
        // describe blocks, against the actual module.
        test('does not itself touch the urgency-tier class on the overdue transition — that is markAsOverdue\'s job', () => {
            const item = makeItem({ dueDateTime: new Date(Date.now() + 500) }); // about to cross over
            const deps = makeDeps({ state: { activeItems: [item] } });
            Loop.updateActiveItems(deps); // still future — gets a tier
            const tierBeforeOverdue = item.urgencyTier;
            expect(tierBeforeOverdue).not.toBeNull();
            item.dueDateTime = new Date(Date.now() - 1000); // now overdue
            Loop.updateActiveItems(deps);
            expect(item.isOverdue).toBe(true);
            // the fake markAsOverdue in this file's makeDeps() doesn't clear
            // it, so if it's STILL set that just confirms loop.js left the
            // field alone rather than clearing (or double-clearing) it itself
            expect(item.urgencyTier).toBe(tierBeforeOverdue);
        });
    });

    test('overdue item deals exactly one damage hit per elapsed interval tick', () => {
        const now = Date.now();
        const item = makeItem({
            isOverdue: true,
            lastDamageTickTime: now - INTERVAL - 10,
        });
        const deps = makeDeps({ state: { activeItems: [item] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.damageDealt).toBe(DMG);
        // tick time advanced by exactly one interval, not snapped to now
        expect(item.lastDamageTickTime).toBe(now - INTERVAL - 10 + INTERVAL);

        // run again immediately: within the same interval, no second hit
        Loop.updateActiveItems(deps);
        expect(deps._state.damageDealt).toBe(DMG);
    });

    // [P1-UI-006] sub-session 2, 2026-07-19 — routine health damage/KO
    test('a damage tick also calls the optional damageRoutineForItem collaborator with the item + amount', () => {
        const now = Date.now();
        const item = makeItem({ isOverdue: true, lastDamageTickTime: now - INTERVAL - 10 });
        const calls = [];
        const deps = makeDeps({
            state: { activeItems: [item] },
            deps: { damageRoutineForItem: (i, amt) => calls.push([i.id, amt]) },
        });
        Loop.updateActiveItems(deps);
        expect(calls).toEqual([[1, DMG]]);
    });

    test('damageRoutineForItem omitted -> no throw (existing "optional collaborator" precedent)', () => {
        const now = Date.now();
        const item = makeItem({ isOverdue: true, lastDamageTickTime: now - INTERVAL - 10 });
        const deps = makeDeps({ state: { activeItems: [item] } });
        expect(() => Loop.updateActiveItems(deps)).not.toThrow();
        expect(deps._state.damageDealt).toBe(DMG);
    });

    test('overdue item inside its interval deals no damage', () => {
        const item = makeItem({ isOverdue: true, lastDamageTickTime: Date.now() });
        const deps = makeDeps({ state: { activeItems: [item] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.damageDealt).toBe(0);
    });

    test('stops the damage sweep when a hit ends the game', () => {
        const past = Date.now() - INTERVAL - 10;
        const a = makeItem({ id: 1, isOverdue: true, lastDamageTickTime: past });
        const b = makeItem({ id: 2, isOverdue: true, lastDamageTickTime: past });
        const deps = makeDeps({ state: { activeItems: [a, b] } });
        deps.damageBase = (n) => {
            deps._state.damageDealt += n;
            deps._state.gameIsOver = true; // first hit kills the base
        };
        Loop.updateActiveItems(deps);
        expect(deps._state.damageDealt).toBe(DMG); // second item never charged
    });

    test('[P2-GAME-012] first call plants the regen clock without healing', () => {
        const deps = makeDeps({ state: { activeItems: [] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.healDealt).toBe(0);
        expect(typeof deps._state.lastRegenTickMs).toBe('number');
    });

    test('[P2-GAME-012] heals exactly one tick per elapsed regen interval', () => {
        const REGEN_INTERVAL = CONFIG.BASE_REGEN_INTERVAL_MS;
        const now = Date.now();
        const deps = makeDeps({
            state: { activeItems: [], lastRegenTickMs: now - REGEN_INTERVAL - 10 },
        });
        Loop.updateActiveItems(deps);
        expect(deps._state.healDealt).toBe(CONFIG.BASE_REGEN_HP);
        // clock advanced by exactly one interval, not snapped to now (remainder preserved)
        expect(deps._state.lastRegenTickMs).toBe(now - REGEN_INTERVAL - 10 + REGEN_INTERVAL);

        // run again immediately: within the same interval, no second heal
        Loop.updateActiveItems(deps);
        expect(deps._state.healDealt).toBe(CONFIG.BASE_REGEN_HP);
    });

    test('[P2-GAME-012] no regen tick before an elapsed interval', () => {
        const deps = makeDeps({ state: { activeItems: [], lastRegenTickMs: Date.now() } });
        Loop.updateActiveItems(deps);
        expect(deps._state.healDealt).toBe(0);
    });
});

describe('Loop.updateActiveItems — negative-habit lurker exclusion ([P1-DATA-005] session 27)', () => {
    test('a lurker past its due time is never marked overdue and takes no damage', () => {
        const lurker = makeLurker();
        const deps = makeDeps({ state: { activeItems: [lurker] } });
        Loop.updateActiveItems(deps);
        expect(lurker.isOverdue).toBe(false);
        expect(deps._state.overdueMarks).toEqual([]);
        expect(deps._state.damageDealt).toBe(0);
    });

    test('a lurker is positioned at gameScreenWidth - HABIT_ENEMY_WIDTH - NEGATIVE_LURK_RIGHT_MARGIN_PX (far right), not a timeline position', () => {
        const lurker = makeLurker();
        const deps = makeDeps({ state: { activeItems: [lurker] } });
        Loop.updateActiveItems(deps);
        const expectedX = deps.gameScreenWidth - CONFIG.HABIT_ENEMY_WIDTH - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX;
        expect(lurker.x).toBe(expectedX);
        expect(lurker.element.style.left).toBe(`${expectedX}px`);
        // never routed through the timeline calc, and not parked near the base
        expect(lurker.x).not.toBe(500); // the deps' calculateTimelineXWithClustering stub
        expect(lurker.x).toBeGreaterThan(deps.baseWidth);
    });

    test('an already-overdue lurker (edge case) still deals no damage and is left alone', () => {
        const lurker = makeLurker({ isOverdue: true, lastDamageTickTime: Date.now() - INTERVAL - 10 });
        const deps = makeDeps({ state: { activeItems: [lurker] } });
        Loop.updateActiveItems(deps);
        expect(deps._state.damageDealt).toBe(0);
    });

    test('a positive habit (isNegative: false) with the same shape is unaffected — normal overdue/damage applies', () => {
        const positiveHabit = makeItem({
            type: 'habit',
            isNegative: false,
            dueDateTime: new Date(Date.now() - 1000),
        });
        const deps = makeDeps({ state: { activeItems: [positiveHabit] } });
        Loop.updateActiveItems(deps);
        expect(positiveHabit.isOverdue).toBe(true);
        expect(deps._state.overdueMarks).toEqual([1]);
    });

    test('a task (type: task) is unaffected by the lurker exclusion even if isNegative were somehow set', () => {
        const item = makeItem({ isNegative: true, dueDateTime: new Date(Date.now() - 1000) }); // type defaults to undefined/'task'
        const deps = makeDeps({ state: { activeItems: [item] } });
        Loop.updateActiveItems(deps);
        expect(item.isOverdue).toBe(true); // isNonThreatening requires type === 'habit'
    });
});

describe('Loop.updateActiveItems — growing/shrinking parent visuals ([P1-DATA-004] sub-session 4, 2026-07-19)', () => {
    test('getParentRenderWidth omitted -> no-op (existing "optional collaborator" precedent)', () => {
        const item = makeItem({ type: 'task' });
        const deps = makeDeps({ state: { activeItems: [item] } });
        expect(() => Loop.updateActiveItems(deps)).not.toThrow();
        expect(item.element.style.width).toBeUndefined();
    });

    test('a top-level task gets its width set from the collaborator every tick', () => {
        const item = makeItem({ type: 'task' });
        const calls = [];
        const deps = makeDeps({
            state: { activeItems: [item] },
            deps: { getParentRenderWidth: (i) => { calls.push(i.id); return 166.4; } },
        });
        Loop.updateActiveItems(deps);
        expect(item.element.style.width).toBe('166.4px');
        expect(calls).toEqual([1]);
    });

    test('runs regardless of overdue state — a camped parent can still gain/lose subs', () => {
        const item = makeItem({ type: 'task', isOverdue: true, lastDamageTickTime: Date.now() });
        const deps = makeDeps({
            state: { activeItems: [item] },
            deps: { getParentRenderWidth: () => 147.2 },
        });
        Loop.updateActiveItems(deps);
        expect(item.element.style.width).toBe('147.2px');
    });

    test('a sub-task (parentId set) is excluded even if the collaborator is provided', () => {
        const sub = makeItem({ type: 'task', parentId: 1 });
        const calls = [];
        const deps = makeDeps({
            state: { activeItems: [sub] },
            deps: { getParentRenderWidth: (i) => { calls.push(i.id); return 999; } },
        });
        Loop.updateActiveItems(deps);
        expect(calls).toEqual([]);
        expect(sub.element.style.width).toBeUndefined();
    });

    test('a habit is excluded even if the collaborator is provided', () => {
        const habit = makeItem({ type: 'habit' });
        const calls = [];
        const deps = makeDeps({
            state: { activeItems: [habit] },
            deps: { getParentRenderWidth: (i) => { calls.push(i.id); return 999; } },
        });
        Loop.updateActiveItems(deps);
        expect(calls).toEqual([]);
        expect(habit.element.style.width).toBeUndefined();
    });

    test('an item with no rendered element is skipped safely (no throw)', () => {
        const item = makeItem({ type: 'task', element: null });
        const deps = makeDeps({
            state: { activeItems: [item] },
            deps: { getParentRenderWidth: () => 166.4 },
        });
        expect(() => Loop.updateActiveItems(deps)).not.toThrow();
    });
});

describe('Loop.updateGame', () => {
    test('no-op when game is over', () => {
        const deps = makeDeps({ state: { gameIsOver: true } });
        Loop.updateGame(deps);
        expect(deps._state.lastLoopTickMs).toBeNull();
        expect(deps._state.saves).toBe(0);
    });

    test('first tick records lastLoopTickMs without a gap catch-up', () => {
        const deps = makeDeps({ state: { lastAutosaveMs: Date.now() } });
        Loop.updateGame(deps);
        expect(deps._state.gapCatchUps).toBe(0);
        expect(typeof deps._state.lastLoopTickMs).toBe('number');
    });

    test('a suspended-loop gap routes through runLiveGapCatchUp', () => {
        const deps = makeDeps({
            state: {
                lastLoopTickMs: Date.now() - CONFIG.LIVE_GAP_THRESHOLD_MS - 1000,
                lastAutosaveMs: Date.now(),
            },
        });
        Loop.updateGame(deps);
        expect(deps._state.gapCatchUps).toBe(1);
    });

    test('bails after catch-up if the catch-up ended the run', () => {
        const deps = makeDeps({
            state: { lastLoopTickMs: Date.now() - CONFIG.LIVE_GAP_THRESHOLD_MS - 1000 },
        });
        deps.runLiveGapCatchUp = () => { deps._state.gameIsOver = true; };
        Loop.updateGame(deps);
        expect(deps._state.midnightUpdates).toBe(0); // updateActiveItems never ran
        expect(deps._state.saves).toBe(0);           // autosave never ran
    });

    test('autosaves once the autosave interval has elapsed, then re-arms', () => {
        const deps = makeDeps({ state: { lastAutosaveMs: 0 } });
        Loop.updateGame(deps);
        expect(deps._state.saves).toBe(1);
        expect(deps._state.lastAutosaveMs).toBeGreaterThan(0);

        // immediately again: inside the fresh window, no save
        Loop.updateGame(deps);
        expect(deps._state.saves).toBe(1);
    });

    // Day-advance, LIVE mid-session rollover (2026-07-20) — State.checkLiveDayRollover
    // is an OPTIONAL collaborator, same tolerance as checkDayPagerRollover.
    describe('checkLiveDayRollover / checkDayPagerRollover optional collaborators', () => {
        test('omitting both is a silent no-op', () => {
            const deps = makeDeps({ state: { lastAutosaveMs: Date.now() } });
            expect(() => Loop.updateGame(deps)).not.toThrow();
        });

        test('checkLiveDayRollover is called even when the game is over (it must guard isGameOver itself)', () => {
            let calls = 0;
            const deps = makeDeps({
                state: { gameIsOver: true },
                deps: { checkLiveDayRollover: () => { calls++; } },
            });
            Loop.updateGame(deps);
            expect(calls).toBe(1);
        });

        test('both checkDayPagerRollover and checkLiveDayRollover run before the isGameOver early return', () => {
            const order = [];
            const deps = makeDeps({
                state: { gameIsOver: true },
                deps: {
                    checkDayPagerRollover: () => order.push('pager'),
                    checkLiveDayRollover: () => order.push('day'),
                },
            });
            Loop.updateGame(deps);
            expect(order).toEqual(['pager', 'day']);
        });

        test('checkLiveDayRollover runs on a normal (not game-over) tick too', () => {
            let calls = 0;
            const deps = makeDeps({
                state: { lastAutosaveMs: Date.now() },
                deps: { checkLiveDayRollover: () => { calls++; } },
            });
            Loop.updateGame(deps);
            expect(calls).toBe(1);
        });
    });
});
