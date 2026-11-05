/** Goal rewards (Goals Build C, 2026-11-05): the bonus math, item gating, edit-next-period rule, claim and keep. Pure js/goals.js. */
global.CONFIG = require('../js/config.js');
const Goals = require('../js/goals.js');
const R = CONFIG.GOAL_REWARDS;
const DAY = 86400000;
const NOW = new Date(2026, 10, 5, 12, 0, 0).getTime();

describe('periodBonus', () => {
    test('is a share of the points earned in the period, per period length', () => {
        expect(Goals.periodBonus('day', 20, 0, R)).toBe(2);
        expect(Goals.periodBonus('week', 100, 0, R)).toBe(15);
        expect(Goals.periodBonus('month', 300, 0, R)).toBe(60);
    });
    test('grows 10% of the bonus per consecutive period met and caps at +50%', () => {
        expect(Goals.periodBonus('week', 100, 1, R)).toBe(17); // 15 x 1.1 = 16.5
        expect(Goals.periodBonus('week', 100, 5, R)).toBe(23); // 15 x 1.5 = 22.5
        expect(Goals.periodBonus('week', 100, 40, R)).toBe(23); // capped
    });
    test('a quiet period pays nothing, so an easy goal cannot be farmed', () => {
        expect(Goals.periodBonus('week', 0, 9, R)).toBe(0);
        expect(Goals.periodBonus('week', -5, 9, R)).toBe(0);
        expect(Goals.periodBonus('week', NaN, 9, R)).toBe(0);
        expect(Goals.periodBonus('year', 100, 1, R)).toBe(0);
        expect(Goals.periodBonus('week', 100, 1, null)).toBe(0);
    });
});

describe('itemPayable', () => {
    test('needs a goal at least a week old and a quiet week since the last goal item', () => {
        expect(Goals.itemPayable(NOW - 2 * DAY, [], NOW, R)).toBe(false);
        expect(Goals.itemPayable(NOW - 8 * DAY, [], NOW, R)).toBe(true);
        expect(Goals.itemPayable(NOW - 30 * DAY, [NOW - 3 * DAY], NOW, R)).toBe(false);
        expect(Goals.itemPayable(NOW - 30 * DAY, [NOW - 8 * DAY, NOW - 20 * DAY], NOW, R)).toBe(true);
    });
});

