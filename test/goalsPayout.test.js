/**
 * @jest-environment jsdom
 *
 * Goals Build C payouts (2026-11-05): a met period pays a bonus on the points earned in it, a finished one-time goal / monthly period
 * earns an Earned Sick Day (with the age + cooldown rules), owed items are paid later, and the roster claim / keep calls.
 */
global.CONFIG = require('../js/config.js');
global.Goals = require('../js/goals.js');
global.GoalMetrics = require('../js/goalMetrics.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.RunStats = require('../js/runStats.js');
global.Shop = require('../js/shop.js');
const State = require('../js/state.js');

const NOON = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0, 0);
const DAY = 86400000;
const dayRec = (date, over) => Object.assign(DailyRecord.fresh({ date }), over || {});
function fakePersistence(days) {
    global.Persistence = { loadDays: () => ({ v: DailyRecord.V, days: days || {}, months: {} }), saveDays: () => true, requestSave: jest.fn() };
}
beforeEach(() => {
    fakePersistence({});
    State.setGoals(null);
    State.setToday(null);
    State.setPlayerLevel(1);
    State.setDaysSurvived(0);
    State.setPlayerPoints(0);
    State.setPlayerInventory({});
});
afterAll(() => { delete global.Persistence; });

function put(fields, createdAt) {
    const r = Goals.addGoal(Goals.freshGoals(), fields, 6, createdAt, 1);
    State.setGoals(Object.assign(r.goals, { seeded: true }));
    return r.goal;
}
const weekFields = (extra) => Object.assign({
    name: 'Week', kind: 'recurring', period: 'week',
    targets: [{ type: 'aggregate', label: 'Tasks', metric: 'tasksDone', op: 'sum', threshold: 3, compare: 'gte' }],
}, extra || {});
const metWeek = () => ({ '2026-11-03': dayRec('2026-11-03', { done: Object.assign(DailyRecord.fresh().done, { task: 4 }), pts: { earned: 100, spent: 0, end: 0 } }) });

describe('recurring: the period bonus', () => {
    test('a met week pays 15% of the points earned in it, plus the streak bonus, and records it', () => {
        put(weekFields(), NOON(2026, 11, 2).getTime());
        fakePersistence(metWeek());
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.getPlayerPoints()).toBe(17); // 100 x 0.15 x 1.1 (first period met: streak 1)
        expect(State.getToday().pg).toMatchObject({ met: 1, pts: 17, items: 0 });
        const ev = State.takeGoalEvents().find(e => e.type === 'period');
        expect(ev).toMatchObject({ met: true, pts: 17, streak: 1, period: 'week', item: null });
    });
    test('a missed week pays nothing, and a met week with nothing earned pays nothing', () => {
        put(weekFields(), NOON(2026, 11, 2).getTime());
        fakePersistence({});
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.getPlayerPoints()).toBe(0);
        State.setGoals(null);
        put(weekFields(), NOON(2026, 11, 2).getTime());
        fakePersistence({ '2026-11-03': dayRec('2026-11-03', { done: Object.assign(DailyRecord.fresh().done, { task: 4 }) }) });
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.getPlayerPoints()).toBe(0);
    });
    test('a weekly goal never pays an item; a monthly one pays an Earned Sick Day once it is a week old', () => {
        put(weekFields(), NOON(2026, 11, 2).getTime());
        fakePersistence(metWeek());
        State.setToday(dayRec('2026-11-09'));
        State.closeGoalPeriods(NOON(2026, 11, 9));
        expect(State.getPlayerInventory().earned_sick_day).toBeUndefined();
        State.takeGoalEvents();

        State.setGoals(null);
        State.setPlayerInventory({});
        put(weekFields({ period: 'month' }), NOON(2026, 10, 1).getTime());
        fakePersistence({ '2026-10-10': dayRec('2026-10-10', { done: Object.assign(DailyRecord.fresh().done, { task: 9 }), pts: { earned: 50, spent: 0, end: 0 } }) });
        State.closeGoalPeriods(NOON(2026, 11, 2));
        expect(State.getPlayerInventory().earned_sick_day).toBe(1);
        expect(State.getToday().pg.items).toBe(1);
        expect(State.takeGoalEvents().find(e => e.type === 'period' && e.met)).toMatchObject({ itemStatus: 'paid', item: { id: 'earned_sick_day' } });
    });
});

