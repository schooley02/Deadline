/**
 * ManagementWindows — the Tasks/Habits/Routines list windows opened from the
 * FAB menu, plus their shared backdrop (Milestone 2 UI extraction, session
 * 3, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster E. No
 * closures over script.js state — everything arrives via an explicit deps
 * object, same pattern as every prior extraction.
 *
 * Two cross-module/cross-cluster dependencies, both threaded through deps
 * rather than assumed:
 *   - openManagementWindow calls FabMenu.closeFabMenu — a DIFFERENT module
 *     (js/ui/fabMenu.js, this same session). Passed in as deps.closeFabMenu
 *     so this file doesn't hard-depend on fabMenu.js's internal shape.
 *   - populateRoutinesWindow's "Manage"/"Activate" buttons call
 *     showRoutineManagement (still script.js-scoped — belongs to cluster F,
 *     not extracted until sessions 8/9) and toggleRoutineActive (already a
 *     script.js wrapper around Routines.toggleRoutineActive). Both passed
 *     in as deps rather than assumed global, so this module has no implicit
 *     dependency on script.js internals or extraction order elsewhere.
 *
 * Shop dispatch ([P1-UI-008] SHOP_PLAN.md sessions 2-3, 2026-07-18/19): the
 * 'shop' branch calls ShopView.renderShopWindow — yet another different
 * module (js/ui/shopView.js). deps.shopCatalog / deps.playerInventory /
 * deps.playerPoints / deps.baseHealth / deps.onShopBuy / deps.onShopUse are
 * passed through from script.js the same way the routines deps are, so this
 * file still has zero hard dependency on shopView.js's internal shape beyond
 * calling one function.
 *
 * populateRoutinesWindow's re-render-after-toggle call is a direct
 * module-internal reference (calls this file's own populateRoutinesWindow
 * again), not a deps callback — it's the same function, not a cross-module
 * call, matching how clock.js/movement.js call their own siblings directly.
 */
