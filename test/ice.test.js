/**
 * Ice (docs/ICE_PLAN.md, DESIGNED 2026-11-10): a zombie at the church can't attack while the work timer runs on its own
 * task, up to a per-item budget (ICE_MAX_MS), and for ICE_GRACE_MS after a pause. Pure rules in js/ice.js.
 */
const Ice = require('../js/ice.js');
const MIN = 60000;
const MAX = 60 * MIN;
const GRACE = 5 * MIN;

const task = (o) => Object.assign({ type: 'task', isOverdue: true, timer: null, timerPaused: false, timerMsBanked: 0 }, o);
const running = (at) => ({ startedAt: at, checkedAt: at, promptedAt: null });

describe('config', () => {
    test('the approved numbers: 60 min of ice per task, 5 min of grace after a pause', () => {
        const CONFIG = require('../js/config.js');
        expect(CONFIG.ICE_MAX_MS).toBe(60 * MIN);
        expect(CONFIG.ICE_GRACE_MS).toBe(5 * MIN);
    });
});

describe('Ice.atBase: only a zombie that is attacking can be iced', () => {
    test('an overdue task yes; not overdue no', () => {
        expect(Ice.atBase(task())).toBe(true);
        expect(Ice.atBase(task({ isOverdue: false }))).toBe(false);
    });
    test('a Build habit yes; a Break habit (lurker) and a KO ghost no', () => {
        expect(Ice.atBase(task({ type: 'habit', isNegative: false }))).toBe(true);
        expect(Ice.atBase(task({ type: 'habit', isNegative: true }))).toBe(false);
        expect(Ice.atBase(task({ koGhost: true }))).toBe(false);
    });
});

describe('Ice.state', () => {
    test('iced = at the base AND the timer runs on THIS item AND ice is left', () => {
        const t = task({ timer: running(0) });
        const s = Ice.state(t, 10 * MIN);
        expect(s.iced).toBe(true);
        expect(s.leftMs).toBe(MAX);
        expect(s.thawing).toBe(false);
    });
    test('no timer, no ice', () => {
        expect(Ice.state(task(), 0).iced).toBe(false);
    });
    test('a timer on a zombie that is still walking does not ice it (the walk is the clock)', () => {
        expect(Ice.state(task({ isOverdue: false, timer: running(0) }), 0).iced).toBe(false);
    });
    test('the ice left is the budget minus what is already used', () => {
        const t = task({ timer: running(0), iceUsedMs: 40 * MIN });
        expect(Ice.state(t, 1).leftMs).toBe(20 * MIN);
        expect(Ice.state(t, 1).iced).toBe(true);
    });
    test('a spent budget does not ice, even with the timer still running', () => {
        const t = task({ timer: running(0), iceUsedMs: MAX });
        expect(Ice.state(t, 1).iced).toBe(false);
        expect(Ice.state(task({ timer: running(0), iceUsedMs: MAX + 5 }), 1).leftMs).toBe(0);
    });
    test('thawing = the last ICE_GRACE_MS of the budget (the ice cracks)', () => {
        const t = task({ timer: running(0), iceUsedMs: MAX - 4 * MIN });
        expect(Ice.state(t, 1)).toMatchObject({ iced: true, thawing: true, leftMs: 4 * MIN });
    });
    test('only the timed item: a parent is not iced by its sub-task timer, nor a sub-task by its parent', () => {
        const parent = task({ id: 1 });
        const sub = task({ id: 2, parentId: 1, timer: running(0) });
        expect(Ice.state(sub, 1).iced).toBe(true);
        expect(Ice.state(parent, 1).iced).toBe(false);
        const parentTimed = task({ id: 1, timer: running(0) });
        const subIdle = task({ id: 2, parentId: 1 });
        expect(Ice.state(parentTimed, 1).iced).toBe(true);
        expect(Ice.state(subIdle, 1).iced).toBe(false);
    });
});

describe('Ice.thawAt', () => {
    test('now + the ice left while iced, null when not', () => {
        expect(Ice.thawAt(task({ timer: running(0), iceUsedMs: 10 * MIN }), 1000)).toBe(1000 + 50 * MIN);
        expect(Ice.thawAt(task(), 1000)).toBeNull();
    });
});

describe('pause grace', () => {
    test('pausing an iced item at the base leaves it iced (cracking) for ICE_GRACE_MS', () => {
        const t = task({ timerPaused: true });
        Ice.onPause(t, 1000);
        expect(t.icePausedAt).toBe(1000);
        expect(Ice.state(t, 1000 + MIN)).toMatchObject({ iced: true, thawing: true, leftMs: GRACE - MIN });
        expect(Ice.state(t, 1000 + GRACE).iced).toBe(false);
        expect(Ice.state(t, 1000 + GRACE + 1).iced).toBe(false);
    });
    test('the grace never outlasts the budget', () => {
        const t = task({ timerPaused: true, iceUsedMs: MAX - 2 * MIN });
        Ice.onPause(t, 0);
        expect(Ice.state(t, 1).leftMs).toBe(2 * MIN);
    });
    test('no grace when the item is not at the base, or the budget is already spent', () => {
        const walking = task({ isOverdue: false, timerPaused: true });
        Ice.onPause(walking, 0);
        expect(walking.icePausedAt == null).toBe(true);
        const spent = task({ timerPaused: true, iceUsedMs: MAX });
        Ice.onPause(spent, 0);
        expect(spent.icePausedAt == null).toBe(true);
    });
    test('clearGrace (stop, resume, another timer starting) thaws at once', () => {
        const t = task({ timerPaused: true });
        Ice.onPause(t, 0);
        Ice.clearGrace(t);
        expect(Ice.state(t, 1000).iced).toBe(false);
        expect(t.icePausedAt == null).toBe(true);
    });
    test('resume within the grace: running again, iced again, the grace field is gone', () => {
        const t = task({ timerPaused: true });
        Ice.onPause(t, 0);
        t.timer = running(2 * MIN); t.timerPaused = false; Ice.clearGrace(t);
        expect(Ice.state(t, 2 * MIN + 1).iced).toBe(true);
    });
    test('clearOthers: starting a timer on B ends A\'s grace; B keeps its own', () => {
        const a = task({ id: 1, timerPaused: true }); Ice.onPause(a, 0);
        const b = task({ id: 2, timerPaused: true }); Ice.onPause(b, 0);
        Ice.clearOthers([a, b], b);
        expect(Ice.state(a, 1000).iced).toBe(false);
        expect(Ice.state(b, 1000).iced).toBe(true);
    });
});

