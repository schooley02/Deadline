/**
 * startedMarker.js -- "Started" marker for items whose Start time has arrived
 * (Jeremy, 2026-11-04; DECISIONS 2026-11-04 (started marker); docs/UI_UX.md "Started marker").
 *
 * A task with an early Start and a late Due used to sink to the bottom of the agenda (the list sorts by
 * due time) and stood idle in the parked pile at the church, so it was hard to find right when the player
 * meant to begin it. While an item is inside its work window [start, due) it now gets:
 *   - list: its top-level row moves into a "Started (N)" group pinned above the due-time rows
 *     (display only: ListOrder, the canvas layering and the saved order are untouched);
 *   - canvas: a stopwatch badge over the zombie plus a slow amber "breath" glow;
 *   - the moment the Start time passes live: a short ring burst on the zombie and a row flash.
 *
 * PURE: no DOM, no State. script.js applies the classes (applyMarkers) and agendaList.js splits the rows.
 *
 * States per item (stateFor):
 *   'none'     -- not inside its work window (or overdue, a KO ghost, a Break habit lurker, no window).
 *   'started'  -- inside the window, no timer running, started less than CONFIG.STARTED_BREATHE_MIN ago:
 *                 badge + breathing glow.
 *   'quiet'    -- inside the window, untouched for longer than that: badge + a held faint glow, no breath.
 *   'working'  -- inside the window with its timer RUNNING: the badge ticks, the glow holds steady.
 *
 * Group (inGroup): a top-level row joins "Started" while it, or one of its open sub-tasks, is in a work
 * window AND that window's due time is more than CONFIG.STARTED_GROUP_LEAVE_MIN away. Inside the last
 * stretch the row drops back into due order, where it is near the top anyway. The badge stays either way.
 */
const StartedMarker = (() => {
    function cfg() { return (typeof CONFIG !== 'undefined') ? CONFIG : {}; }
    function leaveMs(opts) {
        const m = (opts && typeof opts.leaveMin === 'number') ? opts.leaveMin
            : (typeof cfg().STARTED_GROUP_LEAVE_MIN === 'number' ? cfg().STARTED_GROUP_LEAVE_MIN : 60);
        return Math.max(0, m) * 60000;
    }
    function breatheMs(opts) {
        const m = (opts && typeof opts.breatheMin === 'number') ? opts.breatheMin
            : (typeof cfg().STARTED_BREATHE_MIN === 'number' ? cfg().STARTED_BREATHE_MIN : 10);
        return Math.max(0, m) * 60000;
    }
    function ms(d) {
        if (d instanceof Date) return d.getTime();
        if (d === null || d === undefined || d === '') return NaN;
        return new Date(d).getTime();
    }
    function timerRunning(item) {
        return !!(item && item.timer && typeof item.timer.startedAt === 'number'); // same rule as Timer.isRunning
    }

    // Inside [start, due), live and threatening-capable. Same window rule as Clock.isInWorkWindow, plus the
    // states that must never show a marker (overdue, KO ghost, Break habit lurker, completed).
    function isStarted(item, nowMs) {
        if (!item || item.isOverdue === true || item.koGhost || item.completed === true) return false;
        if (item.type === 'habit' && item.isNegative === true) return false;
        const s = ms(item.startDateTime);
        const d = ms(item.dueDateTime);
        if (!isFinite(s) || !isFinite(d) || s >= d) return false;
        return nowMs >= s && nowMs < d;
    }

    function stateFor(item, nowMs, opts) {
        if (!isStarted(item, nowMs)) return 'none';
        const running = (opts && typeof opts.isRunning === 'function') ? opts.isRunning(item) : timerRunning(item);
        if (running) return 'working';
        const sinceStart = nowMs - ms(item.startDateTime);
        return sinceStart < breatheMs(opts) ? 'started' : 'quiet';
    }

    // The started window (this item's own, or the earliest-due started sub-task's) that would place a
    // top-level row in the group; null when none.
    function groupWindow(row, items, nowMs) {
        if (!row || row.parentId) return null;
        const list = Array.isArray(items) ? items : [];
        const cands = [];
        if (isStarted(row, nowMs)) cands.push(row);
        const subIds = Array.isArray(row.subTasks) ? row.subTasks : [];
        subIds.forEach(id => {
            const sub = list.find(i => i && i.id === id);
            if (sub && isStarted(sub, nowMs)) cands.push(sub);
        });
        if (!cands.length) return null;
        cands.sort((a, b) => ms(a.dueDateTime) - ms(b.dueDateTime));
        return cands[0];
    }

    function inGroup(row, items, nowMs, opts) {
        const w = groupWindow(row, items, nowMs);
        if (!w) return false;
        return ms(w.dueDateTime) - nowMs > leaveMs(opts);
    }

    // rows = the agenda's top-level rows in list order. Returns { started, rest }, each keeping that order.
    function split(rows, items, nowMs, opts) {
        const started = [];
        const rest = [];
        (rows || []).forEach(r => (inGroup(r, items, nowMs, opts) ? started : rest).push(r));
        return { started, rest };
    }

    // A short string that changes whenever the group's membership changes, so script.js re-renders the
    // list only then (not every second).
    function groupKey(items, nowMs, opts) {
        const list = Array.isArray(items) ? items : [];
        return list.filter(i => i && !i.parentId && inGroup(i, list, nowMs, opts)).map(i => String(i.id)).sort().join(',');
    }

    // Row note under the name: "Started 1:00 PM" / "Sub-task started 1:00 PM" / "Working 0:42".
    // fmtTime(ms) and fmtElapsed(ms) are injected so the copy stays testable without locale quirks.
    function rowNote(row, items, nowMs, fmt) {
        const w = groupWindow(row, items, nowMs);
        if (!w) return '';
        const f = fmt || {};
        const time = typeof f.time === 'function' ? f.time(ms(w.startDateTime)) : new Date(ms(w.startDateTime)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const running = typeof f.isRunning === 'function' ? f.isRunning(w) : timerRunning(w);
        if (running && typeof f.elapsed === 'function') return `Working ${f.elapsed(w)}`;
        return w === row ? `Started ${time}` : `Sub-task started ${time}`;
    }

    // Arrival bursts: given the ids that were started on the previous live pass and the ones started now,
    // the ids that just crossed their Start time. `prev === null` = first pass (boot / back from a preview
    // baseline): nothing bursts.
    function arrivals(prevIds, nowIds) {
        if (!prevIds) return [];
        const prev = new Set(prevIds);
        return (nowIds || []).filter(id => !prev.has(id));
    }

    return { isStarted, stateFor, groupWindow, inGroup, split, groupKey, rowNote, arrivals };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StartedMarker;
}
