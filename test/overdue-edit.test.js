/**
 * Regression coverage for the overdue-edit back-charge bug (found 2026-07-20,
 * Cowork visual-audit session; fixed 2026-07-21). Editing a task's due date
 * INTO THE PAST used to park `lastDamageTickTime` at the (potentially far
 * past) due time via `markAsOverdue`, so the live loop would replay every
 * missed 5-min interval at one per 50ms game tick — a same-day 10PM->9AM
 * edit dealt -92 HP in seconds. Design decision (Jeremy, Fable, same
 * session — see DECISIONS.md): an edit is a bookkeeping correction, not
 * evidence of an attack the player dodged, so NOTHING is back-charged — the
 * damage clock starts at the edit-landing moment instead, matching the
 * already-guarded created-already-overdue precedent in spawning.js. Live
 * damage from that point forward stays uncapped/unbounded by design (only
 * the retroactive back-charge is removed, not ongoing pressure).
 *
 * None of the existing suites exercised `Items.recomputeOverdueStateAfterEdit`'s
 * "pulled into the past" branch directly — that's why 1258 green missed this.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.FrozenSlots = require('../js/frozenSlots.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
global.RunStats = require('../js/runStats.js');
const Items = require('../js/items.js');

function fakeEl() {
    return {
        style: {},
        dataset: {},
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {},
        appendChild: () => {},
        remove: () => {},
        querySelector: () => null,
    };
}

function taskItem(overrides = {}) {
    return {
        id: 1, type: 'task', name: 'Task', category: 'other',
        isHighPriority: false, dueDateTime: new Date(),
        isOverdue: false, lastDamageTickTime: null, parentId: null,
        subTasks: [], completedSubTasks: 0, totalSubTasks: 0,
        element: fakeEl(), listItemElement: fakeEl(),
        ...overrides,
    };
}

function makeDeps(overrides = {}) {
    const definedHabits = overrides.definedHabits || [];
    const { definedHabits: _d, ...rest } = overrides;
    return {
        definedHabits: () => definedHabits,
        baseWidth: 120,
        calculateTimelineXWithClustering: () => 0,
        getSubTaskClusterOffset: () => 0,
        saveGame: () => {},
        ...rest,
    };
}

describe('Items.recomputeOverdueStateAfterEdit — pulled into the past', () => {
    test('does NOT back-charge: lastDamageTickTime starts at the edit landing, not the due time', () => {
        const farPastDue = new Date(Date.now() - 13 * 60 * 60 * 1000); // 13h ago
        const item = taskItem({ dueDateTime: farPastDue, isOverdue: false, lastDamageTickTime: null });
        const deps = makeDeps();

        const before = Date.now();
        Items.recomputeOverdueStateAfterEdit(item, deps);
        const after = Date.now();

        expect(item.isOverdue).toBe(true);
        // The old bug: lastDamageTickTime === farPastDue.getTime() (~157 pending
        // 5-min intervals). The fix: it lands at "now", not the due time.
        expect(item.lastDamageTickTime).not.toBe(farPastDue.getTime());
        expect(item.lastDamageTickTime).toBeGreaterThanOrEqual(before);
        expect(item.lastDamageTickTime).toBeLessThanOrEqual(after);
    });

    test('zero pending damage intervals immediately after the edit (the actual back-charge guard)', () => {
        const farPastDue = new Date(Date.now() - 13 * 60 * 60 * 1000);
        const item = taskItem({ dueDateTime: farPastDue });
        const deps = makeDeps();

        Items.recomputeOverdueStateAfterEdit(item, deps);

        // Mirrors how loop.js computes pending ticks: (now - lastDamageTickTime)
        // should be ~0, not ~13h worth of DAMAGE_INTERVAL_MS ticks.
        const pendingMs = Date.now() - item.lastDamageTickTime;
        const pendingTicks = Math.floor(pendingMs / CONFIG.DAMAGE_INTERVAL_MS);
        expect(pendingTicks).toBe(0);
    });

    test('moves the sprite to the base and flags the DOM as overdue', () => {
        const item = taskItem({ dueDateTime: new Date(Date.now() - 60 * 1000) });
        const deps = makeDeps({ baseWidth: 120, getSubTaskClusterOffset: () => 5 });

        Items.recomputeOverdueStateAfterEdit(item, deps);

        expect(item.x).toBe(125); // baseWidth + offset
    });

    test('a habit pulled into the past also gets the same no-back-charge clock', () => {
        const habitDef = { id: 'def1', streak: 2, occurrenceHistory: [], isNegative: false };
        const item = taskItem({
            type: 'habit', definitionId: 'def1',
            dueDateTime: new Date(Date.now() - 6 * 60 * 60 * 1000),
            originalDueDate: new Date(Date.now() - 6 * 60 * 60 * 1000),
        });
        const deps = makeDeps({ definedHabits: [habitDef] });

        Items.recomputeOverdueStateAfterEdit(item, deps);

        expect(item.isOverdue).toBe(true);
        expect(item.lastDamageTickTime).toBeGreaterThan(item.dueDateTime.getTime());
    });

    test('pushing an overdue item BACK into the future still clears overdue state (regression guard, unchanged behavior)', () => {
        const item = taskItem({
            dueDateTime: new Date(Date.now() + 60 * 60 * 1000),
            isOverdue: true,
            lastDamageTickTime: Date.now() - 1000,
        });
        const deps = makeDeps();

        Items.recomputeOverdueStateAfterEdit(item, deps);

        expect(item.isOverdue).toBe(false);
        expect(item.lastDamageTickTime).toBeNull();
    });

    test('a negative-habit lurker is never marked overdue by an edit (session-27 guard, unchanged)', () => {
        const item = taskItem({
            type: 'habit', isNegative: true,
            dueDateTime: new Date(Date.now() - 60 * 60 * 1000),
        });
        const deps = makeDeps();

        Items.recomputeOverdueStateAfterEdit(item, deps);

        expect(item.isOverdue).toBe(false);
    });
});