function weekly(extra) {
    return Goals.addGoal(Goals.freshGoals(), Object.assign({
        name: 'Weekly', kind: 'recurring', period: 'week',
        targets: [{ type: 'aggregate', label: 'x', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte', count: 1 }],
    }, extra || {}), 3, NOW, 1);
}

describe('reward text and the next-period rule', () => {
    test('a reward is kept (trimmed, capped) and cleared by an empty one', () => {
        const added = weekly({ reward: '  Pizza night ' });
        expect(added.goal.reward).toBe('Pizza night');
        const long = Goals.addGoal(Goals.freshGoals(), { name: 'G', kind: 'milestone', targets: [{ type: 'bool', label: 'x' }], reward: 'y'.repeat(200) }, 3, NOW, 1);
        expect(long.goal.reward).toHaveLength(80);
        const r = Goals.editGoal(added.goals, added.goal.id, { name: 'Weekly', reward: '', targets: added.goal.targets }, NOW, 1);
        expect(r.goal.reward).toBeUndefined();
    });
    test('a recurring goal\'s target edit waits for the next period; a name or reward edit applies now', () => {
        const { goals, goal } = weekly();
        const changed = Object.assign({}, goal.targets[0], { threshold: 1 });
        const r = Goals.editGoal(goals, goal.id, { name: 'Renamed', reward: 'Coffee', targets: [changed] }, NOW, 1);
        expect(r.goal.name).toBe('Renamed');
        expect(r.goal.reward).toBe('Coffee');
        expect(r.goal.targets[0].threshold).toBe(3);
        expect(r.goal.next.targets[0].threshold).toBe(1);
        const same = Goals.editGoal(goals, goal.id, { name: 'Again', targets: goal.targets }, NOW, 1);
        expect(same.goal.next).toBeUndefined();
        const undone = Goals.editGoal(r.goals, goal.id, { name: 'Renamed', targets: goal.targets }, NOW, 1);
        expect(undone.goal.next).toBeUndefined(); // editing back to what it was drops the pending change
    });
    test('the pending targets replace the live ones when the period closes, and survive sanitize', () => {
        const { goals, goal } = weekly();
        const pending = Object.assign({}, goal, { next: { targets: [Object.assign({}, goal.targets[0], { threshold: 9 })] } });
        const kept = Goals.sanitizeGoals(Object.assign({}, goals, { active: [pending] }));
        expect(kept.active[0].next.targets[0].threshold).toBe(9);
        const later = new Date(2026, 10, 20, 12).getTime();
        const r = Goals.closePeriods(kept.active[0], { nowMs: later, weekStartsOn: 1, recordsFor: () => ({ records: [{ pts: { earned: 7 } }, { pts: { earned: 5 } }], openKey: null }), metricValue: () => 0 });
        expect(r.outcomes.length).toBeGreaterThan(0);
        expect(r.outcomes[0].earned).toBe(12);
        expect(r.goal.next).toBeUndefined();
        expect(r.goal.targets[0].threshold).toBe(9);
    });
});

describe('roster: reward, claimed, onTime', () => {
    test('a finished milestone records its reward, whether it beat its deadline, and starts unclaimed', () => {
        const made = Goals.addGoal(Goals.freshGoals(), { name: 'Book', kind: 'milestone', deadline: '2026-12-31', targets: [{ type: 'bool', label: 'x' }], reward: 'A weekend away' }, 3, NOW, 1);
        const rec = Goals.recordFor(made.goal, NOW, 3);
        expect(rec.reward).toBe('A weekend away');
        expect(rec.claimed).toBe(false);
        expect(rec.onTime).toBe(true);
        expect(Goals.recordFor(made.goal, new Date(2027, 0, 5).getTime(), 3).onTime).toBe(false);
        expect(Goals.recordFor(Object.assign({}, made.goal, { deadline: null }), NOW, 3).onTime).toBeNull();
    });
    test('claimReward toggles one record and returns the same object when nothing changes', () => {
        const goals = Goals.sanitizeGoals({ active: [], done: [{ id: 4, name: 'a', kind: 'milestone', reward: 'x', finishedAt: 1 }], nextId: 5 });
        const claimed = Goals.claimReward(goals, '4', true);
        expect(claimed.done[0].claimed).toBe(true);
        expect(Goals.claimReward(claimed, 4, true)).toBe(claimed);
        expect(Goals.claimReward(claimed, 4, false).done[0].claimed).toBe(false);
        expect(Goals.claimReward(goals, 99, true)).toBe(goals);
    });
});

describe('keepGoal', () => {
    test('clears the Example flag and is a no-op otherwise', () => {
        const { goals, goal } = weekly();
        const suggested = Object.assign({}, goals, { active: [Object.assign({}, goal, { suggested: true })] });
        expect(Goals.keepGoal(suggested, String(goal.id)).active[0].suggested).toBeUndefined();
        expect(Goals.keepGoal(goals, goal.id)).toBe(goals);
    });
});

describe('sanitize keeps the owed count and the paid times in range', () => {
    test('owed is a small whole number, itemPaidAt the last ten numbers', () => {
        const g = Goals.sanitizeGoals({ owed: 7.5, itemPaidAt: [1, 'x', 3] });
        expect(g.owed).toBe(0);
        expect(g.itemPaidAt).toEqual([1, 3]);
        expect(Goals.sanitizeGoals({ owed: 3 }).owed).toBe(3);
        expect(Goals.sanitizeGoals({ itemPaidAt: Array.from({ length: 30 }, (_, i) => i) }).itemPaidAt).toHaveLength(10);
    });
});
