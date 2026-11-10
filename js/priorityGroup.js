/**
 * priorityGroup.js -- the "Priority (N)" group at the top of Today's agenda list
 * (Jeremy, 2026-11-10; DECISIONS 2026-11-10 (priority group); docs/UI_UX.md "Priority group").
 *
 * Anything marked Priority is lifted into its own group above the other rows so the player's three
 * most important things are always the first thing they read. DISPLAY ONLY, exactly like the "Started (N)"
 * group (js/startedMarker.js): ListOrder, the canvas layering and the saved hand order are untouched.
 *
 * Who is in it (a TOP-LEVEL row only; sub-tasks never get their own row):
 *   - a task with `isHighPriority`, and
 *   - due today or earlier (overdue priority tasks stay in it). A priority task due on a LATER day is not
 *     today's: priority slots belong to the due day (DECISIONS 2026-11-04 (priority slots)).
 * A sub-task marked priority on its own does not move its parent. Habits have no priority concept.
 *
 * Order inside the group is the list's own order (due time, hand order). In the list the groups run
 * Priority, then Started, then "By due time"; a row shows once, in the first group it qualifies for.
 *
 * PURE: no DOM, no State. js/ui/agendaList.js splits the rows and draws the heading.
 */
const PriorityGroup = (() => {
    function ms(d) {
        if (d instanceof Date) return d.getTime();
        if (d === null || d === undefined || d === '') return NaN;
        return new Date(d).getTime();
    }

    // endOfTodayMs = the first instant AFTER today (exclusive). A row with no usable due time counts as today's.
    function inGroup(row, endOfTodayMs) {
        if (!row || row.parentId || row.type !== 'task' || !row.isHighPriority) return false;
        if (!isFinite(endOfTodayMs)) return true;
        const due = ms(row.dueDateTime);
        return !isFinite(due) || due < endOfTodayMs;
    }

    // rows = the agenda's top-level rows in list order. Returns { priority, rest }, each keeping that order.
    function split(rows, endOfTodayMs) {
        const priority = [];
        const rest = [];
        (rows || []).forEach(r => (inGroup(r, endOfTodayMs) ? priority : rest).push(r));
        return { priority, rest };
    }

    return { inGroup, split };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriorityGroup;
}
