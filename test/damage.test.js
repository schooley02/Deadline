/**
 * Damage tests (Milestone 2 extraction #3, 2026-07-18).
 *
 * js/damage.js references the global CONFIG (loaded before it via <script> tags
 * in the browser). In Node we bind that global from the real module before
 * requiring damage.js, then exercise the real module directly — same approach
 * as clock/movement/spawning, not a hand-maintained mirror.
 *
 * The DOM-free "pure core" functions are tested directly. The stateful ones
 * (damageBase/gameOver/applyOfflineDamage/runLiveGapCatchUp) are driven through
 * a fake deps bag, which is exactly why the deps-object pattern exists.
 */
global.CONFIG = require('../js/config.js');
const Damage = require('../js/damage.js');

const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;   // 5 min
const CAP = CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM; // 12
const DMG = CONFIG.OVERDUE_DAMAGE;            // 1

// --- fake DOM element -------------------------------------------------------
function fakeEl() {
    const classes = new Set();
    return {
        style: {},
        textContent: '',
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            has: (c) => classes.has(c),
        },
        _classes: classes,
    };
}

// A deps bag backed by a plain state object, so tests can assert on state.
function makeDeps(overrides = {}) {
    const state = {
        baseHealth: 100,
        gameIsOver: false,
        activeItems: [],
        runStartedAtMs: Date.now(),
        daysSurvived: 0,
        offlineCatchUpActive: false,
        saves: 0,
        formControls: [],
        ...overrides.state,
    };

    const deps = {
        _state: state,
        getBaseHealth: () => state.baseHealth,
        setBaseHealth: (n) => { state.baseHealth = n; },
        isGameOver: () => state.gameIsOver,
        setGameOver: () => { state.gameIsOver = true; },
        getActiveItems: () => state.activeItems,
        getRunStartedAtMs: () => state.runStartedAtMs,
        setDaysSurvived: (n) => { state.daysSurvived = n; },
        setOfflineCatchUpActive: (v) => { state.offlineCatchUpActive = v; },
        getGameLoopInterval: () => null,
        baseWidth: 100,
        gameScreenWidth: 1200, // [P1-DATA-005] session 29 — lurker's far-right anchor
        baseElement: fakeEl(),
        baseHealthDisplay: fakeEl(),
        gameOverMessage: fakeEl(),
        restartButton: fakeEl(),
        markAsOverdue: (item) => {
            item.isOverdue = true;
            item.lastDamageTickTime = item.dueDateTime.getTime();
        },
        getSubTaskClusterOffset: () => 0,
        calculateTimelineXWithClustering: () => 500,
        enableFormControls: (v) => { state.formControls.push(v); },
        saveGame: () => { state.saves++; },
        ...overrides.deps,
    };
    return deps;
}

function item(props = {}) {
    return {
        dueDateTime: new Date(Date.now() - INTERVAL),
        lastDamageTickTime: Date.now() - INTERVAL,
        isOverdue: true,
        offlineDamageCharged: 0,
        x: 0,
        ...props,
    };
}

// ---------------------------------------------------------------------------
describe('computeDaysSurvived', () => {
    const DAY = CONFIG.MS_PER_REAL_DAY;

    test('returns 0 when the run has no start time', () => {
        expect(Damage.computeDaysSurvived(null, Date.now(), DAY)).toBe(0);
        expect(Damage.computeDaysSurvived(0, Date.now(), DAY)).toBe(0);
    });

    test('floors to whole real days', () => {
        const start = 1_000_000;
        expect(Damage.computeDaysSurvived(start, start, DAY)).toBe(0);
        expect(Damage.computeDaysSurvived(start, start + DAY - 1, DAY)).toBe(0);
        expect(Damage.computeDaysSurvived(start, start + DAY, DAY)).toBe(1);
        expect(Damage.computeDaysSurvived(start, start + 3 * DAY + 5, DAY)).toBe(3);
    });

    test('never goes negative if the clock moved backwards', () => {
        expect(Damage.computeDaysSurvived(2 * DAY, DAY, DAY)).toBe(0);
    });

    test('22 minutes of runtime is 0 days, not 22 (the 2026-07-18 bug)', () => {
        const start = 1_000_000;
        expect(Damage.computeDaysSurvived(start, start + 22 * 60 * 1000, DAY)).toBe(0);
    });

    test('defaults to CONFIG.MS_PER_REAL_DAY when no period is passed', () => {
        const start = 1_000_000;
        expect(Damage.computeDaysSurvived(start, start + DAY)).toBe(1);
    });
});

