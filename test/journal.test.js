/**
 * Journal core (Journal Build A, 2026-11-13; docs/JOURNAL_PLAN.md). Pure: the saved shape, add / edit / remove, lookups by day /
 * item / run, the mood snapshot, sanitize (never throws, keeps what it can) and merge-by-id (never overwrites).
 */
const Journal = require('../js/journal.js');

const NOW = new Date(2026, 10, 13, 10, 0, 0).getTime();
const task = { kind: 'task', id: 't1', name: 'Write report' };

describe('shape', () => {
    test('a fresh store is v1 with no days', () => {
        expect(Journal.fresh()).toEqual({ v: 1, days: {} });
    });
    test('the allowed words are a contract', () => {
        expect(Journal.ABOUT).toEqual(['item', 'routine', 'day', 'general']);
        expect(Journal.SOURCES).toEqual(['timer', 'mood', 'dayEnd', 'manual', 'complete']);
        expect(Journal.REF_KINDS).toEqual(['task', 'habit', 'routine']);
    });
});

describe('add', () => {
    test('stores a trimmed note under its day with the written-at time and the run', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: '  kept getting interrupted  ', about: 'item', ref: task, src: 'timer', run: 3, min: 45 }, NOW);
        expect(e).toMatchObject({ at: NOW, run: 3, about: 'item', src: 'timer', text: 'kept getting interrupted', min: 45, mood: null });
        expect(e.ref).toEqual({ kind: 'task', id: 't1', name: 'Write report' });
        expect(s.days['2026-11-13']).toHaveLength(1);
        expect(e.id).toBe(`j${NOW}-1`);
    });
    test('empty or whitespace text stores nothing', () => {
        const s = Journal.fresh();
        expect(Journal.add(s, { dayKey: '2026-11-13', text: '   ', about: 'day' }, NOW)).toBeNull();
        expect(Journal.add(s, { dayKey: '2026-11-13', about: 'day' }, NOW)).toBeNull();
        expect(Journal.count(s)).toBe(0);
    });
    test('a bad day key stores nothing', () => {
        const s = Journal.fresh();
        expect(Journal.add(s, { dayKey: 'today', text: 'x', about: 'day' }, NOW)).toBeNull();
        expect(Journal.add(s, { dayKey: '2026-1-3', text: 'x', about: 'day' }, NOW)).toBeNull();
    });
    test('text is clamped to the cap', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: 'a'.repeat(50), about: 'day' }, NOW, 10);
        expect(e.text).toHaveLength(10);
        const d = Journal.add(s, { dayKey: '2026-11-13', text: 'b'.repeat(3000), about: 'day' }, NOW + 1);
        expect(d.text).toHaveLength(Journal.DEFAULT_MAX_CHARS);
    });
    test('an item note with no usable ref falls back to a game note; an unknown source becomes manual', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: 'x', about: 'item', ref: { kind: 'zombie', id: 1 }, src: 'bogus' }, NOW);
        expect(e.about).toBe('general');
        expect(e.ref).toBeNull();
        expect(e.src).toBe('manual');
    });
    test('about is worked out from the ref when it is missing', () => {
        const s = Journal.fresh();
        expect(Journal.add(s, { dayKey: '2026-11-13', text: 'a', ref: task }, NOW).about).toBe('item');
        expect(Journal.add(s, { dayKey: '2026-11-13', text: 'b', ref: { kind: 'routine', id: 'r1', name: 'Morning' } }, NOW + 1).about).toBe('routine');
        expect(Journal.add(s, { dayKey: '2026-11-13', text: 'c' }, NOW + 2).about).toBe('general');
    });
    test('a day / game note never keeps a ref', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: 'x', about: 'day', ref: task }, NOW);
        expect(e.ref).toBeNull();
    });
    test('a sub-task ref keeps its parent id', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: 'x', ref: { kind: 'task', id: 's9', name: 'Outline', parentId: 't1' } }, NOW);
        expect(e.ref.parentId).toBe('t1');
    });
    test('mood snapshot and the optional fields are kept only when valid', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: 'x', about: 'day', src: 'mood', mood: [2, 8, 1], moodHour: 14, late: true }, NOW);
        expect(e.mood).toEqual([2, 8, 1]);
        expect(e.moodHour).toBe(14);
        expect(e.late).toBe(true);
        const f = Journal.add(s, { dayKey: '2026-11-13', text: 'y', about: 'day', mood: [9, 0, 0], moodHour: 30, min: -4 }, NOW + 1);
        expect(f.mood).toBeNull();
        expect('moodHour' in f).toBe(false);
        expect('min' in f).toBe(false);
        expect('late' in f).toBe(false);
    });
    test('ids stay unique when two notes share a millisecond', () => {
        const s = Journal.fresh();
        const a = Journal.add(s, { dayKey: '2026-11-13', text: 'a', about: 'day' }, NOW);
        const b = Journal.add(s, { dayKey: '2026-11-13', text: 'b', about: 'day' }, NOW);
        expect(a.id).not.toBe(b.id);
    });
    test('a day keeps its notes in time order', () => {
        const s = Journal.fresh();
        Journal.add(s, { dayKey: '2026-11-13', text: 'late', about: 'day' }, NOW + 5000);
        Journal.add(s, { dayKey: '2026-11-13', text: 'early', about: 'day' }, NOW);
        expect(s.days['2026-11-13'].map((e) => e.text)).toEqual(['early', 'late']);
    });
});

