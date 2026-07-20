/**
 * Modal — unified modal/window behavior layer + window.* exposure helper.
 *
 * History: extracted from script.js as teardown-only in Milestone 2 UI
 * extraction session 1 (2026-07-18). Expanded into the shared behavior
 * layer in [P2-UI-011] Stage 1 (session 61, 2026-07-19): ESC-to-close
 * (topmost first), backdrop-click (topmost only), Tab focus trap, focus
 * return, and role="dialog"/aria-modal — for BOTH window systems (the
 * ad-hoc `.modal-overlay` form/popup clusters AND the FAB-opened
 * `.management-window` panels, the latter via deps callbacks so this file
 * still has no dependency on managementWindows.js internals).
 *
 * Overlay CREATION: centralized via `Modal.open()` ([P2-UI-011] Stage 2,
 * docs/MODAL_STAGE2_PLAN.md, sequenced 2026-07-20). Every cluster still
 * builds its own `<div class="modal-overlay">...` HTML string — `open()`
 * doesn't template content, only inserts it — as a DIRECT CHILD of
 * document.body (verified by grep across
 * forms.js/checkIn.js/frozenNotice.js/popups.js/routineViews.js — every
 * insertion site targets body). That invariant is what lets the
 * MutationObserver below attach behavior without any cluster-specific
 * code: it watches body's childList only, NOT the whole subtree. If a
 * future cluster nests an overlay deeper, it will silently miss the
 * observer — keep overlays on body. Migration is sequenced across 5
 * sub-sessions (see the plan doc); sub-session 1 (this one) ships
 * `open()` itself plus a checkIn.js pilot — the other clusters still
 * insert directly until their own sub-session lands.
 *
 * Semantics kept deliberately distinct:
 *   - closeModal()   — close ALL overlays. Pre-existing behavior; ~18
 *     inline onclick sites and several JS flows (e.g. "Add Selected" →
 *     close everything → reopen management modal) RELY on the nuke-all.
 *     Unchanged.
 *   - closeTopmost() — close only the most recently opened overlay. Used
 *     by ESC, backdrop clicks, and stacked-context Cancel buttons (e.g.
 *     addItemModal's Cancel, which previously killed the routine
 *     management modal underneath it too — the session-61 bug fix).
 *
 * Focus-return fidelity note: the observer records the opener as
 * document.activeElement at mutation time. For chained modals that close
 * and reopen in the SAME tick, focus has already fallen to <body> by the
 * time the observer runs, so the opener record degrades and restore falls
 * back to the topmost remaining overlay (or nothing). Perfect chained
 * focus return arrives with Stage 2's Modal.open(), which can capture the
 * opener synchronously.
 *
 * exposeGlobal exists to make the window.* attachment inline onclick=
 * handlers require systematic rather than ad-hoc — the deleteRoutine bug
 * (2026-07-18, see DECISIONS.md) was exactly a missing one of these.
 *
 * No closures over script.js state — deps arrive explicitly, same pattern
 * as clock.js/spawning.js/damage.js/habits.js.
 */
