/**
 * Schedule tests (session 14, 2026-07-18).
 *
 * js/schedule.js is a pure module (no CONFIG, no DOM) — required directly.
 * Covers the normalize/default/legacy helpers and isScheduledForDay across
 * daily, weekly (day-of-week subset), and monthly (with short-month clamping).
 */
const Schedule = require('../js/schedule.js');

// Reference dates (local time). getDay(): Sun=0.
const SAT = new Date(2026, 6, 18);   // Sat Jul 18 2026
const SUN = new Date(2026, 6, 19);   // Sun Jul 19 2026
const MON = new Date(2026, 6, 20);   // Mon Jul 20 2026

describe('defaultSchedule', () => {
    test('is daily, all seven days, no dayOfMonth', () => {
        expect(Schedule.defaultSchedule()).toEqual({
            frequency: 'daily',
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            dayOfMonth: null,
        });
    });

    test('returns a fresh daysOfWeek array each call (no shared mutation)', () => {
        const a = Schedule.defaultSchedule();
        a.daysOfWeek.push(99);
        expect(Schedule.defaultSchedule().daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});

describe('fromLegacyFrequency', () => {
    test("'daily' → every-day schedule", () => {
        expect(Schedule.fromLegacyFrequency('daily').daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    test("'weekly' → empty day set (forces an explicit pick)", () => {
        expect(Schedule.fromLegacyFrequency('weekly')).toEqual({
            frequency: 'weekly', daysOfWeek: [], dayOfMonth: null,
        });
    });

    test("'monthly' → dayOfMonth 1, no weekdays", () => {
        expect(Schedule.fromLegacyFrequency('monthly')).toEqual({
            frequency: 'monthly', daysOfWeek: [], dayOfMonth: 1,
        });
    });

    test('unknown/missing → daily (never un-spawnable)', () => {
        expect(Schedule.fromLegacyFrequency(undefined).frequency).toBe('daily');
        expect(Schedule.fromLegacyFrequency('garbage').frequency).toBe('daily');
    });
});

describe('normalize', () => {
    test('passes through a legacy frequency string', () => {
        expect(Schedule.normalize('daily').daysOfWeek).toHaveLength(7);
    });

    test('cleans an out-of-range day list and bad dayOfMonth', () => {
        const s = Schedule.normalize({ frequency: 'weekly', daysOfWeek: [1, 8, -3, 5], dayOfMonth: 99 });
        expect(s.daysOfWeek).toEqual([1, 5]);
        expect(s.dayOfMonth).toBeNull();
    });

    test('monthly with no dayOfMonth defaults to 1', () => {
        expect(Schedule.normalize({ frequency: 'monthly' }).dayOfMonth).toBe(1);
    });

    test('null/undefined → daily default', () => {
        expect(Schedule.normalize(null).frequency).toBe('daily');
        expect(Schedule.normalize(undefined).daysOfWeek).toHaveLength(7);
    });
});

describe('isScheduledForDay — daily & weekly', () => {
    test('daily fires every day', () => {
        expect(Schedule.isScheduledForDay('daily', SAT)).toBe(true);
        expect(Schedule.isScheduledForDay('daily', SUN)).toBe(true);
        expect(Schedule.isScheduledForDay('daily', MON)).toBe(true);
    });

    test('weekly fires only on chosen weekdays', () => {
        const weekdaysOnly = { frequency: 'weekly', daysOfWeek: [1, 2, 3, 4, 5], dayOfMonth: null };
        expect(Schedule.isScheduledForDay(weekdaysOnly, MON)).toBe(true);  // Mon
        expect(Schedule.isScheduledForDay(weekdaysOnly, SAT)).toBe(false); // Sat
        expect(Schedule.isScheduledForDay(weekdaysOnly, SUN)).toBe(false); // Sun
    });

    test('weekly with an empty day set never fires', () => {
        const none = { frequency: 'weekly', daysOfWeek: [], dayOfMonth: null };
        expect(Schedule.isScheduledForDay(none, SAT)).toBe(false);
    });
});

describe('isScheduledForDay — monthly', () => {
    test('fires on the matching day of month', () => {
        const s = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 18 };
        expect(Schedule.isScheduledForDay(s, SAT)).toBe(true);        // Jul 18
        expect(Schedule.isScheduledForDay(s, MON)).toBe(false);       // Jul 20
    });

    test('clamps to the last day of a short month (31 → Feb 28 in 2026)', () => {
        const s = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 31 };
        expect(Schedule.isScheduledForDay(s, new Date(2026, 1, 28))).toBe(true);  // Feb 28
        expect(Schedule.isScheduledForDay(s, new Date(2026, 1, 27))).toBe(false);
    });

    test('clamps to Feb 29 in a leap year (2028)', () => {
        const s = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 31 };
        expect(Schedule.isScheduledForDay(s, new Date(2028, 1, 29))).toBe(true);  // Feb 29
        expect(Schedule.isScheduledForDay(s, new Date(2028, 1, 28))).toBe(false);
    });

    test('day 15 fires only on the 15th, no clamping needed', () => {
        const s = { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 15 };
        expect(Schedule.isScheduledForDay(s, new Date(2026, 3, 15))).toBe(true);
        expect(Schedule.isScheduledForDay(s, new Date(2026, 3, 30))).toBe(false);
    });
});
