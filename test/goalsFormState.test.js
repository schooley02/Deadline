/**
 * @jest-environment jsdom
 *
 * Goals Build B2 (2026-11-05; docs/GOALS_PLAN.md "Build B2 as built"): State's Add / Edit entry points -- addGoal, editGoal,
 * the link options the picker reads, and the one-off task links (item.goalId / item.goalTargetId + the target's itemTotal).
 */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.GoalMetrics = require('../js/goalMetrics.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.RunStats = require('../js/runStats.js');
global.RunCarryover = require('../js/runCarryover.js');
global.PrioritySlots = require('../js/prioritySlots.js');
const State = require('../js/state.js');

const NOON = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0);
const NOW = NOON(2026, 11, 5);

function fakePersistence() {
    global.Persistence = {
        loadDays: () => ({ v: DailyRecord.V, days: {}, months: {} }),
        saveDays: () => true,
        requestSave: jest.fn(),
    };
}
const task = (id, name, over) => Object.assign({ id, type: 'task', name, parentId: null, dueDateTime: new Date(2026, 10, 6, 17, 0), isHighPriority: false }, over);

beforeEach(() => {
    fakePersistence();
    State.setGoals(null);
    State.setToday(null);
    State.setPlayerLevel(1);
    State.setDaysSurvived(0);
    State.setActiveItems([]);
    State.setDefinedHabits([]);
    State.setDefinedRoutines([]);
});
afterAll(() => { delete global.Persistence; });

const milestoneFields = (targets) => ({ name: 'Ship it', kind: 'milestone', deadline: '2026-12-31', targets });
const linkedFields = (over) => Object.assign({ type: 'linked', label: 'Tasks', count: 1, habitDefIds: [], routineIds: [] }, over);

describe('State.addGoal', () => {
    test('adds into the next free slot, saves, and returns the new goal', () => {
        const r = State.addGoal(milestoneFields([{ type: 'bool', label: 'Done?' }]), [], NOW);
        expect(r.ok).toBe(true);
        expect(r.goal.name).toBe('Ship it');
        expect(State.getGoals().active).toHaveLength(1);
        expect(global.Persistence.requestSave).toHaveBeenCalled();
    });

    test('refuses when every slot is used, leaving the list alone', () => {
        State.addGoal(milestoneFields([{ type: 'bool', label: 'a' }]), [], NOW);
        State.addGoal(milestoneFields([{ type: 'bool', label: 'b' }]), [], NOW);
        const r = State.addGoal(milestoneFields([{ type: 'bool', label: 'c' }]), [], NOW);
        expect(r).toMatchObject({ ok: false, reason: 'full' });
        expect(State.getGoals().active).toHaveLength(2);
    });

    test('refuses an invalid goal', () => {
        expect(State.addGoal({ name: '', kind: 'milestone', targets: [] }, [], NOW)).toMatchObject({ ok: false, reason: 'invalid' });
        expect(State.getGoals().active).toHaveLength(0);
    });

    test('a milestone with a linked target adopts the picked open tasks and counts them', () => {
        State.setActiveItems([task(1, 'Write'), task(2, 'Send'), task(3, 'Other')]);
        const r = State.addGoal(milestoneFields([linkedFields()]), [{ targetIndex: 0, itemIds: [1, 2] }], NOW);
        const t = r.goal.targets[0];
        const items = State.getActiveItems();
        expect(items[0]).toMatchObject({ goalId: r.goal.id, goalTargetId: t.id });
        expect(items[1]).toMatchObject({ goalId: r.goal.id, goalTargetId: t.id });
        expect(items[2].goalId).toBeUndefined();
        expect(State.getGoals().active[0].targets[0].itemTotal).toBe(2);
    });

    test('ineligible picks (a sub-task, a routine task, a missing id) are skipped', () => {
        State.setActiveItems([task(1, 'Parent'), task(2, 'Sub', { parentId: 1 }), task(3, 'Routine', { definitionId: 'd1' })]);
        const r = State.addGoal(milestoneFields([linkedFields()]), [{ targetIndex: 0, itemIds: [2, 3, 99] }], NOW);
        expect(State.getActiveItems().every(i => i.goalId === undefined)).toBe(true);
        expect(State.getGoals().active[0].targets[0].itemTotal).toBe(0);
        expect(r.ok).toBe(true);
    });
});

