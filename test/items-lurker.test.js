/**
 * Items — negative-habit lurker guards ([P1-DATA-005] session 27).
 *
 * js/items.js references the globals CONFIG and Habits (loaded before it via
 * <script> tags in the browser). In Node we bind them from the real modules
 * before requiring items.js, matching habits.test.js's global-binding
 * approach. Only the lurker-related surface (isNonThreatening, and the two
 * defensive guards it added to markAsOverdue/recomputeOverdueStateAfterEdit)
 * is covered here — the rest of items.js's behavior is exercised through
 * subtask-creation.test.js and friends.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
const Items = require('../js/items.js');

function fakeEl() {
    const classes = new Set();
    return {
        style: {},
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
            has: (c) => classes.has(c),
        },
        _classes: classes,
    };
}

function makeDeps(overrides = {}) {
    return {
        definedHabits: () => [],
        saveGame: () => {},
        baseWidth: 100,
        calculateTimelineXWithClustering: () => 500,
        getSubTaskClusterOffset: () => 0,
        ...overrides,
    };
}

describe('Items.isNonThreatening', () => {
    test('true for a negative habit instance', () => {
        expect(Items.isNonThreatening({ type: 'habit', isNegative: true })).toBe(true);
    });
    test('false for a positive habit instance', () => {
        expect(Items.isNonThreatening({ type: 'habit', isNegative: false })).toBe(false);
    });
    test('false for a habit instance with isNegative undefined', () => {
        expect(Items.isNonThreatening({ type: 'habit' })).toBe(false);
    });
    test('false for a task, even with isNegative somehow set', () => {
        expect(Items.isNonThreatening({ type: 'task', isNegative: true })).toBe(false);
    });
});

describe('Items.markAsOverdue — lurker guard', () => {
    test('a negative habit instance is never marked overdue', () => {
        const item = {
            type: 'habit', isNegative: true, isOverdue: false,
            dueDateTime: new Date(Date.now() - 1000),
            element: fakeEl(), listItemElement: fakeEl(),
        };
        Items.markAsOverdue(item, new Date(), makeDeps());
        expect(item.isOverdue).toBe(false);
        expect(item.element._classes.has('enemy-at-base')).toBe(false);
    });

    test('a positive habit instance is unaffected by the guard (still marks overdue)', () => {
        const item = {
            type: 'habit', isNegative: false, isOverdue: false, streak: 0,
            dueDateTime: new Date(Date.now() - 1000),
            element: fakeEl(), listItemElement: fakeEl(),
        };
        Items.markAsOverdue(item, new Date(), makeDeps());
        expect(item.isOverdue).toBe(true);
    });
});

// [P2-GAME-010] Stage 1, session 60. Found live in Chrome: editing a task's
// due date into the past left the walk-urgency class stuck on the element
// alongside the new enemy-at-base pulse, because recomputeOverdueStateAfterEdit
// calls markAsOverdue directly (bypassing loop.js's own tick-transition
// branch, which is where the clear was originally — and only — written).
// Centralizing the clear inside markAsOverdue itself covers both call sites.
describe('Items.markAsOverdue — walk-urgency tier clearing ([P2-GAME-010] Stage 1)', () => {
    test('drops the urgency-tier class and item.urgencyTier when an item goes overdue', () => {
        const item = {
            type: 'task', isOverdue: false,
            dueDateTime: new Date(Date.now() - 1000),
            urgencyTier: 'urgent',
            element: fakeEl(), listItemElement: fakeEl(),
        };
        item.element._classes.add('urgency-urgent');
        Items.markAsOverdue(item, new Date(), makeDeps());
        expect(item.urgencyTier).toBeNull();
        expect(item.element._classes.has('urgency-urgent')).toBe(false);
        expect(item.element._classes.has('enemy-at-base')).toBe(true);
    });

    test('no-op when the item never had a tier (nothing to clear, no throw)', () => {
        const item = {
            type: 'task', isOverdue: false,
            dueDateTime: new Date(Date.now() - 1000),
            element: fakeEl(), listItemElement: fakeEl(),
        };
        expect(() => Items.markAsOverdue(item, new Date(), makeDeps())).not.toThrow();
        expect(item.urgencyTier).toBeFalsy();
    });
});

describe('Items.recomputeOverdueStateAfterEdit — lurker guard', () => {
    test('a negative habit instance is skipped entirely — its x is left untouched', () => {
        const item = {
            type: 'habit', isNegative: true, isOverdue: false,
            dueDateTime: new Date(Date.now() - 1000), // "shouldBeOverdue" if the guard didn't fire
            x: 999, element: fakeEl(), listItemElement: fakeEl(),
        };
        Items.recomputeOverdueStateAfterEdit(item, makeDeps());
        expect(item.x).toBe(999); // not overwritten by baseWidth + cluster offset
        expect(item.isOverdue).toBe(false);
    });

    test('a positive habit instance is unaffected by the guard (normal recompute applies)', () => {
        const item = {
            type: 'habit', isNegative: false, isOverdue: false, streak: 0,
            dueDateTime: new Date(Date.now() - 1000),
            x: 999, element: fakeEl(), listItemElement: fakeEl(),
        };
        Items.recomputeOverdueStateAfterEdit(item, makeDeps());
        expect(item.isOverdue).toBe(true);
        expect(item.x).toBe(100); // baseWidth + 0 cluster offset, from markAsOverdue's branch
    });

    // [P2-GAME-010] Stage 1, session 60 — the exact live-Chrome repro: an
    // edit pulls a still-future, walking (urgency-tiered) task's due date
    // into the past. This path calls markAsOverdue directly, not through
    // loop.js, so the tier clear must live in markAsOverdue itself.
    test('pulling a walking task\'s due date into the past clears its urgency-tier class too', () => {
        const item = {
            type: 'task', isOverdue: false,
            dueDateTime: new Date(Date.now() - 1000),
            urgencyTier: 'urgent',
            x: 999, element: fakeEl(), listItemElement: fakeEl(),
        };
        item.element._classes.add('urgency-urgent');
        Items.recomputeOverdueStateAfterEdit(item, makeDeps());
        expect(item.isOverdue).toBe(true);
        expect(item.urgencyTier).toBeNull();
        expect(item.element._classes.has('urgency-urgent')).toBe(false);
        expect(item.element._classes.has('enemy-at-base')).toBe(true);
    });
});
