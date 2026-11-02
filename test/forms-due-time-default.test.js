/**
 * Add Task default due time.
 *
 * 2026-11-01 (Jeremy): Add Task / Build habit opened with Start = now, Due = now + 1 hour (capped 23:59),
 * 2026-11-02 (Jeremy): Add Task now opens with Start BLANK (the habit custom pair keeps Start = now),
 * superseding the 2026-10-27 "now + 5 min" default. An untouched or
 * just-passed time is nudged 5 minutes ahead on submit so a new task never
 * spawns already attacking (the original 2026-07-20 playtest bug).
 *
 * TZ-independence: `now` is built with the LOCAL Date constructor and asserts
 * use local wall-clock HH:MM.
 */

global.Schedule = require('../js/schedule.js');
const Forms = require('../js/ui/forms.js');

describe('computeDefaultWindow / computeDefaultDueTime / computeDefaultDueDate', () => {
    test('Start is the current local time, Due is one hour later (HH:MM)', () => {
        expect(Forms.computeDefaultWindow(new Date(2026, 6, 20, 8, 5)))
            .toEqual({ date: '2026-07-20', start: '08:05', due: '09:05' });
        expect(Forms.computeDefaultDueTime(new Date(2026, 6, 20, 19, 35, 42))).toBe('20:35');
        expect(Forms.computeDefaultDueDate(new Date(2026, 6, 20, 19, 35))).toBe('2026-07-20');
    });

    test('Due is capped at 23:59 today (never rolls into tomorrow)', () => {
        const late = new Date(2026, 6, 20, 23, 10);
        expect(Forms.computeDefaultWindow(late)).toEqual({ date: '2026-07-20', start: '23:10', due: '23:59' });
        expect(Forms.computeDefaultDueDate(new Date(2026, 6, 20, 23, 57))).toBe('2026-07-20');
    });

    test('Start is left blank when there is no room before the cap', () => {
        expect(Forms.computeDefaultWindow(new Date(2026, 6, 20, 23, 59)))
            .toEqual({ date: '2026-07-20', start: '', due: '23:59' });
    });

    test('createTaskFormHtml leaves Start blank and prefills Due = now + 1h (Due remembered as data-prefilled)', () => {
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
            expect(html).toContain('id="modalDueTime" value="20:35" data-prefilled="20:35"');
            // 2026-11-02 (Jeremy): Start is opt-in on Add Task, so the zombie walks by its due time.
            expect(html).toContain('id="modalStartTime" value=""');
            expect(html).toContain('id="modalDueDate" value="2026-07-20"');
        } finally {
            global.Date = originalDate;
        }
    });

    test('createHabitFormHtml prefills the (hidden) custom Start/End pair the same way', () => {
        const html = Forms.createHabitFormHtml(new Date(2026, 6, 20, 9, 0));
        expect(html).toContain('id="modalHabitStartTime"');
        expect(html).toMatch(/id="modalHabitStartTime"[^>]*value="09:00"/);
        expect(html).toMatch(/id="modalHabitEndTime"[^>]*value="10:00"/);
    });
});

describe('resolveSubmittedDueTime', () => {
    const now = new Date(2026, 6, 20, 19, 35, 30);

    test('untouched default (now) is bumped 5 minutes ahead', () => {
        expect(Forms.resolveSubmittedDueTime('2026-07-20', '19:35', '19:35', now))
            .toEqual({ dueDate: '2026-07-20', dueTime: '19:40' });
    });

    test('untouched default left open a long time is still bumped', () => {
        const later = new Date(2026, 6, 20, 20, 10);
        expect(Forms.resolveSubmittedDueTime('2026-07-20', '19:35', '19:35', later))
            .toEqual({ dueDate: '2026-07-20', dueTime: '20:15' });
    });

    test('a just-passed time typed by the user is bumped too', () => {
        expect(Forms.resolveSubmittedDueTime('2026-07-20', '19:32', '19:30', now))
            .toEqual({ dueDate: '2026-07-20', dueTime: '19:40' });
    });

    test('a deliberately earlier time (more than 5 min ago) is kept', () => {
        expect(Forms.resolveSubmittedDueTime('2026-07-20', '18:00', '19:35', now))
            .toEqual({ dueDate: '2026-07-20', dueTime: '18:00' });
    });

    test('a future time is kept as-is', () => {
        expect(Forms.resolveSubmittedDueTime('2026-07-20', '21:00', '19:35', now))
            .toEqual({ dueDate: '2026-07-20', dueTime: '21:00' });
    });

    test('the bump rolls into tomorrow near midnight', () => {
        const late = new Date(2026, 6, 20, 23, 58);
        expect(Forms.resolveSubmittedDueTime('2026-07-20', '23:58', '23:58', late))
            .toEqual({ dueDate: '2026-07-21', dueTime: '00:03' });
    });
});
