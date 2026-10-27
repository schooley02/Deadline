/**
 * Add Task default due time.
 *
 * 2026-10-27 (Jeremy): the time input defaults to the CURRENT time (supersedes
 * the 2026-07-20 "max(5 PM, now + 1h rounded to :30)" rule). An untouched or
 * just-passed time is nudged 5 minutes ahead on submit so a new task never
 * spawns already attacking (the original 2026-07-20 playtest bug).
 *
 * TZ-independence: `now` is built with the LOCAL Date constructor and asserts
 * use local wall-clock HH:MM.
 */

const Forms = require('../js/ui/forms.js');

describe('computeDefaultDueTime', () => {
    test('is the current local time (HH:MM)', () => {
        expect(Forms.computeDefaultDueTime(new Date(2026, 6, 20, 8, 5))).toBe('08:05');
        expect(Forms.computeDefaultDueTime(new Date(2026, 6, 20, 19, 35, 42))).toBe('19:35');
        expect(Forms.computeDefaultDueTime(new Date(2026, 6, 20, 0, 0))).toBe('00:00');
    });

    test('createTaskFormHtml embeds it as the value and remembers it as data-prefilled', () => {
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
            expect(html).toContain('id="modalDueTime" value="19:35" data-prefilled="19:35"');
        } finally {
            global.Date = originalDate;
        }
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
