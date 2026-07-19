/**
 * FrozenSlots pure core ("Frozen routine slots + recovery" ticket,
 * sub-session 1, 2026-07-19). js/frozenSlots.js is pure — no CONFIG global,
 * no DOM — so it's required directly, same style as economy.test.js.
 */
const FrozenSlots = require('../js/frozenSlots.js');

function occ(successPattern) {
    // successPattern like 'TTF' -> [{date:'d0',success:true}, {date:'d1',success:true}, {date:'d2',success:false}]
    return successPattern.split('').map((ch, i) => ({ date: `d${i}`, success: ch === 'T' }));
}

describe('trailingRun', () => {
    test('counts the trailing run of matching entries from the end', () => {
        expect(FrozenSlots.trailingRun(occ('TFFF'), false)).toBe(3);
        expect(FrozenSlots.trailingRun(occ('TFFF'), true)).toBe(0); // last entry is false
        expect(FrozenSlots.trailingRun(occ('FFFT'), true)).toBe(1);
    });

    test('stops at the first non-matching entry (does not skip gaps)', () => {
        expect(FrozenSlots.trailingRun(occ('FTFF'), false)).toBe(2); // last two false, then a true breaks it
    });

    test('empty or non-array history is zero', () => {
        expect(FrozenSlots.trailingRun([], false)).toBe(0);
        expect(FrozenSlots.trailingRun(undefined, false)).toBe(0);
        expect(FrozenSlots.trailingRun(null, true)).toBe(0);
    });

    test('a single matching entry counts as a run of 1', () => {
        expect(FrozenSlots.trailingRun(occ('F'), false)).toBe(1);
    });
});

describe('shouldFreeze (fork 1 — 3 consecutive indulged days)', () => {
    test('exactly at threshold triggers', () => {
        expect(FrozenSlots.shouldFreeze(occ('FFF'), 3)).toBe(true);
    });

    test('one short of threshold does not trigger', () => {
        expect(FrozenSlots.shouldFreeze(occ('FF'), 3)).toBe(false);
    });

    test('more than threshold still triggers (already past it)', () => {
        expect(FrozenSlots.shouldFreeze(occ('FFFFF'), 3)).toBe(true);
    });

    test('a success anywhere in the trailing window resets the run', () => {
        expect(FrozenSlots.shouldFreeze(occ('FFTFF'), 3)).toBe(false); // trailing run is only 2
    });

    test('excused day (ABSENT entry, not recorded) is transparent — does not break an indulged run (fork 2)', () => {
        // Two indulged days, an excused day (no entry at all — session 34/35
        // convention), then one more indulged day: history literally has only
        // 3 entries (F, F, F) because the excused day recorded nothing.
        expect(FrozenSlots.shouldFreeze(occ('FFF'), 3)).toBe(true);
    });
});

describe('shouldRecoverByAvoidance (recovery path 2 — 3 consecutive avoided days)', () => {
    test('exactly at threshold recovers', () => {
        expect(FrozenSlots.shouldRecoverByAvoidance(occ('TTT'), 3)).toBe(true);
    });

    test('one short of threshold does not recover', () => {
        expect(FrozenSlots.shouldRecoverByAvoidance(occ('TT'), 3)).toBe(false);
    });

    test('a lapse anywhere in the trailing window resets the run', () => {
        expect(FrozenSlots.shouldRecoverByAvoidance(occ('TTFTT'), 3)).toBe(false); // trailing run is only 2
    });
});

describe('avoidanceProgress', () => {
    test('reports the trailing avoided-run count, capped at thresholdDays', () => {
        expect(FrozenSlots.avoidanceProgress(occ('TT'), 3)).toBe(2);
        expect(FrozenSlots.avoidanceProgress(occ('TTTT'), 3)).toBe(3); // capped
        expect(FrozenSlots.avoidanceProgress(occ('FF'), 3)).toBe(0);
    });
});

describe('isRoutineUsableForHabit (sub-session 2 spawn gating)', () => {
    test('active, not frozen -> usable', () => {
        expect(FrozenSlots.isRoutineUsableForHabit({ isActive: true, frozenState: null }, 'h1')).toBe(true);
    });

    test('inactive -> never usable, even for the offending habit', () => {
        expect(FrozenSlots.isRoutineUsableForHabit({ isActive: false, frozenState: { frozenBy: 'h1' } }, 'h1')).toBe(false);
    });

    test('active + frozen BY this habit -> usable (offending habit keeps lurking)', () => {
        expect(FrozenSlots.isRoutineUsableForHabit({ isActive: true, frozenState: { frozenBy: 'h1' } }, 'h1')).toBe(true);
    });

    test('active + frozen BY a different habit -> not usable', () => {
        expect(FrozenSlots.isRoutineUsableForHabit({ isActive: true, frozenState: { frozenBy: 'h2' } }, 'h1')).toBe(false);
    });

    test('a missing routine is never usable', () => {
        expect(FrozenSlots.isRoutineUsableForHabit(null, 'h1')).toBe(false);
    });

    test('a routine with no frozenState field at all (pre-existing shape) is usable when active', () => {
        expect(FrozenSlots.isRoutineUsableForHabit({ isActive: true }, 'h1')).toBe(true);
    });
});

describe('isRoutineSuspended (sub-session 2 — tasks have no offending-def exception)', () => {
    test('active, not frozen -> not suspended', () => {
        expect(FrozenSlots.isRoutineSuspended({ isActive: true, frozenState: null })).toBe(false);
    });

    test('inactive -> suspended', () => {
        expect(FrozenSlots.isRoutineSuspended({ isActive: false, frozenState: null })).toBe(true);
    });

    test('active but frozen -> suspended, regardless of frozenBy', () => {
        expect(FrozenSlots.isRoutineSuspended({ isActive: true, frozenState: { frozenBy: 'anything' } })).toBe(true);
    });

    test('a missing routine counts as suspended', () => {
        expect(FrozenSlots.isRoutineSuspended(null)).toBe(true);
    });
});

describe('buildFrozenState', () => {
    test('builds a frozenBy/frozenAt marker with an ISO timestamp', () => {
        const now = new Date('2026-07-19T12:00:00.000Z');
        const state = FrozenSlots.buildFrozenState('def1', now);
        expect(state.frozenBy).toBe('def1');
        expect(state.frozenAt).toBe('2026-07-19T12:00:00.000Z');
    });

    test('accepts a non-Date value the same way `new Date()` would', () => {
        const state = FrozenSlots.buildFrozenState('def1', '2026-07-19T12:00:00.000Z');
        expect(state.frozenAt).toBe('2026-07-19T12:00:00.000Z');
    });
});