// ---------------------------------------------------------------------------
describe('resolveBaseImage', () => {
    test.each([
        [100, 'base_100.png'],
        [76, 'base_100.png'],
        [75, 'base_075.png'],
        [51, 'base_075.png'],
        [50, 'base_050.png'],
        [26, 'base_050.png'],
        [25, 'base_025.png'],
        [1, 'base_025.png'],
        [0, 'base_000.png'],
    ])('health %i -> %s', (hp, img) => {
        expect(Damage.resolveBaseImage(hp)).toBe(img);
    });
});

// ---------------------------------------------------------------------------
describe('[P2-GAME-012] computeRegenTicks', () => {
    const REGEN_INTERVAL = CONFIG.BASE_REGEN_INTERVAL_MS;

    test('zero or negative elapsed time regens nothing', () => {
        expect(Damage.computeRegenTicks(0, REGEN_INTERVAL)).toBe(0);
        expect(Damage.computeRegenTicks(-1000, REGEN_INTERVAL)).toBe(0);
    });

    test('floors partial intervals', () => {
        expect(Damage.computeRegenTicks(REGEN_INTERVAL - 1, REGEN_INTERVAL)).toBe(0);
        expect(Damage.computeRegenTicks(REGEN_INTERVAL, REGEN_INTERVAL)).toBe(1);
        expect(Damage.computeRegenTicks(REGEN_INTERVAL * 3.9, REGEN_INTERVAL)).toBe(3);
    });
});

// ---------------------------------------------------------------------------
describe('[P2-GAME-012] healBase', () => {
    test('heals by the given amount', () => {
        const deps = makeDeps({ state: { baseHealth: 50 } });
        Damage.healBase(10, deps);
        expect(deps._state.baseHealth).toBe(60);
    });

    test('clamps at MAX_BASE_HEALTH', () => {
        const deps = makeDeps({ state: { baseHealth: 95 } });
        Damage.healBase(10, deps);
        expect(deps._state.baseHealth).toBe(CONFIG.MAX_BASE_HEALTH);
    });

    test('no-ops once the game is over', () => {
        const deps = makeDeps({ state: { baseHealth: 50, gameIsOver: true } });
        Damage.healBase(10, deps);
        expect(deps._state.baseHealth).toBe(50);
    });

    test('no-ops on a zero or negative amount', () => {
        const deps = makeDeps({ state: { baseHealth: 50 } });
        Damage.healBase(0, deps);
        Damage.healBase(-5, deps);
        expect(deps._state.baseHealth).toBe(50);
    });

    test('saves and updates the display', () => {
        const deps = makeDeps({ state: { baseHealth: 50 } });
        Damage.healBase(10, deps);
        expect(deps._state.saves).toBe(1);
        expect(deps.baseHealthDisplay.textContent).toBe(60);
    });
});

// ---------------------------------------------------------------------------
describe('computeOfflineOverdueDamage', () => {
    const now = 10_000_000;

    test('nothing owed when the item is not yet due', () => {
        expect(Damage.computeOfflineOverdueDamage(now + INTERVAL, now, 10 * INTERVAL, 0)).toBe(0);
    });

    test('nothing owed for a zero-length offline window', () => {
        expect(Damage.computeOfflineOverdueDamage(now - INTERVAL, now, 0, 0)).toBe(0);
    });

    test('charges one tick per whole interval spent overdue', () => {
        expect(Damage.computeOfflineOverdueDamage(now - 3 * INTERVAL, now, 10 * INTERVAL, 0))
            .toBe(3 * DMG);
    });

    test('window starts at the due time, not the start of the offline window', () => {
        // Away 10 intervals, but only became due 2 intervals ago.
        expect(Damage.computeOfflineOverdueDamage(now - 2 * INTERVAL, now, 10 * INTERVAL, 0))
            .toBe(2 * DMG);
    });

    test('window starts at the offline-window edge for an item overdue before the save', () => {
        // Due 100 intervals ago but only away 4 — the earlier 96 were charged live.
        expect(Damage.computeOfflineOverdueDamage(now - 100 * INTERVAL, now, 4 * INTERVAL, 0))
            .toBe(4 * DMG);
    });

    test('caps at OFFLINE_DAMAGE_CAP_PER_ITEM', () => {
        expect(Damage.computeOfflineOverdueDamage(now - 1000 * INTERVAL, now, 1000 * INTERVAL, 0))
            .toBe(CAP);
    });

    test('cap is a LIFETIME budget — already-charged damage reduces what is owed', () => {
        expect(Damage.computeOfflineOverdueDamage(now - 1000 * INTERVAL, now, 1000 * INTERVAL, CAP - 3))
            .toBe(3);
        expect(Damage.computeOfflineOverdueDamage(now - 1000 * INTERVAL, now, 1000 * INTERVAL, CAP))
            .toBe(0);
    });

    test('partial intervals are floored, not rounded', () => {
        expect(Damage.computeOfflineOverdueDamage(now - (INTERVAL - 1), now, 10 * INTERVAL, 0)).toBe(0);
    });
});

