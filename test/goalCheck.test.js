/**
 * GoalCheck -- pure helpers for Habit Goals Build 3 (evening check time, who gets asked, How much?, goal record).
 * Plan: docs/HABIT_GOALS_PLAN.md Decisions 7, 8, 14.
 */
global.CONFIG = require('../js/config.js');
global.Habits = require('../js/habits.js');
const GoalCheck = require('../js/goalCheck.js');
const Settings = require('../js/settings.js');

describe('evening time parsing', () => {
    test('parseTimeOfDay accepts HH:MM and rejects everything else', () => {
        expect(GoalCheck.parseTimeOfDay('21:00')).toBe(21 * 60);
        expect(GoalCheck.parseTimeOfDay('9:05')).toBe(9 * 60 + 5);
        expect(GoalCheck.parseTimeOfDay('00:00')).toBe(0);
        expect(GoalCheck.parseTimeOfDay('23:59')).toBe(23 * 60 + 59);
        ['24:00', '12:60', '12', '', 'noon', null, undefined, 900].forEach((bad) => expect(GoalCheck.parseTimeOfDay(bad)).toBeNull());
    });

    test('normalizeEveningTime pads and falls back to the default (or the given fallback)', () => {
        expect(GoalCheck.normalizeEveningTime('9:05')).toBe('09:05');
        expect(GoalCheck.normalizeEveningTime('21:30')).toBe('21:30');
        expect(GoalCheck.normalizeEveningTime('nope')).toBe('21:00');
        expect(GoalCheck.normalizeEveningTime('', '20:00')).toBe('20:00');
    });

    test('the default matches CONFIG and Settings so the three never drift apart', () => {
        expect(GoalCheck.DEFAULT_EVENING_TIME).toBe(CONFIG.EVENING_CHECK_DEFAULT);
        expect(Settings.DEFAULTS.eveningCheckTime).toBe(CONFIG.EVENING_CHECK_DEFAULT);
    });

    test('isEveningTime is true at and after the time, false before it', () => {
        const at = (h, m) => new Date(2026, 10, 1, h, m, 0);
        expect(GoalCheck.isEveningTime(at(20, 59), '21:00')).toBe(false);
        expect(GoalCheck.isEveningTime(at(21, 0), '21:00')).toBe(true);
        expect(GoalCheck.isEveningTime(at(23, 59), '21:00')).toBe(true);
        expect(GoalCheck.isEveningTime(at(0, 5), '21:00')).toBe(false); // after midnight is a new day: the morning card covers it
        expect(GoalCheck.isEveningTime(at(21, 0), 'garbage')).toBe(true); // falls back to 21:00
        expect(GoalCheck.isEveningTime(at(8, 0).getTime(), '07:30')).toBe(true); // accepts ms
    });
});

describe('eveningCandidates: who the evening check asks about', () => {
    const NOW = new Date(2026, 10, 1, 21, 0, 0).getTime();
    const at = (h) => new Date(2026, 10, 1, h, 0, 0);
    const defs = [
        { id: 'a', isNegative: true }, { id: 'b', isNegative: true }, { id: 'c', isNegative: true },
        { id: 'old', isNegative: true, archivedAt: 5 }, { id: 'build', isNegative: false },
    ];
    const brk = (id, def, due, extra) => Object.assign({ id, type: 'habit', isNegative: true, definitionId: def, dueDateTime: due }, extra);

    test('keeps unanswered Break habits whose time has arrived, in the given order', () => {
        const items = [brk(1, 'b', at(15)), brk(2, 'a', at(9)), brk(3, 'c', at(21))];
        expect(GoalCheck.eveningCandidates(items, defs, NOW).map((i) => i.id)).toEqual([1, 2, 3]);
    });

    test('skips a habit whose tempting window has not started yet (it keeps its arrival prompt + the morning card)', () => {
        const items = [brk(1, 'a', at(9)), brk(2, 'b', at(22)), brk(3, 'c', new Date(NOW + 1))];
        expect(GoalCheck.eveningCandidates(items, defs, NOW).map((i) => i.id)).toEqual([1]);
    });

    test('skips Build habits, tasks, KO ghosts, archived definitions and unknown definitions', () => {
        const items = [
            { id: 1, type: 'habit', isNegative: false, definitionId: 'build', dueDateTime: at(9) },
            { id: 2, type: 'task', definitionId: 'a', dueDateTime: at(9) },
            brk(3, 'a', at(9), { koGhost: true }),
            brk(4, 'old', at(9)),
            brk(5, 'missing', at(9)),
            brk(6, 'a', at(9)),
        ];
        expect(GoalCheck.eveningCandidates(items, defs, NOW).map((i) => i.id)).toEqual([6]);
    });

    test('tolerates empty / bad input and a missing due time', () => {
        expect(GoalCheck.eveningCandidates(null, null, NOW)).toEqual([]);
        expect(GoalCheck.eveningCandidates([brk(1, 'a', null), brk(2, 'a', undefined)], defs, NOW)).toEqual([]);
    });
});

