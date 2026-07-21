/**
 * ExportImport — cross-device / cross-version save portability (Milestone 5,
 * first item, 2026-07-20).
 *
 * Problem: no cloud sync exists (and won't — see docs/DECISIONS.md, this
 * would duplicate the session-74 "packaging only, no sync" PWA call). Jeremy
 * plays/tests across desktop and phone and across in-development builds, and
 * wants a manual way to carry his full game state (tasks/habits/routines/
 * stats/tokens/everything persisted) between them. This module builds and
 * validates a portable JSON "envelope" wrapping BOTH localStorage keys
 * (`deadline.save` via js/persistence.js, `deadline.settings` via
 * js/settings.js) as one file/paste-able blob. js/ui/settingsView.js renders
 * the Export/Import controls; script.js owns the actual localStorage
 * write + reload on import (see that wiring for the "why reload, not
 * hot-swap" reasoning).
 *
 * Design (resolved with Jeremy 2026-07-20):
 *   - Full replace, no merge. Merging two independent play histories (id
 *     collisions, conflicting streak/occurrence history) is a correctness
 *     tar pit with no payoff for "pick up where I left off" / "test a
 *     different build" use cases.
 *   - A newer-schema-than-this-build import is REJECTED outright (never
 *     downgrade-mangled) — the player needs to update the app first. An
 *     OLDER schema imports fine: the exact same migration chain that runs on
 *     every normal page load (js/persistence.js's `migrate`) runs on it too,
 *     since the import path is "write to localStorage, then reload" (not a
 *     separate parse/upgrade path).
 *   - Importing from a save that's AHEAD in wall-clock time (desktop at
 *     noon -> phone at 6pm) is NOT special-cased: normal offline catch-up
 *     (js/damage.js) runs exactly as it would after closing the app for 6
 *     real hours, capped per-item same as always (Jeremy's call — treat an
 *     import exactly like a reload, no new code path).
 *   - checksum guards against a truncated copy/paste (the failure mode a
 *     file download doesn't have but a clipboard paste does) — NOT a
 *     cryptographic integrity guarantee, just corruption detection. FNV-1a
 *     over the JSON string minus the checksum field itself; deterministic
 *     because envelope key insertion order is fixed by buildEnvelope and
 *     JSON.parse/stringify round-trips preserve object key order.
 *
 * exportFormatVersion is versioned SEPARATELY from Persistence.SCHEMA_VERSION
 * — it describes the ENVELOPE shape (this module), not the game save shape
 * (persistence.js). They'll usually move together but don't have to.
 *
 * No DOM/localStorage access in this module — pure build/validate only,
 * matching the shop.js/economy.js "pure core, thin caller-owned wiring"
 * convention. References Persistence.SCHEMA_VERSION as a bare global (same
 * pattern as shop.js referencing Economy) — index.html loads persistence.js
 * before this file.
 */
const ExportImport = (() => {

    const EXPORT_FORMAT_VERSION = 1;

    // FNV-1a 32-bit, hex-encoded. Not cryptographic — corruption detection
    // only (see header). Math.imul keeps the multiply within 32-bit
    // semantics consistently across engines.
    function computeChecksum(obj) {
        const str = JSON.stringify(obj);
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        return (hash >>> 0).toString(16);
    }

    // Small human-readable snapshot shown in the confirm-replace modal
    // (current vs incoming) — never used for validation, display only.
    function buildSummary(saveObj) {
        const s = saveObj || {};
        return {
            daysSurvived: typeof s.daysSurvived === 'number' ? s.daysSurvived : 0,
            playerLevel: typeof s.playerLevel === 'number' ? s.playerLevel : 1,
            playerXP: typeof s.playerXP === 'number' ? s.playerXP : 0,
            playerPoints: typeof s.playerPoints === 'number' ? s.playerPoints : 0,
            activeItemCount: Array.isArray(s.activeItems) ? s.activeItems.length : 0,
            habitCount: Array.isArray(s.definedHabits) ? s.definedHabits.length : 0,
            routineCount: Array.isArray(s.definedRoutines) ? s.definedRoutines.length : 0,
        };
    }

    /**
     * deps: { getPersistableState(): rawSaveState, getSettings(): settingsObj,
     *         now: Date (optional, defaults to new Date()) }
     * rawSaveState is the SAME shape state.js's getPersistableState()
     * returns (DOM refs and all) — we route it through Persistence.serialize
     * so the export gets the identical replacer-stripping + schemaVersion/
     * savedAt stamping a normal save would, then re-parse into a plain
     * object to embed. Returns the full envelope object (not yet
     * stringified — callers decide file-download vs clipboard-copy
     * formatting).
     */
    function buildEnvelope(deps) {
        const now = deps.now || new Date();
        const saveJson = Persistence.serialize(deps.getPersistableState());
        const saveObj = JSON.parse(saveJson);
        const settingsObj = deps.getSettings ? deps.getSettings() : {};

        const envelope = {
            exportFormatVersion: EXPORT_FORMAT_VERSION,
            exportedAt: now.toISOString(),
            appSchemaVersion: saveObj.schemaVersion,
            summary: buildSummary(saveObj),
            save: saveObj,
            settings: settingsObj,
        };
        envelope.checksum = computeChecksum(envelope);
        return envelope;
    }

    /**
     * raw: either a JSON string (paste/file contents) or an already-parsed
     * object. Returns { valid: true, envelope, save, settings, summary } or
     * { valid: false, reason: <short code>, message: <human string> }.
     * reason codes: 'parse' | 'shape' | 'checksum' | 'newer-version'.
     */
    function validateEnvelope(raw) {
        let parsed;
        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                return {
                    valid: false,
                    reason: 'parse',
                    message: 'That doesn\'t look like a valid export — the text may be incomplete (a partial copy/paste is the usual cause).',
                };
            }
        } else if (raw && typeof raw === 'object') {
            parsed = raw;
        } else {
            return { valid: false, reason: 'shape', message: 'No export data found.' };
        }

        if (
            typeof parsed !== 'object' || parsed === null ||
            typeof parsed.exportFormatVersion !== 'number' ||
            typeof parsed.checksum !== 'string' ||
            typeof parsed.save !== 'object' || parsed.save === null ||
            typeof parsed.save.schemaVersion !== 'number'
        ) {
            return {
                valid: false,
                reason: 'shape',
                message: 'This doesn\'t look like a Deadline export file.',
            };
        }

        const { checksum, ...rest } = parsed;
        if (computeChecksum(rest) !== checksum) {
            return {
                valid: false,
                reason: 'checksum',
                message: 'This export looks corrupted or was cut off (checksum mismatch). Try exporting again.',
            };
        }

        if (
            parsed.exportFormatVersion > EXPORT_FORMAT_VERSION ||
            parsed.save.schemaVersion > Persistence.SCHEMA_VERSION
        ) {
            return {
                valid: false,
                reason: 'newer-version',
                message: 'This export was made with a newer version of Deadline than you\'re running. Update the app before importing it.',
            };
        }

        return {
            valid: true,
            envelope: parsed,
            save: parsed.save,
            settings: parsed.settings || {},
            summary: parsed.summary || buildSummary(parsed.save),
        };
    }

    return {
        EXPORT_FORMAT_VERSION,
        computeChecksum, // exposed for tests
        buildSummary,
        buildEnvelope,
        validateEnvelope,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportImport;
}
