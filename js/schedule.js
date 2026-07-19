/**
 * Schedule — recurrence rules for habit definitions and routine task
 * definitions (designed 2026-07-18, built session 14).
 *
 * Pure module, no DOM, no closures — same convention as clock.js/progression.js.
 * Both habits.js (selectHabitDefsToSpawn) and routines.js (selectTaskDefsToSpawn)
 * call isScheduledForDay() to decide whether a recurring definition should
 * produce an instance on a given day, replacing the old always-daily behavior
 * (habits checked `frequency === 'daily'`; routine tasks had no field at all).
 *
 * Schedule shape (see docs/DATA_SCHEMA.md):
 *   { frequency: 'daily'|'weekly'|'monthly',
 *     daysOfWeek: number[],   // 0=Sun..6=Sat — used by daily & weekly
 *     dayOfMonth: number|null } // 1-31 — used by monthly, clamped to month length
 *
 * Design decisions baked in (DECISIONS.md 2026-07-18):
 *   - 'daily' and 'weekly' share ONE mechanism: a day-of-week filter. "Daily"
 *     is simply all 7 days checked; "weekly" is a subset. No separate weekly
 *     streak/dedupe concept.
 *   - 'monthly' clamps dayOfMonth to the target month's last day (31 → Feb
 *     28/29) rather than skipping short months.
 */
const Schedule = (() => {

    const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

    // The every-day default — preserves the pre-schedule behavior for both
    // migrated definitions and any created before the scheduling UI exists.
    function defaultSchedule() {
        return { frequency: 'daily', daysOfWeek: ALL_DAYS.slice(), dayOfMonth: null };
    }

    // Build a Schedule from the legacy `frequency` string the create/edit forms
    // still pass (only 'daily' exists in the UI until step (b) lands). Anything
    // unrecognized falls back to daily so a definition can never become
    // un-spawnable through a bad/missing value.
    function fromLegacyFrequency(frequency) {
        if (frequency === 'weekly') {
            // Weekly with no explicit day picks yet — empty set, spawns nothing
            // until the user chooses days (matches the design default). The
            // legacy form never actually produced 'weekly', so this is just a
            // forward-safe branch.
            return { frequency: 'weekly', daysOfWeek: [], dayOfMonth: null };
        }
        if (frequency === 'monthly') {
            return { frequency: 'monthly', daysOfWeek: [], dayOfMonth: 1 };
        }
        return defaultSchedule();
    }

    // Coerce whatever a definition currently carries into a valid Schedule.
    // Accepts an existing schedule object, a bare legacy frequency string, or
    // nothing — so callers (generators, migration) never have to special-case
    // partially-shaped data.
    function normalize(scheduleOrFrequency) {
        if (typeof scheduleOrFrequency === 'string') {
            return fromLegacyFrequency(scheduleOrFrequency);
        }
        if (scheduleOrFrequency && typeof scheduleOrFrequency === 'object') {
            const s = scheduleOrFrequency;
            const frequency = (s.frequency === 'weekly' || s.frequency === 'monthly')
                ? s.frequency : 'daily';
            return {
                frequency,
                daysOfWeek: Array.isArray(s.daysOfWeek)
                    ? s.daysOfWeek.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
                    : (frequency === 'daily' ? ALL_DAYS.slice() : []),
                dayOfMonth: (Number.isInteger(s.dayOfMonth) && s.dayOfMonth >= 1 && s.dayOfMonth <= 31)
                    ? s.dayOfMonth : (frequency === 'monthly' ? 1 : null),
            };
        }
        return defaultSchedule();
    }

    // Last calendar day of the month containing `date` (28-31).
    function lastDayOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    // Does this schedule call for an instance on `date`?
    //   daily/weekly → date's day-of-week is in daysOfWeek
    //   monthly      → date's day-of-month equals dayOfMonth, clamped to the
    //                  month's last day so 31 fires on Feb 28/29, Apr 30, etc.
    function isScheduledForDay(scheduleOrFrequency, date) {
        const schedule = normalize(scheduleOrFrequency);

        if (schedule.frequency === 'monthly') {
            if (!Number.isInteger(schedule.dayOfMonth)) return false;
            const target = Math.min(schedule.dayOfMonth, lastDayOfMonth(date));
            return date.getDate() === target;
        }

        // daily & weekly
        return schedule.daysOfWeek.includes(date.getDay());
    }

    return {
        ALL_DAYS,
        defaultSchedule,
        fromLegacyFrequency,
        normalize,
        isScheduledForDay,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Schedule;
}
