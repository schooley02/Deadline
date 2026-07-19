/**
 * Loop tests (Milestone 2 extraction session 12, 2026-07-18).
 *
 * js/loop.js references the global CONFIG (loaded before it via <script> tags
 * in the browser). In Node we bind that global from the real module before
 * requiring loop.js, then exercise the real module directly through a fake
 * deps bag — same approach as damage.test.js, not a hand-maintained mirror.
 */
global.CONFIG = require('../js/config.js');
const Loop = require('../js/loop.js');

const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;
const DMG = CONFIG.OVERDUE_DAMAGE;

function fakeEl() {
    return { style: {} };
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
        activeItems: state.activeItems,
        baseWidth: 100,
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
        ...overrides.deps,
    };
    return deps;
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
});
