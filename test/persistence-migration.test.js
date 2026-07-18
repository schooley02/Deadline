/**
 * Persistence migration tests.
 *
 * v1 → v2 (2026-07-18): habit definitions gained `routineId` (null =
 * standalone). v1 saves have no such field, so the migration infers it from
 * routine membership — see DECISIONS.md. Without inference every pre-v2 habit
 * would load as standalone and wrongly un-gate habits that belong to a
 * (possibly inactive) routine.
 */
const Persistence = require('../js/persistence.js');

function v1Save(overrides = {}) {
    return {
        schemaVersion: 1,
        definedHabits: [],
        definedRoutines: [],
        ...overrides
    };
}

describe('migrate v1 → v2: habit routineId inference', () => {
    test('bumps schemaVersion to 2', () => {
        const save = Persistence.migrate(v1Save());
        expect(save.schemaVersion).toBe(2);
    });

    test('a habit listed by a routine gets that routine id', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1', name: 'Stretch' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: true }]
        }));
        expect(save.definedHabits[0].routineId).toBe('r1');
    });

    test('a habit listed by NO routine becomes standalone (null)', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1', name: 'Floss' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: [], isActive: true }]
        }));
        expect(save.definedHabits[0].routineId).toBeNull();
    });

    test('inference is independent of the routine isActive state', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: false }]
        }));
        expect(save.definedHabits[0].routineId).toBe('r1');
    });

    test('a habit in two routines takes the first as owner', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1' }],
            definedRoutines: [
                { id: 'r1', habitDefinitionIds: ['h1'] },
                { id: 'r2', habitDefinitionIds: ['h1'] }
            ]
        }));
        expect(save.definedHabits[0].routineId).toBe('r1');
    });

    test('mixed save: routine habits linked, standalone habits nulled', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1' }, { id: 'loose' }, { id: 'h2' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1', 'h2'] }]
        }));
        expect(save.definedHabits.map(h => h.routineId)).toEqual(['r1', null, 'r1']);
    });

    test('does not overwrite a routineId that is already present', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1', routineId: 'alreadySet' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'] }]
        }));
        expect(save.definedHabits[0].routineId).toBe('alreadySet');
    });

    test('preserves an explicit null routineId (does not re-link an orphan)', () => {
        const save = Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1', routineId: null }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'] }]
        }));
        expect(save.definedHabits[0].routineId).toBeNull();
    });

    test('tolerates a routine with no habitDefinitionIds array', () => {
        expect(() => Persistence.migrate(v1Save({
            definedHabits: [{ id: 'h1' }],
            definedRoutines: [{ id: 'r1' }]
        }))).not.toThrow();
    });

    test('tolerates a save with no definedHabits / definedRoutines at all', () => {
        const save = Persistence.migrate({ schemaVersion: 1 });
        expect(save.schemaVersion).toBe(2);
    });

    test('leaves other save fields untouched', () => {
        const save = Persistence.migrate(v1Save({
            playerXP: 120,
            definedHabits: [{ id: 'h1', name: 'Stretch', streak: 7 }],
            definedRoutines: []
        }));
        expect(save.playerXP).toBe(120);
        expect(save.definedHabits[0].streak).toBe(7);
        expect(save.definedHabits[0].name).toBe('Stretch');
    });
});

describe('migrate: version handling', () => {
    test('a v2 save passes through unchanged', () => {
        const original = { schemaVersion: 2, definedHabits: [{ id: 'h1', routineId: null }] };
        expect(Persistence.migrate(original)).toBe(original);
    });

    test('an unknown future schemaVersion is rejected', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        expect(Persistence.migrate({ schemaVersion: 99 })).toBeNull();
        warn.mockRestore();
    });
});
