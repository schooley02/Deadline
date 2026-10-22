/**
 * HeroSpotlight pure-core tests (docs/HERO_SPOTLIGHT_PLAN.md sub-session 2,
 * 2026-10-21). DOM functions (init/show/renderInto) are live-checked in the
 * browser, per this suite's node-environment convention.
 */
global.Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');
const HeroSpotlight = require('../js/ui/heroSpotlight.js');

const routineA = { id: 'rA', name: 'Study', isActive: true, frozenState: null, koState: null, heroCategory: 'career' };

describe('resolveRoutineForItem', () => {
    const findRoutine = jest.fn(item => (item.definitionId === 'd1' ? routineA : null));
    beforeEach(() => findRoutine.mockClear());

    test('a routine-owned habit/task resolves to its routine', () => {
        const item = { id: 1, type: 'habit', definitionId: 'd1' };
        expect(HeroSpotlight.resolveRoutineForItem(item, [item], findRoutine)).toBe(routineA);
    });

    test('a standalone item resolves to null', () => {
        const item = { id: 2, type: 'task', definitionId: 'zzz' };
        expect(HeroSpotlight.resolveRoutineForItem(item, [item], findRoutine)).toBeNull();
    });

    test('a sub-task uses its PARENT task\'s routine', () => {
        const parent = { id: 10, type: 'task', definitionId: 'd1' };
        const sub = { id: 11, type: 'task', parentId: 10 };
        expect(HeroSpotlight.resolveRoutineForItem(sub, [parent, sub], findRoutine)).toBe(routineA);
        expect(findRoutine).toHaveBeenCalledWith(parent);
    });

    test('a sub-task of a standalone parent, or with a missing parent, resolves to null', () => {
        const parent = { id: 20, type: 'task', definitionId: 'zzz' };
        const sub = { id: 21, type: 'task', parentId: 20 };
        const orphan = { id: 22, type: 'task', parentId: 999 };
        expect(HeroSpotlight.resolveRoutineForItem(sub, [parent, sub], findRoutine)).toBeNull();
        expect(HeroSpotlight.resolveRoutineForItem(orphan, [orphan], findRoutine)).toBeNull();
    });

    test('missing item or resolver is safe', () => {
        expect(HeroSpotlight.resolveRoutineForItem(null, [], findRoutine)).toBeNull();
        expect(HeroSpotlight.resolveRoutineForItem({ id: 1 }, [], null)).toBeNull();
    });
});

describe('heroLookFor', () => {
    test('active routine: emoji block for its hero category', () => {
        const look = HeroSpotlight.heroLookFor(routineA, CONFIG);
        expect(look).toMatchObject({ routineId: 'rA', category: 'career', state: 'active', kind: 'emoji', sprite: null });
        expect(look.emoji).toBe(CONFIG.CATEGORY_EMOJI.career);
    });

    test('missing heroCategory reads as Other', () => {
        const look = HeroSpotlight.heroLookFor({ id: 'r', name: 'x', isActive: true }, CONFIG);
        expect(look.category).toBe('other');
    });

    test('state priority: KO > frozen > inactive > active', () => {
        const base = { id: 'r', name: 'x', isActive: true };
        expect(HeroSpotlight.heroLookFor({ ...base, koState: { at: 1 }, frozenState: { frozenBy: 'h' } }, CONFIG).state).toBe('ko');
        expect(HeroSpotlight.heroLookFor({ ...base, frozenState: { frozenBy: 'h' } }, CONFIG).state).toBe('frozen');
        expect(HeroSpotlight.heroLookFor({ ...base, isActive: false }, CONFIG).state).toBe('inactive');
    });

    test('KO look A (faded) keeps the emoji block; look B (zombie) uses the grey zombie sprite', () => {
        const ko = { ...routineA, koState: { at: 1 } };
        const faded = HeroSpotlight.heroLookFor(ko, { ...CONFIG, HERO_KO_LOOK: 'faded' });
        expect(faded).toMatchObject({ state: 'ko', kind: 'emoji', koLook: 'faded', sprite: null });
        const zombie = HeroSpotlight.heroLookFor(ko, { ...CONFIG, HERO_KO_LOOK: 'zombie' });
        expect(zombie).toMatchObject({ state: 'ko', kind: 'zombie', koLook: 'zombie', sprite: 'Assets/Zombies/career-zombie-64.png' });
    });

    test('the zombie KO look only applies to KO, and an unknown look falls back to faded', () => {
        expect(HeroSpotlight.heroLookFor(routineA, { ...CONFIG, HERO_KO_LOOK: 'zombie' }).kind).toBe('emoji');
        expect(HeroSpotlight.heroLookFor({ ...routineA, koState: {} }, { ...CONFIG, HERO_KO_LOOK: 'bogus' }).koLook).toBe('faded');
    });
});

