/**
 * GraveyardView -- DOM half of the V7 W0 graveyard zone (2026-10-28;
 * docs/WORLD_FEEDBACK_PLAN.md). The maths is in js/graveyardLayout.js (pure, unit-tested);
 * this file only measures the canvas, writes element positions and wires the taps.
 *
 *   #graveyardZone   the fixed-width FLAT fenced plot on the right (CONFIG.GRAVEYARD_HILL_WIDTH_PX, 120; graveyard v3, 2026-11-23: no hill, no
 *                    tree). Its three picture layers (ground, fence back, fence front) are CSS-drawn at 2x (css/graveyard.css); the
 *                    stones layer holds the ONE Memorial obelisk (the Memorial's stage, js/memorial.js: floor of the average of the 8
 *                    buildings' all-time best tiers) and the seven headstones. One tap box opens the Memorial window
 *                    (js/ui/memorialPanel.js; run graves still open Stats). The front fence is drawn over the stones and takes no taps.
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
 *         onOpenMemorial: () => void   (the obelisk's tap),
 *         getMarkers: () => [{ id, name, stage, tierLabel }] in slot order (js/milestoneMarkers.js: one small stone per all-time achievement,
 *                      stage 0..4), or null to hide them (DEV: ?markers=off),
 *         onOpenMarkers: (id) => void  (a marker's tap; every marker opens the same window, which highlights `id`),
 *         onOpenStats: () => void }   (a run grave's tap)
 *
 * Milestone markers (2026-11-08; v2 2026-11-23): up to CONFIG.MARKER_SLOTS.length 48px stones (24x24 art at 2x) on the plot's staggered grid. They share
 * the stones layer (so they are clipped at the zone's right edge and CONFIG.GRAVEYARD_ART_REACH_PX past its left) and draw in front of the Memorial
 * (z >= CONFIG.MARKER_Z_BASE) but behind the front fence.
 */
