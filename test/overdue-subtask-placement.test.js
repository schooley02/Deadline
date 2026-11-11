/**
 * Overdue sub-task placement (found 2026-11-11, Jeremy's desktop report).
 *
 * A parent task was pushed to tomorrow, which (by design) leaves its three sub-tasks due today. The browser
 * tab sat in the background overnight; when the loop woke, Damage.runLiveGapCatchUp marked the sub-tasks
 * overdue and wrote `left = baseWidth + Movement.getSubTaskClusterOffset(sub)`. A left-fanned sub's offset is
 * NEGATIVE and CHAINS (each later sibling sits left of the previous one), and the parent was not at the base,
 * so the last sub landed far left of the church. Overdue items are never repositioned by the loop, so it stuck.
 *
 * The live loop already floors `left` at the base edge; the catch-up, edit, uncomplete and spawn paths did not.
 * The existing catch-up test only used a POSITIVE offset (12), so it could not see this.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Movement = require('../js/movement.js');
global.RunStats = require('../js/runStats.js');
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.Heroes = require('../js/heroes.js');
const Damage = require('../js/damage.js');
const Items = require('../js/items.js');

const BASE_WIDTH = 120;
const ENEMY_WIDTH = 128;
const HOUR = 60 * 60 * 1000;

function fakeEl() {
    const classes = new Set();
    return {
        style: {},
        dataset: {},
        textContent: '',
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c), toggle: () => {} },
        addEventListener: () => {},
        appendChild: () => {},
        remove: () => {},
        querySelector: () => null,
    };
}

// Parent due TOMORROW (far right, not overdue) + three subs due earlier today, all pending (not yet overdue).
function scenario() {
    const parent = {
        id: 1, type: 'task', name: 'Parent', category: 'other', parentId: null,
        dueDateTime: new Date(Date.now() + 20 * HOUR), isOverdue: false, lastDamageTickTime: null,
        x: 1500, subTasks: [], element: fakeEl(), listItemElement: fakeEl(),
    };
    const subs = [2, 3, 4].map(id => ({
        id, type: 'task', name: 'Sub ' + id, category: 'other', parentId: 1,
        dueDateTime: new Date(Date.now() - 2 * HOUR), isOverdue: false, lastDamageTickTime: null,
        x: 1400, subTasks: [], element: fakeEl(), listItemElement: fakeEl(),
    }));
    parent.subTasks = subs;
    return { parent, subs, activeItems: [parent, ...subs] };
}

function clusterOffsetFn(activeItems) {
    return (item) => Movement.getSubTaskClusterOffset(item, { activeItems, enemyWidth: ENEMY_WIDTH, glanceStrip: false });
}

const leftPx = (item) => parseFloat(item.element.style.left);

describe('scenario sanity', () => {
    test('the chained fan offset really is negative and grows with each sibling (why the bug needs a parent away from the base)', () => {
        const { subs, activeItems } = scenario();
        const off = clusterOffsetFn(activeItems);
        const offsets = subs.map(off);
        expect(offsets[0]).toBeLessThan(0);
        expect(offsets[1]).toBeLessThan(offsets[0]);
        expect(offsets[2]).toBeLessThan(offsets[1]);
        expect(BASE_WIDTH + offsets[2]).toBeLessThan(BASE_WIDTH); // would sit left of the base edge
    });
});

describe('Damage.runLiveGapCatchUp - overdue subs under a parent due tomorrow', () => {
    function deps(activeItems) {
        let baseHealth = 100;
        return {
            isGameOver: () => false,
            getActiveItems: () => activeItems,
            markAsOverdue: (item) => { item.isOverdue = true; item.lastDamageTickTime = item.dueDateTime.getTime(); },
            getSubTaskClusterOffset: clusterOffsetFn(activeItems),
            baseWidth: BASE_WIDTH,
            gameScreenWidth: 1200,
            isNonThreatening: () => false,
            getBaseHealth: () => baseHealth,
            setBaseHealth: (n) => { baseHealth = n; },
            setGameOver: () => {},
            setOfflineCatchUpActive: () => {},
            getRunStartedAtMs: () => Date.now(),
            setDaysSurvived: () => {},
            getGameLoopInterval: () => null,
            baseElement: fakeEl(), baseHealthDisplay: fakeEl(), gameOverMessage: fakeEl(), restartButton: fakeEl(),
            enableFormControls: () => {},
            saveGame: () => {},
        };
    }

    test('no overdue sub is placed left of the base edge', () => {
        const { subs, activeItems } = scenario();
        Damage.runLiveGapCatchUp(deps(activeItems));
        subs.forEach(s => {
            expect(s.isOverdue).toBe(true);
            expect(leftPx(s)).toBeGreaterThanOrEqual(BASE_WIDTH);
        });
    });

    test('the parent (not overdue) is untouched', () => {
        const { parent, activeItems } = scenario();
        Damage.runLiveGapCatchUp(deps(activeItems));
        expect(parent.isOverdue).toBe(false);
        expect(parent.element.style.left).toBeUndefined();
    });
});

describe('Items.recomputeOverdueStateAfterEdit - a sub pulled into the past under a far parent', () => {
    test('its sprite is floored at the base edge', () => {
        const { subs, activeItems } = scenario();
        const last = subs[2];
        const deps = {
            definedHabits: () => [],
            baseWidth: BASE_WIDTH,
            calculateTimelineXWithClustering: () => 1400,
            getSubTaskClusterOffset: clusterOffsetFn(activeItems),
            activeItems,
            saveGame: () => {},
        };
        Items.recomputeOverdueStateAfterEdit(last, deps);
        expect(last.isOverdue).toBe(true);
        expect(leftPx(last)).toBeGreaterThanOrEqual(BASE_WIDTH);
    });
});
