/**
 * Achievements badge grid — pure HTML builders in js/ui/statsView.js
 * (ACHIEVEMENTS_PLAN.md sub-session 3, 2026-07-20 session 66).
 *
 * Requires the REAL module (agenda-list.test.js precedent). Only the pure
 * string builders are covered here; renderStatsWindow's DOM wiring is
 * live-verified in Chrome per the established statsView convention
 * (sessions 54/55).
 */
const StatsView = require('../js/ui/statsView.js');

const survivor = {
    id: 'survivor', name: 'Survivor', metric: 'bestRunDaysSurvived',
    tiers: [
        { id: 'survivor_1', label: 'Bronze', threshold: 3 },
        { id: 'survivor_2', label: 'Silver', threshold: 7 },
    ],
};

const backInBlack = {
    id: 'back_in_black', name: 'Back in Black', metric: 'pointsRecoveries',
    tiers: [{ id: 'back_in_black_1', label: null, threshold: 1 }],
};

describe('badgeTitle', () => {
    test('joins family name and label', () => {
        expect(StatsView.badgeTitle('Survivor', 'Bronze')).toBe('Survivor — Bronze');
    });

    test('omits falsy labels entirely (session-65 null-label fix)', () => {
        expect(StatsView.badgeTitle('Back in Black', null)).toBe('Back in Black');
        expect(StatsView.badgeTitle('Back in Black', undefined)).toBe('Back in Black');
    });
});

describe('buildAchievementCard — locked', () => {
    test('shows progress label value/threshold and no unlock date', () => {
        const html = StatsView.buildAchievementCard(survivor, survivor.tiers[1], 4, undefined);
        expect(html).toContain('stats-badge-locked');
        expect(html).toContain('4/7');
        expect(html).not.toContain('Unlocked');
    });

    test('progress bar width floors to whole percent', () => {
        const html = StatsView.buildAchievementCard(survivor, survivor.tiers[1], 4, undefined);
        expect(html).toContain('width: 57%'); // floor(4/7*100)
    });

    test('clamps width at 100% even if value exceeds threshold (unlock lost by hand-edit)', () => {
        const html = StatsView.buildAchievementCard(survivor, survivor.tiers[0], 99, undefined);
        expect(html).toContain('width: 100%');
    });

    test('non-numeric stat value renders as 0 progress', () => {
        const html = StatsView.buildAchievementCard(survivor, survivor.tiers[0], undefined, undefined);
        expect(html).toContain('0/3');
        expect(html).toContain('width: 0%');
    });
});

describe('buildAchievementCard — unlocked', () => {
    test('shows badge + formatted unlock date, no progress bar', () => {
        const iso = '2026-07-20T10:00:00.000Z';
        const html = StatsView.buildAchievementCard(survivor, survivor.tiers[0], 5, iso);
        expect(html).toContain('stats-badge-unlocked');
        expect(html).toContain('Unlocked');
        expect(html).toContain(StatsView.formatDate(Date.parse(iso)));
        expect(html).not.toContain('stats-badge-progress-track');
    });

    test('null-label tier never renders the string "null"', () => {
        const html = StatsView.buildAchievementCard(
            backInBlack, backInBlack.tiers[0], 1, '2026-07-20T10:00:00.000Z');
        expect(html).not.toContain('null');
        expect(html).toContain('Back in Black');
    });
});

describe('buildAchievementFamily', () => {
    test('renders one card per tier in catalog order, mixed lock states', () => {
        const html = StatsView.buildAchievementFamily(
            survivor,
            { bestRunDaysSurvived: 4 },
            { survivor_1: '2026-07-19T00:00:00.000Z' });
        const unlockedIdx = html.indexOf('stats-badge-unlocked');
        const lockedIdx = html.indexOf('stats-badge-locked');
        expect(unlockedIdx).toBeGreaterThan(-1);
        expect(lockedIdx).toBeGreaterThan(unlockedIdx); // Bronze unlocked before Silver locked
        expect(html).toContain('4/7');
    });

    test('missing lifetimeStats/unlocked maps degrade to all-locked zeros', () => {
        const html = StatsView.buildAchievementFamily(survivor, undefined, undefined);
        expect(html).toContain('0/3');
        expect(html).toContain('0/7');
        expect(html).not.toContain('stats-badge-unlocked');
    });
});

describe('buildAchievementsSection', () => {
    test('renders every family in the catalog', () => {
        const html = StatsView.buildAchievementsSection({
            catalog: [survivor, backInBlack],
            lifetimeStats: { bestRunDaysSurvived: 3, pointsRecoveries: 0 },
            achievements: { survivor_1: '2026-07-19T00:00:00.000Z' },
        });
        expect(html).toContain('Survivor');
        expect(html).toContain('Back in Black');
        expect(html).toContain('stats-badge-family-list');
    });

    test('empty catalog renders the stats-empty placeholder', () => {
        const html = StatsView.buildAchievementsSection({ catalog: [] });
        expect(html).toContain('stats-empty');
    });
});
