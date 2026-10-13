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
 * V3b-2 follow-up (2026-10-13): lanes are dealt in agenda LIST order
 * (js/listOrder.js) and a collapsed cluster shows its top-of-list marker.
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
 *   Layout.computeStripLayout(items, opts?)
 *                                     V3b-2 pure plan: { [id]: { lane, hidden, badge } }
 *   Layout.applyStripLayout(items)    writes data-lane / data-sub-count / .strip-hidden
 *                                     (per tick; supersedes applySubBadges in the game)
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

    // --- V3b-2: vertical lanes + fallback badges ---------------------------
    // Markers are dealt onto CONFIG.STRIP_LANE_COUNT lanes in x order, so
    // same-lane neighbours are LANE_COUNT markers apart (36-45px in the
    // compressed right zone instead of 11-15px). The most urgent (nearest the
    // base) takes the FRONT lane (highest index = lowest on screen = drawn in
    // front). Lane depends only on the x-ORDER, which only changes on spawn,
    // removal, a due-date edit or a sub breaking away — so it never jitters
    // while items just walk (no per-tick re-pack needed).
    //
    // Fallbacks (both reuse the "+N" badge):
    //  - same-lane markers closer than STRIP_MARKER_WIDTH: the nearest-to-base
    //    one stays as the leader, the rest hide and add to its badge;
    //  - overdue items all sit on the base edge: ONE leader sprite shows, the
    //    rest hide and add to its badge ("pile").
    // A sub stacked on its parent shares the parent's lane / hidden state and
    // adds to the parent's badge exactly like V3b-1.
    function stripOpts(opts) {
        const o = opts || {};
        const c = (typeof CONFIG !== 'undefined') ? CONFIG : {};
        return {
            laneCount: o.laneCount || c.STRIP_LANE_COUNT || 3,
            markerWidth: o.markerWidth || c.STRIP_MARKER_WIDTH || 24,
        };
    }

    // Overdue + actually camped at the base (non-threatening overdue items never
    // get `enemy-at-base`, so they stay ordinary lane markers).
    function isAtBase(item) {
        if (!item.isOverdue) return false;
        const el = item.element;
        if (el && el.classList && typeof el.classList.contains === 'function') {
            return el.classList.contains('enemy-at-base');
        }
        return true;
    }

    // Negative-habit lurker parked beside the base (loop.js adds the class once
    // its tempting time passes). Never overdue, so it is NOT in the attacker
    // pile; it gets its own small pile standing BEHIND the attackers.
    function isParkedLurker(item) {
        const el = item.element;
        return !!(el && el.classList && typeof el.classList.contains === 'function'
            && el.classList.contains('lurker-parked'));
    }

    // List-order key per item (js/listOrder.js): row index for top-level items,
    // due-time slot (+0.5) for sub-tasks. null when ListOrder isn't loaded or
    // opts.noListOrder is set -> callers fall back to x order (pre-2026-10-13).
    function byXThenId(a, b) { return (a.x - b.x) || (a.id - b.id); }

    function listKeys(items, opts) {
        if (opts && opts.keys) return opts.keys;
        if (opts && opts.noListOrder) return null;
        if (typeof ListOrder === 'undefined') return null;
        return ListOrder.sortKeys(ListOrder.compute(items), items);
    }

    function computeStripLayout(items, opts) {
        const { laneCount, markerWidth } = stripOpts(opts);
        const keys = listKeys(items, opts);
        // Order for dealing lanes / picking cluster leaders: list order when
        // known (top of list = most forward), else x order.
        const byKey = (a, b) => {
            if (keys) {
                const ka = keys.has(a.id) ? keys.get(a.id) : Infinity;
                const kb = keys.has(b.id) ? keys.get(b.id) : Infinity;
                if (ka !== kb) return ka - kb;
            }
            return byXThenId(a, b);
        };
        const byId = new Map();
        items.forEach(i => byId.set(i.id, i));
        const plan = {};

        const stackedOn = i => {
            if (!i.parentId) return null;
            const parent = byId.get(i.parentId);
            return (parent && Math.abs(i.x - parent.x) < 1) ? parent : null;
        };
        const stackedChildren = new Map(); // parentId -> [sub, ...]
        items.forEach(i => {
            const parent = stackedOn(i);
            if (parent && !isAtBase(i)) {
                if (!stackedChildren.has(parent.id)) stackedChildren.set(parent.id, []);
                stackedChildren.get(parent.id).push(i);
            }
        });
        const isStackedChild = i => !!stackedOn(i) && !isAtBase(i);
        const childCount = i => (stackedChildren.get(i.id) || []).length;

        // Everything that owns a marker: not a stacked child.
        const owners = items.filter(i => !isStackedChild(i));
        const lurkerPile = owners.filter(i => !isAtBase(i) && isParkedLurker(i)).sort(byKey);
        const pile = owners.filter(isAtBase)
            .sort((a, b) => ((a.parentId ? 1 : 0) - (b.parentId ? 1 : 0)) || byKey(a, b));
        const laned = owners.filter(i => !isAtBase(i) && !isParkedLurker(i)).sort(byKey);

        const ensure = i => (plan[i.id] = plan[i.id] || { lane: null, hidden: false, badge: 0 });
        const hide = (member, leader) => {
            ensure(member).hidden = true;
            ensure(leader).badge += 1 + childCount(member);
            (stackedChildren.get(member.id) || []).forEach(c => { ensure(c).hidden = true; });
        };

        // Pile at the base.
        pile.forEach((m, idx) => {
            const e = ensure(m);
            if (idx === 0) return;
            hide(m, pile[0]);
        });

        // Parked-lurker pile (behind the attackers): the top-of-list lurker is
        // shown, the rest fold into its "+N" badge. No lane.
        lurkerPile.forEach((m, idx) => {
            ensure(m);
            if (idx > 0) hide(m, lurkerPile[0]);
        });

        // Lanes: top of the LIST -> front lane (highest index). Outside tie
        // groups list order == due order == x order, so this is the old
        // behavior; inside a group the hand-ordered top row takes the front.
        const lanes = Array.from({ length: laneCount }, () => []);
        laned.forEach((m, idx) => {
            const lane = (laneCount - 1) - (idx % laneCount);
            ensure(m).lane = lane;
            lanes[lane].push(m);
        });
        lanes.forEach(list => {
            // Collapse runs of same-lane markers closer than a marker width
            // (runs are found in x order); the run's visible marker is the
            // TOP-OF-LIST one, not merely the nearest to the base.
            list.sort(byXThenId);
            let run = [];
            const flush = () => {
                if (run.length > 1) {
                    const top = run.slice().sort(byKey)[0];
                    run.forEach(m => { if (m !== top) hide(m, top); });
                }
                run = [];
            };
            list.forEach(m => {
                if (run.length && (m.x - run[0].x) >= markerWidth) flush();
                run.push(m);
            });
            flush();
        });

        // Stacked children: follow the parent's lane / hidden state, and a
        // visible parent's badge counts them.
        owners.forEach(o => {
            (stackedChildren.get(o.id) || []).forEach(c => {
                const ce = ensure(c);
                ce.lane = ensure(o).lane;
                if (!plan[o.id].hidden) plan[o.id].badge += 1;
            });
        });
        return plan;
    }

    // Writes only on change (called every game tick).
    function applyStripLayout(items) {
        const plan = active ? computeStripLayout(items) : {};
        items.forEach(i => {
            const el = i.element;
            if (!el || !el.dataset) return;
            const p = plan[i.id] || { lane: null, hidden: false, badge: 0 };
            setData(el, 'lane', p.lane == null ? null : String(p.lane));
            setData(el, 'subCount', p.badge > 0 ? String(p.badge) : null);
            if (el.classList) el.classList.toggle('strip-hidden', !!p.hidden);
        });
    }

    function setData(el, key, value) {
        if (value === null) {
            if (el.dataset[key] !== undefined) delete el.dataset[key];
        } else if (el.dataset[key] !== value) {
            el.dataset[key] = value;
        }
    }

    return { GLANCE_QUERY, isGlanceStrip, isActive, applyBodyClass, init, computeSubBadges, applySubBadges,
        computeStripLayout, applyStripLayout, isParkedLurker };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Layout;
}
