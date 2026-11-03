/**
 * PointsInfo tests (2026-11-02, "how points work" display).
 *
 * The module is display-only, so the important guarantee is that its words and
 * numbers agree with the REAL award code. Requires the real Economy / Habits /
 * Routines / DayPager (day-pager.test.js precedent) and the real CONFIG.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
global.Routines = require('../js/routines.js');
global.TimeSlider = require('../js/timeSlider.js');
global.Economy = require('../js/economy.js');
global.DayPager = require('../js/dayPager.js');
const CONFIG = require('../js/config.js');
const PointsInfo = require('../js/pointsInfo.js');

const TODAY = new Date(2026, 10, 2, 12, 0, 0); // Mon Nov 2 2026, local noon

function history(successes, misses) {
    const out = [];
    for (let i = 0; i < successes + misses; i++) out.push({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, success: i < successes });
    return out;
}

function habitDef(id, overrides = {}) {
    return { id, name: `Habit ${id}`, category: 'other', frequency: 'daily', timeOfDay: 'morning', streak: 0, isNegative: false, routineId: null, occurrenceHistory: [], ...overrides };
}

function taskDef(id, overrides = {}) {
    return { id, name: `Task ${id}`, category: 'other', defaultDueTime: '17:00', ...overrides };
}

function routine(id, overrides = {}) {
    return { id, name: `Routine ${id}`, habitDefinitionIds: [], taskDefinitionIds: [], isActive: true, koState: null, ...overrides };
}

describe('PointsInfo.rulesLines', () => {
    const lines = PointsInfo.rulesLines(CONFIG);

    test('states the base award from CONFIG', () => {
        expect(lines[0]).toContain(String(CONFIG.POINTS_PER_TASK));
        expect(CONFIG.POINTS_PER_TASK).toBe(CONFIG.POINTS_PER_HABIT); // the one-sentence form assumes this
    });

    test('mentions high priority, the sub-task rule, the habit tiers and knocked-out routines', () => {
        const text = lines.join(' ');
        expect(text).toMatch(/High-priority tasks pay double/);
        expect(text).toMatch(/sub-task/);
        expect(text).toMatch(/×2 for 80% or more of their last 22/);
        expect(text).toMatch(/×3 for all 22/);
        expect(text).toMatch(/knocked-out routine/);
    });

    test('numbers follow CONFIG, not hardcoded text', () => {
        const custom = Object.assign({}, CONFIG, {
            HABIT_RATE_WINDOW: 10,
            HABIT_RATE_MIN_SAMPLE: 10,
            HABIT_RATE_TIERS: [{ minRate: 1.0, multiplier: 4 }, { minRate: 0.9, multiplier: 2 }],
        });
        const text = PointsInfo.rulesLines(custom).join(' ');
        expect(text).toMatch(/×2 for 90% or more of their last 10/);
        expect(text).toMatch(/×4 for all 10/);
        expect(text).toMatch(/until it has 10 scheduled times/);
    });

    test('omits the knocked-out line if ghosts ever start paying', () => {
        const text = PointsInfo.rulesLines(Object.assign({}, CONFIG, { KO_GHOST_POINTS_FACTOR: 0.5 })).join(' ');
        expect(text).not.toMatch(/knocked-out/);
    });
});

describe('PointsInfo.habitBonusInfo', () => {
    test('under the minimum sample pays x1 and says how many are recorded', () => {
        const info = PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: history(9, 0) }), CONFIG);
        expect(info.multiplier).toBe(1);
        expect(info.tag).toBe('');
        expect(info.next).toBeNull();
        expect(info.line).toBe('Pays ×1 · 9 of 22 times recorded (the bonus starts at 22)');
    });

    test('perfect 22/22 pays x3 with no next tier', () => {
        const info = PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: history(22, 0) }), CONFIG);
        expect(info.multiplier).toBe(3);
        expect(info.tag).toBe('×3');
        expect(info.next).toBeNull();
        expect(info.line).toBe('Pays ×3 · 22 of last 22 done');
    });

    test('19 of 22 pays x2 and names the x3 target', () => {
        const info = PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: history(19, 3) }), CONFIG);
        expect(info.multiplier).toBe(2);
        expect(info.tag).toBe('×2');
        expect(info.next).toEqual({ multiplier: 3, needed: 22, of: 22 });
        expect(info.line).toBe('Pays ×2 · 19 of last 22 done · ×3 at 22/22');
    });

    test('a full record under 80% pays x1 and points at the x2 target (18/22)', () => {
        const info = PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: history(15, 7) }), CONFIG);
        expect(info.multiplier).toBe(1);
        expect(info.next).toEqual({ multiplier: 2, needed: 18, of: 22 });
        expect(info.line).toBe('Pays ×1 · 15 of last 22 done · ×2 at 18/22');
    });

    test('exactly 80% (18/22 rounds up from 17.6) is the x2 boundary', () => {
        expect(PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: history(18, 4) }), CONFIG).multiplier).toBe(2);
        expect(PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: history(17, 5) }), CONFIG).multiplier).toBe(1);
    });

    test('agrees with the real award math (Habits.pointsMultiplier) for every success count', () => {
        for (let ok = 0; ok <= 22; ok++) {
            const h = history(ok, 22 - ok);
            const real = Habits.pointsMultiplier(h, { minSample: CONFIG.HABIT_RATE_MIN_SAMPLE, tiers: CONFIG.HABIT_RATE_TIERS });
            expect(PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: h }), CONFIG).multiplier).toBe(real);
        }
    });

    test('a Break habit says resisted instead of done', () => {
        const info = PointsInfo.habitBonusInfo(habitDef(1, { isNegative: true, occurrenceHistory: history(20, 2) }), CONFIG);
        expect(info.line).toBe('Pays \u00D72 \u00B7 20 of last 22 resisted \u00B7 \u00D73 at 22/22');
    });

    test('missing / malformed history is a fresh habit, never throws', () => {
        expect(PointsInfo.habitBonusInfo(habitDef(1, { occurrenceHistory: undefined }), CONFIG).recorded).toBe(0);
        expect(PointsInfo.habitBonusInfo(null, CONFIG).multiplier).toBe(1);
    });

    test('habitPointsNow matches what completion actually pays', () => {
        const def = habitDef(1, { occurrenceHistory: history(22, 0) });
        const paid = Habits.applyHabitCompletion(0, def.occurrenceHistory, false, new Date(2026, 10, 2), {
            xpPerHabitComplete: 1, pointsPerHabit: CONFIG.POINTS_PER_HABIT, rateWindow: CONFIG.HABIT_RATE_WINDOW,
            rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE, rateTiers: CONFIG.HABIT_RATE_TIERS,
        });
        expect(PointsInfo.habitPointsNow(def, CONFIG)).toBe(paid.pointsGained);
    });
});

describe('PointsInfo.activeItemPoints', () => {
    const habits = [habitDef(1, { occurrenceHistory: history(22, 0) })];

    test('task, high-priority task, habit at x3', () => {
        expect(PointsInfo.activeItemPoints({ type: 'task', id: 1 }, habits, [], CONFIG)).toBe(1);
        expect(PointsInfo.activeItemPoints({ type: 'task', id: 2, isHighPriority: true }, habits, [], CONFIG)).toBe(2);
        expect(PointsInfo.activeItemPoints({ type: 'habit', id: 3, definitionId: 1 }, habits, [], CONFIG)).toBe(3);
    });

    test('a parent with sub-tasks pays 0; each sub-task pays SUBTASK_POINTS (x2 if high priority)', () => {
        const parent = { type: 'task', id: 10 };
        const subA = { type: 'task', id: 11, parentId: 10 };
        const subB = { type: 'task', id: 12, parentId: 10, isHighPriority: true };
        const all = [parent, subA, subB];
        expect(PointsInfo.activeItemPoints(parent, [], all, CONFIG)).toBe(0);
        expect(PointsInfo.activeItemPoints(subA, [], all, CONFIG)).toBe(CONFIG.SUBTASK_POINTS);
        expect(PointsInfo.activeItemPoints(subB, [], all, CONFIG)).toBe(CONFIG.SUBTASK_POINTS * 2);
    });

    test('a KO ghost pays points x KO_GHOST_POINTS_FACTOR (0 today)', () => {
        expect(PointsInfo.activeItemPoints({ type: 'task', id: 1, koGhost: true }, [], [], CONFIG)).toBe(0);
    });
});

describe('PointsInfo.routineDayEarning', () => {
    const r = routine(5, { habitDefinitionIds: [1, 2], taskDefinitionIds: [7] });
    const defs = [
        habitDef(1, { routineId: 5, occurrenceHistory: history(22, 0) }), // x3
        habitDef(2, { routineId: 5, occurrenceHistory: history(5, 0) }),  // x1
    ];
    const tasks = [taskDef(7, { isHighPriority: true })];
    const baseDeps = (over = {}) => Object.assign({
        definedHabits: defs, definedRoutines: [r], definedTasks: tasks, activeItems: [], completedItems: [], sickDayDate: null,
    }, over);

    function args(offset, depsOver, extra = {}) {
        return Object.assign({ routine: r, offset, referenceTime: TODAY, config: CONFIG, deps: baseDeps(depsOver) }, extra);
    }

    test('yesterday returns null (the record has no per-routine points)', () => {
        expect(PointsInfo.routineDayEarning(args(-1))).toBeNull();
    });

    test('tomorrow: habits at today\'s multipliers plus the high-priority routine task', () => {
        const out = PointsInfo.routineDayEarning(args(1));
        expect(out.kind).toBe('future');
        expect(out.total).toBe(3);
        expect(out.pts).toBe(3 + 1 + 2); // x3 habit + x1 habit + high-priority task
        expect(out.line).toBe('Tomorrow: up to 6 pts at current rates');
    });

    test('a later day is labelled with its weekday', () => {
        const out = PointsInfo.routineDayEarning(args(3));
        expect(out.line).toMatch(/^Thursday: up to 6 pts/);
    });

    test('a habit not scheduled that weekday is left out', () => {
        const weekendOnly = [defs[0], Object.assign({}, defs[1], { schedule: { frequency: 'weekly', daysOfWeek: [0, 6], dayOfMonth: null } })];
        const out = PointsInfo.routineDayEarning(args(1, { definedHabits: weekendOnly }));
        // Tue Nov 3: the weekend-only habit does not spawn
        expect(out.total).toBe(2);
        expect(out.pts).toBe(3 + 2); // x3 habit + high-priority task
    });

    test('an inactive routine says it is off', () => {
        const off = routine(5, { habitDefinitionIds: [1], isActive: false });
        const out = PointsInfo.routineDayEarning(Object.assign(args(1), { routine: off }));
        expect(out.kind).toBe('off');
        expect(out.pts).toBe(0);
    });

    test('a day with nothing due says so', () => {
        const empty = routine(6);
        const out = PointsInfo.routineDayEarning(Object.assign(args(1), { routine: empty }));
        expect(out.line).toBe('Tomorrow: nothing due');
    });

    const doneToday = (id, type, definitionId, extra = {}) =>
        Object.assign({ id, type, definitionId, completedAt: new Date(2026, 10, 2, 9, 30) }, extra);

    test('today: points still to earn from live items, plus done count from today\'s completed items', () => {
        const active = [
            { id: 100, type: 'habit', definitionId: 1 },                       // x3 -> 3
            { id: 101, type: 'task', definitionId: 7, isHighPriority: true },  // 2
            { id: 102, type: 'task', definitionId: null },                     // not in the routine
        ];
        const completed = [
            doneToday(200, 'habit', 2),                                        // in the routine, today
            doneToday(201, 'habit', 1, { completedAt: new Date(2026, 10, 1, 9, 30) }), // yesterday: not counted
            doneToday(202, 'habit', 99),                                       // another routine's habit
            doneToday(203, 'task', 7),                                         // routine task, today
        ];
        const out = PointsInfo.routineDayEarning(args(0, { activeItems: active, completedItems: completed }));
        expect(out.kind).toBe('today');
        expect(out.pts).toBe(5);
        expect(out.done).toBe(2);
        expect(out.total).toBe(4);
        expect(out.line).toBe('Today: 5 pts left to earn \u00B7 2 of 4 done');
    });

    test('today: completed sub-tasks of a routine task count as done; other sub-tasks do not', () => {
        const completed = [
            doneToday(300, 'task', 7),
            doneToday(301, 'task', null, { parentId: 300 }),
            doneToday(302, 'task', null, { parentId: 999 }),
        ];
        const out = PointsInfo.routineDayEarning(args(0, { completedItems: completed }));
        expect(out.done).toBe(2);
    });

    test('today: completedAt that came back from a save as a string still counts', () => {
        const completed = [doneToday(400, 'habit', 1, { completedAt: new Date(2026, 10, 2, 8, 0).toISOString() })];
        expect(PointsInfo.routineDayEarning(args(0, { completedItems: completed })).done).toBe(1);
    });

    test('today: everything finished', () => {
        const completed = [doneToday(1, 'habit', 1), doneToday(2, 'habit', 2), doneToday(3, 'task', 7)];
        const out = PointsInfo.routineDayEarning(args(0, { completedItems: completed }));
        expect(out.line).toBe('Today: all 3 done');
    });

    test('today: nothing due', () => {
        expect(PointsInfo.routineDayEarning(args(0)).line).toBe('Today: nothing due');
    });

    test('today: a knocked-out routine pays 0', () => {
        const ko = routine(5, { habitDefinitionIds: [1], koState: { koAt: Date.now() } });
        const active = [{ id: 100, type: 'habit', definitionId: 1, koGhost: true }];
        const out = PointsInfo.routineDayEarning(Object.assign(args(0, { activeItems: active }), { routine: ko }));
        expect(out.kind).toBe('ko');
        expect(out.pts).toBe(0);
    });

    test('singular "pt"', () => {
        const solo = routine(5, { habitDefinitionIds: [2] });
        const active = [{ id: 100, type: 'habit', definitionId: 2 }];
        const out = PointsInfo.routineDayEarning(Object.assign(args(0, { activeItems: active }), { routine: solo }));
        expect(out.line).toBe('Today: 1 pt left to earn · 0 of 1 done');
    });
});
