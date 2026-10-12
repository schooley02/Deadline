/**
 * Death animation on completion ([P2-GAME-010] Stage 2b, 2026-10-12).
 * completeItem plays SpriteAnim's death (750ms) then fades; falls back to the
 * plain 500ms fade without an animated sprite; indulgeHabit never plays it.
 * Harness mirrors test/achievements-wiring.test.js.
 */
const fs = require('fs');
const path = require('path');
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
global.SpriteAnim = require('../js/spriteAnim.js');
const Items = require('../js/items.js');

function fakeEl(animated) {
    const classes = new Set(animated ? ['has-anim-sprite'] : []);
    return {
        style: {}, dataset: {}, textContent: '',
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        _classes: classes,
        addEventListener: () => {}, appendChild: () => {}, remove: () => {},
    };
}
beforeAll(() => { global.document = { createElement: () => fakeEl(), body: { classList: { contains: () => false } } }; });
afterAll(() => { delete global.document; });

function tomorrowNoon() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; }
function task(el) {
    return { id: 1, type: 'task', definitionId: null, name: 'T', category: 'other', isHighPriority: false,
        dueDateTime: tomorrowNoon(), isOverdue: false, lastDamageTickTime: null, parentId: null, subTasks: [],
        completedSubTasks: 0, totalSubTasks: 0, element: el, listItemElement: null };
}
function makeDeps(activeItems) {
    let xp = 0, points = 100;
    return {
        isGameOver: () => false, activeItems, definedHabits: () => [], definedRoutines: () => [],
        completedItems: () => [], getCurrentRunStats: () => RunStats.freshRunStats(), recordLifetime: () => {},
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT, xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; }, getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {}, createListItem: () => {}, sortAndRenderActiveList: () => {},
        renderCompletedItems: () => {}, updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
        baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH, gameCanvas: fakeEl(),
        calculateTimelineXWithClustering: () => 0, getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
    };
}

describe('SpriteAnim death helpers', () => {
    test('duration is frames / fps', () => {
        expect(SpriteAnim.DEATH_MS).toBe(750);
    });
    test('playDeath adds .enemy-dying and returns the duration for an animated enemy', () => {
        const el = fakeEl(true);
        expect(SpriteAnim.playDeath(el)).toBe(750);
        expect(el._classes.has('enemy-dying')).toBe(true);
    });
    test('playDeath is a no-op (0) without an animated sprite', () => {
        const el = fakeEl(false);
        expect(SpriteAnim.playDeath(el)).toBe(0);
        expect(el._classes.has('enemy-dying')).toBe(false);
        expect(SpriteAnim.playDeath(null)).toBe(0);
    });
    test('playDeath is a no-op when fx is off', () => {
        document.body.classList.contains = (c) => c === 'fx-off';
        expect(SpriteAnim.playDeath(fakeEl(true))).toBe(0);
        document.body.classList.contains = () => false;
    });
});

describe('completeItem exit timing', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

    test('animated enemy: dies for 750ms, fade delayed to the last 200ms, then removed', () => {
        const el = fakeEl(true);
        const item = task(el);
        const deps = makeDeps([item]);
        Items.completeItem(1, deps);
        expect(el._classes.has('enemy-dying')).toBe(true);
        expect(el.style.transition).toBe('opacity 200ms ease 550ms');
        jest.advanceTimersByTime(749);
        expect(deps.activeItems.length).toBe(1);
        jest.advanceTimersByTime(1);
        expect(deps.activeItems.length).toBe(0);
    });

    test('no animated sprite: plain 500ms fade, removed at 500ms', () => {
        const el = fakeEl(false);
        const deps = makeDeps([task(el)]);
        Items.completeItem(1, deps);
        expect(el._classes.has('enemy-dying')).toBe(false);
        expect(el.style.transition).toBe('opacity 0.5s ease');
        jest.advanceTimersByTime(499);
        expect(deps.activeItems.length).toBe(1);
        jest.advanceTimersByTime(1);
        expect(deps.activeItems.length).toBe(0);
    });
});

describe('CSS wiring', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'enemyAnim.css'), 'utf8');
    test('death rule uses row 3, 9 frames, 12fps, and the CSS fps matches SpriteAnim.DEATH_FPS', () => {
        expect(css).toMatch(/\.enemy\.enemy-dying \.enemy-sprite-sheet\s*\{[^}]*--row:\s*3[^}]*--frames:\s*9[^}]*--fps:\s*12 !important/s);
        expect(SpriteAnim.DEATH_FPS).toBe(12);
        expect(SpriteAnim.DEATH_FRAMES).toBe(9);
    });
    test('scrub pauses the sprite animation', () => {
        expect(css).toMatch(/\.enemy\.time-preview-ghost \.enemy-sprite-sheet\s*\{[^}]*animation-play-state:\s*paused/s);
    });
});
