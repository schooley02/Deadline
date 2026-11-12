/**
 * barricadeView.js -- the barricade standing in front of the church (Momentum Build C, 2026-11-11; docs/MOMENTUM_PLAN.md).
 *
 * One element, #barricade, whose picture follows the momentum state (None / Partial / Solid / Reinforced). It is the second way into the
 * Barricade window (the first is the mark on Today in the week strip). The picture path comes from Theme.barricadeAsset, so a second theme
 * only supplies four files. The DOM is touched only when the state id changes.
 *
 *   BarricadeView.init(el, { onTap })   -> wires the tap (click / Enter / Space)
 *   BarricadeView.render(info)          -> info = Momentum.momentum() result (or null)
 *   BarricadeView.labelFor(info)        -> the screen-reader label (pure)
 */
const BarricadeView = (() => {
    let el = null;
    let shownId = null;

    /** "Barricade: Solid, 5 of 7 nights. Open." (pure; plain words, no theme words) */
    function labelFor(info) {
        if (!info || !info.state) return 'Barricade. Open.';
        return 'Barricade: ' + info.state.name + ', ' + info.count + ' of ' + info.max + ' nights. Open.';
    }

    function render(info) {
        if (!el) return;
        const id = info && info.state ? info.state.id : 'none';
        if (id !== shownId) {
            shownId = id;
            el.setAttribute('data-state', id);
            const path = (typeof Theme !== 'undefined' && Theme.barricadeAsset) ? Theme.barricadeAsset(id) : '';
            el.style.backgroundImage = path ? 'url("' + path + '")' : '';
        }
        el.setAttribute('aria-label', labelFor(info));
        el.hidden = false;
    }

    function init(element, opts) {
        el = element || null;
        shownId = null;
        if (!el) return;
        const onTap = opts && typeof opts.onTap === 'function' ? opts.onTap : null;
        const fire = (e) => { e.stopPropagation(); if (onTap) onTap(); };
        // Only the wall's silhouette takes taps (css/barricade.css .barricade-hit); the rest of the box lets them through to the church.
        if (!el.querySelector('.barricade-hit')) {
            const hit = (el.ownerDocument || document).createElement('span');
            hit.className = 'barricade-hit';
            el.appendChild(hit);
        }
        el.onclick = fire;
        el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(e); } };
    }

    return { init, render, labelFor };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarricadeView;
}