const Modal = (() => {

    // ---------------------------------------------------------------------
    // Overlay queries
    // ---------------------------------------------------------------------

    function getOverlays() {
        return Array.from(document.querySelectorAll('.modal-overlay'));
    }

    // Overlays share z-index 1002 (css/modal.css), so DOM order IS stacking
    // order: the last .modal-overlay in the document paints on top.
    function getTopmostOverlay() {
        const overlays = getOverlays();
        return overlays.length ? overlays[overlays.length - 1] : null;
    }

    // ---------------------------------------------------------------------
    // Overlay creation ([P2-UI-011] Stage 2, docs/MODAL_STAGE2_PLAN.md)
    // ---------------------------------------------------------------------

    // Inserts a caller-built `.modal-overlay` HTML string as the last child
    // of document.body and returns the inserted element — matching every
    // surveyed call site's existing next-line `document.querySelector(...)`,
    // so migrating a cluster is mechanical: `insertAdjacentHTML(...); const
    // overlay = document.querySelector(...)` becomes `const overlay =
    // Modal.open(html)`. Does NOT template content — html must already be a
    // full `<div class="modal-overlay">...` string, same as today.
    //
    // options.dedupeSelector: if an element matching this selector already
    // exists in the DOM, no-op and return null. Replaces the repeated
    // `if (document.querySelector('.foo-overlay')) return;` guards
    // hand-written at several call sites (checkIn.js, frozenNotice.js).
    //
    // options.defer: true schedules the insert one tick later via
    // setTimeout(0) instead of inserting synchronously, and returns
    // undefined (fire-and-forget) rather than the element — for callers
    // whose trigger site runs Modal.closeModal() (nuke-all) synchronously
    // right after firing them, which would otherwise delete a
    // same-tick-inserted overlay before it ever painted (the sessions
    // 21/34/37 hazard). Every current deferred caller only wires a static
    // inline onclick="closeModal()" already baked into the html string —
    // never addEventListener after insertion — so the missing return value
    // is a non-issue in practice; a future deferred caller needing
    // post-insert wiring would need a different option, not yet built.
    function open(html, options = {}) {
        const insert = () => {
            if (options.dedupeSelector && document.querySelector(options.dedupeSelector)) {
                return null;
            }
            document.body.insertAdjacentHTML('beforeend', html);
            return getTopmostOverlay();
        };
        if (options.defer) {
            setTimeout(insert, 0);
            return undefined;
        }
        return insert();
    }

    // ---------------------------------------------------------------------
    // Overlay teardown
    // ---------------------------------------------------------------------

    // Removes EVERY open modal overlay from the DOM. Matches the original
    // script.js behavior exactly: querySelectorAll + remove, no animation,
    // no state to restore. Many existing call sites depend on the close-all
    // semantics — do not "fix" this to topmost-only (see header).
    function closeModal() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }

    // Removes ONLY the topmost overlay. Returns true if one was closed —
    // the ESC handler uses the return value to decide whether the keypress
    // is "spent" or should fall through to the management windows/FAB.
    function closeTopmost() {
        const top = getTopmostOverlay();
        if (top) top.remove();
        return !!top;
    }

    // ---------------------------------------------------------------------
    // Focus management + ARIA (MutationObserver on body childList)
    // ---------------------------------------------------------------------

    const openerByOverlay = new WeakMap();
    let observer = null;

    function focusOverlayContent(overlay) {
        const content = overlay.querySelector('.modal-content') || overlay;
        if (!content.hasAttribute('tabindex')) {
            content.setAttribute('tabindex', '-1');
        }
        content.focus();
    }

    function prepareOverlay(overlay, opener) {
        if (opener && opener !== document.body) {
            openerByOverlay.set(overlay, opener);
        }
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        if (!overlay.hasAttribute('aria-label')) {
            const heading = overlay.querySelector('h3, h2');
            if (heading) overlay.setAttribute('aria-label', heading.textContent.trim());
        }
    }

    function restoreFocusAfterClose(removedOverlays) {
        // Prefer the opener of the FIRST-opened (lowest) removed overlay
        // that's still in the document — on a close-all that's the element
        // the user started from; on a topmost-only close it's typically a
        // button inside the overlay beneath, which is exactly right.
        for (const ov of removedOverlays) {
            const opener = openerByOverlay.get(ov);
            if (opener && opener.isConnected && typeof opener.focus === 'function') {
                opener.focus();
                return;
            }
        }
        const top = getTopmostOverlay();
        if (top) focusOverlayContent(top);
    }

    function isOverlayNode(node) {
        return node && node.nodeType === 1 && node.classList &&
            node.classList.contains('modal-overlay');
    }

    function handleMutations(mutations) {
        // Observer callbacks are async — in Jest/jsdom they can fire during
        // environment teardown, after the document is gone. Bail cheaply.
        if (typeof document === 'undefined' || !document.body) return;
        const removed = [];
        const added = [];
        // activeElement is captured BEFORE processing removals: on a plain
        // open it's still the trigger button (insertion doesn't move focus).
        const opener = document.activeElement;
        for (const m of mutations) {
            m.removedNodes.forEach(n => { if (isOverlayNode(n)) removed.push(n); });
            m.addedNodes.forEach(n => { if (isOverlayNode(n)) added.push(n); });
        }
        if (removed.length && !added.length) {
            restoreFocusAfterClose(removed);
        }
        if (added.length) {
            added.forEach(ov => prepareOverlay(ov, opener));
            focusOverlayContent(added[added.length - 1]); // topmost of the batch
        }
    }

    // Idempotent. Safe no-op where MutationObserver is unavailable.
    function initFocusManagement() {
        if (observer || typeof MutationObserver === 'undefined') return;
        observer = new MutationObserver(handleMutations);
        observer.observe(document.body, { childList: true });
    }

    // ---------------------------------------------------------------------
    // Tab focus trap (topmost overlay only)
    // ---------------------------------------------------------------------

    const FOCUSABLE_SELECTOR = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    function getFocusables(container) {
        return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter(el => {
                // Skips display:none controls (e.g. the hidden habit-type
                // radios, css/modal.css). In Jest/jsdom no stylesheets are
                // loaded so this filter is inert there — fine, tests don't
                // exercise hidden controls.
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });
    }

    function trapTab(e) {
        const top = getTopmostOverlay();
        if (!top) return;
        const focusables = getFocusables(top);
        if (focusables.length === 0) {
            e.preventDefault();
            focusOverlayContent(top);
            return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!top.contains(active)) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // ---------------------------------------------------------------------
    // Unified dismiss handlers (ESC + outside/backdrop click)
    // ---------------------------------------------------------------------

    // deps: { closeAllManagementWindows, closeFabMenu,
    //         isAnyManagementWindowOpen }
    // Replaces the two document-level handlers that previously lived inline
    // in script.js (ESC keydown + click-outside). Behavior changes vs the
    // originals, both deliberate ([P2-UI-011] Stage 1):
    //   - ESC closes the TOPMOST overlay only (was: all overlays at once,
    //     which killed stacked modals like addItemModal + the routine
    //     management modal under it in one press).
    //   - Backdrop click closes ONLY the clicked overlay (was: closeModal()
    //     via per-popup listeners in popups.js — same nuke-all problem).
    function initDismissHandlers(deps) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (closeTopmost()) return;
                deps.closeAllManagementWindows();
                deps.closeFabMenu();
            } else if (e.key === 'Tab') {
                trapTab(e);
            }
        });

        document.addEventListener('click', (e) => {
            // Backdrop click — the overlay itself is the click target only
            // when the click landed outside .modal-content.
            if (e.target.classList && e.target.classList.contains('modal-overlay')) {
                e.target.remove();
                return;
            }
            // Clicks INSIDE a modal never dismiss the management windows
            // beneath it (pre-existing rule, preserved).
            if (e.target.closest && e.target.closest('.modal-overlay')) return;
            if (deps.isAnyManagementWindowOpen() &&
                !e.target.closest('.management-window') &&
                !e.target.closest('.fab-container')) {
                deps.closeAllManagementWindows();
            }
        });
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
        open,
        closeModal,
        closeTopmost,
        getTopmostOverlay,
        initDismissHandlers,
        initFocusManagement,
        trapTab,
        exposeGlobal,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modal;
}
