/**
 * Items.useSkipDayOnItem / Items.useSickDayGlobally — frozen-slots
 * sub-session 5 (Sick Day + Skip Day tokens, 2026-07-19). Same global-binding
 * approach as items-cheatday.test.js. Unlike Cheat Day, both functions use
 * the "clear immediately" model (Jeremy's call, 2026-07-19): the targeted
 * instance(s) are removed from the board the moment the token is applied, so
 * there's no separate "excused" predicate or later indulge/complete/rollover
 * branch to test — no occurrence is ever recorded, streak/points/xp are
 * simply never touched because none of those paths run.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
const Items = require('../js/items.js');

function fakeEl() {
    return { style: {}, remove: () => {} };
}

function today() {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
}

function occurrenceDateStr(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function makeDeps(overrides = {}) {
    let sickDayDate = null, saved = 0;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const { activeItems: _a, definedHabits: _d, ...rest } = overrides;
    return {
        activeItems,
        definedHabits: () => definedHabits,
        updateTaskCountDisplay: () => {},
        saveGame: () => { saved++; },
        setSickDayDate: (d) => { sickDayDate = d; },
        ...rest,
        getSickDayDate: () => sickDayDate,
        getSaved: () => saved,
    };
}

describe('Items.useSkipDayOnItem', () => {
    test('sets skipDayDate to the item\'s occurrence date and removes it from activeItems', () => {
        const d = today();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false,
            originalDueDate: d, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: false, streak: 5, occurrenceHistory: [],
            skipDayDate: null };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.useSkipDayOnItem(item, deps);

        expect(habitDef.skipDayDate).toBe(occurrenceDateStr(d));
        expect(deps.activeItems.length).toBe(0);
        expect(habitDef.streak).toBe(5); // untouched — excused, not completed or missed
        expect(habitDef.occurrenceHistory.length).toBe(0); // no occurrence recorded
        expect(deps.getSaved()).toBeGreaterThan(0);
    });

    test('works for a POSITIVE habit instance (Skip Day is not negative-only, unlike Cheat Day)', () => {
        const d = today();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: false,
            originalDueDate: d, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: false, occurrenceHistory: [], skipDayDate: null };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        expect(() => Items.useSkipDayOnItem(item, deps)).not.toThrow();
        expect(habitDef.skipDayDate).toBe(occurrenceDateStr(d));
    });

    test('no-ops safely (still removes) if the habitDef cannot be found', () => {
        const item = { id: 1, type: 'habit', definitionId: 'missing', isNegative: false,
            originalDueDate: today(), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [] });

        expect(() => Items.useSkipDayOnItem(item, deps)).not.toThrow();
        expect(deps.activeItems.length).toBe(0);
    });
});

describe('Items.useSickDayGlobally', () => {
    test('sets the global sickDayDate via deps.setSickDayDate', () => {
        const d = today();
        const deps = makeDeps();

        Items.useSickDayGlobally(d, deps);

        expect(deps.getSickDayDate()).toBe(occurrenceDateStr(d));
    });

    test('removes every active HABIT instance matching the target date, positive and negative alike', () => {
        const d = today();
        const habitToday1 = { id: 1, type: 'habit', definitionId: 'h1', isNegative: false, originalDueDate: d, element: fakeEl() };
        const habitToday2 = { id: 2, type: 'habit', definitionId: 'h2', isNegative: true, originalDueDate: d, element: fakeEl() };
        const deps = makeDeps({ activeItems: [habitToday1, habitToday2], definedHabits: [] });

        Items.useSickDayGlobally(d, deps);

        expect(deps.activeItems.length).toBe(0);
    });

    test('leaves routine TASKS untouched (Sick Day is habits-only, fork 4)', () => {
        const d = today();
        const habitToday = { id: 1, type: 'habit', definitionId: 'h1', isNegative: false, originalDueDate: d, element: fakeEl() };
        const taskToday = { id: 2, type: 'task', definitionId: 't1', originalDueDate: d, element: fakeEl() };
        const deps = makeDeps({ activeItems: [habitToday, taskToday], definedHabits: [] });

        Items.useSickDayGlobally(d, deps);

        expect(deps.activeItems).toEqual([taskToday]);
    });

    test('leaves habit instances from a DIFFERENT day untouched', () => {
        const d = today();
        const yesterday = new Date(d);
        yesterday.setDate(yesterday.getDate() - 1);
        const habitToday = { id: 1, type: 'habit', definitionId: 'h1', isNegative: false, originalDueDate: d, element: fakeEl() };
        const habitYesterday = { id: 2, type: 'habit', definitionId: 'h2', isNegative: false, originalDueDate: yesterday, element: fakeEl() };
        const deps = makeDeps({ activeItems: [habitToday, habitYesterday], definedHabits: [] });

        Items.useSickDayGlobally(d, deps);

        expect(deps.activeItems).toEqual([habitYesterday]);
    });

    test('a no-op sweep (no matching active habits) still sets sickDayDate without throwing', () => {
        const d = today();
        const deps = makeDeps({ activeItems: [], definedHabits: [] });

        expect(() => Items.useSickDayGlobally(d, deps)).not.toThrow();
        expect(deps.getSickDayDate()).toBe(occurrenceDateStr(d));
    });
});
