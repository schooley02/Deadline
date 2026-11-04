/**
 * DevDemo -- the dev tools' demo state (Jeremy, 2026-11-03; ROADMAP "Dev '+' demo button").
 *
 * What it is: a few "pretend" values the dev panel (js/ui/devPanel.js) can set so the sky and the village can be previewed on
 * a phone without URL params: a forced weather band + trend, and one village star level for all eight buildings.
 *
 * Rules (each pinned by test/devDemo.test.js):
 *   - IN MEMORY ONLY. Nothing here touches localStorage, the save, the daily records or a backup export; a reload clears it.
 *   - GATED by the Settings "Developer tools" switch: while setEnabled(false) every getter answers "no demo" (null) and
 *     setEnabled(false) also clears whatever was set. A demo can therefore never leak out of a device that has the switch off.
 *   - It only ANSWERS the scene's questions (weather(), villageTier()); script.js asks it FIRST, then the ?climate= / ?xTier=
 *     URL params, then the real value. Real game logic never reads it: item drops, the run record's peak tiers and the
 *     village card all use the real tiers, so previewing star 5 can never pay out a reward.
 *
 * Pure: no DOM, no storage, no globals except an optional RunClimate passed in (js/runClimate.js builds the fake result with
 * the same `forced` flag the ?climate= override uses, so the Weather panel says "Dev preview" and the badge never pulses).
 */
const DevDemo = (() => {
    const BANDS = ['clear', 'hazy', 'overcast', 'fog', 'storm'];
    const TRENDS = ['steady', 'up', 'down'];
    const TIERS = [1, 2, 3, 4, 5];

    let enabled = false;
    let band = null;          // null = the real sky
    let trend = 'steady';
    let tier = null;          // null = the real village
    const listeners = [];

    function emit() {
        listeners.slice().forEach((fn) => {
            try { fn(snapshot()); } catch (e) { if (typeof console !== 'undefined') console.error('Deadline: dev demo listener failed', e); }
        });
    }

    /** A copy of the demo values (what the panel draws from). */
    function snapshot() {
        return { enabled, band, trend, tier, active: isActive() };
    }

    /** True while a demo value is both set and allowed (the switch is on). */
    function isActive() {
        return enabled && (band !== null || tier !== null);
    }

    function setEnabled(on) {
        const next = on === true;
        if (next === enabled) return;
        enabled = next;
        if (!enabled) { band = null; trend = 'steady'; tier = null; }
        emit();
    }

    /** band: one of BANDS, or null/'real' for the real sky. Anything else is ignored. A new band keeps the chosen trend. */
    function setBand(value) {
        if (!enabled) return false;
        const next = (value === null || value === 'real') ? null : (BANDS.indexOf(value) >= 0 ? value : undefined);
        if (next === undefined) return false;
        band = next;
        emit();
        return true;
    }

    /** trend: 'steady' | 'up' | 'down'. Only shows while a band is forced (the real sky has its own trend). */
    function setTrend(value) {
        if (!enabled || TRENDS.indexOf(value) < 0) return false;
        trend = value;
        emit();
        return true;
    }

    /** star: 1..5 for every building, or null/'real' for the real village. Anything else is ignored. */
    function setTier(value) {
        if (!enabled) return false;
        let next;
        if (value === null || value === 'real') next = null;
        else {
            const n = Number(value);
            next = (Number.isInteger(n) && TIERS.indexOf(n) >= 0) ? n : undefined;
        }
        if (next === undefined) return false;
        tier = next;
        emit();
        return true;
    }

    /** Back to the real sky and the real village (the switch stays on). */
    function reset() {
        if (band === null && trend === 'steady' && tier === null) return;
        band = null; trend = 'steady'; tier = null;
        emit();
    }

    /**
     * The forced weather as a RunClimate-shaped result ({ band, trend, forced: true, ... }), or null = no weather demo.
     * `runClimate` is injectable for tests; in the browser it is the RunClimate global.
     */
    function weather(runClimate) {
        if (!enabled || band === null) return null;
        const rc = runClimate || (typeof RunClimate !== 'undefined' ? RunClimate : null);
        if (!rc || typeof rc.forced !== 'function') return null;
        return rc.forced(band, trend);
    }

    /** The pretend star for every building (1..5), or null = use the real tier. */
    function villageTier() {
        return enabled ? tier : null;
    }

    /** Call fn(snapshot) after every change; returns an unsubscribe function. */
    function onChange(fn) {
        if (typeof fn !== 'function') return () => {};
        listeners.push(fn);
        return () => {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
        };
    }

    /** Test helper: back to a cold start (switch off, nothing set, no listeners). */
    function resetForTests() {
        enabled = false; band = null; trend = 'steady'; tier = null;
        listeners.length = 0;
    }

    return {
        BANDS, TRENDS, TIERS,
        snapshot, isActive, setEnabled, setBand, setTrend, setTier, reset,
        weather, villageTier, onChange, resetForTests,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevDemo;
}
