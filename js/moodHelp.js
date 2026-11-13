/**
 * MoodHelp -- the pure rules behind the two soft cards that can follow a low mood (W1b Build B2, 2026-11-13;
 * docs/WORLD_FEEDBACK_PLAN.md "Build B2"; DECISIONS 2026-11-13 (mood Build B2)).
 *
 *   1. The HELP card: after a Bad / Awful tap, ONE dismissible card with a line chosen by the feeling word and two buttons
 *      ("Open my agenda", "Add a 10-minute task"). It only points at levers that already exist. Nothing is earned, nothing changes.
 *   2. The RUN-OF-LOWS card: after LOWS_NEEDED days in a row whose CLOSING mood (the day's last check-in) was Bad / Awful, one
 *      gentle line suggesting talking to someone, at most once every LOWS_GAP_DAYS days.
 *
 * No DOM, no State, no clock reads (dates are passed in), so it unit-tests without a browser. Theme-neutral words.
 */
const MoodHelp = (() => {
    const LOW_MAX = 2;          // levels 1 (Awful) and 2 (Bad) are "low"
    const LOWS_NEEDED = 3;      // days in a row
    const LOWS_GAP_DAYS = 7;    // at most once a week
    const LOOKBACK_DAYS = 14;   // how far back the streak walk looks (it stops at the first day that is not low)

    const FALLBACK_LINE = 'Rough one. Start with just one small thing, and let the rest wait.';

    // First match wins, in this priority order, over the words the player picked.
    const FEELING_LINES = [
        { id: 'overwhelmed', line: 'Feeling overwhelmed? Pick your 3 priorities for today and break the biggest task into smaller sub-tasks.' },
        { id: 'unmotivated', line: 'Hard to start? Break a big task into one small first step, then start the timer for just that step.' },
        { id: 'anxious', line: 'If a task is behind the anxiety, make it a priority and break it into smaller pieces. Progress on it helps.' },
        { id: 'stressed', line: 'If a task is behind the stress, make it a priority and break it into smaller pieces. Progress on it helps.' },
        { id: 'exhausted', line: 'A light day is allowed. You can reschedule things, use a pushback charge or use a Sick Day.' },
        { id: 'tired', line: 'A light day is allowed. You can reschedule things, use a pushback charge or use a Sick Day.' },
        { id: 'distracted', line: 'Pick one task, turn the timer on and let everything else wait.' },
        { id: 'sad', line: 'Cut yourself some slack today. A break is allowed.' },
        { id: 'down', line: 'Cut yourself some slack today. A break is allowed.' },
    ];

    const ACTIONS = [
        { id: 'agenda', label: 'Open my agenda' },
        { id: 'add10', label: 'Add a 10-minute task: figure out what’s behind this' },
    ];

    const LOWS_LINE = 'You have had a few rough days in a row. That happens to everyone. If it keeps up, it can help to talk to someone you trust, like a friend, a family member or a doctor.';

    function isLowLevel(level) { return Number.isInteger(level) && level >= 1 && level <= LOW_MAX; }

    /**
     * The help card for a check-in: { feeling, line, actions } or null when the level is not low.
     * `feelings` = the picked feeling ids (order does not matter; the priority list above decides).
     */
    function helpModel(level, feelings) {
        if (!isLowLevel(level)) return null;
        const picked = Array.isArray(feelings) ? feelings : [];
        const hit = FEELING_LINES.find((f) => picked.indexOf(f.id) >= 0) || null;
        return { feeling: hit ? hit.id : null, line: hit ? hit.line : FALLBACK_LINE, actions: ACTIONS.map((a) => ({ id: a.id, label: a.label })) };
    }

    /** A day is LOW when its closing (last) check-in is Bad / Awful. `entries` = the day's mood entries [[hour, level, f, c], ...]. */
    function isLowDay(entries) {
        if (!Array.isArray(entries) || !entries.length) return false;
        const last = entries[entries.length - 1];
        return Array.isArray(last) && isLowLevel(last[1]);
    }

    function parseKey(key) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    function keyOf(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function addDays(key, n) {
        const d = parseKey(key);
        if (!d) return null;
        d.setDate(d.getDate() + n);
        return keyOf(d);
    }
    function daysBetween(fromKey, toKey) {
        const a = parseKey(fromKey);
        const b = parseKey(toKey);
        if (!a || !b) return null;
        return Math.round((b.getTime() - a.getTime()) / 86400000);
    }

    /**
     * How many consecutive days, counting back from `todayKey`, were low. `moodFor(dateKey)` -> that day's entries.
     * Today with no check-in yet is skipped (it is not a break); a past day with no check-in ends the streak (no data = not low).
     */
    function lowStreak(todayKey, moodFor) {
        if (!parseKey(todayKey) || typeof moodFor !== 'function') return 0;
        let n = 0;
        let key = todayKey;
        for (let i = 0; i < LOOKBACK_DAYS && key; i++) {
            const entries = moodFor(key);
            const has = Array.isArray(entries) && entries.length > 0;
            if (has && isLowDay(entries)) n += 1;
            else if (has || i > 0) break;   // a mood that is not low, or a past day with none, ends the streak
            key = addDays(key, -1);
        }
        return n;
    }

    /** Due when the streak is long enough and the card has not shown in the last LOWS_GAP_DAYS days. */
    function lowsCardDue(streak, lastShownKey, todayKey) {
        if (!(streak >= LOWS_NEEDED)) return false;
        if (!lastShownKey) return true;
        const gap = daysBetween(lastShownKey, todayKey);
        return gap === null || gap >= LOWS_GAP_DAYS || gap < 0;
    }

    return { LOW_MAX, LOWS_NEEDED, LOWS_GAP_DAYS, FALLBACK_LINE, FEELING_LINES, ACTIONS, LOWS_LINE, isLowLevel, helpModel, isLowDay, lowStreak, lowsCardDue, addDays, daysBetween };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MoodHelp;
}
