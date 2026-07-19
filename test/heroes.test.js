/**
 * Heroes pure-core tests ([P1-UI-006] sub-session 1, 2026-07-19 session 41).
 *
 * js/heroes.js is pure (no DOM, no globals beyond what's passed in). The
 * items.js wiring (award/refund/gating) is covered separately in
 * test/items-routine-xp.test.js; the v7→v8 migration in
 * test/persistence-migration.test.js.
 */
const Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');

const T = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS; // [0, 50, 125, 250, ...]

describe('xpAmountFor', () => {
    test('task pays ROUTINE_XP_PER_TASK', () => {
        expect(Heroes.xpAmountFor('task', CONFIG)).toBe(CONFIG.ROUTINE_XP_PER_TASK);
    });
    test('habit pays ROUTINE_XP_PER_HABIT', () => {
        expect(Heroes.xpAmountFor('habit', CONFIG)).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
    });
});

describe('levelForXp — level DERIVED from xp (same table semantics as progression.js)', () => {
    test('0 xp is level 1', () => {
        expect(Heroes.levelForXp(0, T)).toBe(1);
    });
    test('one below the first threshold stays level 1', () => {
        expect(Heroes.levelForXp(T[1] - 1, T)).toBe(1);
    });
    test('exactly the first threshold reaches level 2', () => {
        expect(Heroes.levelForXp(T[1], T)).toBe(2);
    });
    test('a huge xp value caps at maxLevel (thresholds.length)', () => {
        expect(Heroes.levelForXp(999999, T)).toBe(T.length);
    });
});

describe('applyXpDelta', () => {
    test('an award that crosses one threshold levels up once', () => {
        const r = Heroes.applyXpDelta(T[1] - 5, 10, T);
        expect(r.xp).toBe(T[1] + 5);
        expect(r.level).toBe(2);
        expect(r.leveledUp).toBe(true);
        expect(r.levelsGained).toBe(1);
    });

    test('a single big award can cross MULTIPLE thresholds at once (the progression.js multi-level walk)', () => {
        const r = Heroes.applyXpDelta(0, T[2] + 1, T);
        expect(r.level).toBe(3);
        expect(r.levelsGained).toBe(2);
    });

    test('an award that crosses nothing does not level', () => {
        const r = Heroes.applyXpDelta(0, T[1] - 1, T);
        expect(r.level).toBe(1);
        expect(r.leveledUp).toBe(false);
        expect(r.levelsGained).toBe(0);
    });

    test('award then equal refund round-trips to EXACTLY the starting state (the deliberate divergence from player-style monotonic levels)', () => {
        const start = T[1] - 2;
        const awarded = Heroes.applyXpDelta(start, 10, T);
        expect(awarded.level).toBe(2);
        const refunded = Heroes.applyXpDelta(awarded.xp, -10, T);
        expect(refunded.xp).toBe(start);
        expect(refunded.level).toBe(1);
        expect(refunded.levelsGained).toBe(-1);
    });

    test('a refund floors xp at 0', () => {
        const r = Heroes.applyXpDelta(3, -10, T);
        expect(r.xp).toBe(0);
        expect(r.level).toBe(1);
    });
});

describe('slotsForLevel — 1 habit + 1 task at L1, +1 of each per level', () => {
    test('level 1', () => {
        expect(Heroes.slotsForLevel(1, CONFIG)).toEqual({ habitSlots: 1, taskSlots: 1 });
    });
    test('level 4', () => {
        expect(Heroes.slotsForLevel(4, CONFIG)).toEqual({ habitSlots: 4, taskSlots: 4 });
    });
});

describe('completionRate — habit members only, occurrences on/after the window start', () => {
    const routine = { id: 'r1', habitDefinitionIds: ['h2'] };
    const windowStart = new Date(2026, 6, 10, 0, 0, 0).getTime(); // Jul 10 2026 local

    test('no members / no occurrences → null rate, 0 samples (unrated, not 0%)', () => {
        expect(Heroes.completionRate(routine, [], windowStart)).toEqual({ rate: null, samples: 0 });
    });

    test('counts successes over samples for habits owned via routineId', () => {
        const habits = [{
            id: 'h1', routineId: 'r1',
            occurrenceHistory: [
                { date: '2026-07-15', success: true },
                { date: '2026-07-16', success: false },
                { date: '2026-07-17', success: true },
                { date: '2026-07-18', success: true },
            ],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart)).toEqual({ rate: 0.75, samples: 4 });
    });

    test('membership via habitDefinitionIds also counts (belt and suspenders, matching spawn gating)', () => {
        const habits = [{
            id: 'h2', routineId: null,
            occurrenceHistory: [{ date: '2026-07-15', success: true }],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart).samples).toBe(1);
    });

    test('occurrences BEFORE the window start are excluded (run/creation reset)', () => {
        const habits = [{
            id: 'h1', routineId: 'r1',
            occurrenceHistory: [
                { date: '2026-07-01', success: false }, // before window — invisible
                { date: '2026-07-15', success: true },
            ],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart)).toEqual({ rate: 1, samples: 1 });
    });

    test('a non-member habit contributes nothing', () => {
        const habits = [{
            id: 'stranger', routineId: 'OTHER',
            occurrenceHistory: [{ date: '2026-07-15', success: true }],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart).samples).toBe(0);
    });
});

describe('starRating — spec tiers 60/70/80/90/95 (PROJECT_SPEC ~78-83)', () => {
    const tiers = CONFIG.HERO_STAR_TIERS;
    test.each([
        [null, 0],
        [0.59, 0],
        [0.60, 1],
        [0.69, 1],
        [0.70, 2],
        [0.80, 3],
        [0.90, 4],
        [0.949, 4],
        [0.95, 5],
        [1, 5],
    ])('rate %p → %p stars', (rate, stars) => {
        expect(Heroes.starRating(rate, tiers)).toBe(stars);
    });
});

describe('routine health math (pure only — damage wiring is sub-session 2)', () => {
    test('applyRoutineDamage floors at 0', () => {
        expect(Heroes.applyRoutineDamage(5, 10)).toBe(0);
        expect(Heroes.applyRoutineDamage(50, 10)).toBe(40);
    });
    test('shouldKo only at 0', () => {
        expect(Heroes.shouldKo(1)).toBe(false);
        expect(Heroes.shouldKo(0)).toBe(true);
    });
});
