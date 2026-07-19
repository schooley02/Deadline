/**
 * HeroesView pure-core tests ([P1-UI-006] sub-session 3, 2026-07-19).
 *
 * Only the pure (no-DOM) helpers are unit-tested here — same convention as
 * ARCHITECTURE.md's note on Spawning.addItemToGame: DOM-orchestration
 * functions (buildChipElement, buildOverflowChip, renderHeroesAtBase) are
 * verified by live Chrome playtest instead, since this suite's
 * testEnvironment is 'node' (no `document`, no jsdom dependency — see
 * test/setup.js's header and every other js/ui/* test file's precedent).
 *
 * js/ui/heroes.js reads Heroes (js/heroes.js) as a bare global, matching the
 * rest of js/ui/*'s convention for fully-extracted collaborator modules.
 */
global.Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');
const HeroesView = require('../js/ui/heroes.js');

describe('categoryEmoji', () => {
    test('returns the configured emoji for a known category', () => {
        expect(HeroesView.categoryEmoji('career', CONFIG)).toBe(CONFIG.CATEGORY_EMOJI.career);
    });

    test('falls back to the star emoji for an unknown category', () => {
        expect(HeroesView.categoryEmoji('made-up-category', CONFIG)).toBe('⭐');
    });
});

describe('dominantCategoryOrInitial', () => {
    test('picks the category with the most habit members', () => {
        const routine = { id: 'r1', name: 'Morning Ritual' };
        const habits = [
            { id: 'h1', routineId: 'r1', category: 'health' },
            { id: 'h2', routineId: 'r1', category: 'health' },
            { id: 'h3', routineId: 'r1', category: 'career' },
        ];
        expect(HeroesView.dominantCategoryOrInitial(routine, habits)).toEqual({ category: 'health', initial: null });
    });

    test('ignores habits belonging to a different routine', () => {
        const routine = { id: 'r1', name: 'Morning Ritual' };
        const habits = [{ id: 'h1', routineId: 'r2', category: 'career' }];
        expect(HeroesView.dominantCategoryOrInitial(routine, habits)).toEqual({ category: null, initial: 'M' });
    });

    test('falls back to the routine name initial when it has no habit members', () => {
        const routine = { id: 'r1', name: 'evening wind-down' };
        expect(HeroesView.dominantCategoryOrInitial(routine, [])).toEqual({ category: null, initial: 'E' });
    });

    test('falls back to "?" for an unnamed routine with no members', () => {
        const routine = { id: 'r1', name: '' };
        expect(HeroesView.dominantCategoryOrInitial(routine, [])).toEqual({ category: null, initial: '?' });
    });
});

describe('deriveState', () => {
    test('KO takes priority over everything else', () => {
        const routine = { koState: { koAt: 1 }, frozenState: { frozenBy: 'h1' }, isActive: false };
        expect(HeroesView.deriveState(routine)).toBe('ko');
    });

    test('frozen takes priority over inactive', () => {
        const routine = { koState: null, frozenState: { frozenBy: 'h1' }, isActive: false };
        expect(HeroesView.deriveState(routine)).toBe('frozen');
    });

    test('inactive when neither KO nor frozen but not active', () => {
        const routine = { koState: null, frozenState: null, isActive: false };
        expect(HeroesView.deriveState(routine)).toBe('inactive');
    });

    test('active when none of the above', () => {
        const routine = { koState: null, frozenState: null, isActive: true };
        expect(HeroesView.deriveState(routine)).toBe('active');
    });
});

describe('xpProgress', () => {
    const T = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS; // [0, 50, 125, 250, ...]

    test('level 1 progress toward threshold[1]', () => {
        const routine = { level: 1, xp: 25 };
        const result = HeroesView.xpProgress(routine, T);
        expect(result.xpForNext).toBe(T[1]);
        expect(result.pct).toBeCloseTo(25 / T[1]);
    });

    test('a level with span > 0 computes a fractional pct', () => {
        const routine = { level: 2, xp: T[1] + 10 };
        const result = HeroesView.xpProgress(routine, T);
        const span = T[2] - T[1];
        expect(result.xpForNext).toBe(T[2]);
        expect(result.pct).toBeCloseTo(10 / span);
    });

    test('max level reports xpForNext: null, pct: 1', () => {
        const routine = { level: T.length, xp: 999999 };
        const result = HeroesView.xpProgress(routine, T);
        expect(result.xpForNext).toBeNull();
        expect(result.pct).toBe(1);
    });

    test('defaults level to 1 and xp to 0 when absent', () => {
        const result = HeroesView.xpProgress({}, T);
        expect(result.xp).toBe(0);
        expect(result.pct).toBe(0);
    });
});

