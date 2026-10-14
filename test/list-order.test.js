/**
 * ListOrder tests (2026-10-13) -- chained 30-min tie groups, manual order via
 * slot-time ranks, implicit rank clearing on due-time change, the "slot in only
 * when it clearly fits" rule, and the canvas z band.
 */
global.CONFIG = require('../js/config.js');
const ListOrder = require('../js/listOrder.js');

const T0 = new Date('2026-10-13T09:00:00').getTime();
const at = (min) => new Date(T0 + min * 60000);
let nextId = 1;
const mk = (min, extra) => Object.assign({ id: nextId++, type: 'task', dueDateTime: at(min), parentId: null }, extra);
const ids = (layout) => layout.rows.map(i => i.id);

beforeEach(() => { nextId = 1; });

describe('tie groups', () => {
    test('chained: 9:00 / 9:25 / 9:50 is one group; a 31-min gap splits', () => {
        const items = [mk(0), mk(25), mk(50), mk(81)];
        const L = ListOrder.compute(items);
        expect(L.groups.map(g => g.length)).toEqual([3, 1]);
    });
    test('exactly 30 min apart joins; unranked groups are plain due order', () => {
        const a = mk(30), b = mk(0);
        const L = ListOrder.compute([a, b]);
        expect(L.groups.length).toBe(1);
        expect(ids(L)).toEqual([b.id, a.id]);
        expect(L.manual).toEqual([false]);
    });
    test('sub-tasks are not rows', () => {
        const p = mk(0), s = mk(5, { parentId: p.id });
        expect(ids(ListOrder.compute([p, s]))).toEqual([p.id]);
    });
});

describe('move / canMove / ranks', () => {
    test('canMove only inside a group', () => {
        const a = mk(0), b = mk(10), c = mk(120);
        const L = ListOrder.compute([a, b, c]);
        expect(ListOrder.canMove(L, a.id, -1)).toBe(false);
        expect(ListOrder.canMove(L, a.id, 1)).toBe(true);
        expect(ListOrder.canMove(L, b.id, 1)).toBe(false);   // c is a different group
        expect(ListOrder.canMove(L, c.id, -1)).toBe(false);
    });
    test('move swaps with the neighbor and persists via listRank', () => {
        const a = mk(0), b = mk(10), c = mk(20);
        expect(ListOrder.move([a, b, c], b.id, -1)).toBe(true);
        expect(ids(ListOrder.compute([a, b, c]))).toEqual([b.id, a.id, c.id]);
        expect(ListOrder.move([a, b, c], a.id, 1)).toBe(true);
        expect(ids(ListOrder.compute([a, b, c]))).toEqual([b.id, c.id, a.id]);
    });
    test('move refuses past a group edge', () => {
        const a = mk(0), b = mk(10), c = mk(120);
        expect(ListOrder.move([a, b, c], b.id, 1)).toBe(false);
        expect(a.listRank).toBeUndefined();
    });
    test('equal due times can still be swapped', () => {
        const a = mk(0), b = mk(0);
        ListOrder.move([a, b], b.id, -1);
        expect(ids(ListOrder.compute([a, b]))).toEqual([b.id, a.id]);
    });
    test('changing a due time clears the rank implicitly', () => {
        const a = mk(0), b = mk(10);
        ListOrder.move([a, b], b.id, -1);                  // b, a
        b.dueDateTime = at(15);                            // b edited
        const L = ListOrder.compute([a, b]);
        expect(ListOrder.hasValidRank(b)).toBe(false);
        expect(ids(L)).toEqual([a.id, b.id]);              // slots by due: only a ranked -> b fits below a
    });
    test('ranks survive a JSON round trip (dates revived)', () => {
        const a = mk(0), b = mk(10);
        ListOrder.move([a, b], b.id, -1);
        const back = JSON.parse(JSON.stringify([a, b])).map(i => Object.assign(i, { dueDateTime: new Date(i.dueDateTime) }));
        expect(ids(ListOrder.compute(back))).toEqual([b.id, a.id]);
    });
});

