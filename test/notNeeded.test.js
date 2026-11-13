/**
 * NotNeeded (js/notNeeded.js) -- the pure rules for the "Not needed" passes (2026-11-13, Jeremy + Opus 5.5;
 * DECISIONS 2026-11-13 (Delete Task and Not needed today: design)): the weekly pass count, and what Delete / Not needed today
 * would do to each kind of item.
 */
const NotNeeded = require('../js/notNeeded.js');

// 2026-11-11 is a Wednesday. Local times throughout, like the code under test.
const WED = new Date(2026, 10, 11, 15, 0, 0).getTime();
const MON_START = new Date(2026, 10, 9, 0, 0, 0).getTime();
const NEXT_MON = new Date(2026, 10, 16, 0, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;

describe('the calendar week', () => {
    test('weekStartMs: a Wednesday belongs to the week that started on Monday 00:00', () => {
        expect(NotNeeded.weekStartMs(WED, 1)).toBe(MON_START);
    });
    test('weekStartMs: Monday itself starts its own week; Sunday night still belongs to the old one', () => {
        expect(NotNeeded.weekStartMs(MON_START, 1)).toBe(MON_START);
        expect(NotNeeded.weekStartMs(NEXT_MON - 1000, 1)).toBe(MON_START);
        expect(NotNeeded.weekStartMs(NEXT_MON, 1)).toBe(NEXT_MON);
    });
    test('weekStartMs honours another first day of the week (Sunday = 0)', () => {
        expect(NotNeeded.weekStartMs(WED, 0)).toBe(new Date(2026, 10, 8, 0, 0, 0).getTime());
    });
    test('weekStartMs: junk weekStartsOn falls back to Monday', () => {
        expect(NotNeeded.weekStartMs(WED, 'x')).toBe(MON_START);
        expect(NotNeeded.weekStartMs(WED, 9)).toBe(MON_START);
    });
    test('nextResetMs is the next Monday 00:00', () => {
        expect(NotNeeded.nextResetMs(WED, 1)).toBe(NEXT_MON);
    });
});

describe('passes used and left', () => {
    test('only stamps from the current week count', () => {
        const uses = [MON_START - HOUR, MON_START, WED - HOUR, NEXT_MON];
        expect(NotNeeded.usedThisWeek(uses, WED, 1)).toBe(2);
    });
    test('passesLeft = cap - used, never below 0', () => {
        expect(NotNeeded.passesLeft([], WED, 3, 1)).toBe(3);
        expect(NotNeeded.passesLeft([WED - HOUR], WED, 3, 1)).toBe(2);
        expect(NotNeeded.passesLeft([WED - 3 * HOUR, WED - 2 * HOUR, WED - HOUR, WED - 1], WED, 3, 1)).toBe(0);
    });
    test('a missing / junk cap uses the default of 3', () => {
        expect(NotNeeded.passesLeft([], WED, undefined, 1)).toBe(NotNeeded.DEFAULT_CAP);
        expect(NotNeeded.passesLeft([], WED, 'x', 1)).toBe(NotNeeded.DEFAULT_CAP);
    });
    test('the passes come back when the new week starts', () => {
        const spent = [WED - 3 * HOUR, WED - 2 * HOUR, WED - HOUR];
        expect(NotNeeded.passesLeft(spent, WED, 3, 1)).toBe(0);
        expect(NotNeeded.passesLeft(spent, NEXT_MON, 3, 1)).toBe(3);
    });
    test('junk in the list is ignored', () => {
        expect(NotNeeded.sanitizeUses([1, 'x', NaN, null, 4])).toEqual([1, 4]);
        expect(NotNeeded.sanitizeUses('nope')).toEqual([]);
        expect(NotNeeded.passesLeft(['x', null], WED, 3, 1)).toBe(3);
    });
    test('addUse stamps now, drops earlier weeks and never mutates its input', () => {
        const before = [MON_START - HOUR, MON_START + HOUR];
        const out = NotNeeded.addUse(before, WED, 1);
        expect(out).toEqual([MON_START + HOUR, WED]);
        expect(before).toEqual([MON_START - HOUR, MON_START + HOUR]);
    });
});

describe('kindOf', () => {
    test('sorts items into the five kinds the rules care about', () => {
        expect(NotNeeded.kindOf({ type: 'task' })).toBe('one-off');
        expect(NotNeeded.kindOf({ type: 'task', parentId: 4 })).toBe('sub-task');
        expect(NotNeeded.kindOf({ type: 'task', definitionId: 'd1' })).toBe('routine-task');
        expect(NotNeeded.kindOf({ type: 'habit', isNegative: false })).toBe('habit');
        expect(NotNeeded.kindOf({ type: 'habit', isNegative: true })).toBe('negative-habit');
        expect(NotNeeded.kindOf(null)).toBe('other');
        expect(NotNeeded.kindOf({ type: 'goal' })).toBe('other');
    });
    test('a routine task with definitionId 0 is still a routine task', () => {
        expect(NotNeeded.kindOf({ type: 'task', definitionId: 0 })).toBe('routine-task');
    });
});

describe('isDue', () => {
    test('overdue flag, or a due time that has arrived', () => {
        expect(NotNeeded.isDue({ isOverdue: true, dueDateTime: new Date(WED + HOUR) }, WED)).toBe(true);
        expect(NotNeeded.isDue({ dueDateTime: new Date(WED - 1) }, WED)).toBe(true);
        expect(NotNeeded.isDue({ dueDateTime: new Date(WED) }, WED)).toBe(true);
        expect(NotNeeded.isDue({ dueDateTime: new Date(WED + 1) }, WED)).toBe(false);
        expect(NotNeeded.isDue(null, WED)).toBe(false);
    });
});

describe('plan: delete', () => {
    const base = { nowMs: WED, uses: [], cap: 3, weekStartsOn: 1 };
    const future = new Date(WED + 5 * HOUR);
    const past = new Date(WED - HOUR);

    test('a one-off task that is not due yet: free, no pass used', () => {
        const p = NotNeeded.plan({ ...base, action: 'delete', item: { type: 'task', dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, kind: 'one-off', effect: 'delete', usesPass: false, left: 3 });
    });
    test('an overdue one-off task: uses a pass', () => {
        const p = NotNeeded.plan({ ...base, action: 'delete', item: { type: 'task', dueDateTime: past, isOverdue: true } });
        expect(p).toMatchObject({ ok: true, effect: 'delete', usesPass: true, left: 2 });
    });
    test('overdue with no pass left: refused, the count is reported', () => {
        const uses = [WED - 3 * HOUR, WED - 2 * HOUR, WED - HOUR];
        const p = NotNeeded.plan({ ...base, uses, action: 'delete', item: { type: 'task', dueDateTime: past, isOverdue: true } });
        expect(p).toMatchObject({ ok: false, reason: 'no-passes', usesPass: false, left: 0 });
    });
    test('a task that is not due is free even with no pass left', () => {
        const uses = [WED - 3 * HOUR, WED - 2 * HOUR, WED - HOUR];
        const p = NotNeeded.plan({ ...base, uses, action: 'delete', item: { type: 'task', dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, usesPass: false, left: 0 });
    });
    test('attacking = true (a sub-task under it is overdue) makes a not-yet-due parent cost a pass', () => {
        const p = NotNeeded.plan({ ...base, action: 'delete', attacking: true, item: { type: 'task', dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, usesPass: true, left: 2 });
    });
    test('a sub-task can be deleted', () => {
        const p = NotNeeded.plan({ ...base, action: 'delete', item: { type: 'task', parentId: 1, dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, kind: 'sub-task', usesPass: false });
    });
    test('habits and routine tasks are not deleted here (Delete Habit / the routine window)', () => {
        ['habit', 'routine-task', 'negative-habit'].forEach((k) => {
            const item = k === 'routine-task' ? { type: 'task', definitionId: 'd', dueDateTime: future }
                : { type: 'habit', isNegative: k === 'negative-habit', dueDateTime: future };
            expect(NotNeeded.plan({ ...base, action: 'delete', item })).toMatchObject({ ok: false, reason: 'not-deletable' });
        });
    });
    test('a KO ghost, a missing item and a game-over board are refused', () => {
        expect(NotNeeded.plan({ ...base, action: 'delete', item: { type: 'task', koGhost: true, dueDateTime: future } }).reason).toBe('ko');
        expect(NotNeeded.plan({ ...base, action: 'delete', item: null }).reason).toBe('unavailable');
        expect(NotNeeded.plan({ ...base, action: 'delete', gameOver: true, item: { type: 'task', dueDateTime: future } }).reason).toBe('unavailable');
    });
    test('an unknown action is refused', () => {
        expect(NotNeeded.plan({ ...base, action: 'nope', item: { type: 'task', dueDateTime: future } }).ok).toBe(false);
    });
});

describe('plan: Not needed today', () => {
    const base = { nowMs: WED, uses: [], cap: 3, weekStartsOn: 1, action: 'notNeeded' };
    const future = new Date(WED + 5 * HOUR);
    const past = new Date(WED - HOUR);

    test('a Build habit before it is due: skip-day, uses a pass', () => {
        const p = NotNeeded.plan({ ...base, item: { type: 'habit', isNegative: false, dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, kind: 'habit', effect: 'skip-day', usesPass: true, left: 2 });
    });
    test('a routine task before it is due: skip-day, uses a pass', () => {
        const p = NotNeeded.plan({ ...base, item: { type: 'task', definitionId: 'd1', dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, kind: 'routine-task', effect: 'skip-day', usesPass: true });
    });
    test('a one-off task before it is due: moves to tomorrow, uses a pass', () => {
        const p = NotNeeded.plan({ ...base, item: { type: 'task', dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, kind: 'one-off', effect: 'move-tomorrow', usesPass: true, left: 2 });
    });
    test('once it is due (or overdue) it is refused: that is Skip Day / Sick Day / pushback territory', () => {
        expect(NotNeeded.plan({ ...base, item: { type: 'habit', dueDateTime: past } }).reason).toBe('due');
        expect(NotNeeded.plan({ ...base, item: { type: 'task', dueDateTime: future, isOverdue: true } }).reason).toBe('due');
        expect(NotNeeded.plan({ ...base, item: { type: 'task', definitionId: 'd', dueDateTime: past } }).reason).toBe('due');
    });
    test('a Break habit is not offered it (its excuse is Cheat Day)', () => {
        expect(NotNeeded.plan({ ...base, item: { type: 'habit', isNegative: true, dueDateTime: future } }).reason).toBe('not-available');
    });
    test('a sub-task is not offered it (it can only be deleted)', () => {
        expect(NotNeeded.plan({ ...base, item: { type: 'task', parentId: 3, dueDateTime: future } }).reason).toBe('not-available');
    });
    test('a one-off task that already moved once is refused', () => {
        const p = NotNeeded.plan({ ...base, item: { type: 'task', notNeededMoved: true, dueDateTime: future } });
        expect(p).toMatchObject({ ok: false, reason: 'already-moved' });
    });
    test('the moved-once flag does not matter for habits and routine tasks', () => {
        const p = NotNeeded.plan({ ...base, item: { type: 'task', definitionId: 'd', notNeededMoved: true, dueDateTime: future } });
        expect(p.ok).toBe(true);
    });
    test('no pass left: refused', () => {
        const uses = [WED - 3 * HOUR, WED - 2 * HOUR, WED - HOUR];
        const p = NotNeeded.plan({ ...base, uses, item: { type: 'habit', dueDateTime: future } });
        expect(p).toMatchObject({ ok: false, reason: 'no-passes', left: 0 });
    });
    test('the last pass can be used, and leaves 0', () => {
        const uses = [WED - 2 * HOUR, WED - HOUR];
        const p = NotNeeded.plan({ ...base, uses, item: { type: 'habit', dueDateTime: future } });
        expect(p).toMatchObject({ ok: true, left: 0 });
    });
});
