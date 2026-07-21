/**
 * Regression tests for the Add Task default due-time rule (Milestone 5 UX
 * batch, playtest finding #2, 2026-07-20 — see DECISIONS.md).
 *
 * The bug: Add Task's due-time input was hardcoded to "17:00" (5:00 PM) no
 * matter when the task was created. Creating a task in the evening (after
 * 5 PM) with an untouched default therefore spawned it ALREADY OVERDUE,
 * damaging the base from the moment it was added.
 *
 * The fix (Fable design call): default = max(5:00 PM, now + 1h rounded UP
 * to the next half-hour), capped at 11:59 PM same day (never rolls into
 * tomorrow).
 *
 * TZ-independence: all cases construct `now` with the LOCAL Date
 * constructor and assert against local wall-clock HH:MM, matching the
 * existing popups-prefill.test.js convention.
 */

const Forms = require('../js/ui/forms.js');

describe('computeDefaultDueTime', () => {
    test('daytime: now + 1h rounds to before 5 PM -> keeps the familiar 5 PM anchor', () => {
        const now = new Date(2026, 6, 20, 10, 0); // 10:00 AM
        expect(Forms.computeDefaultDueTime(now)).toBe('17:00');
    });

    test('daytime: now + 1h rounds to exactly 5 PM -> still 5 PM (no double-counting)', () => {
        const now = new Date(2026, 6, 20, 16, 0); // 4:00 PM -> +1h = 5:00 PM exactly
        expect(Forms.computeDefaultDueTime(now)).toBe('17:00');
    });

    test('just past the 5 PM anchor: now + 1h rounds up past 5 PM -> uses the rounded time', () => {
        const now = new Date(2026, 6, 20, 16, 20); // 4:20 PM -> +1h = 5:20 PM -> round up to 5:30 PM
        expect(Forms.computeDefaultDueTime(now)).toBe('17:30');
    });

    test('evening: the exact playtest-finding repro (7:35 PM) never lands already-overdue', () => {
        const now = new Date(2026, 6, 20, 19, 35); // 7:35 PM -> +1h = 8:35 PM -> round up to 9:00 PM
        expect(Forms.computeDefaultDueTime(now)).toBe('21:00');
    });

    test('rounds UP to the next half-hour boundary, never down', () => {
        const now = new Date(2026, 6, 20, 18, 1); // 6:01 PM -> +1h = 7:01 PM -> round up to 7:30 PM
        expect(Forms.computeDefaultDueTime(now)).toBe('19:30');
    });

    test('exact half-hour boundary is left unchanged by rounding', () => {
        const now = new Date(2026, 6, 20, 19, 30); // 7:30 PM -> +1h = 8:30 PM exactly
        expect(Forms.computeDefaultDueTime(now)).toBe('20:30');
    });

    test('late night: caps at 11:59 PM same day instead of rolling into tomorrow', () => {
        const now = new Date(2026, 6, 20, 23, 45); // 11:45 PM -> +1h = 12:45 AM next day, capped
        expect(Forms.computeDefaultDueTime(now)).toBe('23:59');
    });

    test('right at the cap boundary: exactly 11:59 PM stays capped, not rounded past midnight', () => {
        const now = new Date(2026, 6, 20, 22, 59); // 10:59 PM -> +1h = 11:59 PM -> round up to 12:00 AM -> capped to 23:59
        expect(Forms.computeDefaultDueTime(now)).toBe('23:59');
    });

    test('createTaskFormHtml embeds the computed default as the time input value', () => {
        const now = new Date(2026, 6, 20, 19, 35);
        const originalDate = global.Date;
        global.Date = class extends originalDate {
            constructor(...args) {
                if (args.length === 0) return new originalDate(now.getTime());
                return new originalDate(...args);
            }
        };
        try {
            const html = Forms.createTaskFormHtml();
            expect(html).toContain('id="modalDueTime" value="21:00"');
        } finally {
            global.Date = originalDate;
        }
    });
});