describe('zombieSpriteFor', () => {
    test('maps every hero category to a real zombie file name (spirituality -> spiritual)', () => {
        const fs = require('fs');
        const path = require('path');
        CONFIG.HERO_CATEGORIES.forEach(cat => {
            const rel = HeroSpotlight.zombieSpriteFor(cat);
            expect(fs.existsSync(path.join(__dirname, '..', rel))).toBe(true);
        });
        expect(HeroSpotlight.zombieSpriteFor('spirituality')).toBe('Assets/Zombies/spiritual-zombie-64.png');
    });
});

describe('createController', () => {
    function harness(durationMs = 5000) {
        const timers = [];
        const changes = [];
        const ctl = HeroSpotlight.createController({
            durationMs,
            setTimeout: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length - 1; },
            clearTimeout: (id) => { timers[id].cleared = true; },
            onChange: (s) => changes.push(s && s.routineId),
        });
        const fire = id => { if (!timers[id].cleared) timers[id].fn(); };
        return { ctl, timers, changes, fire };
    }

    test('show sets the hero and schedules the auto-dismiss', () => {
        const { ctl, timers, changes, fire } = harness();
        expect(ctl.show('rA')).toBe(true);
        expect(ctl.get()).toEqual({ routineId: 'rA' });
        expect(timers[0].ms).toBe(5000);
        fire(0);
        expect(ctl.get()).toBeNull();
        expect(changes).toEqual(['rA', null]);
    });

    test('a new show REPLACES the hero and restarts the timer (no stacking)', () => {
        const { ctl, timers, changes, fire } = harness();
        ctl.show('rA');
        ctl.show('rB');
        expect(timers[0].cleared).toBe(true);
        fire(0); // the stale timer must not dismiss rB
        expect(ctl.get()).toEqual({ routineId: 'rB' });
        fire(1);
        expect(ctl.get()).toBeNull();
        expect(changes).toEqual(['rA', 'rB', null]);
    });

    test('dismiss clears early, cancels the timer, and is a no-op when nothing shows', () => {
        const { ctl, timers, changes } = harness();
        expect(ctl.dismiss()).toBe(false);
        ctl.show('rA');
        expect(ctl.dismiss()).toBe(true);
        expect(timers[0].cleared).toBe(true);
        expect(ctl.dismiss()).toBe(false);
        expect(changes).toEqual(['rA', null]);
    });

    test('show(null/undefined) is ignored', () => {
        const { ctl, changes } = harness();
        expect(ctl.show(null)).toBe(false);
        expect(ctl.show(undefined)).toBe(false);
        expect(changes).toEqual([]);
    });
});

describe('config', () => {
    test('spotlight constants are sane', () => {
        expect(CONFIG.HERO_SPOTLIGHT_MS).toBeGreaterThan(0);
        expect(CONFIG.HERO_SCRIM_OPACITY).toBeGreaterThan(0);
        expect(CONFIG.HERO_SCRIM_OPACITY).toBeLessThan(1);
        expect(['faded', 'zombie']).toContain(CONFIG.HERO_KO_LOOK);
    });
});
