/**
 * AnytimeCheck -- pure helpers for the "Anytime" task evening check (Anytime Build 2, 2026-11-02; DECISIONS
 * 2026-11-02 night). No DOM, no State, no globals.
 *
 *  - WHO the evening check asks about: top-level tasks flagged `anytime` that are still open, due 11:59 PM TODAY, not yet
 *    overdue, and not already answered tonight (a per-item stamp, `item.anytimeAsked.evening` = the local date);
 *  - the "Tomorrow" target: 11:59 PM on the next calendar day (calendar math, so a DST change cannot move the clock time);
 *  - the stamp helpers.
 * Build 3 (2026-11-02) adds the NEXT-MORNING card: the anytime tasks whose 11:59 PM has already passed on an earlier day
 * (they have attacked), the "Today" target, and the `morning` stamp.
 */
const AnytimeCheck = (() => {
    const DUE_HOUR = 23;
    const DUE_MINUTE = 59;
    // The morning card shows at most this many tasks per sitting, newest first; the rest are asked once these are answered.
    const MORNING_MAX = 5;

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

    /** True when this task was already answered by the next-morning card. */
    function askedMorning(item) {
        return !!(item && item.anytimeAsked && item.anytimeAsked.morning === true);
    }

    /**
     * The anytime tasks the next-morning card should ask about right now: open, flagged anytime, due 11:59 PM on an EARLIER
     * local date (so they have attacked), not KO-ghosted and not already answered by this card. No age limit: it asks
     * whenever the player next opens the app, however many days later. Newest due first, at most MORNING_MAX.
     */
    function morningCandidates(activeItems, nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        const today = dateKey(now);
        return (Array.isArray(activeItems) ? activeItems : []).filter((item) => {
            if (!isOpenAnytimeTask(item) || item.koGhost || askedMorning(item)) return false;
            return toMs(item.dueDateTime) <= now && dateKey(item.dueDateTime) < today;
        }).sort((a, b) => toMs(b.dueDateTime) - toMs(a.dueDateTime)).slice(0, MORNING_MAX);
    }

    /**
     * The morning card's "Today" target: 11:59 PM today; if that moment has already passed (the app was opened in the last
     * minute of the day) 11:59 PM tomorrow, so the move never lands in the past.
     */
    function morningDue(nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        const d = new Date(now);
        const today = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DUE_HOUR, DUE_MINUTE, 0, 0);
        return today.getTime() > now ? today : tomorrowDue(now);
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

    /** Records that the next-morning card answered this task. Returns the item. */
    function stampMorning(item) {
        if (!item) return item;
        item.anytimeAsked = Object.assign({}, item.anytimeAsked, { morning: true });
        return item;
    }

    return {
        MORNING_MAX,
        dateKey,
        isOpenAnytimeTask,
        askedTonight,
        eveningCandidates,
        askedMorning,
        morningCandidates,
        morningDue,
        tomorrowDue,
        hasOpenSubTasks,
        stampEvening,
        stampMorning,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnytimeCheck;
}
