/**
 * GraveyardView -- DOM half of the V7 W0 graveyard zone (2026-10-28;
 * docs/WORLD_FEEDBACK_PLAN.md). The maths is in js/graveyardLayout.js (pure, unit-tested);
 * this file only measures the canvas, writes element positions and wires the taps.
 *
 *   #graveyardZone   fixed-width hill on the right (CONFIG.GRAVEYARD_HILL_WIDTH_PX) with ONE Memorial obelisk on its flat top
 *                    (2026-11-08; it replaced the six placeholder headstones, one per achievement family). The sprite is the
 *                    Memorial's stage (js/memorial.js: floor of the average of the 8 buildings' all-time best tiers), drawn in front
 *                    of the tree; one tap box opens the Memorial window (js/ui/memorialPanel.js; run graves still open Stats).
 *   #runGraves       past-run graves on the ZOMBIE lanes (newest next to the hill). Each is a
 *                    direct child with its own z-index just under its lane's zombies (lane L
 *                    zombies own z CONFIG.LIST_Z_MIN + L*CONFIG.LIST_Z_LANE_STRIDE and up), so
 *                    a grave is tappable only where no zombie covers it. A tap opens Stats.
 *
 * Landscape/desktop only: css/glanceStrip.css hides both layers in the portrait strip, so
 * zoneWidth() is 0 there and the zombie field spans the whole canvas. script.js
 * refreshLayoutDims() reads zoneWidth() and subtracts it from the field width; call
 * render() after every layout change. render() is idempotent (a signature of everything it
 * depends on gates the DOM writes) so it is also safe to call every game tick.
 *
 * Deps: { getRunHistory: () => newest-first array of run records ({ run: n, ... }),
 *         getMemorialStage: () => 1..5, or null to hide the obelisk (DEV: ?memorialTier=off),
 *         getTreeStage: () => 1..3 (sapling / young / giant by lifetime nights, js/treeGrowth.js), or null to hide the tree (DEV: ?treeStage=off),
 *         onOpenMemorial: () => void   (the obelisk's tap),
 *         onOpenTree: () => void       (the tree's tap box, beside the obelisk; opens the Tree window),
 *         getMarkers: () => [{ id, name, stage, tierLabel }] in slot order (js/milestoneMarkers.js: one small stone per all-time achievement,
 *                      stage 0..4), or null to hide them (DEV: ?markers=off),
 *         onOpenMarkers: (id) => void  (a marker's tap; every marker opens the same window, which highlights `id`),
 *         onOpenStats: () => void }   (a run grave's tap)
 *
 * Milestone markers (2026-11-08): up to CONFIG.MARKER_SLOTS.length small stones on the hill's face, between the Memorial and the tree's trunk
 * and below the obelisk. They share the stones layer (so they are clipped at the zone's edges) and draw in front of the Memorial (z >= CONFIG.MARKER_Z_BASE).
 */