describe('new task joining a hand-ordered group', () => {
    function reordered() {            // A 9:00, C 9:40, B 9:20 shown as A, C, B
        const A = mk(0), B = mk(20), C = mk(40);
        ListOrder.move([A, B, C], C.id, -1);               // A, C, B
        return { A, B, C };
    }
    test('slots in by due time when it clearly fits (9:10 lands under A)', () => {
        const { A, B, C } = reordered();
        const N = mk(10);
        const L = ListOrder.compute([A, B, C, N]);
        expect(ids(L)).toEqual([A.id, N.id, C.id, B.id]);
    });
    test('goes to the bottom when no spot agrees (9:30)', () => {
        const { A, B, C } = reordered();
        const N = mk(30);
        expect(ids(ListOrder.compute([A, B, C, N]))).toEqual([A.id, C.id, B.id, N.id]);
    });
    test('before everything -> top', () => {
        const { A, B, C } = reordered();
        const N = mk(-5);
        expect(ids(ListOrder.compute([A, B, C, N]))[0]).toBe(N.id);
    });
    test('stampManualGroups makes the slotted order stick', () => {
        const { A, B, C } = reordered();
        const N = mk(30);
        const items = [A, B, C, N];
        ListOrder.stampManualGroups(ListOrder.compute(items));
        N.dueDateTime = at(30);                            // unchanged
        const again = ids(ListOrder.compute(items));
        expect(again).toEqual([A.id, C.id, B.id, N.id]);
        // a later task at 9:05 must not displace N from the bottom
        const M = mk(5);
        const L = ListOrder.compute(items.concat(M));
        expect(ids(L).indexOf(N.id)).toBe(ids(L).length - 1);
    });
    test('a fully ranked group is NOT re-stamped (incremental restore keeps saved ranks)', () => {
        const a = mk(0), b = mk(10), c = mk(20);
        ListOrder.move([a, b, c], c.id, -1);            // a, c, b
        const saved = JSON.parse(JSON.stringify([a, b, c]))
            .map(i => Object.assign(i, { dueDateTime: new Date(i.dueDateTime) }));
        const loaded = [];
        saved.forEach(it => {                           // restore: add one at a time + render
            loaded.push(it);
            ListOrder.stampManualGroups(ListOrder.compute(loaded));
        });
        expect(saved.map(i => i.listRank)).toEqual([a, b, c].map(i => i.listRank));
        expect(ids(ListOrder.compute(loaded))).toEqual([a.id, c.id, b.id]);
    });
    test('groups that were reordered separately keep their own order when merged', () => {
        const a1 = mk(0), a2 = mk(10), b1 = mk(50), b2 = mk(60);   // two groups (gap 40)
        ListOrder.move([a1, a2, b1, b2], a2.id, -1);               // a2, a1
        ListOrder.move([a1, a2, b1, b2], b2.id, -1);               // b2, b1
        const bridge = mk(30);                                      // 9:30 joins them
        const L = ListOrder.compute([a1, a2, b1, b2, bridge]);
        expect(L.groups.length).toBe(1);
        const order = ids(L);
        expect(order.indexOf(a2.id)).toBeLessThan(order.indexOf(a1.id));
        expect(order.indexOf(b2.id)).toBeLessThan(order.indexOf(b1.id));
        expect(order.indexOf(a1.id)).toBeLessThan(order.indexOf(b2.id));
    });
});

