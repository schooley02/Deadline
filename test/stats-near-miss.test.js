/**
 * Near-miss nudges rendering — StatsView.buildNearMissSection (ACHIEVEMENTS_PLAN.md
 * sub-session 4, "Almost there" polish, 2026-07-20 session 68).
 *
 * Requires the REAL module (agenda-list.test.js / stats-achievements.test.js
 * precedent). buildNearMissSection reads Achievements + CONFIG as globals
 * (same convention as movement.js/spawning.js — <script> tags in the
 * browser, bound explicitly here for the Node test env, per test/setup.js's
 * header comment). renderStatsWindow's DOM wiring stays live-verified in
 * Chrome.
 */
global.Achievements = require('../js/achievements.js');
global.CONFIG = require('../js/config.js');
const StatsView = require('../js/ui/statsView.js');

// Round thresholds chosen so 80% (CONFIG.NEAR_MISS_THRESHOLD_PCT) lands on
// whole numbers, keeping the fixtures readable.
const catalog = [
    {
        id: 'survivor', name: 'Survivor', metric: 'bestRunDaysSurvived', nearMissUnit: 'day',
        tiers: [
            { id: 'survivor_1', label: 'Bronze', threshold: 5 },
            { id: 'survivor_2', label: 'Silver', threshold: 10 },
        ],
    },
    {
        id: 'back_in_black', name: 'Back in Black', metric: 'pointsRecoveries', nearMissUnit: null,
        tiers: [{ id: 'back_in_black_1', label: null, threshold: 1 }],
    },
];

describe('buildNearMissSection', () => {
    test('renders a nudge line for a family at exactly the threshold pct of its next tier', () => {
        const html = StatsView.buildNearMissSection(catalog, { bestRunDaysSurvived: 4 }, {}); // 4/5 = 0.8
        expect(html).toContain('stats-near-miss');
        expect(html).toContain('Almost there');
        expect(html).toContain('1 day to Survivor — Bronze');
    });

    test('pluralizes the unit when remaining > 1', () => {
        const unlocked = { survivor_1: '2026-07-19T00:00:00.000Z' }; // next locked = Silver@10
        const html = StatsView.buildNearMissSection(catalog, { bestRunDaysSurvived: 8 }, unlocked); // 8/10 = 0.8, remaining 2
        expect(html).toContain('2 days to Survivor — Silver');
    });

    test('below the threshold pct: nothing rendered', () => {
        const html = StatsView.buildNearMissSection(catalog, { bestRunDaysSurvived: 3 }, {}); // 3/5 = 0.6
        expect(html).toBe('');
    });

    test('every tier unlocked: nothing to nudge toward', () => {
        const unlocked = { survivor_1: 'x', survivor_2: 'x' };
        const html = StatsView.buildNearMissSection(catalog, { bestRunDaysSurvived: 10 }, unlocked);
        expect(html).toBe('');
    });

    test('a family with a threshold of 1 (back_in_black) can never land in the near-miss band — degrades to empty, no throw', () => {
        const html = StatsView.buildNearMissSection(catalog, { bestRunDaysSurvived: 0, pointsRecoveries: 0 }, {});
        expect(html).not.toContain('Back in Black');
    });

    test('empty/missing catalog or stats: empty string', () => {
        expect(StatsView.buildNearMissSection([], {}, {})).toBe('');
        expect(StatsView.buildNearMissSection(null, null, null)).toBe('');
    });
});
