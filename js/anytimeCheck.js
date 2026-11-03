/**
 * AnytimeCheck -- pure helpers for the "Anytime" task evening check (Anytime Build 2, 2026-11-02; DECISIONS
 * 2026-11-02 night). No DOM, no State, no globals.
 *
 *  - WHO the evening check asks about: top-level tasks flagged `anytime` that are still open, due 11:59 PM TODAY, not yet
 *    overdue, and not already answered tonight (a per-item stamp, `item.anytimeAsked.evening` = the local date);
 *  - the "Tomorrow" target: 11:59 PM on the next calendar day (calendar math, so a DST change cannot move the clock time);
 *  - the stamp helpers.
 * The next-morning card (Build 3) will add its own candidate function and the `morning` stamp here.
 */
const AnytimeCheck = (() => {
    const DUE_HOUR = 23;
    const DUE_MINUTE = 59;

    const pad2 = (n) => String(n).padStart(2, '0');

    function toMs(value) {
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const ms = new Date(value).getTime();
        return ms;
    }

    /** Local calendar date of a time, "YYYY-MM-DD". */
    function dateKey(value) {
        const d = new Date(toMs(value));
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    /** True for an open top-level task flagged anytime whose due time is still exactly 23:59. */
    function isOpenAnytimeTask(item) {
        if (!item || item.type !== 'task' || item.anytime !== true || item.parentId) return false;
        const due = new Date(toMs(item.dueDateTime));
        return !isNaN(due.getTime()) && due.getHours() === DUE_HOUR && due.getMinutes() === DUE_MINUTE;
    }

    /** True when this item was already answered by tonight's evening check (stamp = today's local date). */
    function askedTonight(item, nowMs) {
        return !!(item && item.anytimeAsked && item.anytimeAsked.evening === dateKey(nowMs));
    }

    /**
     * The anytime tasks tonight's evening check should ask about right now: open, due 23:59 on today's local date, not
     * overdue yet (the next-morning card, Build 3, handles the ones that already attacked), not KO-ghosted and not already
     * answered tonight. Order is the order given.
     */
    function eveningCandidates(activeItems, nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        const today = dateKey(now);
        return (Array.isArray(activeItems) ? activeItems : []).filter((item) => {
            if (!isOpenAnytimeTask(item) || item.koGhost) return false;
            if (item.isOverdue === true) return false;
            if (dateKey(item.dueDateTime) !== today) return false;
            if (toMs(item.dueDateTime) <= now) return false;
            return !askedTonight(item, now);
        });
    }

    /** 23:59 on the calendar day after `nowMs`, as a Date. Built from the date parts, never "+ 24 h". */
    function tomorrowDue(nowMs) {
        const d = new Date(typeof nowMs === 'number' ? nowMs : Date.now());
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, DUE_HOUR, DUE_MINUTE, 0, 0);
    }

    /** A parent with sub-tasks still open cannot be marked done from the card (same rule as its row checkbox). */
    function hasOpenSubTasks(item) {
        return !!(item && Array.isArray(item.subTasks) && item.subTasks.length > 0);
    }

    /** Records that tonight's check answered this task. Returns the item. */
    function stampEvening(item, nowMs) {
        if (!item) return item;
        item.anytimeAsked = Object.assign({}, item.anytimeAsked, { evening: dateKey(typeof nowMs === 'number' ? nowMs : Date.now()) });
        return item;
    }

    return {
        dateKey,
        isOpenAnytimeTask,
        askedTonight,
        eveningCandidates,
        tomorrowDue,
        hasOpenSubTasks,
        stampEvening,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnytimeCheck;
}
