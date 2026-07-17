/**
 * Persistence — localStorage save/load for Deadline (Milestone 1).
 *
 * DECISION (2026-07-17, logged in docs/DECISIONS.md): schemaVersion 1
 * serializes the monolith's CURRENT in-memory shapes as-is (numeric item ids,
 * activeItems/completedItems split, etc.). Reconciling toward the target
 * schema in docs/DATA_SCHEMA.md happens during Milestone 2 extractions via
 * schemaVersion bumps + migrations here — NOT by reshaping state at save time.
 *
 * Usage (see script.js):
 *   Persistence.requestSave(getStateFn)  — debounced save (call on every mutation)
 *   Persistence.flush()                  — immediate save (beforeunload/visibilitychange)
 *   Persistence.load()                   — parsed save with Dates revived, or null
 *   Persistence.clear()                  — remove the save (fresh run)
 */
const Persistence = (() => {
    const SAVE_KEY = 'deadline.save';
    const SCHEMA_VERSION = 1;
    const DEBOUNCE_MS = 500;

    // DOM references on item objects — never serialized, rebuilt on load.
    const STRIP_KEYS = ['element', 'listItemElement'];

    // Matches Date#toJSON output (and equivalent ISO datetimes). Deliberately
    // strict — requires the full date+time form — so ordinary strings (names,
    // ids like "habitDef_0_175…", timeOfDay values) can never false-positive.
    const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;

    let debounceTimer = null;
    let pendingGetState = null;

    function replacer(key, value) {
        if (STRIP_KEYS.indexOf(key) !== -1) return undefined;
        return value;
    }

    function reviver(key, value) {
        if (typeof value === 'string' && ISO_DATETIME_RE.test(value)) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) return d;
        }
        return value;
    }

    function serialize(state) {
        return JSON.stringify(
            Object.assign(
                { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString() },
                state
            ),
            replacer
        );
    }

    function deserialize(raw) {
        return JSON.parse(raw, reviver);
    }

    function saveNow() {
        if (!pendingGetState) return false;
        try {
            localStorage.setItem(SAVE_KEY, serialize(pendingGetState()));
            return true;
        } catch (e) {
            // Quota exceeded / privacy mode / serialization error — never break gameplay.
            console.error('Deadline: save failed', e);
            return false;
        }
    }

    /** Debounced save. getState must return the plain state object to persist. */
    function requestSave(getState) {
        pendingGetState = getState;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            saveNow();
        }, DEBOUNCE_MS);
    }

    /** Cancel any pending debounce and save immediately. */
    function flush() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        return saveNow();
    }

    /**
     * Migration chain. Each future schema bump adds a step that upgrades
     * save in place (v1→v2, v2→v3, …). Log every migration in DECISIONS.md.
     */
    function migrate(save) {
        // if (save.schemaVersion === 1) { …upgrade…; save.schemaVersion = 2; }
        if (save.schemaVersion !== SCHEMA_VERSION) {
            console.warn(
                'Deadline: save has unknown schemaVersion ' + save.schemaVersion +
                ' (expected ' + SCHEMA_VERSION + ') — ignoring it.'
            );
            return null;
        }
        return save;
    }

    /** Returns the migrated save object (Dates revived) or null if absent/invalid. */
    function load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return null;
            const save = deserialize(raw);
            if (!save || typeof save.schemaVersion !== 'number') return null;
            return migrate(save);
        } catch (e) {
            console.error('Deadline: load failed — starting fresh', e);
            return null;
        }
    }

    function clear() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (e) { /* ignore */ }
    }

    return {
        SAVE_KEY,
        SCHEMA_VERSION,
        serialize,     // exposed for tests
        deserialize,   // exposed for tests
        requestSave,
        flush,
        load,
        clear
    };
})();

// Export for Jest/Node; browser picks up the global `Persistence` via <script> tag.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Persistence;
}
