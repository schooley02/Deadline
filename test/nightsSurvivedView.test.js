/**
 * NightsSurvivedView — pure counting + sizing helpers (2026-10-26).
 * DOM init/render are live-checked, not unit-tested (UI-module convention).
 */
const NightsSurvivedView = require('../js/ui/nightsSurvivedView.js');

const { countMidnights, digitClass, label } = NightsSurvivedView;

function at(y, m, d, hh = 0, mm = 0) {
    return new Date(y, m, d, hh, mm, 0, 0).getTime();
}

describe('NightsSurvivedView.countMidnights', () => {
    test('0 within the same calendar day', () => {
        expect(countMidnights(at(2026, 9, 26, 0, 5), at(2026, 9, 26, 23, 59))).toBe(0);
    });

    test('a run started at 11pm counts 1 night at 12:00am', () => {
        expect(countMidnights(at(2026, 9, 26, 23, 0), at(2026, 9, 27, 0, 0))).toBe(1);
    });

    test('counts midnights, not 24h periods', () => {
        // 9pm -> 3am two days later is only 30h, but crosses two midnights.
        expect(countMidnights(at(2026, 9, 26, 21, 0), at(2026, 9, 28, 3, 0))).toBe(2);
    });

    test('a full week', () => {
        expect(countMidnights(at(2026, 9, 1, 12, 0), at(2026, 9, 8, 12, 0))).toBe(7);
    });

    test('crosses month and year boundaries', () => {
        expect(countMidnights(at(2026, 11, 31, 22, 0), at(2027, 0, 1, 1, 0))).toBe(1);
    });

    test('DST change does not skip or double a night', () => {
        // US fall-back (Nov 1 2026) and spring-forward (Mar 8 2026) days; the
        // calendar-date count is exact in any timezone the suite runs in.
        expect(countMidnights(at(2026, 9, 31, 12, 0), at(2026, 10, 2, 12, 0))).toBe(2);
        expect(countMidnights(at(2026, 2, 7, 12, 0), at(2026, 2, 9, 12, 0))).toBe(2);
    });

    test('missing / invalid start or a start in the future gives 0', () => {
        const now = at(2026, 9, 26, 12, 0);
        expect(countMidnights(null, now)).toBe(0);
        expect(countMidnights(undefined, now)).toBe(0);
        expect(countMidnights(NaN, now)).toBe(0);
        expect(countMidnights(at(2026, 9, 28, 12, 0), now)).toBe(0);
    });
});

describe('NightsSurvivedView.digitClass', () => {
    test('1-2 digits use the large size', () => {
        expect(digitClass(0)).toBe('nights-count--d2');
        expect(digitClass(7)).toBe('nights-count--d2');
        expect(digitClass(99)).toBe('nights-count--d2');
    });

    test('3 digits step down, 4+ step down again', () => {
        expect(digitClass(100)).toBe('nights-count--d3');
        expect(digitClass(999)).toBe('nights-count--d3');
        expect(digitClass(1000)).toBe('nights-count--d4');
    });
});

describe('NightsSurvivedView.label', () => {
    test('singular and plural', () => {
        expect(label(1)).toBe('1 night survived');
        expect(label(0)).toBe('0 nights survived');
        expect(label(12)).toBe('12 nights survived');
    });
});