// ---------------------------------------------------------------------------
describe('computeGapCatchUpHits', () => {
    test('ignores items that are not yet due', () => {
        const it = item({ dueDateTime: new Date(Date.now() + 60_000), isOverdue: false });
        const { hits, newlyOverdue } = Damage.computeGapCatchUpHits([it], Date.now());
        expect(hits).toEqual([]);
        expect(newlyOverdue).toEqual([]);
    });

    test('marks items that fell due during the gap', () => {
        const now = Date.now();
        const it = item({
            dueDateTime: new Date(now - 3 * INTERVAL),
            isOverdue: false,
            lastDamageTickTime: null,
        });
        const marked = [];
        const { newlyOverdue } = Damage.computeGapCatchUpHits([it], now, (i) => {
            marked.push(i);
            i.isOverdue = true;
            i.lastDamageTickTime = i.dueDateTime.getTime();
        });
        expect(newlyOverdue).toEqual([it]);
        expect(marked).toEqual([it]);
    });

    test('charges one hit per whole pending interval', () => {
        const now = Date.now();
        const it = item({ lastDamageTickTime: now - 4 * INTERVAL });
        const { hits } = Damage.computeGapCatchUpHits([it], now);
        expect(hits).toHaveLength(1);
        expect(hits[0].dmg).toBe(4 * DMG);
    });

    test('advances the damage clock by WHOLE intervals, keeping the remainder', () => {
        const now = Date.now();
        const remainder = 1234;
        const it = item({ lastDamageTickTime: now - (4 * INTERVAL + remainder) });
        Damage.computeGapCatchUpHits([it], now);
        expect(now - it.lastDamageTickTime).toBe(remainder);
    });

    test('a sub-interval gap charges nothing and does not move the clock', () => {
        const now = Date.now();
        const before = now - 1000;
        const it = item({ lastDamageTickTime: before });
        const { hits } = Damage.computeGapCatchUpHits([it], now);
        expect(hits).toEqual([]);
        expect(it.lastDamageTickTime).toBe(before);
    });

    test('backgrounding is not a damage-evasion loophole: many small windows still accrue', () => {
        // A tab waking once a minute for 10 minutes charges the same 2 ticks
        // that one 10-minute gap would, because ticks come from the damage
        // clock rather than from the wake window.
        const t0 = 10_000_000;
        // dueDateTime must share t0's time base, or the not-yet-due guard fires.
        const it = item({ dueDateTime: new Date(t0), lastDamageTickTime: t0 });
        let total = 0;
        for (let m = 1; m <= 10; m++) {
            const { hits } = Damage.computeGapCatchUpHits([it], t0 + m * 60_000);
            total += hits.reduce((s, h) => s + h.dmg, 0);
        }
        expect(total).toBe(2 * DMG); // 10 min / 5 min interval
    });

    test('respects the lifetime cap via offlineDamageCharged', () => {
        const now = Date.now();
        const it = item({
            lastDamageTickTime: now - 1000 * INTERVAL,
            offlineDamageCharged: CAP - 2,
        });
        const { hits } = Damage.computeGapCatchUpHits([it], now);
        expect(hits[0].dmg).toBe(2);
    });

    test('an item already at its cap produces no hit', () => {
        const now = Date.now();
        const it = item({ lastDamageTickTime: now - 1000 * INTERVAL, offlineDamageCharged: CAP });
        const { hits } = Damage.computeGapCatchUpHits([it], now);
        expect(hits).toEqual([]);
    });

    test('a 10-hour sleep with one overdue item costs at most the cap', () => {
        const now = Date.now();
        const it = item({ lastDamageTickTime: now - 10 * 60 * 60 * 1000 });
        const { hits } = Damage.computeGapCatchUpHits([it], now);
        expect(hits[0].dmg).toBe(CAP);
        expect(hits[0].dmg).toBeLessThan(100); // would have been ~120 before the fix
    });

    // [P1-DATA-005] session 27 — negative-habit lurkers never accrue
    // catch-up damage or get marked overdue for a background/sleep gap.
    describe('negative-habit lurker exclusion', () => {
        const lurker = (props = {}) => item({
            type: 'habit',
            isNegative: true,
            dueDateTime: new Date(Date.now() - 10 * 60 * 60 * 1000),
            isOverdue: false,
            lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000,
            ...props,
        });

        test('a lurker produces no hits and is never marked, using the default (no isNonThreatening arg) fallback', () => {
            const it = lurker();
            const marked = [];
            const { hits, newlyOverdue } = Damage.computeGapCatchUpHits([it], Date.now(), (i) => marked.push(i));
            expect(hits).toEqual([]);
            expect(newlyOverdue).toEqual([]);
            expect(marked).toEqual([]);
        });

        test('a lurker produces no hits with an explicit isNonThreatening collaborator', () => {
            const it = lurker();
            const isNonThreatening = (i) => i.type === 'habit' && i.isNegative === true;
            const { hits } = Damage.computeGapCatchUpHits([it], Date.now(), undefined, isNonThreatening);
            expect(hits).toEqual([]);
        });

        test('a positive habit alongside a lurker is unaffected', () => {
            const negItem = lurker({ dueDateTime: new Date(Date.now() - 10 * 60 * 60 * 1000) });
            const posItem = item({
                type: 'habit', isNegative: false,
                lastDamageTickTime: Date.now() - 4 * INTERVAL,
            });
            const { hits } = Damage.computeGapCatchUpHits([negItem, posItem], Date.now());
            expect(hits).toHaveLength(1);
            expect(hits[0].item).toBe(posItem);
        });
    });
});

