/**
 * ViewTimeLook (pure core of the past / future canvas look, 2026-11-19; DECISIONS 2026-11-19 (view-time look)).
 */
const ViewTimeLook = require('../js/viewTimeLook.js');

const NOW = new Date(2026, 10, 19, 12, 0, 0);
const at = (h, m = 0, day = 19) => new Date(2026, 10, day, h, m, 0);

describe('classify', () => {
    test('live is always the present, whatever the time', () => {
        expect(ViewTimeLook.classify(at(3), NOW, true)).toBeNull();
        expect(ViewTimeLook.classify(at(9, 0, 22), NOW, true)).toBeNull();
    });
    test('earlier is past, later is future', () => {
        expect(ViewTimeLook.classify(at(9), NOW, false)).toBe('past');
        expect(ViewTimeLook.classify(at(0, 0, 18), NOW, false)).toBe('past'); // Yesterday at 12:00 AM
        expect(ViewTimeLook.classify(at(15), NOW, false)).toBe('future');
        expect(ViewTimeLook.classify(at(0, 0, 20), NOW, false)).toBe('future'); // Tomorrow at 12:00 AM
    });
    test('a handle parked on the current minute is the present', () => {
        expect(ViewTimeLook.classify(new Date(NOW.getTime() + 30 * 1000), NOW, false)).toBeNull();
        expect(ViewTimeLook.classify(new Date(NOW.getTime() - 59 * 1000), NOW, false)).toBeNull();
        expect(ViewTimeLook.classify(new Date(NOW.getTime() - ViewTimeLook.PRESENT_MS), NOW, false)).toBe('past');
    });
    test('takes numbers too; bad input = null', () => {
        expect(ViewTimeLook.classify(at(9).getTime(), NOW.getTime(), false)).toBe('past');
        expect(ViewTimeLook.classify(null, NOW, false)).toBeNull();
        expect(ViewTimeLook.classify(at(9), 'x', false)).toBeNull();
    });
});

describe('stampParts', () => {
    test('past and future marks with a short date and 12-hour time', () => {
        expect(ViewTimeLook.stampParts(at(15, 40, 18), 'past')).toEqual({ mark: '◀◀ PLAYBACK', text: 'NOV 18 · 3:40 PM' });
        expect(ViewTimeLook.stampParts(at(9, 5, 20), 'future')).toEqual({ mark: '▶▶ FORECAST', text: 'NOV 20 · 9:05 AM' });
    });
    test('midnight and noon read 12', () => {
        expect(ViewTimeLook.stampParts(at(0, 0), 'past').text).toBe('NOV 19 · 12:00 AM');
        expect(ViewTimeLook.stampParts(at(12, 0), 'future').text).toBe('NOV 19 · 12:00 PM');
    });
    test('no kind or a bad time = null', () => {
        expect(ViewTimeLook.stampParts(at(9), null)).toBeNull();
        expect(ViewTimeLook.stampParts(at(9), 'present')).toBeNull();
        expect(ViewTimeLook.stampParts('soon', 'past')).toBeNull();
    });
});
