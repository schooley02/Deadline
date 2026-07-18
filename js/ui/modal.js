/**
 * Modal — shared modal-overlay teardown + window.* exposure helper
 * (Milestone 2 UI extraction, session 1, 2026-07-18).
 *
 * Extracted from script.js per docs/UI_EXTRACTION_PLAN.md. This is the
 * foundation session: closeModal is depended on by all 18 inline
 * onclick="closeModal()" sites across clusters A/C/D/E/F, so it has to move
 * out of routine code (where it was previously buried) before any of those
 * clusters can be extracted without creating a cross-module dependency on
 * routines.
 *
 * Overlay CREATION is deliberately NOT in scope here — each form/popup
 * cluster still builds its own `<div class="modal-overlay">...` HTML string
 * and calls insertAdjacentHTML directly (verified by Grep: no shared "open
 * modal" function exists anywhere in script.js today). That gets pulled in
 * as each cluster's own extraction lands, not invented here.
 *
 * exposeGlobal exists to make the window.* attachment inline onclick=
 * handlers require systematic rather than ad-hoc — the deleteRoutine bug
 * (2026-07-18, see DECISIONS.md) was exactly a missing one of these.
 *
 * No closures over script.js state — follows the clock.js/spawning.js/
 * damage.js/habits.js pattern. script.js keeps a thin wrapper
 * (window.closeModal = Modal.closeModal) so the call site is unchanged.
 */
const Modal = (() => {

    // ---------------------------------------------------------------------
    // Overlay teardown
    // ---------------------------------------------------------------------

    // Removes every open modal overlay from the DOM. Matches the original
    // script.js behavior exactly: querySelectorAll + remove, no animation,
    // no state to restore.
    function closeModal() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }

    // ---------------------------------------------------------------------
    // window.* exposure helper
    // ---------------------------------------------------------------------

    // Attaches fn to window under `name` so inline onclick="name(...)"
    // strings can reach it — the whole script.js file runs inside a
    // DOMContentLoaded closure, so nothing is global by default. Centralizes
    // what was previously one-off `window.foo = foo;` lines scattered
    // through script.js (some of which got missed — see the deleteRoutine
    // bug in DECISIONS.md/HANDOFF.md, 2026-07-18).
    function exposeGlobal(name, fn) {
        if (typeof window === 'undefined') return;
        window[name] = fn;
    }

    return {
        closeModal,
        exposeGlobal,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modal;
}
