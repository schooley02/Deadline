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
 * Lane layering + overlap avoidance (2026-10-13 evening): z-index follows the LANE
 * (front lane over middle over back; ListOrder.zIndexes with opts.lanes), and zombies
 * that would overlap by more than CONFIG.LANE_CONFLICT_FRAC move to a free lane so each
 * stays tappable (assignLanes below). Overdue attackers at the base use lanes too; the
 * "+N" badge appears only when every lane is blocked at that spot (strip only).
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
    const CONFIG_STRIP = {
        get gap() { return (typeof CONFIG !== 'undefined' && CONFIG.STRIP_SUBTASK_GAP_PX) || 14; },
        get count() { return (typeof CONFIG !== 'undefined' && CONFIG.STRIP_SUBTASK_SPREAD_COUNT) || 2; },
    };

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

    // --- Lane assignment with overlap avoidance (2026-10-13) ---------------------
    // entries: [{ item, x, w }] in PRIORITY order (top of the list first). Each entry
    // wants its "natural" lane (list position dealt round-robin, front lane first -- the
    // pre-existing rule) and takes it unless a higher-priority entry already in that lane
    // is closer than frac x min(widths). Then the nearest free lane (ties -> the front
    // one). When every lane is blocked the entry keeps its natural lane and records the
    // first blocking entry as `leader` (the strip folds it into that one's "+N" badge).
    // keepOverflow: overflow entries still block later ones (landscape: they stay visible).
    function assignLanes(entries, laneCount, frac, keepOverflow) {
        const placed = [];
        const out = new Map();
        entries.forEach((e, idx) => {
            const natural = (laneCount - 1) - (idx % laneCount);
            const clash = (p) => Math.abs(p.x - e.x) < frac * Math.min(p.w, e.w);
            const order = Array.from({ length: laneCount }, (_, l) => l)
                .sort((a, b) => (Math.abs(a - natural) - Math.abs(b - natural)) || (b - a));
            const free = order.find(l => !placed.some(p => p.lane === l && clash(p)));
            if (free === undefined) {
                const blocker = placed.find(clash);
                out.set(e.item.id, { lane: natural, leader: blocker ? blocker.id : null });
                if (keepOverflow) placed.push({ id: e.item.id, x: e.x, w: e.w, lane: natural });
                return;
            }
            out.set(e.item.id, { lane: free, leader: null });
            placed.push({ id: e.item.id, x: e.x, w: e.w, lane: free });
        });
        return out;
    }

    function conflictFrac(opts) {
        const v = (opts && opts.conflictFrac != null) ? opts.conflictFrac
            : (typeof CONFIG !== 'undefined' ? CONFIG.LANE_CONFLICT_FRAC : null);
        return (typeof v === 'number') ? v : 0.6;
    }

    function laneMap(plan, items) {
        const m = new Map();
        items.forEach(i => { if (plan[i.id]) m.set(i.id, plan[i.id].lane); });
        return m;
    }

    function computeStripLayout(items, opts) {
        const { laneCount, markerWidth } = stripOpts(opts);
        const frac = conflictFrac(opts);
        const baseWidth = (opts && opts.baseWidth) || 0;
        const attackerWidth = (opts && opts.attackerWidth)
            || ((typeof CONFIG !== 'undefined' && CONFIG.STRIP_ATTACKER_WIDTH) || 64);
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

        // Spread subs (2026-10-13): a sub a small gap TOWARD THE CHURCH from its parent
        // (Movement.getSubTaskClusterOffset, strip mode) keeps its own marker but takes a
        // lane different from the parent's, so parent + sub read as two items instead of
        // one with a "+N". Hidden whenever the parent is hidden.
        const spreadMax = (CONFIG_STRIP.gap * CONFIG_STRIP.count) + 1;
        const spreadOf = i => {
            if (!i.parentId || isAtBase(i) || stackedOn(i)) return null;
            const parent = byId.get(i.parentId);
            if (!parent) return null;
            const d = parent.x - i.x;
            return (d > 0 && d <= spreadMax) ? parent : null;
        };
        const spreadChildren = new Map(); // parentId -> [sub, ...] (id order)
        items.slice().sort((a, b) => a.id - b.id).forEach(i => {
            const parent = spreadOf(i);
            if (parent) {
                if (!spreadChildren.has(parent.id)) spreadChildren.set(parent.id, []);
                spreadChildren.get(parent.id).push(i);
            }
        });
        const isSpreadChild = i => !!spreadOf(i);
        const childCount = i => (stackedChildren.get(i.id) || []).length
            + (spreadChildren.get(i.id) || []).length;

        // Everything that owns a marker: not a stacked or spread child.
        const owners = items.filter(i => !isStackedChild(i) && !isSpreadChild(i));
        const lurkerPile = owners.filter(i => !isAtBase(i) && isParkedLurker(i)).sort(byKey);
        // Walkers AND overdue attackers at the base share the lanes (2026-10-13): attackers
        // used to fold into one big pile sprite; now they spread over the lanes like
        // everything else and only overflow beyond laneCount into a "+N" badge.
        const laned = owners.filter(i => isAtBase(i) || !isParkedLurker(i)).sort(byKey);

        const ensure = i => (plan[i.id] = plan[i.id] || { lane: null, hidden: false, badge: 0 });
        const hide = (member, leader) => {
            ensure(member).hidden = true;
            ensure(leader).badge += 1 + childCount(member);
            (stackedChildren.get(member.id) || []).forEach(c => { ensure(c).hidden = true; });
            (spreadChildren.get(member.id) || []).forEach(c => { ensure(c).hidden = true; });
        };

        // Parked-lurker pile (behind the attackers): the top-of-list lurker is
        // shown, the rest fold into its "+N" badge. No lane.
        lurkerPile.forEach((m, idx) => {
            ensure(m);
            if (idx > 0) hide(m, lurkerPile[0]);
        });

        // Lanes: top of the LIST -> front lane (highest index) as the starting point.
        // Outside tie groups list order == due order == x order, so that is the old
        // dealing; inside a group the hand-ordered top row takes the front. A marker
        // whose lane is already taken by a higher-priority one within frac x width
        // moves to the nearest free lane; only when all lanes are blocked does it fold
        // into the top-of-list blocker's "+N" badge.
        const assigned = assignLanes(
            laned.map(m => ({ item: m, x: Math.max(m.x, baseWidth), w: isAtBase(m) ? attackerWidth : markerWidth })),
            laneCount, frac, false);
        laned.forEach(m => {
            const a = assigned.get(m.id);
            ensure(m).lane = a.lane;
            if (a.leader != null) hide(m, byId.get(a.leader));
        });

        // Stacked children: follow the parent's lane / hidden state, and a
        // visible parent's badge counts them.
        owners.forEach(o => {
            (stackedChildren.get(o.id) || []).forEach(c => {
                const ce = ensure(c);
                ce.lane = ensure(o).lane;
                if (!plan[o.id].hidden) plan[o.id].badge += 1;
            });
            // Spread subs: lanes other than the parent's, nearest lane first.
            const kids = spreadChildren.get(o.id) || [];
            if (kids.length) {
                const pl = ensure(o).lane;
                const other = Array.from({ length: laneCount }, (_, l) => l)
                    .filter(l => l !== pl)
                    .sort((a, b) => (pl == null ? b - a : (Math.abs(a - pl) - Math.abs(b - pl)) || (a - b)));
                kids.forEach((c, k) => {
                    const ce = ensure(c);
                    if (plan[o.id].hidden) { ce.hidden = true; ce.lane = pl; return; }
                    ce.lane = other.length ? other[k % other.length] : pl;
                });
            }
        });
        return plan;
    }

    // --- Landscape / desktop ground lanes (2026-10-13) ----------------------
    // Pure: { [id]: lane } for top-level items, dealt in LIST order (top row =
    // front lane = highest index = lowest on screen), same rule as the strip.
    function computeGroundLanes(items, opts) {
        const laneCount = (opts && opts.laneCount)
            || ((typeof CONFIG !== 'undefined' && CONFIG.STRIP_LANE_COUNT) || 3);
        const keys = listKeys(items, opts);
        const byKey = (a, b) => {
            if (keys) {
                const ka = keys.has(a.id) ? keys.get(a.id) : Infinity;
                const kb = keys.has(b.id) ? keys.get(b.id) : Infinity;
                if (ka !== kb) return ka - kb;
            }
            return byXThenId(a, b);
        };
        const baseWidth = (opts && opts.baseWidth) || 0;
        const cw = (typeof CONFIG !== 'undefined' && (CONFIG.ENEMY_WIDTH || CONFIG.HABIT_ENEMY_WIDTH)) || 128;
        const widthOf = i => (i.element && i.element.offsetWidth > 0 ? i.element.offsetWidth : cw);
        const top = items.filter(i => !i.parentId).sort(byKey);
        const assigned = assignLanes(
            top.map(m => ({ item: m, x: Math.max(m.x, baseWidth), w: widthOf(m) })),
            laneCount, conflictFrac(opts), true);
        const lanes = {};
        top.forEach(m => { lanes[m.id] = assigned.get(m.id).lane; });
        return lanes;
    }

    // Feet-line (px from canvas top) for a lane.
    function groundLaneFeet(lane, canvasHeight, opts) {
        const c = (typeof CONFIG !== 'undefined') ? CONFIG : {};
        const laneCount = (opts && opts.laneCount) || c.STRIP_LANE_COUNT || 3;
        const topF = (opts && opts.topFrac != null) ? opts.topFrac : (c.GROUND_LANE_FEET_TOP_FRAC != null ? c.GROUND_LANE_FEET_TOP_FRAC : 0.72);
        const botF = (opts && opts.bottomFrac != null) ? opts.bottomFrac : (c.GROUND_LANE_FEET_BOTTOM_FRAC != null ? c.GROUND_LANE_FEET_BOTTOM_FRAC : 0.99);
        const t = laneCount > 1 ? lane / (laneCount - 1) : 1;
        const px = !(opts && (opts.topFrac != null || opts.bottomFrac != null))
            && typeof c.GROUND_FLOOR_HEIGHT === 'number'
            && typeof c.GROUND_FLOOR_FEET_TOP_PAD === 'number'
            && typeof c.GROUND_FLOOR_FEET_BOTTOM_PAD === 'number';
        if (px) {
            // Floor-band anchored (floor art, 2026-10-13): see CONFIG.GROUND_FLOOR_*.
            const back = Math.max(0, canvasHeight - c.GROUND_FLOOR_HEIGHT + c.GROUND_FLOOR_FEET_TOP_PAD);
            const front = Math.max(back, canvasHeight - c.GROUND_FLOOR_FEET_BOTTOM_PAD);
            return back + t * (front - back);
        }
        return (topF + t * (botF - topF)) * canvasHeight;
    }

    // Writes element tops only on change; no-op in portrait strip mode (the
    // strip has its own lanes). Parents first, subs bottom-align to their parent.
    function applyGroundLanes(items, canvasHeight, opts) {
        if (active || !canvasHeight) return;
        const layout = (typeof ListOrder !== 'undefined' && !(opts && (opts.noListOrder || opts.keys))) ? ListOrder.compute(items) : null;
        const lanes = computeGroundLanes(items, layout ? Object.assign({}, opts, { keys: ListOrder.sortKeys(layout, items) }) : opts);
        const tops = new Map();
        const heightOf = el => parseFloat(el.style && el.style.height) || el.offsetHeight || 0;
        const write = (item, top) => {
            const el = item.element;
            tops.set(item.id, top);
            if (!el || !el.style) return;
            const cur = parseFloat(el.style.top);
            if (isNaN(cur) || Math.abs(cur - top) >= 0.5) el.style.top = top + 'px';
        };
        items.filter(i => !i.parentId).forEach(i => {
            const el = i.element;
            if (!el || lanes[i.id] == null) return;
            const h = heightOf(el);
            const top = Math.max(0, Math.min(groundLaneFeet(lanes[i.id], canvasHeight, opts) - h, canvasHeight - h));
            write(i, Math.round(top));
            if (el.dataset) setData(el, 'lane', String(lanes[i.id]));
        });
        items.filter(i => i.parentId).forEach(i => {
            const el = i.element;
            const parent = items.find(p => p.id === i.parentId);
            if (el && el.dataset) setData(el, 'lane', null); // subs ride their parent's lane (no stale strip lane)
            if (!el || !parent || !parent.element || !tops.has(parent.id)) return;
            const h = heightOf(el);
            write(i, Math.round(tops.get(parent.id) + (heightOf(parent.element) - h)));
        });
        // z follows the lane: front lane over middle over back (list order inside a lane).
        if (layout) ListOrder.applyZ(layout, items, new Map(items.filter(i => lanes[i.id] != null).map(i => [i.id, lanes[i.id]])));
    }

    // Writes only on change (called every game tick).
    function applyStripLayout(items, opts) {
        const layout = (active && typeof ListOrder !== 'undefined') ? ListOrder.compute(items) : null;
        const plan = active
            ? computeStripLayout(items, layout ? Object.assign({ keys: ListOrder.sortKeys(layout, items) }, opts) : opts)
            : {};
        items.forEach(i => {
            const el = i.element;
            if (!el || !el.dataset) return;
            const p = plan[i.id] || { lane: null, hidden: false, badge: 0 };
            // Outside strip mode data-lane belongs to applyGroundLanes (landscape): don't fight it.
            if (active) setData(el, 'lane', p.lane == null ? null : String(p.lane));
            setData(el, 'subCount', p.badge > 0 ? String(p.badge) : null);
            if (el.classList) el.classList.toggle('strip-hidden', !!p.hidden);
        });
        // z follows the lane (front lane over middle over back); no lane (parked lurker) = behind.
        if (layout) ListOrder.applyZ(layout, items, laneMap(plan, items));
    }

    function setData(el, key, value) {
        if (value === null) {
            if (el.dataset[key] !== undefined) delete el.dataset[key];
        } else if (el.dataset[key] !== value) {
            el.dataset[key] = value;
        }
    }

    return { GLANCE_QUERY, isGlanceStrip, isActive, applyBodyClass, init, computeSubBadges, applySubBadges,
        computeStripLayout, applyStripLayout, isParkedLurker,
        computeGroundLanes, groundLaneFeet, applyGroundLanes, assignLanes };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Layout;
}
