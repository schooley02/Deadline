/**
 * Memorial (2026-11-08): the obelisk's stage = floor(average of the 8 buildings' all-time best tiers), never lower than the
 * saved high-water mark. Pure maths in js/memorial.js; the state field and the view wiring have their own tests.
 */
const Memorial = require('../js/memorial.js');
const VillageProgress = require('../js/villageProgress.js');

const all = (t) => Object.fromEntries(Memorial.KINDS.map((k) => [k, t]));

describe('kinds', () => {
    test('are the same eight buildings as VillageProgress', () => {
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

describe('stage = floor(average of the 8 best tiers)', () => {
    test('a brand-new game (no marks) is stage 1', () => {
        expect(Memorial.tierSum({})).toBe(8);
        expect(Memorial.stage({})).toBe(1);
        expect(Memorial.stage(undefined)).toBe(1);
    });
    test.each([1, 2, 3, 4, 5])('every building at T%i is stage %i', (t) => {
        expect(Memorial.stage(all(t))).toBe(t);
    });
    test('rounds DOWN: one tier short of the next stage stays put', () => {
        const best = all(2);
        best.slain = 1; // sum 15, average 1.875
        expect(Memorial.stage(best)).toBe(1);
        best.slain = 2; // sum 16
        expect(Memorial.stage(best)).toBe(2);
    });
    test('one maxed building among T1s is still stage 1 (the average, not the highest)', () => {
        expect(Memorial.stage({ slain: 5 })).toBe(1); // sum 12 -> 1.5
        expect(Memorial.stage({ slain: 5, nights: 5, habits: 5, heroes: 5 })).toBe(3); // sum 28 -> 3.5
    });
    test('the lowest building does not pin it (rejected rule)', () => {
        const best = all(5);
        best.punctuality = 1; // sum 36 -> 4.5
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
        expect(p.sum).toBe(8 + 2 + 1); // 11
        expect(p.stage).toBe(1);
        expect(p.toNextStage).toBe(16 - 11);
        expect(p.maxed).toBe(false);
        expect(p.kinds).toHaveLength(8);
        expect(p.kinds.find((r) => r.kind === 'slain').best).toBe(3);
        expect(p.kinds.find((r) => r.kind === 'habits').best).toBe(1);
    });
    test('exactly on a stage boundary asks for 8 more tier-ups', () => {
        expect(Memorial.progress(all(2)).toNextStage).toBe(8);
    });
    test('stage 5 is maxed with nothing left', () => {
        const p = Memorial.progress(all(5));
        expect(p.maxed).toBe(true);
        expect(p.toNextStage).toBeNull();
    });
});
