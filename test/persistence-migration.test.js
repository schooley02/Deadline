/**
 * Persistence migration tests.
 *
 * v1 → v2 (2026-07-18): habit definitions gained `routineId` (null =
 * standalone). v1 saves have no such field, so the migration infers it from
 * routine membership — see DECISIONS.md. Without inference every pre-v2 habit
 * would load as standalone and wrongly un-gate habits that belong to a
 * (possibly inactive) routine.
 *
 * v2 → v3 (2026-07-18): recurrence moves from habits' bare `frequency` string
 * to a `schedule` object on BOTH habit defs and routine task defs (routine
 * tasks had no recurrence field before), and habit defs gain an empty
 * `occurrenceHistory` (recording lands with the rate-based bonus). See
 * DECISIONS.md.
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
    test('bumps schemaVersion through the full chain to 3', () => {
        // The routineId inference is the v1→v2 step; the chain then continues
        // v2→v3, so a v1 save lands at the current SCHEMA_VERSION (3).
        const save = Persistence.migrate(v1Save());
        expect(save.schemaVersion).toBe(3);
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
        expect(save.schemaVersion).toBe(3);
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

describe('migrate v2 → v3: recurrence schedule + occurrenceHistory', () => {
    function v2Save(overrides = {}) {
        return {
            schemaVersion: 2,
            definedHabits: [],
            definedRoutines: [],
            definedTasks: [],
            ...overrides
        };
    }

    test('bumps schemaVersion to 3', () => {
        expect(Persistence.migrate(v2Save()).schemaVersion).toBe(3);
    });

    test("a habit's bare frequency string becomes an every-day schedule and is removed", () => {
        const save = Persistence.migrate(v2Save({
            definedHabits: [{ id: 'h1', frequency: 'daily', routineId: null }]
        }));
        expect(save.definedHabits[0].schedule).toEqual({
            frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null,
        });
        expect(save.definedHabits[0].frequency).toBeUndefined();
    });

    test('a habit gains an empty occurrenceHistory', () => {
        const save = Persistence.migrate(v2Save({
            definedHabits: [{ id: 'h1', frequency: 'daily' }]
        }));
        expect(save.definedHabits[0].occurrenceHistory).toEqual([]);
    });

    test('routine task definitions gain a default daily schedule', () => {
        const save = Persistence.migrate(v2Save({
            definedTasks: [{ id: 't1', name: 'Water plants', defaultDueTime: '09:00' }]
        }));
        expect(save.definedTasks[0].schedule).toEqual({
            frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], dayOfMonth: null,
        });
        expect(save.definedTasks[0].defaultDueTime).toBe('09:00'); // untouched
    });

    test('does not clobber an already-present schedule or occurrenceHistory', () => {
        const existing = { frequency: 'weekly', daysOfWeek: [1, 3], dayOfMonth: null };
        const save = Persistence.migrate(v2Save({
            definedHabits: [{ id: 'h1', schedule: existing, occurrenceHistory: [{ date: '2026-07-17', success: true }] }]
        }));
        expect(save.definedHabits[0].schedule).toBe(existing);
        expect(save.definedHabits[0].occurrenceHistory).toHaveLength(1);
    });

    test('tolerates a save with no definedTasks array', () => {
        const save = v2Save();
        delete save.definedTasks;
        expect(() => Persistence.migrate(save)).not.toThrow();
        expect(save.schemaVersion).toBe(3);
    });

    test('runs the full v1 → v3 chain in one pass', () => {
        const save = Persistence.migrate({
            schemaVersion: 1,
            definedHabits: [{ id: 'h1', frequency: 'daily' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: true }],
            definedTasks: [{ id: 't1' }]
        });
        expect(save.schemaVersion).toBe(3);
        expect(save.definedHabits[0].routineId).toBe('r1');     // v1→v2 ran
        expect(save.definedHabits[0].schedule.frequency).toBe('daily'); // v2→v3 ran
        expect(save.definedHabits[0].occurrenceHistory).toEqual([]);
        expect(save.definedTasks[0].schedule.frequency).toBe('daily');
    });
});

describe('migrate: version handling', () => {
    test('a v3 save passes through unchanged (same reference)', () => {
        const original = {
            schemaVersion: 3,
            definedHabits: [{ id: 'h1', routineId: null, schedule: { frequency: 'daily', daysOfWeek: [0,1,2,3,4,5,6], dayOfMonth: null }, occurrenceHistory: [] }]
        };
        expect(Persistence.migrate(original)).toBe(original);
    });

    test('an unknown future schemaVersion is rejected', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        expect(Persistence.migrate({ schemaVersion: 99 })).toBeNull();
        warn.mockRestore();
    });
});
