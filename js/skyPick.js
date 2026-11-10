/**
 * SkyPick -- the pure rules of the Lv 4 sky picker (W1c; designed 2026-11-07, amended 2026-11-09; docs/WORLD_FEEDBACK_PLAN.md
 * "W1c Sky picker"). Rule, one sentence: every band is yours to pick, Clear included (Jeremy, 2026-11-09, reversing the original
 * "Clear is the only band you earn"; the record, table, Stats and AI still carry the REAL climate, so the pick can never fake the run).
 *
 * The pick is VIEW-ONLY. RunClimate (the real climate), the daily record, the Weather table, Stats and the AI never see it; only the
 * sky on the canvas does. `resolve` turns the REAL result + the saved pick into the result the canvas should wear:
 *   - no perk / no pick / a dev-forced sky  ->  the real result, untouched
 *   - otherwise a COPY of the real result with the picked band, `score: null` when the band differs (rain at full strength, like the
 *     dev sky) and `pick: { band, realBand }`. Trend, recent days and everything else stay the REAL run's, so the moonbeam / darker
 *     clouds and the Weather table keep telling the truth.
 * Precedence in script.js `climateNow()`: DEV panel forced sky > ?climate= > player pick > real.
 *
 * `changeNotice` is the amendment's toast: when the REAL band changes under a pick the player is told once.
 *
 * W1d (2026-11-09, docs/WORLD_FEEDBACK_PLAN.md "W1d Sky unlocks"): the skies unlock one by one, each on its own LIFETIME track, so the
 * third argument of `resolve` / `changeNotice` is now the list of unlocked bands. `unlockedBands(rules, best)` builds it from
 * CONFIG.SKY_UNLOCKS and the player's all-time bests. A boolean still works (true = every band, false = none). A pick whose band is
 * not unlocked is ignored, so the sky falls back to the real one.
 *
 * No DOM, no State, no CONFIG reads. Bands are the same five strings as RunClimate.BANDS (kept in step by test/skyPick.test.js).
 */
const SkyPick = (() => {
    const BANDS = ['clear', 'hazy', 'overcast', 'fog', 'storm'];
    const UNLOCK_KEY = 'skyPicker';
    const LABELS = { clear: 'Clear', hazy: 'Hazy', overcast: 'Overcast', fog: 'Fog', storm: 'Storm' };

    /** An unlocked-bands argument -> a plain array of band names (true = all five, an array = its valid bands, anything else = none). */
    function allowedBands(unlocked) {
        if (unlocked === true) return BANDS.slice();
        if (Array.isArray(unlocked)) return BANDS.filter(b => unlocked.indexOf(b) >= 0);
        return [];
    }

    /** A saved pick -> a band name, or null (= follow my run) for anything else. */
    function sanitize(value) {
        return (typeof value === 'string' && BANDS.indexOf(value) >= 0) ? value : null;
    }

    function label(band) { return LABELS[band] || ''; }

    /** The bands the picker offers: all five, in sky order (Clear is a free pick since 2026-11-09). */
    function pickableBands() {
        return BANDS.slice();
    }

    /** True when one rule { level } or { kind, tier } is met by best = { level, tiers: { kind: tier } }. A malformed rule is never met. */
    function ruleMet(rule, best) {
        if (!rule || typeof rule !== 'object') return false;
        const b = best || {};
        if (Number.isFinite(rule.level)) return (Number(b.level) || 0) >= rule.level;
        if (typeof rule.kind === 'string' && Number.isFinite(rule.tier)) {
            const tiers = (b.tiers && typeof b.tiers === 'object') ? b.tiers : {};
            return (Number(tiers[rule.kind]) || 0) >= rule.tier;
        }
        return false;
    }

    /** The bands the player has earned, in sky order. rules = CONFIG.SKY_UNLOCKS, best = { level, tiers } (all-time bests). */
    function unlockedBands(rules, best) {
        const r = (rules && typeof rules === 'object') ? rules : {};
        return BANDS.filter(b => ruleMet(r[b], best));
    }

    /** The best player level over a run history (newest-first records; `peakPlayerLevel` is absent on older ones). 0 when none. */
    function bestLevelFromHistory(history) {
        const list = Array.isArray(history) ? history : [];
        return list.reduce((m, r) => {
            const n = (r && typeof r === 'object') ? r.peakPlayerLevel : null;
            return (Number.isInteger(n) && n > m) ? n : m;
        }, 0);
    }

    /** A saved best level -> a whole number >= 0 (junk = 0). */
    function sanitizeLevel(n) {
        return (typeof n === 'number' && Number.isFinite(n) && n > 0) ? Math.floor(n) : 0;
    }

    /**
     * { result, active, pick }
     *   result   what the canvas wears (the same object as `real` when nothing overrides it)
     *   active   a pick is in force
     *   pick     the saved pick, sanitised (null = follow)
     */
    function resolve(real, savedPick, unlocked) {
        const pick = sanitize(savedPick);
        const allowed = allowedBands(unlocked);
        const none = { result: real, active: false, pick };
        if (!real || typeof real !== 'object' || real.forced) return none;
        if (!pick || allowed.indexOf(pick) < 0) return none; // not earned (a pick from before a reset, say) = follow the real sky
        const same = pick === real.band;
        const shown = Object.assign({}, real, {
            band: pick,
            bandIndex: BANDS.indexOf(pick),
            score: same ? real.score : null,
            pick: { band: pick, realBand: real.band },
        });
        return { result: shown, active: true, pick };
    }

    /** The REAL band behind a result the canvas wears (the result's own band when no pick is on it). */
    function realBandOf(result) {
        if (!result) return null;
        return (result.pick && result.pick.realBand) || result.band || null;
    }

    /**
     * The toast text when the REAL band moves from `prevReal` to `nextReal` while a pick is in force, else ''. Never when there is
     * no pick (the sky itself says it), never when nothing moved, never when the sky already shows the new real band.
     * `savedPick` / `unlocked` are the pick and perk BEFORE the change is looked at (same as resolve).
     */
    function changeNotice(prevReal, nextReal, savedPick, unlocked) {
        const pick = sanitize(savedPick);
        if (!pick || allowedBands(unlocked).indexOf(pick) < 0) return '';
        if (BANDS.indexOf(prevReal) < 0 || BANDS.indexOf(nextReal) < 0 || prevReal === nextReal) return '';
        if (pick === nextReal) return '';
        return `Your run's weather is now ${LABELS[nextReal]}. Your sky stays ${LABELS[pick]}.`;
    }

    return { BANDS, UNLOCK_KEY, sanitize, label, pickableBands, allowedBands, ruleMet, unlockedBands, bestLevelFromHistory, sanitizeLevel, resolve, realBandOf, changeNotice };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SkyPick;
}
