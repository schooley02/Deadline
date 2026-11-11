/**
 * Momentum Build A (2026-11-11; docs/MOMENTUM_PLAN.md): the seams. The pure rule is in test/momentum.test.js; this file proves the pieces
 * are connected: a priority finish records `pri.q` only when it is old enough (and the undo mirrors it), State keeps `momentumFromDay`,
 * the Jailhouse needs a defended night, game over counts defended nights, and the moon / tree / run stats / village all read the one
 * script.js number.
 */
const fs = require('fs');
const path = require('path');

global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.PrioritySlots = require('../js/prioritySlots.js');
global.Momentum = require('../js/momentum.js');
const Items = require('../js/items.js');
const VillageProgress = require('../js/villageProgress.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

function fakeEl() {
    return {
        style: {}, dataset: {},
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {}, appendChild: () => {}, remove: () => {},
    };
}
beforeAll(() => { global.document = { createElement: () => fakeEl() }; });
afterAll(() => { delete global.document; });

function tomorrowNoon() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
}
function priorityTask(overrides = {}) {
    return {
        id: 1, type: 'task', definitionId: null, name: 'Task', category: 'other',
        isHighPriority: true, dueDateTime: tomorrowNoon(), isOverdue: false,
        lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: fakeEl(), listItemElement: null,
        ...overrides,
    };
}
function makeDeps(overrides = {}) {
    let xp = 0, points = 100;
    const activeItems = overrides.activeItems || [];
    const completedItems = overrides.completedItems || [];
    const currentRunStats = RunStats.freshRunStats();
    const { activeItems: _a, completedItems: _c, ...rest } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => [],
        definedRoutines: () => [],
        completedItems: () => completedItems,
        getCurrentRunStats: () => currentRunStats,
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT,
        xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {},
        sortAndRenderActiveList: () => {}, renderCompletedItems: () => {}, updateTaskCountDisplay: () => {},
        resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
        baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
        gameCanvas: fakeEl(), calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0,
        getItemTopPosition: () => 0, handleEnemyClick: () => {},
        ...rest,
    };
}
function recorded() {
    const rec = DailyRecord.fresh({ date: '2026-11-11', tz: 0 });
    return { rec, recordDaily: (ev, p) => DailyRecord.bump(rec, ev, p) };
}

describe('Items: a priority finish records pri.q only when the task was old enough', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('a task made a minute ago and finished: pri.d counts (Command Post), pri.q does not (no night defended)', () => {
        const { rec, recordDaily } = recorded();
        const item = priorityTask({ creationTime: new Date(Date.now() - 60 * 1000) });
        Items.completeItem(1, makeDeps({ activeItems: [item], recordDaily }));
        expect(rec.pri.d).toBe(1);
        expect(rec.pri.q).toBe(0);
        expect(Momentum.isDefended(rec)).toBe(false);
    });
    test('a task 11 minutes old: both count and the night is defended', () => {
        const { rec, recordDaily } = recorded();
        const item = priorityTask({ creationTime: new Date(Date.now() - 11 * 60 * 1000) });
        Items.completeItem(1, makeDeps({ activeItems: [item], recordDaily }));
        expect(rec.pri.d).toBe(1);
        expect(rec.pri.q).toBe(1);
        expect(Momentum.isDefended(rec)).toBe(true);
    });
    test('a task from yesterday (a restored save stores the creation time as an ISO string) counts', () => {
        const { rec, recordDaily } = recorded();
        const item = priorityTask({ creationTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });
        Items.completeItem(1, makeDeps({ activeItems: [item], recordDaily }));
        expect(rec.pri.q).toBe(1);
    });
    test('a task with no creation time (an older save) counts', () => {
        const { rec, recordDaily } = recorded();
        Items.completeItem(1, makeDeps({ activeItems: [priorityTask()], recordDaily }));
        expect(rec.pri.q).toBe(1);
    });
    test('a plain (non-priority) task never touches pri', () => {
        const { rec, recordDaily } = recorded();
        const item = priorityTask({ isHighPriority: false, creationTime: new Date(Date.now() - 3600 * 1000) });
        Items.completeItem(1, makeDeps({ activeItems: [item], recordDaily }));
        expect(rec.pri).toEqual({ m: 0, d: 0, s: 0, q: 0 });
        expect(Momentum.isDefended(rec)).toBe(false);
    });
    test('undo takes the night back (d and q both), so an undo on the open day can undefend it', () => {
        const { rec, recordDaily } = recorded();
        const completed = [];
        const item = priorityTask({ creationTime: new Date(Date.now() - 3600 * 1000) });
        const deps = makeDeps({ activeItems: [item], completedItems: completed, recordDaily });
        Items.completeItem(1, deps);
        expect(Momentum.isDefended(rec)).toBe(true);
        Items.uncompleteItem(1, deps);
        expect(rec.pri.d).toBe(0);
        expect(rec.pri.q).toBe(0);
        expect(Momentum.isDefended(rec)).toBe(false);
    });
    test('undoing a fresh (too young) finish leaves q at 0 and does not borrow from an aged one', () => {
        const { rec, recordDaily } = recorded();
        const completed = [];
        const aged = priorityTask({ id: 1, creationTime: new Date(Date.now() - 3600 * 1000) });
        const fresh = priorityTask({ id: 2, creationTime: new Date(Date.now() - 1000) });
        const deps = makeDeps({ activeItems: [aged, fresh], completedItems: completed, recordDaily });
        Items.completeItem(1, deps);
        Items.completeItem(2, deps);
        expect(rec.pri).toMatchObject({ d: 2, q: 1 });
        Items.uncompleteItem(2, deps);
        expect(rec.pri).toMatchObject({ d: 1, q: 1 });
        expect(Momentum.isDefended(rec)).toBe(true);
    });
});