// ---------------------------------------------------------------------------
describe('computeCatchUpDuration', () => {
    test('never shorter than the minimum', () => {
        expect(Damage.computeCatchUpDuration(1)).toBe(CONFIG.OFFLINE_CATCHUP_MIN_MS);
    });
    test('never longer than the 5s spec maximum', () => {
        expect(Damage.computeCatchUpDuration(1000)).toBe(CONFIG.OFFLINE_CATCHUP_MAX_MS);
    });
    test('scales with item count in between', () => {
        const n = 8;
        expect(Damage.computeCatchUpDuration(n)).toBe(n * CONFIG.OFFLINE_CATCHUP_MS_PER_ITEM);
    });
});

// ---------------------------------------------------------------------------
describe('damageBase', () => {
    test('subtracts health, updates the display and saves', () => {
        const deps = makeDeps();
        Damage.damageBase(7, deps);
        expect(deps._state.baseHealth).toBe(93);
        expect(deps.baseHealthDisplay.textContent).toBe(93);
        expect(deps._state.saves).toBeGreaterThan(0);
    });

    test('clamps health at zero', () => {
        const deps = makeDeps({ state: { baseHealth: 3 } });
        Damage.damageBase(50, deps);
        expect(deps._state.baseHealth).toBe(0);
    });

    test('is a no-op once the game is over', () => {
        const deps = makeDeps({ state: { baseHealth: 50, gameIsOver: true } });
        Damage.damageBase(10, deps);
        expect(deps._state.baseHealth).toBe(50);
    });

    test('updates the base sprite as health drops', () => {
        const deps = makeDeps();
        Damage.damageBase(60, deps); // -> 40
        expect(deps.baseElement.style.backgroundImage).toBe('url("base_050.png")');
    });

    test('triggers game over at zero health', () => {
        const deps = makeDeps({ state: { baseHealth: 2 } });
        Damage.damageBase(2, deps);
        expect(deps._state.gameIsOver).toBe(true);
        expect(deps.gameOverMessage.textContent).toMatch(/GAME OVER/);
    });
});