describe('How much?', () => {
    test('howMuchKind: Amount asks a number, Time asks minutes, Note / none / missing ask nothing', () => {
        expect(GoalCheck.howMuchKind({ type: 'amount' })).toBe('amount');
        expect(GoalCheck.howMuchKind({ type: 'time' })).toBe('time');
        expect(GoalCheck.howMuchKind({ type: 'note' })).toBeNull();
        expect(GoalCheck.howMuchKind({ type: 'none' })).toBeNull();
        expect(GoalCheck.howMuchKind(null)).toBeNull();
    });

    test('parseHowMuch: blank / invalid / negative / absurd = null; amounts keep 2 decimals; minutes are whole', () => {
        expect(GoalCheck.parseHowMuch('3', 'amount')).toBe(3);
        expect(GoalCheck.parseHowMuch(' 2.456 ', 'amount')).toBe(2.46);
        expect(GoalCheck.parseHowMuch('0', 'amount')).toBe(0); // a real answer: none today
        expect(GoalCheck.parseHowMuch('18.6', 'time')).toBe(19);
        ['', '   ', 'abc', '-1', null, undefined, '1e9'].forEach((bad) => expect(GoalCheck.parseHowMuch(bad, 'amount')).toBeNull());
        expect(GoalCheck.parseHowMuch('1441', 'time')).toBeNull();
        expect(GoalCheck.parseHowMuch('5', 'note')).toBeNull();
    });

    test('loggedMinutes rounds banked ms to minutes and is null when nothing is logged', () => {
        expect(GoalCheck.loggedMinutes({ timerMsBanked: 18 * 60000 })).toBe(18);
        expect(GoalCheck.loggedMinutes({ timerMsBanked: 20 * 1000 })).toBe(0); // under 30 s rounds to 0 but IS logged
        expect(GoalCheck.loggedMinutes({ timerMsBanked: 0 })).toBeNull();
        expect(GoalCheck.loggedMinutes({})).toBeNull();
        expect(GoalCheck.loggedMinutes(null)).toBeNull();
    });
});

describe('actualFor + goalRecord', () => {
    test('an Amount goal uses goalActual; a Time goal uses the logged minutes (never goalActual); others nothing', () => {
        const item = { goalActual: 3, timerMsBanked: 45 * 60000 };
        expect(GoalCheck.actualFor(item, { type: 'amount' })).toBe(3);
        expect(GoalCheck.actualFor({}, { type: 'amount' })).toBeNull();
        expect(GoalCheck.actualFor(item, { type: 'time' })).toBe(45);
        expect(GoalCheck.actualFor(item, { type: 'note' })).toBeNull();
        expect(GoalCheck.actualFor(item, { type: 'none' })).toBeNull();
    });

    test('goalRecord builds { type, amount, unit, met, actual } and is null for no goal', () => {
        expect(GoalCheck.goalRecord({ type: 'amount', amount: 2, unit: 'drinks' }, false, 4)).toEqual({ type: 'amount', amount: 2, unit: 'drinks', met: false, actual: 4 });
        expect(GoalCheck.goalRecord({ type: 'time', amount: 60, unit: 'min' }, true, 18)).toEqual({ type: 'time', amount: 60, unit: 'min', met: true, actual: 18 });
        expect(GoalCheck.goalRecord({ type: 'note', note: 'No screens after 10 PM' }, true, 5)).toEqual({ type: 'note', amount: null, unit: null, met: true, actual: null });
        expect(GoalCheck.goalRecord({ type: 'none' }, true, null)).toBeNull();
        expect(GoalCheck.goalRecord(null, true, null)).toBeNull();
    });

    test('met is strictly the player\'s answer (anything but true is not met)', () => {
        expect(GoalCheck.goalRecord({ type: 'time', amount: 10 }, undefined, 99).met).toBe(false);
        expect(GoalCheck.goalRecord({ type: 'time', amount: 10 }, 'yes', 99).met).toBe(false);
    });
});
