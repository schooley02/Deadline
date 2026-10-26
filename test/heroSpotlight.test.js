/**
 * HeroSpotlight pure-core tests (docs/HERO_SPOTLIGHT_PLAN.md sub-session 2,
 * 2026-10-21). DOM functions (init/show/renderInto) are live-checked in the
 * browser, per this suite's node-environment convention.
 */
global.Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');
const HeroSpotlight = require('../js/ui/heroSpotlight.js');

// All 8 categories now have hero art (2026-10-25); the emoji / grey-zombie placeholder path is still
// the fallback for a category without art, so these tests run with art switched off.
const NO_ART = { ...CONFIG, HERO_ART_CATEGORIES: [] };

const routineA = { id: 'rA', name: 'Study', isActive: true, frozenState: null, koState: null, heroCategory: 'career' };

describe('category heroes for standalone items (2026-10-26)', () => {
    const findNone = () => null;
    const cats = CONFIG.HERO_CATEGORIES;

    test('categoryHero builds a pseudo-routine keyed by category', () => {
        const h = HeroSpotlight.categoryHero('health', cats);
        expect(h).toMatchObject({ id: '__cat:health', heroCategory: 'health', isActive: true, koState: null, frozenState: null });
        expect(HeroSpotlight.isCategoryHeroId(h.id)).toBe(true);
        expect(HeroSpotlight.isCategoryHeroId('r1')).toBe(false);
        expect(HeroSpotlight.isCategoryHeroId(7)).toBe(false);
    });

    test('an unknown category falls back to other', () => {
        expect(HeroSpotlight.categoryHero('nonsense', cats).id).toBe('__cat:other');
    });

    test('a standalone item resolves to its own category hero', () => {
        const item = { id: 1, category: 'creativity' };
        expect(HeroSpotlight.resolveHeroForItem(item, [item], findNone, cats).heroCategory).toBe('creativity');
    });

    test('a routine-owned item still resolves to its routine', () => {
        const item = { id: 1, category: 'health', definitionId: 'd1' };
        const find = (it) => (it.definitionId === 'd1' ? routineA : null);
        expect(HeroSpotlight.resolveHeroForItem(item, [item], find, cats)).toBe(routineA);
    });

    test('a sub-task uses its parent: routine first, else the parent category', () => {
        const parent = { id: 1, category: 'financial' };
        const sub = { id: 2, parentId: 1, category: 'career' };
        expect(HeroSpotlight.resolveHeroForItem(sub, [parent, sub], findNone, cats).heroCategory).toBe('financial');
        const owned = { id: 3, category: 'health', definitionId: 'd1' };
        const sub2 = { id: 4, parentId: 3, category: 'career' };
        const find = (it) => (it.definitionId === 'd1' ? routineA : null);
        expect(HeroSpotlight.resolveHeroForItem(sub2, [owned, sub2], find, cats)).toBe(routineA);
    });

    test('an orphaned sub-task uses its own category; null item -> null', () => {
        const orphan = { id: 5, parentId: 99, category: 'lifestyle' };
        expect(HeroSpotlight.resolveHeroForItem(orphan, [orphan], findNone, cats).heroCategory).toBe('lifestyle');
        expect(HeroSpotlight.resolveHeroForItem(null, [], findNone, cats)).toBeNull();
    });

    test('heroLookFor gives the category pseudo-hero the matching art atlas', () => {
        const look = HeroSpotlight.heroLookFor(HeroSpotlight.categoryHero('health', cats), CONFIG);
        expect(look).toMatchObject({ category: 'health', state: 'active', kind: 'atlas', anim: 'idle' });
    });
});

