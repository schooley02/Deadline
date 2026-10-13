/**
 * layout.js — portrait "glance strip" mode (V3b-1, 2026-10-13).
 *
 * Portrait phones (<= 768px wide AND portrait) collapse the battlefield into a
 * thin threat strip (docs/VISUAL_DESIGN_PLAN.md Direction #4). The strip is a
 * CSS/render VARIANT of the same DOM and state, never a second component: this
 * module only (a) decides whether strip mode is on, (b) mirrors that onto
 * <body class="glance-strip"> so css/glanceStrip.css can restyle, and (c)
 * computes the "+N" sub-task badge counts. Everything else is CSS.
 *
 * Public API:
 *   Layout.isGlanceStrip(win?)        fresh matchMedia check
 *   Layout.isActive()                 cached result of the last applyBodyClass/init
 *                                     (cheap; safe in per-tick / per-call hot paths)
 *   Layout.applyBodyClass(doc, win)   toggles body.glance-strip, updates the cache
 *   Layout.init({ win, doc, onChange })
 *                                     applies once, then re-applies on resize/rotate;
 *                                     onChange(isStrip, modeChanged) fires after each
 *                                     re-apply (script.js uses it to re-measure dims)
 *   Layout.computeSubBadges(items)    { [parentId]: n } — subs sitting ON their parent
 *   Layout.applySubBadges(items)      writes data-sub-count on parent elements
 */
const Layout = (() => {
    const GLANCE_QUERY = '(max-width: 768px) and (orientation: portrait)';
    let active = false;

    function isGlanceStrip(win) {
        const w = win || (typeof window !== 'undefined' ? window : null);
        if (!w || typeof w.matchMedia !== 'function') return false;
        return !!w.matchMedia(GLANCE_QUERY).matches;
    }

    function isActive() {
        return active;
    }

    function applyBodyClass(doc, win) {
        active = isGlanceStrip(win);
        if (doc && doc.body) doc.body.classList.toggle('glance-strip', active);
        return active;
    }

    function init({ win, doc, onChange } = {}) {
        const w = win || window;
        const d = doc || document;
        let last = applyBodyClass(d, w);
        let queued = false;
        const reapply = () => {
            queued = false;
            const now = applyBodyClass(d, w);
            const changed = now !== last;
            last = now;
            if (onChange) onChange(now, changed);
        };
        const onResize = () => {
            if (queued) return;
            queued = true;
            if (typeof w.requestAnimationFrame === 'function') w.requestAnimationFrame(reapply);
            else reapply();
        };
        w.addEventListener('resize', onResize);
        return { reapply };
    }

    // A sub-task "sits on" its parent when its x equals the parent's (strip mode
    // zeroes the cluster fan-out). A sub that breaks away because it is due much
    // earlier has its own x, shows as its own marker, and is NOT counted.
    function computeSubBadges(items) {
        const byId = new Map();
        items.forEach(i => byId.set(i.id, i));
        const counts = {};
        items.forEach(i => {
            if (!i.parentId) return;
            const parent = byId.get(i.parentId);
            if (parent && Math.abs(i.x - parent.x) < 1) {
                counts[parent.id] = (counts[parent.id] || 0) + 1;
            }
        });
        return counts;
    }

    // Writes only when the value changes (called every game tick).
    function applySubBadges(items) {
        const counts = active ? computeSubBadges(items) : {};
        items.forEach(i => {
            const el = i.element;
            if (!el || i.parentId || !el.dataset) return;
            const n = counts[i.id] || 0;
            if (n) {
                if (el.dataset.subCount !== String(n)) el.dataset.subCount = String(n);
            } else if (el.dataset.subCount !== undefined) {
                delete el.dataset.subCount;
            }
        });
    }

    return { GLANCE_QUERY, isGlanceStrip, isActive, applyBodyClass, init, computeSubBadges, applySubBadges };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Layout;
}
