/**
 * ExportImport core tests (Milestone 5, first item, 2026-07-20).
 *
 * js/exportImport.js references Persistence.SCHEMA_VERSION as a bare global
 * (same pattern as shop.test.js requiring Economy as a global for shop.js).
 */
global.Persistence = require('../js/persistence.js');
const ExportImport = require('../js/exportImport.js');

function fakeSaveState(overrides) {
    return Object.assign({
        baseHealth: 80,
        playerXP: 120,
        playerLevel: 3,
        playerPoints: 45,
        activeItems: [{ id: 1, name: 'Test task' }],
        completedItems: [],
        definedHabits: [{ id: 'h1', name: 'Drink Water' }],
        definedRoutines: [],
        definedTasks: [],
    }, overrides || {});
}

describe('buildEnvelope', () => {
    test('produces the expected shape with a valid checksum', () => {
        const envelope = ExportImport.buildEnvelope({
            getPersistableState: () => fakeSaveState(),
            getSettings: () => ({ effectsIntensity: 'full' }),
            now: new Date('2026-07-20T12:00:00.000Z'),
        });

        expect(envelope.exportFormatVersion).toBe(ExportImport.EXPORT_FORMAT_VERSION);
        expect(envelope.exportedAt).toBe('2026-07-20T12:00:00.000Z');
        expect(envelope.appSchemaVersion).toBe(Persistence.SCHEMA_VERSION);
        expect(envelope.save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
        expect(envelope.save.baseHealth).toBe(80);
        expect(envelope.settings).toEqual({ effectsIntensity: 'full' });
        expect(envelope.summary).toEqual({
            daysSurvived: 0,
            playerLevel: 3,
            playerXP: 120,
            playerPoints: 45,
            activeItemCount: 1,
            habitCount: 1,
            routineCount: 0,
        });
        expect(typeof envelope.checksum).toBe('string');
    });

    test('defaults settings to {} when no getSettings collaborator given', () => {
        const envelope = ExportImport.buildEnvelope({ getPersistableState: () => fakeSaveState() });
        expect(envelope.settings).toEqual({});
    });
});

describe('validateEnvelope — round trip', () => {
    function realExport() {
        return ExportImport.buildEnvelope({
            getPersistableState: () => fakeSaveState(),
            getSettings: () => ({ effectsIntensity: 'reduced' }),
        });
    }

    test('accepts a freshly built envelope (object form)', () => {
        const result = ExportImport.validateEnvelope(realExport());
        expect(result.valid).toBe(true);
        expect(result.save.baseHealth).toBe(80);
        expect(result.settings).toEqual({ effectsIntensity: 'reduced' });
    });

    test('accepts a freshly built envelope round-tripped through JSON (paste/file simulation)', () => {
        const asString = JSON.stringify(realExport());
        const result = ExportImport.validateEnvelope(asString);
        expect(result.valid).toBe(true);
        expect(result.save.definedHabits[0].name).toBe('Drink Water');
    });
});

describe('validateEnvelope — rejections', () => {
    test('rejects truncated JSON (simulating a cut-off paste)', () => {
        const full = JSON.stringify(ExportImport.buildEnvelope({ getPersistableState: () => fakeSaveState() }));
        const truncated = full.slice(0, Math.floor(full.length / 2));
        const result = ExportImport.validateEnvelope(truncated);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('parse');
    });

    test('rejects a non-Deadline object', () => {
        const result = ExportImport.validateEnvelope({ hello: 'world' });
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('shape');
    });

    test('rejects a garbage string', () => {
        const result = ExportImport.validateEnvelope('not json at all {{{');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('parse');
    });

    test('rejects a tampered payload (checksum mismatch)', () => {
        const envelope = ExportImport.buildEnvelope({ getPersistableState: () => fakeSaveState() });
        envelope.save.playerPoints = 999999; // tamper after checksum was computed
        const result = ExportImport.validateEnvelope(envelope);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('checksum');
    });

    test('rejects an export from a newer schemaVersion than this build supports', () => {
        // Hand-construct rather than via buildEnvelope, since buildEnvelope
        // always stamps the CURRENT Persistence.SCHEMA_VERSION.
        const base = {
            exportFormatVersion: ExportImport.EXPORT_FORMAT_VERSION,
            exportedAt: '2026-07-20T12:00:00.000Z',
            appSchemaVersion: Persistence.SCHEMA_VERSION + 1,
            summary: ExportImport.buildSummary(fakeSaveState()),
            save: Object.assign(fakeSaveState(), { schemaVersion: Persistence.SCHEMA_VERSION + 1 }),
            settings: {},
        };
        base.checksum = ExportImport.computeChecksum(base);
        const result = ExportImport.validateEnvelope(base);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('newer-version');
    });

    test('accepts an OLDER schemaVersion export (migration chain handles it on load, not this module)', () => {
        const base = {
            exportFormatVersion: ExportImport.EXPORT_FORMAT_VERSION,
            exportedAt: '2026-07-18T12:00:00.000Z',
            appSchemaVersion: 5,
            summary: ExportImport.buildSummary(fakeSaveState()),
            save: Object.assign(fakeSaveState(), { schemaVersion: 5 }),
            settings: {},
        };
        base.checksum = ExportImport.computeChecksum(base);
        const result = ExportImport.validateEnvelope(base);
        expect(result.valid).toBe(true);
        expect(result.save.schemaVersion).toBe(5);
    });

    test('rejects an export from a newer EXPORT FORMAT version even with a matching schemaVersion', () => {
        const base = {
            exportFormatVersion: ExportImport.EXPORT_FORMAT_VERSION + 1,
            exportedAt: '2026-07-20T12:00:00.000Z',
            appSchemaVersion: Persistence.SCHEMA_VERSION,
            summary: ExportImport.buildSummary(fakeSaveState()),
            save: Object.assign(fakeSaveState(), { schemaVersion: Persistence.SCHEMA_VERSION }),
            settings: {},
        };
        base.checksum = ExportImport.computeChecksum(base);
        const result = ExportImport.validateEnvelope(base);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('newer-version');
    });
});

describe('computeChecksum', () => {
    test('is deterministic for the same object shape', () => {
        const a = { foo: 'bar', n: 1 };
        const b = { foo: 'bar', n: 1 };
        expect(ExportImport.computeChecksum(a)).toBe(ExportImport.computeChecksum(b));
    });

    test('changes when content changes', () => {
        expect(ExportImport.computeChecksum({ a: 1 })).not.toBe(ExportImport.computeChecksum({ a: 2 }));
    });
});