describe('Jailhouse: the church must have held AND the day must be defended', () => {
    const RUN = 1;
    const held = (date, over) => Object.assign(DailyRecord.fresh({ date, run: RUN }), { base: { endHp: 100, minHp: 90 } }, over || {});
    const ctx = (days, over) => Object.assign({
        runStats: { tasksCompleted: 0, subtasksCompleted: 0, habitsCompleted: 0 },
        nightsSurvived: 0, days, today: null, runNumber: RUN, maxHp: 100,
    }, over || {});

    test('without the new hook every held day counts (the old rule, so older callers are unchanged)', () => {
        const days = [held('2026-11-03'), held('2026-11-04'), held('2026-11-05')];
        expect(VillageProgress.counters(ctx(days)).defense).toBe(3);
    });
    test('with it, an empty day the church "held" no longer counts', () => {
        const days = [held('2026-11-03'), held('2026-11-04', { pri: { m: 1, d: 1, s: 0, q: 1 } }), held('2026-11-05', { att: { active: 1, perfect: 1 } })];
        const countsAsNight = (rec) => Momentum.countsAsNight(rec, null);
        expect(VillageProgress.counters(ctx(days, { countsAsNight })).defense).toBe(2);
    });
    test('days from before the rule started are exempt (they were counted the old way), days from it on are judged', () => {
        const days = [held('2026-11-03'), held('2026-11-04'), held('2026-11-08'), held('2026-11-09', { pri: { m: 1, d: 1, s: 0, q: 1 } })];
        const countsAsNight = (rec) => Momentum.countsAsNight(rec, '2026-11-08');
        expect(VillageProgress.counters(ctx(days, { countsAsNight })).defense).toBe(3); // 03, 04 (before) + 09 (defended); 08 is empty
    });
    test('a defended day the church did NOT hold still does not count', () => {
        const hurt = held('2026-11-03', { base: { endHp: 10, minHp: 5 }, pri: { m: 1, d: 1, s: 0, q: 1 } });
        const countsAsNight = (rec) => Momentum.countsAsNight(rec, null);
        expect(VillageProgress.counters(ctx([hurt], { countsAsNight })).defense).toBe(0);
    });
    test('the Radio tower reads the nights it is handed', () => {
        expect(VillageProgress.compute(ctx([], { nightsSurvived: 18 })).nights.tier).toBe(3);
    });
});

describe('State keeps momentumFromDay', () => {
    const State = require('../js/state.js');
    test('the setter keeps a valid day key and nothing else (null = judged from the first day)', () => {
        State.setMomentumFromDay('2026-11-12');
        expect(State.getMomentumFromDay()).toBe('2026-11-12');
        State.setMomentumFromDay(null);
        expect(State.getMomentumFromDay()).toBe(null);
        State.setMomentumFromDay('11/12/2026');
        expect(State.getMomentumFromDay()).toBe(null);
        State.setMomentumFromDay(20261112);
        expect(State.getMomentumFromDay()).toBe(null);
    });
    test('it is saved with the game and restored: an ABSENT field means an older save (set to today), null means judged from day one', () => {
        const src = read('js/state.js');
        expect(src).toMatch(/momentumFromDay: getMomentumFromDay\(\)/);
        expect(src).toMatch(/save\.momentumFromDay !== undefined \? save\.momentumFromDay :/);
        expect(src).toMatch(/DailyRecord\.dateKey\(new Date\(\)\)/);
    });
    test('the closed days reach script.js through State.getClosedDays', () => {
        expect(typeof State.getClosedDays).toBe('function');
    });
});