// ---------------------------------------------------------------------------
describe('gameOver', () => {
    test('sets the flag, freezes days survived and disables the forms', () => {
        const start = Date.now() - 3 * CONFIG.MS_PER_REAL_DAY;
        const deps = makeDeps({ state: { runStartedAtMs: start } });
        Damage.gameOver(deps);
        expect(deps._state.gameIsOver).toBe(true);
        expect(deps._state.daysSurvived).toBe(3);
        expect(deps._state.formControls).toContain(false);
    });

    test('pluralises the day label correctly', () => {
        const one = makeDeps({ state: { runStartedAtMs: Date.now() - CONFIG.MS_PER_REAL_DAY } });
        Damage.gameOver(one);
        expect(one.gameOverMessage.textContent).toBe('GAME OVER! Your Base Survived 1 Day.');

        const zero = makeDeps({ state: { runStartedAtMs: Date.now() } });
        Damage.gameOver(zero);
        expect(zero.gameOverMessage.textContent).toBe('GAME OVER! Your Base Survived 0 Days.');
    });

    test('shows the restart button and the destroyed base', () => {
        const deps = makeDeps();
        Damage.gameOver(deps);
        expect(deps.restartButton._classes.has('hidden')).toBe(false);
        expect(deps.baseElement.style.backgroundImage).toBe("url('base_000.png')");
    });
});

