/**
 * TimeSlider — pure time/position math for the 24h preview slider
 * (Milestone 4, "Time slider (Today, then Week/Month scopes)", Today scope
 * only this session, 2026-07-20).
 *
 * Follows the clock.js/movement.js precedent: pure functions, Clock read as
 * a bare stable global (loaded before this file in index.html; required
 * explicitly in tests), CONFIG likewise. DOM wiring + the ghost-preview
 * render loop live in js/ui/timeSliderView.js.
 *
 * Scope note: the slider spans a single calendar day (00:00-24:00 of
 * `referenceTime`'s day) with 1-minute resolution. "Ghosting future spawns"
 * (spec requirement) needs NO separate logic for Today scope — every one of
 * today's habit/routine-task instances is already spawned into activeItems
 * at day start (see script.js's generateDailyHabitInstances/
 * generateDailyRoutineTaskInstances), just positioned far off-screen right
 * until its due time approaches. Re-running the existing pure position math
 * (Clock.calculateTimelinePosition / Movement.calculateTimelineXWithClustering)
 * at a scrubbed previewTime instead of the live current time is sufficient
 * to reveal them sliding in — no "not yet spawned" ghost category exists
 * within a single day. Week/Month scope (unbuilt) will need real ghost
 * conjuring for OTHER days' instances; this module's day-bounds functions
 * are written to extend to that later without a rewrite (see DECISIONS.md
 * 2026-07-20).
 *
 * Usage (see js/ui/timeSliderView.js):
 *   TimeSlider.getDayBounds(referenceTime) -> { start: Date, end: Date }
 *   TimeSlider.minutesOfDayToTime(minutes, dayStart) -> Date
 *   TimeSlider.timeToMinutesOfDay(time, dayStart) -> number (0-1440, clamped)
 *   TimeSlider.formatLabel(time) -> '2:30 PM'
 *   TimeSlider.getLurkerPreviewX(previewTime, dims) -> px
 *       (dims = { gameScreenWidth, baseWidth, habitEnemyWidth })
 *
 * Damage/regen projection (added 2026-07-20, same session — Jeremy's
 * follow-up: "the preview also needs to show base damage and freezes").
 * "Freezes" needed NO new code: hero chips already re-render every live tick
 * regardless of preview state (renderHeroesAtBase isn't gated by
 * isTimePreviewActive), so frozen/KO'd badges stay correctly current through
 * a scrub — freeze itself is a DAY-level trigger (3+ consecutive indulges,
 * see ROUTINES.md/frozenSlots.js), not time-of-day, so it can't meaningfully
 * change from scrubbing within one day anyway. "Base damage" (and,
 * symmetrically, per-routine HP — the same OVERDUE_DAMAGE tick also damages
 * an item's owning routine, see items.js's damageRoutineForItem) DOES need
 * projection: these functions are a pure, non-mutating "what would HP be at
 * previewTime" — anchored at the CURRENT known-correct HP (not simulated
 * from scratch, since currentHealth already bakes in damage/regen from items
 * no longer active) and computed as a DELTA between "now" and previewTime,
 * using the exact same CONFIG.DAMAGE_INTERVAL_MS/OVERDUE_DAMAGE/
 * BASE_REGEN_INTERVAL_MS/BASE_REGEN_HP constants the live loop/regen tick
 * use, so the projection can never disagree with what would actually happen.
 * Symmetric for rewind: a negative delta undoes not-yet-applied damage/regen,
 * so scrubbing behind an item's due date raises its contribution back out.
 *   TimeSlider.projectBaseHealth(items, currentHealth, previewMs, nowMs, regenAnchorMs) -> number
 *   TimeSlider.projectRoutineHealthDeltas(items, previewMs, nowMs, getRoutineId) -> { [routineId]: delta }
 *       (items should already exclude non-threatening lurkers — they never
 *       damage anything, live or previewed; getRoutineId(item) resolves
 *       ownership, script.js threads Items.findRoutineForItem)
 */
