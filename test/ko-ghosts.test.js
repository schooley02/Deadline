/**
 * KO ghosts (2026-10-25, docs/DESIGN_QUESTIONS_KO_EDIT_TIMER.md, Build 1).
 *
 * A KO'd routine's items stay as inert, completable ghosts (`item.koGhost`):
 * never overdue, never damaging, no miss; completing one pays XP + a habit
 * success occurrence but points x CONFIG.KO_GHOST_POINTS_FACTOR (0); revive
 * brings them back to life.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.DayRollover = require('../js/dayRollover.js');
const Items = require('../js/items.js');
const Routines = require('../js/routines.js');

function fakeEl() {
    const classes = new Set();
    return {
        style: {}, dataset: {},
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            contains: (c) => classes.has(c),
            toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
        },
        addEventListener: () => {}, appendChild: () => {}, remove: () => {},
        querySelector: () => null,
    };
}

beforeAll(() => { global.document = { createElement: () => fakeEl() }; });
afterAll(() => { delete global.document; });
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

const HOUR = 60 * 60 * 1000;

function routine(overrides = {}) {
    return {
        id: 'r1', name: 'Routine', isActive: true, frozenState: null,
        habitDefinitionIds: ['h1'], taskDefinitionIds: ['td1'],
        xp: 0, level: 1, health: 100, createdAt: Date.now(), koState: null,
        ...overrides,
    };
}

function habitDef(overrides = {}) {
    return {
        id: 'h1', name: 'Habit', isNegative: false, routineId: 'r1', streak: 0,
        lastCompletionDate: null, occurrenceHistory: [], ...overrides,
    };
}

function habit(overrides = {}) {
    return {
        id: 2, type: 'habit', definitionId: 'h1', name: 'Habit', category: 'health',
        isNegative: false, dueDateTime: new Date(Date.now() + 3 * HOUR),
        originalDueDate: new Date(), isOverdue: false, lastDamageTickTime: null,
        parentId: null, streak: 0, element: fakeEl(), listItemElement: fakeEl(), ...overrides,
    };
}

function routineTask(overrides = {}) {
    return {
        id: 1, type: 'task', definitionId: 'td1', name: 'Routine Task', category: 'other',
        isHighPriority: false, dueDateTime: new Date(Date.now() + 3 * HOUR),
        isOverdue: false, lastDamageTickTime: null, parentId: null,
        subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(), ...overrides,
    };
}

function oneOffTask(overrides = {}) {
    return routineTask({ id: 9, definitionId: undefined, name: 'One-off', ...overrides });
}

function makeDeps(overrides = {}) {
    let xp = 0, points = 100;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const definedRoutines = overrides.definedRoutines || [];
    const completedItems = overrides.completedItems || [];
    const { activeItems: _a, definedHabits: _d, definedRoutines: _r, completedItems: _c, ...rest } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        definedRoutines: () => definedRoutines,
        completedItems: () => completedItems,
        xpPerTaskDefeat: CONFIG.XP_PER_TASK_DEFEAT,
        xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerTask: CONFIG.POINTS_PER_TASK,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        habitStreakBonusThreshold: CONFIG.HABIT_STREAK_BONUS_THRESHOLD,
        getPlayerXP: () => xp, setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points, setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {}, checkPlayerLevelUp: () => {},
        createListItem: () => {}, sortAndRenderActiveList: () => {}, renderCompletedItems: () => {},
        updateTaskCountDisplay: () => {}, resetAllSubTaskCheckboxes: () => {}, saveGame: () => {},
        baseWidth: 120, enemyWidth: CONFIG.ENEMY_WIDTH, habitEnemyWidth: CONFIG.HABIT_ENEMY_WIDTH,
        gameCanvas: fakeEl(), calculateTimelineXWithClustering: () => 0,
        getSubTaskClusterOffset: () => 0, getItemTopPosition: () => 0, handleEnemyClick: () => {},
        ...rest,
    };
}

describe('config', () => {
    test('ghost completion pays no points by default', () => {
        expect(CONFIG.KO_GHOST_POINTS_FACTOR).toBe(0);
    });
});

describe('Items.isNonThreatening / markAsOverdue treat ghosts as inert', () => {
    test('a ghost task and a ghost positive habit are non-threatening', () => {
        expect(Items.isNonThreatening(routineTask({ koGhost: true }))).toBe(true);
        expect(Items.isNonThreatening(habit({ koGhost: true }))).toBe(true);
        expect(Items.isNonThreatening(routineTask())).toBe(false);
        expect(Items.isNonThreatening(habit())).toBe(false);
    });

    test('markAsOverdue is a no-op for a ghost past its due time (no overdue, no miss, no streak reset)', () => {
        const def = habitDef({ streak: 4 });
        const item = habit({ koGhost: true, dueDateTime: new Date(Date.now() - HOUR) });
        const deps = makeDeps({ activeItems: [item], definedHabits: [def], definedRoutines: [routine()] });

        Items.markAsOverdue(item, new Date(), deps);

        expect(item.isOverdue).toBe(false);
        expect(def.occurrenceHistory).toEqual([]);
        expect(def.streak).toBe(4);
    });

    test('the same past-due habit as a LIVE item does go overdue and record a miss (control)', () => {
        const def = habitDef({ streak: 4 });
        const item = habit({ dueDateTime: new Date(Date.now() - HOUR) });
        const deps = makeDeps({ activeItems: [item], definedHabits: [def], definedRoutines: [routine()] });

        Items.markAsOverdue(item, new Date(), deps);

        expect(item.isOverdue).toBe(true);
        expect(def.streak).toBe(0);
    });
});

describe('KO path: ghostify instead of recall', () => {
    function koDeps(extra = {}) {
        const r = routine({ taskDefinitionIds: ['td1'], habitDefinitionIds: [], health: 5 });
        const item = routineTask();
        return { r, item, deps: makeDeps({ activeItems: [item], definedRoutines: [r], ...extra }) };
    }

    test('uses ghostifyActiveInstancesForRoutine when supplied (and does NOT recall)', () => {
        const ghostify = jest.fn();
        const clear = jest.fn();
        const { r, item, deps } = koDeps({ ghostifyActiveInstancesForRoutine: ghostify, clearActiveInstancesForRoutine: clear });

        Items.damageRoutineForItem(item, 50, deps);

        expect(r.koState).toBeTruthy();
        expect(r.isActive).toBe(false);
        expect(ghostify).toHaveBeenCalledWith('r1');
        expect(clear).not.toHaveBeenCalled();
    });

    test('falls back to the old recall when no ghost collaborator is supplied', () => {
        const clear = jest.fn();
        const { item, deps } = koDeps({ clearActiveInstancesForRoutine: clear });

        Items.damageRoutineForItem(item, 50, deps);

        expect(clear).toHaveBeenCalledWith('r1');
    });
});

describe('Routines.ghostifyActiveInstancesForRoutine', () => {
    test('flags the routine\'s habits, tasks and cascaded sub-tasks; leaves others alone', () => {
        const r = routine();
        const h = habit({ id: 2 });
        const t = routineTask({ id: 1, subTasks: [5] });
        const sub = routineTask({ id: 5, definitionId: undefined, parentId: 1 });
        const other = oneOffTask({ id: 9 });
        const otherRoutineHabit = habit({ id: 3, definitionId: 'hX' });
        const hooked = [];

        const n = Routines.ghostifyActiveInstancesForRoutine('r1', {
            definedRoutines: [r], activeItems: [h, t, sub, other, otherRoutineHabit],
            onGhostified: (item) => hooked.push(item.id),
        });

        expect(n).toBe(3);
        expect(h.koGhost).toBe(true);
        expect(t.koGhost).toBe(true);
        expect(sub.koGhost).toBe(true);
        expect(other.koGhost).toBeUndefined();
        expect(otherRoutineHabit.koGhost).toBeUndefined();
        expect(hooked.sort()).toEqual([1, 2, 5]);
    });

    test('an item already overdue at KO stops being overdue (its misses stand)', () => {
        const r = routine({ habitDefinitionIds: [] });
        const t = routineTask({ isOverdue: true, lastDamageTickTime: 123 });

        Routines.ghostifyActiveInstancesForRoutine('r1', { definedRoutines: [r], activeItems: [t] });

        expect(t.koGhost).toBe(true);
        expect(t.isOverdue).toBe(false);
    });

    test('unknown routine is a no-op', () => {
        expect(Routines.ghostifyActiveInstancesForRoutine('nope', { definedRoutines: [], activeItems: [] })).toBe(0);
    });
});

describe('Routines.reviveGhostInstancesForRoutine', () => {
    test('splits ghosts: future resumes, stale recurring and stale one-offs are reported', () => {
        const r = routine({ taskDefinitionIds: ['td1'], habitDefinitionIds: ['h1'] });
        const futureTask = routineTask({ id: 1, koGhost: true });
        const staleHabit = habit({ id: 2, koGhost: true, dueDateTime: new Date(Date.now() - HOUR) });
        const hooked = [];

        const result = Routines.reviveGhostInstancesForRoutine('r1', {
            definedRoutines: [r], activeItems: [futureTask, staleHabit],
            onGhostRevived: (item) => hooked.push(item.id),
        });

        expect(futureTask.koGhost).toBe(false);
        expect(staleHabit.koGhost).toBe(false);
        expect(result.recurring.map(i => i.id)).toEqual([2]);
        expect(result.staleOneOffs).toEqual([]);
        expect(hooked.sort()).toEqual([1, 2]);
    });

    test('a stale one-off task/sub-task in the routine goes to staleOneOffs (picker queue)', () => {
        // One-off tasks/sub-tasks only belong to a routine through a parent that does;
        // here the routine's own task has a stale one-off sub-task.
        const r = routine({ habitDefinitionIds: [] });
        const parent = routineTask({ id: 1, koGhost: true, subTasks: [5] });
        const sub = routineTask({ id: 5, definitionId: undefined, parentId: 1, koGhost: true, dueDateTime: new Date(Date.now() - 2 * HOUR) });

        const result = Routines.reviveGhostInstancesForRoutine('r1', { definedRoutines: [r], activeItems: [parent, sub] });

        expect(result.staleOneOffs.map(i => i.id)).toEqual([5]);
        expect(result.recurring).toEqual([]);
        expect(sub.koGhost).toBe(false);
    });

    test('live (non-ghost) items are untouched', () => {
        const r = routine();
        const live = routineTask({ koGhost: false });
        const result = Routines.reviveGhostInstancesForRoutine('r1', { definedRoutines: [r], activeItems: [live] });
        expect(result).toEqual({ recurring: [], staleOneOffs: [] });
    });
});

describe('toggleRoutineActive revive brings ghosts back', () => {
    test('revive after the KO day runs the ghost hooks with the revive result', () => {
        const r = routine({
            isActive: false, health: 0, habitDefinitionIds: [], taskDefinitionIds: ['td1'],
            koState: { koAt: Date.now() - 2 * 24 * HOUR },
        });
        const ghost = routineTask({ koGhost: true });
        const revived = [];
        let hookResult = null;

        Routines.toggleRoutineActive('r1', {
            definedRoutines: [r], routineSlots: 3, activeItems: [ghost], removeItem: () => {},
            alert: () => {}, generateDailyHabitInstances: () => {}, generateDailyRoutineTaskInstances: () => {},
            currentGameDate: new Date(), saveGame: () => {},
            onGhostRevived: (item) => revived.push(item.id),
            onGhostsRevived: (res) => { hookResult = res; },
        });

        expect(r.koState).toBeNull();
        expect(r.health).toBe(CONFIG.HERO_REVIVE_HEALTH);
        expect(ghost.koGhost).toBe(false);
        expect(revived).toEqual([1]);
        expect(hookResult).toEqual({ recurring: [], staleOneOffs: [] });
    });

    test('manual deactivation still RECALLS (removes) items -- ghosts are KO-only', () => {
        const r = routine({ isActive: true });
        const item = routineTask();
        const removed = [];

        Routines.toggleRoutineActive('r1', {
            definedRoutines: [r], routineSlots: 3, activeItems: [item], removeItem: (id) => removed.push(id),
            alert: () => {}, generateDailyHabitInstances: () => {}, generateDailyRoutineTaskInstances: () => {},
            currentGameDate: new Date(), saveGame: () => {},
        });

        expect(removed).toEqual([1]);
        expect(item.koGhost).toBeUndefined();
    });
});

describe('completing a ghost', () => {
    test('a ghost TASK pays XP but 0 points', () => {
        const r = routine({ koState: { koAt: Date.now() }, isActive: false, habitDefinitionIds: [] });
        const item = routineTask({ koGhost: true });
        const deps = makeDeps({ activeItems: [item], definedRoutines: [r] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerXP()).toBe(CONFIG.XP_PER_TASK_DEFEAT);
        expect(deps.getPlayerPoints()).toBe(100);
        expect(r.xp).toBe(0); // a KO'd routine earns no hero XP
    });

    test('a LIVE task still pays points (control)', () => {
        const r = routine({ habitDefinitionIds: [] });
        const item = routineTask();
        const deps = makeDeps({ activeItems: [item], definedRoutines: [r] });

        Items.completeItem(1, deps);

        expect(deps.getPlayerPoints()).toBe(100 + CONFIG.POINTS_PER_TASK);
    });

    test('a ghost HABIT still records a success occurrence and extends the streak, for 0 points', () => {
        const r = routine({ koState: { koAt: Date.now() }, isActive: false, taskDefinitionIds: [] });
        const def = habitDef({ streak: 2 });
        const item = habit({ koGhost: true });
        const deps = makeDeps({ activeItems: [item], definedHabits: [def], definedRoutines: [r] });

        Items.completeItem(2, deps);

        expect(def.streak).toBe(3);
        expect(def.occurrenceHistory.length).toBe(1);
        expect(deps.getPlayerXP()).toBe(CONFIG.XP_PER_HABIT_COMPLETE);
        expect(deps.getPlayerPoints()).toBe(100);
    });
});

describe('uncompleteItem restores the routine\'s CURRENT ghost state', () => {
    function completedTask(ghost, routineKo) {
        const r = routine({ habitDefinitionIds: [], koState: routineKo ? { koAt: Date.now() } : null, isActive: !routineKo });
        const item = routineTask({ koGhost: ghost, completedAt: new Date() });
        const completed = [item];
        const deps = makeDeps({ activeItems: [], completedItems: completed, definedRoutines: [r] });
        deps.setPlayerPoints(50);
        return { item, deps, r };
    }

    test('ghost completion undone while the routine is still KO\'d: stays a ghost, no points deducted', () => {
        const { item, deps } = completedTask(true, true);
        Items.uncompleteItem(1, deps);
        expect(item.koGhost).toBe(true);
        expect(deps.getPlayerPoints()).toBe(50);
    });

    test('ghost completion undone after the routine revived: back to a live item, no points deducted', () => {
        const { item, deps } = completedTask(true, false);
        Items.uncompleteItem(1, deps);
        expect(item.koGhost).toBe(false);
        expect(deps.getPlayerPoints()).toBe(50);
    });

    test('a normal completion undone still deducts its points (control)', () => {
        const { item, deps } = completedTask(false, false);
        Items.uncompleteItem(1, deps);
        expect(item.koGhost).toBe(false);
        expect(deps.getPlayerPoints()).toBe(50 - CONFIG.POINTS_PER_TASK);
    });
});

describe('Items.ghostAdjustedPoints / syncGhostLook', () => {
    test('scales a ghost\'s points by the factor and passes live items through', () => {
        expect(Items.ghostAdjustedPoints({ koGhost: true }, 10)).toBe(0);
        expect(Items.ghostAdjustedPoints({ koGhost: false }, 10)).toBe(10);
        expect(Items.ghostAdjustedPoints({}, 10)).toBe(10);
    });

    test('syncGhostLook toggles the fade classes and drops overdue styling on a ghost', () => {
        const item = routineTask({ koGhost: true });
        item.element.classList.add('enemy-at-base');
        item.listItemElement.classList.add('overdue-list-item');

        Items.syncGhostLook(item);

        expect(item.element.classList.contains('ko-ghost')).toBe(true);
        expect(item.element.classList.contains('enemy-at-base')).toBe(false);
        expect(item.listItemElement.classList.contains('ko-ghost-list-item')).toBe(true);
        expect(item.listItemElement.classList.contains('overdue-list-item')).toBe(false);

        item.koGhost = false;
        Items.syncGhostLook(item);
        expect(item.element.classList.contains('ko-ghost')).toBe(false);
        expect(item.listItemElement.classList.contains('ko-ghost-list-item')).toBe(false);
    });
});
