/**
 * Routine Performance rendering — StatsView.formatCompletionRate / formatStars /
 * buildRoutineEntryRow against the REAL run-record shape.
 *
 * Regression for the finalizeRun {rate,samples} bug (found session 64, fixed
 * session 67): a run record stores completionRate as the RAW { rate, samples }
 * object returned by Heroes.completionRate (persistence.js's 10→11 sweep +
 * the Steady Hands live path both read `.rate` off it) — NOT a bare number.
 * statsView used to treat it as a number, so the Routine Performance section
 * silently showed "—" for completion and "0★" for every past run since
 * session 55. These tests pin the object-shape unwrap.
 *
 * Requires the REAL module (agenda-list.test.js / stats-achievements.test.js
 * precedent). renderStatsWindow's DOM wiring stays live-verified in Chrome.
 */
const StatsView = require('../js/ui/statsView.js');

describe('formatCompletionRate — unwraps the { rate, samples } object', () => {
    test('rated routine renders the percentage from .rate', () => {
        expect(StatsView.formatCompletionRate({ rate: 0.92, samples: 10 })).toBe('92%');
        expect(StatsView.formatCompletionRate({ rate: 0, samples: 4 })).toBe('0%');
        expect(StatsView.formatCompletionRate({ rate: 1, samples: 8 })).toBe('100%');
    });

    test('unrated routine (rate null / no samples) renders the em dash', () => {
        expect(StatsView.formatCompletionRate({ rate: null, samples: 0 })).toBe('—');
    });

    test('missing/null completionRate renders the em dash', () => {
        expect(StatsView.formatCompletionRate(null)).toBe('—');
        expect(StatsView.formatCompletionRate(undefined)).toBe('—');
    });

    test('a bare number is NOT treated as a rate (guards against regressing to the old shape)', () => {
        // The old code did `typeof rate === 'number'` and would have rendered
        // "92%" here; the record never actually carries a bare number, so the
        // object-shape contract must reject it rather than silently accept.
        expect(StatsView.formatCompletionRate(0.92)).toBe('—');
    });
});

describe('formatStars', () => {
    test('renders a numeric star count', () => {
        expect(StatsView.formatStars(4)).toBe('4★');
        expect(StatsView.formatStars(0)).toBe('0★');
    });

    test('null stars (unrated routine) renders the em dash', () => {
        expect(StatsView.formatStars(null)).toBe('—');
    });
});

describe('buildRoutineEntryRow — full past-run row', () => {
    test('rated routine shows real stars and completion percentage', () => {
        const html = StatsView.buildRoutineEntryRow({
            runNumber: 3, level: 4, stars: 4,
            completionRate: { rate: 0.92, samples: 10 }, memberDamage: 25,
            wasFrozenAtEnd: false, wasKOdAtEnd: true,
        });
        expect(html).toContain('Run #3');
        expect(html).toContain('Lv4 4★');
        expect(html).toContain('92%');
        expect(html).toContain('-25 dmg');
        expect(html).toContain("KO'd");
        expect(html).not.toContain('—');
    });

    test('unrated routine shows em dashes for stars and completion', () => {
        const html = StatsView.buildRoutineEntryRow({
            runNumber: 1, level: 1, stars: null,
            completionRate: { rate: null, samples: 0 }, memberDamage: 0,
            wasFrozenAtEnd: false, wasKOdAtEnd: false,
        });
        expect(html).toContain('Lv1 —');   // stars em dash
        // completion metric column also em dash
        expect((html.match(/—/g) || []).length).toBe(2);
    });
});
