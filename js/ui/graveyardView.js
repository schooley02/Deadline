/**
 * GraveyardView -- DOM half of the V7 W0 graveyard zone (2026-10-28;
 * docs/WORLD_FEEDBACK_PLAN.md). The maths is in js/graveyardLayout.js (pure, unit-tested);
 * this file only measures the canvas, writes element positions and wires the taps.
 *
 *   #graveyardZone   fixed-width hill on the right (CONFIG.GRAVEYARD_HILL_WIDTH_PX), one
 *                    headstone button per achievement family in staggered lanes. W0 art is a
 *                    placeholder stone; W2 swaps in tier art. A tap opens Stats.
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
 *         getAchievementFamilies: () => [{ id, name }], onOpenStats: () => void }
 */
const GraveyardView = (() => {
    let deps = null;
    let canvasEl = null;
    let zoneEl = null;
    let stonesEl = null;
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

    // Hill height: front-lane feet pad + the rise of the back lanes + a little crest above them.
    function hillHeight(c) {
        const lanes = Math.max(1, c.GRAVEYARD_LANES || 3);
        return (c.GROUND_FLOOR_FEET_BOTTOM_PAD || 8) + (lanes - 1) * (c.GRAVEYARD_LANE_RISE_PX || 28) + 6;
    }

    function open(e) {
        if (e && e.stopPropagation) e.stopPropagation(); // Modal's document click would dismiss the window at once
        if (deps && deps.onOpenStats) deps.onOpenStats();
    }

    function makeButton(cls, label) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = cls;
        b.setAttribute('aria-label', label);
        b.addEventListener('click', open);
        return b;
    }

    function renderStones(c, hillW) {
        const families = (deps && deps.getAchievementFamilies && deps.getAchievementFamilies()) || [];
        const opts = GraveyardLayout.fromConfig(c);
        const pad = c.GROUND_FLOOR_FEET_BOTTOM_PAD || 8;
        const slots = GraveyardLayout.stoneSlots(families.length, hillW, pad, opts);
        stonesEl.textContent = '';
        slots.forEach(slot => {
            const fam = families[slot.index];
            const b = makeButton('graveyard-stone', `${fam.name} achievements`);
            b.dataset.family = fam.id;
            b.dataset.lane = String(slot.lane);
            b.style.left = slot.x + 'px';
            b.style.bottom = (slot.feetFromBottom - 2) + 'px';
            b.style.zIndex = String(20 - slot.lane);
            const art = document.createElement('span');
            art.className = 'graveyard-stone-art';
            b.appendChild(art);
            stonesEl.appendChild(b);
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
        const families = (deps.getAchievementFamilies && deps.getAchievementFamilies()) || [];
        const sig = [hillW, canvasW, canvasH, baseW, families.length, history.map(r => r && r.run).join(',')].join('|');
        if (sig === lastSig) return;
        lastSig = sig;
        if (hillW === 0) { // portrait strip / hidden: nothing to place
            stonesEl.textContent = '';
            runsEl.textContent = '';
            return;
        }
        renderStones(c, hillW);
        renderRuns(c, canvasW, canvasH, hillW, baseW);
    }

    function init(d) {
        deps = d;
        canvasEl = document.getElementById('gameCanvas');
        zoneEl = document.getElementById('graveyardZone');
        stonesEl = document.getElementById('graveyardStones');
        runsEl = document.getElementById('runGraves');
        lastSig = null;
        if (!canvasEl || !zoneEl || !stonesEl || !runsEl) { deps = null; return; }
        render();
    }

    return { init, render, zoneWidth, hillHeight };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraveyardView;
}
