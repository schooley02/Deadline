/**
 * Items.setLoggedTime (Habit Goals Build 2c, 2026-11-01; plan Decisions 12-14): the one path that edits a logged time,
 * for an active item or a completed one, correcting the daily record on the item's own day and never touching the answer.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.Timer = require('../js/timer.js');
const Items = require('../js/items.js');

const MIN = 60000;

function makeDeps(active, completed) {
    const calls = { adjust: [], saved: 0, rendered: 0 };
    return {
        calls,
        activeItems: active || [],
        completedItems: () => completed || [],
        adjustDayTimer: (when, kind, deltaMin) => { calls.adjust.push({ when, kind, deltaMin }); return true; },
        saveGame: () => { calls.saved += 1; },
        renderCompletedItems: () => { calls.rendered += 1; },
    };
}
const breakHabit = (o) => Object.assign({ id: 7, type: 'habit', isNegative: true, timerMinutes: 30, timer: null, timerMsBanked: 20 * MIN }, o);

describe('Items.setLoggedTime', () => {
    test('active item: sets the time and corrects TODAY by the difference, in the right bucket', () => {
        const item = breakHabit();
        const deps = makeDeps([item]);
        const r = Items.setLoggedTime(7, 35 * MIN, deps);
        expect(r).toEqual({ ok: true, deltaMin: 15, completed: false });
        expect(item.timerMsBanked).toBe(35 * MIN);
        expect(deps.calls.adjust).toHaveLength(1);
        expect(deps.calls.adjust[0].kind).toBe('limit');
        expect(deps.calls.adjust[0].deltaMin).toBe(15);
        const now = Date.now();
        expect(Math.abs(deps.calls.adjust[0].when.getTime() - now)).toBeLessThan(5000);
        expect(deps.calls.saved).toBe(1);
        expect(deps.calls.rendered).toBe(0);
    });

    test('completed item: corrects the day of completedAt (not today) and re-renders the completed list', () => {
        const done = { id: 9, type: 'task', timerMsBanked: 50 * MIN, completedAt: new Date(2026, 9, 30, 21, 5) };
        const deps = makeDeps([], [done]);
        const r = Items.setLoggedTime(9, 30 * MIN, deps);
        expect(r).toEqual({ ok: true, deltaMin: -20, completed: true });
        expect(done.timerMsBanked).toBe(30 * MIN);
        expect(deps.calls.adjust[0].when.getTime()).toBe(new Date(2026, 9, 30, 21, 5).getTime());
        expect(deps.calls.adjust[0].kind).toBe('work');
        expect(deps.calls.rendered).toBe(1);
    });

    test('an edit never changes the answer: Slipped stays Slipped, a done Build habit stays done', () => {
        const slipped = breakHabit({ id: 11, outcome: 'indulged', completedAt: new Date(), timerMsBanked: 5 * MIN });
        const done = { id: 12, type: 'habit', isNegative: false, timerMinutes: 30, timerMsBanked: 40 * MIN, completedAt: new Date(), goalAcked: true };
        const deps = makeDeps([], [slipped, done]);
        Items.setLoggedTime(11, 90 * MIN, deps); // way over its 30 min limit
        Items.setLoggedTime(12, 5 * MIN, deps);  // way under its goal
        expect(slipped.outcome).toBe('indulged');
        expect(done.goalAcked).toBe(true);
        expect(deps.calls.adjust.map(a => a.kind)).toEqual(['limit', 'work']);
    });

    test('refused while the timer is running: nothing changes, nothing recorded', () => {
        const item = breakHabit({ timer: { startedAt: 1, checkedAt: 1, promptedAt: null } });
        const deps = makeDeps([item]);
        expect(Items.setLoggedTime(7, 5 * MIN, deps)).toEqual({ ok: false, reason: 'running' });
        expect(item.timerMsBanked).toBe(20 * MIN);
        expect(deps.calls.adjust).toHaveLength(0);
        expect(deps.calls.saved).toBe(0);
    });

    test('unknown id, bad number: refused', () => {
        const deps = makeDeps([breakHabit()]);
        expect(Items.setLoggedTime(99, MIN, deps)).toEqual({ ok: false, reason: 'missing' });
        expect(Items.setLoggedTime(7, 'x', deps)).toEqual({ ok: false, reason: 'invalid' });
        expect(deps.calls.adjust).toHaveLength(0);
    });

    test('an unchanged value records nothing but still succeeds', () => {
        const item = breakHabit();
        const deps = makeDeps([item]);
        expect(Items.setLoggedTime(7, 20 * MIN, deps)).toEqual({ ok: true, deltaMin: 0, completed: false });
        expect(deps.calls.adjust).toHaveLength(0);
    });

    test('a throwing daily-record dep never loses the edit', () => {
        const item = breakHabit();
        const deps = makeDeps([item]);
        deps.adjustDayTimer = () => { throw new Error('boom'); };
        expect(Items.setLoggedTime(7, 25 * MIN, deps).ok).toBe(true);
        expect(item.timerMsBanked).toBe(25 * MIN);
    });
});
