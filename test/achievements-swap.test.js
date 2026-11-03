/**
 * Achievements swap (2026-11-03; docs/HOW_IT_WORKS_PLAN.md, DECISIONS 2026-11-03): Steady Hands is gone; Honor Roll,
 * Clean Sweep and Iron Will are LIFETIME counters.
 *
 *  - catalog: the new families exist, Steady Hands and its config are gone
 *  - Achievements.dayDeltas: what one closed day adds (honor = routines banked at >= 3 stars; clean = something due,
 *    nothing missed)
 *  - Persistence v15 -> v16: the retro sweep of `deadline.days`, idempotent, open-day rule, drift guard vs dayDeltas
 *  - Items seams: breakResisted +1 on a resisted Break habit (live pop-up + check-in card), -1 on undo, never for
 *    Build habits or slips
 *  - State.closeDailyRecord: hands the CLOSED day to recordLifetimeDayClose, only after the days store saved
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
const Achievements = require('../js/achievements.js');
const Items = require('../js/items.js');
const State = require('../js/state.js');

// ---------------------------------------------------------------------------
describe('catalog', () => {
    const byId = (id) => CONFIG.ACHIEVEMENTS.find(f => f.id === id);

    test('Steady Hands is gone: family, metric and its two config keys', () => {
        expect(byId('steady_hands')).toBeUndefined();
        expect(CONFIG.ACHIEVEMENTS.some(f => f.metric === 'steadyRoutineRuns')).toBe(false);
        expect(CONFIG).not.toHaveProperty('STEADY_HANDS_MIN_RATE');
        expect(CONFIG).not.toHaveProperty('STEADY_HANDS_MIN_DAYS');
        expect(Achievements.freshLifetimeStats()).not.toHaveProperty('steadyRoutineRuns');
    });

    test('Honor Roll / Clean Sweep / Iron Will: metric, tiers, ascending thresholds', () => {
        const expected = {
            honor_roll: ['heroHonorDays', [30, 150, 500, 1500]],
            clean_sweep: ['cleanDays', [7, 30, 100, 365]],
            iron_will: ['breaksResisted', [7, 30, 100, 365]],
        };
        Object.keys(expected).forEach((id) => {
            const fam = byId(id);
            expect(fam).toBeDefined();
            expect(fam.metric).toBe(expected[id][0]);
            expect(fam.tiers.map(t => t.threshold)).toEqual(expected[id][1]);
            expect(fam.tiers.map(t => t.id)).toEqual([1, 2, 3, 4].map(n => id + '_' + n));
            expect(fam.tiers.map(t => t.label)).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum']);
        });
    });

    test('every family metric exists in a fresh lifetimeStats, and every tier id is unique', () => {
        const fresh = Achievements.freshLifetimeStats();
        CONFIG.ACHIEVEMENTS.forEach(f => expect(fresh).toHaveProperty(f.metric));
        const ids = [].concat(...CONFIG.ACHIEVEMENTS.map(f => f.tiers.map(t => t.id)));
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('the new counters unlock their Bronze tier exactly at the threshold', () => {
        const at = (stats) => Achievements.evaluateAll(CONFIG.ACHIEVEMENTS, stats, {}).map(t => t.tierId);
        expect(at({ cleanDays: 6, heroHonorDays: 29, breaksResisted: 6 })).toEqual([]);
        expect(at({ cleanDays: 7, heroHonorDays: 30, breaksResisted: 7 }).sort())
            .toEqual(['clean_sweep_1', 'honor_roll_1', 'iron_will_1']);
    });

    test('an already-unlocked Steady Hands tier in a save is simply ignored (never listed, never an error)', () => {
        const unlocked = { steady_hands_1: '2026-10-01T00:00:00.000Z' };
        expect(() => Achievements.evaluateAll(CONFIG.ACHIEVEMENTS, Achievements.freshLifetimeStats(), unlocked)).not.toThrow();
        expect(Achievements.nearMissNudges(CONFIG.ACHIEVEMENTS, Achievements.freshLifetimeStats(), unlocked)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
describe('Achievements.dayDeltas', () => {
    const day = (over) => Object.assign({ stars: {}, due: { task: 0, habit: 0 }, missed: { task: 0, habit: 0 } }, over);

    test('honor counts routines banked at >= the honor-roll stars, one per routine', () => {
        expect(Achievements.dayDeltas(day({ stars: { a: 5, b: 3, c: 2, d: 0 } }), 3).honor).toBe(2);
        // negative control: the boundary is >=, so 2 stars earns nothing and 3 earns it
        expect(Achievements.dayDeltas(day({ stars: { a: 2 } }), 3).honor).toBe(0);
        expect(Achievements.dayDeltas(day({ stars: { a: 3 } }), 3).honor).toBe(1);
    });

    test('honor follows the passed threshold (CONFIG.HERO_HONOR_ROLL_STARS), not a hardcoded 3', () => {
        expect(Achievements.dayDeltas(day({ stars: { a: 3, b: 4 } }), 4).honor).toBe(1);
    });

    test('clean = something due and nothing missed', () => {
        expect(Achievements.dayDeltas(day({ due: { task: 2, habit: 1 } }), 3).clean).toBe(1);
        expect(Achievements.dayDeltas(day({ due: { task: 0, habit: 3 } }), 3).clean).toBe(1);
    });

    test('NOT clean: nothing due (an idle day is not a perfect day), or any miss', () => {
        expect(Achievements.dayDeltas(day(), 3).clean).toBe(0);
        expect(Achievements.dayDeltas(day({ due: { task: 2, habit: 1 }, missed: { task: 1, habit: 0 } }), 3).clean).toBe(0);
        expect(Achievements.dayDeltas(day({ due: { task: 2, habit: 1 }, missed: { task: 0, habit: 1 } }), 3).clean).toBe(0);
    });

    test('garbage in, zeros out', () => {
        [null, undefined, {}, { stars: 'x', due: 5, missed: [] }].forEach((r) => {
            expect(Achievements.dayDeltas(r, 3)).toEqual({ honor: 0, clean: 0 });
        });
    });
});

// ---------------------------------------------------------------------------
describe('Persistence v15 -> v16 (retro sweep of deadline.days)', () => {
    const rec = (date, over) => Object.assign({
        date, stars: {}, due: { task: 0, habit: 0 }, missed: { task: 0, habit: 0 }, lurk: { avoided: 0, slipped: 0 },
    }, over);
    const store = (...recs) => ({ v: 6, days: recs.reduce((m, r) => { m[r.date] = r; return m; }, {}), months: {} });
    const v15 = (over) => Object.assign({ schemaVersion: 15, lifetimeStats: { tasksCompleted: 4, steadyRoutineRuns: 3 } }, over);

    const days = store(
        rec('2026-10-28', { stars: { r1: 4, r2: 3 }, due: { task: 1, habit: 2 }, lurk: { avoided: 2, slipped: 0 } }), // honor 2, clean, 2 resisted
        rec('2026-10-29', { stars: { r1: 2, r2: 5 }, due: { task: 1, habit: 2 }, missed: { task: 0, habit: 1 } }),   // honor 1, not clean
        rec('2026-10-30', { lurk: { avoided: 1, slipped: 1 } })                                                      // nothing due; 1 resisted
    );

    test('stamps v16, drops steadyRoutineRuns, keeps the other counters and the unlocked map', () => {
        const unlocked = { steady_hands_1: '2026-10-01T00:00:00.000Z' };
        const save = Persistence.migrate(v15({ achievements: unlocked }), days);
        expect(save.schemaVersion).toBe(16);
        expect(save.lifetimeStats).not.toHaveProperty('steadyRoutineRuns');
        expect(save.lifetimeStats.tasksCompleted).toBe(4);
        expect(save.achievements).toBe(unlocked);
    });

    test('sums honor-days, clean days and resisted Break habits over every closed day', () => {
        const s = Persistence.migrate(v15(), days).lifetimeStats;
        expect(s.heroHonorDays).toBe(3);   // 2 + 1 + 0
        expect(s.cleanDays).toBe(1);       // only 10-28
        expect(s.breaksResisted).toBe(3);  // 2 + 0 + 1
    });

    test('the still-open day adds only its resisted count, and is skipped when that date is already closed', () => {
        const open = rec('2026-11-03', { stars: { r1: 5 }, due: { task: 3, habit: 0 }, lurk: { avoided: 4, slipped: 0 } });
        const s = Persistence.migrate(v15({ today: open }), days).lifetimeStats;
        expect(s.breaksResisted).toBe(3 + 4);
        expect(s.heroHonorDays).toBe(3);
        expect(s.cleanDays).toBe(1);
        // a crash between "days saved" and "today cleared" leaves today == a closed date: do not count it twice
        const dup = Persistence.migrate(v15({ today: rec('2026-10-28', { lurk: { avoided: 9, slipped: 0 } }) }), days).lifetimeStats;
        expect(dup.breaksResisted).toBe(3);
    });

    test('no days store (fresh install, tests, quota) seeds zeros; a corrupt store does not throw', () => {
        expect(Persistence.migrate(v15(), null).lifetimeStats).toMatchObject({ heroHonorDays: 0, cleanDays: 0, breaksResisted: 0 });
        expect(() => Persistence.migrate(v15(), { days: 'nope' })).not.toThrow();
        expect(() => Persistence.migrate(v15(), { days: { x: null, y: 5 } })).not.toThrow();
    });

    test('idempotent: counters that already exist are never overwritten', () => {
        const stats = { heroHonorDays: 50, cleanDays: 20, breaksResisted: 10 };
        const s = Persistence.migrate(v15({ lifetimeStats: stats }), days).lifetimeStats;
        expect(s).toMatchObject({ heroHonorDays: 50, cleanDays: 20, breaksResisted: 10 });
    });

    test('the chain from an older save (v10) ends with the new counters and no Steady Hands', () => {
        const s = Persistence.migrate({ schemaVersion: 10, runHistory: [{ daysSurvived: 9, routines: [{ completionRate: { rate: 1 } }] }] }, days).lifetimeStats;
        expect(s).not.toHaveProperty('steadyRoutineRuns');
        expect(s.cleanDays).toBe(1);
    });

    // DRIFT GUARD: the sweep inlines the same math as Achievements.dayDeltas (Persistence has no module deps).
    test('the sweep equals the sum of Achievements.dayDeltas over the same days', () => {
        const s = Persistence.migrate(v15(), days).lifetimeStats;
        const sum = Object.values(days.days).reduce((a, r) => {
            const d = Achievements.dayDeltas(r, CONFIG.HERO_HONOR_ROLL_STARS);
            return { honor: a.honor + d.honor, clean: a.clean + d.clean };
        }, { honor: 0, clean: 0 });
        expect(s.heroHonorDays).toBe(sum.honor);
        expect(s.cleanDays).toBe(sum.clean);
    });

    test('the sweep reads deadline.days from localStorage when no store is passed', () => {
        global.localStorage = { getItem: (k) => (k === 'deadline.days' ? JSON.stringify(days) : null) };
        try {
            expect(Persistence.migrate(v15()).lifetimeStats.cleanDays).toBe(1);
        } finally { delete global.localStorage; }
    });
});

// ---------------------------------------------------------------------------
describe('Iron Will seams in items.js (breakResisted)', () => {
    function fakeEl() {
        return { style: {}, dataset: {}, textContent: '', classList: { add: () => {}, remove: () => {} },
            addEventListener: () => {}, appendChild: () => {}, remove: () => {} };
    }
    beforeAll(() => { global.document = { createElement: () => fakeEl() }; });
    afterAll(() => { delete global.document; });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    const noon = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; };
    const habitItem = (over) => Object.assign({
        id: 2, type: 'habit', definitionId: 'h1', name: 'Habit', category: 'health', isNegative: false,
        dueDateTime: noon(), originalDueDate: new Date(), isOverdue: false, lastDamageTickTime: null, parentId: null,
        streak: 0, element: fakeEl(), listItemElement: null }, over);
    const habitDef = (over) => Object.assign({ id: 'h1', name: 'Habit', isNegative: false, routineId: null, streak: 0,
        lastCompletionDate: null, occurrenceHistory: [] }, over);

    function makeDeps(over) {
        let xp = 0, points = 100;
        const calls = [];
        const completed = []; // ONE shared array: completeItem pushes here, uncompleteItem looks here
        const o = over || {};
        return {
            _calls: calls, isGameOver: () => false,
            activeItems: o.activeItems || [], definedHabits: () => o.definedHabits || [], definedRoutines: () => [],
            completedItems: () => completed, getCurrentRunStats: () => RunStats.freshRunStats(),
            recordLifetime: (e, v) => { calls.push([e, v]); },
            xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
            pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
            habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
            getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; },
            getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
            updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {},
            sortAndRenderActiveList: () => {}, renderCompletedItems: () => {}, updateTaskCountDisplay: () => {},
            resetAllSubTaskCheckboxes: () => {}, saveGame: () => {}, baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH,
            habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH, gameCanvas: fakeEl(), calculateTimelineXWithClustering: () => 0,
            getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
        };
    }
    const resisted = (deps) => deps._calls.filter(([e]) => e === 'breakResisted');

    test('completing a Break habit (live "Resisted") dispatches breakResisted +1', () => {
        const deps = makeDeps({ activeItems: [habitItem({ isNegative: true })], definedHabits: [habitDef({ isNegative: true })] });
        Items.completeItem(2, deps);
        expect(resisted(deps)).toEqual([['breakResisted', 1]]);
    });

    test('NEGATIVE CONTROL: a Build habit completion never dispatches breakResisted', () => {
        const deps = makeDeps({ activeItems: [habitItem()], definedHabits: [habitDef()] });
        Items.completeItem(2, deps);
        expect(resisted(deps)).toEqual([]);
    });

    test('complete then undo a Break habit nets +1 then -1 (no farming by redo)', () => {
        const deps = makeDeps({ activeItems: [habitItem({ isNegative: true })], definedHabits: [habitDef({ isNegative: true })] });
        Items.completeItem(2, deps);
        jest.runOnlyPendingTimers();
        Items.uncompleteItem(2, deps);
        expect(resisted(deps).map(([, v]) => v)).toEqual([1, -1]);
    });

    test('undoing a Build habit dispatches no breakResisted', () => {
        const deps = makeDeps({ activeItems: [habitItem()], definedHabits: [habitDef()] });
        Items.completeItem(2, deps);
        jest.runOnlyPendingTimers();
        Items.uncompleteItem(2, deps);
        // the undo really ran (habitCompleted reversed), yet no Iron Will dispatch either way
        expect(deps._calls.filter(([e]) => e === 'habitCompleted').map(([, v]) => v)).toEqual([1, -1]);
        expect(resisted(deps)).toEqual([]);
    });

    test("check-in card: 'avoided' dispatches breakResisted +1; 'indulged' (a slip) dispatches nothing", () => {
        const withCheckIn = () => habitDef({ isNegative: true, pendingCheckIn: { originalDueDate: new Date() } });
        const a = makeDeps({ definedHabits: [withCheckIn()] });
        Items.resolvePendingCheckIn('h1', 'avoided', a);
        expect(resisted(a)).toEqual([['breakResisted', 1]]);
        const b = makeDeps({ definedHabits: [withCheckIn()] });
        Items.resolvePendingCheckIn('h1', 'indulged', b);
        expect(b._calls).toEqual([]);
    });

    test('older deps without recordLifetime never throw', () => {
        const deps = makeDeps({ activeItems: [habitItem({ isNegative: true })], definedHabits: [habitDef({ isNegative: true })] });
        delete deps.recordLifetime;
        expect(() => Items.completeItem(2, deps)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
describe('State.closeDailyRecord -> recordLifetimeDayClose', () => {
    let store, failWrites;
    beforeAll(() => { global.window = { definedTasks: [] }; });
    afterAll(() => { delete global.window; });
    beforeEach(() => {
        store = {};
        failWrites = false;
        global.localStorage = {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { if (failWrites) throw new Error('quota'); store[k] = String(v); },
            removeItem: k => { delete store[k]; },
        };
        State.setRunHistory([]);
        State.setDefinedHabits([]);
        State.setDefinedRoutines([]);
        State.setActiveItems([]);
        State.setCompletedItems([]);
        State.setToday(DailyRecord.fresh({ date: '2026-10-26', tz: -300 }));
    });
    afterEach(() => { delete global.localStorage; });
    const NEXT_DAY = () => new Date(2026, 9, 27, 0, 5);

    test('hands the CLOSED day (with its banked stars) to the hook exactly once', () => {
        const hook = jest.fn();
        State.closeDailyRecord(NEXT_DAY(), { routineStarsNow: () => ({ r1: 4, r2: 3, r3: 1 }), recordLifetimeDayClose: hook });
        expect(hook).toHaveBeenCalledTimes(1);
        const closed = hook.mock.calls[0][0];
        expect(closed.date).toBe('2026-10-26');
        expect(Achievements.dayDeltas(closed, CONFIG.HERO_HONOR_ROLL_STARS).honor).toBe(2);
        // a second call on the same (now fresh) day closes nothing and must not count again
        State.closeDailyRecord(NEXT_DAY(), { recordLifetimeDayClose: hook });
        expect(hook).toHaveBeenCalledTimes(1);
    });

    test('NEGATIVE CONTROL: a failed days-store write keeps the day open and does NOT call the hook (the retry would double count)', () => {
        const hook = jest.fn();
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        failWrites = true;
        expect(State.closeDailyRecord(NEXT_DAY(), { recordLifetimeDayClose: hook })).toBe(false);
        expect(hook).not.toHaveBeenCalled();
        failWrites = false;
        expect(State.closeDailyRecord(NEXT_DAY(), { recordLifetimeDayClose: hook })).toBe(true);
        expect(hook).toHaveBeenCalledTimes(1);
        err.mockRestore();
    });

    test('a throwing hook, or no hook at all, still closes the day', () => {
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(State.closeDailyRecord(NEXT_DAY(), { recordLifetimeDayClose: () => { throw new Error('boom'); } })).toBe(true);
        expect(JSON.parse(store['deadline.days']).days['2026-10-26']).toBeDefined();
        State.setToday(DailyRecord.fresh({ date: '2026-10-27', tz: -300 }));
        expect(State.closeDailyRecord(new Date(2026, 9, 28, 0, 5))).toBe(true);
        err.mockRestore();
    });
});