describe('Ice.tick: spending the budget', () => {
    function run(item, fromMs, toMs, stepMs) {
        let last = null;
        for (let t = fromMs; t <= toMs; t += stepMs) last = Ice.tick(item, t);
        return last;
    }
    test('every iced tick spends the time since the last one', () => {
        const t = task({ timer: running(0) });
        run(t, 0, 10 * MIN, 1000);
        expect(t.iceUsedMs).toBe(10 * MIN);
    });
    test('the first iced tick reports started; later ones do not', () => {
        const t = task({ timer: running(0) });
        expect(Ice.tick(t, 0)).toMatchObject({ iced: true, started: true, thawed: false });
        expect(Ice.tick(t, 1000)).toMatchObject({ iced: true, started: false, thawed: false });
    });
    test('a gap (app closed / phone asleep, > LIVE_GAP_THRESHOLD_MS) spends nothing: catch-up owns that time', () => {
        const t = task({ timer: running(0) });
        Ice.tick(t, 0);
        Ice.tick(t, 1000);
        Ice.tick(t, 1000 + 5 * MIN);
        expect(t.iceUsedMs).toBe(1000);
    });
    test('the cap: after ICE_MAX_MS it thaws once, reports the episode length, and stays thawed', () => {
        const t = task({ timer: running(0) });
        let thaws = 0; let episode = 0;
        for (let now = 0; now <= MAX + 5 * MIN; now += 1000) {
            const r = Ice.tick(t, now);
            if (r.thawed) { thaws += 1; episode = r.episodeMs; }
            if (now > MAX) expect(r.iced).toBe(false);
        }
        expect(thaws).toBe(1);
        expect(episode).toBe(MAX);
        expect(t.iceUsedMs).toBe(MAX);
    });
    test('stop / start cannot refill it: the budget is per item across sessions', () => {
        const t = task({ timer: running(0) });
        run(t, 0, 40 * MIN, 1000);
        const stopped = Ice.tick(Object.assign(t, { timer: null }), 40 * MIN + 1000);
        expect(stopped).toMatchObject({ iced: false, thawed: true, episodeMs: 40 * MIN });
        t.timer = running(50 * MIN);
        expect(Ice.state(t, 50 * MIN).leftMs).toBe(20 * MIN);
        run(t, 50 * MIN, 80 * MIN, 1000);
        expect(t.iceUsedMs).toBe(MAX);
    });
    test('grace time is spent from the same budget', () => {
        const t = task({ timer: running(0) });
        run(t, 0, 10 * MIN, 1000);
        t.timer = null; t.timerPaused = true; Ice.onPause(t, 10 * MIN);
        const last = run(t, 10 * MIN + 1000, 15 * MIN, 1000); // the tick at 15:00 is the one that ends the grace
        // the tick that ends the grace spends nothing, so the total is within one tick of the grace's end
        expect(t.iceUsedMs).toBeGreaterThanOrEqual(15 * MIN - 1000);
        expect(t.iceUsedMs).toBeLessThanOrEqual(15 * MIN);
        expect(last).toMatchObject({ iced: false, thawed: true });
        expect(Ice.tick(t, 15 * MIN + 1000)).toMatchObject({ iced: false, thawed: false });
    });
    test('losing the base (not overdue any more) thaws it too', () => {
        const t = task({ timer: running(0) });
        Ice.tick(t, 0); Ice.tick(t, 1000);
        t.isOverdue = false;
        expect(Ice.tick(t, 2000)).toMatchObject({ iced: false, thawed: true });
    });
    test('an item that was never iced reports nothing', () => {
        expect(Ice.tick(task(), 0)).toMatchObject({ iced: false, started: false, thawed: false, episodeMs: 0 });
    });
    test('phase: iced / thawing / null, and phaseChanged only when it moves', () => {
        const t = task({ timer: running(0), iceUsedMs: MAX - 6 * MIN });
        expect(Ice.tick(t, 0)).toMatchObject({ phase: 'iced', phaseChanged: true });
        expect(Ice.tick(t, 1000)).toMatchObject({ phase: 'iced', phaseChanged: false });
        let r;
        for (let now = 1000; now <= 2 * MIN; now += 1000) r = Ice.tick(t, now);
        expect(r.phase).toBe('thawing');
        const thaw = Ice.tick(Object.assign(t, { iceUsedMs: MAX }), 2 * MIN + 1000);
        expect(thaw).toMatchObject({ phase: null, phaseChanged: true });
    });
    test('a plain object with junk fields never throws', () => {
        expect(() => Ice.tick({}, 0)).not.toThrow();
        expect(() => Ice.state(null, 0)).not.toThrow();
        expect(Ice.state(null, 0).iced).toBe(false);
    });
});
