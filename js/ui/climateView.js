/**
 * ClimateView -- DOM half of the run climate (the sky's weather; designed 2026-11-03, docs/WORLD_FEEDBACK_PLAN.md
 * "W1 Run climate"). The rules (day score, band, hysteresis, trend) are in js/runClimate.js (pure, unit-tested); this file
 * only puts the result on the canvas as classes:
 *
 *   #gameCanvas.climate-<clear|hazy|overcast|fog|storm>   the band (css/climate.css does ALL the looks from this one class:
 *                                                         sky tint, star fade, moon glow, sky clouds, haze by depth,
 *                                                         the Nights Survived number's ink)
 *   #gameCanvas.climate-trend-<up|down>                   present only when the run is clearly improving / sliding
 *                                                         (steady = no class); Build 2 uses it for the cloud-break / darkening
 *
 * The band changes only at a day rollover and on load (RunClimate reads CLOSED days only), so refresh() is cheap enough to
 * call every tick: it asks the caller for the result and writes the DOM only when the class string changes. If the caller
 * throws or returns nothing, the canvas simply carries no climate class = the sky looks exactly as it did before this feature.
 *
 * Dev override: ?climate=clear|hazy|overcast|fog|storm (+ &trend=up|down) forces a band for art checks, like the
 * ?villageTier= params (parseOverride below; script.js turns it into a RunClimate.forced result).
 *
 * Deps: { getResult: () => RunClimate result | null, onChange?: (result | null) => void  (called when the classes change, and once at start) }
 */
const ClimateView = (() => {
    const BANDS = ['clear', 'hazy', 'overcast', 'fog', 'storm'];
    const TREND_CLASS = { up: 'climate-trend-up', down: 'climate-trend-down' };

    let deps = null;
    let canvasEl = null;
    let lastKey = null;

    /** Pure. A RunClimate result -> the classes for #gameCanvas ([] for anything unusable). */
    function classesFor(result) {
        if (!result || typeof result !== 'object') return [];
        if (BANDS.indexOf(result.band) < 0) return [];
        const out = ['climate-' + result.band];
        if (TREND_CLASS[result.trend]) out.push(TREND_CLASS[result.trend]);
        return out;
    }

    /** Pure. "?climate=fog&trend=up" -> { band: 'fog', trend: 'up' }; null when there is no valid ?climate=. */
    function parseOverride(search) {
        if (typeof search !== 'string' || !search) return null;
        let params;
        try {
            params = new URLSearchParams(search);
        } catch (e) {
            return null;
        }
        const band = String(params.get('climate') || '').toLowerCase();
        if (BANDS.indexOf(band) < 0) return null;
        const trend = String(params.get('trend') || '').toLowerCase();
        return { band, trend: (trend === 'up' || trend === 'down') ? trend : 'steady' };
    }

    /** Write a result onto an element: drop every climate-* class, then add the new ones. Returns the class list written. */
    function apply(el, result) {
        if (!el || !el.classList) return [];
        Array.from(el.classList).forEach((c) => { if (c.indexOf('climate-') === 0) el.classList.remove(c); });
        const classes = classesFor(result);
        classes.forEach((c) => el.classList.add(c));
        if (classes.length) {
            el.dataset.climate = result.band;
        } else if (el.dataset) {
            delete el.dataset.climate;
        }
        return classes;
    }

    function refresh() {
        if (!deps || !canvasEl) return;
        let result = null;
        try {
            result = deps.getResult ? deps.getResult() : null;
        } catch (err) {
            if (typeof console !== 'undefined') console.error('Deadline: run climate failed', err);
            result = null;
        }
        const key = classesFor(result).join(' ');
        if (key === lastKey) return;
        lastKey = key;
        apply(canvasEl, result);
        // The badge / panel follow the same change (js/ui/weatherPanel.js). A failure there never breaks the sky.
        if (deps.onChange) {
            try { deps.onChange(result); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: weather badge failed', err); }
        }
    }

    function init(d) {
        deps = d;
        canvasEl = document.getElementById('gameCanvas');
        lastKey = null;
        if (!canvasEl) { deps = null; return; }
        refresh();
    }

    return { BANDS, classesFor, parseOverride, apply, init, refresh };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClimateView;
}
