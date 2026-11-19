/**
 * SceneScale -- DEV SPIKE (2026-11-19, Jeremy + Claude): lay the battlefield (#gameCanvas: sky, village, graveyard,
 * church, lanes, zombies) out at a LARGER size and shrink it to fit, so a small phone shows the same roomy scene as a
 * big one, just smaller. Off unless the URL asks for it:
 *
 *   ?sceneScale=0.8    a fixed scale (0.5 .. 1)
 *   ?sceneScale=auto   scale = canvas width / CONFIG-free AUTO_DESIGN_W (1000px = a 700px walking field with the
 *                      160px church + 140px hill), never above 1, never below AUTO_MIN
 *   (no param / off)   nothing changes
 *
 * HOW: #gameCanvas gets an explicit layout size of (host / s) and the CSS `scale` property (not `transform`, so the
 * canvas thump's `translate` still composes), origin top-left, with negative margins so it still occupies exactly the
 * host's box. Every scene measurement in the game reads LAYOUT sizes (offsetWidth / offsetHeight), so the zombies,
 * village and graveyard all lay out in the bigger space with no other changes; taps are hit-tested by the browser.
 * The HUD (.stats-overlay) and time slider are outside #gameCanvas and stay full size. The portrait glance strip is
 * never scaled. Called from Layout.applyBodyClass, i.e. on init and on every resize BEFORE the canvas is re-measured.
 */
const SceneScale = (() => {
    const MIN = 0.5;
    const AUTO_DESIGN_W = 1000;
    const AUTO_MIN = 0.7;

    // Pure: the URL's request. Returns a number in [MIN, 1], 'auto', or null (off).
    function parse(search) {
        const m = /(?:^|[?&])sceneScale=([^&]*)/.exec(search || '');
        if (!m) return null;
        const v = decodeURIComponent(m[1]).trim().toLowerCase();
        if (v === 'auto') return 'auto';
        const n = Number(v);
        if (!isFinite(n) || n <= 0 || n >= 1) return null;
        return Math.max(MIN, Math.round(n * 100) / 100);
    }

    // Pure: the scale to use for a host box `hostW` px wide (visual px). 1 = no scaling.
    function scaleFor(request, hostW) {
        if (request === null || request === undefined) return 1;
        if (request === 'auto') {
            if (!(hostW > 0)) return 1;
            const s = Math.floor((hostW / AUTO_DESIGN_W) * 100) / 100;
            return Math.min(1, Math.max(AUTO_MIN, s));
        }
        return Math.min(1, Math.max(MIN, Number(request) || 1));
    }

    // Pure: the inline styles for a host of hostW x hostH at scale s (null = clear them).
    function stylesFor(s, hostW, hostH) {
        if (!(s < 1) || !(hostW > 0) || !(hostH > 0)) return null;
        const w = hostW / s;
        const h = hostH / s;
        return {
            width: w + 'px',
            height: h + 'px',
            scale: String(s),
            transformOrigin: '0 0',
            marginRight: (hostW - w) + 'px',
            marginBottom: (hostH - h) + 'px',
        };
    }

    const KEYS = ['width', 'height', 'scale', 'transformOrigin', 'marginRight', 'marginBottom'];
    let current = 1;

    function clear(el) {
        KEYS.forEach((k) => { el.style[k] = ''; });
        el.style.removeProperty && el.style.removeProperty('--scene-scale');
    }

    // DOM: size #gameCanvas for the current host box. Returns the scale applied (1 = none).
    function apply(doc, win, isStrip) {
        const d = doc || (typeof document !== 'undefined' ? document : null);
        const w = win || (typeof window !== 'undefined' ? window : null);
        if (!d) return 1;
        const el = d.getElementById('gameCanvas');
        const host = el && el.parentElement;
        if (!el || !host) return 1;
        const request = parse(w && w.location ? w.location.search : '');
        // Measure the host with the canvas at its natural size first, so a previous scale never feeds back in.
        if (request === null || isStrip) { clear(el); current = 1; return 1; }
        const hostW = host.clientWidth;
        const hostH = host.clientHeight;
        const s = scaleFor(request, hostW);
        const st = stylesFor(s, hostW, hostH);
        if (!st) { clear(el); current = 1; return 1; }
        KEYS.forEach((k) => { el.style[k] = st[k]; });
        el.style.setProperty && el.style.setProperty('--scene-scale', String(s));
        current = s;
        return s;
    }

    function get() { return current; }

    return { parse, scaleFor, stylesFor, apply, get, AUTO_DESIGN_W, AUTO_MIN, MIN };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SceneScale;
}
