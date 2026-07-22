/**
 * Movement — timeline-based enemy positioning (Milestone 2 extraction, 2026-07-17).
 *
 * Pure-ish positioning math extracted from script.js (getVisibleEdges,
 * getSubTaskClusterOffset, calculateTimelineXWithClustering,
 * getItemTopPosition). Follows the clock.js pattern: functions that closed
 * over script.js's module-scoped state (the `activeItems` array, the
 * DOM-derived width `let`s, and `gameCanvas`) now take that state as an
 * explicit `ctx`/`dims` object instead of a shared closure. script.js keeps
 * thin wrappers at every original call site so nothing else changes.
 *
 * `CONFIG` and `Clock` stay as globals (loaded before this file in
 * index.html; require()'d in tests), matching clock.js's use of globals.
 *
 * Context shapes:
 *   getSubTaskClusterOffset(item, { activeItems, enemyWidth })
 *   calculateTimelineXWithClustering(item, currentTime, { activeItems, dims })
 *       dims = { gameScreenWidth, baseWidth, enemyWidth, habitEnemyWidth }  (for Clock)
 *   getItemTopPosition(item, itemHeight, { activeItems, canvasHeight, randomFn? })
 *   getParentGrowthScale(item) -> number       ([P1-DATA-004] sub-session 4, 2026-07-19;
 *       pure, no ctx — reads item.subTasks/CONFIG directly)
 *   getParentRenderWidth(item, baseWidth) -> px  (baseWidth * getParentGrowthScale)
 */
