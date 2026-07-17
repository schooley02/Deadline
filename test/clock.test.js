/**
 * Clock tests (Milestone 2 extraction, 2026-07-17).
 *
 * Unlike the offline-catchup mirror test, js/clock.js is a real extracted
 * module with module.exports, so this requires it directly rather than
 * hand-maintaining a copy (see docs/ARCHITECTURE.md).
 */
const Clock = require('../js/clock.js');

const HOUR = 60 * 60 * 1000;
const DIMS = {
    gameScreenWidth: 1000,
    baseWidth: 100,
    enemyWidth: 60,
    habitEnemyWidth: 40
};

function makeItem(dueDateTime, type = 'task') {
    return { type, dueDateTime };
}

describe('calculateTimelinePosition', () => {
    test('overdue item sits at the base', () => {
        const now = new Date('2026-07-17T12:00:00');
        const item = makeItem(new Date('2026-07-17T11:59:59'));
        expect(Clock.calculateTimelinePosition(item, now, DIMS)).toBe(DIMS.baseWidth);
    });

    test('item due exactly now sits at the base', () => {
        const now = new Date('2026-07-17T12:00:00');
        const item = makeItem(new Date('2026-07-17T12:00:00'));
        expect(Clock.calculateTimelinePosition(item, now, DIMS)).toBe(DIMS.baseWidth);
    });

    // Note: `nextMidnight` is derived from the ITEM's own due date (due date
    // + 1 day, truncated to 00:00), so for any real Date it's always
    // strictly after the due date itself — the "due next day or later"
    // early-return branch can never trigger via a real item.dueDateTime; a
    // far-future item instead falls through to the >4h linear band using
    // *its own* time-of-day, however many days out it is. Documented here
    // rather than "fixed" since this extraction preserves script.js's
    // existing behavior byte-for-byte.
    test('a far-future due date still resolves via the >4h band (the "next day or later" branch is dead code for real Dates)', () => {
        const now = new Date('2026-07-17T12:00:00');
        const item = makeItem(new Date('2026-07-19T09:00:00'));
        // nextMidnight = 2026-07-20T00:00 (day after the due date, not "today"+1)
        const nextMidnight = new Date('2026-07-20T00:00:00').getTime();
        const timeToDue = item.dueDateTime.getTime() - now.getTime();
        const timeUntilMidnight = nextMidnight - now.getTime();
        const totalWidth = DIMS.gameScreenWidth - DIMS.baseWidth - DIMS.enemyWidth;
        const remainingTime = timeUntilMidnight - 4 * HOUR;
        const progress = (timeToDue - 4 * HOUR) / remainingTime;
        const expected = DIMS.baseWidth + totalWidth * 0.75 + totalWidth * 0.25 * progress;
        expect(Clock.calculateTimelinePosition(item, now, DIMS)).toBeCloseTo(expected, 5);
    });

    test('due in 2 hours sits at the 50% mark (progress=1 in the 0-2h band)', () => {
        const now = new Date('2026-07-17T12:00:00');
        const item = makeItem(new Date('2026-07-17T14:00:00'));
        const totalWidth = DIMS.gameScreenWidth - DIMS.baseWidth - DIMS.enemyWidth;
        const expected = DIMS.baseWidth + totalWidth * 0.5;
        expect(Clock.calculateTimelinePosition(item, now, DIMS)).toBeCloseTo(expected, 5);
    });

    test('due in 4 hours sits at the 75% mark', () => {
        const now = new Date('2026-07-17T12:00:00');
        const item = makeItem(new Date('2026-07-17T16:00:00'));
        const totalWidth = DIMS.gameScreenWidth - DIMS.baseWidth - DIMS.enemyWidth;
        const expected = DIMS.baseWidth + totalWidth * 0.75;
        expect(Clock.calculateTimelinePosition(item, now, DIMS)).toBeCloseTo(expected, 5);
    });

    test('due in 1 hour (within 2h band) is between base and the 50% mark', () => {
        const now = new Date('2026-07-17T12:00:00');
        const item = makeItem(new Date('2026-07-17T13:00:00'));
        const totalWidth = DIMS.gameScreenWidth - DIMS.baseWidth - DIMS.enemyWidth;
        const x = Clock.calculateTimelinePosition(item, now, DIMS);
        expect(x).toBeGreaterThan(DIMS.baseWidth);
        expect(x).toBeLessThan(DIMS.baseWidth + totalWidth * 0.5);
    });

    test('habit items use habitEnemyWidth, not enemyWidth, for available-width math', () => {
        const now = new Date('2026-07-17T12:00:00');
        const taskItem = makeItem(new Date('2026-07-17T14:00:00'), 'task');
        const habitItem = makeItem(new Date('2026-07-17T14:00:00'), 'habit');
        const taskX = Clock.calculateTimelinePosition(taskItem, now, DIMS);
        const habitX = Clock.calculateTimelinePosition(habitItem, now, DIMS);
        expect(habitX).not.toBe(taskX);
    });
});

