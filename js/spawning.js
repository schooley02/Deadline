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
 *   dims: { enemyWidth, habitEnemyWidth, subtaskEnemyWidth, habitStreakBonusThreshold },
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
        }

        if (itemData.type === 'task' && itemData.isHighPriority) {
            classes.push('high-priority');
        } else if (itemData.type === 'habit') {
            classes.push('habit-enemy', 'zombie-small');
            if (itemData.isNegative) {
                classes.push('negative-habit');
            }
            if (itemData.streak >= dims.habitStreakBonusThreshold) {
                classes.push('high-streak');
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

        console.log('📍 addItemToGame called with:', {
            id: itemData.id,
            name: itemData.name,
            type: itemData.type,
            parentId: itemData.parentId,
            parentIdType: typeof itemData.parentId,
            stackTrace: new Error().stack.split('\n').slice(1, 4).join('\n')
        });

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