const Movement = (() => {
    // The sprite PNGs have big transparent margins (per-category fractions in
    // CONFIG.ZOMBIE_VISIBLE_MARGINS). Returns the visible graphic's left/right
    // edges in px, relative to the sprite box's left edge.
    function getVisibleEdges(category, boxWidth) {
        const m = CONFIG.ZOMBIE_VISIBLE_MARGINS[category] || CONFIG.ZOMBIE_VISIBLE_MARGIN_FALLBACK;
        return {
            left: boxWidth * m.left,
            right: boxWidth * (1 - m.right)
        };
    }

    // Growing/shrinking parent visuals ([P1-DATA-004] sub-session 4,
    // 2026-07-19): a parent task's rendered box grows with its OPEN sub-task
    // count. `item.subTasks` is the LIVE/open array (items.js splices it as
    // subs complete or get removed — completion/cascade/uncomplete-relink all
    // keep it in sync already), so this needs no new event hooks; it's just
    // read fresh wherever it's called (the per-tick loop — see loop.js).
    // Capped at CONFIG.PARENT_GROWTH_MAX_SUBS so the box can't grow unbounded.
    // Non-parents (no subTasks, or a sub-task itself — subs always have an
    // empty subTasks array since nesting isn't supported) return scale 1.
    function getParentGrowthScale(item) {
        if (!item || !item.subTasks || item.subTasks.length === 0) return 1;
        const openCount = Math.min(item.subTasks.length, CONFIG.PARENT_GROWTH_MAX_SUBS);
        return 1 + openCount * CONFIG.PARENT_GROWTH_PER_SUB;
    }

    // baseWidth is the item's UNGROWN box width (CONFIG.ENEMY_WIDTH for a
    // top-level task — habits/sub-tasks never grow and shouldn't be routed
    // through this).
    function getParentRenderWidth(item, baseWidth) {
        return baseWidth * getParentGrowthScale(item);
    }

    // Sub-tasks fan out beside their parent: alternating right/left by creation
    // order (ordered by id, so the arrangement stays stable as siblings
    // complete). Offsets are computed from the sprites' VISIBLE graphic edges
    // (via getVisibleEdges), not their box edges. Each side's 1st slot butts its
    // visible graphic against the parent's visible edge (plus a small gap); each
    // further same-side slot chains off the previous sibling's visible edge.
    // Sibling categories can differ, so the chain walks every earlier sibling
    // and uses each one's own measured margins.
    function getSubTaskClusterOffset(item, ctx) {
        if (!item.parentId) return 0;
        const { activeItems, enemyWidth } = ctx;
        const parentTask = activeItems.find(p => p.id === item.parentId);
        const gap = CONFIG.SUBTASK_CLUSTER_GAP_PX;
        const subWidth = CONFIG.SUBTASK_ENEMY_WIDTH;

        // Sub-session 4: the parent's visible-margin contribution scales with
        // its CURRENT (possibly grown) box width, not the fixed enemyWidth,
        // so the fan stays attached to the visible graphic edge at any size.
        const parentBoxWidth = parentTask ? getParentRenderWidth(parentTask, enemyWidth) : enemyWidth;
        const parentEdges = getVisibleEdges(parentTask ? parentTask.category : 'other', parentBoxWidth);
        let rightFrontier = parentEdges.right; // visible right edge of the rightmost cluster member so far (px, relative to parent box left)
        let leftFrontier = parentEdges.left;   // visible left edge of the leftmost cluster member so far

        const siblings = activeItems
            .filter(i => i.parentId === item.parentId && i.id <= item.id)
            .sort((a, b) => a.id - b.id);

        let offset = 0;
        siblings.forEach((sib, idx) => {
            const sibEdges = getVisibleEdges(sib.category, subWidth);
            let sibOffset;
            if (idx % 2 === 0) {
                // right side: sib's visible left edge sits gap px after the current right frontier
                sibOffset = rightFrontier + gap - sibEdges.left;
                rightFrontier = sibOffset + sibEdges.right;
            } else {
                // left side: sib's visible right edge sits gap px before the current left frontier
                sibOffset = leftFrontier - gap - sibEdges.right;
                leftFrontier = sibOffset + sibEdges.left;
            }
            if (sib.id === item.id) offset = sibOffset;
        });
        return offset;
    }

    // Sub-tasks normally track the PARENT's timeline position (offset by
    // getSubTaskClusterOffset) rather than their own due date, so they stay
    // visually clustered with the parent even if their due time is only a
    // little different. Only when a sub-task's own due date is due
    // significantly EARLIER than the parent's (its own timeline position is
    // meaningfully closer to the base) does it break from the cluster and
    // show its own real urgency further ahead.
    function calculateTimelineXWithClustering(item, currentTime, ctx) {
        const { activeItems, dims } = ctx;
        const ownTimelineX = Clock.calculateTimelinePosition(item, currentTime, dims);
        if (!item.parentId) return ownTimelineX;

        const offsetCtx = { activeItems, enemyWidth: dims.enemyWidth };
        const parentTask = activeItems.find(p => p.id === item.parentId);
        // Left-fan off-field guard ([P1-DATA-004] sub-session 5, 2026-07-19):
        // a left-fanned sub gets a NEGATIVE cluster offset (getSubTaskClusterOffset),
        // so once the parent nears the base (parentTask.x approaches baseWidth,
        // the minimum any item can reach — see Clock.calculateTimelinePosition),
        // parentTask.x + offset can dip below baseWidth and hide the sub's
        // sprite behind the church graphic. Clamping the FINAL x to baseWidth
        // is the chosen guard (over flipping the sub to the right side) —
        // it's a one-line floor with no fan-order/idx side effects, and a sub
        // sitting flush against the base's right edge instead of slightly
        // behind it is a fully acceptable visual at that extreme. Right-fan
        // subs (positive offset) are never affected in practice — their
        // offset only grows the further right of the base they already are.
        if (!parentTask) {
            return Math.max(ownTimelineX + getSubTaskClusterOffset(item, offsetCtx), dims.baseWidth);
        }

        if (parentTask.x - ownTimelineX > CONFIG.SUBTASK_AHEAD_THRESHOLD_PX) {
            return ownTimelineX; // due much earlier than parent — show real urgency
        }
        return Math.max(parentTask.x + getSubTaskClusterOffset(item, offsetCtx), dims.baseWidth);
    }

    // Sub-tasks bottom-align with their parent (feet on the same ground line)
    // instead of a random height, so they visually cluster with it. Falls back
    // to the ground band (below) for top-level items or if the parent isn't
    // rendered yet.
    //
    // Top-level items stand on the graveyard GROUND BAND (2026-07-21): their
    // feet (box bottom) land at a random fraction of canvas height between
    // CONFIG.GROUND_BAND_FEET_TOP_FRAC (~the fence line) and
    // GROUND_BAND_FEET_BOTTOM_FRAC (~the canvas floor), so they read as a
    // staggered crowd walking in front of the fence rather than floating at
    // random full-canvas heights. The jitter between the two fractions gives
    // depth and keeps same-timeline enemies from fully overlapping. Replaces
    // the old `randomFn() * (canvasHeight - itemHeight)` full-height range.
    //
    // canvasHeight is gameCanvas.offsetHeight (DOM read done by the caller);
    // randomFn defaults to Math.random and is injectable for tests.
    function getItemTopPosition(item, itemHeight, ctx) {
        const { activeItems, canvasHeight } = ctx;
        const randomFn = ctx.randomFn || Math.random;
        if (item.parentId) {
            const parentTask = activeItems.find(p => p.id === item.parentId);
            if (parentTask && parentTask.element) {
                const parentTop = parseFloat(parentTask.element.style.top);
                const parentHeight = parseFloat(parentTask.element.style.height) || itemHeight;
                if (!isNaN(parentTop)) return parentTop + (parentHeight - itemHeight);
            }
        }
        const feetTop = CONFIG.GROUND_BAND_FEET_TOP_FRAC * canvasHeight;
        const feetBottom = CONFIG.GROUND_BAND_FEET_BOTTOM_FRAC * canvasHeight;
        const feet = feetTop + randomFn() * (feetBottom - feetTop);
        const top = feet - itemHeight;
        return Math.max(0, Math.min(top, canvasHeight - itemHeight));
    }

    return {
        getVisibleEdges,
        getParentGrowthScale,
        getParentRenderWidth,
        getSubTaskClusterOffset,
        calculateTimelineXWithClustering,
        getItemTopPosition
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Movement;
}
