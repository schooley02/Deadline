/**
 * StatsView — the Stats window opened from the FAB menu's 5th item
 * (RUN_HISTORY_PLAN.md sub-session 3, 2026-07-19; Routine Performance
 * section added sub-session 4, 2026-07-19/20 session 55).
 *
 * Renders the live current-run panel (days survived so far, counters,
 * top-3 blame), past-run cards from runHistory (already newest-first —
 * see RunStats.appendToHistory), and a per-routine rollup section (the
 * A/B comparison surface session 52 designed — routine rows across recent
 * runs, via RunStats.rollupRoutinePerformance). Pure DOM construction from
 * data passed in via deps, no closures over script.js state — same pattern
 * as managementWindows.js / shopView.js. All the actual math (blame
 * sorting, totals, run records, rollup grouping) lives in js/runStats.js;
 * this file only formats it.
 *
 * Read-only window — no buttons that mutate state, so this sub-session
 * doesn't need the setTimeout(0) rebuild-after-click deferral that
 * shopView.js's Buy/Use buttons need (see managementWindows.js header +
 * script.js's handleShopPurchase comment for that hazard). If a future
 * sub-session (5, optional polish) adds an in-window action button (e.g.
 * an expandable run card), re-check that hazard before wiring it.
 */
const StatsView = (() => {

    function formatDate(ms) {
        if (typeof ms !== 'number') return '';
        return new Date(ms).toLocaleDateString([], { dateStyle: 'medium' });
    }

    // Shared blame-row renderer for both the live panel and past-run cards.
    // `rows` is already sorted damage-desc (RunStats.sortedBlame / the
    // frozen record's .blame) — this just takes the top N and formats them.
    function buildBlameList(rows, limit) {
        const top = (rows || []).slice(0, limit);
        if (top.length === 0) {
            return '<div class="stats-empty">No damage taken yet</div>';
        }
        const items = top.map(row => `
            <li>
                <span class="stats-blame-name">${row.name}</span>
                <span class="stats-blame-meta">${row.category || ''}${row.isHabit ? ' · habit' : ''}</span>
                <span class="stats-blame-damage">-${row.totalDamage} dmg</span>
            </li>
        `).join('');
        return `<ul class="stats-blame-list">${items}</ul>`;
    }

    // deps: { currentRunStats, daysSurvivedSoFar, currentRunNumber }
    function buildCurrentRunPanel(deps) {
        const stats = deps.currentRunStats || RunStats.freshRunStats();
        const blameRows = RunStats.sortedBlame(stats.blame);

        return `
            <div class="stats-current-panel">
                <h4>Run #${deps.currentRunNumber} — in progress</h4>
                <div class="stats-days-survived">${deps.daysSurvivedSoFar} day${deps.daysSurvivedSoFar === 1 ? '' : 's'} survived so far</div>
                <div class="stats-counter-row">
                    <div class="stats-counter">
                        <span class="stats-counter-value">${stats.tasksCompleted}</span>
                        <span class="stats-counter-label">Tasks done</span>
                    </div>
                    <div class="stats-counter">
                        <span class="stats-counter-value">${stats.habitsCompleted}</span>
                        <span class="stats-counter-label">Habits done</span>
                    </div>
                    <div class="stats-counter">
                        <span class="stats-counter-value">${stats.habitsMissed}</span>
                        <span class="stats-counter-label">Habits missed</span>
                    </div>
                    <div class="stats-counter">
                        <span class="stats-counter-value">${stats.pointsEarned}</span>
                        <span class="stats-counter-label">Points earned</span>
                    </div>
                </div>
                <div class="stats-blame-heading">Top offenders so far</div>
                ${buildBlameList(blameRows, 3)}
            </div>
        `;
    }

    // One past-run card. `record` is a frozen runRecord (RunStats.finalizeRun
    // shape) — record.blame is already sorted damage-desc.
    function buildRunCard(record) {
        return `
            <li class="stats-run-card">
                <div class="stats-run-card-header">
                    <span class="stats-run-card-title">Run #${record.runNumber} — ${record.daysSurvived} day${record.daysSurvived === 1 ? '' : 's'}</span>
                    <span class="stats-run-card-date">${formatDate(record.endedAtMs)}</span>
                </div>
                <div class="stats-run-card-totals">
                    ${record.totals.tasksCompleted} tasks · ${record.totals.habitsCompleted} habits ·
                    ${record.totals.habitsMissed} missed · ${record.totals.pointsEarned} pts
                </div>
                ${buildBlameList(record.blame, 3)}
            </li>
        `;
    }

    // Completion rate is a 0-1 fraction or null (routine not yet rated —
    // see RunStats.finalizeRun/Heroes.completionRate). '—' matches the
    // existing "unrated" convention (HeroesView's star display).
    function formatCompletionRate(rate) {
        return (typeof rate === 'number') ? `${Math.round(rate * 100)}%` : '—';
    }

    function formatStars(stars) {
        return (typeof stars === 'number') ? `${stars}★` : '—';
    }

    // One row = one routine's performance in one past run.
    function buildRoutineEntryRow(entry) {
        const statusBadges = [
            entry.wasKOdAtEnd ? '<span class="stats-routine-badge stats-routine-badge-ko">KO\'d</span>' : '',
            entry.wasFrozenAtEnd ? '<span class="stats-routine-badge stats-routine-badge-frozen">Frozen</span>' : '',
        ].join('');
        return `
            <li>
                <span class="stats-routine-run">Run #${entry.runNumber}</span>
                <span class="stats-routine-metric">Lv${entry.level} ${formatStars(entry.stars)}</span>
                <span class="stats-routine-metric">${formatCompletionRate(entry.completionRate)}</span>
                <span class="stats-routine-metric stats-routine-damage">-${entry.memberDamage} dmg</span>
                ${statusBadges}
            </li>
        `;
    }

    // One card per routine — its entries are already newest-first, capped
    // per routine by RunStats.rollupRoutinePerformance's maxRunsPerRoutine.
    function buildRoutineCard(group) {
        const rows = group.entries.map(buildRoutineEntryRow).join('');
        return `
            <li class="stats-routine-card">
                <div class="stats-routine-card-title">${group.name}</div>
                <ul class="stats-routine-entry-list">${rows}</ul>
            </li>
        `;
    }

    // deps: { runHistory }
    function buildRoutineRollupSection(deps) {
        const runHistory = deps.runHistory || [];
        const groups = RunStats.rollupRoutinePerformance(runHistory, CONFIG.ROUTINE_ROLLUP_MAX_RUNS);
        if (groups.length === 0) {
            return '<div class="stats-empty">No routine performance data yet — finish a run with active routines.</div>';
        }
        return `<ul class="stats-routine-list">${groups.map(buildRoutineCard).join('')}</ul>`;
    }

    // ---- Achievements badge grid (ACHIEVEMENTS_PLAN.md sub-session 3,
    // 2026-07-20 session 66). Read-only cards from the catalog
    // (CONFIG.ACHIEVEMENTS) + lifetimeStats + the persisted unlocked-tier
    // map — all passed in via deps, never read from globals inside the
    // builders (same rule js/achievements.js follows). Falsy tier labels
    // (back_in_black's single unnamed tier) are omitted, not rendered —
    // same fix as session 65's unlock toast.

    function badgeTitle(familyName, label) {
        return label ? `${familyName} — ${label}` : familyName;
    }

    // One tier = one card. Unlocked: badge + date. Locked: greyed +
    // progress bar off the family's lifetimeStats metric ("184/250").
    function buildAchievementCard(family, tier, statValue, unlockedIso) {
        const value = (typeof statValue === 'number') ? statValue : 0;
        const title = badgeTitle(family.name, tier.label);
        if (unlockedIso) {
            return `
                <li class="stats-badge-card stats-badge-unlocked">
                    <span class="stats-badge-icon">🏅</span>
                    <span class="stats-badge-title">${title}</span>
                    <span class="stats-badge-date">Unlocked ${formatDate(Date.parse(unlockedIso))}</span>
                </li>
            `;
        }
        const threshold = tier.threshold || 1;
        const pct = Math.max(0, Math.min(100, Math.floor((value / threshold) * 100)));
        return `
            <li class="stats-badge-card stats-badge-locked">
                <span class="stats-badge-icon stats-badge-icon-locked">🔒</span>
                <span class="stats-badge-title">${title}</span>
                <span class="stats-badge-progress-track"><span class="stats-badge-progress-fill" style="width: ${pct}%"></span></span>
                <span class="stats-badge-progress-label">${value}/${tier.threshold}</span>
            </li>
        `;
    }

    // One family block: name heading + one card per tier (authored
    // ascending in the catalog, rendered in that order).
    function buildAchievementFamily(family, lifetimeStats, unlocked) {
        const stats = lifetimeStats || {};
        const seen = unlocked || {};
        const cards = (family.tiers || []).map(tier =>
            buildAchievementCard(family, tier, stats[family.metric], seen[tier.id])
        ).join('');
        return `
            <li class="stats-badge-family">
                <div class="stats-badge-family-name">${family.name}</div>
                <ul class="stats-badge-grid">${cards}</ul>
            </li>
        `;
    }

    // deps: { catalog, lifetimeStats, achievements }
    function buildAchievementsSection(deps) {
        const catalog = deps.catalog || [];
        if (catalog.length === 0) {
            return '<div class="stats-empty">No achievements defined.</div>';
        }
        return `<ul class="stats-badge-family-list">${catalog.map(family =>
            buildAchievementFamily(family, deps.lifetimeStats, deps.achievements)
        ).join('')}</ul>`;
    }

    // deps: { currentRunStats, runHistory, daysSurvivedSoFar,
    //         achievementsCatalog, lifetimeStats, achievements }
    function renderStatsWindow(deps) {
        const currentPanel = document.getElementById('statsCurrentPanel');
        const historyList = document.getElementById('statsHistoryList');
        const routineRollup = document.getElementById('statsRoutineRollup');
        if (!currentPanel || !historyList) return;

        const runHistory = deps.runHistory || [];
        const currentRunNumber = runHistory.length + 1;

        currentPanel.innerHTML = buildCurrentRunPanel({
            currentRunStats: deps.currentRunStats,
            daysSurvivedSoFar: deps.daysSurvivedSoFar,
            currentRunNumber,
        });

        historyList.innerHTML = (runHistory.length === 0)
            ? '<div class="stats-empty">No past runs yet — this is your first.</div>'
            : runHistory.map(buildRunCard).join('');

        if (routineRollup) {
            routineRollup.innerHTML = buildRoutineRollupSection({ runHistory });
        }

        const achievementsEl = document.getElementById('statsAchievements');
        if (achievementsEl) {
            achievementsEl.innerHTML = buildAchievementsSection({
                catalog: deps.achievementsCatalog,
                lifetimeStats: deps.lifetimeStats,
                achievements: deps.achievements,
            });
        }
    }

    return {
        formatDate,
        formatCompletionRate,
        formatStars,
        buildBlameList,
        buildCurrentRunPanel,
        buildRunCard,
        buildRoutineEntryRow,
        buildRoutineCard,
        buildRoutineRollupSection,
        badgeTitle,
        buildAchievementCard,
        buildAchievementFamily,
        buildAchievementsSection,
        renderStatsWindow,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsView;
}
