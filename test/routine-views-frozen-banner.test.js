/**
 * RoutineViews.buildFrozenBannerHtml — the frozen-routine explanation banner
 * inside the "Manage Routine" modal (sub-session 3, "Frozen routine slots"
 * UI, 2026-07-19). Pure HTML-string builder, no DOM — same style as other
 * pure-core tests. routineViews.js references FrozenSlots/CONFIG as bare
 * globals (loaded via <script> tags in the browser), so Node binds them from
 * the real modules before requiring routineViews.js.
 */
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
const RoutineViews = require('../js/ui/routineViews.js');

describe('buildFrozenBannerHtml', () => {
    test('returns an empty string for an unfrozen routine', () => {
        const routine = { id: 'r1', frozenState: null };
        expect(RoutineViews.buildFrozenBannerHtml(routine, [])).toBe('');
    });

    test('renders the offending habit name and avoidance progress when frozen', () => {
        const routine = { id: 'r1', frozenState: { frozenBy: 'h1', frozenAt: 'X' } };
        const definedHabits = [
            { id: 'h1', name: 'Junk Food', occurrenceHistory: [
                { date: '2026-07-17', success: true },
                { date: '2026-07-18', success: true },
            ] },
        ];
        const html = RoutineViews.buildFrozenBannerHtml(routine, definedHabits);
        expect(html).toContain('Junk Food');
        expect(html).toContain('2/3');
    });

    test('caps progress at the recovery threshold even with a longer avoided run', () => {
        const routine = { id: 'r1', frozenState: { frozenBy: 'h1', frozenAt: 'X' } };
        const definedHabits = [
            { id: 'h1', name: 'Junk Food', occurrenceHistory: [
                { date: '2026-07-15', success: true },
                { date: '2026-07-16', success: true },
                { date: '2026-07-17', success: true },
                { date: '2026-07-18', success: true },
            ] },
        ];
        const html = RoutineViews.buildFrozenBannerHtml(routine, definedHabits);
        expect(html).toContain('3/3');
    });

    test('falls back to a generic message if the offending habit cannot be found', () => {
        const routine = { id: 'r1', frozenState: { frozenBy: 'ghost', frozenAt: 'X' } };
        const html = RoutineViews.buildFrozenBannerHtml(routine, []);
        expect(html).toContain('frozen');
        expect(html).not.toContain('undefined');
    });

    test('mentions both recovery paths (avoidance and editing)', () => {
        const routine = { id: 'r1', frozenState: { frozenBy: 'h1', frozenAt: 'X' } };
        const definedHabits = [{ id: 'h1', name: 'Junk Food', occurrenceHistory: [] }];
        const html = RoutineViews.buildFrozenBannerHtml(routine, definedHabits);
        expect(html).toMatch(/avoid/i);
        expect(html).toMatch(/edit/i);
    });
});
