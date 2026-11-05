/**
 * RunCarryover -- what survives when a run ends and the next one starts (pure core, built 2026-11-03;
 * decisions in docs/DECISIONS.md "Run-end carryover", plan in docs/RUN_CARRYOVER_PLAN.md).
 *
 * Jeremy's rule (2026-11-03): a player must not lose what they built or paid for just because the
 * church fell. Three things carry into the next run that used to reset with it:
 *
 *   1. OPEN ONE-OFF TASKS (and their sub-tasks). They are the player's real to-do list, not run
 *      progress: a task typed in by hand (type 'task', no definitionId) is kept with its due date,
 *      priority and sub-tasks. Habit instances, routine task instances and KO ghosts are NOT kept:
 *      the new run regenerates them from their definitions. A task already overdue starts the new
 *      run with a fresh damage clock (the church is not hit again the moment the run begins).
 *   2. ROUTINE SLOTS never drop below the most the player has ever earned (`bestRoutineSlots`, saved
 *      at the root of the save). Player level still resets to 1, so the Lv3 / 5 / 7 unlocks give
 *      nothing until the player passes their best; the routines they built stay usable from day one.
 *   3. HELD ITEMS that cannot be re-earned by playing (a shop row with `keptAcrossRuns: true`) stay
 *      until used. Today NO catalog row has the flag -- every item is bought with run points or
 *      gifted by a level perk / village star that the next run pays again -- so the whole inventory
 *      still resets. The flag is the hook for a future paid or one-time item.
 *
 * Everything else about the run still resets (full-reset decision of 2026-07-19, session 52, now
 * narrowed): church health, level, XP, points, run-earned items and perks, pushback charges, the
 * village, the sky, the run's daily records.
 *
 * Same pattern as runStats.js / villageProgress.js: pure functions, no DOM, no State or CONFIG reads
 * (the caller passes everything in), so it is unit-tested directly. The wiring lives in script.js
 * (the Restart button) and js/state.js (initGame / restore / the slots setter).
 */
const RunCarryover = (() => {

    // A hand-typed task: not a habit instance, not a routine task instance (those have a
    // definitionId), not a KO ghost (a knocked-out routine's faded leftovers).
    function isCarriedTask(item) {
        return !!item && item.type === 'task' && item.definitionId == null && item.koGhost !== true;
    }

    /**
     * The open items that carry into the next run, in their current order (parents stay before
     * their sub-tasks, which is what addItemToGame needs). A sub-task is kept only when its parent
     * is kept; an orphan sub-task (parent gone) is dropped with the run.
     */
    function openTasksToCarry(activeItems) {
        const items = Array.isArray(activeItems) ? activeItems : [];
        const keptIds = new Set();
        const out = [];
        items.forEach(item => {
            if (!isCarriedTask(item)) return;
            if (item.parentId) {
                if (!keptIds.has(item.parentId)) return;
            }
            keptIds.add(item.id);
            out.push(item);
        });
        return out;
    }

    /**
     * Strips what belongs to the old run's DOM and clock from a carried item so addItemToGame can
     * rebuild it in the new run. Mutates and returns the item (the same object stays the task, so
     * sub-tasks' parentId / subTasks references keep pointing at it).
     *   - element / listItemElement: the old run's nodes (initGame removed them).
     *   - urgencyTier: a render-diff cache for the old element (see restoreGameState).
     *   - lastDamageTickTime: an overdue task gets a fresh clock; addItemToGame sets it to now when
     *     it re-marks the item overdue, and the caller sets it again after (mirrors restore).
     */
    function detachForNewRun(item) {
        item.element = null;
        item.listItemElement = null;
        item.urgencyTier = null;
        if (item.isOverdue) item.lastDamageTickTime = null;
        return item;
    }

    /** Held items that survive the run: only catalog rows flagged `keptAcrossRuns: true`. */
    function inventoryToKeep(inventory, catalog) {
        const kept = {};
        if (!inventory || typeof inventory !== 'object') return kept;
        const rows = Array.isArray(catalog) ? catalog : [];
        Object.keys(inventory).forEach(id => {
            const count = inventory[id];
            if (typeof count !== 'number' || !isFinite(count) || count <= 0) return;
            const row = rows.find(r => r && r.id === id);
            if (row && row.keptAcrossRuns === true) kept[id] = count;
        });
        return kept;
    }

    /** The most slots ever held, as a safe integer (junk / absent = 0). */
    function sanitizeBestSlots(value) {
        return (typeof value === 'number' && isFinite(value) && value > 0) ? Math.floor(value) : 0;
    }

    /** Slot count for a run at `level`: the table's value, never below the player's best. */
    function slotsFor(level, bestSlots, table) {
        const fromTable = (table && table[level]) || 1;
        return Math.max(fromTable, sanitizeBestSlots(bestSlots));
    }

    /**
     * The card's "next run" facts. items: the live activeItems; routineSlots: the current slot count;
     * inventory + catalog: the held items; returns counts the view turns into two short lists.
     */
    function summary(ctx) {
        const c = ctx || {};
        const carried = openTasksToCarry(c.activeItems);
        const tasks = carried.filter(i => !i.parentId).length;
        const subTasks = carried.length - tasks;
        const kept = inventoryToKeep(c.inventory, c.catalog);
        const keptItems = Object.keys(kept).map(id => {
            const row = (c.catalog || []).find(r => r && r.id === id);
            return { id, name: row ? row.name : id, count: kept[id] };
        });
        const heldTotal = Object.keys(c.inventory || {}).reduce((n, id) => {
            const v = c.inventory[id];
            return n + ((typeof v === 'number' && isFinite(v) && v > 0) ? v : 0);
        }, 0);
        const keptTotal = keptItems.reduce((n, k) => n + k.count, 0);
        return {
            openTasks: tasks,
            openSubTasks: subTasks,
            routineSlots: Math.max(1, sanitizeBestSlots(c.routineSlots) || 1),
            keptItems,
            resetItems: Math.max(0, heldTotal - keptTotal),
            // Goals Build A (2026-11-05): goals carry across runs untouched; the count is for the game-over card's "You keep" line (Build B).
            goals: Array.isArray(c.goals) ? c.goals.length : 0,
        };
    }

    return {
        isCarriedTask,
        openTasksToCarry,
        detachForNewRun,
        inventoryToKeep,
        sanitizeBestSlots,
        slotsFor,
        summary,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RunCarryover;
}
