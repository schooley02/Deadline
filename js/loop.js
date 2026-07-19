/**
 * Loop — the per-tick game loop (Milestone 2 extraction, session 12, 2026-07-18).
 *
 * `updateGame` (the setInterval callback) and `updateActiveItems` (position +
 * overdue-damage tick) moved here from script.js — the last real game logic
 * that lived in the monolith. Same deps pattern as items.js/state.js: script.js
 * keeps thin wrappers and owns the state; everything crosses in via a single
 * `loopDeps()` accessor object rebuilt fresh on every call.
 *
 * Deps contract (see script.js loopDeps()):
 *   - isGameOver()/isOfflineCatchUpActive(): getters — both flip mid-run.
 *   - activeItems: plain reference (itemsDeps()/agendaListDeps() precedent;
 *     safe because deps are rebuilt per call, so reassignment can't go stale).
 *   - baseWidth: plain value, rebuilt per call (not resolved until initGame()).
 *   - gameScreenWidth: plain value ([P1-DATA-005] session 29 — the negative-
 *     habit lurker's fixed x anchors to the far right of the canvas).
 *   - getLastLoopTickMs/setLastLoopTickMs, getLastAutosaveMs/setLastAutosaveMs,
 *     getLastRegenTickMs/setLastRegenTickMs ([P2-GAME-012], 2026-07-18):
 *     get/set pairs for script.js-owned timing state this module WRITES
 *     (damage.js baseHealth precedent).
 *   - collaborators: markAsOverdue, getSubTaskClusterOffset,
 *     calculateTimelineXWithClustering, damageBase, healBase
 *     ([P2-GAME-012]), updateMidnightLine, runLiveGapCatchUp, saveGame,
 *     isNonThreatening ([P1-DATA-005] session 27 — Items.isNonThreatening,
 *     injected rather than referenced as a bare global since Items loads
 *     AFTER this file; see items.js's header comment).
 * CONFIG is read as a bare stable global (movement.js/clock.js precedent).
 */
const Loop = (() => {

    function updateActiveItems(deps) {
        if (deps.isGameOver()) return;
        // catch-up animation owns positions/damage until it completes
        if (deps.isOfflineCatchUpActive()) return;

        const currentTime = new Date();
        const currentTimeMs = currentTime.getTime();

        // Gradual base regen ([P2-GAME-012]) — same remainder-preserving tick
        // shape as the per-item damage tick below, but base-wide rather than
        // per-item. First call after a fresh game/restore has no prior tick
        // to measure from, so it just plants the clock rather than granting
        // a free heal for elapsed time it never actually covered (that time
        // is already accounted for separately, via applyElapsedRegen on
        // restore/gap catch-up).
        const lastRegen = deps.getLastRegenTickMs();
        if (lastRegen === null) {
            deps.setLastRegenTickMs(currentTimeMs);
        } else if (currentTimeMs >= lastRegen + CONFIG.BASE_REGEN_INTERVAL_MS) {
            deps.healBase(CONFIG.BASE_REGEN_HP);
            deps.setLastRegenTickMs(lastRegen + CONFIG.BASE_REGEN_INTERVAL_MS);
        }

        for (let i = deps.activeItems.length - 1; i >= 0; i--) {
            const item = deps.activeItems[i];

            // [P1-DATA-005] session 27, repositioned session 29 — a
            // negative-habit lurker never advances, never goes overdue,
            // never damages the base (the A2 model — see DECISIONS.md
            // sessions 26/29). It sits at a fixed position anchored to the
            // far right of the canvas (not near the base — parking a
            // stationary, non-threatening item near the base misrepresented
            // it as an imminent threat) instead of a timeline position.
            // Skips BOTH the overdue-transition branch below AND the
            // damage-tick branch entirely.
            if (deps.isNonThreatening && deps.isNonThreatening(item)) {
                item.x = deps.gameScreenWidth - CONFIG.HABIT_ENEMY_WIDTH - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX;
                if (item.element) item.element.style.left = item.x + 'px';
                continue;
            }

            if (!item.isOverdue) {
                if (item.dueDateTime <= currentTime) {
                    // Item just became overdue
                    item.x = deps.baseWidth + deps.getSubTaskClusterOffset(item);
                    deps.markAsOverdue(item, currentTime);
                } else {
                    // Calculate position based on timeline
                    item.x = deps.calculateTimelineXWithClustering(item, currentTime);
                }

                // Update visual position
                if (item.element) {
                    item.element.style.left = Math.max(deps.baseWidth, item.x) + 'px';
                }
            }

            // Handle damage from overdue items
            if (item.isOverdue) {
                if (currentTimeMs >= item.lastDamageTickTime + CONFIG.DAMAGE_INTERVAL_MS) {
                    deps.damageBase(CONFIG.OVERDUE_DAMAGE);
                    item.lastDamageTickTime += CONFIG.DAMAGE_INTERVAL_MS;

                    if (deps.isGameOver()) break;
                }
            }
        }

        deps.updateMidnightLine(currentTime);
    }

    function updateGame(deps) {
        if (deps.isGameOver()) return;

        const nowMs = Date.now();

        // Detect a suspended loop before ticking, so the damage catch-up is
        // capped rather than replayed one interval per frame.
        const lastTick = deps.getLastLoopTickMs();
        if (lastTick !== null && (nowMs - lastTick) >= CONFIG.LIVE_GAP_THRESHOLD_MS) {
            deps.runLiveGapCatchUp();
        }
        deps.setLastLoopTickMs(nowMs);

        if (deps.isGameOver()) return; // catch-up may have ended the run

        updateActiveItems(deps);

        if (nowMs - deps.getLastAutosaveMs() >= CONFIG.PERSISTENCE_AUTOSAVE_MS) {
            deps.setLastAutosaveMs(nowMs);
            deps.saveGame();
        }
    }

    return {
        updateActiveItems,
        updateGame,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Loop;
}
