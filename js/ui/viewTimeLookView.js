/**
 * ViewTimeLookView — DOM side of the past / future canvas look (2026-11-19; pure rules in js/viewTimeLook.js,
 * styles in css/viewTimeLook.css, DECISIONS 2026-11-19 (view-time look)).
 *
 * TimeSliderView calls show(time, live) wherever it writes the slider label (live tick, scrub, a day-pager jump,
 * Now), so the look always matches the time on screen. It reads this module as a bare global and skips it when
 * absent (tests, stale shell).
 *
 * show() toggles `.view-look-past` / `.view-look-future` on #gameCanvas and fills the corner stamp. Two layers are
 * added to #gameCanvas once, both `pointer-events: none` so every tap still reaches zombies, the church and the
 * village:
 *   - `.view-look-tint` (z 29, just under the zombie band 30-79): a backdrop-filter that tints everything drawn
 *     under it (sky, floor, church, village, hill, hero). Zombies get the same tint through their own filter chain
 *     (`--g-ghost`, listed before the glows), so the priority outline and streak fire stay full colour.
 *   - `.view-look-fx` (z 88, under the Nights counter 89 and the HUD 90): scanlines / grain / tracking band (past)
 *     or grid / brackets / scan sweep (future), plus the stamp.
 * A handle parked on Today slowly becomes the past as real time moves on, so while the look is not live it
 * re-checks itself every REFRESH_MS.
 */
const ViewTimeLookView = (() => {
    const REFRESH_MS = 30 * 1000;
    const GRAIN_PX = 64;

    let canvasEl = null;
    let stampMarkEl = null;
    let stampTextEl = null;
    let kind = null;
    let lastTime = null;
    let lastLive = true;
    let refreshTimer = null;

    function core() {
        if (typeof ViewTimeLook !== 'undefined' && ViewTimeLook) return ViewTimeLook;
        if (typeof require === 'function') {
            try { return require('../viewTimeLook.js'); } catch (e) { return null; }
        }
        return null;
    }

    // A 64x64 grey noise tile, drawn once (pixel grain; scaled up 2x with image-rendering: pixelated in the CSS).
    // No canvas (jsdom, a locked-down browser) = no grain, everything else still works.
    function grainUrl() {
        if (typeof document === 'undefined') return null;
        try {
            const c = document.createElement('canvas');
            c.width = GRAIN_PX;
            c.height = GRAIN_PX;
            const ctx = c.getContext && c.getContext('2d');
            if (!ctx) return null;
            const img = ctx.createImageData(GRAIN_PX, GRAIN_PX);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.floor(Math.random() * 256);
                img.data[i] = v;
                img.data[i + 1] = v;
                img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
            return c.toDataURL('image/png');
        } catch (e) {
            return null;
        }
    }

    // Finds #gameCanvas and adds the two layers (once per canvas element). False when there is no canvas.
    function ensureLayers() {
        if (typeof document === 'undefined') return false;
        const el = document.getElementById('gameCanvas');
        if (!el) return false;
        if (el === canvasEl && stampTextEl && el.contains(stampTextEl)) return true;
        canvasEl = el;

        let tint = el.querySelector(':scope > .view-look-tint');
        if (!tint) {
            tint = document.createElement('div');
            tint.className = 'view-look-tint';
            tint.setAttribute('aria-hidden', 'true');
            el.appendChild(tint);
        }
        let fx = el.querySelector(':scope > .view-look-fx');
        if (!fx) {
            fx = document.createElement('div');
            fx.className = 'view-look-fx';
            fx.setAttribute('aria-hidden', 'true');
            const grain = document.createElement('div');
            grain.className = 'view-look-grain';
            const sweep = document.createElement('div');
            sweep.className = 'view-look-sweep';
            const stamp = document.createElement('div');
            stamp.className = 'view-look-stamp';
            const mark = document.createElement('span');
            mark.className = 'view-look-stamp-mark';
            const text = document.createElement('span');
            text.className = 'view-look-stamp-text';
            stamp.appendChild(mark);
            stamp.appendChild(text);
            fx.appendChild(grain);
            fx.appendChild(sweep);
            fx.appendChild(stamp);
            el.appendChild(fx);
            const url = grainUrl();
            if (url) grain.style.backgroundImage = 'url(' + url + ')';
        }
        stampMarkEl = fx.querySelector('.view-look-stamp-mark');
        stampTextEl = fx.querySelector('.view-look-stamp-text');
        return true;
    }

    function stopRefresh() {
        if (refreshTimer !== null) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    function scheduleRefresh() {
        stopRefresh();
        if (lastLive || typeof setTimeout !== 'function') return;
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            refresh();
        }, REFRESH_MS);
    }

    function apply(nextKind, time) {
        if (!ensureLayers()) { kind = nextKind; return; }
        canvasEl.classList.toggle('view-look-past', nextKind === 'past');
        canvasEl.classList.toggle('view-look-future', nextKind === 'future');
        const c = core();
        const parts = (nextKind && c) ? c.stampParts(time, nextKind) : null;
        if (stampMarkEl) stampMarkEl.textContent = parts ? parts.mark : '';
        if (stampTextEl) stampTextEl.textContent = parts ? parts.text : '';
        kind = nextKind;
    }

    /** The time on screen changed. `live` = the board shows the real present (slider on now, Today on screen). */
    function show(time, live) {
        lastTime = time;
        lastLive = !!live;
        const c = core();
        const nextKind = c ? c.classify(time, new Date(), lastLive) : null;
        // The live tick calls this every second: nothing to do while the look is already off.
        if (nextKind === null && kind === null) { stopRefresh(); return; }
        apply(nextKind, time);
        scheduleRefresh();
    }

    /** Re-check the last time shown against the clock (a parked handle drifting into the past). */
    function refresh() {
        if (lastTime === null) return;
        show(lastTime, lastLive);
    }

    function current() {
        return kind;
    }

    // Tests: forget the canvas and the last state.
    function reset() {
        stopRefresh();
        canvasEl = null;
        stampMarkEl = null;
        stampTextEl = null;
        kind = null;
        lastTime = null;
        lastLive = true;
    }

    return { show, refresh, current, reset, REFRESH_MS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewTimeLookView;
}