describe('milestones: the item, the age rule and the cooldown', () => {
    const boolGoal = (createdAt) => put({ name: 'Big', kind: 'milestone', targets: [{ type: 'bool', label: 'Done?' }] }, createdAt);
    const tick = (now) => State.updateGoalTarget(1, 1, { done: true }, now);

    test('finishing a goal that is a week old earns an Earned Sick Day and the roster keeps the reward text', () => {
        boolGoal(NOON(2026, 10, 20).getTime());
        State.setGoals(Object.assign({}, State.getGoals(), { active: State.getGoals().active.map(g => Object.assign({}, g, { reward: 'Dinner out' })) }));
        State.setToday(dayRec('2026-11-05'));
        const r = tick(NOON(2026, 11, 5));
        expect(r.completed).toHaveLength(1);
        expect(State.getPlayerInventory().earned_sick_day).toBe(1);
        expect(State.getGoals().done[0]).toMatchObject({ reward: 'Dinner out', claimed: false });
        expect(State.takeGoalEvents().find(e => e.type === 'complete')).toMatchObject({ itemStatus: 'paid', item: { id: 'earned_sick_day' } });
    });
    test('a goal made and ticked the same day pays no item and is not owed one', () => {
        boolGoal(NOON(2026, 11, 5).getTime());
        State.setToday(dayRec('2026-11-05'));
        tick(NOON(2026, 11, 5));
        expect(State.getPlayerInventory().earned_sick_day).toBeUndefined();
        expect(State.getGoals().owed).toBe(0);
        expect(State.takeGoalEvents().find(e => e.type === 'complete')).toMatchObject({ itemStatus: 'young', item: null });
    });
    test('a second item inside the cooldown is owed, then paid by the next period close after the cooldown', () => {
        State.setToday(dayRec('2026-11-05'));
        State.setGoals(Object.assign(Goals.freshGoals(), { seeded: true, itemPaidAt: [NOON(2026, 11, 3).getTime()] }));
        const made = Goals.addGoal(State.getGoals(), { name: 'Big', kind: 'milestone', targets: [{ type: 'bool', label: 'Done?' }] }, 6, NOON(2026, 10, 1).getTime(), 1);
        State.setGoals(made.goals);
        tick(NOON(2026, 11, 5));
        expect(State.getPlayerInventory().earned_sick_day).toBeUndefined();
        expect(State.getGoals().owed).toBe(1);
        State.closeGoalPeriods(NOON(2026, 11, 7)); // still inside the 7-day cooldown
        expect(State.getGoals().owed).toBe(1);
        State.closeGoalPeriods(NOON(2026, 11, 11));
        expect(State.getGoals().owed).toBe(0);
        expect(State.getPlayerInventory().earned_sick_day).toBe(1);
        expect(State.takeGoalEvents().some(e => e.type === 'owed')).toBe(true);
    });
});

describe('claim and keep', () => {
    test('claimGoalReward toggles the roster card; keepGoal clears the Example flag', () => {
        State.setGoals({ active: [{ id: 2, name: 'Ex', kind: 'milestone', targets: [{ id: 1, type: 'bool', label: 'x' }], suggested: true, createdAt: 1 }], done: [{ id: 1, name: 'Old', kind: 'milestone', reward: 'Treat', finishedAt: 5 }], nextId: 3, seeded: true });
        expect(State.claimGoalReward(1, true)).toBe(true);
        expect(State.getGoals().done[0].claimed).toBe(true);
        expect(State.claimGoalReward(1, true)).toBe(false);
        expect(State.keepGoal('2')).toBe(true);
        expect(State.getGoals().active[0].suggested).toBeUndefined();
        expect(State.keepGoal(2)).toBe(false);
    });
});

describe('the Earned Sick Day catalog row', () => {
    const row = CONFIG.SHOP_ITEMS.find(r => r.id === 'earned_sick_day');
    test('works like a Sick Day, is never for sale, and survives a new run', () => {
        expect(row).toMatchObject({ category: 'sickDay', consumable: true, notForSale: true, keptAcrossRuns: true });
        expect(Shop.purchase('earned_sick_day', CONFIG.SHOP_ITEMS, {}, 9999, 0)).toMatchObject({ ok: false, reason: 'unknown_item' });
        expect(Shop.grant('earned_sick_day', 1, CONFIG.SHOP_ITEMS, {}).ok).toBe(true);
        expect(require('../js/runCarryover.js').inventoryToKeep({ earned_sick_day: 2, sick_day: 3 }, CONFIG.SHOP_ITEMS)).toEqual({ earned_sick_day: 2 });
    });
});
