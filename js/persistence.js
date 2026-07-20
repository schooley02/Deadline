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
    // v2 (2026-07-18): habit definitions gained `routineId` (null = standalone).
    // v3 (2026-07-18): habit + routine-task definitions gained a `schedule`
    // object (replacing habits' bare `frequency` string; routine tasks had no
    // recurrence field before); habit definitions gained `occurrenceHistory`.
    // v4 (2026-07-18): top-level `inventory` object (shop item id -> held
    // count) added for [P1-UI-008]. Old saves seed an empty inventory.
    // v5 (2026-07-19): habit definitions gain `cheatDayDate` ([P1-DATA-005]
    // sub-session 5, Cheat Day token) — the one currently-active excused
    // occurrence date for that habit, or null. Old saves seed null on every
    // habit def.
    // v6 (2026-07-19): routines gain `frozenState`, habit defs gain
    // `modificationHistory` (frozen routine slots, sub-session 1).
    // v7 (2026-07-19): Sick Day + Skip Day tokens (frozen-slots sub-session
    // 5) — top-level `sickDayDate` (global, null = no active Sick Day) and
    // habit-def `skipDayDate` (per-habit, null = no active Skip Day). Old
    // saves seed both null.
    // v10 (2026-07-19, session 52): run history — top-level `runHistory`
    // (persists ACROSS runs; seeded []) and `currentRunStats` (run-scoped
    // accumulator; seeded fresh). See docs/RUN_HISTORY_PLAN.md + js/runStats.js.
    // v11 (2026-07-20, session 64): achievements & badges — top-level
    // `lifetimeStats` (persists ACROSS runs, retro-derived from existing
    // save data below) and `achievements` (unlocked-tier map; seeded {}).
    // See docs/ACHIEVEMENTS_PLAN.md + js/achievements.js.
    const SCHEMA_VERSION = 11;
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
        // v1 → v2 (2026-07-18): habit definitions gained `routineId`
        // (null = standalone). v1 saves have no such field, so infer it from
        // routine membership: a habit listed in some routine's
        // habitDefinitionIds is owned by that routine; anything unreferenced
        // is standalone. Without this, every pre-v2 habit would load with
        // routineId undefined and be treated as standalone — which would
        // wrongly un-gate habits that really do belong to a routine.
        // See DECISIONS.md 2026-07-18.
        if (save.schemaVersion === 1) {
            const ownerByHabitId = new Map();
            (save.definedRoutines || []).forEach(routine => {
                (routine.habitDefinitionIds || []).forEach(habitId => {
                    if (!ownerByHabitId.has(habitId)) ownerByHabitId.set(habitId, routine.id);
                });
            });

            (save.definedHabits || []).forEach(habitDef => {
                if (habitDef.routineId === undefined) {
                    habitDef.routineId = ownerByHabitId.has(habitDef.id)
                        ? ownerByHabitId.get(habitDef.id)
                        : null;
                }
            });

            save.schemaVersion = 2;
        }

        // v2 → v3 (2026-07-18): recurrence moves from habits' bare `frequency`
        // string to a `schedule` object on BOTH habit defs and routine task
        // defs (routine tasks had no recurrence field — they spawned daily
        // whenever their routine was active), and habit defs gain
        // `occurrenceHistory` (seeded empty; recording lands with the
        // rate-based bonus — see DECISIONS.md). Written with literal shapes
        // rather than calling js/schedule.js so this migration stays a stable
        // historical transform even if Schedule's logic later evolves. Every
        // pre-v3 habit had frequency 'daily' in practice (the form offered no
        // other option), so all migrate to the every-day schedule.
        if (save.schemaVersion === 2) {
            const dailySchedule = () => ({
                frequency: 'daily',
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                dayOfMonth: null,
            });

            (save.definedHabits || []).forEach(habitDef => {
                if (habitDef.schedule === undefined) {
                    habitDef.schedule = dailySchedule();
                }
                delete habitDef.frequency;
                if (!Array.isArray(habitDef.occurrenceHistory)) {
                    habitDef.occurrenceHistory = [];
                }
            });

            (save.definedTasks || []).forEach(taskDef => {
                if (taskDef.schedule === undefined) {
                    taskDef.schedule = dailySchedule();
                }
            });

            save.schemaVersion = 3;
        }

        // v3 → v4 (2026-07-18): shop inventory ([P1-UI-008]). Additive — a
        // top-level `inventory` object (shop item id -> held count). Pre-v4
        // saves have none, so seed an empty one; state.js restore also guards,
        // but seeding here keeps the migrated save internally consistent.
        // See DECISIONS.md 2026-07-18.
        if (save.schemaVersion === 3) {
            if (!save.inventory || typeof save.inventory !== 'object') {
                save.inventory = {};
            }
            save.schemaVersion = 4;
        }

        // v4 → v5 (2026-07-19): habit definitions gain `cheatDayDate` ([P1-
        // DATA-005] sub-session 5, Cheat Day token). Additive — pre-v5 habits
        // have none, so seed null (no active cheat day). See DECISIONS.md.
        if (save.schemaVersion === 4) {
            (save.definedHabits || []).forEach(habitDef => {
                if (habitDef.cheatDayDate === undefined) {
                    habitDef.cheatDayDate = null;
                }
            });
            save.schemaVersion = 5;
        }

        // v5 → v6 (2026-07-19): frozen routine slots (sub-session 1).
        // Additive on two shapes — routines gain `frozenState` (null = not
        // frozen; { frozenBy, frozenAt } once a routine-owned negative habit
        // hits 3 consecutive indulged days, see js/frozenSlots.js) and habit
        // definitions gain `modificationHistory` (empty array; recovery path
        // 1 — "edit the habit to unfreeze" — appends to this in a later
        // sub-session, landing the field now so that migration is a no-op).
        // Pre-v6 saves have neither, so seed both. See DECISIONS.md.
        if (save.schemaVersion === 5) {
            (save.definedRoutines || []).forEach(routine => {
                if (routine.frozenState === undefined) {
                    routine.frozenState = null;
                }
            });
            (save.definedHabits || []).forEach(habitDef => {
                if (!Array.isArray(habitDef.modificationHistory)) {
                    habitDef.modificationHistory = [];
                }
            });
            save.schemaVersion = 6;
        }

        // v6 → v7 (2026-07-19): Sick Day (global) + Skip Day (per-habit)
        // tokens (frozen-slots sub-session 5). Additive on two shapes — a new
        // top-level `sickDayDate` (mirrors habitDef.cheatDayDate's shape but
        // scoped to the whole save, not one habit) and habit defs gain
        // `skipDayDate`. Both null = no active token for today. Pre-v7 saves
        // have neither, so seed both. See DECISIONS.md.
        if (save.schemaVersion === 6) {
            if (save.sickDayDate === undefined) {
                save.sickDayDate = null;
            }
            (save.definedHabits || []).forEach(habitDef => {
                if (habitDef.skipDayDate === undefined) {
                    habitDef.skipDayDate = null;
                }
            });
            save.schemaVersion = 7;
        }

        // v7 → v8 (2026-07-19): hero/routine progression ([P1-UI-006]
        // sub-session 1). Additive on routines — `xp`/`level` (routine-own
        // leveling, js/heroes.js), `health` (seeded full; damage wiring is
        // sub-session 2), `createdAt` (star-rating window start — best
        // available birthday for a pre-v8 routine is the run start, falling
        // back to now), and `koState` (null = not knocked out; set by
        // sub-session 2's KO path). Literal values rather than CONFIG.* so
        // this stays a stable historical transform (v2→v3 precedent) — 100
        // is ROUTINE_MAX_HEALTH's value at migration-writing time. See
        // DECISIONS.md session 41.
        if (save.schemaVersion === 7) {
            const birthday = typeof save.runStartedAtMs === 'number'
                ? save.runStartedAtMs
                : Date.now();
            (save.definedRoutines || []).forEach(routine => {
                if (typeof routine.xp !== 'number') routine.xp = 0;
                if (typeof routine.level !== 'number') routine.level = 1;
                if (typeof routine.health !== 'number') routine.health = 100;
                if (typeof routine.createdAt !== 'number') routine.createdAt = birthday;
                if (routine.koState === undefined) routine.koState = null;
            });
            save.schemaVersion = 8;
        }

        // v8 → v9 (2026-07-19): banked slot points ([P1-UI-006] sub-session 4).
        // Additive on routines — `boughtHabitSlots`/`boughtTaskSlots` (ints,
        // 0 = no slots purchased beyond the level-1 baseline). This is the
        // only persisted state the slot-point model needs: available points
        // are DERIVED from routine.level (Heroes.availableSlotPoints), never
        // stored, so there's nothing else to seed. Jeremy reset to a fresh
        // run before this session (grandfathering fork resolved as moot —
        // see DECISIONS.md), so in practice this migration seeds zeros for
        // any routine created before this session's code, same shape as
        // every other additive bump. See DECISIONS.md.
        if (save.schemaVersion === 8) {
            (save.definedRoutines || []).forEach(routine => {
                if (typeof routine.boughtHabitSlots !== 'number') routine.boughtHabitSlots = 0;
                if (typeof routine.boughtTaskSlots !== 'number') routine.boughtTaskSlots = 0;
            });
            save.schemaVersion = 9;
        }

        // v9 → v10 (2026-07-19, session 52): run history. Literal fresh-stats
        // shape rather than calling RunStats.freshRunStats() so this stays a
        // stable historical transform (same convention as the v2→v3 schedule
        // shapes) — and Persistence deliberately has no module dependencies.
        if (save.schemaVersion === 9) {
            if (!Array.isArray(save.runHistory)) save.runHistory = [];
            if (!save.currentRunStats || typeof save.currentRunStats !== 'object') {
                save.currentRunStats = {
                    tasksCompleted: 0,
                    habitsCompleted: 0,
                    habitsMissed: 0,
                    pointsEarned: 0,
                    blame: {},
                };
            }
            save.schemaVersion = 10;
        }

        // v10 → v11 (2026-07-20, session 64): achievements & badges.
        // lifetimeStats + achievements (unlocked-tier map) are lifetime
        // data — persisted, never reset by initGame, wiped only by
        // dev-Reset (mirrors runHistory's lifecycle). Retro sweep
        // (ACHIEVEMENTS_PLAN.md fork 4): derive a best-effort lifetimeStats
        // snapshot from data ALREADY in this save so upgrading players
        // aren't credited zero. Literal inline math, NOT
        // Achievements.freshLifetimeStats()/module calls — Persistence
        // deliberately has no module dependencies (same reasoning as
        // v9→v10 inlining currentRunStats's fresh shape instead of calling
        // RunStats.freshRunStats()). The actual badge-unlock evaluation
        // against CONFIG.ACHIEVEMENTS happens once in state.js's
        // restoreGameState (which already has module deps), not here.
        if (save.schemaVersion === 10) {
            if (!save.lifetimeStats || typeof save.lifetimeStats !== 'object') {
                const pastRuns = Array.isArray(save.runHistory) ? save.runHistory : [];
                const current = (save.currentRunStats && typeof save.currentRunStats === 'object')
                    ? save.currentRunStats
                    : { tasksCompleted: 0, habitsCompleted: 0 };
                const habits = Array.isArray(save.definedHabits) ? save.definedHabits : [];

                const pastTasksCompleted = pastRuns.reduce(
                    (sum, r) => sum + ((r.totals && r.totals.tasksCompleted) || 0), 0
                );
                const pastHabitsCompleted = pastRuns.reduce(
                    (sum, r) => sum + ((r.totals && r.totals.habitsCompleted) || 0), 0
                );
                const pastBestDays = pastRuns.reduce(
                    (max, r) => Math.max(max, r.daysSurvived || 0), 0
                );
                // NOTE: record.routines[].completionRate is the RAW
                // { rate, samples } object returned by Heroes.completionRate
                // (RunStats.finalizeRun stores it as-is) — not a bare number.
                // Unwrap .rate here; a bare-number read would silently always
                // read undefined and never qualify. (Separately: statsView.js's
                // Routine Performance section does `typeof completionRate ===
                // 'number'`, which is never true against this real shape — a
                // pre-existing display bug, found via this recon, logged in
                // DECISIONS.md session 64, NOT fixed here — out of scope.)
                const steadyRoutineRuns = pastRuns.reduce((count, r) => {
                    if ((r.daysSurvived || 0) < 7) return count;
                    const qualifying = (r.routines || []).filter(routine => {
                        const rate = routine.completionRate && typeof routine.completionRate.rate === 'number'
                            ? routine.completionRate.rate
                            : null;
                        return rate !== null && rate >= 0.9;
                    }).length;
                    return count + qualifying;
                }, 0);
                const bestHabitStreak = habits.reduce(
                    (max, h) => Math.max(max, (typeof h.streak === 'number') ? h.streak : 0), 0
                );

                save.lifetimeStats = {
                    tasksCompleted: pastTasksCompleted + (current.tasksCompleted || 0),
                    habitsCompleted: pastHabitsCompleted + (current.habitsCompleted || 0),
                    bestRunDaysSurvived: Math.max(pastBestDays, save.daysSurvived || 0),
                    bestHabitStreak: bestHabitStreak,
                    steadyRoutineRuns: steadyRoutineRuns,
                    // No historical record of point-balance crossings exists
                    // to sweep retroactively — starts at 0 for every save,
                    // new or old, until sub-session 2 wires live detection.
                    pointsRecoveries: 0,
                };
            }
            if (!save.achievements || typeof save.achievements !== 'object') {
                save.achievements = {};
            }
            save.schemaVersion = 11;
        }

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
        migrate,       // exposed for tests
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
