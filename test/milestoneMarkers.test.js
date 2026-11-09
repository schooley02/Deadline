/**
 * MilestoneMarkers (2026-11-08): the pure rule behind the small stones on the graveyard hill. Catalog, ids and the unlocked map are passed in.
 */
const CONFIG = require('../js/config.js');
const MM = require('../js/milestoneMarkers.js');

const catalog = CONFIG.ACHIEVEMENTS;
const ids = CONFIG.MARKER_FAMILIES;
const fam = (id) => catalog.find((f) => f.id === id);
const unlockTo = (id, n) => Object.fromEntries(fam(id).tiers.slice(0, n).map((t) => [t.id, '2026-11-08T00:00:00.000Z']));

describe('the config', () => {
    test('seven families, all in the catalog, one slot each, inside the 140px zone', () => {
        expect(ids).toHaveLength(7);
        expect(MM.families(catalog, ids)).toHaveLength(7);
        expect(CONFIG.MARKER_SLOTS).toHaveLength(7);
        const half = 22; // the widest stone is ~44px wide once the 32px picture is drawn at MARKER_ART_PX (48)
        CONFIG.MARKER_SLOTS.forEach((s) => {
            expect(s.x - half).toBeGreaterThanOrEqual(0);
            expect(s.x + half).toBeLessThanOrEqual(140);
            expect(s.feet).toBeGreaterThanOrEqual(0);
        });
    });
    test('the tap box is at least 44px and the picture is drawn bigger than its 32px file (Jeremy: easier to tap)', () => {
        expect(CONFIG.MARKER_HIT_PX).toBeGreaterThanOrEqual(44);
        expect(CONFIG.MARKER_ART_PX).toBeGreaterThan(32);
    });
});

describe('stageOf', () => {
    test('0 with nothing unlocked, then the highest tier reached', () => {
        const f = fam('task_slayer');
        expect(MM.stageOf(f, {})).toBe(0);
        expect(MM.stageOf(f, undefined)).toBe(0);
        expect(MM.stageOf(f, unlockTo('task_slayer', 1))).toBe(1);
        expect(MM.stageOf(f, unlockTo('task_slayer', 3))).toBe(3);
        expect(MM.stageOf(f, unlockTo('task_slayer', 4))).toBe(4);
    });
    test('the highest tier wins even if a lower one is missing', () => {
        const f = fam('task_slayer');
        expect(MM.stageOf(f, { [f.tiers[2].id]: 'x' })).toBe(3);
    });
    test('other families\' unlocks do not count; bad input is 0', () => {
        expect(MM.stageOf(fam('task_slayer'), unlockTo('habit_hero', 4))).toBe(0);
        expect(MM.stageOf(null, {})).toBe(0);
        expect(MM.stageOf({}, {})).toBe(0);
    });
    test('On Fire has three tiers so it tops out at stage 3', () => {
        expect(MM.stageOf(fam('on_fire'), unlockTo('on_fire', 3))).toBe(3);
    });
});

describe('build', () => {
    test('one model per id, in order, unknown ids skipped', () => {
        const m = MM.build({ catalog, ids: ['honor_roll', 'nope', 'task_slayer'], unlocked: {}, stats: {} });
        expect(m.map((x) => x.id)).toEqual(['honor_roll', 'task_slayer']);
    });
    test('stage 0: no tier label, next is Bronze, full distance remaining', () => {
        const [m] = MM.build({ catalog, ids: ['task_slayer'], unlocked: {}, stats: { tasksCompleted: 4 } });
        expect(m).toMatchObject({ stage: 0, tierLabel: null, nextLabel: 'Bronze', value: 4, threshold: 10, remaining: 6, maxed: false });
        expect(m.fraction).toBeCloseTo(0.4, 5);
    });
    test('progress runs from the reached tier\'s threshold to the next', () => {
        const [m] = MM.build({ catalog, ids: ['task_slayer'], unlocked: unlockTo('task_slayer', 1), stats: { tasksCompleted: 30 } });
        expect(m).toMatchObject({ stage: 1, tierLabel: 'Bronze', nextLabel: 'Silver', threshold: 50, remaining: 20 });
        expect(m.fraction).toBeCloseTo(0.5, 5);
    });
    test('maxed: top label, no next, full bar', () => {
        const [m] = MM.build({ catalog, ids: ['task_slayer'], unlocked: unlockTo('task_slayer', 4), stats: { tasksCompleted: 5000 } });
        expect(m).toMatchObject({ stage: 4, maxed: true, nextLabel: null, remaining: 0, fraction: 1, tierLabel: 'Platinum' });
    });
    test('a bad or negative stat reads 0', () => {
        const [m] = MM.build({ catalog, ids: ['task_slayer'], unlocked: {}, stats: { tasksCompleted: -3 } });
        expect(m.value).toBe(0);
    });
    test('forced stage draws every marker at that stage (clamped), without touching the real unlocks', () => {
        const all = MM.build({ catalog, ids, unlocked: {}, stats: {}, forced: 2 });
        all.forEach((m) => expect(m.stage).toBe(2));
        expect(MM.build({ catalog, ids, unlocked: {}, stats: {}, forced: 9 })[0].stage).toBe(4);
        expect(MM.build({ catalog, ids, unlocked: {}, stats: {}, forced: -1 })[0].stage).toBe(0);
    });
    test('nothing passed in is fine', () => {
        expect(MM.build()).toEqual([]);
    });
});

describe('placements', () => {
    const slots = [{ x: 30, feet: 58 }, { x: 74, feet: 40 }, { x: 100, feet: 40 }];
    const p = MM.placements(slots, { artPx: 32, hitPx: 44, zBase: 21 });
    test('the tap box is centred on the picture and the picture centred in the box', () => {
        expect(p[0]).toMatchObject({ hitLeft: 8, hitBottom: 52, hit: 44, art: 32, artLeft: 6, artBottom: 6 });
    });
    test('the picture\'s feet land on the slot\'s feet row', () => {
        p.forEach((q, i) => expect(q.hitBottom + q.artBottom).toBe(slots[i].feet));
    });
    test('lowest feet is in front (highest z); ties keep slot order; all above zBase', () => {
        expect(p[0].z).toBe(21);
        expect(p[1].z).toBeLessThan(p[2].z + 1);
        expect(new Set(p.map((q) => q.z)).size).toBe(3);
        p.forEach((q) => expect(q.z).toBeGreaterThanOrEqual(21));
    });
    test('the tap box never goes under 44px', () => {
        expect(MM.placements([{ x: 50, feet: 40 }], { hitPx: 20 })[0].hit).toBe(44);
    });
});

describe('override', () => {
    test('not given is undefined; off/none hide; numbers 0..4 force a stage, higher clamps', () => {
        expect(MM.override('')).toBeUndefined();
        expect(MM.override('?a=1')).toBeUndefined();
        expect(MM.override('?markers=off')).toBe('off');
        expect(MM.override('?x=1&markers=NONE')).toBe('off');
        expect(MM.override('?markers=0')).toBe(0);
        expect(MM.override('?markers=3')).toBe(3);
        expect(MM.override('?markers=9')).toBe(4);
    });
    test('junk is ignored', () => {
        expect(MM.override('?markers=')).toBeUndefined();
        expect(MM.override('?markers=abc')).toBeUndefined();
        expect(MM.override('?markers=-2')).toBeUndefined();
    });
});
