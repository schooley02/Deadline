/**
 * Heroes pure-core tests ([P1-UI-006] sub-session 1, 2026-07-19 session 41).
 *
 * js/heroes.js is pure (no DOM, no globals beyond what's passed in). The
 * items.js wiring (award/refund/gating) is covered separately in
 * test/items-routine-xp.test.js; the v7→v8 migration in
 * test/persistence-migration.test.js.
 */
const Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');

const T = CONFIG.ROUTINE_LEVEL_XP_THRESHOLDS; // [0, 50, 125, 250, ...]

describe('xpAmountFor', () => {
    test('task pays ROUTINE_XP_PER_TASK', () => {
        expect(Heroes.xpAmountFor('task', CONFIG)).toBe(CONFIG.ROUTINE_XP_PER_TASK);
    });
    test('habit pays ROUTINE_XP_PER_HABIT', () => {
        expect(Heroes.xpAmountFor('habit', CONFIG)).toBe(CONFIG.ROUTINE_XP_PER_HABIT);
    });
});

describe('levelForXp — level DERIVED from xp (same table semantics as progression.js)', () => {
    test('0 xp is level 1', () => {
        expect(Heroes.levelForXp(0, T)).toBe(1);
    });
    test('one below the first threshold stays level 1', () => {
        expect(Heroes.levelForXp(T[1] - 1, T)).toBe(1);
    });
    test('exactly the first threshold reaches level 2', () => {
        expect(Heroes.levelForXp(T[1], T)).toBe(2);
    });
    test('a huge xp value caps at maxLevel (thresholds.length)', () => {
        expect(Heroes.levelForXp(999999, T)).toBe(T.length);
    });
});

describe('applyXpDelta', () => {
    test('an award that crosses one threshold levels up once', () => {
        const r = Heroes.applyXpDelta(T[1] - 5, 10, T);
        expect(r.xp).toBe(T[1] + 5);
        expect(r.level).toBe(2);
        expect(r.leveledUp).toBe(true);
        expect(r.levelsGained).toBe(1);
    });

    test('a single big award can cross MULTIPLE thresholds at once (the progression.js multi-level walk)', () => {
        const r = Heroes.applyXpDelta(0, T[2] + 1, T);
        expect(r.level).toBe(3);
        expect(r.levelsGained).toBe(2);
    });

    test('an award that crosses nothing does not level', () => {
        const r = Heroes.applyXpDelta(0, T[1] - 1, T);
        expect(r.level).toBe(1);
        expect(r.leveledUp).toBe(false);
        expect(r.levelsGained).toBe(0);
    });

    test('award then equal refund round-trips to EXACTLY the starting state (the deliberate divergence from player-style monotonic levels)', () => {
        const start = T[1] - 2;
        const awarded = Heroes.applyXpDelta(start, 10, T);
        expect(awarded.level).toBe(2);
        const refunded = Heroes.applyXpDelta(awarded.xp, -10, T);
        expect(refunded.xp).toBe(start);
        expect(refunded.level).toBe(1);
        expect(refunded.levelsGained).toBe(-1);
    });

    test('a refund floors xp at 0', () => {
        const r = Heroes.applyXpDelta(3, -10, T);
        expect(r.xp).toBe(0);
        expect(r.level).toBe(1);
    });
});

