/**
 * DayPagerView tests — pure-only coverage (Week scope sub-session 2,
 * 2026-07-20 session 71). `jest.config.js` runs testEnvironment: 'node'
 * (no DOM), matching the established convention for this codebase's UI
 * modules (statsView.js/shopView.js precedent, see their file headers):
 * pure string/label builders get Jest, DOM rendering (render/goToOffset/
 * checkRolloverReset — all touch `document`) stays live-verified in Chrome.
 *
 * formatDayLabel is the one exported function with zero DOM dependency.
 */
const DayPagerView = require('../js/ui/dayPagerView.js');

describe('DayPagerView.formatDayLabel', () => {
    test('offset -1 is always "Yesterday" regardless of the actual date (sub-session 3)', () => {
        const bounds = { start: new Date(2026, 6, 19) };
        expect(DayPagerView.formatDayLabel(-1, bounds)).toBe('Yesterday');
    });

    test('offset 0 is always "Today" regardless of the actual date', () => {
        const bounds = { start: new Date(2026, 6, 20) };
        expect(DayPagerView.formatDayLabel(0, bounds)).toBe('Today');
    });

    test('offset 1 is always "Tomorrow"', () => {
        const bounds = { start: new Date(2026, 6, 21) };
        expect(DayPagerView.formatDayLabel(1, bounds)).toBe('Tomorrow');
    });

    test('offset 2+ renders "<Weekday> · <Mon D>"', () => {
        const bounds = { start: new Date(2026, 6, 23) }; // Thu Jul 23 2026
        expect(DayPagerView.formatDayLabel(3, bounds)).toBe('Thu · Jul 23');
    });

    test('offset 6 (max) still renders the weekday/date form', () => {
        const bounds = { start: new Date(2026, 6, 26) }; // Sun Jul 26 2026
        expect(DayPagerView.formatDayLabel(6, bounds)).toBe('Sun · Jul 26');
    });
});
