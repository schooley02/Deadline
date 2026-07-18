/**
 * Regression tests for the UTC pre-fill bug in js/ui/popups.js
 * (found 2026-07-18 during session 6 live verification; fixed 2026-07-18).
 *
 * The bug: showEditTaskModal and createSubTaskPrompt pre-filled their
 * date/time <input>s from dueDateTime.toISOString() (UTC), while the save
 * handler parses `${date}T${time}` as LOCAL time. Opening Edit Task and
 * pressing Save Changes without touching anything therefore shifted the due
 * time forward by the UTC offset — and for evening tasks rolled the DATE to
 * the next day. First test coverage of modal pre-fill.
 *
 * TZ-independence: these tests construct Dates with the LOCAL constructor
 * (new Date(y, m, d, h, min)) and assert against local wall-clock values, so
 * they pass identically in any timezone (including the UTC sandbox, where
 * the old toISOString approach would coincidentally pass too). The invariant
 * that actually pins the corruption fix is the ROUND-TRIP test: formatting
 * then re-parsing must reproduce the original instant exactly, in every
 * timezone. Under the old UTC formatting that only held at offset 0.
 */

const Popups = require('../js/ui/popups.js');

describe('formatDateInputValue', () => {
    test('formats a local date as YYYY-MM-DD', () => {
        const d = new Date(2026, 6, 18, 12, 0); // July 18, 2026, noon LOCAL
        expect(Popups.formatDateInputValue(d)).toBe('2026-07-18');
    });

    test('keeps the LOCAL calendar date for an evening time (the date-roll case)', () => {
        // 11 PM local. Under toISOString() in any negative-offset TZ (e.g.
        // CDT), the UTC date is already tomorrow — the exact corruption seen
        // live: an evening task's date rolled to the next day on save.
        const d = new Date(2026, 6, 18, 23, 0);
        expect(Popups.formatDateInputValue(d)).toBe('2026-07-18');
    });

    test('zero-pads single-digit month and day', () => {
        const d = new Date(2026, 0, 5, 9, 0); // Jan 5
        expect(Popups.formatDateInputValue(d)).toBe('2026-01-05');
    });
});

describe('formatTimeInputValue', () => {
    test('formats local wall-clock time as HH:MM', () => {
        const d = new Date(2026, 6, 18, 12, 0); // noon LOCAL — the live-found
        // case: row showed 12:00 PM, modal pre-filled 05:00 PM (UTC in CDT).
        expect(Popups.formatTimeInputValue(d)).toBe('12:00');
    });

    test('zero-pads hours and minutes, including midnight', () => {
        expect(Popups.formatTimeInputValue(new Date(2026, 6, 18, 0, 0))).toBe('00:00');
        expect(Popups.formatTimeInputValue(new Date(2026, 6, 18, 9, 5))).toBe('09:05');
    });

    test('drops seconds (time input is HH:MM)', () => {
        expect(Popups.formatTimeInputValue(new Date(2026, 6, 18, 17, 30, 45))).toBe('17:30');
    });
});

describe('round-trip: pre-fill then untouched Save must not move the due time', () => {
    // Mirrors the save handler exactly: item.dueDateTime =
    // new Date(`${newDueDate}T${newDueTime}`), which parses as LOCAL time.
    const roundTrip = (d) =>
        new Date(`${Popups.formatDateInputValue(d)}T${Popups.formatTimeInputValue(d)}`);

    test.each([
        ['noon (the live-found case)', new Date(2026, 6, 18, 12, 0)],
        ['evening (date-roll case)', new Date(2026, 6, 18, 23, 30)],
        ['midnight', new Date(2026, 6, 18, 0, 0)],
        ['new year boundary', new Date(2025, 11, 31, 23, 59)],
        ['single-digit fields', new Date(2026, 0, 5, 9, 5)],
    ])('%s survives unchanged', (_label, original) => {
        expect(roundTrip(original).getTime()).toBe(original.getTime());
    });

    test('negative control: the OLD toISOString pre-fill drifts by the UTC offset', () => {
        const original = new Date(2026, 6, 18, 12, 0);
        const oldDate = original.toISOString().split('T')[0];
        const oldTime = original.toISOString().split('T')[1].substring(0, 5);
        const reSaved = new Date(`${oldDate}T${oldTime}`);
        const driftMs = reSaved.getTime() - original.getTime();
        // Drift equals the timezone offset — zero only when running in UTC.
        expect(driftMs).toBe(original.getTimezoneOffset() * 60 * 1000);
    });
});
