/**
 * Memorial (2026-11-08): the obelisk's stage = floor(average of the 8 buildings' all-time best tiers), never lower than the
 * saved high-water mark. Pure maths in js/memorial.js; the state field and the view wiring have their own tests.
 */
const Memorial = require('../js/memorial.js');
const VillageProgress = require('../js/villageProgress.js');

const all = (t) => Object.fromEntries(Memorial.KINDS.map((k) => [k, t]));

describe('kinds', () => {
    test('are the same nine buildings as VillageProgress', () => {
        expect([...Memorial.KINDS].sort()).toEqual([...VillageProgress.KINDS].sort());
    });
});

describe('sanitize', () => {
    test('keeps only known kinds with whole tiers 1..5', () => {
        expect(Memorial.sanitize({ slain: 3, nights: 6, habits: 0, heroes: 2.5, bogus: 4, lurkers: '3', defense: 5 }))
            .toEqual({ slain: 3, defense: 5 });
    });
    test.each([null, undefined, 7, 'x', [], [3, 4]])('%p becomes {}', (v) => {
        expect(Memorial.sanitize(v)).toEqual({});
    });
});

describe('merge (the high-water step)', () => {
    test('takes the per-kind maximum', () => {
        expect(Memorial.merge({ slain: 2, nights: 4 }, { slain: 3, nights: 1, habits: 2 }))
            .toEqual({ slain: 3, nights: 4, habits: 2 });
    });
    test('ignores bad maps and returns {} for nothing', () => {
        expect(Memorial.merge()).toEqual({});
        expect(Memorial.merge(null, undefined, 'x', { slain: 2 })).toEqual({ slain: 2 });
    });
    test('does not change its inputs', () => {
        const a = { slain: 2 };
        Memorial.merge(a, { slain: 5 });
        expect(a).toEqual({ slain: 2 });
    });
});

describe('fromHistory', () => {
    test('is the best peak per kind over every run, whichever order', () => {
        const hist = [
            { run: 3, peakVillageTiers: { slain: 2, nights: 5 } },
            { run: 2, peakVillageTiers: { slain: 4, nights: 1 } },
            { run: 1 }, // an older record without peaks adds nothing
            null,
        ];
        expect(Memorial.fromHistory(hist)).toEqual({ slain: 4, nights: 5 });
        expect(Memorial.fromHistory([...hist].reverse())).toEqual({ slain: 4, nights: 5 });
    });
    test('no history, or a non-array, is {}', () => {
        expect(Memorial.fromHistory([])).toEqual({});
        expect(Memorial.fromHistory(undefined)).toEqual({});
    });
});

describe('stage = floor(average of the 9 best tiers)', () => {
    test('a brand-new game (no marks) is stage 1', () => {
        expect(Memorial.tierSum({})).toBe(9);
        expect(Memorial.stage({})).toBe(1);
        expect(Memorial.stage(undefined)).toBe(1);
    });
    test.each([1, 2, 3, 4, 5])('every building at T%i is stage %i', (t) => {
        expect(Memorial.stage(all(t))).toBe(t);
    });
    test('rounds DOWN: one tier short of the next stage stays put', () => {
        const best = all(2);
        best.slain = 1; // sum 17, average 1.89
        expect(Memorial.stage(best)).toBe(1);
        best.slain = 2; // sum 18
        expect(Memorial.stage(best)).toBe(2);
    });
    test('one maxed building among T1s is still stage 1 (the average, not the highest)', () => {
        expect(Memorial.stage({ slain: 5 })).toBe(1); // sum 13 -> 1.4
        expect(Memorial.stage({ slain: 5, nights: 5, habits: 5, heroes: 5 })).toBe(2); // sum 25 -> 2.8
    });
    test('the lowest building does not pin it (rejected rule)', () => {
        const best = all(5);
        best.punctuality = 1; // sum 41 -> 4.5
        expect(Memorial.stage(best)).toBe(4);
    });
    test('never leaves 1..5', () => {
        expect(Memorial.stage(all(99))).toBe(1); // invalid tiers are dropped, so they count as T1
        expect(Memorial.stage(all(5))).toBe(5);
    });
});

