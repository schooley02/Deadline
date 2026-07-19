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

describe('negative playerPoints round-trips through serialize/deserialize ([P1-DATA-005] sub-session 3)', () => {
    test('a negative balance survives serialize -> deserialize unchanged', () => {
        const raw = Persistence.serialize({ schemaVersion: Persistence.SCHEMA_VERSION, playerPoints: -37 });
        const restored = Persistence.deserialize(raw);
        expect(restored.playerPoints).toBe(-37);
    });

    test('a negative balance survives the full migrate chain unchanged (not touched by any migration step)', () => {
        const save = Persistence.migrate(v1Save({ playerPoints: -8 }));
        expect(save.playerPoints).toBe(-8);
    });
});

function v1Save(overrides = {}) {
    return {
        schemaVersion: 1,
        definedHabits: [],
        definedRoutines: [],
        ...overrides
    };
}

describe('migrate v1 → v2: habit routineId inference', () => {
    test('bumps schemaVersion through the full chain to the current version', () => {
        // The routineId inference is the v1→v2 step; the chain then continues
        // v2→v3→v4, so a v1 save lands at the current SCHEMA_VERSION.
        const save = Persistence.migrate(v1Save());
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
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
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
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

    test('runs the v2→v3 step and continues to the current version', () => {
        expect(Persistence.migrate(v2Save()).schemaVersion).toBe(Persistence.SCHEMA_VERSION);
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
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
    });

    test('runs the full v1 → current chain in one pass', () => {
        const save = Persistence.migrate({
            schemaVersion: 1,
            definedHabits: [{ id: 'h1', frequency: 'daily' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: true }],
            definedTasks: [{ id: 't1' }]
        });
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
        expect(save.definedHabits[0].routineId).toBe('r1');     // v1→v2 ran
        expect(save.definedHabits[0].schedule.frequency).toBe('daily'); // v2→v3 ran
        expect(save.definedHabits[0].occurrenceHistory).toEqual([]);
        expect(save.definedTasks[0].schedule.frequency).toBe('daily');
        expect(save.inventory).toEqual({}); // v3→v4 ran
    });
});

describe('migrate v3 → v4: shop inventory', () => {
    function v3Save(overrides = {}) {
        return {
            schemaVersion: 3,
            definedHabits: [],
            definedRoutines: [],
            definedTasks: [],
            ...overrides
        };
    }

    test('runs the v3→v4 step (inventory seeded) on the way to the current version', () => {
        // migrate() chains all the way to Persistence.SCHEMA_VERSION in one
        // call (v4→v5 landed 2026-07-19, [P1-DATA-005] sub-session 5) — this
        // asserts the v3→v4 step specifically ran, not the final version.
        expect(Persistence.migrate(v3Save()).inventory).toEqual({});
    });

    test('seeds an empty inventory on a save that has none', () => {
        const save = Persistence.migrate(v3Save());
        expect(save.inventory).toEqual({});
    });

    test('does not clobber an existing inventory', () => {
        const save = Persistence.migrate(v3Save({ inventory: { repair_small: 2 } }));
        expect(save.inventory).toEqual({ repair_small: 2 });
    });

    test('replaces a malformed inventory with an empty object', () => {
        const save = Persistence.migrate(v3Save({ inventory: 'garbage' }));
        expect(save.inventory).toEqual({});
    });

    test('leaves other save fields untouched', () => {
        const save = Persistence.migrate(v3Save({ playerPoints: 200 }));
        expect(save.playerPoints).toBe(200);
    });
});

describe('migrate v4 → v5: Cheat Day (cheatDayDate)', () => {
    function v4Save(overrides = {}) {
        return {
            schemaVersion: 4,
            definedHabits: [],
            definedRoutines: [],
            definedTasks: [],
            inventory: {},
            ...overrides
        };
    }

    test('bumps schemaVersion to the current version', () => {
        expect(Persistence.migrate(v4Save()).schemaVersion).toBe(Persistence.SCHEMA_VERSION);
    });

    test('seeds cheatDayDate: null on every habit def that lacks it', () => {
        const save = Persistence.migrate(v4Save({
            definedHabits: [{ id: 'h1' }, { id: 'h2' }]
        }));
        expect(save.definedHabits[0].cheatDayDate).toBeNull();
        expect(save.definedHabits[1].cheatDayDate).toBeNull();
    });

    test('does not clobber an existing cheatDayDate', () => {
        const save = Persistence.migrate(v4Save({
            definedHabits: [{ id: 'h1', cheatDayDate: '2026-07-18' }]
        }));
        expect(save.definedHabits[0].cheatDayDate).toBe('2026-07-18');
    });

    test('leaves other save fields untouched', () => {
        const save = Persistence.migrate(v4Save({ playerPoints: 200 }));
        expect(save.playerPoints).toBe(200);
    });
});

describe('migrate v5 → v6: frozen routine slots (frozenState + modificationHistory)', () => {
    function v5Save(overrides = {}) {
        return {
            schemaVersion: 5,
            definedHabits: [],
            definedRoutines: [],
            definedTasks: [],
            inventory: {},
            ...overrides
        };
    }

    test('bumps schemaVersion to the current version', () => {
        expect(Persistence.migrate(v5Save()).schemaVersion).toBe(Persistence.SCHEMA_VERSION);
    });

    test('seeds frozenState: null on every routine that lacks it', () => {
        const save = Persistence.migrate(v5Save({
            definedRoutines: [{ id: 'r1' }, { id: 'r2' }]
        }));
        expect(save.definedRoutines[0].frozenState).toBeNull();
        expect(save.definedRoutines[1].frozenState).toBeNull();
    });

    test('does not clobber an existing frozenState', () => {
        const existing = { frozenBy: 'h1', frozenAt: '2026-07-19T00:00:00.000Z' };
        const save = Persistence.migrate(v5Save({
            definedRoutines: [{ id: 'r1', frozenState: existing }]
        }));
        expect(save.definedRoutines[0].frozenState).toBe(existing);
    });

    test('seeds modificationHistory: [] on every habit def that lacks it', () => {
        const save = Persistence.migrate(v5Save({
            definedHabits: [{ id: 'h1' }, { id: 'h2' }]
        }));
        expect(save.definedHabits[0].modificationHistory).toEqual([]);
        expect(save.definedHabits[1].modificationHistory).toEqual([]);
    });

    test('does not clobber an existing modificationHistory', () => {
        const existing = [{ timestamp: '2026-07-19T00:00:00.000Z', changedFields: ['timeOfDay'] }];
        const save = Persistence.migrate(v5Save({
            definedHabits: [{ id: 'h1', modificationHistory: existing }]
        }));
        expect(save.definedHabits[0].modificationHistory).toBe(existing);
    });

    test('tolerates a save with no definedRoutines / definedHabits at all', () => {
        const save = Persistence.migrate({ schemaVersion: 5 });
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
    });

    test('leaves other save fields untouched', () => {
        const save = Persistence.migrate(v5Save({ playerPoints: 150 }));
        expect(save.playerPoints).toBe(150);
    });

    test('runs the full v1 → current chain in one pass, including frozen-slot fields', () => {
        const save = Persistence.migrate({
            schemaVersion: 1,
            definedHabits: [{ id: 'h1', frequency: 'daily' }],
            definedRoutines: [{ id: 'r1', habitDefinitionIds: ['h1'], isActive: true }],
            definedTasks: [{ id: 't1' }]
        });
        expect(save.schemaVersion).toBe(Persistence.SCHEMA_VERSION);
        expect(save.definedRoutines[0].frozenState).toBeNull();
        expect(save.definedHabits[0].modificationHistory).toEqual([]);
    });
});

describe('migrate: version handling', () => {
    test('a current-version save passes through unchanged (same reference)', () => {
        const original = {
            schemaVersion: Persistence.SCHEMA_VERSION,
            inventory: {},
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
