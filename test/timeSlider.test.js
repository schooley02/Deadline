/**
 * TimeSlider tests (Milestone 4, "Time slider (Today, then Week/Month
 * scopes)", Today scope only this session, 2026-07-20).
 *
 * js/timeSlider.js reads Clock and CONFIG as bare globals (movement.js/
 * clock.js precedent) — bind both from the real modules before requiring it.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
const TimeSlider = require('../js/timeSlider.js');

const DIMS = {
    gameScreenWidth: 1200,
    baseWidth: 100,
    habitEnemyWidth: 40,
};

describe('getDayBounds', () => {
    test('start is midnight of the reference day, end is midnight the next day', () => {
        const ref = new Date('2026-07-20T15:30:00');
        const { start, end } = TimeSlider.getDayBounds(ref);
        expect(start.toISOString()).toBe(new Date('2026-07-20T00:00:00').toISOString());
        expect(end.toISOString()).toBe(new Date('2026-07-21T00:00:00').toISOString());
    });
});

describe('minutesOfDayToTime / timeToMinutesOfDay round-trip', () => {
    const dayStart = new Date('2026-07-20T00:00:00');

    test('0 minutes is midnight', () => {
        expect(TimeSlider.minutesOfDayToTime(0, dayStart).toISOString())
            .toBe(dayStart.toISOString());
    });

    test('720 minutes is noon', () => {
        const t = TimeSlider.minutesOfDayToTime(720, dayStart);
        expect(t.getHours()).toBe(12);
        expect(t.getMinutes()).toBe(0);
    });

    test('1440 minutes is the next midnight', () => {
        const t = TimeSlider.minutesOfDayToTime(TimeSlider.MINUTES_PER_DAY, dayStart);
        expect(t.toISOString()).toBe(new Date('2026-07-21T00:00:00').toISOString());
    });

    test('timeToMinutesOfDay inverts minutesOfDayToTime', () => {
        [0, 1, 90, 720, 1439, 1440].forEach((mins) => {
            const t = TimeSlider.minutesOfDayToTime(mins, dayStart);
            expect(TimeSlider.timeToMinutesOfDay(t, dayStart)).toBe(mins);
        });
    });

    test('clamps below 0', () => {
        const before = new Date(dayStart.getTime() - 60 * 1000);
        expect(TimeSlider.timeToMinutesOfDay(before, dayStart)).toBe(0);
    });

    test('clamps above 1440', () => {
        const after = new Date(dayStart.getTime() + (25 * 60 * 60 * 1000));
        expect(TimeSlider.timeToMinutesOfDay(after, dayStart)).toBe(1440);
    });
});

describe('formatLabel', () => {
    test('midnight is 12:00 AM', () => {
        expect(TimeSlider.formatLabel(new Date('2026-07-20T00:00:00'))).toBe('12:00 AM');
    });

    test('noon is 12:00 PM', () => {
        expect(TimeSlider.formatLabel(new Date('2026-07-20T12:00:00'))).toBe('12:00 PM');
    });

    test('single-digit minutes are zero-padded', () => {
        expect(TimeSlider.formatLabel(new Date('2026-07-20T09:05:00'))).toBe('9:05 AM');
    });

    test('afternoon hour converts to 12-hour clock', () => {
        expect(TimeSlider.formatLabel(new Date('2026-07-20T15:45:00'))).toBe('3:45 PM');
    });

    test('11pm', () => {
        expect(TimeSlider.formatLabel(new Date('2026-07-20T23:00:00'))).toBe('11:00 PM');
    });
});

describe('getLurkerPreviewX', () => {
    test('before 8pm, sits at the fixed lurk post (matches loop.js live positioning)', () => {
        const t = new Date('2026-07-20T14:00:00');
        const expected = DIMS.gameScreenWidth - DIMS.habitEnemyWidth - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX;
        expect(TimeSlider.getLurkerPreviewX(t, DIMS)).toBe(expected);
    });

    test('at exactly 8pm, rides the midnight line', () => {
        const t = new Date('2026-07-20T20:00:00');
        expect(TimeSlider.getLurkerPreviewX(t, DIMS))
            .toBe(Clock.calculateMidnightLinePosition(t, DIMS));
    });

    test('closer to midnight, the line (and lurker) has advanced further left', () => {
        const early = TimeSlider.getLurkerPreviewX(new Date('2026-07-20T20:30:00'), DIMS);
        const late = TimeSlider.getLurkerPreviewX(new Date('2026-07-20T23:30:00'), DIMS);
        expect(late).toBeLessThan(early);
    });

    test('scrubbing back before 8pm returns to the lurk post, not a stale line position', () => {
        const afterLine = TimeSlider.getLurkerPreviewX(new Date('2026-07-20T21:00:00'), DIMS);
        const rewound = TimeSlider.getLurkerPreviewX(new Date('2026-07-20T10:00:00'), DIMS);
        expect(rewound).not.toBe(afterLine);
        expect(rewound).toBe(DIMS.gameScreenWidth - DIMS.habitEnemyWidth - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX);
    });
});

// Damage/regen projection (2026-07-20, same session — "the preview also
// needs to show base damage and freezes").
describe('ticksSinceOverdue', () => {
    const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS; // 5 min

    test('0 before the due date', () => {
        expect(TimeSlider.ticksSinceOverdue(1000000, 500000, INTERVAL)).toBe(0);
    });

    test('0 exactly at the due date', () => {
        expect(TimeSlider.ticksSinceOverdue(1000000, 1000000, INTERVAL)).toBe(0);
    });

    test('counts whole intervals elapsed since due', () => {
        const due = 0;
        expect(TimeSlider.ticksSinceOverdue(due, INTERVAL * 3.7, INTERVAL)).toBe(3);
    });
});

describe('damageTicksDelta', () => {
    const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;
    const due = 1000000;

    test('zero when neither now nor preview has reached the due date', () => {
        expect(TimeSlider.damageTicksDelta(due, due - 500, due - 100, INTERVAL)).toBe(0);
    });

    test('positive for a forward scrub past the due date (more ticks would fire)', () => {
        const now = due + 10; // just overdue, 0 ticks yet
        const preview = due + INTERVAL * 4.5; // 4 ticks would have fired
        expect(TimeSlider.damageTicksDelta(due, preview, now, INTERVAL)).toBe(4);
    });

    test('negative on rewind past a currently-overdue item (undoes not-yet-applied ticks)', () => {
        const now = due + INTERVAL * 4.5; // 4 ticks already "applied"
        const preview = due + 10; // rewound to just after due, 0 ticks
        expect(TimeSlider.damageTicksDelta(due, preview, now, INTERVAL)).toBe(-4);
    });

    test('rewinding before the item was even due fully undoes its contribution', () => {
        const now = due + INTERVAL * 2.5;
        const preview = due - 1000; // before due at all
        expect(TimeSlider.damageTicksDelta(due, preview, now, INTERVAL)).toBe(-2);
    });
});

describe('regenTicksDelta', () => {
    const INTERVAL = CONFIG.BASE_REGEN_INTERVAL_MS;

    test('0 when the anchor is null (regen never ticked yet)', () => {
        expect(TimeSlider.regenTicksDelta(null, 999999, 0, INTERVAL)).toBe(0);
    });

    test('positive for a forward scrub (more regen would have accrued)', () => {
        const anchor = 0;
        const now = 10;
        const preview = INTERVAL * 3.2;
        expect(TimeSlider.regenTicksDelta(anchor, preview, now, INTERVAL)).toBe(3);
    });

    test('negative on rewind (undoes not-yet-accrued regen)', () => {
        const anchor = 0;
        const now = INTERVAL * 3.2;
        const preview = 10;
        expect(TimeSlider.regenTicksDelta(anchor, preview, now, INTERVAL)).toBe(-3);
    });
});

describe('projectBaseHealth', () => {
    const DUE = 1000000;
    const NOW = DUE + 10; // just overdue

    function makeOverdueItem(dueMs) {
        return { dueDateTime: new Date(dueMs) };
    }

    test('at time === now, projects exactly the current health (zero delta)', () => {
        const items = [makeOverdueItem(DUE)];
        expect(TimeSlider.projectBaseHealth(items, 80, NOW, NOW, null)).toBe(80);
    });

    test('forward scrub past an overdue item subtracts projected damage', () => {
        const items = [makeOverdueItem(DUE)];
        const preview = DUE + CONFIG.DAMAGE_INTERVAL_MS * 3.5; // 3 ticks
        const projected = TimeSlider.projectBaseHealth(items, 80, preview, NOW, null);
        expect(projected).toBe(80 - 3 * CONFIG.OVERDUE_DAMAGE);
    });

    test('regen is netted against damage over the same window', () => {
        const items = []; // no damage sources
        const anchor = NOW - 10;
        const preview = anchor + CONFIG.BASE_REGEN_INTERVAL_MS * 2.5; // 2 regen ticks
        const projected = TimeSlider.projectBaseHealth(items, 50, preview, NOW, anchor);
        expect(projected).toBe(50 + 2 * CONFIG.BASE_REGEN_HP);
    });

    test('clamps at 0 (never shows negative projected health)', () => {
        const items = [makeOverdueItem(DUE)];
        const preview = DUE + CONFIG.DAMAGE_INTERVAL_MS * 500; // way more damage than current health
        const projected = TimeSlider.projectBaseHealth(items, 5, preview, NOW, null);
        expect(projected).toBe(0);
    });

    test('clamps at MAX_BASE_HEALTH (regen never overheals)', () => {
        const items = [];
        const anchor = NOW - 10;
        const preview = anchor + CONFIG.BASE_REGEN_INTERVAL_MS * 5000;
        const projected = TimeSlider.projectBaseHealth(items, 99, preview, NOW, anchor);
        expect(projected).toBe(CONFIG.MAX_BASE_HEALTH);
    });

    test('rewinding before a currently-overdue item raises projected health back', () => {
        const now = DUE + CONFIG.DAMAGE_INTERVAL_MS * 4.5; // 4 ticks already dealt
        const items = [makeOverdueItem(DUE)];
        const rewound = TimeSlider.projectBaseHealth(items, 96, DUE - 1000, now, null);
        expect(rewound).toBe(100); // all 4 ticks' worth of damage undone
    });
});

describe('projectRoutineHealthDeltas', () => {
    const DUE = 1000000;
    const NOW = DUE + 10;
    const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;

    test('items with no owning routine are skipped', () => {
        const items = [{ dueDateTime: new Date(DUE), id: 'a' }];
        const deltas = TimeSlider.projectRoutineHealthDeltas(items, DUE + INTERVAL * 2.5, NOW, () => null);
        expect(deltas).toEqual({});
    });

    test('sums damage ticks per routine across multiple owned items', () => {
        const items = [
            { dueDateTime: new Date(DUE), id: 'a', routineId: 'r1' },
            { dueDateTime: new Date(DUE), id: 'b', routineId: 'r1' },
            { dueDateTime: new Date(DUE), id: 'c', routineId: 'r2' },
        ];
        const preview = DUE + INTERVAL * 2.5; // 2 ticks per item
        const deltas = TimeSlider.projectRoutineHealthDeltas(items, preview, NOW, (item) => item.routineId);
        expect(deltas.r1).toBe(2 * 2 * CONFIG.OVERDUE_DAMAGE); // two items, 2 ticks each
        expect(deltas.r2).toBe(2 * CONFIG.OVERDUE_DAMAGE);
    });

    test('zero-delta items are omitted from the result entirely', () => {
        const items = [{ dueDateTime: new Date(DUE), id: 'a', routineId: 'r1' }];
        const deltas = TimeSlider.projectRoutineHealthDeltas(items, NOW, NOW, (item) => item.routineId);
        expect(deltas).toEqual({});
    });
});
