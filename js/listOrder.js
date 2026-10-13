/**
 * listOrder.js -- agenda-list order, tie groups and canvas layering
 * (Jeremy 2026-10-13; DECISIONS.md "Canvas layering follows list order").
 *
 * PURE except for the two stamping functions, which write `listRank` /
 * `listRankDue` on items.
 *
 * Model
 *  - Top-level active items (no parentId) sort by due time.
 *  - Neighbors whose due times are within CONFIG.LIST_TIE_WINDOW_MIN form a
 *    CHAINED tie group (9:00 / 9:25 / 9:50 = one group).
 *  - Inside a group the player may reorder by hand. A hand-ordered item stores
 *      listRank    = the due time (ms, + idx/1000) of the SLOT it occupies, i.e.
 *                    the group's sorted due times re-dealt in the manual order
 *      listRankDue = its OWN due time (ms) when the rank was stamped
 *    Slot-time ranks make merged groups (and groups that later split) keep
 *    each former group's internal order with no extra bookkeeping.
 *  - A rank is VALID only while listRankDue still equals the item's due time,
 *    so ANY due-time change (edit popup, pushback token, sub-task clamp)
 *    clears it implicitly -- no call site has to remember to.
 *  - Unranked items in a group that already has a manual order slot in by due
 *    time ONLY when that spot agrees with the manual order (everything above
 *    is due no later, everything below no earlier); otherwise they go to the
 *    bottom of the group.
 *  - Groups with no valid rank are plain due-time order (the pre-schema-12
 *    behavior), so unranked saves behave exactly as before.
 *
 * Public API
 *   ListOrder.compute(items, opts?)   -> { rows, groups, groupOf, rowOf, manual }
 *   ListOrder.stampManualGroups(layout)  persist the order of groups that have one
 *   ListOrder.canMove(layout, id, dir)   dir -1 = up, +1 = down
 *   ListOrder.move(items, id, dir, opts?) swap with the neighbor + stamp -> bool
 *   ListOrder.zIndexes(layout, items, opts?) -> Map(id -> z)
 *   ListOrder.applyZ(layout, items)   writes --list-z on each item's element
 *   ListOrder.sortKeys(layout, items) -> Map(id -> number) list-order key for
 *                                       every item (subs: parent's row / due slot)
 */