const GraveyardView = (() => {
    let deps = null;
    let canvasEl = null;
    let zoneEl = null;
    let memorialLayerEl = null;
    let treeEl = null;
    let treeClipEl = null;
    let runsEl = null;
    let lastSig = null;

    function cfg() {
        return (typeof CONFIG !== 'undefined') ? CONFIG : {};
    }

    // Width the zombie field must give up on the right. 0 when the zone is hidden (portrait strip)
    // or absent (Jest).
    function zoneWidth() {
        if (!zoneEl) return 0;
        return zoneEl.offsetWidth || 0;
    }

    // Hill height: the PixelLab mound's flat top (CONFIG.GRAVEYARD_HILL_HEIGHT_PX, 2026-11-08); without it (old configs / tests)
    // fall back to front-lane feet pad + the rise of the back lanes + a little crest above them.
    function hillHeight(c) {
        if (typeof c.GRAVEYARD_HILL_HEIGHT_PX === 'number') return c.GRAVEYARD_HILL_HEIGHT_PX;
        const lanes = Math.max(1, c.GRAVEYARD_LANES || 3);
        return (c.GROUND_FLOOR_FEET_BOTTOM_PAD || 8) + (lanes - 1) * (c.GRAVEYARD_LANE_RISE_PX || 28) + 6;
    }

    function open(e) {
        if (e && e.stopPropagation) e.stopPropagation(); // Modal's document click would dismiss the window at once
        if (deps && deps.onOpenStats) deps.onOpenStats();
    }

    function makeButton(cls, label, handler) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.setAttribute('aria-label', label);
        b.addEventListener('click', handler || open);
        return b;
    }

    function openMemorial(e) {
        if (e && e.stopPropagation) e.stopPropagation(); // Modal's document click would dismiss the window at once
        if (deps && deps.onOpenMemorial) deps.onOpenMemorial();
    }

    function openTree(e) {
        if (e && e.stopPropagation) e.stopPropagation(); // Modal's document click would dismiss the window at once
        if (deps && deps.onOpenTree) deps.onOpenTree();
    }

    function openMarkers(id, e) {
        if (e && e.stopPropagation) e.stopPropagation(); // Modal's document click would dismiss the window at once
        if (deps && deps.onOpenMarkers) deps.onOpenMarkers(id);
    }

    // The Memorial's geometry from CONFIG (docs/ART_STYLE "Memorial obelisk T1-T5"). The PNG is artW x artH, drawn 1:1, bottom-aligned. Its
    // plinth ends at row `plinthRow`, with `below` = artH - 1 - plinthRow transparent rows under it, so the plinth's lower edge stands `feet` px
    // above the canvas bottom when the sprite's own bottom edge is `below` px lower still. The sprite's centre column sits `centerX` px in
    // from the zone's left edge. The tap box is hitW x hitH, centred on the obelisk with its bottom on the plinth's lower edge; the art is
    // placed inside it with negative left/bottom offsets (the art is wider and lower than the box).
    function memorialGeometry(c) {
        const artW = c.GRAVEYARD_MEMORIAL_ART_W_PX || 128;
        const artH = c.GRAVEYARD_MEMORIAL_ART_H_PX || 192;
        const plinthRow = typeof c.GRAVEYARD_MEMORIAL_PLINTH_ROW === 'number' ? c.GRAVEYARD_MEMORIAL_PLINTH_ROW : 181;
        const feet = typeof c.GRAVEYARD_MEMORIAL_FEET_PX === 'number' ? c.GRAVEYARD_MEMORIAL_FEET_PX : 86;
        const centerX = typeof c.GRAVEYARD_MEMORIAL_CENTER_X_PX === 'number' ? c.GRAVEYARD_MEMORIAL_CENTER_X_PX : 92;
        const hitW = Math.max(44, c.GRAVEYARD_MEMORIAL_HIT_W_PX || 72);
        const hitH = Math.max(44, c.GRAVEYARD_MEMORIAL_HIT_H_PX || 132);
        const below = artH - 1 - plinthRow; // transparent rows under the plinth's last row
        return {
            artW, artH,
            hitLeft: centerX - hitW / 2, hitBottom: feet, hitW, hitH,
            artLeft: -(artW - hitW) / 2, artBottom: -below,
        };
    }

    function renderMemorial(c, stage) {
        memorialLayerEl.textContent = '';
        if (!(stage >= 1 && stage <= 5)) return; // hidden (DEV off) or unknown: no obelisk
        const g = memorialGeometry(c);
        const b = makeButton('graveyard-memorial', `Memorial, stage ${stage} of 5. Open`, openMemorial);
        b.dataset.stage = String(stage);
        b.style.left = g.hitLeft + 'px';
        b.style.bottom = g.hitBottom + 'px';
        b.style.width = g.hitW + 'px';
        b.style.height = g.hitH + 'px';
        b.style.zIndex = '20'; // in front of the tree (its clipper is z 1 inside the zone's stacking context)
        const art = document.createElement('span');
        art.className = 'graveyard-memorial-art';
        art.setAttribute('aria-hidden', 'true');
        art.dataset.stage = String(stage);
        art.style.width = g.artW + 'px';
        art.style.height = g.artH + 'px';
        art.style.left = g.artLeft + 'px';
        art.style.bottom = g.artBottom + 'px';
        b.appendChild(art);
        memorialLayerEl.appendChild(b);
    }

    // The growing tree (docs/ART_STYLE "Growing tree"): ONE span inside the clipper, its PNG chosen by data-stage in css/graveyard.css. All three
    // stages are artW x artH drawn 1:1 with the trunk base in the same column, so only the picture changes as the tree grows. The art's
    // trunk column stands baseX px in from the zone's left edge, its bottom edge `sink` px below the hill's flat top; the clipper reaches
    // `clipLeft` px left of the zone and is cut at the zone's right edge.
    function renderTree(c, stage, hillH) {
        if (!treeEl || !treeClipEl) return;
        if (!(stage >= 1 && stage <= 3)) { treeEl.hidden = true; treeEl.removeAttribute('data-stage'); return; }
        const artW = c.GRAVEYARD_TREE_ART_W_PX || 192;
        const artH = c.GRAVEYARD_TREE_ART_H_PX || 128;
        const trunkCol = typeof c.GRAVEYARD_TREE_TRUNK_COL === 'number' ? c.GRAVEYARD_TREE_TRUNK_COL : 146;
        const baseX = typeof c.GRAVEYARD_TREE_BASE_X_PX === 'number' ? c.GRAVEYARD_TREE_BASE_X_PX : 110;
        const sink = typeof c.GRAVEYARD_TREE_SINK_PX === 'number' ? c.GRAVEYARD_TREE_SINK_PX : 15;
        const clipLeft = typeof c.GRAVEYARD_TREE_CLIP_LEFT_PX === 'number' ? c.GRAVEYARD_TREE_CLIP_LEFT_PX : 80;
        treeClipEl.style.left = (-clipLeft) + 'px';
        treeClipEl.style.bottom = (hillH - sink) + 'px';
        treeEl.hidden = false;
        treeEl.dataset.stage = String(stage);
        treeEl.style.width = artW + 'px';
        treeEl.style.height = artH + 'px';
        treeEl.style.left = (clipLeft + baseX - trunkCol) + 'px';
    }

    // The tree's tap box (2026-11-08): ONE >=44px button in the stones layer, in the strip of the zone to the right of the Memorial's box, standing
    // on the trunk's base. Transparent (the tree is drawn by the clipper); below the obelisk (z 10 < 20). Appended AFTER renderMemorial, which clears the layer.
    function renderTreeHit(c, stage, hillH) {
        if (!(stage >= 1 && stage <= 3)) return;
        const sink = typeof c.GRAVEYARD_TREE_SINK_PX === 'number' ? c.GRAVEYARD_TREE_SINK_PX : 15;
        const hitW = Math.max(44, c.GRAVEYARD_TREE_HIT_W_PX || 44);
        const hitH = Math.max(44, c.GRAVEYARD_TREE_HIT_H_PX || 110);
        const hitLeft = typeof c.GRAVEYARD_TREE_HIT_LEFT_PX === 'number' ? c.GRAVEYARD_TREE_HIT_LEFT_PX : 96;
        const b = makeButton('graveyard-tree-hit', `Tree, stage ${stage} of 3. Open`, openTree);
        b.dataset.stage = String(stage);
        b.style.left = hitLeft + 'px';
        b.style.bottom = (hillH - sink) + 'px';
        b.style.width = hitW + 'px';
        b.style.height = hitH + 'px';
        b.style.zIndex = '10';
        memorialLayerEl.appendChild(b);
    }

    // Milestone markers (docs/ART_STYLE "Milestone markers"): one >=44px button per marker in the stones layer, holding its 32x32 picture (chosen by
    // data-stage in css/graveyard.css). Positions come from CONFIG.MARKER_SLOTS via MilestoneMarkers.placements; the marker nearest the viewer is drawn in
    // front. Appended AFTER renderMemorial and renderTreeHit, which clear / fill the layer.
    function markerLabel(m) {
        const t = (typeof Theme !== 'undefined' && Theme.strings && Theme.strings.markers) ? Theme.strings.markers : null;
        const tier = m.tierLabel || (t ? t.noBadge : 'No badge yet');
        return t ? Theme.fill(t.openLabel, { name: m.name, tier }) : `${m.name}, ${tier}. Open`;
    }

    function renderMarkers(c, markers) {
        if (!Array.isArray(markers) || !markers.length || typeof MilestoneMarkers === 'undefined') return;
        const slots = Array.isArray(c.MARKER_SLOTS) ? c.MARKER_SLOTS : [];
        const places = MilestoneMarkers.placements(slots, { artPx: c.MARKER_ART_PX, hitPx: c.MARKER_HIT_PX, zBase: c.MARKER_Z_BASE });
        markers.slice(0, places.length).forEach((m, i) => {
            const p = places[i];
            const b = makeButton('milestone-marker', markerLabel(m), (e) => openMarkers(m.id, e));
            b.dataset.marker = String(m.id);
            b.dataset.stage = String(m.stage);
            b.style.left = p.hitLeft + 'px';
            b.style.bottom = p.hitBottom + 'px';
            b.style.width = p.hit + 'px';
            b.style.height = p.hit + 'px';
            b.style.zIndex = String(p.z);
            const art = document.createElement('span');
            art.className = 'milestone-marker-art';
            art.setAttribute('aria-hidden', 'true');
            art.dataset.stage = String(m.stage);
            art.style.width = p.art + 'px';
            art.style.height = p.art + 'px';
            art.style.left = p.artLeft + 'px';
            art.style.bottom = p.artBottom + 'px';
            b.appendChild(art);
            memorialLayerEl.appendChild(b);
        });
    }

    function renderRuns(c, canvasW, canvasH, hillW, baseW) {
        const history = (deps && deps.getRunHistory && deps.getRunHistory()) || [];
        const ids = history.map((r, i) => (r && typeof r.run === 'number') ? r.run : history.length - i);
        const opts = GraveyardLayout.fromConfig(c);
        const fieldRight = GraveyardLayout.fieldRight(canvasW, hillW);
        const graves = GraveyardLayout.runGraves(ids, fieldRight, baseW, opts);
        runsEl.textContent = '';
        const laneBase = c.LIST_Z_MIN || 30;
        const stride = c.LIST_Z_LANE_STRIDE || 16;
        graves.forEach(g => {
            const feet = (typeof Layout !== 'undefined' && Layout.groundLaneFeet)
                ? Layout.groundLaneFeet(g.lane, canvasH)
                : canvasH - 8;
            const b = makeButton('run-grave', `Run ${g.id} grave. Open Stats`);
            b.dataset.run = String(g.id);
            b.dataset.lane = String(g.lane);
            b.style.left = (g.x - 22) + 'px';
            b.style.top = Math.round(feet - 42) + 'px';
            b.style.zIndex = String(laneBase + g.lane * stride - 1); // just under this lane's zombies
            b.style.opacity = String(g.opacity);
            const art = document.createElement('span');
            art.className = 'run-grave-art';
            art.style.height = g.bodyH + 'px';
            art.style.transform = `rotate(${g.tiltDeg}deg)`;
            b.appendChild(art);
            runsEl.appendChild(b);
        });
    }

    function render(baseWidth) {
        if (!deps || !canvasEl || !zoneEl) return;
        const c = cfg();
        if (!canvasEl.style.getPropertyValue('--gy-hill-w')) {
            canvasEl.style.setProperty('--gy-hill-w', (c.GRAVEYARD_HILL_WIDTH_PX || 140) + 'px');
            canvasEl.style.setProperty('--gy-hill-h', hillHeight(c) + 'px');
        }
        const hillW = zoneWidth();
        const canvasW = canvasEl.offsetWidth || 0;
        const canvasH = canvasEl.offsetHeight || 0;
        const baseW = (typeof baseWidth === 'number' ? baseWidth : 0);
        const history = (deps.getRunHistory && deps.getRunHistory()) || [];
        const stage = (deps.getMemorialStage && deps.getMemorialStage());
        const treeStage = (deps.getTreeStage && deps.getTreeStage());
        const markers = (deps.getMarkers && deps.getMarkers()) || null;
        const markerSig = markers ? markers.map(m => m.id + ':' + m.stage).join(',') : '-';
        const sig = [hillW, canvasW, canvasH, baseW, stage == null ? '-' : stage, treeStage == null ? '-' : treeStage, markerSig, history.map(r => r && r.run).join(',')].join('|');
        if (sig === lastSig) return;
        lastSig = sig;
        if (hillW === 0) { // portrait strip / hidden: nothing to place
            memorialLayerEl.textContent = '';
            runsEl.textContent = '';
            return;
        }
        renderTree(c, treeStage, hillHeight(c));
        renderMemorial(c, stage);
        renderTreeHit(c, treeStage, hillHeight(c));
        renderMarkers(c, markers);
        renderRuns(c, canvasW, canvasH, hillW, baseW);
    }

    function init(d) {
        deps = d;
        canvasEl = document.getElementById('gameCanvas');
        zoneEl = document.getElementById('graveyardZone');
        memorialLayerEl = document.getElementById('graveyardStones');
        treeEl = document.getElementById('graveyardTree');
        treeClipEl = treeEl ? treeEl.parentElement : null;
        runsEl = document.getElementById('runGraves');
        lastSig = null;
        if (!canvasEl || !zoneEl || !memorialLayerEl || !runsEl) { deps = null; return; }
        render();
    }

    return { init, render, zoneWidth, hillHeight };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraveyardView;
}
