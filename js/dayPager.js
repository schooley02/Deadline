/**
 * DayPager — pure day-offset paging + ghost conjuring for the Time Slider's
 * Week scope (`docs/TIME_SLIDER_WEEK_PLAN.md` sub-session 1, 2026-07-20
 * session 71; sequenced/forked in session 70, see DECISIONS.md).
 *
 * Follows the timeSlider.js/runStats.js pattern: pure functions, no DOM, no
 * closures over script.js state, collaborators (Habits/Routines/TimeSlider)
 * read as bare stable globals (loaded before this file in index.html;
 * required explicitly in tests). DOM wiring + rendering lives in the future
 * sub-session 2's timeSliderView.js changes.
 *
 * SCOPE (fork 1/2, session 70): day pager only — NOT a week-scale slider,
 * NOT month scope. Offset range is -1 (yesterday, sub-session 3's static
 * snapshot) .. +6 (six days ahead), with 0 = today. The viewed-day offset is
 * SESSION-ONLY UI state owned by the caller (timeSliderView.js) — this
 * module has no state of its own, matching every other pure core here.
 *
 * GHOST CONJURING IS MOSTLY ASSEMBLY (the plan's framing, confirmed while
 * building this): `Habits.selectHabitDefsToSpawn` / `Routines.
 * selectTaskDefsToSpawn` already take a target day and were built (sessions
 * 36/39) to gate on frozen/suspended routines and Sick/Skip/Cheat-day
 * markers — calling them with a FUTURE day instead of today gets a correct
 * "would this spawn" projection for free, no new gating logic needed here.
 * Standalone (one-off) tasks and sub-tasks are NOT re-conjured at all: they
 * aren't respawned daily from a definition (see items.js's
 * createTaskItemData) — a task due three days out already exists in
 * activeItems today, just far off in the timeline (same "already spawned,
 * just far away" insight session 63 used for Today scope). This module only
 * conjures the two RECURRING categories that truly don't exist yet.
 *
 * Usage (see js/ui/timeSliderView.js, sub-session 2):
 *   DayPager.clampDayOffset(offset) -> number, -1..+6
 *   DayPager.dayBoundsForOffset(referenceTime, offset) -> { start: Date, end: Date }
 *   DayPager.conjureGhostsForDay(deps, referenceTime, offset) -> ghost[]
 *     deps = { definedHabits, definedRoutines, definedTasks, activeItems,
 *              completedItems, sickDayDate }
 *     ghost = { key, definitionId, name, category, isHabit, isNegative,
 *               isHighPriority, routineId, dueTime, parentId }
 *   DayPager.weekStripSummary(deps, referenceTime) -> entry[] (sub-session 4,
 *     one per offset 0..MAX_OFFSET)
 *     entry = { offset, dayStart, totalCount }
 */
