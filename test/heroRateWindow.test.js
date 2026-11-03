/**
 * Hero star-rating window (2026-11-03, balance change 28 -> 22; DECISIONS 2026-11-03).
 *
 * The hero rate window and the habit points window are meant to be ONE number: 22 is the
 * "it takes ~22 repetitions to form a habit" figure the game tracks. They drifted apart once
 * (hero stayed at 28 after the habit window moved to 22), so this guards the pair and the
 * miss tolerance of the top star tiers at the real window.
 */
const Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');

// One daily habit, `misses` of them spread through the last `total` days.
function routineWith(total, misses) {
    const history = [];
    for (let i = 0; i < total; i++) {
        history.push({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, success: i >= misses });
    }
    return {
        routine: { id: 'r1', habitDefinitionIds: ['h1'], taskDefinitionIds: [] },
        habits: [{ id: 'h1', routineId: 'r1', occurrenceHistory: history }],
    };
}

function stars(total, misses) {
    const { routine, habits } = routineWith(total, misses);
    const r = Heroes.completionRate(routine, habits, new Date(2026, 0, 1).getTime(), CONFIG.HERO_STAR_RATE_WINDOW, []);
    return Heroes.starRating(r.rate, r.distinctDays, CONFIG.HERO_STAR_TIERS);
}

describe('hero rate window', () => {
    test('is the same 22-occurrence window as the habit points bonus', () => {
        expect(CONFIG.HERO_STAR_RATE_WINDOW).toBe(22);
        expect(CONFIG.HERO_STAR_RATE_WINDOW).toBe(CONFIG.HABIT_RATE_WINDOW);
    });

    test('only the most recent 22 occurrences count toward the rate', () => {
        // 30 recorded days, the 8 oldest all misses: the last 22 are perfect.
        const { routine, habits } = routineWith(30, 0);
        habits[0].occurrenceHistory.slice(0, 8).forEach(o => { o.success = false; });
        const r = Heroes.completionRate(routine, habits, new Date(2026, 0, 1).getTime(), CONFIG.HERO_STAR_RATE_WINDOW, []);
        expect(r.samples).toBe(22);
        expect(r.rate).toBe(1);
    });

    test('5 stars tolerates 1 miss in 22 but not 2', () => {
        expect(stars(22, 1)).toBe(5);
        expect(stars(22, 2)).toBe(4);
    });

    test('4 stars tolerates 2 misses in 22 but not 3', () => {
        expect(stars(22, 2)).toBe(4);
        expect(stars(22, 3)).toBe(3);
    });
});
