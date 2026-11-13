/**
 * notNeeded.js -- "Not needed" passes (DESIGNED 2026-11-13, Jeremy + Opus 5.5; DECISIONS 2026-11-13 (Delete Task and Not needed
 * today: design); ROADMAP "Delete Task + Not needed today passes").
 *
 * The problem: a task can stop being needed through no fault of the player (a cancelled meeting, a closed gym). Until now a
 * one-off task could not be deleted at all, and the only way to excuse a day of a habit / routine task was a paid Skip Day /
 * Sick Day token. The rules, all pure here:
 *
 *   - PASSES: CONFIG.NOT_NEEDED_PASSES_PER_WEEK a calendar week (the week starts on CONFIG.GOAL_WEEK_STARTS_ON, Monday). The
 *       use stamps (ms) are kept by State (`notNeededUses`); a pass is used when its action is applied, never before.
 *   - DELETE (one-off tasks and sub-tasks only; habits keep "Delete Habit", routine tasks leave through the routine window):
 *       not due yet (and nothing under it overdue) = free; overdue / attacking = uses a pass; no pass = refused.
 *   - NOT NEEDED TODAY: always uses a pass, and only BEFORE the item is due (an attacking zombie is Skip Day / Sick Day / pushback
 *       territory, or Delete with a pass for a one-off). Habits (Build) and routine tasks: today's instance leaves the board, no
 *       occurrence is recorded (streak and history untouched, like Skip Day). A one-off task: it moves to tomorrow, ONCE per task.
 *       Break habits and sub-tasks are not offered it (a Break habit's excuse is Cheat Day; a sub-task can only be deleted).
 *
 * PURE: no DOM, no State, no CONFIG read except the optional arguments. Items.deleteTask / Items.markNotNeeded (js/items.js)
 * apply the result.
 */
const NotNeeded = (() => {
    const DEFAULT_CAP = 3;
    const DEFAULT_WEEK_STARTS_ON = 1; // Monday, like CONFIG.GOAL_WEEK_STARTS_ON

    function whole(n, fallback) {
        const v = Math.trunc(Number(n));
        return Number.isFinite(v) && v >= 0 ? v : fallback;
    }

    function weekStarts(weekStartsOn) {
        const w = Math.trunc(Number(weekStartsOn));
        return Number.isFinite(w) && w >= 0 && w <= 6 ? w : DEFAULT_WEEK_STARTS_ON;
    }

    /** Local midnight of the first day of the calendar week that contains `nowMs`. */
    function weekStartMs(nowMs, weekStartsOn) {
        const d = new Date(nowMs);
        d.setHours(0, 0, 0, 0);
        const back = (d.getDay() - weekStarts(weekStartsOn) + 7) % 7;
        d.setDate(d.getDate() - back);
        return d.getTime();
    }

    /** Local midnight that starts the NEXT week (when the passes come back). */
    function nextResetMs(nowMs, weekStartsOn) {
        const d = new Date(weekStartMs(nowMs, weekStartsOn));
        d.setDate(d.getDate() + 7);
        return d.getTime();
    }

    /** Keeps only finite ms stamps; anything else (junk, old saves) becomes an empty list. */
    function sanitizeUses(src) {
        return Array.isArray(src) ? src.filter(n => typeof n === 'number' && isFinite(n)) : [];
    }

    function usedThisWeek(uses, nowMs, weekStartsOn) {
        const start = weekStartMs(nowMs, weekStartsOn);
        const end = nextResetMs(nowMs, weekStartsOn);
        return sanitizeUses(uses).filter(s => s >= start && s < end).length;
    }

    function passesLeft(uses, nowMs, cap, weekStartsOn) {
        return Math.max(0, whole(cap, DEFAULT_CAP) - usedThisWeek(uses, nowMs, weekStartsOn));
    }

    /** A NEW list with one more use stamped at `nowMs`; stamps from earlier weeks are dropped (the input is never mutated). */
    function addUse(uses, nowMs, weekStartsOn) {
        const start = weekStartMs(nowMs, weekStartsOn);
        return sanitizeUses(uses).filter(s => s >= start).concat([nowMs]);
    }

    /** 'one-off' | 'sub-task' | 'routine-task' | 'habit' | 'negative-habit' | 'other'. */
    function kindOf(item) {
        if (!item) return 'other';
        if (item.type === 'habit') return item.isNegative ? 'negative-habit' : 'habit';
        if (item.type === 'task') {
            if (item.parentId) return 'sub-task';
            if (item.definitionId != null) return 'routine-task';
            return 'one-off';
        }
        return 'other';
    }

    /** Is the item's due time already here (or is it flagged overdue)? */
    function isDue(item, nowMs) {
        if (!item) return false;
        if (item.isOverdue) return true;
        const due = item.dueDateTime instanceof Date ? item.dueDateTime.getTime() : Number(item.dueDateTime);
        return Number.isFinite(due) && due <= nowMs;
    }

    /**
     * What would this action do? ctx = { item, action: 'delete' | 'notNeeded', nowMs, uses, cap, weekStartsOn,
     *   attacking?, gameOver? }. `attacking` = true when the item, or any sub-task under it, is overdue (Items works it out).
     * Returns { ok, kind, effect, usesPass, left, reason? }:
     *   effect 'delete'        -- the item (and its sub-tasks) leave for good;
     *   effect 'skip-day'      -- today's habit / routine-task instance leaves the board, nothing recorded;
     *   effect 'move-tomorrow' -- a one-off task moves a day later;
     *   left   = passes left AFTER the action (when ok), or now (when refused);
     *   reason (refused) = 'unavailable' | 'ko' | 'not-deletable' | 'not-available' | 'due' | 'already-moved' | 'no-passes'.
     */
    function plan(ctx) {
        const c = ctx || {};
        const item = c.item;
        const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
        const left = passesLeft(c.uses, nowMs, c.cap, c.weekStartsOn);
        const kind = kindOf(item);
        const no = (reason) => ({ ok: false, kind, effect: null, usesPass: false, left, reason });

        if (!item || c.gameOver) return no('unavailable');
        if (item.koGhost) return no('ko');
        const attacking = c.attacking === true || isDue(item, nowMs);

        if (c.action === 'delete') {
            if (kind !== 'one-off' && kind !== 'sub-task') return no('not-deletable');
            if (!attacking) return { ok: true, kind, effect: 'delete', usesPass: false, left };
            if (left <= 0) return no('no-passes');
            return { ok: true, kind, effect: 'delete', usesPass: true, left: left - 1 };
        }

        if (c.action === 'notNeeded') {
            if (kind === 'sub-task' || kind === 'negative-habit' || kind === 'other') return no('not-available');
            if (attacking) return no('due');
            if (kind === 'one-off' && item.notNeededMoved) return no('already-moved');
            if (left <= 0) return no('no-passes');
            const effect = kind === 'one-off' ? 'move-tomorrow' : 'skip-day';
            return { ok: true, kind, effect, usesPass: true, left: left - 1 };
        }

        return no('unavailable');
    }

    return {
        DEFAULT_CAP,
        weekStartMs,
        nextResetMs,
        sanitizeUses,
        usedThisWeek,
        passesLeft,
        addUse,
        kindOf,
        isDue,
        plan,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotNeeded;
}
