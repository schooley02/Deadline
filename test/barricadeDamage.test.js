/**
 * Barricade damage bonus (Momentum Build C, 2026-11-11; docs/MOMENTUM_PLAN.md, DECISIONS 2026-11-11 (momentum build C)).
 * Solid = 10% less damage, Reinforced = 20% less; a fallen barricade is NORMAL damage, never extra. Live loop only: catch-up gets no cut.
 */
global.CONFIG = require('../js/config.js');
global.Clock = require('../js/clock.js');
global.Momentum = require('../js/momentum.js');
const Loop = require('../js/loop.js');
const Damage = require('../js/damage.js');

const STATES = CONFIG.MOMENTUM.BARRICADE_STATES;
const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;

describe('Momentum.damageCut / cutIntervalMs', () => {
    test('the dials: Reinforced 20%, Solid 10%, Partial and None 0', () => {
        expect(Momentum.damageCut('reinforced', STATES)).toBe(0.2);
        expect(Momentum.damageCut('solid', STATES)).toBe(0.1);
        expect(Momentum.damageCut('partial', STATES)).toBe(0);
        expect(Momentum.damageCut('none', STATES)).toBe(0);
    });
    test('every state has a damageCut that never goes up as momentum falls', () => {
        STATES.forEach((s) => expect(typeof s.damageCut).toBe('number'));
        const byMin = STATES.slice().sort((a, b) => b.min - a.min).map((s) => s.damageCut);
        for (let i = 1; i < byMin.length; i++) expect(byMin[i]).toBeLessThanOrEqual(byMin[i - 1]);
    });
    test('never a penalty: no state has a negative cut, and bad input is 0', () => {
        STATES.forEach((s) => expect(s.damageCut).toBeGreaterThanOrEqual(0));
        expect(Momentum.damageCut('nope', STATES)).toBe(0);
        expect(Momentum.damageCut('solid', undefined)).toBe(0);
        expect(Momentum.damageCut('solid', [{ id: 'solid', damageCut: -1 }])).toBe(0);
        expect(Momentum.damageCut('solid', [{ id: 'solid', damageCut: 'x' }])).toBe(0);
    });
    test('a mistyped dial is capped at 50%', () => {
        expect(Momentum.damageCut('solid', [{ id: 'solid', damageCut: 0.99 }])).toBe(0.5);
    });
    test('the interval is stretched by 1 / (1 - cut) and never shortened', () => {
        expect(Momentum.cutIntervalMs(300000, 0)).toBe(300000);
        expect(Momentum.cutIntervalMs(300000, 0.1)).toBe(333333);
        expect(Momentum.cutIntervalMs(300000, 0.2)).toBe(375000);
        expect(Momentum.cutIntervalMs(300000, -0.5)).toBe(300000);
        expect(Momentum.cutIntervalMs(300000, 1)).toBe(300000);
        expect(Momentum.cutIntervalMs(300000, undefined)).toBe(300000);
    });
});

function overdueItem(lastTick) {
    return { id: 1, isOverdue: true, dueDateTime: new Date(Date.now() - 3600000), lastDamageTickTime: lastTick, x: 0, element: null };
}
function deps(item, extra) {
    const st = { hits: 0 };
    const d = {
        _st: st, isGameOver: () => false, isOfflineCatchUpActive: () => false, isTimePreviewActive: () => false,
        activeItems: [item], baseWidth: 100, gameScreenWidth: 1200,
        getLastLoopTickMs: () => Date.now(), setLastLoopTickMs: () => {},
        getLastRegenTickMs: () => Date.now(), setLastRegenTickMs: () => {},
        getLastAutosaveMs: () => Date.now(), setLastAutosaveMs: () => {},
        markAsOverdue: () => {}, getSubTaskClusterOffset: () => 0, calculateTimelineXWithClustering: () => 500,
        damageBase: () => { st.hits += 1; }, healBase: () => {}, updateMidnightLine: () => {}, runLiveGapCatchUp: () => {}, saveGame: () => {},
        isNonThreatening: () => false,
        ...extra,
    };
    return d;
}