describe('never goes down', () => {
    test('a new run (every building back at T1) cannot lower the merged mark', () => {
        const saved = all(3);
        const afterNewRun = Memorial.merge(saved, all(1));
        expect(Memorial.stage(afterNewRun)).toBe(3);
    });
    test('old runs falling off the capped history cannot lower it either', () => {
        const saved = Memorial.fromHistory([{ peakVillageTiers: all(4) }]);
        const seeded = Memorial.merge(saved, Memorial.fromHistory([])); // that record is gone from history
        expect(Memorial.stage(seeded)).toBe(4);
    });
});

describe('progress (for the Memorial card)', () => {
    test('stage, sum, tier-ups to the next stage and per-kind rows', () => {
        const p = Memorial.progress({ slain: 3, nights: 2 });
        expect(p.sum).toBe(9 + 2 + 1); // 12
        expect(p.stage).toBe(1);
        expect(p.toNextStage).toBe(18 - 12);
        expect(p.maxed).toBe(false);
        expect(p.kinds).toHaveLength(9);
        expect(p.kinds.find((r) => r.kind === 'slain').best).toBe(3);
        expect(p.kinds.find((r) => r.kind === 'habits').best).toBe(1);
    });
    test('exactly on a stage boundary asks for 9 more tier-ups', () => {
        expect(Memorial.progress(all(2)).toNextStage).toBe(9);
    });
    test('stage 5 is maxed with nothing left', () => {
        const p = Memorial.progress(all(5));
        expect(p.maxed).toBe(true);
        expect(p.toNextStage).toBeNull();
    });
});

describe('the saved stage mark (the Lab joined as the ninth building, docs/LAB_PLAN.md)', () => {
    const eight = (t) => Object.fromEntries(Memorial.LEGACY_KINDS.map((k) => [k, t]));
    test('LEGACY_KINDS are the eight buildings from before the Lab', () => {
        expect(Memorial.LEGACY_KINDS).toHaveLength(8);
        expect(Memorial.LEGACY_KINDS).not.toContain('goals');
    });
    test('legacyStage reads only the eight old buildings: all eight at T3 is stage 3 even though the Lab is T1', () => {
        expect(Memorial.legacyStage(eight(3))).toBe(3);
        expect(Memorial.stage(eight(3))).toBe(2); // the plain average over nine: 8 x 3 + 1 = 25 -> 2.8
    });
    test('the saved stage floors the average: a ninth building at T1 cannot lower a stage already earned', () => {
        expect(Memorial.stage(eight(2))).toBe(1); // 8 x 2 + 1 = 17 over nine -> 1.89
        expect(Memorial.stage(eight(2), 2)).toBe(2);
        expect(Memorial.stage(all(1), 3)).toBe(3);
    });
    test('the average still lifts it above a lower saved mark; a bad saved mark is ignored', () => {
        expect(Memorial.stage(all(4), 2)).toBe(4);
        expect(Memorial.stage(all(1), 99)).toBe(1);
        expect(Memorial.stage(all(1), 0)).toBe(1);
        expect(Memorial.stage(all(1), 'x')).toBe(1);
    });
    test('progress follows the saved stage and never asks for a negative number of tier-ups', () => {
        const p = Memorial.progress(eight(2), 2); // sum 17, saved stage 2: next stage 3 needs 27
        expect(p.stage).toBe(2);
        expect(p.toNextStage).toBe(27 - 17);
        expect(Memorial.progress(all(1), 5).maxed).toBe(true);
        expect(Memorial.progress(eight(1), 2).toNextStage).toBe(27 - 9);
    });
    test('legacyStage never leaves 1..5', () => {
        expect(Memorial.legacyStage({})).toBe(1);
        expect(Memorial.legacyStage(eight(5))).toBe(5);
    });
});