describe('hurt loop while a zombie attacks (2026-10-26)', () => {
    const cats = CONFIG.HERO_CATEGORIES;
    const find = (it) => (it.definitionId === 'd1' ? routineA : null);
    const nonThreat = (it) => !!it.koGhost;

    test('heroLookFor loops the hurt row only when under attack; KO wins', () => {
        expect(HeroSpotlight.heroLookFor(routineA, CONFIG).anim).toBe('idle');
        expect(HeroSpotlight.heroLookFor(routineA, CONFIG, { underAttack: true }).anim).toBe('hurtloop');
        const ko = { ...routineA, koState: { at: 1 } };
        expect(HeroSpotlight.heroLookFor(ko, CONFIG, { underAttack: true }).anim).toBe('ko');
    });

    test('attackedHeroIds: overdue threatening items resolve to their hero', () => {
        const items = [
            { id: 1, category: 'health', definitionId: 'd1', isOverdue: true },
            { id: 2, category: 'creativity', isOverdue: true },
            { id: 3, category: 'financial', isOverdue: false },
        ];
        expect(HeroSpotlight.attackedHeroIds(items, find, cats, nonThreat).sort()).toEqual(['__cat:creativity', 'rA']);
    });

    test('ghosts and not-yet-overdue items do not attack; duplicates collapse; sub-task uses its parent', () => {
        const items = [
            { id: 1, category: 'health', isOverdue: true, koGhost: true },
            { id: 2, category: 'lifestyle', isOverdue: true },
            { id: 3, category: 'lifestyle', isOverdue: true },
            { id: 4, parentId: 2, category: 'career', isOverdue: true },
        ];
        expect(HeroSpotlight.attackedHeroIds(items, find, cats, nonThreat)).toEqual(['__cat:lifestyle']);
        expect(HeroSpotlight.attackedHeroIds(null, find, cats, nonThreat)).toEqual([]);
    });

    test('attackedHeroIds without an isNonThreatening fn still returns overdue items', () => {
        const items = [{ id: 1, category: 'health', isOverdue: true, koGhost: true }];
        expect(HeroSpotlight.attackedHeroIds(items, find, cats)).toEqual(['__cat:health']);
    });
});

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
        const look = HeroSpotlight.heroLookFor(routineA, NO_ART);
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
        const faded = HeroSpotlight.heroLookFor(ko, { ...NO_ART, HERO_KO_LOOK: 'faded' });
        expect(faded).toMatchObject({ state: 'ko', kind: 'emoji', koLook: 'faded', sprite: null });
        const zombie = HeroSpotlight.heroLookFor(ko, { ...NO_ART, HERO_KO_LOOK: 'zombie' });
        expect(zombie).toMatchObject({ state: 'ko', kind: 'zombie', koLook: 'zombie', sprite: 'Assets/Zombies/career-zombie-64.png' });
    });

    test('the zombie KO look only applies to KO, and an unknown look falls back to faded', () => {
        expect(HeroSpotlight.heroLookFor(routineA, { ...NO_ART, HERO_KO_LOOK: 'zombie' }).kind).toBe('emoji');
        expect(HeroSpotlight.heroLookFor({ ...routineA, koState: {} }, { ...NO_ART, HERO_KO_LOOK: 'bogus' }).koLook).toBe('faded');
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

// --- One-shot hurt / levelup reactions (hero sub-session 5, 2026-10-25) ---
describe('planReaction', () => {
    const hero = { id: 'rA', name: 'Study', isActive: true, frozenState: null, koState: null, heroCategory: 'career' };
    const plan = (over) => HeroSpotlight.planReaction({
        kind: 'hurt', routine: hero, visibleRoutineId: 'rA', config: CONFIG, ...over,
    });

    test('hurt / levelup play on the hero that is already on screen, for the frame count of its row', () => {
        expect(plan({ kind: 'hurt' })).toEqual({ action: 'play', ms: 900 });
        expect(plan({ kind: 'levelup' })).toEqual({ action: 'play', ms: 900 });
        const fin = { ...hero, heroCategory: 'financial' };
        expect(plan({ kind: 'hurt', routine: fin })).toEqual({ action: 'play', ms: 700 }); // 7-frame hurt row
        expect(plan({ kind: 'levelup', routine: fin })).toEqual({ action: 'play', ms: 900 });
    });

    test('hurt never opens the spotlight, and never plays on a different hero', () => {
        expect(plan({ kind: 'hurt', visibleRoutineId: null }).action).toBe('ignore');
        expect(plan({ kind: 'hurt', visibleRoutineId: 'other' }).action).toBe('ignore');
    });

    test('levelup opens the spotlight only when no hero is showing (and the switch is on)', () => {
        expect(plan({ kind: 'levelup', visibleRoutineId: null })).toEqual({ action: 'show', ms: 900 });
        expect(plan({ kind: 'levelup', visibleRoutineId: 'other' }).action).toBe('ignore');
        expect(plan({ kind: 'levelup', visibleRoutineId: null, config: { ...CONFIG, HERO_LEVELUP_AUTO_SHOW: false } }).action).toBe('ignore');
    });

    test('a KO\'d hero, a category without art, an unknown kind or a missing routine are ignored', () => {
        expect(plan({ routine: { ...hero, koState: { koAt: 1 } } }).action).toBe('ignore');
        expect(plan({ config: NO_ART }).action).toBe('ignore');
        expect(plan({ kind: 'attack' }).action).toBe('ignore');
        expect(plan({ routine: null }).action).toBe('ignore');
    });
});
