/**
 * Items.isCheatDayExcused / Items.settleExcusedCheatDay / the excused-
 * indulgence branches in indulgeHabit + resolvePendingCheckIn — sub-session 5
 * ([P1-DATA-005], Cheat Day token, 2026-07-19). Same global-binding approach
 * as items-checkin/items-rollover/items-indulge tests.
 */
global.Schedule = require('../js/schedule.js');
global.Habits = require('../js/habits.js');
global.Economy = require('../js/economy.js');
global.CONFIG = require('../js/config.js');
global.Heroes = require('../js/heroes.js');
const Items = require('../js/items.js');

function fakeEl() {
    return { style: {}, remove: () => {} };
}

function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
}

function occurrenceDateStr(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function makeDeps(overrides = {}) {
    let xp = 0, points = 0, leveled = 0, saved = 0;
    const activeItems = overrides.activeItems || [];
    const definedHabits = overrides.definedHabits || [];
    const { activeItems: _a, definedHabits: _d, ...rest } = overrides;
    return {
        isGameOver: () => false,
        activeItems,
        definedHabits: () => definedHabits,
        xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE,
        pointsPerHabit: CONFIG.POINTS_PER_HABIT,
        getPlayerXP: () => xp,
        setPlayerXP: (n) => { xp = n; },
        getPlayerPoints: () => points,
        setPlayerPoints: (n) => { points = n; },
        updatePlayerDisplays: () => {},
        checkPlayerLevelUp: () => { leveled++; },
        updateTaskCountDisplay: () => {},
        saveGame: () => { saved++; },
        ...rest,
        getXP: () => xp,
        getPoints: () => points,
        getLeveled: () => leveled,
        getSaved: () => saved,
    };
}

describe('Items.isCheatDayExcused', () => {
    test('true when cheatDayDate matches the occurrence date', () => {
        const d = yesterday();
        const habitDef = { cheatDayDate: occurrenceDateStr(d) };
        expect(Items.isCheatDayExcused(habitDef, d)).toBe(true);
    });

    test('false when cheatDayDate is for a different day', () => {
        const habitDef = { cheatDayDate: '2020-01-01' };
        expect(Items.isCheatDayExcused(habitDef, yesterday())).toBe(false);
    });

    test('false when no cheatDayDate is set (null/undefined)', () => {
        expect(Items.isCheatDayExcused({ cheatDayDate: null }, yesterday())).toBe(false);
        expect(Items.isCheatDayExcused({}, yesterday())).toBe(false);
    });
});

describe('Items.settleExcusedCheatDay', () => {
    test('clears the cheatDayDate marker and removes the item, no points/xp/streak change', () => {
        const y = yesterday();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: y, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 3, occurrenceHistory: [],
            cheatDayDate: occurrenceDateStr(y) };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.settleExcusedCheatDay(item, deps);

        expect(habitDef.cheatDayDate).toBeNull();
        expect(deps.activeItems.length).toBe(0);
        expect(deps.getPoints()).toBe(0);
        expect(deps.getXP()).toBe(0);
        expect(habitDef.streak).toBe(3); // untouched — excused, not avoided or missed
        expect(habitDef.occurrenceHistory.length).toBe(0); // no occurrence recorded
    });

    test('no-ops safely (still removes) if the habitDef cannot be found', () => {
        const item = { id: 1, type: 'habit', definitionId: 'missing', isNegative: true,
            originalDueDate: yesterday(), element: fakeEl() };
        const deps = makeDeps({ activeItems: [item], definedHabits: [] });

        expect(() => Items.settleExcusedCheatDay(item, deps)).not.toThrow();
        expect(deps.activeItems.length).toBe(0);
    });
});

describe('Items.indulgeHabit — Cheat Day excused path', () => {
    test('active cheat day for this lurker: no debit, streak/occurrenceHistory untouched, marker KEPT', () => {
        const y = yesterday();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: y, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 4, occurrenceHistory: [],
            cheatDayDate: occurrenceDateStr(y) };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });
        deps.setPlayerPoints(50);

        Items.indulgeHabit(1, deps);

        expect(deps.getPoints()).toBe(50); // no debit
        expect(habitDef.streak).toBe(4);   // untouched (not zeroed, unlike a normal indulge)
        expect(habitDef.occurrenceHistory.length).toBe(0); // no occurrence recorded
        // Session 57 (was: toBeNull, "one use per token"): the marker now
        // survives the live excused indulge — with no occurrence recorded, it
        // is the ONLY state telling the spawn dedupe the day is resolved;
        // nulling it here let a same-day reload respawn the lurker with its
        // cheat cover gone. It self-expires next calendar day (date-scoped);
        // rollover/check-in still clear it.
        expect(habitDef.cheatDayDate).toBe(occurrenceDateStr(y));
    });

    test('excused indulge + same-day respawn attempt: the kept marker blocks selectHabitDefsToSpawn (session-57 regression)', () => {
        const y = yesterday();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: y, element: fakeEl() };
        const habitDef = { id: 'd1', name: 'Lurker', category: 'other', frequency: 'daily',
            timeOfDay: 'anytime', isNegative: true, streak: 4, occurrenceHistory: [],
            routineId: null, cheatDayDate: occurrenceDateStr(y) };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });

        Items.indulgeHabit(1, deps);
        deps.activeItems.length = 0; // removeItem is setTimeout-deferred; simulate the post-removal state a same-day reload sees

        // The end-to-end assertion: with no occurrence and no instance, the
        // KEPT marker is what stops a fresh same-day spawn.
        global.FrozenSlots = global.FrozenSlots || require('../js/frozenSlots.js');
        const toSpawn = Habits.selectHabitDefsToSpawn([habitDef], [], [], y);
        expect(toSpawn).toHaveLength(0);
    });

    test('no active cheat day: falls through to the normal debit/streak-zero path unchanged', () => {
        const y = yesterday();
        const item = { id: 1, type: 'habit', definitionId: 'd1', isNegative: true,
            originalDueDate: y, element: fakeEl() };
        const habitDef = { id: 'd1', isNegative: true, streak: 4, occurrenceHistory: [], cheatDayDate: null };
        const deps = makeDeps({ activeItems: [item], definedHabits: [habitDef] });
        deps.setPlayerPoints(50);

        Items.indulgeHabit(1, deps);

        expect(deps.getPoints()).toBeLessThan(50);
        expect(habitDef.streak).toBe(0);
        expect(habitDef.occurrenceHistory.length).toBe(1);
        expect(habitDef.occurrenceHistory[0].success).toBe(false);
    });
});

describe('Items.resolvePendingCheckIn — Cheat Day excused path (defensive)', () => {
    test("'indulged' with an active cheat day for the pending day: no debit, streak untouched, both markers cleared", () => {
        const y = yesterday();
        const habitDef = { id: 'd1', isNegative: true, streak: 2, occurrenceHistory: [],
            pendingCheckIn: { originalDueDate: y }, cheatDayDate: occurrenceDateStr(y) };
        const deps = makeDeps({ definedHabits: [habitDef] });
        deps.setPlayerPoints(20);

        Items.resolvePendingCheckIn('d1', 'indulged', deps);

        expect(deps.getPoints()).toBe(20);
        expect(habitDef.streak).toBe(2);
        expect(habitDef.occurrenceHistory.length).toBe(0);
        expect(habitDef.cheatDayDate).toBeNull();
        expect(habitDef.pendingCheckIn).toBeUndefined();
    });
});