describe('Banked slot points ([P1-UI-006] sub-session 4, 2026-07-19) — SUPERSEDES the retired slotsForLevel', () => {
    describe('totalSlotPointsEarned — 1 point per level from 2-9, capped at ROUTINE_MAX_SLOT_POINTS', () => {
        test('level 1 has earned nothing yet', () => {
            expect(Heroes.totalSlotPointsEarned(1, CONFIG)).toBe(0);
        });
        test('level 5 has earned 4 points (levels 2,3,4,5)', () => {
            expect(Heroes.totalSlotPointsEarned(5, CONFIG)).toBe(4);
        });
        test('level 9 (max) caps at ROUTINE_MAX_SLOT_POINTS (8)', () => {
            expect(Heroes.totalSlotPointsEarned(9, CONFIG)).toBe(CONFIG.ROUTINE_MAX_SLOT_POINTS);
        });
        test('an out-of-range level never goes negative', () => {
            expect(Heroes.totalSlotPointsEarned(0, CONFIG)).toBe(0);
        });
    });

    describe('availableSlotPoints — earned minus spent, floored at 0', () => {
        test('a fresh level-1 routine has 0 available', () => {
            const routine = { level: 1, boughtHabitSlots: 0, boughtTaskSlots: 0 };
            expect(Heroes.availableSlotPoints(routine, CONFIG)).toBe(0);
        });
        test('level 3 with nothing spent has 2 available', () => {
            const routine = { level: 3, boughtHabitSlots: 0, boughtTaskSlots: 0 };
            expect(Heroes.availableSlotPoints(routine, CONFIG)).toBe(2);
        });
        test('subtracts BOTH habit and task spend from the shared pool', () => {
            const routine = { level: 3, boughtHabitSlots: 1, boughtTaskSlots: 1 };
            expect(Heroes.availableSlotPoints(routine, CONFIG)).toBe(0);
        });
        test('never goes negative even if more was spent than currently earned (de-level case)', () => {
            const routine = { level: 2, boughtHabitSlots: 2, boughtTaskSlots: 2 };
            expect(Heroes.availableSlotPoints(routine, CONFIG)).toBe(0);
        });
        test('DERIVED from level, not incremented — revisiting a level never re-mints a point (the farming exploit a stored pool would allow)', () => {
            // Level up to 5 (4 earned), spend 3, de-level back to 2 (available
            // floors at 0 — see the case above), then level back UP to 5.
            // A stored/incremented pool would grant a 5th point here (the
            // level-up "deposit" firing again); the derived model doesn't,
            // because it only ever looks at the CURRENT level.
            const routine = { level: 5, boughtHabitSlots: 2, boughtTaskSlots: 1 };
            expect(Heroes.availableSlotPoints(routine, CONFIG)).toBe(1); // 4 earned - 3 spent
        });
    });

    describe('slotCapacity — baseline + whatever has actually been bought', () => {
        test('a fresh routine has the level-1 baseline (1 habit + 1 task)', () => {
            const routine = { boughtHabitSlots: 0, boughtTaskSlots: 0 };
            expect(Heroes.slotCapacity(routine, 'habit', CONFIG)).toBe(CONFIG.ROUTINE_HABIT_SLOTS_BASE);
            expect(Heroes.slotCapacity(routine, 'task', CONFIG)).toBe(CONFIG.ROUTINE_TASK_SLOTS_BASE);
        });
        test('bought slots add on top of baseline, independently per type', () => {
            const routine = { boughtHabitSlots: 2, boughtTaskSlots: 1 };
            expect(Heroes.slotCapacity(routine, 'habit', CONFIG)).toBe(CONFIG.ROUTINE_HABIT_SLOTS_BASE + 2);
            expect(Heroes.slotCapacity(routine, 'task', CONFIG)).toBe(CONFIG.ROUTINE_TASK_SLOTS_BASE + 1);
        });
        test('a de-level never strands/evicts an already-bought slot (capacity stays bought, per plan recommendation)', () => {
            const routine = { level: 1, boughtHabitSlots: 3, boughtTaskSlots: 0 };
            expect(Heroes.slotCapacity(routine, 'habit', CONFIG)).toBe(CONFIG.ROUTINE_HABIT_SLOTS_BASE + 3);
        });
    });

    describe('spendSlotPoint — pure "try to spend" (shop.js purchase/consume pattern: result object, no mutation)', () => {
        test('spends into the requested slot type when a point is available', () => {
            const routine = { level: 3, boughtHabitSlots: 0, boughtTaskSlots: 0 };
            const result = Heroes.spendSlotPoint(routine, 'habit', CONFIG);
            expect(result).toEqual({ ok: true, boughtHabitSlots: 1, boughtTaskSlots: 0 });
            // Argument untouched — caller applies the mutation.
            expect(routine.boughtHabitSlots).toBe(0);
        });
        test('spending on task increments only boughtTaskSlots', () => {
            const routine = { level: 3, boughtHabitSlots: 1, boughtTaskSlots: 0 };
            const result = Heroes.spendSlotPoint(routine, 'task', CONFIG);
            expect(result).toEqual({ ok: true, boughtHabitSlots: 1, boughtTaskSlots: 1 });
        });
        test('refuses when no points are available', () => {
            const routine = { level: 1, boughtHabitSlots: 0, boughtTaskSlots: 0 };
            expect(Heroes.spendSlotPoint(routine, 'habit', CONFIG)).toEqual({ ok: false, reason: 'no_points' });
        });
        test('refuses once every earned point is already spent', () => {
            const routine = { level: 2, boughtHabitSlots: 1, boughtTaskSlots: 0 };
            expect(Heroes.spendSlotPoint(routine, 'task', CONFIG)).toEqual({ ok: false, reason: 'no_points' });
        });
    });
});

