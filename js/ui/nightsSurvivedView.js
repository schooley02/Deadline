/**
 * NightsSurvivedView — the "Nights Survived" count on the moon in the top-right
 * of the game canvas (2026-10-26, Jeremy).
 *
 *   MOON  (#nightsSurvived .nights-moon): the PixelLab moon sprite with the
 *         count centred on it in the Press Start 2P pixel font.
 *   LABEL (.nights-label): "Nights Survived" in Inter underneath.
 *
 * COUNTING RULE: one night per LOCAL midnight crossed since the run started
 * (State.getRunStartedAtMs). A run started at 11pm shows 1 at 12:00am. This is
 * deliberately MOON-ONLY for now: the game-over screen, run history and the
 * Survivor achievement still use Damage.computeDaysSurvived (full 24h periods).
 * Unifying the two is an open design question (see DECISIONS.md 2026-10-26).
 *
 * Counted by calendar DATE, not elapsed ms / 24h, so a DST change (23h or 25h
 * day) never skips or doubles a night. Same local-calendar reasoning as
 * dayRollover.js's startOfDay.
 *
 * PURE / DOM split like the other UI modules: countMidnights and digitClass are
 * pure and unit-tested; init/render touch the DOM and are live-checked. The
 * view keeps itself current with its own light interval (DOM is only written
 * when the number changes), so script.js just calls init once. While the game
 * is over the count is frozen at its last value.
 *
 * Deps: { getRunStartedAtMs: () => number|null, isGameOver: () => boolean }
 */
const NightsSurvivedView = (() => {
    const REFRESH_MS = 5000;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // Whole local midnights between two instants (0 if start is missing/after now).
    function countMidnights(startMs, nowMs) {
        if (typeof startMs !== 'number' || !isFinite(startMs)) return 0;
        if (typeof nowMs !== 'number' || !isFinite(nowMs)) return 0;
        const a = new Date(startMs);
        const b = new Date(nowMs);
        // Date.UTC on the LOCAL y/m/d gives a DST-free day index for each date.
        const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.max(0, Math.round((dayB - dayA) / MS_PER_DAY));
    }

    // Size class by digit count so the number always fits inside the moon.
    function digitClass(n) {
        const len = String(Math.max(0, Math.floor(n || 0))).length;
        if (len <= 2) return 'nights-count--d2';
        if (len === 3) return 'nights-count--d3';
        return 'nights-count--d4';
    }

    function label(n) {
        return n === 1 ? '1 night survived' : `${n} nights survived`;
    }

    let deps = null;
    let rootEl = null;
    let countEl = null;
    let shown = null;
    let timer = null;

    function render() {
        if (!deps || !rootEl || !countEl) return;
        if (shown !== null && deps.isGameOver && deps.isGameOver()) return;
        const n = countMidnights(deps.getRunStartedAtMs(), Date.now());
        if (n === shown) return;
        shown = n;
        countEl.textContent = String(n);
        countEl.className = `nights-count ${digitClass(n)}`;
        rootEl.setAttribute('aria-label', label(n));
    }

    function init(d) {
        deps = d;
        rootEl = document.getElementById('nightsSurvived');
        countEl = document.getElementById('nightsSurvivedCount');
        if (!rootEl || !countEl) return;
        shown = null;
        render();
        if (!timer) {
            timer = setInterval(render, REFRESH_MS);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') render();
            });
        }
    }

    return { countMidnights, digitClass, label, init, render };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NightsSurvivedView;
}
