/**
 * prioritySlots.js -- three priority slots a day (Jeremy, 2026-11-04; DECISIONS 2026-11-04 (priority slots);
 * docs/PRIORITY_SLOTS_PLAN.md).
 *
 * "High Priority" used to be an unlimited checkbox on tasks. It is now a SLOT: each local day (the task's DUE day)
 * has CONFIG.PRIORITY_SLOTS_PER_DAY of them (3). Rules, all pure here:
 *
 *   - A slot is SPENT when a task is marked (`marks[day]` goes up). Unmarking never gives it back.
 *   - A day's slots are a HARD CAP (Jeremy, 2026-11-12): finishing priorities never opens more. The old "finish three,
 *       get three more" refill is gone (DECISIONS 2026-11-12 (priority cap)).
 *       available = perDay - marks          (a save from before the cap can sit below 0; remaining() floors it)
 *   - Only a task that TAKES a slot counts: a priority standalone task, or a priority sub-task whose parent is NOT
 *     priority. A priority parent covers its sub-tasks for ONE slot (they inherit the look and the x2 points).
 *   - A move to another local day strips priority (the old day's slot stays spent).
 *
 * PURE: no DOM, no State, no CONFIG read except the optional `config` argument. Items.setPriority (js/items.js)
 * applies the result; State owns the `priorityMarks` map ({ 'YYYY-MM-DD': spent }).
 */
const PrioritySlots = (() => {
    const DEFAULT_PER_DAY = 3;
    const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

    function perDayOf(config) {
        const n = config ? Number(config.PRIORITY_SLOTS_PER_DAY) : NaN;
        return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_PER_DAY;
    }

    /** Local calendar day as "YYYY-MM-DD" (same shape as DailyRecord.dateKey); null for anything that is not a date. */
    function dayKey(when) {
        if (when == null) return null;
        const d = when instanceof Date ? when : new Date(when);
        if (isNaN(d.getTime())) return null;
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mm + '-' + dd;
    }

    function whole(n) {
        const v = Number(n);
        return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    }

    /** Slots still free on a day, NOT floored (a day that spent extra slots under the old refill rule can sit below 0). */
    function available(marks, perDay) {
        const per = whole(perDay) || DEFAULT_PER_DAY;
        return per - whole(marks);
    }

    /** What the player sees: never below 0. */
    function remaining(marks, perDay) {
        return Math.max(0, available(marks, perDay));
    }

    function canMark(marks, perDay) {
        return available(marks, perDay) > 0;
    }

    function isTask(item) {
        return !!item && item.type === 'task';
    }

    /** True when this priority task spends a slot of its own: not a sub-task of a priority parent. */
    function takesSlot(item, parent) {
        if (!isTask(item) || !item.isHighPriority) return false;
        if (item.parentId && parent && isTask(parent) && parent.isHighPriority) return false;
        return true;
    }

    function findParent(item, lists) {
        if (!item || !item.parentId) return null;
        for (let i = 0; i < lists.length; i++) {
            const list = lists[i] || [];
            for (let j = 0; j < list.length; j++) {
                const c = list[j];
                if (c && c.id === item.parentId && isTask(c)) return c;
            }
        }
        return null;
    }

    /**
     * Priority tasks finished for a due day. `completed` = the completed list, `others` = any further lists to find a
     * parent in (the active items). A priority parent counts once; its sub-tasks never do; a priority sub-task of a
     * normal parent counts on its own.
     */
    function countDone(completed, others, key) {
        const done = completed || [];
        const lists = [done, others || []];
        let n = 0;
        for (let i = 0; i < done.length; i++) {
            const item = done[i];
            if (!isTask(item) || !item.isHighPriority) continue;
            if (dayKey(item.dueDateTime) !== key) continue;
            if (takesSlot(item, findParent(item, lists))) n += 1;
        }
        return n;
    }

    /** Does moving a due time from `oldDue` to `newDue` change the local day (and so strip priority)? */
    function stripsOnMove(oldDue, newDue) {
        const a = dayKey(oldDue), b = dayKey(newDue);
        return a != null && b != null && a !== b;
    }

    /**
     * What would marking / unmarking do? `ctx` = { item, parent, on, marks, perDay } where marks is the count for the
     * item's due day. Returns { ok, action: 'mark' | 'unmark' | 'noop', left, reason? }:
     *   mark   -- spends one slot (ok false, reason 'full' when none is left);
     *   unmark -- clears the flag, spends nothing and refunds nothing;
     *   noop   -- already in that state, or a sub-task covered by a priority parent (reason 'covered').
     */
    function planChange(ctx) {
        const c = ctx || {};
        const item = c.item;
        const per = whole(c.perDay) || DEFAULT_PER_DAY;
        const left = remaining(c.marks, per);
        if (!isTask(item)) return { ok: false, action: 'noop', left, reason: 'not-a-task' };
        const covered = !!(item.parentId && c.parent && isTask(c.parent) && c.parent.isHighPriority);
        if (c.on) {
            if (covered) return { ok: true, action: 'noop', left, reason: 'covered' };
            if (item.isHighPriority) return { ok: true, action: 'noop', left };
            if (!canMark(c.marks, per)) return { ok: false, action: 'noop', left, reason: 'full' };
            return { ok: true, action: 'mark', left: Math.max(0, left - 1) };
        }
        if (covered) return { ok: true, action: 'noop', left, reason: 'covered' };
        if (!item.isHighPriority) return { ok: true, action: 'noop', left };
        return { ok: true, action: 'unmark', left };
    }

    // --- the persisted marks map ---------------------------------------------------------------------------------

    /** Keeps only { 'YYYY-MM-DD': whole number > 0 }; anything else (junk, old saves) is dropped. */
    function sanitizeMarks(src) {
        const out = {};
        if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
        Object.keys(src).forEach((k) => {
            const n = whole(src[k]);
            if (KEY_RE.test(k) && n > 0) out[k] = n;
        });
        return out;
    }

    /** A NEW marks map with one more slot spent on `key` (the input is never mutated). */
    function addMark(marks, key) {
        const out = sanitizeMarks(marks);
        if (!KEY_RE.test(String(key))) return out;
        out[key] = (out[key] || 0) + 1;
        return out;
    }

    function marksFor(marks, key) {
        return marks && typeof marks === 'object' ? whole(marks[key]) : 0;
    }

    /** Drops every day before yesterday (future days keep their counts); `now` is a Date or ms. */
    function prune(marks, now) {
        const base = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
        const y = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
        const floor = dayKey(y);
        const out = {};
        const clean = sanitizeMarks(marks);
        Object.keys(clean).forEach((k) => { if (floor == null || k >= floor) out[k] = clean[k]; });
        return out;
    }

    return {
        DEFAULT_PER_DAY, perDayOf, dayKey, available, remaining, canMark,
        takesSlot, findParent, countDone, stripsOnMove, planChange,
        sanitizeMarks, addMark, marksFor, prune,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrioritySlots;
}
