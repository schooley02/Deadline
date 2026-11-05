/**
 * Goals Build B2 (2026-11-05; docs/GOALS_PLAN.md "Build B2 as built"): the pure rules behind the Add / Edit form --
 * editGoal (name, deadline, targets; kind and period stay fixed), setLinkedTotal (the one-off link counter self-heals),
 * and clearItemLinkFields helpers.
 */
const Goals = require('../js/goals.js');

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0, 0);
const MS = (date) => date.getTime();
const NOW = MS(at(2026, 11, 5));

const numberFields = (over) => Object.assign({ type: 'number', label: 'Steps', start: 0, end: 10, unit: 'steps' }, over);
const linkedFields = (over) => Object.assign({ type: 'linked', label: 'Two things', count: 2, habitDefIds: [], routineIds: [] }, over);

function baseList(slots) {
    const added = Goals.addGoal(Goals.freshGoals(), {
        name: 'Big', kind: 'milestone', deadline: null,
        targets: [numberFields(), { type: 'bool', label: 'Sign it' }],
    }, slots || 3, NOW, 1);
    return added.goals;
}

describe('editGoal', () => {
    test('changes the name and deadline of a milestone and clears the example flag', () => {
        let goals = baseList();
        goals = Object.assign({}, goals, { active: goals.active.map(g => Object.assign({}, g, { suggested: true })) });
        const id = goals.active[0].id;
        const r = Goals.editGoal(goals, id, { name: '  New name ', deadline: '2026-12-31', targets: goals.active[0].targets }, NOW, 1);
        expect(r.ok).toBe(true);
        expect(r.goal.name).toBe('New name');
        expect(r.goal.deadline).toBe('2026-12-31');
        expect(r.goal.suggested).toBeUndefined();
        expect(r.goals.active[0]).toBe(r.goal);
    });

    test('kind, period, id, createdAt and a recurring goal\'s streak and history are never changed by an edit', () => {
        const added = Goals.addGoal(Goals.freshGoals(), {
            name: 'Weekly', kind: 'recurring', period: 'week',
            targets: [{ type: 'aggregate', label: 'x', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte', count: 1 }],
        }, 3, NOW, 1);
        const g = Object.assign({}, added.goal, { streak: 4, bestStreak: 6, periodsMet: 9, stage: 3, history: [{ key: '2026-10-26', met: true, progress: 1 }] });
        const goals = Object.assign({}, added.goals, { active: [g] });
        const r = Goals.editGoal(goals, g.id, { name: 'Renamed', kind: 'milestone', period: 'day', deadline: '2026-12-01', targets: g.targets }, NOW + 1000, 1);
        expect(r.ok).toBe(true);
        expect(r.goal.kind).toBe('recurring');
        expect(r.goal.period).toBe('week');
        expect(r.goal.deadline).toBeNull();
        expect(r.goal.createdAt).toBe(g.createdAt);
        expect(r.goal.streak).toBe(4);
        expect(r.goal.bestStreak).toBe(6);
        expect(r.goal.stage).toBe(3);
        expect(r.goal.periodKey).toBe(g.periodKey);
        expect(r.goal.history).toEqual(g.history);
    });

    test('an edited number target keeps its current value (clamped into the new range); a changed range is applied', () => {
        const goals = baseList();
        const goal = goals.active[0];
        const num = goal.targets[0];
        const withCurrent = Object.assign({}, goals, { active: [Object.assign({}, goal, { targets: [Object.assign({}, num, { current: 8 }), goal.targets[1]] })] });
        const r = Goals.editGoal(withCurrent, goal.id, {
            name: 'Big', deadline: null,
            targets: [numberFields({ id: num.id, end: 6, unit: 'laps' }), { id: goal.targets[1].id, type: 'bool', label: 'Sign it' }],
        }, NOW, 1);
        const t = r.goal.targets[0];
        expect(t.id).toBe(num.id);
        expect(t.end).toBe(6);
        expect(t.unit).toBe('laps');
        expect(t.current).toBe(6);
    });

    test('a bool target keeps its flag; a new target gets the next free id; a dropped target is gone', () => {
        const goals = baseList();
        const goal = goals.active[0];
        const done = Object.assign({}, goals, { active: [Object.assign({}, goal, { targets: [goal.targets[0], Object.assign({}, goal.targets[1], { done: true })] })] });
        const r = Goals.editGoal(done, goal.id, {
            name: 'Big', deadline: null,
            targets: [{ id: goal.targets[1].id, type: 'bool', label: 'Sign it' }, numberFields({ label: 'Fresh', end: 3 })],
        }, NOW, 1);
        expect(r.ok).toBe(true);
        expect(r.goal.targets).toHaveLength(2);
        expect(r.goal.targets[0].done).toBe(true);
        // A dropped target's id is never reused: an item still wearing it must not count toward a new target.
        expect(r.goal.targets[1].id).toBe(3);
        expect(r.goal.targets[1].label).toBe('Fresh');
        expect(r.goal.targets[1].current).toBe(0);
    });

    test('a linked target keeps its counters across an edit and takes the new count and sources', () => {
        const added = Goals.addGoal(Goals.freshGoals(), { name: 'L', kind: 'recurring', period: 'week', targets: [linkedFields()] }, 3, NOW, 1);
        const g = added.goal;
        const counted = Object.assign({}, added.goals, { active: [Object.assign({}, g, { targets: [Object.assign({}, g.targets[0], { occ: 1, itemTotal: 3, itemDone: 2 })] })] });
        const r = Goals.editGoal(counted, g.id, { name: 'L', targets: [linkedFields({ id: g.targets[0].id, count: 4, habitDefIds: [7], routineIds: ['r1'] })] }, NOW, 1);
        const t = r.goal.targets[0];
        expect(t.occ).toBe(1);
        expect(t.itemTotal).toBe(3);
        expect(t.itemDone).toBe(2);
        expect(t.count).toBe(4);
        expect(t.habitDefIds).toEqual([7]);
        expect(t.routineIds).toEqual(['r1']);
    });

    test('changing a target to another type starts it fresh', () => {
        const goals = baseList();
        const goal = goals.active[0];
        const r = Goals.editGoal(goals, goal.id, { name: 'Big', targets: [{ id: goal.targets[0].id, type: 'bool', label: 'Now a check' }] }, NOW, 1);
        expect(r.goal.targets[0].type).toBe('bool');
        expect(r.goal.targets[0].done).toBe(false);
    });

    test('refuses an empty name, no targets, an unknown goal; leaves the list untouched', () => {
        const goals = baseList();
        const goal = goals.active[0];
        expect(Goals.editGoal(goals, goal.id, { name: '   ', targets: goal.targets }, NOW, 1)).toMatchObject({ ok: false, reason: 'invalid' });
        expect(Goals.editGoal(goals, goal.id, { name: 'x', targets: [] }, NOW, 1)).toMatchObject({ ok: false, reason: 'invalid' });
        expect(Goals.editGoal(goals, 999, { name: 'x', targets: goal.targets }, NOW, 1)).toMatchObject({ ok: false, reason: 'missing' });
        const r = Goals.editGoal(goals, goal.id, { name: '', targets: goal.targets }, NOW, 1);
        expect(r.goals).toBe(goals);
    });

    test('never mutates its input', () => {
        const goals = baseList();
        const snapshot = JSON.stringify(goals);
        Goals.editGoal(goals, goals.active[0].id, { name: 'Other', deadline: '2026-12-31', targets: [numberFields({ id: 1, end: 3 })] }, NOW, 1);
        expect(JSON.stringify(goals)).toBe(snapshot);
    });
});

describe('setLinkedTotal', () => {
    function withLinked() {
        const added = Goals.addGoal(Goals.freshGoals(), { name: 'L', kind: 'milestone', targets: [linkedFields()] }, 3, NOW, 1);
        const g = added.goal;
        return { goals: added.goals, g, t: g.targets[0] };
    }

    test('itemTotal becomes itemDone + the live linked count', () => {
        const { goals, g, t } = withLinked();
        const counted = Object.assign({}, goals, { active: [Object.assign({}, g, { targets: [Object.assign({}, t, { itemTotal: 5, itemDone: 2 })] })] });
        const r = Goals.setLinkedTotal(counted, g.id, t.id, 1);
        expect(r.active[0].targets[0].itemTotal).toBe(3);
        expect(r.active[0].targets[0].itemDone).toBe(2);
    });

    test('returns the same object when nothing changes, ignores an unknown goal or a non-linked target', () => {
        const { goals, g, t } = withLinked();
        expect(Goals.setLinkedTotal(goals, g.id, t.id, 0)).toBe(goals);
        expect(Goals.setLinkedTotal(goals, 999, t.id, 2)).toBe(goals);
        const numberOnly = baseList();
        expect(Goals.setLinkedTotal(numberOnly, numberOnly.active[0].id, numberOnly.active[0].targets[0].id, 2)).toBe(numberOnly);
    });

    test('a negative or junk count counts as zero', () => {
        const { goals, g, t } = withLinked();
        const counted = Object.assign({}, goals, { active: [Object.assign({}, g, { targets: [Object.assign({}, t, { itemTotal: 3, itemDone: 1 })] })] });
        expect(Goals.setLinkedTotal(counted, g.id, t.id, -4).active[0].targets[0].itemTotal).toBe(1);
        expect(Goals.setLinkedTotal(counted, g.id, t.id, NaN).active[0].targets[0].itemTotal).toBe(1);
    });
});

describe('isLinkableTask', () => {
    test('only an open one-off top-level task qualifies', () => {
        const ok = { type: 'task', id: 1, name: 'A' };
        expect(Goals.isLinkableTask(ok)).toBe(true);
        expect(Goals.isLinkableTask({ type: 'habit', id: 2 })).toBe(false);
        expect(Goals.isLinkableTask({ type: 'task', id: 3, parentId: 1 })).toBe(false);
        expect(Goals.isLinkableTask({ type: 'task', id: 4, definitionId: 'd1' })).toBe(false);
        expect(Goals.isLinkableTask({ type: 'task', id: 5, koGhost: true })).toBe(false);
        expect(Goals.isLinkableTask(null)).toBe(false);
    });
});

describe('string ids from the DOM (live bug found in the B2 headless check)', () => {
    test('removeGoal and retireGoal accept an id that arrives as a string', () => {
        const g = { bestSlots: 2, active: [{ id: 1, name: 'A', kind: 'milestone', targets: [], createdAt: 0 }], done: [], nextId: 2, seeded: true };
        expect(Goals.removeGoal(g, '1').active).toHaveLength(0);
        expect(Goals.retireGoal(g, '1', 0, 0, 50).record).not.toBeNull();
    });
});