describe('State.editGoal', () => {
    function milestoneWithTasks() {
        State.setActiveItems([task(1, 'Write'), task(2, 'Send'), task(3, 'Other')]);
        const r = State.addGoal(milestoneFields([linkedFields()]), [{ targetIndex: 0, itemIds: [1, 2] }], NOW);
        return r.goal;
    }

    test('re-picking tasks unlinks the dropped one and links the new one; the total follows', () => {
        const g = milestoneWithTasks();
        const tid = g.targets[0].id;
        const r = State.editGoal(g.id, milestoneFields([Object.assign(linkedFields(), { id: tid })]), [{ targetIndex: 0, itemIds: [2, 3] }], NOW);
        expect(r.ok).toBe(true);
        const items = State.getActiveItems();
        expect(items[0].goalId).toBeNull();
        expect(items[1].goalId).toBe(g.id);
        expect(items[2].goalId).toBe(g.id);
        expect(State.getGoals().active[0].targets[0].itemTotal).toBe(2);
    });

    test('a finished linked task stays counted (itemDone) when the picks change', () => {
        const g = milestoneWithTasks();
        const tid = g.targets[0].id;
        State.updateGoalTarget(g.id, tid, {}, NOW); // no-op, just proves the call is safe
        const goals = State.getGoals();
        State.setGoals(Object.assign({}, goals, { active: [Object.assign({}, goals.active[0], { targets: [Object.assign({}, goals.active[0].targets[0], { itemDone: 1, itemTotal: 3 })] })] }));
        State.editGoal(g.id, milestoneFields([Object.assign(linkedFields(), { id: tid })]), [{ targetIndex: 0, itemIds: [1] }], NOW);
        const t = State.getGoals().active[0].targets[0];
        expect(t.itemDone).toBe(1);
        expect(t.itemTotal).toBe(2); // 1 done + 1 live
    });

    test('a task moved from one goal to another leaves the first goal\'s count', () => {
        const a = milestoneWithTasks(); // tasks 1 and 2
        State.addGoal({ name: 'Second', kind: 'milestone', deadline: null, targets: [linkedFields()] }, [{ targetIndex: 0, itemIds: [2] }], NOW);
        const goals = State.getGoals();
        const second = goals.active[1];
        expect(State.getActiveItems()[1]).toMatchObject({ goalId: second.id });
        expect(goals.active[0].targets[0].itemTotal).toBe(1); // task 2 left goal A
        expect(a.id).not.toBe(second.id);
    });

    test('dropping a target clears the links its tasks wore', () => {
        const g = milestoneWithTasks();
        const r = State.editGoal(g.id, milestoneFields([{ type: 'bool', label: 'Just a check' }]), [], NOW);
        expect(r.ok).toBe(true);
        expect(State.getActiveItems().every(i => i.goalId == null)).toBe(true);
    });

    test('an invalid edit changes nothing', () => {
        const g = milestoneWithTasks();
        const before = JSON.stringify(State.getGoals());
        expect(State.editGoal(g.id, { name: '', kind: 'milestone', targets: [] }, [], NOW)).toMatchObject({ ok: false });
        expect(JSON.stringify(State.getGoals())).toBe(before);
        expect(State.getActiveItems()[0].goalId).toBe(g.id);
    });

    test('an edit clears the Example chip', () => {
        State.ensureGoalsSeeded(NOW);
        const g = State.getGoals().active[0];
        expect(g.suggested).toBe(true);
        State.editGoal(g.id, { name: 'Mine', targets: g.targets, deadline: g.deadline }, [], NOW);
        expect(State.getGoals().active[0].suggested).toBeUndefined();
    });
});

describe('deleting or retiring a goal frees its tasks', () => {
    test('deleteGoal clears the link fields on the open tasks', () => {
        State.setActiveItems([task(1, 'Write')]);
        const r = State.addGoal(milestoneFields([linkedFields()]), [{ targetIndex: 0, itemIds: [1] }], NOW);
        expect(State.getActiveItems()[0].goalId).toBe(r.goal.id);
        State.deleteGoal(r.goal.id);
        expect(State.getActiveItems()[0].goalId).toBeNull();
        expect(State.getActiveItems()[0].goalTargetId).toBeNull();
    });
});

describe('State.getGoalLinkOptions / getGoalLinkedItemIds', () => {
    test('lists linkable open tasks, Build Habits that are not archived, and routines', () => {
        State.setActiveItems([task(1, 'Write'), task(2, 'Sub', { parentId: 1 }), task(3, 'Routine task', { definitionId: 'd' }), { id: 4, type: 'habit', name: 'Walk' }]);
        State.setDefinedHabits([
            { id: 'h1', name: 'Walk', isNegative: false },
            { id: 'h2', name: 'Skip sugar', isNegative: true },
            { id: 'h3', name: 'Old', isNegative: false, archivedAt: 123 },
        ]);
        State.setDefinedRoutines([{ id: 'r1', name: 'Morning' }]);
        const o = State.getGoalLinkOptions();
        expect(o.tasks.map(t => t.id)).toEqual([1]);
        expect(o.habits.map(h => h.id)).toEqual(['h1']);
        expect(o.routines.map(r => r.id)).toEqual(['r1']);
    });

    test('a task already linked to a goal says which one', () => {
        State.setActiveItems([task(1, 'Write')]);
        const r = State.addGoal(milestoneFields([linkedFields()]), [{ targetIndex: 0, itemIds: [1] }], NOW);
        expect(State.getGoalLinkOptions().tasks[0].goalId).toBe(r.goal.id);
        expect(State.getGoalLinkedItemIds(r.goal.id)).toEqual({ [r.goal.targets[0].id]: [1] });
    });
});
