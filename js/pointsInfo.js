/**
 * PointsInfo -- player-facing words and numbers for "how do points work"
 * (2026-11-02, Jeremy: "where can we put info about how the points work").
 *
 * DISPLAY ONLY. Nothing here awards, refunds or changes a point; every rule
 * below is read from CONFIG and the real award code (Economy.taskPoints,
 * Habits.pointsMultiplier, items.js ghostAdjustedPoints), so the words can
 * never drift from the numbers. Same pattern as economy.js / habits.js: pure
 * functions, no DOM, no closures over script.js state; collaborators
 * (Habits) is a bare stable global loaded before this file's callers run and
 * required explicitly in tests.
 *
 *   PointsInfo.rulesLines(config)               -> string[]   Shop (i) panel
 *   PointsInfo.habitBonusInfo(habitDef, config) -> { multiplier, done, recorded,
 *                                                    next, line, tag }
 *   PointsInfo.habitPointsNow(habitDef, config) -> whole points one completion pays
 *   PointsInfo.routineBonusSummary(routine, definedHabits, definedTasks, config)
 *                                               -> { habits, priorityTasks, line }  ('' = no bonus)
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
        const slots = config.PRIORITY_SLOTS_PER_DAY != null ? config.PRIORITY_SLOTS_PER_DAY : 3;
        lines.push(`Priority tasks pay double (${slots} priority ${plural(slots, 'slot')} a day).`);
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
        // Goals (Jeremy, 2026-11-05): shown once CONFIG.GOAL_REWARDS exists. No XP: a bonus on the points a period earned, plus an Earned Sick Day.
        const goalLine = goalRewardLine(config);
        if (goalLine) lines.push(goalLine);
        return lines;
    }

    function goalRewardLine(config) {
        const r = config && config.GOAL_REWARDS;
        if (!r || !r.periodBonusPct) return '';
        const pct = (n) => Math.round(n * 100) + '%';
        const b = r.periodBonusPct;
        const item = r.item && r.item.itemId && (config.SHOP_ITEMS || []).find(i => i.id === r.item.itemId);
        let line = `A repeating goal you meet pays a bonus on the points you earned in that period: ${pct(b.day)} for a day, ${pct(b.week)} for a week, ${pct(b.month)} for a month, up to ${pct(r.streakBonusCap)} more for a streak.`;
        if (item) line += ` A finished one-time goal or a monthly goal met earns an ${item.name}, which you keep between runs.`;
        return line;
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

    // The Manage Routine "Bonus:" chip (2026-11-02, Jeremy: show a bonus only when one is being applied, no
    // totals). Counts the routine's habits that currently pay x2 / x3 (archived ones skipped) and its
    // high-priority tasks (x2). Returns { habits: { 3: n, 2: n }, priorityTasks: n, line } and line '' when
    // nothing in the routine earns a bonus, so the caller renders nothing.
    function routineBonusSummary(routine, definedHabits, definedTasks, config) {
        const habitIds = new Set((routine && routine.habitDefinitionIds) || []);
        const byMult = {};
        (definedHabits || []).forEach((h) => {
            if (!h || !habitIds.has(h.id) || h.archivedAt) return;
            const m = habitBonusInfo(h, config).multiplier;
            if (m > 1) byMult[m] = (byMult[m] || 0) + 1;
        });
        // Priority slots (2026-11-04): routine task templates no longer carry priority, so only habits earn a Bonus here.
        const priorityTasks = 0;
        const parts = Object.keys(byMult).map(Number).sort((x, y) => y - x)
            .map(m => `${byMult[m]} ${plural(byMult[m], 'habit')} \u00D7${m}`);
        if (priorityTasks > 0) parts.push(`${priorityTasks} ${plural(priorityTasks, 'task')} \u00D72`);
        return { habits: byMult, priorityTasks, line: parts.length ? `Bonus: ${parts.join(' \u00B7 ')}` : '' };
    }

    return { rulesLines, goalRewardLine, habitBonusInfo, habitPointsNow, routineBonusSummary };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PointsInfo;
}
