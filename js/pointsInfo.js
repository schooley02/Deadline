/**
 * PointsInfo -- player-facing words and numbers for "how do points work"
 * (2026-11-02, Jeremy: "where can we put info about how the points work").
 *
 * DISPLAY ONLY. Nothing here awards, refunds or changes a point; every rule
 * below is read from CONFIG and the real award code (Economy.taskPoints,
 * Habits.pointsMultiplier, items.js ghostAdjustedPoints), so the words can
 * never drift from the numbers. Same pattern as economy.js / habits.js: pure
 * functions, no DOM, no closures over script.js state; collaborators
 * (Economy, Habits, Routines, DayPager) are bare stable globals loaded before
 * this file in index.html and required explicitly in tests.
 *
 *   PointsInfo.rulesLines(config)               -> string[]   Shop (i) panel
 *   PointsInfo.habitBonusInfo(habitDef, config) -> { multiplier, done, recorded,
 *                                                    next, line, tag }
 *   PointsInfo.habitPointsNow(habitDef, config) -> whole points one completion pays
 *   PointsInfo.routineDayEarning(args)          -> { kind, pts, done, total, line } | null
 *
 * routineDayEarning args: { routine, offset, referenceTime, config,
 *   deps: { definedHabits, definedRoutines, definedTasks, activeItems,
 *           completedItems, sickDayDate } }
 *   offset -1 (yesterday) returns null: the daily record keeps per-routine
 *   done COUNTS but not per-routine points, so "earned" can't be shown honestly.
 */
