/**
 * Completion attack (2026-10-26): HeroSpotlight.react(id, 'attack') against stub elements with fake timers,
 * and the Items.completeItem onItemDefeated hook. Plan: the hero of a completed task / habit plays its
 * attack row ONCE, stays for HERO_SPOTLIGHT_MS, then leaves.
 */
global.Heroes = require('../js/heroes.js');
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.RunStats = require('../js/runStats.js');
global.SpriteAnim = require('../js/spriteAnim.js');
const HeroSpotlight = require('../js/ui/heroSpotlight.js');
const Items = require('../js/items.js');

function stubEl() {
    const cls = new Set();
    return {
        style: { setProperty() {}, removeProperty() {} }, dataset: {}, className: '', innerHTML: '', title: '',
        classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } },
        addEventListener() {},
    };
}

const rA = { id: 'rA', name: 'Study', isActive: true, frozenState: null, koState: null, heroCategory: 'career' };
const rB = { id: 'rB', name: 'Move', isActive: true, frozenState: null, koState: null, heroCategory: 'health' };
const ONESHOT = Math.round(CONFIG.HERO_ONESHOT_FRAMES / CONFIG.HERO_ONESHOT_FPS * 1000); // 900

describe('HeroSpotlight.react attack', () => {
    let scrim, hero;
    function setup(config) {
        scrim = stubEl(); hero = stubEl();
        HeroSpotlight.init({ scrimEl: scrim, heroEl: hero, config: config || CONFIG, getRoutine: id => [rA, rB].find(r => r.id === id) || null });
        HeroSpotlight.setAttackedHeroes([]);
    }
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

    test('opens the hero, plays attack once, falls back to idle, then leaves after HERO_SPOTLIGHT_MS', () => {
        setup();
        expect(HeroSpotlight.react('rA', 'attack')).toBe(true);
        expect(HeroSpotlight.getCurrentRoutineId()).toBe('rA');
        expect(hero.classList.contains('active')).toBe(true);
        expect(hero.innerHTML).toContain('data-anim="attack"');
        jest.advanceTimersByTime(ONESHOT - 1);
        expect(hero.innerHTML).toContain('data-anim="attack"');
        jest.advanceTimersByTime(1);
        expect(hero.innerHTML).toContain('data-anim="idle"');
        jest.advanceTimersByTime(CONFIG.HERO_SPOTLIGHT_MS - ONESHOT);
        expect(HeroSpotlight.getCurrentRoutineId()).toBe(null);
        expect(hero.classList.contains('active')).toBe(false);
    });

    test('a held (selected-row) hero is released: attack restarts the normal timer', () => {
        setup();
        HeroSpotlight.show('rA', { hold: true });
        jest.advanceTimersByTime(60000);
        expect(HeroSpotlight.getCurrentRoutineId()).toBe('rA'); // still held
        expect(HeroSpotlight.react('rA', 'attack')).toBe(true);
        jest.advanceTimersByTime(CONFIG.HERO_SPOTLIGHT_MS);
        expect(HeroSpotlight.getCurrentRoutineId()).toBe(null);
    });

    test('replaces a different hero that is up', () => {
        setup();
        HeroSpotlight.show('rB', { hold: true });
        expect(HeroSpotlight.react('rA', 'attack')).toBe(true);
        expect(HeroSpotlight.getCurrentRoutineId()).toBe('rA');
        expect(hero.dataset.category).toBe('career');
        expect(hero.innerHTML).toContain('data-anim="attack"');
    });

    test('a hero whose other zombies are still attacking returns to the hurt loop, not idle', () => {
        setup();
        HeroSpotlight.setAttackedHeroes(['rA']);
        HeroSpotlight.react('rA', 'attack');
        expect(hero.innerHTML).toContain('data-anim="attack"');
        jest.advanceTimersByTime(ONESHOT);
        expect(hero.innerHTML).toContain('data-anim="hurtloop"');
    });

    test('a category hero (standalone item) attacks too', () => {
        setup();
        expect(HeroSpotlight.react('__cat:creativity', 'attack')).toBe(true);
        expect(hero.dataset.category).toBe('creativity');
        expect(hero.innerHTML).toContain('data-anim="attack"');
    });

    test('a KO\'d hero does not attack; the switch turns the whole thing off', () => {
        setup();
        rA.koState = { koAt: 1 };
        expect(HeroSpotlight.react('rA', 'attack')).toBe(false);
        rA.koState = null;
        setup({ ...CONFIG, HERO_ATTACK_ON_COMPLETE: false });
        expect(HeroSpotlight.react('rA', 'attack')).toBe(false);
        expect(HeroSpotlight.getCurrentRoutineId()).toBe(null);
    });
});

describe('Items.completeItem onItemDefeated hook', () => {
    beforeAll(() => { global.document = { createElement: () => stubEl(), body: { classList: { contains: () => false } } }; });
    afterAll(() => { delete global.document; });
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    function tomorrowNoon() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; }
    function el() {
        const classes = new Set(['has-anim-sprite']);
        return { style: {}, dataset: {}, classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) }, remove() {}, _classes: classes };
    }
    function task(over) {
        return Object.assign({ id: 1, type: 'task', definitionId: null, name: 'T', category: 'other', isHighPriority: false,
            dueDateTime: tomorrowNoon(), isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
            completedSubTasks: 0, totalSubTasks: 0, element: el(), listItemElement: null }, over);
    }
    function deps(items, over) {
        let xp = 0, points = 100;
        return Object.assign({
            isGameOver: () => false, activeItems: items, definedHabits: () => [], definedRoutines: () => [],
            completedItems: () => [], getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
            xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
            pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
            habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
            getPlayerXP: () => xp, setPlayerXP: n => { xp = n; }, getPlayerPoints: () => points, setPlayerPoints: n => { points = n; },
            updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
            renderCompletedItems: () => {}, updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
        }, over);
    }

    test('fires once with the item, before the death animation starts', () => {
        const t = task();
        const seen = [];
        Items.completeItem(1, deps([t], { onItemDefeated: (it) => seen.push({ id: it.id, dying: t.element._classes.has('enemy-dying') }) }));
        expect(seen).toEqual([{ id: 1, dying: false }]);
        expect(t.element._classes.has('enemy-dying')).toBe(true);
    });

    test('does not fire for a parent task that still has open sub-tasks, or after game over', () => {
        const hook = jest.fn();
        const parent = task({ id: 5, subTasks: [6], totalSubTasks: 1 });
        const r = Items.completeItem(5, deps([parent], { onItemDefeated: hook }));
        expect(r && r.ok).toBe(false);
        Items.completeItem(5, deps([parent], { isGameOver: () => true, onItemDefeated: hook }));
        expect(hook).not.toHaveBeenCalled();
    });

    test('is optional: completion works without the collaborator', () => {
        const t = task();
        expect(() => Items.completeItem(1, deps([t]))).not.toThrow();
    });
});
