/**
 * GraveyardLayout -- pure placement maths for the right-hand graveyard zone
 * (V7 W0, 2026-10-28; docs/WORLD_FEEDBACK_PLAN.md). No DOM, no State.
 *
 *   ZONE      fixed-width graveyard zone at the right edge of #gameCanvas (the headstones are placed by
 *             CONFIG.MARKER_SLOTS, not here; the old stoneSlots / stoneCapacity helpers were removed 2026-11-23).
 *   FIELD     the walking field ends where the zone starts: fieldWidth = canvasWidth - zone.
 *             script.js feeds this to the timeline as gameScreenWidth.
 *   RUN GRAVES past-run markers creeping across the field: index 0 = NEWEST, next to the
 *             hill; the oldest sits furthest left. Spacing starts wide and tightens with the
 *             run count (never below RUN_GRAVE_MIN_SPACING_PX); jitter, lane, height and tilt
 *             are seeded by the run's own number, so a grave keeps its look as newer runs
 *             push it left. The oldest fade out over the last RUN_GRAVE_FADE_PX before the
 *             church and anything past the church is dropped from the scene (Stats still
 *             lists every run).
 *
 * Every function takes an `opts` object whose defaults mirror CONFIG, so tests can pass
 * explicit numbers and the view passes CONFIG.
 */
const GraveyardLayout = (() => {
    const DEFAULTS = {
        hillWidthPx: 120,
        runMaxSpacingPx: 110,
        runMinSpacingPx: 22,
        runJitterFrac: 0.35,
        runHeightPx: 26,
        runHeightVariancePx: 8,
        runTiltDeg: 6,
        runOpacity: 0.7,
        runFadePx: 90,
        runGapPx: 22,
    };

    function fromConfig(cfg) {
        if (!cfg) return { ...DEFAULTS };
        return {
            hillWidthPx: cfg.GRAVEYARD_HILL_WIDTH_PX,
            runMaxSpacingPx: cfg.RUN_GRAVE_MAX_SPACING_PX,
            runMinSpacingPx: cfg.RUN_GRAVE_MIN_SPACING_PX,
            runJitterFrac: cfg.RUN_GRAVE_JITTER_FRAC,
            runHeightPx: cfg.RUN_GRAVE_HEIGHT_PX,
            runHeightVariancePx: cfg.RUN_GRAVE_HEIGHT_VARIANCE_PX,
            runTiltDeg: cfg.RUN_GRAVE_TILT_DEG,
            runOpacity: cfg.RUN_GRAVE_OPACITY,
            runFadePx: cfg.RUN_GRAVE_FADE_PX,
            runGapPx: cfg.RUN_GRAVE_GAP_PX,
        };
    }

    function merge(opts) {
        return { ...DEFAULTS, ...(opts || {}) };
    }

    // Deterministic 0..1 value for (seed, k). Same input -> same output on every call.
    function seeded(seed, k) {
        const s = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453;
        return s - Math.floor(s);
    }

    // X where the zombie field ends (and the hill begins). 0 hill => whole canvas.
    function fieldRight(canvasWidth, hillWidth) {
        const cw = Math.max(0, Number(canvasWidth) || 0);
        const hw = Math.max(0, Math.min(cw, Number(hillWidth) || 0));
        return cw - hw;
    }

    // Spacing between neighbouring run graves for `count` runs over `spanPx` of field.
    function runSpacing(count, spanPx, opts) {
        const o = merge(opts);
        if (!count) return o.runMaxSpacingPx;
        return Math.max(o.runMinSpacingPx, Math.min(o.runMaxSpacingPx, Math.max(0, spanPx) / count));
    }

    /**
     * Place run graves.
     *   runIds        run numbers, NEWEST FIRST (e.g. [12, 11, ... 1]); any stable ids work
     *   fieldRightX   x where the field ends (hill edge)
     *   leftLimitX    x of the church's right edge; graves never go left of leftLimitX + 4
     * returns [{ id, index, x, lane, bodyH, tiltDeg, opacity }] (x = grave centre).
     */
    function runGraves(runIds, fieldRightX, leftLimitX, opts) {
        const o = merge(opts);
        const ids = Array.isArray(runIds) ? runIds : [];
        const span = Math.max(0, fieldRightX - o.runGapPx - leftLimitX);
        const spacing = runSpacing(ids.length, span, o);
        const out = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const seed = typeof id === 'number' ? id : hashString(String(id));
            const jitter = (seeded(seed, 1) - 0.5) * 2 * o.runJitterFrac * spacing;
            const x = Math.round(fieldRightX - o.runGapPx - (i + 0.5) * spacing + jitter);
            if (x < leftLimitX + 4) break; // the rest are older still: past the church
            const lane = Math.min(2, Math.floor(seeded(seed, 2) * 3));
            const bodyH = Math.max(10, Math.round(o.runHeightPx + (seeded(seed, 3) - 0.5) * o.runHeightVariancePx));
            const tiltDeg = Number(((seeded(seed, 4) - 0.5) * 2 * o.runTiltDeg).toFixed(1));
            const fade = o.runFadePx > 0 ? Math.max(0, Math.min(1, (x - leftLimitX) / o.runFadePx)) : 1;
            out.push({ id, index: i, x, lane, bodyH, tiltDeg, opacity: Number((o.runOpacity * fade).toFixed(2)) });
        }
        return out;
    }

    function hashString(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        return Math.abs(h) % 100000;
    }

    return { DEFAULTS, fromConfig, seeded, fieldRight, runSpacing, runGraves };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraveyardLayout;
}