describe('the live loop honours the barricade cut', () => {
    test('no collaborator (old callers) = normal damage', () => {
        const item = overdueItem(Date.now() - INTERVAL - 10);
        const d = deps(item);
        Loop.updateActiveItems(d);
        expect(d._st.hits).toBe(1);
    });
    test('cut 0 = normal damage', () => {
        const item = overdueItem(Date.now() - INTERVAL - 10);
        const d = deps(item, { getBarricadeDamageCut: () => 0 });
        Loop.updateActiveItems(d);
        expect(d._st.hits).toBe(1);
    });
    test('a hit that is due at the normal interval waits under a 10% cut', () => {
        const item = overdueItem(Date.now() - INTERVAL - 10); // due at 5:00 but not at 5:33
        const d = deps(item, { getBarricadeDamageCut: () => 0.1 });
        Loop.updateActiveItems(d);
        expect(d._st.hits).toBe(0);
    });
    test('it lands once the stretched interval has passed, and the next is one stretched interval later', () => {
        const stretched = Momentum.cutIntervalMs(INTERVAL, 0.1);
        const last = Date.now() - stretched - 10;
        const item = overdueItem(last);
        const d = deps(item, { getBarricadeDamageCut: () => 0.1 });
        Loop.updateActiveItems(d);
        expect(d._st.hits).toBe(1);
        expect(item.lastDamageTickTime).toBe(last + stretched);
    });
    test('over 10 hours a 20% cut is 20% fewer hits, a 10% cut 10% fewer (stepped one minute at a time)', () => {
        jest.useFakeTimers();
        try {
            const hits = (cut) => {
                jest.setSystemTime(new Date('2026-11-11T12:00:00Z'));
                const item = overdueItem(Date.now());
                const d = deps(item, { getBarricadeDamageCut: () => cut });
                for (let m = 0; m < 600; m++) { jest.setSystemTime(Date.now() + 60000); Loop.updateActiveItems(d); }
                return d._st.hits;
            };
            const normal = hits(0);
            expect(normal).toBe(120);
            expect(hits(0.1)).toBe(108);
            expect(hits(0.2)).toBe(96);
        } finally { jest.useRealTimers(); }
    });
    test('the cut is asked at most once per tick, and not at all when nothing is overdue', () => {
        let asked = 0;
        const a = overdueItem(Date.now() - 5 * INTERVAL);
        const b = Object.assign(overdueItem(Date.now() - 5 * INTERVAL), { id: 2 });
        const d = deps(a, { getBarricadeDamageCut: () => { asked += 1; return 0.1; } });
        d.activeItems.push(b);
        Loop.updateActiveItems(d);
        expect(asked).toBe(1);
        const idle = { id: 3, isOverdue: false, dueDateTime: new Date(Date.now() + 3600000), lastDamageTickTime: 0, x: 0, element: null };
        asked = 0;
        Loop.updateActiveItems(deps(idle, { getBarricadeDamageCut: () => { asked += 1; return 0.1; } }));
        expect(asked).toBe(0);
    });
    test('a lurker (non-threatening) never reaches the cut', () => {
        let asked = 0;
        const item = overdueItem(Date.now() - 5 * INTERVAL);
        Loop.updateActiveItems(deps(item, { isNonThreatening: () => true, getBarricadeDamageCut: () => { asked += 1; return 0.2; } }));
        expect(asked).toBe(0);
    });
});

describe('catch-up paths get no cut', () => {
    test('the offline and gap damage functions take no barricade input', () => {
        const due = 0; const now = 100 * INTERVAL;
        const ticks = Damage.computeOfflineTicks(due, now, now, due, INTERVAL);
        expect(ticks).toEqual(Damage.computeOfflineTicks(due, now, now, due, INTERVAL));
    });
    test('damage.js never mentions the barricade or the momentum cut', () => {
        const src = require('fs').readFileSync(require('path').join(__dirname, '../js/damage.js'), 'utf8');
        expect(/barricade|damageCut|cutIntervalMs/i.test(src)).toBe(false);
    });
});

describe('wording and wiring', () => {
    const fs = require('fs'); const path = require('path');
    const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    test('script.js hands the live loop the barricade cut and nothing else does', () => {
        expect(read('script.js')).toMatch(/getBarricadeDamageCut:\s*barricadeDamageCut/);
        expect(read('js/state.js')).not.toMatch(/getBarricadeDamageCut/);
    });
    test('the Base Health panel stretches its hit interval by the same cut, so its ETA matches the loop', () => {
        expect(read('script.js')).toMatch(/tickMs: Momentum\.cutIntervalMs\(Family\.intervalMs\(/);
    });
    test('the window line names the current cut, or the next state that has one', () => {
        global.Modal = global.Modal || {};
        const BW = require('../js/ui/barricadeWindow.js');
        const info = (id, name) => ({ count: 0, max: 7, state: { id, name }, today: 'pending', nights: [] });
        expect(BW.damageLine(info('solid', 'Solid'), STATES)).toBe('Solid: zombies do 10% less damage at the church.');
        expect(BW.damageLine(info('reinforced', 'Reinforced'), STATES)).toBe('Reinforced: zombies do 20% less damage at the church.');
        expect(BW.damageLine(info('partial', 'Partial'), STATES)).toBe('Reach Solid (5 of 7) and zombies do 10% less damage at the church.');
        expect(BW.damageLine(info('none', 'None'), STATES)).toContain('Reach Solid');
        expect(BW.damageLine(info('none', 'None'), [])).toBe('');
        expect(BW.damageLine(info('none', 'None'), STATES)).not.toMatch(/more damage|extra damage/i);
    });
    test('How Deadline works explains the cut from CONFIG and says a weak barricade adds nothing', () => {
        global.Habits = require('../js/habits.js'); global.Heroes = require('../js/heroes.js');
        global.PointsInfo = require('../js/pointsInfo.js'); global.Pushback = require('../js/pushback.js');
        global.PushbackHelp = require('../js/ui/pushbackHelp.js');
        const HIW = require('../js/ui/howItWorks.js');
        const t = HIW.topics(CONFIG).find((x) => x.id === 'momentum').what.join(' ');
        expect(t).toContain('Reinforced takes 20% off the damage zombies do at the church, and Solid takes 10% off');
        expect(t).toContain('A weak barricade never adds damage');
        expect(t).toContain('charged at the normal rate');
        const cfg = Object.assign({}, CONFIG, { MOMENTUM: Object.assign({}, CONFIG.MOMENTUM, { BARRICADE_STATES: STATES.map((s) => (s.id === 'solid' ? Object.assign({}, s, { damageCut: 0.15 }) : s)) }) });
        expect(HIW.topics(cfg).find((x) => x.id === 'momentum').what.join(' ')).toContain('Solid takes 15% off');
    });
});