describe('starsHtml', () => {
    test('0 stars is five empty stars', () => {
        expect(HeroesView.starsHtml(0)).toBe('☆☆☆☆☆');
    });

    test('5 stars is five filled stars', () => {
        expect(HeroesView.starsHtml(5)).toBe('★★★★★');
    });

    test('a middle value mixes filled and empty', () => {
        expect(HeroesView.starsHtml(3)).toBe('★★★☆☆');
    });
});

describe('healthColorVar', () => {
    test('above 75% is the full-health color', () => {
        expect(HeroesView.healthColorVar(0.8)).toBe('var(--color-base-health-full)');
    });
    test('above 50% is moderate', () => {
        expect(HeroesView.healthColorVar(0.6)).toBe('var(--color-base-health-moderate)');
    });
    test('above 25% is low', () => {
        expect(HeroesView.healthColorVar(0.3)).toBe('var(--color-base-health-low)');
    });
    test('25% or below is critical', () => {
        expect(HeroesView.healthColorVar(0.25)).toBe('var(--color-base-health-critical)');
        expect(HeroesView.healthColorVar(0)).toBe('var(--color-base-health-critical)');
    });
});

describe('trackStarCrossing', () => {
    test('first observation seeds memory and reports no crossing', () => {
        const memory = {};
        expect(HeroesView.trackStarCrossing(memory, 'r1', 2)).toBe(false);
        expect(memory.r1).toBe(2);
    });

    test('a later observation with a HIGHER star count reports a crossing', () => {
        const memory = { r1: 2 };
        expect(HeroesView.trackStarCrossing(memory, 'r1', 3)).toBe(true);
        expect(memory.r1).toBe(3);
    });

    test('an equal or lower star count does not report a crossing', () => {
        const memory = { r1: 3 };
        expect(HeroesView.trackStarCrossing(memory, 'r1', 3)).toBe(false);
        expect(HeroesView.trackStarCrossing(memory, 'r1', 2)).toBe(false);
        expect(memory.r1).toBe(2);
    });

    test('tracks multiple routines independently', () => {
        const memory = {};
        HeroesView.trackStarCrossing(memory, 'r1', 1);
        HeroesView.trackStarCrossing(memory, 'r2', 4);
        expect(HeroesView.trackStarCrossing(memory, 'r1', 2)).toBe(true);
        expect(HeroesView.trackStarCrossing(memory, 'r2', 4)).toBe(false);
    });
});

describe('buildChipViewModel', () => {
    test('derives a full view model from a healthy, active, rated routine', () => {
        const routine = {
            id: 'r1',
            name: 'Morning Ritual',
            level: 2,
            xp: CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS[1] + 5,
            health: 80,
            isActive: true,
            frozenState: null,
            koState: null,
            createdAt: 1000,
            habitDefinitionIds: ['h1'],
        };
        const habits = [
            { id: 'h1', routineId: 'r1', category: 'health', occurrenceHistory: [
                { date: '2026-07-10', success: true },
                { date: '2026-07-11', success: true },
                { date: '2026-07-12', success: true },
                { date: '2026-07-13', success: true },
                { date: '2026-07-14', success: true },
                { date: '2026-07-15', success: true },
                { date: '2026-07-16', success: true },
            ] },
        ];

        const vm = HeroesView.buildChipViewModel(routine, habits, CONFIG, 0);

        expect(vm.id).toBe('r1');
        expect(vm.level).toBe(2);
        expect(vm.health).toBe(80);
        expect(vm.healthPct).toBeCloseTo(80 / CONFIG.ROUTINE_MAX_HEALTH);
        expect(vm.state).toBe('active');
        expect(vm.emoji).toBe(CONFIG.CATEGORY_EMOJI.health);
        expect(vm.initial).toBeNull();
        expect(vm.stars).toBeGreaterThan(0); // 7/7 = 100% success, well above the top tier
    });

    test('an unrated brand-new routine (no occurrence samples) gets 0 stars, not a crash', () => {
        const routine = { id: 'r2', name: 'New Routine', level: 1, xp: 0, isActive: true, createdAt: 0 };
        const vm = HeroesView.buildChipViewModel(routine, [], CONFIG, 0);
        expect(vm.stars).toBe(0);
        expect(vm.rateSamples).toBe(0);
    });

    test('missing health defaults to max health (fresh pre-migration-shape routine)', () => {
        const routine = { id: 'r3', name: 'No Health Field', level: 1, xp: 0, isActive: true };
        const vm = HeroesView.buildChipViewModel(routine, [], CONFIG, 0);
        expect(vm.health).toBe(CONFIG.ROUTINE_MAX_HEALTH);
        expect(vm.healthPct).toBe(1);
    });

    test('a KO\'d routine reports state "ko" regardless of isActive', () => {
        const routine = { id: 'r4', name: 'KOd', level: 1, xp: 0, isActive: false, koState: { koAt: 123 } };
        const vm = HeroesView.buildChipViewModel(routine, [], CONFIG, 0);
        expect(vm.state).toBe('ko');
    });
});
