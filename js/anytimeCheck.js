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
 * The morning card's "Done counts as on time" is a LIMITED credit (2026-11-02, Jeremy): `creditInfo` / `spendCredit` keep a
 * rolling window of use stamps (same shape as the Long pushback), and `creditText` words it for the card and the Clock tower.
 * 2026-11-09 (Jeremy: "if it never gets completed on any day, the user should still be presented with the pop up"): the
 * morning card now asks about EVERY open top-level one-off task due on an earlier day (anytime or timed), once per morning
 * for as long as it stays open. The `morning` stamp is the local date it was answered (an old `true` stamp no longer
 * silences it), and only an anytime task due 11:59 PM YESTERDAY can use the on-time credit (`onTimeEligible`).
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

    /**
     * True when the next-morning card already got an answer for this task THIS morning (stamp = today's local date). The card
     * asks again every later morning while the task is open. An old `true` stamp (before 2026-11-09) counts as not asked.
     */
    function askedMorning(item, nowMs) {
        return !!(item && item.anytimeAsked && item.anytimeAsked.morning === dateKey(typeof nowMs === 'number' ? nowMs : Date.now()));
    }

    /** An open top-level ONE-OFF task (recurring instances have their own rollover handling and are left out). */
    function isOpenOneOffTask(item) {
        if (!item || item.type !== 'task' || item.parentId || item.definitionId != null) return false;
        return !isNaN(new Date(toMs(item.dueDateTime)).getTime());
    }

    /** "YYYY-MM-DD" of the calendar day before `nowMs` (calendar math, never "- 24 h"). */
    function yesterdayKey(nowMs) {
        const d = new Date(typeof nowMs === 'number' ? nowMs : Date.now());
        return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12, 0, 0, 0));
    }

    /**
     * True when the morning card's Done may count as ON TIME for this task (a credit permitting): an anytime task due 11:59 PM
     * YESTERDAY, the "fell asleep before marking it" slip the credit is for. Every other task counts as an ordinary late
     * completion (2026-11-09, Jeremy agreed).
     */
    function onTimeEligible(item, nowMs) {
        return isOpenAnytimeTask(item) && dateKey(item.dueDateTime) === yesterdayKey(nowMs);
    }

    /**
     * The tasks the next-morning card should ask about right now: open top-level one-off tasks (anytime OR timed) due on an
     * EARLIER local date (so they have attacked), not KO-ghosted and not already answered this morning. No age limit: it asks
     * every morning the task is still open, however many days late. Newest due first, at most MORNING_MAX.
     */
    function morningCandidates(activeItems, nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        const today = dateKey(now);
        return (Array.isArray(activeItems) ? activeItems : []).filter((item) => {
            if (!isOpenOneOffTask(item) || item.koGhost || askedMorning(item, now)) return false;
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

    /** Records that the next-morning card answered this task this morning (stamp = today's local date). Returns the item. */
    function stampMorning(item, nowMs) {
        if (!item) return item;
        item.anytimeAsked = Object.assign({}, item.anytimeAsked, { morning: dateKey(typeof nowMs === 'number' ? nowMs : Date.now()) });
        return item;
    }

    // --- On-time credit (the morning card's Done) ----------------------------------------------------------------------
    // `uses` = ms stamps of spent credits. A stamp is live for `windowMs` after it was spent; `max` credits can be live at once,
    // and each one comes back on its own, windowMs after it was used (rolling, not a fixed weekday).
    function liveUses(uses, nowMs, windowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        return (Array.isArray(uses) ? uses : [])
            .filter(t => typeof t === 'number' && isFinite(t) && t > now - windowMs)
            .sort((a, b) => a - b);
    }

    /** { left, max, nextBackAt } -- nextBackAt = ms the next credit returns, null when none is spent. */
    function creditInfo(uses, nowMs, max, windowMs) {
        const live = liveUses(uses, nowMs, windowMs);
        const left = Math.max(0, max - live.length);
        const nextBackAt = live.length === 0 ? null : live[Math.max(0, live.length - max)] + windowMs;
        return { left, max, nextBackAt };
    }

    /** The uses list after spending one credit now (expired stamps dropped). Does not check that one is left. */
    function spendCredit(uses, nowMs, windowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        return liveUses(uses, now, windowMs).concat([now]);
    }

    /** One line for the card and the Clock tower: "On-time credit: 1 of 2 left. Next back Tue, Nov 10, 7:30 AM." */
    function creditText(info, locale) {
        let text = `On-time credit: ${info.left} of ${info.max} left`;
        if (info.nextBackAt != null) {
            const when = new Date(info.nextBackAt).toLocaleString(locale || [], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            text += `. Next back ${when}`;
        }
        return text + '.';
    }

    return {
        MORNING_MAX,
        creditInfo,
        spendCredit,
        creditText,
        dateKey,
        isOpenAnytimeTask,
        askedTonight,
        eveningCandidates,
        askedMorning,
        isOpenOneOffTask,
        yesterdayKey,
        onTimeEligible,
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