describe('edit and remove', () => {
    test('edit changes the text and stamps edited; empty or unchanged text changes nothing', () => {
        const s = Journal.fresh();
        const e = Journal.add(s, { dayKey: '2026-11-13', text: 'first', about: 'day' }, NOW);
        expect(Journal.edit(s, e.id, '  second ', NOW + 1000)).toBe(true);
        expect(s.days['2026-11-13'][0]).toMatchObject({ text: 'second', edited: NOW + 1000 });
        expect(Journal.edit(s, e.id, '   ', NOW + 2000)).toBe(false);
        expect(Journal.edit(s, e.id, 'second', NOW + 2000)).toBe(false);
        expect(Journal.edit(s, 'nope', 'x', NOW)).toBe(false);
        expect(s.days['2026-11-13'][0].edited).toBe(NOW + 1000);
    });
    test('remove deletes one note and drops an emptied day', () => {
        const s = Journal.fresh();
        const a = Journal.add(s, { dayKey: '2026-11-13', text: 'a', about: 'day' }, NOW);
        const b = Journal.add(s, { dayKey: '2026-11-13', text: 'b', about: 'day' }, NOW + 1);
        expect(Journal.remove(s, a.id)).toBe(true);
        expect(Journal.countDay(s, '2026-11-13')).toBe(1);
        expect(Journal.remove(s, b.id)).toBe(true);
        expect(s.days).toEqual({});
        expect(Journal.remove(s, b.id)).toBe(false);
    });
});

describe('lookups', () => {
    function filled() {
        const s = Journal.fresh();
        Journal.add(s, { dayKey: '2026-11-12', text: 'old task note', ref: task, run: 2 }, NOW - 86400000);
        Journal.add(s, { dayKey: '2026-11-13', text: 'new task note', ref: task, run: 3 }, NOW);
        Journal.add(s, { dayKey: '2026-11-13', text: 'habit note', ref: { kind: 'habit', id: 't1', name: 'Floss' }, run: 3 }, NOW + 10);
        Journal.add(s, { dayKey: '2026-11-13', text: 'game note', about: 'general', run: 3 }, NOW + 20);
        return s;
    }
    test('forRef matches the kind AND the id, newest first', () => {
        const s = filled();
        expect(Journal.forRef(s, 'task', 't1').map((e) => e.text)).toEqual(['new task note', 'old task note']);
        expect(Journal.forRef(s, 'habit', 't1').map((e) => e.text)).toEqual(['habit note']);
        expect(Journal.forRef(s, 'task', 'zzz')).toEqual([]);
    });
    test('forRef finds a note whose item has since been renamed or deleted (the id is what matters)', () => {
        const s = filled();
        expect(Journal.forRef(s, 'task', 't1')[0].ref.name).toBe('Write report');
    });
    test('forRun, forGame, forDay, count', () => {
        const s = filled();
        expect(Journal.forRun(s, 3).map((e) => e.text)).toEqual(['game note', 'habit note', 'new task note']);
        expect(Journal.forRun(s, 2)).toHaveLength(1);
        expect(Journal.forGame(s).map((e) => e.text)).toEqual(['game note']);
        expect(Journal.forDay(s, '2026-11-13')).toHaveLength(3);
        expect(Journal.forDay(s, '2026-11-13')[0].day).toBe('2026-11-13');
        expect(Journal.forDay(s, '2000-01-01')).toEqual([]);
        expect(Journal.count(s)).toBe(4);
        expect(Journal.countDay(s, '2026-11-12')).toBe(1);
    });
    test('lookups return copies: changing one does not touch the store', () => {
        const s = filled();
        Journal.forDay(s, '2026-11-13')[0].text = 'changed';
        expect(s.days['2026-11-13'][0].text).toBe('new task note');
    });
});

