/**
 * RainFx -- the canvas half of Storm's rain (2026-11-07; the rules are in js/rainSim.js, pure and unit-tested).
 *
 * The four `.rain` hosts already in the page (css/climate.css decides which show; the far one in the scene, the near pair in
 * #climateWxNear, the mid one built inside the village by js/ui/villageView.js) each get ONE <canvas> here. The canvas is
 * drawn at 1/PX of its CSS size and stretched with `image-rendering: pixelated`, so every rain pixel is a whole PX x PX block,
 * like the sprites. One shared wind drives all four, the far canvas also draws the lightning bolt, and a lightning flash re-starts
 * the soft CSS glow (`.climate-lightning.is-flash`).
 *
 * Only runs while #gameCanvas carries `climate-storm`: a MutationObserver watches its class, and a slow timer re-finds the hosts
 * (VillageView rebuilds the mid host on every full render) and re-measures them. Under fx-reduced / fx-off / prefers-reduced-motion
 * it draws ONE still frame per host (no loop, no splashes, no bolt, no flash) -- the old behaviour, "the rain stays as a still picture".
 * The loop is capped to ~30 fps and pauses while the page is hidden.
 *
 * Deps: { getResult?: () => RunClimate result | null }   (only its `score` is read, for the intensity; a forced sky has none)
 * Everything is optional-chained so a missing canvas / context (jsdom) never throws.
 */