describe('shouldShowMidnightLine', () => {
    test('hidden before 8pm', () => {
        expect(Clock.shouldShowMidnightLine(new Date('2026-07-17T19:59:00'))).toBe(false);
    });

    test('shown at and after 8pm', () => {
        expect(Clock.shouldShowMidnightLine(new Date('2026-07-17T20:00:00'))).toBe(true);
        expect(Clock.shouldShowMidnightLine(new Date('2026-07-17T23:30:00'))).toBe(true);
    });
});

describe('calculateMidnightLinePosition', () => {
    test('2 hours before midnight sits at the 50% mark', () => {
        const now = new Date('2026-07-17T22:00:00');
        const totalWidth = DIMS.gameScreenWidth - DIMS.baseWidth;
        const expected = DIMS.baseWidth + totalWidth * 0.5;
        expect(Clock.calculateMidnightLinePosition(now, DIMS)).toBeCloseTo(expected, 5);
    });

    test('more than 4 hours before midnight is fully off-screen right', () => {
        const now = new Date('2026-07-17T18:00:00');
        expect(Clock.calculateMidnightLinePosition(now, DIMS)).toBe(DIMS.gameScreenWidth);
    });

    test('just before midnight sits at the base (line about to reset for the new day)', () => {
        const now = new Date('2026-07-17T23:59:59.999');
        expect(Clock.calculateMidnightLinePosition(now, DIMS)).toBeCloseTo(DIMS.baseWidth, 1);
    });

    // `setHours(24, ...)` always rolls to the NEXT midnight, so at the exact
    // instant of midnight the "upcoming" midnight is a full 24h away, not 0 —
    // the line is off-screen right immediately after resetting, not at base.
    test('at the instant of midnight, the upcoming midnight is 24h away (off-screen right)', () => {
        const now = new Date('2026-07-18T00:00:00');
        expect(Clock.calculateMidnightLinePosition(now, DIMS)).toBe(DIMS.gameScreenWidth);
    });
});

describe('updateMidnightLine (DOM wrapper)', () => {
    function makeFakeElement() {
        return { style: {} };
    }

    test('hides the line before 8pm', () => {
        const el = makeFakeElement();
        Clock.updateMidnightLine(new Date('2026-07-17T15:00:00'), DIMS, el);
        expect(el.style.display).toBe('none');
    });

    test('shows and positions the line at/after 8pm', () => {
        const el = makeFakeElement();
        Clock.updateMidnightLine(new Date('2026-07-17T22:00:00'), DIMS, el);
        expect(el.style.display).toBe('block');
        expect(el.style.left).toBe(Clock.calculateMidnightLinePosition(new Date('2026-07-17T22:00:00'), DIMS) + 'px');
    });

    test('no-op when the DOM lookup finds nothing (element not yet in the DOM)', () => {
        // Passing null falls back to document.getElementById in real usage;
        // stub a minimal document for this one test since jest's testEnvironment is 'node'.
        const originalDocument = global.document;
        global.document = { getElementById: () => null };
        try {
            expect(() => Clock.updateMidnightLine(new Date(), DIMS, null)).not.toThrow();
        } finally {
            global.document = originalDocument;
        }
    });
});
