/**
 * HudButtons -- keeps the top-row HUD buttons looking "pressed" while the window they open is showing
 * (Jeremy 2026-11-01: with a panel open the buttons stay visible behind its dimmed backdrop, and the
 * one that owns the panel should read as the active one).
 *
 * Every panel is a different kind of element (Modal overlays for base health / level / village + its
 * building cards, the #shopWindow management window, the #heroTray popup), so instead of hooking each
 * open/close path this watches the DOM and recomputes. `openButtons` is pure and unit-tested
 * (test/hudButtons.test.js); `init` is DOM and live-checked. Adds `.hud-button--open` + aria-expanded.
 *
 * Collapse toggle (2026-11-25, Jeremy): the six buttons sit over the tops of the village buildings on a phone (the Water tower's tank, the
 * Hospital cross, the belfry). `#hudCollapseButton`, the small chevron at the far left of the row, hides them: `.hud-collapsed` goes on
 * `.resource-panel` and css/gameCanvas.css hides the other buttons (visibility, so their boxes stay for anything that measures them) and lets
 * taps through. The choice is remembered per device (Settings.hudCollapsed). The portrait glance strip never collapses (CSS scopes the rule
 * to `body:not(.glance-strip)`); nothing is covered there.
 */
const HudButtons = (() => {
    /** buttonId -> CSS selector that matches while that button's window is showing. */
    const WINDOWS = {
        baseHealthButton: '.base-panel-overlay',
        levelButton: '.level-panel-overlay',
        villageButton: '.village-panel-overlay, .village-card-overlay',
        heroesButton: '#heroTray.open',
        goalsButton: '#goalsPane.open',
        playerPointsStat: '#shopWindow:not(.hidden)',
    };

    /** isShowing(selector) -> boolean. Returns the ids of the buttons whose window is open. */
    function openButtons(isShowing) {
        return Object.keys(WINDOWS).filter(id => !!isShowing(WINDOWS[id]));
    }

    /** What the collapse toggle should say and show for a state. Pure. */
    function collapseModel(collapsed) {
        const c = collapsed === true;
        return {
            collapsed: c,
            expanded: !c, // aria-expanded: are the buttons showing?
            label: c ? 'Show top buttons' : 'Hide top buttons',
            panelClass: 'hud-collapsed',
        };
    }

    /**
     * Wire the toggle. io = { get(): boolean, set(boolean) } (Settings in the game). Safe when the button is missing. Returns { apply, toggle }.
     */
    function initCollapse(doc, io) {
        const d = doc || document;
        const btn = d.getElementById('hudCollapseButton');
        const panel = btn ? btn.closest('.resource-panel') : null;
        if (!btn || !panel) return null;
        let collapsed = false;
        try { collapsed = !!(io && io.get && io.get()); } catch (e) { collapsed = false; }
        function apply() {
            const m = collapseModel(collapsed);
            panel.classList.toggle(m.panelClass, m.collapsed);
            btn.setAttribute('aria-expanded', m.expanded ? 'true' : 'false');
            btn.setAttribute('aria-label', m.label);
            btn.title = m.label;
        }
        function toggle() {
            collapsed = !collapsed;
            apply();
            try { if (io && io.set) io.set(collapsed); } catch (e) { /* a preference only */ }
        }
        btn.addEventListener('click', toggle);
        apply();
        return { apply, toggle };
    }

    function init(doc) {
        const d = doc || document;
        let queued = false;
        function sync() {
            queued = false;
            const open = new Set(openButtons(sel => d.querySelector(sel)));
            Object.keys(WINDOWS).forEach(id => {
                const el = d.getElementById(id);
                if (!el) return;
                const on = open.has(id);
                if (el.classList.contains('hud-button--open') !== on) el.classList.toggle('hud-button--open', on);
                const attr = on ? 'true' : 'false';
                if (el.getAttribute('aria-expanded') !== attr) el.setAttribute('aria-expanded', attr);
            });
        }
        function schedule() {
            if (queued) return;
            queued = true;
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(sync); else setTimeout(sync, 0);
        }
        // Modal overlays are added to / removed from <body>.
        new MutationObserver(schedule).observe(d.body, { childList: true });
        // The shop window and hero popup stay in the DOM and just flip a class.
        ['shopWindow', 'heroTray', 'goalsPane'].forEach(id => {
            const el = d.getElementById(id);
            if (el) new MutationObserver(schedule).observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        sync();
        return { sync };
    }

    return { WINDOWS, openButtons, collapseModel, initCollapse, init };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HudButtons;
}
