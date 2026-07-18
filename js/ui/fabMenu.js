/**
 * FabMenu — the floating-action-button menu (Tasks/Habits/Routines quick
 * links) toggle (Milestone 2 UI extraction, session 3, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md cluster E.
 * No closures over script.js state — deps object carries the two DOM
 * elements involved, same pattern as every prior extraction.
 *
 * toggleFabMenu previously had 6 console.log debug lines (menu/button state
 * before and after toggling) — removed here as pure noise with zero
 * behavioral significance, following the precedent set removing leftover
 * debug logs during the damage.js extraction (2026-07-18). Nothing else
 * about the logic changed.
 */
const FabMenu = (() => {

    // deps: { fabMenu, fabButton }
    function toggleFabMenu(deps) {
        const isHidden = deps.fabMenu.classList.contains('hidden');
        deps.fabMenu.classList.toggle('hidden', !isHidden);
        deps.fabButton.classList.toggle('active', isHidden);
    }

    // deps: { fabMenu, fabButton }
    function closeFabMenu(deps) {
        deps.fabMenu.classList.add('hidden');
        deps.fabButton.classList.remove('active');
    }

    return {
        toggleFabMenu,
        closeFabMenu,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FabMenu;
}