describe('moodSnapshot', () => {
    test('is the latest check-in of the day (highest hour), as [level, feelingBits, contextBits]', () => {
        expect(Journal.moodSnapshot([[9, 4, 32, 1], [15, 2, 4096, 0], [12, 3, 0, 0]])).toEqual([2, 4096, 0]);
    });
    test('no check-in, or junk, is null', () => {
        expect(Journal.moodSnapshot([])).toBeNull();
        expect(Journal.moodSnapshot(null)).toBeNull();
        expect(Journal.moodSnapshot([[9, 0, 0, 0]])).toBeNull();
    });
});

describe('sanitize', () => {
    test('anything that is not a store becomes a fresh one, and it never throws', () => {
        for (const bad of [null, undefined, 5, 'x', [], {}, { days: 3 }, { days: [] }]) {
            expect(Journal.sanitize(bad)).toEqual({ v: 1, days: {} });
        }
    });
    test('drops bad day keys, non-lists, empty-text and non-object entries; keeps the rest', () => {
        const raw = { v: 1, days: {
            'not-a-day': [{ id: 'a', at: 1, text: 'x', about: 'day' }],
            '2026-11-13': [
                { id: 'a', at: 2, text: 'keep me', about: 'day', src: 'manual' },
                { id: 'b', at: 3, text: '   ', about: 'day' },
                'junk', null, 7,
            ],
            '2026-11-14': 'nope',
        } };
        const s = Journal.sanitize(raw);
        expect(Object.keys(s.days)).toEqual(['2026-11-13']);
        expect(s.days['2026-11-13']).toHaveLength(1);
        expect(s.days['2026-11-13'][0].text).toBe('keep me');
    });
    test('an unknown about becomes general, an unknown source becomes manual, an item with no ref becomes general', () => {
        const s = Journal.sanitize({ days: { '2026-11-13': [
            { id: 'a', at: 1, text: 'x', about: 'wat', src: 'wat' },
            { id: 'b', at: 2, text: 'y', about: 'item', src: 'timer' },
            { id: 'c', at: 3, text: 'z', about: 'item', ref: task, src: 'timer' },
        ] } });
        const [a, b, c] = s.days['2026-11-13'];
        expect(a).toMatchObject({ about: 'general', src: 'manual' });
        expect(b).toMatchObject({ about: 'general', ref: null, src: 'timer' });
        expect(c).toMatchObject({ about: 'item', src: 'timer' });
    });
    test('missing or duplicate ids are made unique; text is clamped; unknown extra fields survive', () => {
        const s = Journal.sanitize({ days: { '2026-11-13': [
            { id: 'dup', at: 5, text: 'one', about: 'day' },
            { id: 'dup', at: 5, text: 'two', about: 'day' },
            { at: 5, text: 'three', about: 'day', future: { x: 1 } },
        ] } }, 100);
        const ids = s.days['2026-11-13'].map((e) => e.id);
        expect(new Set(ids).size).toBe(3);
        expect(s.days['2026-11-13'].some((e) => e.future && e.future.x === 1)).toBe(true);
    });
    test('a sanitized store is stable (sanitizing twice changes nothing)', () => {
        const s = Journal.fresh();
        Journal.add(s, { dayKey: '2026-11-13', text: 'a', ref: task, src: 'timer', mood: [3, 0, 0], min: 10 }, NOW);
        Journal.add(s, { dayKey: '2026-11-13', text: 'b', about: 'general' }, NOW + 1);
        expect(Journal.sanitize(Journal.sanitize(s))).toEqual(Journal.sanitize(s));
        expect(Journal.sanitize(s)).toEqual(s);
    });
});

describe('merge', () => {
    test('adds notes the device does not have and never overwrites one with the same id', () => {
        const local = Journal.fresh();
        const a = Journal.add(local, { dayKey: '2026-11-13', text: 'mine', about: 'day' }, NOW);
        const incoming = Journal.sanitize({ days: { '2026-11-13': [
            { id: a.id, at: NOW, text: 'THEIRS (same id)', about: 'day' },
            { id: 'x1', at: NOW + 5, text: 'new one', about: 'day' },
        ], '2026-11-10': [{ id: 'x2', at: NOW - 3 * 86400000, text: 'older day', about: 'general' }] } });
        const out = Journal.merge(local, incoming);
        expect(out.added).toBe(2);
        expect(out.store.days['2026-11-13'].map((e) => e.text)).toEqual(['mine', 'new one']);
        expect(out.store.days['2026-11-10']).toHaveLength(1);
        expect(local.days['2026-11-13']).toHaveLength(1);
    });
    test('merging nothing, or junk, keeps the local store', () => {
        const local = Journal.fresh();
        Journal.add(local, { dayKey: '2026-11-13', text: 'mine', about: 'day' }, NOW);
        expect(Journal.merge(local, null).store).toEqual(local);
        expect(Journal.merge(local, null).added).toBe(0);
        expect(Journal.merge(null, local).store).toEqual(local);
    });
});
