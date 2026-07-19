/**
 * Hud — player displays, level-up message, task count, debug panel
 * (Milestone 2 UI extraction, session 2, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster G — the
 * smallest, lowest-risk cluster, chosen to confirm the extraction pattern
 * before the larger UI sessions. No closures over script.js state: every
 * function takes an explicit deps object for the state/DOM it reads, same
 * pattern as damage.js/habits.js/routines.js. script.js keeps thin wrappers
 * at all original call sites — behavior-identical, no call site changed.
 *
 * showDebugInfo is extracted as-is even though it currently has ZERO call
 * sites anywhere in script.js (verified by Grep) — dead code, but in scope
 * per the plan's cluster boundary. Not removed here; flagging only, per the
 * "ONE roadmap task per session" guardrail (removing dead code is a
 * different decision than moving it).
 */
const Hud = (() => {

    // ---------------------------------------------------------------------
    // Player stat displays
    // ---------------------------------------------------------------------

    // Pure: how many pointsPerTask-sized tasks would it take to bring a
    // negative balance back to >= 0. Rounds UP (a partial task still leaves
    // debt) — no new tunable, derived from the existing pointsPerTask value.
    // Returns 0 for a non-negative balance or a non-positive pointsPerTask
    // (defensive; the caller only invokes this when points < 0).
    function tasksToBreakEven(points, pointsPerTask) {
        if (points >= 0 || !(pointsPerTask > 0)) return 0;
        return Math.ceil(Math.abs(points) / pointsPerTask);
    }

    // deps: { playerXP, playerLevel, playerPoints, routineSlots, pointsPerTask,
    //         playerXpDisplay, playerLevelDisplay, playerPointsDisplay,
    //         totalRoutineSlotsDisplay, playerPointsStat?, playerPointsNudge? }
    //
    // Negative-balance styling + agency-framed nudge ([P1-DATA-005]
    // sub-session 3, 2026-07-19). Debt only happens via negative-habit
    // indulgence (Economy.applyIndulgenceCost is the only non-clamping
    // debit path) — rendered in red with "complete N tasks to break even"
    // so it reads as fixable rather than purely punitive. playerPointsStat/
    // playerPointsNudge are optional so tests/older markup degrade cleanly.
    function updatePlayerDisplays(deps) {
        if (deps.playerXpDisplay) deps.playerXpDisplay.textContent = deps.playerXP;
        if (deps.playerLevelDisplay) deps.playerLevelDisplay.textContent = deps.playerLevel;
        if (deps.playerPointsDisplay) deps.playerPointsDisplay.textContent = deps.playerPoints;
        if (deps.totalRoutineSlotsDisplay) deps.totalRoutineSlotsDisplay.textContent = deps.routineSlots;

        const inDebt = deps.playerPoints < 0;
        if (deps.playerPointsStat) deps.playerPointsStat.classList.toggle('points-negative', inDebt);
        if (deps.playerPointsNudge) {
            if (inDebt) {
                const n = tasksToBreakEven(deps.playerPoints, deps.pointsPerTask);
                deps.playerPointsNudge.textContent = n > 0
                    ? ` · complete ${n} task${n !== 1 ? 's' : ''} to break even`
                    : '';
                deps.playerPointsNudge.classList.remove('hidden');
            } else {
                deps.playerPointsNudge.textContent = '';
                deps.playerPointsNudge.classList.add('hidden');
            }
        }
    }

    // deps: { activeItems, taskCountDisplay }
    function updateTaskCountDisplay(deps) {
        // Only count top-level tasks (not sub-tasks) in the display
        const taskCount = deps.activeItems.filter(item => !item.parentId).length;
        if (deps.taskCountDisplay) {
            deps.taskCountDisplay.textContent = `${taskCount} task${taskCount !== 1 ? 's' : ''}`;
        }
    }

    // ---------------------------------------------------------------------
    // Level-up message
    // ---------------------------------------------------------------------

    // deps: { playerLevel, levelUpMessage }
    function showLevelUpMessage(deps) {
        if (!deps.levelUpMessage) return;
        deps.levelUpMessage.textContent = `LEVEL ${deps.playerLevel}!`;
        deps.levelUpMessage.classList.remove('hidden');
        setTimeout(() => {
            deps.levelUpMessage.classList.add('hidden');
        }, 2500);
    }

    // ---------------------------------------------------------------------
    // Debug panel (currently unreferenced anywhere in script.js — see file
    // header)
    // ---------------------------------------------------------------------

    // No script.js state deps beyond the document itself — creates/reuses a
    // fixed-position debug panel and appends a timestamped entry.
    function showDebugInfo(functionName, data) {
        let debugDisplay = document.getElementById('debugDisplay');
        if (!debugDisplay) {
            debugDisplay = document.createElement('div');
            debugDisplay.id = 'debugDisplay';
            debugDisplay.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                max-width: 300px;
                z-index: 10000;
                max-height: 200px;
                overflow-y: auto;
            `;
            document.body.appendChild(debugDisplay);
        }

        const timestamp = new Date().toLocaleTimeString();
        const debugEntry = document.createElement('div');
        debugEntry.style.cssText = 'margin-bottom: 5px; padding: 2px; border-bottom: 1px solid #333;';
        debugEntry.innerHTML = `
            <strong>[${timestamp}] ${functionName}</strong><br>
            ${Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('<br>')}
        `;

        debugDisplay.appendChild(debugEntry);

        // Keep only last 10 entries
        while (debugDisplay.children.length > 10) {
            debugDisplay.removeChild(debugDisplay.firstChild);
        }
    }

    return {
        tasksToBreakEven,
        updatePlayerDisplays,
        updateTaskCountDisplay,
        showLevelUpMessage,
        showDebugInfo,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Hud;
}