const PointsInfo = (() => {
    function plural(n, word) { return n === 1 ? word : word + 's'; }

    // Tiers sorted low -> high multiplier, so sentences read 2x then 3x.
    function sortedTiers(config) {
        return (config.HABIT_RATE_TIERS || []).slice().sort((a, b) => a.multiplier - b.multiplier);
    }

    function tierRequirementText(tier, windowSize) {
        return tier.minRate >= 1
            ? `all ${windowSize}`
            : `${Math.round(tier.minRate * 100)}% or more of their last ${windowSize}`;
    }

    function rulesLines(config) {
        const windowSize = config.HABIT_RATE_WINDOW;
        const lines = [];
        const perTask = config.POINTS_PER_TASK;
        const perHabit = config.POINTS_PER_HABIT;
        lines.push(perTask === perHabit
            ? `Each task or habit you finish pays ${perTask} ${plural(perTask, 'point')}.`
            : `A task pays ${perTask} ${plural(perTask, 'point')}; a habit pays ${perHabit}.`);
        lines.push('High-priority tasks pay double.');
        if (config.SUBTASK_POINTS != null) {
            lines.push(`A task with sub-tasks pays through them instead: ${config.SUBTASK_POINTS} ${plural(config.SUBTASK_POINTS, 'point')} per sub-task, and the task itself pays nothing.`);
        }
        const tiers = sortedTiers(config);
        if (tiers.length > 0) {
            const parts = tiers.map(t => `×${t.multiplier} for ${tierRequirementText(t, windowSize)}`);
            lines.push(`Habits pay a bonus for a strong record: ${parts.join(', ')}. A habit pays ×1 until it has ${config.HABIT_RATE_MIN_SAMPLE} scheduled times on record.`);
        }
        if (config.KO_GHOST_POINTS_FACTOR === 0) {
            lines.push('Items in a knocked-out routine pay no points.');
        }
        return lines;
    }

    function rateConfig(config) {
        return { minSample: config.HABIT_RATE_MIN_SAMPLE, tiers: config.HABIT_RATE_TIERS };
    }

    function habitBonusInfo(habitDef, config) {
        const history = Array.isArray(habitDef && habitDef.occurrenceHistory) ? habitDef.occurrenceHistory : [];
        const recorded = history.length;
        const done = history.filter(o => o && o.success).length;
        const multiplier = Habits.pointsMultiplier(history, rateConfig(config));
        const minSample = config.HABIT_RATE_MIN_SAMPLE;
        const windowSize = config.HABIT_RATE_WINDOW;

        // The next tier up (smallest multiplier above the current one), and how many
        // of the window it takes. Only meaningful once the record is full.
        let next = null;
        if (recorded >= minSample) {
            const higher = sortedTiers(config).filter(t => t.multiplier > multiplier);
            if (higher.length > 0) {
                const t = higher[0];
                next = { multiplier: t.multiplier, needed: Math.ceil(t.minRate * recorded - 1e-9), of: recorded };
            }
        }

        let line;
        if (recorded < minSample) {
            line = `Pays ×1 · ${recorded} of ${minSample} times recorded (the bonus starts at ${minSample})`;
        } else {
            const verb = habitDef && habitDef.isNegative ? 'resisted' : 'done';
            line = `Pays ×${multiplier} · ${done} of last ${recorded} ${verb}`;
            if (next) line += ` · ×${next.multiplier} at ${next.needed}/${next.of}`;
        }
        return {
            multiplier, done, recorded, windowSize, next, line,
            tag: multiplier > 1 ? `×${multiplier}` : '',
        };
    }

    function habitPointsNow(habitDef, config) {
        const info = habitBonusInfo(habitDef, config);
        return Math.round(config.POINTS_PER_HABIT * info.multiplier);
    }

    // What one live (already spawned) item pays right now. A parent task that has
    // sub-tasks on the board pays 0 itself (items.js completeItem gate); a KO ghost
    // pays points x KO_GHOST_POINTS_FACTOR.
    function activeItemPoints(item, definedHabits, activeItems, config) {
        let pts;
        if (item.type === 'habit') {
            const def = (definedHabits || []).find(h => h.id === item.definitionId);
            pts = def ? habitPointsNow(def, config) : config.POINTS_PER_HABIT;
        } else if (item.parentId !== undefined && item.parentId !== null) {
            pts = Economy.taskPoints(item.isHighPriority, config.SUBTASK_POINTS);
        } else {
            const hasSubs = (activeItems || []).some(o => o.parentId === item.id);
            pts = hasSubs ? 0 : Economy.taskPoints(item.isHighPriority, config.POINTS_PER_TASK);
        }
        if (item.koGhost === true) pts = Math.round(pts * config.KO_GHOST_POINTS_FACTOR);
        return pts;
    }

    function dayWord(offset, dayStart) {
        if (offset === 0) return 'Today';
        if (offset === 1) return 'Tomorrow';
        return dayStart.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // How many of this routine's items were finished today: completed habit / routine-task instances whose
    // definition belongs to the routine, plus completed sub-tasks of those. Read from completedItems, NOT from
    // DailyRecord.rt: its per-routine tally only accepts numeric ids and real routine ids are strings
    // ("routine_0_1730..."), so rt stays empty in the real game.
    function doneTodayCount(routine, completedItems, activeItems, referenceTime) {
        const bounds = DayPager.dayBoundsForOffset(referenceTime, 0);
        const startMs = bounds.start.getTime();
        const endMs = bounds.end.getTime();
        const habitIds = new Set(routine.habitDefinitionIds || []);
        const taskIds = new Set(routine.taskDefinitionIds || []);
        const doneToday = (completedItems || []).filter((i) => {
            if (!i || !i.completedAt) return false;
            const t = new Date(i.completedAt).getTime();
            return t >= startMs && t < endMs;
        });
        const roots = doneToday.filter(i =>
            (i.type === 'habit' && habitIds.has(i.definitionId)) ||
            (i.type === 'task' && i.definitionId != null && taskIds.has(i.definitionId)));
        const rootIds = new Set(roots.map(i => i.id));
        // A sub-task belongs to the routine when its parent (done today, or still on the board) does.
        (activeItems || []).forEach((i) => {
            if (i.type === 'task' && i.definitionId != null && taskIds.has(i.definitionId)) rootIds.add(i.id);
        });
        const subs = doneToday.filter(i => i.parentId !== undefined && i.parentId !== null && rootIds.has(i.parentId));
        return roots.length + subs.length;
    }

    function routineDayEarning(args) {
        const { routine, offset, referenceTime, config, deps } = args;
        if (!routine || offset < 0) return null;
        const d = deps || {};
        const bounds = DayPager.dayBoundsForOffset(referenceTime, offset);
        const word = dayWord(offset, bounds.start);

        if (routine.isActive === false) {
            return { kind: 'off', pts: 0, done: 0, total: 0, line: `${word}: routine is off, so nothing is due` };
        }

        if (offset === 0) {
            const ids = new Set(Routines.selectActiveItemIdsToClearForRoutine(d.activeItems || [], routine));
            const items = (d.activeItems || []).filter(i => ids.has(i.id));
            const pts = items.reduce((sum, i) => sum + activeItemPoints(i, d.definedHabits, d.activeItems, config), 0);
            const done = doneTodayCount(routine, d.completedItems, d.activeItems, referenceTime);
            const total = done + items.length;
            if (routine.koState) {
                return { kind: 'ko', pts: 0, done, total, line: 'Today: knocked out, so finishing items pays 0 pts' };
            }
            if (total === 0) return { kind: 'today', pts: 0, done: 0, total: 0, line: 'Today: nothing due' };
            if (items.length === 0) return { kind: 'today', pts: 0, done, total, line: `Today: all ${total} done` };
            return {
                kind: 'today', pts, done, total,
                line: `Today: ${pts} ${plural(pts, 'pt')} left to earn · ${done} of ${total} done`,
            };
        }

        // Future day: what the pager would conjure for this routine, priced at the
        // multipliers the habits have today (a habit's tier on Thursday depends on
        // what happens before then).
        const ghosts = DayPager.conjureGhostsForDay(d, referenceTime, offset)
            .filter(g => g.routineId === routine.id);
        let pts = 0;
        ghosts.forEach((g) => {
            if (g.isHabit) {
                const def = (d.definedHabits || []).find(h => h.id === g.definitionId);
                pts += def ? habitPointsNow(def, config) : config.POINTS_PER_HABIT;
            } else {
                pts += Economy.taskPoints(g.isHighPriority, config.POINTS_PER_TASK);
            }
        });
        if (ghosts.length === 0) return { kind: 'future', pts: 0, done: 0, total: 0, line: `${word}: nothing due` };
        return {
            kind: 'future', pts, done: 0, total: ghosts.length,
            line: `${word}: up to ${pts} ${plural(pts, 'pt')} at current rates`,
        };
    }

    return { rulesLines, habitBonusInfo, habitPointsNow, activeItemPoints, routineDayEarning };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PointsInfo;
}