describe('completionRate — habit members only, occurrences on/after the window start', () => {
    const routine = { id: 'r1', habitDefinitionIds: ['h2'] };
    const windowStart = new Date(2026, 6, 10, 0, 0, 0).getTime(); // Jul 10 2026 local

    test('no members / no occurrences → null rate, 0 samples, 0 distinct days (unrated, not 0%)', () => {
        expect(Heroes.completionRate(routine, [], windowStart)).toEqual({ rate: null, samples: 0, distinctDays: 0 });
    });

    test('counts successes over samples for habits owned via routineId; distinctDays = unique dates', () => {
        const habits = [{
            id: 'h1', routineId: 'r1',
            occurrenceHistory: [
                { date: '2026-07-15', success: true },
                { date: '2026-07-16', success: false },
                { date: '2026-07-17', success: true },
                { date: '2026-07-18', success: true },
            ],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart))
            .toEqual({ rate: 0.75, samples: 4, distinctDays: 4 });
    });

    test('membership via habitDefinitionIds also counts (belt and suspenders, matching spawn gating)', () => {
        const habits = [{
            id: 'h2', routineId: null,
            occurrenceHistory: [{ date: '2026-07-15', success: true }],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart).samples).toBe(1);
    });

    test('occurrences BEFORE the window start are excluded (run/creation reset)', () => {
        const habits = [{
            id: 'h1', routineId: 'r1',
            occurrenceHistory: [
                { date: '2026-07-01', success: false }, // before window — invisible
                { date: '2026-07-15', success: true },
            ],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart))
            .toEqual({ rate: 1, samples: 1, distinctDays: 1 });
    });

    test('a non-member habit contributes nothing', () => {
        const habits = [{
            id: 'stranger', routineId: 'OTHER',
            occurrenceHistory: [{ date: '2026-07-15', success: true }],
        }];
        expect(Heroes.completionRate(routine, habits, windowStart).samples).toBe(0);
    });

    // 2026-07-21 redesign (docs/DECISIONS.md): the rate is a ROLLING window
    // of at most `rateWindowSize` occurrences, most-recent-first, merged
    // across every member habit — this is the fix for a routine with
    // multiple habits not getting a stale rate off whichever habit has the
    // longest history.
    describe('rolling rate window (rateWindowSize)', () => {
        test('more occurrences than the window size only counts the most recent N', () => {
            const habits = [{
                id: 'h1', routineId: 'r1',
                occurrenceHistory: [
                    { date: '2026-07-15', success: false },
                    { date: '2026-07-16', success: false },
                    { date: '2026-07-17', success: true },
                    { date: '2026-07-18', success: true },
                ],
            }];
            // window of 2 → only the last two (both success) count, even
            // though the all-time rate (2/4 = 50%) would be worse.
            expect(Heroes.completionRate(routine, habits, windowStart, 2))
                .toEqual({ rate: 1, samples: 2, distinctDays: 4 });
        });

        test('merges + sorts across multiple member habits before windowing', () => {
            const habits = [
                {
                    id: 'h1', routineId: 'r1',
                    occurrenceHistory: [
                        { date: '2026-07-15', success: false },
                        { date: '2026-07-17', success: true },
                    ],
                },
                {
                    id: 'h2', routineId: null, // membership via habitDefinitionIds
                    occurrenceHistory: [
                        { date: '2026-07-16', success: false },
                        { date: '2026-07-18', success: true },
                    ],
                },
            ];
            // Chronological merge: 15(F) 16(F) 17(T) 18(T). Window of 2 keeps
            // 17+18 → 100%, even though neither habit alone looks that good.
            expect(Heroes.completionRate(routine, habits, windowStart, 2))
                .toEqual({ rate: 1, samples: 2, distinctDays: 4 });
        });

        test('omitting rateWindowSize preserves the old all-time-average behavior', () => {
            const habits = [{
                id: 'h1', routineId: 'r1',
                occurrenceHistory: [
                    { date: '2026-07-15', success: false },
                    { date: '2026-07-16', success: true },
                ],
            }];
            expect(Heroes.completionRate(routine, habits, windowStart))
                .toEqual({ rate: 0.5, samples: 2, distinctDays: 2 });
        });

        test('distinctDays is NOT limited to the rolling rate window (tenure spans full history)', () => {
            const habits = [{
                id: 'h1', routineId: 'r1',
                occurrenceHistory: [
                    { date: '2026-07-15', success: true },
                    { date: '2026-07-16', success: true },
                    { date: '2026-07-17', success: true },
                    { date: '2026-07-18', success: true },
                ],
            }];
            const result = Heroes.completionRate(routine, habits, windowStart, 2);
            expect(result.samples).toBe(2); // rate windowed to 2
            expect(result.distinctDays).toBe(4); // tenure sees all 4
        });
    });
});

