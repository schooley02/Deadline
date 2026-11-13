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
    // eveningCheckTime (Habit Goals Build 3, 2026-11-01): "HH:MM" 24 h, when the evening check asks about Break habits still
    // unanswered today. Same default as CONFIG.EVENING_CHECK_DEFAULT (test/settings.test.js keeps the two in step).
    // timerHintSeen (2026-11-02): the one-time "a zombie is attacking, use the timer" notice has been shown.
    // devTools (2026-11-03): shows the DEV button + demo panel (js/devDemo.js, js/ui/devPanel.js). Off by default, per device: it is
    // left OUT of Backup & Transfer (script.js strips it on export and import) so a backup never turns it on somewhere else.
    // screenBuzz (2026-11-10, Jeremy): the phone's short vibration with the screen thump on a completion (js/ui/canvasThump.js). ON by
    // default; per device like devTools (script.js leaves it OUT of Backup & Transfer, so a backup never changes it somewhere else).
    // avatar (Mood Build A, 2026-11-13): 'male' | 'female', the player's choice (null = not chosen yet, which asks once). Mirrors Mood.AVATARS
    // (test/settings.test.js checks they match). A preference, not run state, so it survives a Reset and rides along in Backup & Transfer.
    // moodCardDay (same session): the local day "YYYY-MM-DD" the morning mood card was last shown, so it asks ONCE a day, even across a
    // reload. Per device like devTools: script.js leaves it OUT of Backup & Transfer.
    // noteOnTimerStop (Journal Build A, 2026-11-13): ask for an optional note when a timer is stopped by hand (docs/JOURNAL_PLAN.md). ON by
    // default. A preference like the avatar, so it rides along in Backup & Transfer.
    const VALID_AVATARS = ['male', 'female'];
    const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
    const DEFAULTS = { effectsIntensity: 'full', eveningCheckTime: '21:00', timerHintSeen: false, devTools: false, screenBuzz: true, avatar: null, moodCardDay: null, noteOnTimerStop: true };
    const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

    function cleanEveningTime(value) {
        if (typeof value !== 'string' || !TIME_RE.test(value.trim())) return DEFAULTS.eveningCheckTime;
        const [h, m] = value.trim().split(':');
        return (h.length === 1 ? '0' + h : h) + ':' + m;
    }

    function cleanAvatar(value) { return VALID_AVATARS.indexOf(value) !== -1 ? value : null; }
    function cleanDay(value) { return typeof value === 'string' && DAY_RE.test(value) ? value : null; }

    function load() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return Object.assign({}, DEFAULTS);
            const parsed = JSON.parse(raw);
            const intensity = VALID_INTENSITIES.indexOf(parsed && parsed.effectsIntensity) !== -1
                ? parsed.effectsIntensity
                : DEFAULTS.effectsIntensity;
            return {
                effectsIntensity: intensity,
                eveningCheckTime: cleanEveningTime(parsed && parsed.eveningCheckTime),
                timerHintSeen: !!(parsed && parsed.timerHintSeen === true),
                devTools: !!(parsed && parsed.devTools === true),
                screenBuzz: !(parsed && parsed.screenBuzz === false),
                avatar: cleanAvatar(parsed && parsed.avatar),
                moodCardDay: cleanDay(parsed && parsed.moodCardDay),
                noteOnTimerStop: !(parsed && parsed.noteOnTimerStop === false),
            };
        } catch (e) {
            console.error('Deadline: settings load failed', e);
            return Object.assign({}, DEFAULTS);
        }
    }

    function save(settings) {
        try {
            // Always write a COMPLETE, valid object: a caller that passes only one field (older code saved just
            // { effectsIntensity }) must not drop the others. Missing fields keep what is already stored.
            const merged = Object.assign({}, load(), settings || {});
            merged.eveningCheckTime = cleanEveningTime(merged.eveningCheckTime);
            merged.timerHintSeen = merged.timerHintSeen === true;
            merged.devTools = merged.devTools === true;
            merged.screenBuzz = merged.screenBuzz !== false;
            merged.avatar = cleanAvatar(merged.avatar);
            merged.moodCardDay = cleanDay(merged.moodCardDay);
            merged.noteOnTimerStop = merged.noteOnTimerStop !== false;
            if (VALID_INTENSITIES.indexOf(merged.effectsIntensity) === -1) merged.effectsIntensity = DEFAULTS.effectsIntensity;
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
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
        cleanEveningTime,
        cleanAvatar,
        bodyClassesForIntensity,
        applyEffectsIntensity,
        VALID_INTENSITIES,
        VALID_AVATARS,
        DEFAULTS,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Settings;
}