// ---------------------------------------------------------------------------
describe('applyOfflineDamage', () => {
    test('charges each hit and accumulates offlineDamageCharged', () => {
        const a = item();
        const b = item({ offlineDamageCharged: 2 });
        const deps = makeDeps();
        Damage.applyOfflineDamage([{ item: a, dmg: 3 }, { item: b, dmg: 4 }], deps);
        expect(a.offlineDamageCharged).toBe(3);
        expect(b.offlineDamageCharged).toBe(6);
        expect(deps._state.baseHealth).toBe(100 - 7);
    });

    test('stops charging once the base dies mid-list', () => {
        const a = item();
        const b = item();
        const deps = makeDeps({ state: { baseHealth: 5 } });
        Damage.applyOfflineDamage([{ item: a, dmg: 5 }, { item: b, dmg: 5 }], deps);
        expect(deps._state.baseHealth).toBe(0);
        expect(b.offlineDamageCharged).toBe(0); // never charged
    });

    // [P1-UI-006] sub-session 2, 2026-07-19 — routine health damage/KO,
    // shared by both offline catch-up and live-gap catch-up (both funnel
    // through this function).
    test('calls the optional damageRoutineForItem collaborator per hit, with the item + its dmg', () => {
        const a = item();
        const b = item();
        const calls = [];
        const deps = makeDeps({ deps: { damageRoutineForItem: (i, amt) => calls.push([i, amt]) } });
        Damage.applyOfflineDamage([{ item: a, dmg: 3 }, { item: b, dmg: 4 }], deps);
        expect(calls).toEqual([[a, 3], [b, 4]]);
    });

    test('damageRoutineForItem omitted -> no throw (existing "optional collaborator" precedent)', () => {
        const a = item();
        const deps = makeDeps();
        expect(() => Damage.applyOfflineDamage([{ item: a, dmg: 3 }], deps)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
describe('runLiveGapCatchUp', () => {
    test('a 10-hour sleep with one overdue item costs the cap, not the whole gap', () => {
        const it = item({ lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000 });
        const deps = makeDeps({ state: { activeItems: [it] } });
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(100 - CAP);
    });

    test('breadth still hurts: three neglected items cost three caps', () => {
        const items = [0, 1, 2].map(() => item({ lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000 }));
        const deps = makeDeps({ state: { activeItems: items } });
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(100 - 3 * CAP);
    });

    test('marks and positions an item that fell due during the gap', () => {
        const el = fakeEl();
        const it = item({
            dueDateTime: new Date(Date.now() - 2 * INTERVAL),
            isOverdue: false,
            lastDamageTickTime: null,
            element: el,
        });
        const deps = makeDeps({
            state: { activeItems: [it] },
            deps: { getSubTaskClusterOffset: () => 12 },
        });
        Damage.runLiveGapCatchUp(deps);
        expect(it.isOverdue).toBe(true);
        expect(it.x).toBe(112); // baseWidth 100 + cluster offset 12
        expect(el.style.left).toBe('112px');
        expect(deps._state.baseHealth).toBe(100 - 2 * DMG);
    });

    test('is a no-op once the game is over', () => {
        const it = item({ lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000 });
        const deps = makeDeps({ state: { activeItems: [it], gameIsOver: true, baseHealth: 40 } });
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(40);
    });

    test('repeated gaps cannot exceed the per-item lifetime cap', () => {
        const it = item({ lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000 });
        const deps = makeDeps({ state: { activeItems: [it] } });
        Damage.runLiveGapCatchUp(deps);
        it.lastDamageTickTime = Date.now() - 10 * 60 * 60 * 1000; // sleep again
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(100 - CAP);
    });

    test('[P2-GAME-012] with no getLastRegenTickMs threaded through, no regen happens (guarded)', () => {
        // Mirrors production script.js always threading it — this just proves
        // the guard doesn't crash deps bags that omit it (e.g. older tests).
        const it = item({ lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000, offlineDamageCharged: CAP });
        const deps = makeDeps({ state: { activeItems: [it] } }); // no damage owed, cap already spent
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(100);
    });

    test('[P2-GAME-012] heals for the gap since the last regen tick, after damage', () => {
        const now = Date.now();
        const it = item({ lastDamageTickTime: now - 10 * 60 * 60 * 1000, offlineDamageCharged: CAP }); // no damage owed
        const lastRegen = now - 3 * CONFIG.BASE_REGEN_INTERVAL_MS;
        const deps = makeDeps({
            state: { activeItems: [it], baseHealth: 50, lastRegenTickMs: lastRegen },
            deps: {
                getLastRegenTickMs: () => deps._state.lastRegenTickMs,
                setLastRegenTickMs: (n) => { deps._state.lastRegenTickMs = n; },
            },
        });
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(50 + 3 * CONFIG.BASE_REGEN_HP);
    });

    // [P1-DATA-005] session 27 — a negative-habit lurker takes no damage
    // for a suspended-loop gap, whether or not deps threads isNonThreatening.
    test('a lurker takes no damage across a 10-hour suspended-loop gap (default fallback)', () => {
        const lurker = item({
            type: 'habit', isNegative: true,
            lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000,
        });
        const deps = makeDeps({ state: { activeItems: [lurker] } });
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(100);
    });

    test('a lurker takes no damage with isNonThreatening explicitly threaded via deps', () => {
        const lurker = item({
            type: 'habit', isNegative: true,
            lastDamageTickTime: Date.now() - 10 * 60 * 60 * 1000,
        });
        const deps = makeDeps({
            state: { activeItems: [lurker] },
            deps: { isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true },
        });
        Damage.runLiveGapCatchUp(deps);
        expect(deps._state.baseHealth).toBe(100);
    });
});

// ---------------------------------------------------------------------------
describe('runOfflineCatchUp', () => {
    test('a sub-tick absence owes nothing', () => {
        // Note: OFFLINE_ANIMATION_THRESHOLD_MS (30s) is far below
        // DAMAGE_INTERVAL_MS (5min), so any absence short enough to skip the
        // animation is also too short to have accrued a single tick.
        const it = item({ dueDateTime: new Date(Date.now() - 3 * INTERVAL), element: fakeEl() });
        const deps = makeDeps({ state: { activeItems: [it] } });
        Damage.runOfflineCatchUp([{ item: it, savedX: 400 }], 1000, deps);
        expect(deps._state.baseHealth).toBe(100);
        expect(deps._state.offlineCatchUpActive).toBe(false);
    });

    test('applies damage instantly when nothing needs animating', () => {
        // Long absence, but the item has no element to animate → the
        // instant-apply branch runs and the capped damage lands immediately.
        // Started below max so the [P2-GAME-012] regen this same offline
        // window now grants (10 whole BASE_REGEN_INTERVAL_MS ticks, applied
        // AFTER damage) is actually visible rather than clamped away.
        const it = item({ dueDateTime: new Date(Date.now() - 3 * INTERVAL), element: null });
        const deps = makeDeps({ state: { activeItems: [it], baseHealth: 50 } });
        Damage.runOfflineCatchUp([{ item: it, savedX: null }], 10 * INTERVAL, deps);
        expect(deps._state.baseHealth).toBe(50 - 3 * DMG + 10 * CONFIG.BASE_REGEN_HP);
        expect(deps._state.offlineCatchUpActive).toBe(false);
    });

    test('[P2-GAME-012] regen clamps at MAX_BASE_HEALTH even after a long absence', () => {
        const it = item({ dueDateTime: new Date(Date.now() - 3 * INTERVAL), element: null });
        const deps = makeDeps({ state: { activeItems: [it] } }); // starts at 100
        Damage.runOfflineCatchUp([{ item: it, savedX: null }], 10 * INTERVAL, deps);
        expect(deps._state.baseHealth).toBe(CONFIG.MAX_BASE_HEALTH);
    });

    test('[P2-GAME-012] resets the live regen clock to now after applying', () => {
        const it = item({ dueDateTime: new Date(Date.now() - 3 * INTERVAL), element: null });
        const before = Date.now();
        const deps = makeDeps({
            state: { activeItems: [it], lastRegenTickMs: null },
            deps: {
                getLastRegenTickMs: () => deps._state.lastRegenTickMs,
                setLastRegenTickMs: (n) => { deps._state.lastRegenTickMs = n; },
            },
        });
        Damage.runOfflineCatchUp([{ item: it, savedX: null }], 10 * INTERVAL, deps);
        expect(deps._state.lastRegenTickMs).toBeGreaterThanOrEqual(before);
    });

    test('[P2-GAME-012] a sub-interval absence heals nothing', () => {
        const it = item({ dueDateTime: new Date(Date.now() - 3 * INTERVAL), element: null });
        const deps = makeDeps({ state: { activeItems: [it], baseHealth: 50 } });
        // offline long enough to skip the animation threshold, short of one regen interval
        Damage.runOfflineCatchUp([{ item: it, savedX: null }], CONFIG.OFFLINE_ANIMATION_THRESHOLD_MS + 1, deps);
        expect(deps._state.baseHealth).toBe(50); // item not yet due long enough to owe damage either
    });

    test('overdue items keep their existing x; others move to the timeline position', () => {
        const overdueItem = item({ isOverdue: true, x: 100, element: fakeEl() });
        const futureItem = item({
            dueDateTime: new Date(Date.now() + 60 * 60 * 1000),
            isOverdue: false,
            x: 0,
            element: fakeEl(),
        });
        const deps = makeDeps({ state: { activeItems: [overdueItem, futureItem] } });
        Damage.runOfflineCatchUp(
            [{ item: overdueItem, savedX: 100 }, { item: futureItem, savedX: 500 }],
            1000,
            deps
        );
        expect(overdueItem.x).toBe(100);
        expect(futureItem.x).toBe(500); // from the stub calculateTimelineXWithClustering
    });

    test('is a no-op once the game is over', () => {
        const it = item({ element: fakeEl() });
        const deps = makeDeps({ state: { activeItems: [it], gameIsOver: true, baseHealth: 40 } });
        Damage.runOfflineCatchUp([{ item: it, savedX: 0 }], 1000, deps);
        expect(deps._state.baseHealth).toBe(40);
    });

    // [P1-DATA-005] session 27 — a negative-habit lurker accrues no offline
    // damage, and its target position is the fixed lurk x, never the
    // timeline calc, even across a long absence.
    test('a lurker takes no offline damage across a 10-hour absence', () => {
        const lurker = item({
            type: 'habit', isNegative: true,
            dueDateTime: new Date(Date.now() - 10 * 60 * 60 * 1000),
            element: null,
        });
        const deps = makeDeps({
            state: { activeItems: [lurker], baseHealth: 50 },
            deps: { isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true },
        });
        Damage.runOfflineCatchUp([{ item: lurker, savedX: null }], 10 * INTERVAL, deps);
        // no damage subtracted — only the [P2-GAME-012] regen for the same window applies
        expect(deps._state.baseHealth).toBe(Math.min(CONFIG.MAX_BASE_HEALTH, 50 + 10 * CONFIG.BASE_REGEN_HP));
    });

    test('a lurker\'s target position is the far-right lurk x, not the timeline calc', () => {
        const lurker = item({
            type: 'habit', isNegative: true,
            dueDateTime: new Date(Date.now() - 10 * 60 * 60 * 1000),
            isOverdue: false,
            x: 0,
            element: fakeEl(),
        });
        const deps = makeDeps({
            state: { activeItems: [lurker] },
            deps: { isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true },
        });
        Damage.runOfflineCatchUp([{ item: lurker, savedX: 0 }], 1000, deps);
        const expectedX = deps.gameScreenWidth - CONFIG.HABIT_ENEMY_WIDTH - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX;
        expect(lurker.x).toBe(expectedX);
        expect(lurker.x).not.toBe(500); // never the stub calculateTimelineXWithClustering value
        expect(lurker.x).toBeGreaterThan(deps.baseWidth); // not parked near the base
    });
});
