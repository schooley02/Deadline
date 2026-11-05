/**
 * PointsInfo tests (2026-11-02, "how points work" display).
 *
 * The module is display-only, so the important guarantee is that its words and
 * numbers agree with the REAL award code. Requires the real Habits and CONFIG.
 */
global.Schedule = require('../js/schedule.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Habits = require('../js/habits.js');
const CONFIG = require('../js/config.js');
const PointsInfo = require('../js/pointsInfo.js');

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

    test('mentions priority slots, the sub-task rule, the habit tiers and knocked-out routines', () => {
        const text = lines.join(' ');
        expect(text).toMatch(/Priority tasks pay double \(3 priority slots a day\)/);
        expect(text).toMatch(/Goals pay points and XP when a period is met or a goal is finished\./);
        expect(text).not.toMatch(/high.priority/i);
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

describe('PointsInfo.routineBonusSummary', () => {
    const r = routine(5, { habitDefinitionIds: [1, 2, 3, 4], taskDefinitionIds: [7, 8] });
    const defs = [
        habitDef(1, { routineId: 5, occurrenceHistory: history(22, 0) }), // x3
        habitDef(2, { routineId: 5, occurrenceHistory: history(22, 0) }), // x3
        habitDef(3, { routineId: 5, occurrenceHistory: history(19, 3) }), // x2
        habitDef(4, { routineId: 5, occurrenceHistory: history(5, 0) }),  // x1
    ];
    const tasks = [taskDef(7, { isHighPriority: true }), taskDef(8)];

    test('lists only the bonuses being applied, highest first, with counts', () => {
        const out = PointsInfo.routineBonusSummary(r, defs, tasks, CONFIG);
        expect(out.habits).toEqual({ 3: 2, 2: 1 });
        // Priority slots (2026-11-04): a routine's task templates no longer carry priority, so a stale flag earns nothing.
        expect(out.priorityTasks).toBe(0);
        expect(out.line).toBe('Bonus: 2 habits \u00D73 \u00B7 1 habit \u00D72');
    });

    test('a routine with no bonus returns an empty line (nothing is shown)', () => {
        const plain = routine(6, { habitDefinitionIds: [4], taskDefinitionIds: [8] });
        expect(PointsInfo.routineBonusSummary(plain, defs, tasks, CONFIG).line).toBe('');
        expect(PointsInfo.routineBonusSummary(routine(9), defs, tasks, CONFIG).line).toBe('');
    });

    test('habits and tasks from other routines are ignored', () => {
        const other = routine(7, { habitDefinitionIds: [3], taskDefinitionIds: [] });
        expect(PointsInfo.routineBonusSummary(other, defs, tasks, CONFIG).line).toBe('Bonus: 1 habit \u00D72');
    });

    test('archived habits and tasks do not count', () => {
        const archivedDefs = defs.map(d => (d.id === 1 ? Object.assign({}, d, { archivedAt: 123 }) : d));
        const archivedTasks = [Object.assign({}, tasks[0], { archivedAt: 123 }), tasks[1]];
        const out = PointsInfo.routineBonusSummary(r, archivedDefs, archivedTasks, CONFIG);
        expect(out.line).toBe('Bonus: 1 habit \u00D73 \u00B7 1 habit \u00D72');
    });

    test('Break (negative) habits count too, and bad input never throws', () => {
        const neg = [habitDef(1, { isNegative: true, occurrenceHistory: history(22, 0) })];
        expect(PointsInfo.routineBonusSummary(routine(5, { habitDefinitionIds: [1] }), neg, [], CONFIG).line).toBe('Bonus: 1 habit \u00D73');
        expect(PointsInfo.routineBonusSummary(null, null, null, CONFIG).line).toBe('');
    });

    test('numbers follow CONFIG tiers', () => {
        const custom = Object.assign({}, CONFIG, { HABIT_RATE_TIERS: [{ minRate: 1.0, multiplier: 4 }] });
        expect(PointsInfo.routineBonusSummary(r, defs, [], custom).line).toBe('Bonus: 2 habits \u00D74');
    });
});