describe('Damage.gameOver counts defended nights', () => {
    const Damage = require('../js/damage.js');
    test('computeDaysSurvived is still the calendar count (the fallback), and gameOver prefers deps.getNightsSurvived', () => {
        const src = read('js/damage.js');
        expect(src).toMatch(/typeof deps\.getNightsSurvived === 'function'/);
        expect(src).toMatch(/deps\.getNightsSurvived\(\)/);
        expect(Damage.computeDaysSurvived(new Date(2026, 10, 2, 12).getTime(), new Date(2026, 10, 12, 8).getTime())).toBe(10);
    });
    test('State hands the dep through to Damage', () => {
        expect(read('js/state.js')).toMatch(/getNightsSurvived: deps\.getNightsSurvived/);
    });
});

describe('script.js: one number for every reader', () => {
    const script = read('script.js');
    test('nightsSurvivedNow is built on Momentum.nights with the closed days, the run number and the saved start day', () => {
        const i = script.indexOf('function nightsSurvivedNow(');
        expect(i).toBeGreaterThan(0);
        const body = script.slice(i, script.indexOf('\n    }\n', i));
        expect(body).toContain('Momentum.nights(');
        expect(body).toContain('State.getClosedDays()');
        expect(body).toContain('State.getMomentumFromDay()');
        expect(body).toContain('(State.getRunHistory() || []).length + 1');
    });
    test('the village, the tree (both reads), the run stats, game over and the moon all use it', () => {
        expect(script).toMatch(/nightsSurvived: nightsSurvivedNow\(\)/);
        expect(script).toMatch(/countsAsNight: \(rec\) => Momentum\.countsAsNight\(rec, State\.getMomentumFromDay\(\)\)/);
        expect((script.match(/const current = nightsSurvivedNow\(\);/g) || []).length).toBe(2);
        expect(script).toMatch(/daysSurvivedSoFar: nightsSurvivedNow\(\)/);
        expect(script).toMatch(/getNightsSurvived: \(\) => nightsSurvivedNow\(\)/);
        expect(script).toMatch(/getNights: nightsSurvivedNow/);
    });
    test('nothing left in script.js counts calendar midnights for a reader', () => {
        expect(script).not.toMatch(/NightsSurvivedView\.countMidnights\(/);
        expect(script).not.toMatch(/Damage\.computeDaysSurvived\(State\.getRunStartedAtMs\(\), Date\.now\(\)/);
    });
});

describe('shell wiring', () => {
    test('js/momentum.js loads right after dailyRecord.js and is in the service worker shell', () => {
        const html = read('index.html');
        const a = html.indexOf('<script src="js/dailyRecord.js"></script>');
        const m = html.indexOf('<script src="js/momentum.js"></script>');
        const items = html.indexOf('<script src="js/items.js"></script>');
        expect(a).toBeGreaterThan(0);
        expect(m).toBeGreaterThan(a);
        expect(m).toBeLessThan(items);
        expect(read('sw.js')).toContain("'js/momentum.js'");
    });
    test('CACHE_NAME was bumped for the new shell file (v328 or later)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(read('sw.js'));
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBeGreaterThanOrEqual(328);
    });
    test('the moon view falls back to the calendar count when no getNights is given', () => {
        const View = require('../js/ui/nightsSurvivedView.js');
        expect(typeof View.countMidnights).toBe('function');
        expect(read('js/ui/nightsSurvivedView.js')).toMatch(/typeof deps\.getNights === 'function' \? deps\.getNights\(Date\.now\(\)\) : countMidnights\(/);
    });
});

describe('startup order (found in the live check, Build B)', () => {
    test('nightsCache is declared before GraveyardView.init, whose first render reads the tree stage and so the night count', () => {
        const src = read('script.js');
        const cache = src.indexOf('const nightsCache =');
        const init = src.indexOf('GraveyardView.init({');
        expect(cache).toBeGreaterThan(-1);
        expect(init).toBeGreaterThan(-1);
        expect(cache).toBeLessThan(init);
        expect(src.match(/const nightsCache =/g)).toHaveLength(1);
    });
});