const RainFx = (() => {
    const PX = 2;                 // CSS pixels per rain pixel (a whole number, like the sprites)
    const FRAME_MS = 33;          // ~30 fps is plenty for rain and halves the work on a phone
    const RESCAN_MS = 600;        // how often the hosts are re-found / re-measured while it is storming
    const MAX_DT = 0.1;           // seconds; a long pause (tab hidden, slow frame) never teleports the drops
    const RGB = '184, 202, 218';  // cool grey-blue; each layer sets its own alpha
    const BOLT_RGB = '244, 247, 255';

    let deps = null;
    let canvasEl = null;
    let observer = null;
    let timer = 0;
    let raf = 0;
    let lastFrame = 0;
    let wind = null;
    let lightning = null;
    let rng = null;
    let flashEl = null;
    let entries = [];             // { host, canvas, ctx, layer, role, w, h }

    function sim() { return (typeof RainSim !== 'undefined') ? RainSim : null; }

    function roleOf(host) {
        const roles = sim() ? sim().ROLES : [];
        for (let i = 0; i < roles.length; i++) if (host.classList.contains('rain--' + roles[i])) return roles[i];
        return null;
    }

    function isStorm() { return !!(canvasEl && canvasEl.classList.contains('climate-storm')); }

    /** 'live' = animate; 'still' = one frame per host (reduced motion, or the player turned effects down / off). */
    function motionMode() {
        if (typeof document !== 'undefined' && document.querySelector('.fx-reduced, .fx-off')) return 'still';
        try {
            if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
        } catch (e) { /* no matchMedia: animate */ }
        return 'live';
    }

    function horizon() {
        let v = NaN;
        try { v = parseFloat(canvasEl.style.getPropertyValue('--clm-hz')); } catch (e) { /* default below */ }
        return (Number.isFinite(v) ? v : 224) / PX;
    }

    function intensity() {
        let score;
        try { const r = deps && deps.getResult ? deps.getResult() : null; score = r ? r.score : undefined; } catch (e) { score = undefined; }
        return sim().intensityFor(score);
    }

    // ---------------------------------------------------------------------------------------------------- hosts

    function addEntry(host, role) {
        const canvas = document.createElement('canvas');
        canvas.className = 'rain-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        host.appendChild(canvas);
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        const e = { host, canvas, ctx, layer: null, role, w: 0, h: 0 };
        entries.push(e);
        return e;
    }

    /** Find the hosts, give new ones a canvas, drop the ones VillageView removed, re-measure, follow the intensity. */
    function scan() {
        if (!canvasEl || !sim()) return;
        entries = entries.filter((e) => e.host.isConnected);
        const hosts = canvasEl.querySelectorAll('.rain');
        for (let i = 0; i < hosts.length; i++) {
            const host = hosts[i];
            const role = roleOf(host);
            if (!role) continue;
            let e = entries.find((x) => x.host === host);
            if (!e) e = addEntry(host, role);
            const w = Math.ceil(host.clientWidth / PX);
            const h = Math.ceil(host.clientHeight / PX);
            if (w < 2 || h < 2) continue;
            if (!e.layer || w !== e.w || h !== e.h) {
                e.w = w; e.h = h;
                e.canvas.width = w; e.canvas.height = h;
                if (!e.layer) e.layer = sim().createLayer(role, w, h, rng, { hz: horizon(), intensity: intensity() });
                else e.layer.resize(w, h, horizon());
                if (motionMode() === 'still') drawStill(e);
            }
        }
        const k = intensity();
        entries.forEach((e) => { if (e.layer && Math.abs(e.layer.intensity - k) > 0.05) e.layer.setIntensity(k); });
    }

    // --------------------------------------------------------------------------------------------------- drawing

    function paint(e, bolt, still) {
        const ctx = e.ctx;
        const layer = e.layer;
        if (!ctx || !layer) return;
        ctx.clearRect(0, 0, e.w, e.h);
        const a = layer.recipe.alpha;
        const slope = (wind ? wind.state.slope : 0.22) * layer.recipe.windMul;
        for (let shade = 0; shade <= 1; shade++) {
            ctx.fillStyle = 'rgba(' + RGB + ',' + (shade ? a : a * sim().SHADE_ALPHA).toFixed(3) + ')';
            for (let i = 0; i < layer.drops.length; i++) {
                const d = layer.drops[i];
                if (d.shade !== shade) continue;
                const px = sim().streak(d, slope);
                for (let j = 0; j < px.length; j++) {
                    if (px[j][1] < 0 || px[j][1] >= e.h) continue;
                    ctx.fillRect(px[j][0], px[j][1], 1, 1);
                }
            }
        }
        if (!still && layer.splashes.length) {
            ctx.fillStyle = 'rgba(' + RGB + ',' + Math.min(1, a + 0.2).toFixed(3) + ')';
            for (let i = 0; i < layer.splashes.length; i++) {
                const sp = sim().splashPixels(layer.splashes[i]);
                for (let j = 0; j < sp.length; j++) ctx.fillRect(sp[j][0], sp[j][1], 1, 1);
            }
        }
        if (bolt) {
            ctx.fillStyle = 'rgb(' + BOLT_RGB + ')';
            for (let i = 0; i < bolt.length; i++) ctx.fillRect(bolt[i][0], bolt[i][1], 1, 1);
        }
    }

    /** One frame with the drops already scattered over their fall: what the reduced-motion player sees. */
    function drawStill(e) { paint(e, null, true); }

    function flash() {
        if (!flashEl) flashEl = canvasEl.querySelector('.climate-lightning');
        if (!flashEl) return;
        flashEl.classList.remove('is-flash');
        void flashEl.offsetWidth; // restart the one-shot animation
        flashEl.classList.add('is-flash');
    }

    function frame(ts) {
        raf = 0;
        if (!isStorm() || (typeof document !== 'undefined' && document.hidden) || motionMode() !== 'live') return;
        raf = requestAnimationFrame(frame);
        if (ts - lastFrame < FRAME_MS) return;
        const dt = Math.min(MAX_DT, lastFrame ? (ts - lastFrame) / 1000 : FRAME_MS / 1000);
        lastFrame = ts;
        const w = wind.step(dt);
        const far = entries.find((e) => e.role === 'far' && e.layer);
        const lt = far ? lightning.step(dt, far.w, far.h) : null;
        if (lt && lt.fired) flash();
        entries.forEach((e) => {
            if (!e.layer) return;
            e.layer.step(dt, w);
            paint(e, e.role === 'far' && lt ? lt.bolt : null, false);
        });
    }

    // ------------------------------------------------------------------------------------------------ lifecycle

    function startLoop() { if (!raf && typeof requestAnimationFrame === 'function') { lastFrame = 0; raf = requestAnimationFrame(frame); } }
    function stopLoop() { if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = 0; }

    function tick() {
        if (!isStorm()) return;
        scan();
        if (motionMode() === 'live') { if (!raf) startLoop(); } else { stopLoop(); entries.forEach(drawStill); }
    }

    /** Re-read the sky: start (or stop) the rain to match the band class. Exposed so a caller can force a re-check. */
    function sync() {
        if (!canvasEl || !sim()) return;
        if (isStorm()) {
            if (!timer) timer = setInterval(tick, RESCAN_MS);
            tick();
        } else {
            if (timer) { clearInterval(timer); timer = 0; }
            stopLoop();
            entries.forEach((e) => { if (e.ctx) e.ctx.clearRect(0, 0, e.w, e.h); });
        }
    }

    function onVisibility() { if (typeof document !== 'undefined' && !document.hidden) tick(); }

    function init(d) {
        deps = d || null;
        canvasEl = (typeof document !== 'undefined') ? document.getElementById('gameCanvas') : null;
        if (!canvasEl || !sim()) return;
        rng = sim().mulberry32((Date.now() ^ 0x5bd1e995) >>> 0);
        wind = sim().createWind(rng);
        lightning = sim().createLightning(rng);
        flashEl = null;
        if (observer) observer.disconnect();
        if (typeof MutationObserver === 'function') {
            observer = new MutationObserver(sync);
            observer.observe(canvasEl, { attributes: true, attributeFilter: ['class'] });
        }
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
        sync();
    }

    /** Test / teardown hook: stop everything and forget the canvas. */
    function destroy() {
        if (observer) { observer.disconnect(); observer = null; }
        if (timer) { clearInterval(timer); timer = 0; }
        stopLoop();
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
        entries = [];
        canvasEl = null;
        deps = null;
        flashEl = null;
    }

    return { PX, init, sync, destroy, motionMode, _entries: () => entries };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RainFx;
}
