/**
 * DevDemo -- the dev tools' demo state (Jeremy, 2026-11-03; ROADMAP "Dev '+' demo button").
 *
 * What it is: a few "pretend" values the dev panel (js/ui/devPanel.js) can set so the sky and the village can be previewed on
 * a phone without URL params: a forced weather band + trend, one village star level for all eight buildings, and a church
 * damage state (ART ONLY: it names which church picture to show, it is never a health value the game uses).
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
    // The church preview's states, as the health each damage picture starts at (100 > 75 > 50 > 25 > 0 pick the five pictures).
    // Only script.js's art-only preview reads one; no game rule, HUD number, save or record ever does.
    const CHURCH_STATES = [100, 75, 50, 25, 0];
    // The graveyard's Memorial obelisk (5 stages) and growing tree (3 stages), previewed on their own (2026-11-08).
    const MEMORIAL_STAGES = [1, 2, 3, 4, 5];
    const TREE_STAGES = [1, 2, 3];

    let enabled = false;
    let band = null;          // null = the real sky
    let trend = 'steady';
    let tier = null;          // null = the real village
    let church = null;        // null = the real church picture
    let memorial = null;      // null = the real Memorial stage (1..5 pins the obelisk)
    let tree = null;          // null = the real tree stage (1..3 pins the tree)
    const listeners = [];

    function emit() {
        listeners.slice().forEach((fn) => {
            try { fn(snapshot()); } catch (e) { if (typeof console !== 'undefined') console.error('Deadline: dev demo listener failed', e); }
        });
    }

    /** A copy of the demo values (what the panel draws from). */
    function snapshot() {
        return { enabled, band, trend, tier, church, memorial, tree, active: isActive() };
    }

    /** True while a demo value is both set and allowed (the switch is on). */
    function isActive() {
        return enabled && (band !== null || tier !== null || church !== null || memorial !== null || tree !== null);
    }

    function setEnabled(on) {
        const next = on === true;
        if (next === enabled) return;
        enabled = next;
        if (!enabled) { band = null; trend = 'steady'; tier = null; church = null; memorial = null; tree = null; }
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

    /** church: 100 / 75 / 50 / 25 / 0 (the damage picture to show), or null/'real' for the real church. Anything else is ignored. */
    function setChurch(value) {
        if (!enabled) return false;
        let next;
        if (value === null || value === 'real') next = null;
        else {
            const n = Number(value);
            next = (value !== '' && Number.isInteger(n) && CHURCH_STATES.indexOf(n) >= 0) ? n : undefined;
        }
        if (next === undefined) return false;
        church = next;
        emit();
        return true;
    }

    /** Shared by the Memorial and tree setters: a whole number in `list`, or null/'real' for the real one; anything else is ignored. */
    function pick(value, list) {
        if (value === null || value === 'real') return null;
        const n = Number(value);
        return (value !== '' && Number.isInteger(n) && list.indexOf(n) >= 0) ? n : undefined;
    }

    /** Memorial obelisk stage: 1..5, or null/'real' for the real stage. Anything else is ignored. Beats the village star for the obelisk. */
    function setMemorial(value) {
        if (!enabled) return false;
        const next = pick(value, MEMORIAL_STAGES);
        if (next === undefined) return false;
        memorial = next;
        emit();
        return true;
    }

    /** Graveyard tree stage: 1..3 (sapling / young / giant), or null/'real' for the real stage. Anything else is ignored. */
    function setTree(value) {
        if (!enabled) return false;
        const next = pick(value, TREE_STAGES);
        if (next === undefined) return false;
        tree = next;
        emit();
        return true;
    }

    /** Back to the real sky, village, church, Memorial and tree (the switch stays on). */
    function reset() {
        if (band === null && trend === 'steady' && tier === null && church === null && memorial === null && tree === null) return;
        band = null; trend = 'steady'; tier = null; church = null; memorial = null; tree = null;
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

    /** The church picture to preview as a stand-in health (100 / 75 / 50 / 25 / 0), or null = show the real church. ART ONLY. */
    function churchHealth() {
        return enabled ? church : null;
    }

    /** The pretend Memorial stage (1..5), or null = fall through to the village star / ?memorialTier= / the real stage. */
    function memorialStage() {
        return enabled ? memorial : null;
    }

    /** The pretend tree stage (1..3), or null = use the real stage / ?treeStage=. */
    function treeStage() {
        return enabled ? tree : null;
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
        enabled = false; band = null; trend = 'steady'; tier = null; church = null; memorial = null; tree = null;
        listeners.length = 0;
    }

    return {
        BANDS, TRENDS, TIERS, CHURCH_STATES, MEMORIAL_STAGES, TREE_STAGES,
        snapshot, isActive, setEnabled, setBand, setTrend, setTier, setChurch, setMemorial, setTree, reset,
        weather, villageTier, churchHealth, memorialStage, treeStage, onChange, resetForTests,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevDemo;
}