describe('z band and sort keys', () => {
    test('top row gets LIST_Z_MAX, 2 less per row, sub one behind its parent', () => {
        const a = mk(0), b = mk(200), s = mk(210, { parentId: b.id });
        const items = [a, b, s];
        const z = ListOrder.zIndexes(ListOrder.compute(items), items);
        expect(z.get(a.id)).toBe(CONFIG.LIST_Z_MAX);
        expect(z.get(b.id)).toBe(CONFIG.LIST_Z_MAX - 2);
        expect(z.get(s.id)).toBe(CONFIG.LIST_Z_MAX - 3);
    });
    test('z never drops below LIST_Z_MIN', () => {
        const items = Array.from({ length: 40 }, (_, i) => mk(i * 100));
        const z = ListOrder.zIndexes(ListOrder.compute(items), items);
        expect(Math.min(...z.values())).toBe(CONFIG.LIST_Z_MIN);
    });
    test('lanes: front lane over middle over back whatever the row; list order inside a lane (2026-10-13)', () => {
        const items = [mk(0), mk(100), mk(200), mk(300)];            // rows 0-3
        const lanes = new Map([[items[0].id, 0], [items[1].id, 1], [items[2].id, 2], [items[3].id, 2]]);
        const z = ListOrder.zIndexes(ListOrder.compute(items), items, { lanes });
        const zs = items.map(i => z.get(i.id));
        expect(zs[2]).toBeGreaterThan(zs[1]);   // front lane (row 2) over middle lane (row 1)
        expect(zs[3]).toBeGreaterThan(zs[0]);   // front lane (row 3) over back lane (row 0), though row 0 is higher in the list
        expect(zs[1]).toBeGreaterThan(zs[0]);
        expect(zs[2]).toBeGreaterThan(zs[3]);   // same lane: the higher row wins
        expect(Math.min(...zs)).toBeGreaterThanOrEqual(CONFIG.LIST_Z_MIN);
        expect(Math.max(...zs)).toBeLessThanOrEqual(CONFIG.LIST_Z_MAX);
    });
    test('lanes: no-lane item (parked lurker) sinks behind everything; a sub on its own lane is layered by it', () => {
        const a = mk(0), b = mk(100), lurker = mk(200), s = mk(210, { parentId: a.id }), s2 = mk(220, { parentId: a.id });
        const items = [a, b, lurker, s, s2];
        const lanes = new Map([[a.id, 2], [b.id, 0], [lurker.id, null], [s.id, 2], [s2.id, 1]]);
        const z = ListOrder.zIndexes(ListOrder.compute(items), items, { lanes });
        expect(z.get(lurker.id)).toBeLessThan(z.get(b.id));
        expect(z.get(s.id)).toBe(z.get(a.id) - 1);                    // same lane as parent: one behind it
        expect(z.get(s2.id)).toBeGreaterThan(z.get(b.id));             // middle lane: over the back lane...
        expect(z.get(s2.id)).toBeLessThan(z.get(a.id));                // ...under the front lane
    });
    test('applyZ reads data-lane when no lanes are passed', () => {
        const a = mk(0), b = mk(100);
        [a, b].forEach(i => {
            const store = {};
            i.store = store;
            i.element = { dataset: {}, style: { getPropertyValue: k => store[k] || '', setProperty: (k, v) => { store[k] = v; } } };
        });
        a.element.dataset.lane = '0'; b.element.dataset.lane = '2';
        ListOrder.applyZ(ListOrder.compute([a, b]), [a, b]);
        expect(Number(b.store['--list-z'])).toBeGreaterThan(Number(a.store['--list-z']));
    });
    test('applyZ writes --list-z only when it changes', () => {
        const a = mk(0);
        const calls = [];
        const store = {};
        a.element = { style: { getPropertyValue: k => store[k] || '', setProperty: (k, v) => { calls.push(v); store[k] = v; } } };
        const L = ListOrder.compute([a]);
        ListOrder.applyZ(L, [a]); ListOrder.applyZ(L, [a]);
        expect(calls).toEqual([String(CONFIG.LIST_Z_MAX)]);
    });
    test('sortKeys: rows by index; a sub slots among rows by due time', () => {
        const a = mk(0), b = mk(200), s = mk(100, { parentId: a.id });
        const items = [a, b, s];
        const k = ListOrder.sortKeys(ListOrder.compute(items), items);
        expect(k.get(a.id)).toBe(0); expect(k.get(b.id)).toBe(1);
        expect(k.get(s.id)).toBe(0.5);
    });
});