const ListOrder = (() => {
    function cfg() { return (typeof CONFIG !== 'undefined') ? CONFIG : {}; }
    function windowMs(opts) {
        const m = (opts && opts.windowMin) || cfg().LIST_TIE_WINDOW_MIN || 30;
        return m * 60000;
    }
    function dueMs(i) {
        const d = i.dueDateTime;
        return (d instanceof Date) ? d.getTime() : new Date(d).getTime();
    }
    function hasValidRank(i) {
        return typeof i.listRank === 'number' && isFinite(i.listRank) && i.listRankDue === dueMs(i);
    }

    // True if `d` can sit at index p of `order` without contradicting due order.
    function slotOk(order, p, d) {
        for (let k = 0; k < order.length; k++) {
            const due = dueMs(order[k]);
            if (k < p ? due > d : due < d) return false;
        }
        return true;
    }

    // Last agreeing position, else the bottom.
    function slotIndex(order, d) {
        for (let p = order.length; p >= 0; p--) {
            if (slotOk(order, p, d)) return p;
        }
        return order.length;
    }

    // group arrives in due order. Returns { order, manual }.
    function orderGroup(group) {
        const ranked = group.filter(hasValidRank);
        if (!ranked.length) return { order: group.slice(), manual: false };
        ranked.sort((a, b) => (a.listRank - b.listRank) || (dueMs(a) - dueMs(b)));
        const order = ranked.slice();
        group.filter(i => !hasValidRank(i)).forEach(u => { // already due-ordered
            order.splice(slotIndex(order, dueMs(u)), 0, u);
        });
        return { order, manual: true };
    }

    function compute(items, opts) {
        const win = windowMs(opts);
        const top = (items || [])
            .filter(i => !i.parentId)
            .map((item, idx) => ({ item, idx }))
            .sort((a, b) => (dueMs(a.item) - dueMs(b.item)) || (a.idx - b.idx))
            .map(x => x.item);

        const rawGroups = [];
        top.forEach(item => {
            const g = rawGroups[rawGroups.length - 1];
            if (g && dueMs(item) - dueMs(g[g.length - 1]) <= win) g.push(item);
            else rawGroups.push([item]);
        });

        const groups = [];
        const manual = [];
        rawGroups.forEach(g => {
            const r = orderGroup(g);
            groups.push(r.order);
            manual.push(r.manual);
        });

        const rows = [];
        const groupOf = new Map();
        const rowOf = new Map();
        groups.forEach((g, gi) => g.forEach(item => {
            groupOf.set(item.id, gi);
            rowOf.set(item.id, rows.length);
            rows.push(item);
        }));
        return { rows, groups, groupOf, rowOf, manual };
    }

    // Re-deal the group's sorted due times in its current order.
    function stampGroup(order) {
        const slots = order.map(dueMs).sort((a, b) => a - b);
        order.forEach((item, idx) => {
            item.listRank = slots[idx] + idx / 1000;
            item.listRankDue = dueMs(item);
        });
    }

    // Persist the order of hand-ordered groups -- but ONLY groups that have a
    // member without a valid rank (a new/edited item that was just slotted in).
    // A group whose members are all validly ranked is left untouched: restore
    // adds saved items ONE AT A TIME (each add re-renders the list), and
    // re-stamping those partial groups would overwrite the saved ranks with
    // slot dues of an incomplete group (found live 2026-10-13: the order was
    // lost on reload).
    function stampManualGroups(layout) {
        layout.groups.forEach((g, gi) => {
            if (layout.manual[gi] && !g.every(hasValidRank)) stampGroup(g);
        });
    }

    function neighbor(layout, id, dir) {
        const gi = layout.groupOf.get(id);
        if (gi === undefined) return null;
        const g = layout.groups[gi];
        const idx = g.findIndex(i => i.id === id);
        const j = idx + (dir < 0 ? -1 : 1);
        if (idx < 0 || j < 0 || j >= g.length) return null;
        return { g, idx, j };
    }

    function canMove(layout, id, dir) {
        return !!neighbor(layout, id, dir);
    }

    function move(items, id, dir, opts) {
        const layout = compute(items, opts);
        const n = neighbor(layout, id, dir);
        if (!n) return false;
        const order = n.g.slice();
        const tmp = order[n.idx]; order[n.idx] = order[n.j]; order[n.j] = tmp;
        stampGroup(order);
        return true;
    }

    function zIndexes(layout, items, opts) {
        const c = cfg();
        const zMax = (opts && opts.zMax) || c.LIST_Z_MAX || 79;
        const zMin = (opts && opts.zMin) || c.LIST_Z_MIN || 30;
        const z = new Map();
        layout.rows.forEach((item, row) => z.set(item.id, Math.max(zMin, zMax - row * 2)));
        (items || []).forEach(i => {
            if (!i.parentId) return;
            z.set(i.id, z.has(i.parentId) ? z.get(i.parentId) - 1 : zMin - 1);
        });
        return z;
    }

    function applyZ(layout, items) {
        const z = zIndexes(layout, items);
        (items || []).forEach(i => {
            const el = i.element;
            if (!el || !el.style || typeof el.style.setProperty !== 'function') return;
            const v = String(z.get(i.id));
            if (el.style.getPropertyValue('--list-z') !== v) el.style.setProperty('--list-z', v);
        });
    }

    // List-order key for every item: a top-level item's row; a sub-task (only
    // ones that broke away from their parent get a marker of their own) takes
    // the slot among the rows by its due time, +0.5 (Jeremy 2026-10-13).
    function sortKeys(layout, items) {
        const keys = new Map();
        layout.rows.forEach((item, row) => keys.set(item.id, row));
        (items || []).forEach(i => {
            if (!i.parentId) return;
            let before = -1;
            layout.rows.forEach((r, row) => { if (dueMs(r) <= dueMs(i)) before = row; });
            keys.set(i.id, before + 0.5);
        });
        return keys;
    }

    return { compute, stampManualGroups, canMove, move, zIndexes, applyZ, sortKeys, hasValidRank };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ListOrder;
}
