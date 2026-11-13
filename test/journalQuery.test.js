/**
 * Journal Build B (2026-11-13; docs/JOURNAL_PLAN.md): the pure read helpers behind the Journal window: latest, filter, groupByDay.
 */
const Journal = require('../js/journal.js');

function sample() {
    const s = Journal.fresh();
    const add = (dayKey, at, extra) => Journal.add(s, Object.assign({ dayKey, text: `n${at}`, about: 'day', run: 1 }, extra), at);
    add('2026-11-10', 1000, { about: 'item', ref: { kind: 'task', id: 'item:7', name: 'Write report' }, src: 'timer' });
    add('2026-11-10', 2000, { about: 'general' });
    add('2026-11-11', 3000, { about: 'item', ref: { kind: 'habit', id: 'def:3', name: 'Stretch' }, run: 2 });
    add('2026-11-11', 4000, { about: 'day', src: 'dayEnd', run: 2 });
    add('2026-11-12', 5000, { about: 'item', ref: { kind: 'task', id: 'item:7', name: 'Write report' }, run: 2 });
    return s;
}

describe('latest', () => {
    test('the newest note by write time, or null for an empty store', () => {
        expect(Journal.latest(sample()).text).toBe('n5000');
        expect(Journal.latest(Journal.fresh())).toBeNull();
        expect(Journal.latest(null)).toBeNull();
    });
});

describe('filter', () => {
    test('all (and an unknown kind) = everything, newest first', () => {
        expect(Journal.filter(sample(), { kind: 'all' }).map((e) => e.at)).toEqual([5000, 4000, 3000, 2000, 1000]);
        expect(Journal.filter(sample(), { kind: 'nonsense' })).toHaveLength(5);
        expect(Journal.filter(sample())).toHaveLength(5);
    });
    test('days = notes about a day; game = notes about the game', () => {
        expect(Journal.filter(sample(), { kind: 'days' }).map((e) => e.at)).toEqual([4000]);
        expect(Journal.filter(sample(), { kind: 'game' }).map((e) => e.at)).toEqual([2000]);
    });
    test('ref matches kind + id (ids are compared as text); the same id under another kind does not match', () => {
        expect(Journal.filter(sample(), { kind: 'ref', ref: { kind: 'task', id: 'item:7' } }).map((e) => e.at)).toEqual([5000, 1000]);
        expect(Journal.filter(sample(), { kind: 'ref', ref: { kind: 'habit', id: 'item:7' } })).toEqual([]);
    });
    test('run keeps one run\'s notes', () => {
        expect(Journal.filter(sample(), { kind: 'run', run: 2 }).map((e) => e.at)).toEqual([5000, 4000, 3000]);
        expect(Journal.filter(sample(), { kind: 'run', run: 9 })).toEqual([]);
    });
    test('does not change the store', () => {
        const s = sample();
        const before = JSON.stringify(s);
        Journal.filter(s, { kind: 'days' });
        expect(JSON.stringify(s)).toBe(before);
    });
});

describe('groupByDay', () => {
    test('newest day first, entries oldest-first inside a day', () => {
        const groups = Journal.groupByDay(Journal.filter(sample(), { kind: 'all' }));
        expect(groups.map((g) => g.day)).toEqual(['2026-11-12', '2026-11-11', '2026-11-10']);
        expect(groups[1].entries.map((e) => e.at)).toEqual([3000, 4000]);
    });
    test('ignores junk and an empty list', () => {
        expect(Journal.groupByDay([])).toEqual([]);
        expect(Journal.groupByDay(null)).toEqual([]);
        expect(Journal.groupByDay([null, { at: 1 }])).toEqual([]);
    });
});