const ManagementWindows = (() => {

    // deps: { managementWindows, closeFabMenu, activeItems, definedHabits,
    //         definedRoutines, routineSlots, showRoutineManagement,
    //         toggleRoutineActive, shopCatalog, playerInventory,
    //         playerPoints, baseHealth, onShopBuy, onShopUse }
    function openManagementWindow(type, deps) {
        // Close all windows first
        Object.values(deps.managementWindows).forEach(win => {
            if (win) win.classList.add('hidden');
        });

        // Close FAB menu (fabMenu.js — different module, this session)
        deps.closeFabMenu();

        // Add or show backdrop
        let backdrop = document.querySelector('.window-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'window-backdrop';
            backdrop.addEventListener('click', () => {
                closeAllManagementWindows({ managementWindows: deps.managementWindows });
            });
            document.body.appendChild(backdrop);
        }
        backdrop.classList.add('show');

        // Open requested window
        const win = deps.managementWindows[type];
        if (win) {
            win.classList.remove('hidden');

            // Populate the window with current data
            if (type === 'tasks') {
                populateTasksWindow({ activeItems: deps.activeItems });
            } else if (type === 'habits') {
                populateHabitsWindow({ definedHabits: deps.definedHabits });
            } else if (type === 'routines') {
                populateRoutinesWindow({
                    definedRoutines: deps.definedRoutines,
                    routineSlots: deps.routineSlots,
                    showRoutineManagement: deps.showRoutineManagement,
                    toggleRoutineActive: deps.toggleRoutineActive,
                });
            } else if (type === 'shop') {
                ShopView.renderShopWindow({
                    catalog: deps.shopCatalog,
                    inventory: deps.playerInventory,
                    playerPoints: deps.playerPoints,
                    baseHealth: deps.baseHealth,
                    onBuy: deps.onShopBuy,
                    onUse: deps.onShopUse,
                });
            }
        }
    }

    // deps: { managementWindows }
    function closeAllManagementWindows(deps) {
        Object.values(deps.managementWindows).forEach(win => {
            if (win) win.classList.add('hidden');
        });

        const backdrop = document.querySelector('.window-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
    }

    // deps: { managementWindows }
    function closeManagementWindow(windowId, deps) {
        const win = document.getElementById(windowId);
        if (win) {
            win.classList.add('hidden');
        }

        // Check if all windows are closed, then hide backdrop
        const anyWindowOpen = Object.values(deps.managementWindows).some(w =>
            w && !w.classList.contains('hidden')
        );

        if (!anyWindowOpen) {
            const backdrop = document.querySelector('.window-backdrop');
            if (backdrop) {
                backdrop.classList.remove('show');
            }
        }
    }

    // deps: { activeItems }
    function populateTasksWindow(deps) {
        const tasksList = document.getElementById('tasksWindowList');
        if (!tasksList) return;

        tasksList.innerHTML = '';

        const topLevelTasks = deps.activeItems.filter(item => item.type === 'task' && !item.parentId);
        if (topLevelTasks.length === 0) {
            tasksList.innerHTML = '<li>No active tasks</li>';
            return;
        }

        topLevelTasks.forEach(task => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${task.name} (${task.category})${task.isHighPriority ? ' ⭐' : ''}</span>
                <span style="font-size: 12px; color: var(--color-neutral);">Due: ${task.dueDateTime.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
            `;
            tasksList.appendChild(li);
        });
    }

    // deps: { definedHabits }
    function populateHabitsWindow(deps) {
        const habitsList = document.getElementById('habitsWindowList');
        if (!habitsList) return;

        habitsList.innerHTML = '';

        if (deps.definedHabits.length === 0) {
            habitsList.innerHTML = '<li>No habits defined</li>';
            return;
        }

        deps.definedHabits.forEach(habit => {
            const li = document.createElement('li');
            const habitTypeIcon = habit.isNegative ? ' 🚫' : ' ✅';
            li.innerHTML = `
                <span>${habit.name} (${habit.category})${habitTypeIcon}</span>
                <span style="font-size: 12px; color: var(--color-neutral);">Streak: ${habit.streak}</span>
            `;
            habitsList.appendChild(li);
        });
    }

    // deps: { definedRoutines, routineSlots, showRoutineManagement, toggleRoutineActive }
    function populateRoutinesWindow(deps) {
        const routinesList = document.getElementById('routinesWindowList');
        const activeCountDisplay = document.getElementById('windowActiveRoutineCountDisplay');
        const totalSlotsDisplay = document.getElementById('windowTotalRoutineSlotsDisplay');

        if (!routinesList) return;

        // Update counts
        const activeRoutines = deps.definedRoutines.filter(r => r.isActive).length;
        if (activeCountDisplay) activeCountDisplay.textContent = activeRoutines;
        if (totalSlotsDisplay) totalSlotsDisplay.textContent = deps.routineSlots;

        routinesList.innerHTML = '';

        if (deps.definedRoutines.length === 0) {
            routinesList.innerHTML = '<li>No routines created</li>';
            return;
        }

        deps.definedRoutines.forEach(routine => {
            const li = document.createElement('li');
            // Sub-session 3 ("Frozen routine slots" UI, 2026-07-19): a frozen
            // routine is visually distinct from a merely-inactive one — grey
            // card + a dedicated icon, so "frozen" doesn't read as "off".
            // Detailed recovery info lives in the Manage modal (routineViews.js),
            // not this compact card.
            const isFrozen = !!routine.frozenState;
            // KO'd ([P1-UI-006] sub-session 2, 2026-07-19): same "distinct
            // status, not just off" treatment as frozen. `revivable` uses the
            // same DayRollover.hasDayRolledOver check Routines.toggleRoutineActive
            // itself gates on, so a stale disabled button never disagrees with
            // what clicking it would actually do.
            const isKod = !!routine.koState;
            const revivable = isKod && DayRollover.hasDayRolledOver(new Date(routine.koState.koAt), new Date());
            if (isFrozen) li.classList.add('routine-frozen');
            if (isKod) li.classList.add('routine-ko');
            const statusIcon = isKod ? '💤' : (isFrozen ? '🥶' : (routine.isActive ? '🟢' : '⚪'));
            const habitCount = routine.habitDefinitionIds ? routine.habitDefinitionIds.length : 0;
            const taskCount = routine.taskDefinitionIds ? routine.taskDefinitionIds.length : 0;
            const subtitle = isKod
                ? (revivable ? 'Knocked out — ready to revive' : 'Knocked out — revives tomorrow')
                : (isFrozen ? 'Frozen — see Manage for recovery options' : `${habitCount} habits, ${taskCount} tasks`);
            const toggleDisabled = isKod && !revivable;
            const toggleLabel = isKod ? 'Revive' : (routine.isActive ? 'Deactivate' : 'Activate');

            li.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <div>${statusIcon} ${routine.name}</div>
                        <div style="font-size: 12px; color: var(--color-neutral);">${subtitle}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="edit-routine-btn" data-routine-id="${routine.id}" style="padding: 4px 8px; font-size: 12px; background: var(--color-accent-teal); color: white; border: none; border-radius: 4px; cursor: pointer;">Manage</button>
                        <button class="toggle-routine-btn" data-routine-id="${routine.id}" ${toggleDisabled ? 'disabled title="Revives tomorrow"' : ''} style="padding: 4px 8px; font-size: 12px; background: ${routine.isActive ? 'var(--color-error)' : 'var(--color-success)'}; color: white; border: none; border-radius: 4px; cursor: ${toggleDisabled ? 'not-allowed' : 'pointer'}; opacity: ${toggleDisabled ? '0.5' : '1'};">${toggleLabel}</button>
                    </div>
                </div>
            `;

            // Add event listeners for buttons
            const manageBtn = li.querySelector('.edit-routine-btn');
            const toggleBtn = li.querySelector('.toggle-routine-btn');

            if (manageBtn) {
                manageBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deps.showRoutineManagement(routine.id);
                });
            }

            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deps.toggleRoutineActive(routine.id);
                    populateRoutinesWindow(deps); // Refresh the list (module-internal, same function)
                });
            }

            routinesList.appendChild(li);
        });
    }

    return {
        openManagementWindow,
        closeAllManagementWindows,
        closeManagementWindow,
        populateTasksWindow,
        populateHabitsWindow,
        populateRoutinesWindow,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ManagementWindows;
}
