/**
 * DayRollover — pure day-advance detection + stale-instance selection
 * (day-advance mechanism, 2026-07-19). Pure module, required directly.
 */
const DayRollover = require('../js/dayRollover.js');

function at(y, m, d, hh = 0, mm = 0) {
    return new Date(y, m, d, hh, mm, 0, 0);
}

describe('DayRollover.startOfDay', () => {
    test('zeroes the time to local midnight', () => {
        const s = DayRollover.startOfDay(at(2026, 6, 19, 22, 30));
        expect(s.getHours()).toBe(0);
        expect(s.getMinutes()).toBe(0);
        expect(s.getFullYear()).toBe(2026);
        expect(s.getDate()).toBe(19);
    });

    test('does not mutate the input', () => {
        const input = at(2026, 6, 19, 22, 30);
        DayRollover.startOfDay(input);
        expect(input.getHours()).toBe(22);
    });
});

describe('DayRollover.hasDayRolledOver', () => {
    test('false within the same calendar day (even hours apart)', () => {
        expect(DayRollover.hasDayRolledOver(at(2026, 6, 19, 8, 0), at(2026, 6, 19, 23, 59))).toBe(false);
    });

    test('true when now is the next calendar day', () => {
        expect(DayRollover.hasDayRolledOver(at(2026, 6, 19, 23, 0), at(2026, 6, 20, 0, 1))).toBe(true);
    });

    test('true across a multi-day gap', () => {
        expect(DayRollover.hasDayRolledOver(at(2026, 6, 19), at(2026, 6, 25))).toBe(true);
    });

    test('false when now is EARLIER than the saved day (clock skew / never negative rollover)', () => {
        expect(DayRollover.hasDayRolledOver(at(2026, 6, 20), at(2026, 6, 19, 12, 0))).toBe(false);
    });

    test('false for a missing or invalid saved date', () => {
        expect(DayRollover.hasDayRolledOver(null, at(2026, 6, 20))).toBe(false);
        expect(DayRollover.hasDayRolledOver(undefined, at(2026, 6, 20))).toBe(false);
        expect(DayRollover.hasDayRolledOver(new Date('nope'), at(2026, 6, 20))).toBe(false);
    });
});

describe('DayRollover.selectStaleRecurringInstances', () => {
    const today = at(2026, 6, 20, 9, 0);

    function inst(overrides) {
        return {
            type: 'habit', definitionId: 'def1',
            originalDueDate: at(2026, 6, 19, 12, 0), // yesterday
            ...overrides,
        };
    }

    test('selects a prior-day habit instance', () => {
        const items = [inst()];
        expect(DayRollover.selectStaleRecurringInstances(items, today)).toEqual(items);
    });

    test('selects a prior-day routine task instance (type task WITH definitionId)', () => {
        const rt = inst({ type: 'task', definitionId: 'taskDef1' });
        expect(DayRollover.selectStaleRecurringInstances([rt], today)).toEqual([rt]);
    });

    test('excludes an instance already dated TODAY', () => {
        const t = inst({ originalDueDate: at(2026, 6, 20, 12, 0) });
        expect(DayRollover.selectStaleRecurringInstances([t], today)).toEqual([]);
    });

    test('excludes a one-off task (no definitionId), even if overdue from yesterday', () => {
        const oneOff = { type: 'task', originalDueDate: at(2026, 6, 19, 12, 0) };
        expect(DayRollover.selectStaleRecurringInstances([oneOff], today)).toEqual([]);
    });

    test('excludes a sub-task (no definitionId, has parentId)', () => {
        const sub = { type: 'task', parentId: 5, originalDueDate: at(2026, 6, 19, 12, 0) };
        expect(DayRollover.selectStaleRecurringInstances([sub], today)).toEqual([]);
    });

    test('excludes an instance with no originalDueDate', () => {
        const noDue = inst({ originalDueDate: undefined });
        expect(DayRollover.selectStaleRecurringInstances([noDue], today)).toEqual([]);
    });

    test('mixed board: keeps only prior-day recurring instances', () => {
        const priorHabit = inst({ id: 1 });
        const priorRoutineTask = inst({ id: 2, type: 'task', definitionId: 'td' });
        const todayHabit = inst({ id: 3, originalDueDate: at(2026, 6, 20, 12, 0) });
        const oneOff = { id: 4, type: 'task', originalDueDate: at(2026, 6, 18) };
        const result = DayRollover.selectStaleRecurringInstances(
            [priorHabit, priorRoutineTask, todayHabit, oneOff], today
        );
        expect(result).toEqual([priorHabit, priorRoutineTask]);
    });
});

// Sub-session 4 ([P1-DATA-005], check-in prompt, 2026-07-19): classifies
// which stale day is "the previous day" (check-in eligible) vs older
// (still auto-avoids). See state.js's rollover routing.
describe('DayRollover.isFromPreviousDay', () => {
    const today = at(2026, 6, 20, 9, 0);

    test('true for yesterday, any time of day', () => {
        expect(DayRollover.isFromPreviousDay(at(2026, 6, 19, 0, 1), today)).toBe(true);
        expect(DayRollover.isFromPreviousDay(at(2026, 6, 19, 23, 59), today)).toBe(true);
    });

    test('false for today', () => {
        expect(DayRollover.isFromPreviousDay(at(2026, 6, 20, 8, 0), today)).toBe(false);
    });

    test('false for two days ago or older (session 26 auto-avoid default applies instead)', () => {
        expect(DayRollover.isFromPreviousDay(at(2026, 6, 18, 12, 0), today)).toBe(false);
        expect(DayRollover.isFromPreviousDay(at(2026, 6, 10), today)).toBe(false);
    });
});