describe('starRating — spec rate cutoffs 60/70/80/90/95 (PROJECT_SPEC ~78-83) gated by minDays tenure (2026-07-21)', () => {
    const tiers = CONFIG.HERO_STAR_TIERS;

    test.each([
        [null, 999, 0],
        [0.59, 999, 0],
        [0.60, 999, 1],
        [0.69, 999, 1],
        [0.70, 999, 2],
        [0.80, 999, 3],
        [0.90, 999, 4],
        [0.949, 999, 4],
        [0.95, 999, 5],
        [1, 999, 5],
    ])('rate %p with ample tenure (%p days) → %p stars', (rate, days, stars) => {
        expect(Heroes.starRating(rate, days, tiers)).toBe(stars);
    });

    // The reported bug: one habit, one completion, 100% rate, effectively no
    // track record — must stay unrated (0★), not jump straight to 5★.
    test('a perfect rate with only 1 day of tenure is 0 stars, not 5', () => {
        expect(Heroes.starRating(1, 1, tiers)).toBe(0);
    });

    test.each([
        [0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [6, 2], [7, 3],
        [13, 3], [14, 4], [20, 4], [21, 5], [100, 5],
    ])('a perfect rate gated purely by tenure: %p distinct days → %p stars', (days, stars) => {
        expect(Heroes.starRating(1, days, tiers)).toBe(stars);
    });

    test('a high rate but insufficient tenure for that tier falls back to a LOWER tier it does qualify for', () => {
        // 96% clears the 5★ rate cutoff, but only 10 days tracked — falls
        // back through 4★ (needs 14, fails) to 3★ (needs 7, passes).
        expect(Heroes.starRating(0.96, 10, tiers)).toBe(3);
    });

    test('non-numeric distinctDays is treated as 0 tenure', () => {
        expect(Heroes.starRating(1, undefined, tiers)).toBe(0);
        expect(Heroes.starRating(1, null, tiers)).toBe(0);
    });
});

describe('routine health math (pure only — damage wiring is sub-session 2)', () => {
    test('applyRoutineDamage floors at 0', () => {
        expect(Heroes.applyRoutineDamage(5, 10)).toBe(0);
        expect(Heroes.applyRoutineDamage(50, 10)).toBe(40);
    });
    test('shouldKo only at 0', () => {
        expect(Heroes.shouldKo(1)).toBe(false);
        expect(Heroes.shouldKo(0)).toBe(true);
    });
});