const DayPager = (() => {
    const MIN_OFFSET = -1;
    const MAX_OFFSET = 6;

    // Out-of-range or non-numeric input clamps to the nearest valid offset
    // (non-finite/NaN clamps to 0, today) rather than throwing — same
    // defensive posture as TimeSlider.timeToMinutesOfDay.
    function clampDayOffset(offset) {
        const n = Number(offset);
        if (!Number.isFinite(n)) return 0;
        return Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, Math.round(n)));
    }

    // Midnight-to-midnight bounds of the day `offset` days from
    // referenceTime's own calendar day. offset 0 reproduces
    // TimeSlider.getDayBounds(referenceTime) exactly. Reuses TimeSlider's
    // day-bounds math (its header explicitly names this as the extension
    // point) rather than duplicating the midnight logic.
    function dayBoundsForOffset(referenceTime, offset) {
        const shifted = new Date(referenceTime);
        shifted.setDate(shifted.getDate() + offset);
        return TimeSlider.getDayBounds(shifted);
    }

    // Habit ghosts for one day. routineId is read directly off habitDef
    // (matches items.js's findOwningRoutine precedent — a habit's routine
    // membership is its own routineId field, not the routine's
    // habitDefinitionIds list, when only one is available to read from).
    function conjureHabitGhosts(definedHabits, definedRoutines, activeItems, targetDate, sickDayDate) {
        const defs = Habits.selectHabitDefsToSpawn(
            definedHabits || [], definedRoutines || [], activeItems || [], targetDate, sickDayDate
        );
        return defs.map(def => ({
            key: 'ghost:habit:' + def.id,
            definitionId: def.id,
            name: def.name,
            category: def.category || 'other',
            isHabit: true,
            isNegative: !!def.isNegative,
            // Habits have no priority concept (only tasks do — see the
            // Economy high-priority ×2 rule) — always false.
            isHighPriority: false,
            routineId: def.routineId != null ? def.routineId : null,
            dueTime: Habits.getHabitInstanceDueTime(def.timeOfDay, targetDate, def.endTime),
            startTime: Habits.getHabitInstanceStartTime(def, targetDate),
            parentId: null,
        }));
    }

    // Routine-task ghosts for one day. Task defs don't carry their own
    // routineId (unlike habit defs) — resolved by scanning
    // taskDefinitionIds, matching items.js's findRoutineForItem task branch.
    function conjureTaskGhosts(definedTasks, definedRoutines, activeItems, completedItems, targetDate) {
        const routines = definedRoutines || [];
        const defs = Routines.selectTaskDefsToSpawn(
            definedTasks || [], routines, activeItems || [], completedItems || [], targetDate
        );
        return defs.map(def => {
            const owningRoutine = routines.find(r => (r.taskDefinitionIds || []).includes(def.id));
            return {
                key: 'ghost:task:' + def.id,
                definitionId: def.id,
                name: def.name,
                category: def.category || 'other',
                isHabit: false,
                isNegative: false,
                isHighPriority: !!def.isHighPriority,
                routineId: owningRoutine ? owningRoutine.id : null,
                dueTime: Routines.getRoutineTaskInstanceDueTime(def.defaultDueTime, targetDate),
                startTime: Routines.getRoutineTaskInstanceStartTime(def.defaultStartTime, targetDate, Routines.getRoutineTaskInstanceDueTime(def.defaultDueTime, targetDate)),
                parentId: null,
            };
        });
    }

    // Standalone/sub-task items ALREADY in activeItems whose due date falls
    // within the target day's bounds — real items, not conjured (see file
    // header). Excludes recurring instances (definitionId != null); those
    // are covered by the two conjure* functions above and would otherwise
    // double-render for Today, where recurring instances also already sit
    // in activeItems (session 63's model).
    function existingItemsForDay(activeItems, targetDate) {
        const bounds = TimeSlider.getDayBounds(targetDate);
        const startMs = bounds.start.getTime();
        const endMs = bounds.end.getTime();
        return (activeItems || [])
            .filter(item =>
                item.definitionId == null &&
                item.dueDateTime &&
                item.dueDateTime.getTime() >= startMs &&
                item.dueDateTime.getTime() < endMs
            )
            .map(item => ({
                key: 'existing:' + item.id,
                // The real item behind this ghost (2026-11-04): the ghost card's "Open task" button opens its card.
                itemId: item.id,
                definitionId: null,
                name: item.name,
                category: item.category || 'other',
                isHabit: false,
                isNegative: false,
                isHighPriority: !!item.isHighPriority,
                routineId: null,
                dueTime: item.dueDateTime,
            startTime: item.startDateTime || null,
                parentId: item.parentId != null ? item.parentId : null,
                // Anytime tasks (2026-11-02) read "Midnight" in the list, not 11:59 PM.
                anytime: !!item.anytime,
            }));
    }

    // Full ghost agenda for one day (any offset, including 0/Today — callers
    // typically render Today from live activeItems per session 63 instead,
    // but this stays correct if invoked there too). Sorted by due time,
    // matching the live agenda list's "closest to base first" convention.
    // deps = { definedHabits, definedRoutines, definedTasks, activeItems,
    //          completedItems, sickDayDate }
    function conjureGhostsForDay(deps, referenceTime, offset) {
        const d = deps || {};
        const bounds = dayBoundsForOffset(referenceTime, offset);
        const targetDate = bounds.start;

        const habitGhosts = conjureHabitGhosts(d.definedHabits, d.definedRoutines, d.activeItems, targetDate, d.sickDayDate);
        const taskGhosts = conjureTaskGhosts(d.definedTasks, d.definedRoutines, d.activeItems, d.completedItems, targetDate);
        const standalone = existingItemsForDay(d.activeItems, targetDate);

        return habitGhosts.concat(taskGhosts, standalone)
            .sort((a, b) => a.dueTime.getTime() - b.dueTime.getTime());
    }

    // ---------------------------------------------------------------------
    // Yesterday snapshot (sub-session 3, 2026-07-20 session 72) — a STATIC
    // "battlefield aftermath" for offset -1 only. Unlike the future-day
    // ghosts above (which show what WOULD spawn), this shows what WAS
    // scheduled, with an outcome overlay. Deliberately NOT hour-scrubbable
    // (see docs/TIME_SLIDER_WEEK_PLAN.md fork 3) — completion TIMES aren't
    // stored anywhere, only which day an occurrence landed on, so an
    // animated replay would be fiction. The view layer disables the hour
    // slider entirely for this offset instead of pretending otherwise.
    // ---------------------------------------------------------------------

    // Local YYYY-MM-DD key, mirroring habits.js's private toOccurrenceDate
    // (not exported — same local-calendar-fields reasoning: a habit's "day"
    // must match the player's wall clock, not UTC).
    function toLocalDateKey(date) {
        const d = new Date(date);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // Scheduling gate ONLY — no "already resolved" dedup (unlike
    // selectHabitDefsToSpawn), since a resolved day is exactly what a
    // snapshot wants to show. Reuses the SAME routine-usability rule
    // (current routine/frozen state — a known simplification: an owning
    // routine's state is read as of NOW, not as of yesterday, since neither
    // is tracked historically).
    function isHabitScheduledAndUsable(habitDef, definedRoutines, targetDate) {
        if (!Schedule.isScheduledForDay(habitDef.schedule || habitDef.frequency, targetDate)) return false;
        const owningRoutines = (definedRoutines || []).filter(r =>
            (r.habitDefinitionIds || []).includes(habitDef.id) ||
            (habitDef.routineId != null && r.id === habitDef.routineId)
        );
        if (owningRoutines.length > 0 && !owningRoutines.some(r => FrozenSlots.isRoutineUsableForHabit(r, habitDef.id))) {
            return false;
        }
        return true;
    }

    // 'completed'/'missed' for positive habits; 'avoided'/'indulged' for
    // negative ones. 'unknown' when no occurrenceHistory entry exists for
    // that day (the habit didn't exist yet, or the day predates tracking).
    // KNOWN FIDELITY LIMIT (accepted, see plan): occurrenceSuccess collapses
    // 'overdue' (lapsed) and 'indulged' (explicitly caved) to the SAME
    // stored boolean — this can't tell them apart after the fact, so a
    // negative habit's false entry is always labeled 'indulged'.
    function outcomeForHabitOnDay(habitDef, targetDate) {
        const dateKey = toLocalDateKey(targetDate);
        // "Not needed today" (2026-11-13): the player used a weekly pass, so no occurrence was recorded.
        if (habitDef.skipDayDate && habitDef.skipDayDate === dateKey) return 'notNeeded';
        const entry = (habitDef.occurrenceHistory || []).find(o => o.date === dateKey);
        if (!entry) return 'unknown';
        if (entry.success) return habitDef.isNegative ? 'avoided' : 'completed';
        return habitDef.isNegative ? 'indulged' : 'missed';
    }

    function scheduledHabitsForYesterday(definedHabits, definedRoutines, targetDate) {
        return (definedHabits || [])
            .filter(def => !def.archivedAt)
            .filter(def => isHabitScheduledAndUsable(def, definedRoutines || [], targetDate))
            .map(def => ({
                key: 'snapshot:habit:' + def.id,
                definitionId: def.id,
                name: def.name,
                category: def.category || 'other',
                isHabit: true,
                isNegative: !!def.isNegative,
                routineId: def.routineId != null ? def.routineId : null,
                dueTime: Habits.getHabitInstanceDueTime(def.timeOfDay, targetDate, def.endTime),
                startTime: Habits.getHabitInstanceStartTime(def, targetDate),
                parentId: null,
                outcome: outcomeForHabitOnDay(def, targetDate),
            }));
    }

    // Scheduling gate for routine tasks — same active/frozen suspension
    // check as selectTaskDefsToSpawn, no resolution dedup (matches the
    // habit-side reasoning above).
    function isTaskScheduledAndActive(taskDef, definedRoutines, targetDate) {
        const activeRoutineTaskIds = new Set();
        (definedRoutines || []).forEach(r => {
            if (FrozenSlots.isRoutineSuspended(r)) return;
            (r.taskDefinitionIds || []).forEach(id => activeRoutineTaskIds.add(id));
        });
        if (!activeRoutineTaskIds.has(taskDef.id)) return false;
        return Schedule.isScheduledForDay(taskDef.schedule, targetDate);
    }

    // Outcome is read off completedItems: a matching definitionId+day means
    // it was defeated, otherwise it's presumed missed (the day has passed).
    // (Routine task defs gained an occurrenceHistory on 2026-10-31 for the
    // hero star rate; this pager view doesn't read it yet -- defs created
    // earlier have no entries for older days.)
    function outcomeForTaskOnDay(taskDef, completedItems, targetDate) {
        if (taskDef.skipDayDate && taskDef.skipDayDate === toLocalDateKey(targetDate)) return 'notNeeded';
        const dayString = targetDate.toDateString();
        const wasCompleted = (completedItems || []).some(item =>
            item.type === 'task' && item.definitionId === taskDef.id &&
            item.originalDueDate && new Date(item.originalDueDate).toDateString() === dayString
        );
        return wasCompleted ? 'completed' : 'missed';
    }

    function scheduledTasksForYesterday(definedTasks, definedRoutines, completedItems, targetDate) {
        const routines = definedRoutines || [];
        return (definedTasks || [])
            .filter(def => isTaskScheduledAndActive(def, routines, targetDate))
            .map(def => {
                const owningRoutine = routines.find(r => (r.taskDefinitionIds || []).includes(def.id));
                return {
                    key: 'snapshot:task:' + def.id,
                    definitionId: def.id,
                    name: def.name,
                    category: def.category || 'other',
                    isHabit: false,
                    isNegative: false,
                    routineId: owningRoutine ? owningRoutine.id : null,
                    dueTime: Routines.getRoutineTaskInstanceDueTime(def.defaultDueTime, targetDate),
                    startTime: Routines.getRoutineTaskInstanceStartTime(def.defaultStartTime, targetDate, Routines.getRoutineTaskInstanceDueTime(def.defaultDueTime, targetDate)),
                    parentId: null,
                    outcome: outcomeForTaskOnDay(def, completedItems, targetDate),
                };
            });
    }

    // One-off tasks/sub-tasks due yesterday. KNOWN FIDELITY LIMIT (accepted,
    // see plan): these have weaker post-rollover records than habits —
    // dueDateTime/originalDueDate survive completion on the item object
    // (items.js's completeItem only adds completedAt, never strips fields),
    // so a completed one-off is still findable in completedItems; anything
    // still sitting in activeItems past its own due day is presumed missed
    // (it may in fact still be actively overdue today, which reads the same
    // as "missed yesterday" here — no separate "still open" outcome exists).
    function existingItemOutcomesForDay(activeItems, completedItems, targetDate) {
        const bounds = TimeSlider.getDayBounds(targetDate);
        const inRange = (dueDateTime) => dueDateTime &&
            dueDateTime.getTime() >= bounds.start.getTime() &&
            dueDateTime.getTime() < bounds.end.getTime();

        const toEntry = (item, outcome) => ({
            key: 'existing:' + item.id,
            itemId: item.id,
            definitionId: null,
            name: item.name,
            category: item.category || 'other',
            isHabit: false,
            isNegative: false,
            routineId: null,
            dueTime: item.dueDateTime,
            startTime: item.startDateTime || null,
            parentId: item.parentId != null ? item.parentId : null,
            outcome,
        });

        const stillActive = (activeItems || [])
            .filter(item => item.definitionId == null && inRange(item.dueDateTime))
            .map(item => toEntry(item, 'missed'));

        const completed = (completedItems || [])
            .filter(item => item.definitionId == null && inRange(item.dueDateTime))
            .map(item => toEntry(item, 'completed'));

        return stillActive.concat(completed);
    }

    // When a snapshot entry was beaten (2026-11-04, Jeremy): the completedAt (ms) of its Completed / Resisted entry, or
    // null. Only a ✓ outcome has one (completed / avoided); a missed or Slipped zombie never leaves the field. One-offs
    // are found by their own id, routine tasks and habits by definitionId + the day they were due. The Yesterday slider
    // hides a ghost once its time passes this moment (DayPagerView.positionGhostSprite).
    function doneTimeForEntry(entry, completedItems, targetDate) {
        if (entry.outcome !== 'completed' && entry.outcome !== 'avoided') return null;
        const dayString = targetDate.toDateString();
        const match = (completedItems || []).find(item => {
            if (!item || item.outcome === 'indulged' || !item.completedAt) return false;
            if (entry.itemId != null) return item.id === entry.itemId;
            if (entry.definitionId == null || item.definitionId !== entry.definitionId) return false;
            if ((item.type === 'habit') !== !!entry.isHabit) return false;
            const due = item.originalDueDate || item.dueDateTime;
            return !!due && new Date(due).toDateString() === dayString;
        });
        if (!match) return null;
        const ms = new Date(match.completedAt).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    // Full yesterday snapshot, sorted by due time — the -1 counterpart to
    // conjureGhostsForDay. deps = { definedHabits, definedRoutines,
    // definedTasks, activeItems, completedItems }.
    // Each entry also carries `doneAt` (ms or null, see doneTimeForEntry).
    function conjureYesterdaySnapshot(deps, referenceTime) {
        const d = deps || {};
        const bounds = dayBoundsForOffset(referenceTime, MIN_OFFSET);
        const targetDate = bounds.start;

        const habits = scheduledHabitsForYesterday(d.definedHabits, d.definedRoutines, targetDate);
        const tasks = scheduledTasksForYesterday(d.definedTasks, d.definedRoutines, d.completedItems, targetDate);
        const existing = existingItemOutcomesForDay(d.activeItems, d.completedItems, targetDate);

        return habits.concat(tasks, existing)
            .map(entry => Object.assign(entry, { doneAt: doneTimeForEntry(entry, d.completedItems, targetDate) }))
            .sort((a, b) => a.dueTime.getTime() - b.dueTime.getTime());
    }

    // ---------------------------------------------------------------------
    // Week strip (sub-session 4, phase 2, 2026-07-20 session 73) — a 7-day
    // "shape of my week" overview above the day pager. Jeremy's brief:
    // per-day item counts. (2026-11-10: the "★N/3" priority tally and the
    // relative "heavy day" flag were REMOVED from the strip, Jeremy's call: the
    // number alone shows which days are busier, and the heavy flag was nearly
    // always on. Priority use is still recorded in DailyRecord `pri`.)
    // ---------------------------------------------------------------------

    // One entry per offset 0..MAX_OFFSET. Counts exclude
    // sub-tasks (parentId set) — a parent+subs reads as ONE item on the
    // week strip, matching Hud.updateTaskCountDisplay's own convention for
    // the real Today counter.
    function weekStripSummary(deps, referenceTime) {
        const offsets = [];
        for (let offset = 0; offset <= MAX_OFFSET; offset++) offsets.push(offset);

        const entries = offsets.map(offset => {
            const bounds = dayBoundsForOffset(referenceTime, offset);
            let countable;
            if (offset === 0) {
                // Today's real items are ALREADY spawned into activeItems
                // (session 63's model) — conjureGhostsForDay's spawn-check
                // functions correctly EXCLUDE anything with a live instance
                // already, so counting via conjuring would under-count
                // Today specifically. Count the real board instead, exactly
                // like Hud.updateTaskCountDisplay does.
                countable = (deps && deps.activeItems || [])
                    .filter(item => !item.parentId);
            } else {
                countable = conjureGhostsForDay(deps, referenceTime, offset)
                    .filter(g => !g.parentId);
            }
            return {
                offset,
                dayStart: bounds.start,
                totalCount: countable.length,
            };
        });

        return entries;
    }

    // ---------------------------------------------------------------------
    // Continuous day list (2026-11-03). In the pinned layout the agenda is ONE
    // scrolling list: Today's real rows, then a divider + read-only ghost rows
    // for each later day. The active day (the week-strip button that is lit,
    // the header text, the canvas) follows the scroll position.
    //
    // activeOffsetFromTops decides which day owns the top of the list. `tops`
    // is one { offset, top } per day section (top = the section's distance from
    // the top of the scrolled content, offset 0 = Today = 0). A day is active
    // once its divider has reached the top edge of the visible list (within
    // `threshold` px, so a divider that is a hair short still counts); the
    // LAST such day wins. Pure so Jest can pin it: the DOM measuring lives in
    // js/ui/dayPagerView.js.
    // ---------------------------------------------------------------------
    const SCROLL_ACTIVE_THRESHOLD_PX = 8;

    function activeOffsetFromTops(tops, scrollTop, threshold) {
        const slack = (typeof threshold === 'number') ? threshold : SCROLL_ACTIVE_THRESHOLD_PX;
        const list = (tops || [])
            .filter(e => e && Number.isFinite(e.offset) && Number.isFinite(e.top))
            .slice()
            .sort((a, b) => a.offset - b.offset);
        if (list.length === 0) return 0;
        const y = Number.isFinite(scrollTop) ? scrollTop : 0;
        let active = list[0].offset;
        for (const entry of list) {
            if (entry.top <= y + slack) active = entry.offset;
        }
        return active;
    }

    return {
        MIN_OFFSET,
        MAX_OFFSET,
        SCROLL_ACTIVE_THRESHOLD_PX,
        activeOffsetFromTops,
        clampDayOffset,
        dayBoundsForOffset,
        conjureHabitGhosts,
        conjureTaskGhosts,
        existingItemsForDay,
        conjureGhostsForDay,
        outcomeForHabitOnDay,
        outcomeForTaskOnDay,
        scheduledHabitsForYesterday,
        scheduledTasksForYesterday,
        existingItemOutcomesForDay,
        doneTimeForEntry,
        conjureYesterdaySnapshot,
        weekStripSummary,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayPager;
}
