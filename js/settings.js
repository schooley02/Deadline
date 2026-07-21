/**
 * Settings — user preferences, persisted SEPARATELY from the main game save
 * (Milestone 4, [P2-UI-009], session 59, 2026-07-19).
 *
 * docs/DATA_SCHEMA.md has forward-declared `deadline.settings` since
 * Milestone 1 ("user settings (demo clock on/off, etc.) — not yet
 * implemented") — this is its first real field. Deliberately a DIFFERENT
 * localStorage key from `deadline.save` (js/persistence.js), not a
 * schemaVersion-bumped field on the main save: preferences aren't run state,
 * shouldn't be wiped by a dev Reset or a fresh run, and don't need the
 * debounced-write/Date-revival machinery persistence.js exists for — a
 * synchronous read/write on the rare occasion the player changes a setting
 * is simpler and correct.
 *
 * effectsIntensity gates the [P2-UI-009] streak fire effect (css/
 * enemyStatus.css's .high-streak/.super-streak): 'full' (default, no extra
 * body class), 'reduced' (static glow, no animation), 'off' (no glow at
 * all). Bad/missing/corrupt localStorage always falls back to 'full' rather
 * than throwing — matches persistence.js's "never break gameplay" precedent.
 */
const Settings = (() => {
    const SETTINGS_KEY = 'deadline.settings';
    const VALID_INTENSITIES = ['full', 'reduced', 'off'];
    const DEFAULTS = { effectsIntensity: 'full' };

    function load() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return Object.assign({}, DEFAULTS);
            const parsed = JSON.parse(raw);
            const intensity = VALID_INTENSITIES.indexOf(parsed && parsed.effectsIntensity) !== -1
                ? parsed.effectsIntensity
                : DEFAULTS.effectsIntensity;
            return { effectsIntensity: intensity };
        } catch (e) {
            console.error('Deadline: settings load failed', e);
            return Object.assign({}, DEFAULTS);
        }
    }

    function save(settings) {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('Deadline: settings save failed', e);
            return false;
        }
    }

    // Pure: given an intensity, which <body> classes should be present vs
    // absent. Split from applyEffectsIntensity so the mapping is unit-
    // testable without a DOM (same "pure core, thin DOM wrapper" pattern as
    // spawning.js's resolveEnemyVisual).
    function bodyClassesForIntensity(intensity) {
        if (intensity === 'off') return { add: ['fx-off'], remove: ['fx-reduced'] };
        if (intensity === 'reduced') return { add: ['fx-reduced'], remove: ['fx-off'] };
        return { add: [], remove: ['fx-off', 'fx-reduced'] };
    }

    // bodyEl defaults to document.body; overridable for tests that stub a
    // fake element instead of requiring a DOM environment.
    function applyEffectsIntensity(intensity, bodyEl) {
        const target = bodyEl || (typeof document !== 'undefined' ? document.body : null);
        if (!target) return;
        const { add, remove } = bodyClassesForIntensity(intensity);
        remove.forEach((c) => target.classList.remove(c));
        add.forEach((c) => target.classList.add(c));
    }

    return {
        SETTINGS_KEY, // exposed for export/import's pre-import backup (js/exportImport.js wiring in script.js)
        load,
        save,
        bodyClassesForIntensity,
        applyEffectsIntensity,
        VALID_INTENSITIES,
        DEFAULTS,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Settings;
}
