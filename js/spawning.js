/**
 * Spawning — enemy creation/admission onto the board (Milestone 2 extraction, 2026-07-17).
 *
 * Extracted from script.js's addItemToGame. Follows the clock.js/movement.js
 * pattern: the DOM-heavy orchestration takes its script.js collaborators as an
 * explicit `deps` object rather than closing over them, and script.js keeps a
 * thin `addItemToGame(itemData)` wrapper so all call sites are unchanged.
 *
 * The pure sprite-size + CSS-class decision (subtask vs habit vs task, plus
 * high-priority / negative / high-streak modifiers) is split out into
 * resolveEnemyVisual so it can be unit-tested without a DOM.
 *
 * deps = {
 *   gameCanvas,                 // DOM container to append the enemy to
 *   activeItems,                // shared array; the new item is pushed onto it
 *   baseWidth,                  // BASE_WIDTH (overdue-on-spawn position)
 *   dims: { enemyWidth, habitEnemyWidth, subtaskEnemyWidth, habitStreakBonusThreshold,
 *           habitStreakStrongThreshold },
 *   getItemTopPosition,         // (item, height) -> px   (script.js Movement wrapper)
 *   getSubTaskClusterOffset,    // (item) -> px           (script.js Movement wrapper)
 *   handleEnemyClick,           // (itemId) -> void
 *   createListItem,             // (itemData) -> void
 *   markAsOverdue,              // (item, now) -> void
 *   updateTaskCountDisplay,     // () -> void
 *   sortAndRenderActiveList,    // () -> void
 *   saveGame,                   // () -> void
 *   isGameOver                  // () -> boolean
 * }
 */
const Spawning = (() => {
    // Pure: decide an enemy's sprite box size and full CSS class list.
    // dims = { enemyWidth, habitEnemyWidth, subtaskEnemyWidth, habitStreakBonusThreshold }
    function resolveEnemyVisual(itemData, dims) {
        const classes = [
            'enemy',
            `category-${itemData.category}`,
            'zombie-sprite',
            `zombie-${itemData.category}`
        ];

        let width, height;
        if (itemData.parentId) {
            // This is a subtask
            width = dims.subtaskEnemyWidth;
            height = dims.subtaskEnemyWidth;
            classes.push('subtask-enemy', 'zombie-subtask');
        } else if (itemData.type === 'habit') {
            width = dims.habitEnemyWidth;
            height = 128;
        } else {
            width = dims.enemyWidth;
            height = 128;
            // Growing/shrinking parent visuals ([P1-DATA-004] sub-session 4,
            // 2026-07-19): only top-level tasks can grow (see
            // Movement.getParentGrowthScale), so only they get the CSS hook
            // that scales the background sprite WITH the box (enemySprites.css)
            // instead of the legacy fixed 128px — needed so the visible
            // graphic edge tracks the live width Loop.updateActiveItems sets,
            // keeping getSubTaskClusterOffset's fan attached at any size.
            // Harmless when the box never grows (0 open subs): 100% of a
            // 128px box == the old fixed 128px, pixel-identical.
            classes.push('parent-scaled');
        }

        if (itemData.type === 'task' && itemData.isHighPriority) {
            classes.push('high-priority');
        } else if (itemData.type === 'habit') {
            // 2026-07-21 (Jeremy's call, see docs/DECISIONS.md): habits now
            // render at the same regular sprite size as tasks — sub-tasks
            // already carry the "visually smaller" treatment (real 64px box,
            // above), so habits shrinking too was redundant/confusing.
            // 'habit-enemy' is kept for its NON-size hooks (dashed border,
            // negative-habit badge, high/super-streak flame) — only the old
            // 'zombie-small' class (which forced a 70px background-size via
            // enemySprites.css) is dropped.
            classes.push('habit-enemy');
            if (itemData.isNegative) {
                classes.push('negative-habit');
            }
            if (itemData.streak >= dims.habitStreakBonusThreshold) {
                classes.push('high-streak');
            }
            // Stronger tier ([P2-UI-009], session 59): ADDITIVE on top of
            // high-streak (never instead of it) — a strong-tier habit is
            // still >= the base threshold, so both classes apply and the
            // CSS layers the blazing effect over the base flame.
            if (dims.habitStreakStrongThreshold != null &&
                itemData.streak >= dims.habitStreakStrongThreshold) {
                classes.push('super-streak');
            }
        }

        return { width, height, classes };
    }

    // DOM side-effecting admission of an enemy. Behavior-identical to the
    // original script.js addItemToGame; collaborators arrive via deps.
    function addItemToGame(itemData, deps) {
        const {
            gameCanvas, activeItems, baseWidth, dims,
            getItemTopPosition, getSubTaskClusterOffset,
            handleEnemyClick, createListItem, markAsOverdue,
            updateTaskCountDisplay, sortAndRenderActiveList, saveGame,
            isGameOver
        } = deps;

        // (Removed 2026-07-18: a parentId + stack-trace debug log carried over
        // from the sub-task duplication investigation, fixed 2026-07-17. It
        // fired hundreds of times in test/subtask-creation.test.js and buried
        // the actual results.)
        if (isGameOver()) return;

        // Create enemy element
        const itemElement = document.createElement('div');
        const visual = resolveEnemyVisual(itemData, dims);
        visual.classes.forEach(c => itemElement.classList.add(c));

        itemElement.style.width = `${visual.width}px`;
        itemElement.style.height = `${visual.height}px`;

        // Position enemy
        itemElement.style.left = itemData.x + 'px';
        itemElement.style.top = getItemTopPosition(itemData, visual.height) + 'px';

        // Set up click handler
        itemElement.dataset.itemId = itemData.id;
        itemElement.addEventListener('click', () => handleEnemyClick(itemData.id));

        // Never write emoji textContent - always use sprite classes
        itemElement.textContent = '';

        // Add to game canvas
        gameCanvas.appendChild(itemElement);
        itemData.element = itemElement;

        // Create list item only if it's a top-level task
        if (!itemData.parentId) {
            createListItem(itemData);
        }

        // Check if already overdue
        if (itemData.dueDateTime < new Date()) {
            markAsOverdue(itemData, new Date());
            // markAsOverdue parks the damage clock at the DUE time. For an item
            // that is already overdue the moment it enters the game, that time
            // can be arbitrarily far in the past, and the live loop would then
            // replay every missed interval at one per 50ms tick — creating a
            // task backdated 3 hours instantly cost 36 HP (2026-07-18). The
            // item didn't exist during that window, so nothing is owed for it:
            // start its damage clock now. (Restore does the same thing right
            // after this call, and back-charges its capped offline damage
            // separately — see restoreGameState/runOfflineCatchUp.)
            itemData.lastDamageTickTime = Date.now();
            itemData.x = baseWidth + getSubTaskClusterOffset(itemData);
            if (itemData.element) itemData.element.style.left = itemData.x + 'px';
        }

        activeItems.push(itemData);
        updateTaskCountDisplay();
        sortAndRenderActiveList();
        saveGame();
    }

    return { resolveEnemyVisual, addItemToGame };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Spawning;
}