const TimeSlider = (() => {
    const MINUTES_PER_DAY = 24 * 60;

    // Midnight-to-midnight bounds of referenceTime's own calendar day. Named
    // "Today scope" in the ROADMAP; Week/Month scope will need a `scope`
    // param widening `end` — deliberately not added until that ticket exists
    // (YAGNI, matches the project's incremental-extraction rule).
    function getDayBounds(referenceTime) {
        const start = new Date(referenceTime);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        return { start, end };
    }

    function minutesOfDayToTime(minutes, dayStart) {
        return new Date(dayStart.getTime() + minutes * 60 * 1000);
    }

    // Clamped to [0, 1440] — a caller passing a time outside dayStart's day
    // (shouldn't happen from the slider itself, which is bounded by its own
    // min/max) still gets a safe in-range value rather than a negative or
    // >1440 slider position.
    function timeToMinutesOfDay(time, dayStart) {
        const minutes = Math.round((time.getTime() - dayStart.getTime()) / (60 * 1000));
        return Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
    }

    // Hand-rolled instead of toLocaleTimeString so the label is deterministic
    // in tests regardless of the runner's locale/ICU data (same reasoning as
    // popups.js's own formatTimeInputValue staying hand-rolled).
    function formatLabel(time) {
        let hours = time.getHours();
        const minutes = time.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const mm = minutes < 10 ? '0' + minutes : '' + minutes;
        return hours + ':' + mm + ' ' + ampm;
    }

    // A negative-habit lurker never advances in LIVE play (A2 model, see
    // items.js's isNonThreatening/loop.js) — it sits pinned at the far-right
    // "lurk post". Jeremy's call for the preview (2026-07-20): lurkers should
    // move WITH the midnight line once it's on-screen (>=8pm, see Clock.
    // shouldShowMidnightLine), riding it toward the base as previewTime
    // advances past 8pm; before 8pm (or scrubbed back before 8pm) they sit at
    // the same lurk post the live loop uses. This is preview-only — the live
    // loop's lurker positioning (loop.js) is completely unchanged.
    function getLurkerPreviewX(previewTime, dims) {
        if (!Clock.shouldShowMidnightLine(previewTime)) {
            return dims.gameScreenWidth - dims.habitEnemyWidth - CONFIG.NEGATIVE_LURK_RIGHT_MARGIN_PX;
        }
        return Clock.calculateMidnightLinePosition(previewTime, dims);
    }

    // Whole DAMAGE_INTERVAL_MS-sized periods elapsed since dueMs, as of atMs.
    // Clamped at 0 — an item not yet due (or the interval measured before its
    // due date) contributes no ticks. Mirrors loop.js's own tick-boundary
    // math (item.lastDamageTickTime starts at ~dueMs, advances by whole
    // DAMAGE_INTERVAL_MS steps) closely enough for a preview (within one
    // tick's worth of the 50ms live-loop granularity).
    function ticksSinceOverdue(dueMs, atMs, intervalMs) {
        return Math.max(0, Math.floor((atMs - dueMs) / intervalMs));
    }

    // Ticks that would fire for ONE item between "now" and previewMs — the
    // building block both projectBaseHealth and projectRoutineHealthDeltas
    // sum over their item list. Positive for a forward scrub past the item's
    // due date, negative on rewind (undoing ticks that haven't actually
    // applied yet), zero for an item not due by either time.
    function damageTicksDelta(dueMs, previewMs, nowMs, intervalMs) {
        return ticksSinceOverdue(dueMs, previewMs, intervalMs) - ticksSinceOverdue(dueMs, nowMs, intervalMs);
    }

    // regenAnchorMs is the live loop's lastRegenTickMs — already <= now,
    // parked at the last APPLIED regen tick boundary (same anchor shape as
    // an item's own lastDamageTickTime). null (regen never ticked yet, e.g.
    // game just booted this session) means no regen delta either way.
    function regenTicksDelta(regenAnchorMs, previewMs, nowMs, intervalMs) {
        if (regenAnchorMs == null) return 0;
        const atPreview = Math.floor((previewMs - regenAnchorMs) / intervalMs);
        const atNow = Math.floor((nowMs - regenAnchorMs) / intervalMs);
        return atPreview - atNow;
    }

    // items should already exclude non-threatening lurkers (they never
    // damage the base, live or previewed — see items.js's isNonThreatening).
    // Regen is netted in the same call since it shares the base's one HP
    // pool and, by CONFIG.js's own design comment, the SAME interval as
    // damage.
    function projectBaseHealth(items, currentHealth, previewMs, nowMs, regenAnchorMs) {
        const damageDelta = items.reduce((sum, item) => {
            return sum + damageTicksDelta(item.dueDateTime.getTime(), previewMs, nowMs, CONFIG.DAMAGE_INTERVAL_MS) * CONFIG.OVERDUE_DAMAGE;
        }, 0);
        const regenDelta = regenTicksDelta(regenAnchorMs, previewMs, nowMs, CONFIG.BASE_REGEN_INTERVAL_MS) * CONFIG.BASE_REGEN_HP;
        return Math.max(0, Math.min(CONFIG.MAX_BASE_HEALTH, currentHealth - damageDelta + regenDelta));
    }

    // No regen term — routines only recover via next-day revive-on-KO
    // (heroes.js), not a gradual tick like the base. getRoutineId(item)
    // resolves ownership (script.js threads Items.findRoutineForItem);
    // items with no owning routine (standalone tasks/habits) are skipped.
    // Returns a { [routineId]: delta } map — caller applies each delta
    // against that routine's own current health (this function never reads
    // or needs routine state itself).
    function projectRoutineHealthDeltas(items, previewMs, nowMs, getRoutineId) {
        const deltas = {};
        items.forEach((item) => {
            const routineId = getRoutineId(item);
            if (!routineId) return;
            const delta = damageTicksDelta(item.dueDateTime.getTime(), previewMs, nowMs, CONFIG.DAMAGE_INTERVAL_MS) * CONFIG.OVERDUE_DAMAGE;
            if (!delta) return;
            deltas[routineId] = (deltas[routineId] || 0) + delta;
        });
        return deltas;
    }

    return {
        getDayBounds,
        minutesOfDayToTime,
        timeToMinutesOfDay,
        formatLabel,
        getLurkerPreviewX,
        ticksSinceOverdue,
        damageTicksDelta,
        regenTicksDelta,
        projectBaseHealth,
        projectRoutineHealthDeltas,
        MINUTES_PER_DAY,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSlider;
}
