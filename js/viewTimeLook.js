/**
 * viewTimeLook.js — pure core of the past / future canvas look (2026-11-19, Jeremy: "a new effect to the canvas
 * when someone uses the time slider or day toggle button to look into the past" ... "for users to be able to tell
 * at a glance if they are looking at the canvas in the future").
 *
 * The canvas gets one of two looks whenever the time on screen is not now:
 *   - past   = surveillance tape playback (tinted grey-green, scanlines, grain, "◀◀ PLAYBACK" stamp)
 *   - future = tactical forecast (cool blueprint tint, grid, corner brackets, "▶▶ FORECAST" stamp)
 * Nothing here touches the DOM: js/ui/viewTimeLookView.js applies the result. DECISIONS 2026-11-19 (view-time look).
 */
const ViewTimeLook = (() => {
    // Within this much of now (a parked handle on the current minute) counts as the present: no look.
    const PRESENT_MS = 60 * 1000;
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const MARKS = { past: '◀◀ PLAYBACK', future: '▶▶ FORECAST' };

    function toMs(t) {
        if (t instanceof Date) return t.getTime();
        return (typeof t === 'number') ? t : NaN;
    }

    /**
     * 'past' | 'future' | null for the time on screen. `live` = the board is showing the real present (slider on now,
     * Today on screen): always null, whatever the clock says.
     */
    function classify(viewTime, nowTime, live) {
        if (live) return null;
        const v = toMs(viewTime);
        const n = toMs(nowTime);
        if (!Number.isFinite(v) || !Number.isFinite(n)) return null;
        const d = v - n;
        if (Math.abs(d) < PRESENT_MS) return null;
        return d < 0 ? 'past' : 'future';
    }

    /** { mark, text } for the corner stamp, e.g. { mark: '◀◀ PLAYBACK', text: 'NOV 18 · 3:40 PM' }; null kind = null. */
    function stampParts(viewTime, kind) {
        if (!MARKS[kind]) return null;
        const v = toMs(viewTime);
        if (!Number.isFinite(v)) return null;
        const d = new Date(v);
        const h24 = d.getHours();
        const h = (h24 % 12) || 12;
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ampm = h24 < 12 ? 'AM' : 'PM';
        return { mark: MARKS[kind], text: MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + h + ':' + mm + ' ' + ampm };
    }

    return { classify, stampParts, PRESENT_MS, MARKS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewTimeLook;
}
