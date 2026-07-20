/**
 * StatsView — the Stats window opened from the FAB menu's 5th item
 * (RUN_HISTORY_PLAN.md sub-session 3, 2026-07-19).
 *
 * Renders the live current-run panel (days survived so far, counters,
 * top-3 blame) and past-run cards from runHistory (already newest-first —
 * see RunStats.appendToHistory). Pure DOM construction from data passed in
 * via deps, no closures over script.js state — same pattern as
 * managementWindows.js / shopView.js. All the actual math (blame sorting,
 * totals, run records) lives in js/runStats.js; this file only formats it.
 *
 * Read-only window — no buttons that mutate state, so this sub-session
 * doesn't need the setTimeout(0) rebuild-after-click deferral that
 * shopView.js's Buy/Use buttons need (see managementWindows.js header +
 * script.js's handleShopPurchase comment for that hazard). If a future
 * sub-session (4/5 in RUN_HISTORY_PLAN.md) adds an in-window action button
 * (e.g. an expandable run card), re-check that hazard before wiring it.
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

    // deps: { currentRunStats, runHistory, daysSurvivedSoFar }
    function renderStatsWindow(deps) {
        const currentPanel = document.getElementById('statsCurrentPanel');
        const historyList = document.getElementById('statsHistoryList');
        if (!currentPanel || !historyList) return;

        const runHistory = deps.runHistory || [];
        const currentRunNumber = runHistory.length + 1;

        currentPanel.innerHTML = buildCurrentRunPanel({
            currentRunStats: deps.currentRunStats,
            daysSurvivedSoFar: deps.daysSurvivedSoFar,
            currentRunNumber,
        });

        if (runHistory.length === 0) {
            historyList.innerHTML = '<div class="stats-empty">No past runs yet — this is your first.</div>';
            return;
        }

        historyList.innerHTML = runHistory.map(buildRunCard).join('');
    }

    return {
        formatDate,
        buildBlameList,
        buildCurrentRunPanel,
        buildRunCard,
        renderStatsWindow,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsView;
}