const GraveyardView = (() => {
    let deps = null;
    let canvasEl = null;
    let zoneEl = null;
    let memorialLayerEl = null;
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

    // Plot height = the lane band's top edge (CONFIG.GRAVEYARD_HILL_HEIGHT_PX, 72); without it (old configs / tests)
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

    function openMarkers(id, e) {
        if (e && e.stopPropagation) e.stopPropagation(); // Modal's document click would dismiss the window at once
        if (deps && deps.onOpenMarkers) deps.onOpenMarkers(id);
    }

    // The Memorial's geometry from CONFIG (docs/ART_STYLE "Memorial obelisk T1-T5"). The PNG is artW x artH, drawn 1:1, bottom-aligned. Its
    // plinth ends at row `plinthRow`, with `below` = artH - 1 - plinthRow transparent rows under it, so the plinth's lower edge stands `feet` px
    // above the canvas bottom when the sprite's own bottom edge is `below` px lower still. The sprite's centre column sits `centerX` px in
    // from the zone's left edge. The tap box is hitW x hitH, centred on the obelisk with its bottom on the plinth's lower edge; the art is
    // placed inside it with negative left/bottom offsets (the art is wider and lower than the box).
    // Tap boxes must stay >= 44 SCREEN px. When the scene is drawn smaller than its layout (DEV spike ?sceneScale=, js/sceneScale.js),
    // a 44px layout box shows smaller, so every graveyard tap box grows to 44 / scale layout px (44 when unscaled).
    function minTapPx() {
        const s = (typeof SceneScale !== 'undefined' && SceneScale.get) ? SceneScale.get() : 1;
        return (s > 0 && s < 1) ? Math.ceil(44 / s) : 44;
    }

    function memorialGeometry(c) {
        const artW = c.GRAVEYARD_MEMORIAL_ART_W_PX || 128;
        const artH = c.GRAVEYARD_MEMORIAL_ART_H_PX || 192;
        const plinthRow = typeof c.GRAVEYARD_MEMORIAL_PLINTH_ROW === 'number' ? c.GRAVEYARD_MEMORIAL_PLINTH_ROW : 181;
        const feet = typeof c.GRAVEYARD_MEMORIAL_FEET_PX === 'number' ? c.GRAVEYARD_MEMORIAL_FEET_PX : 86;
        const centerX = typeof c.GRAVEYARD_MEMORIAL_CENTER_X_PX === 'number' ? c.GRAVEYARD_MEMORIAL_CENTER_X_PX : 92;
        const hitW = Math.max(minTapPx(), c.GRAVEYARD_MEMORIAL_HIT_W_PX || 72);
        const hitH = Math.max(minTapPx(), c.GRAVEYARD_MEMORIAL_HIT_H_PX || 132);
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
        b.style.zIndex = '20'; // behind every headstone (z >= MARKER_Z_BASE 21)
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

    // Milestone markers (docs/ART_STYLE "Milestone markers"): one >=44px button per marker in the stones layer, holding its 24x24 picture (shown at 2x) (chosen by
    // data-stage in css/graveyard.css). Positions come from CONFIG.MARKER_SLOTS via MilestoneMarkers.placements; the marker nearest the viewer is drawn in
    // front. Appended AFTER renderMemorial, which clears the layer.
    function markerLabel(m) {
        const t = (typeof Theme !== 'undefined' && Theme.strings && Theme.strings.markers) ? Theme.strings.markers : null;
        const tier = m.tierLabel || (t ? t.noBadge : 'No badge yet');
        return t ? Theme.fill(t.openLabel, { name: m.name, tier }) : `${m.name}, ${tier}. Open`;
    }

    function renderMarkers(c, markers) {
        if (!Array.isArray(markers) || !markers.length || typeof MilestoneMarkers === 'undefined') return;
        const slots = Array.isArray(c.MARKER_SLOTS) ? c.MARKER_SLOTS : [];
        const places = MilestoneMarkers.placements(slots, { artPx: c.MARKER_ART_PX, hitPx: Math.max(minTapPx(), c.MARKER_HIT_PX || 44), zBase: c.MARKER_Z_BASE });
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
            // 44px box (css/graveyard.css) centred on the stone, bottom 2px under its feet; bigger when the scene is scaled down (minTapPx).
            const tap = minTapPx();
            b.style.left = (g.x - tap / 2) + 'px';
            b.style.top = Math.round(feet - (tap - 2)) + 'px';
            if (tap > 44) { b.style.width = tap + 'px'; b.style.height = tap + 'px'; }
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
            canvasEl.style.setProperty('--gy-hill-w', (c.GRAVEYARD_HILL_WIDTH_PX || 120) + 'px');
            canvasEl.style.setProperty('--gy-hill-h', hillHeight(c) + 'px');
            canvasEl.style.setProperty('--gy-reach', (typeof c.GRAVEYARD_ART_REACH_PX === 'number' ? c.GRAVEYARD_ART_REACH_PX : 48) + 'px');
        }
        const hillW = zoneWidth();
        const canvasW = canvasEl.offsetWidth || 0;
        const canvasH = canvasEl.offsetHeight || 0;
        const baseW = (typeof baseWidth === 'number' ? baseWidth : 0);
        const history = (deps.getRunHistory && deps.getRunHistory()) || [];
        const stage = (deps.getMemorialStage && deps.getMemorialStage());
        const markers = (deps.getMarkers && deps.getMarkers()) || null;
        const markerSig = markers ? markers.map(m => m.id + ':' + m.stage).join(',') : '-';
        const sig = [hillW, canvasW, canvasH, baseW, stage == null ? '-' : stage, markerSig, history.map(r => r && r.run).join(',')].join('|');
        if (sig === lastSig) return;
        lastSig = sig;
        if (hillW === 0) { // portrait strip / hidden: nothing to place
            memorialLayerEl.textContent = '';
            runsEl.textContent = '';
            return;
        }
        renderMemorial(c, stage);
        renderMarkers(c, markers);
        renderRuns(c, canvasW, canvasH, hillW, baseW);
    }

    function init(d) {
        deps = d;
        canvasEl = document.getElementById('gameCanvas');
        zoneEl = document.getElementById('graveyardZone');
        memorialLayerEl = document.getElementById('graveyardStones');
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
