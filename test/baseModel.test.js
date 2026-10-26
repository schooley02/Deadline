/**
 * BaseModel pure-core tests (docs/BASE_PANEL_PLAN.md step 1, 2026-10-26).
 */
const CONFIG = require('../js/config.js');
const BaseModel = require('../js/baseModel.js');

const MIN = 60 * 1000;
const NOW = 1_000_000_000_000;
const att = (id, overdueMin, extra) => Object.assign({
    id, name: id, dueMs: NOW - overdueMin * MIN, tickMs: CONFIG.DAMAGE_INTERVAL_MS,
    lastDamageTickMs: NOW - 1 * MIN, // next hit in 4 min
}, extra);
const base = (health, attackers, extra) => BaseModel.build(Object.assign({
    health, nowMs: NOW, lastRegenTickMs: NOW - 1 * MIN, attackers: attackers || [],
    inventory: { repair_small: 2, repair_medium: 1, repair_large: 0 },
    shopItems: CONFIG.SHOP_ITEMS, config: CONFIG,
}, extra));

describe('state and color', () => {
    test('full / healing / attacked', () => {
        expect(base(100).state).toBe('full');
        expect(base(40).state).toBe('healing');
        expect(base(58, [att('a', 10)]).state).toBe('attacked');
    });
    test('color keys follow the HP palette boundaries', () => {
        expect(BaseModel.colorKey(100)).toBe('full');
        expect(BaseModel.colorKey(76)).toBe('full');
        expect(BaseModel.colorKey(75)).toBe('moderate');
        expect(BaseModel.colorKey(51)).toBe('moderate');
        expect(BaseModel.colorKey(50)).toBe('low');
        expect(BaseModel.colorKey(26)).toBe('low');
        expect(BaseModel.colorKey(25)).toBe('critical');
    });
    test('attackers at 100 HP still means attacked', () => {
        expect(base(100, [att('a', 5)]).state).toBe('attacked');
    });
});

describe('healing timers', () => {
    test('next +1 HP counts from the last regen tick', () => {
        const m = base(40);
        expect(m.nextHealMs).toBe(4 * MIN);
    });
    test('late regen clock clamps to now', () => {
        expect(base(40, [], { lastRegenTickMs: NOW - 20 * MIN }).nextHealMs).toBe(0);
    });
    test('null regen clock plants a full interval', () => {
        expect(base(40, [], { lastRegenTickMs: null }).nextHealMs).toBe(5 * MIN);
    });
    test('next art stage: 40 HP needs 51 -> 11 heals', () => {
        const m = base(40);
        expect(m.nextStageHp).toBe(51);
        expect(m.healsToStage).toBe(11);
        expect(m.nextStageMs).toBe(4 * MIN + 10 * 5 * MIN);
    });
    test('exactly on a floor (50) targets 51 in one heal', () => {
        const m = base(50);
        expect(m.nextStageHp).toBe(51);
        expect(m.healsToStage).toBe(1);
        expect(m.nextStageMs).toBe(m.nextHealMs);
    });
    test('76-99 is in the top stage: no next stage, still time to full', () => {
        const m = base(90);
        expect(m.nextStageHp).toBeNull();
        expect(m.fullMs).toBe(4 * MIN + 9 * 5 * MIN);
    });
    test('time to full from 40 HP', () => {
        expect(base(40).fullMs).toBe(4 * MIN + 59 * 5 * MIN);
    });
    test('full state has no timers', () => {
        const m = base(100);
        expect(m.nextHealMs).toBeNull();
        expect(m.fullMs).toBeNull();
    });
});

describe('attacked timers', () => {
    test('one attacker: next hit, loss in 15 min, worsen and fall times', () => {
        const m = base(58, [att('a', 10)]);
        expect(m.nextHitMs).toBe(4 * MIN);
        expect(m.lossNext15).toBe(3); // hits at 4, 9, 14 min
        expect(m.worsenAtHp).toBe(51);
        expect(m.worsenMs).toBe(4 * MIN + 7 * 5 * MIN); // 8 HP to lose to reach 50
        expect(m.fallsMs).toBe(4 * MIN + 57 * 5 * MIN);
    });
    test('three attackers staggered', () => {
        const m = base(58, [
            att('a', 10, { lastDamageTickMs: NOW - 1 * MIN }), // hits at 4, 9, 14
            att('b', 20, { lastDamageTickMs: NOW - 2 * MIN }), // 3, 8, 13
            att('c', 5, { lastDamageTickMs: NOW - 4 * MIN }),  // 1, 6, 11
        ]);
        expect(m.attackerCount).toBe(3);
        expect(m.nextHitMs).toBe(1 * MIN);
        expect(m.lossNext15).toBe(9);
        expect(m.attackers[0].id).toBe('b'); // most overdue first
    });
    test('worsen target is the stage below: 40 HP -> 26..., 26 HP -> 25 floor', () => {
        expect(base(40, [att('a', 1)]).worsenAtHp).toBe(26);
        expect(base(26, [att('a', 1)]).worsenAtHp).toBe(26);
        expect(base(25, [att('a', 1)]).worsenAtHp).toBe(1);
    });
    test('at 1-25 HP the only floor left is 0: worsen = falls', () => {
        const m = base(10, [att('a', 1)]);
        expect(m.worsenAtHp).toBe(1);
        expect(m.worsenMs).toBe(m.fallsMs);
    });
    test('stretched work-timer interval slows that attacker', () => {
        const m = base(58, [att('a', 10, { tickMs: 10 * MIN, lastDamageTickMs: NOW - 1 * MIN })]);
        expect(m.nextHitMs).toBe(9 * MIN);
        expect(m.lossNext15).toBe(1);
    });
    test('overdue hit about to fire clamps to 0', () => {
        const m = base(58, [att('a', 10, { lastDamageTickMs: NOW - 9 * MIN })]);
        expect(m.nextHitMs).toBe(0);
    });
    test('eight attackers do not hang the simulation', () => {
        const eight = Array.from({ length: 8 }, (_, i) => att('z' + i, i + 1));
        const m = base(100, eight);
        // 100 HP at 8 HP per 5 min is ~62.5 min; staggered first hits shift it slightly
        expect(m.fallsMs).toBeGreaterThan(55 * MIN);
        expect(m.fallsMs).toBeLessThan(70 * MIN);
    });
});

describe('repair kits', () => {
    const kit = (m, id) => m.kits.find(k => k.id === id);
    test('healing: time saved is HP x regen interval', () => {
        const m = base(40);
        expect(kit(m, 'repair_small').savesMs).toBe(15 * 5 * MIN);
        expect(kit(m, 'repair_medium').savesMs).toBe(35 * 5 * MIN);
        expect(kit(m, 'repair_medium').landsAt).toBe(75);
    });
    test('large kit past full reports waste and effective heal', () => {
        const k = kit(base(40), 'repair_large');
        expect(k.effectiveHeal).toBe(60);
        expect(k.wasted).toBe(15);
        expect(k.usable).toBe(false); // none held
    });
    test('attacked: time bought is HP / loss rate', () => {
        const m = base(58, [att('a', 10), att('b', 5)]);
        expect(kit(m, 'repair_small').buysMs).toBe(15 * 5 * MIN / 2);
        expect(kit(m, 'repair_medium').buysMs).toBe(35 * 5 * MIN / 2);
    });
    test('full health: no kit is usable', () => {
        const m = base(100);
        expect(m.kits.every(k => !k.usable)).toBe(true);
        expect(kit(m, 'repair_small').effectiveHeal).toBe(0);
    });
    test('usable when held and below max', () => {
        const m = base(58, [att('a', 10)]);
        expect(kit(m, 'repair_small').usable).toBe(true);
    });
});

describe('formatting', () => {
    test('countdown', () => {
        expect(BaseModel.formatCountdown(3 * MIN + 42 * 1000)).toBe('3:42');
        expect(BaseModel.formatCountdown(0)).toBe('0:00');
        expect(BaseModel.formatCountdown(65 * MIN + 9 * 1000)).toBe('1:05:09');
    });
    test('approx', () => {
        expect(BaseModel.formatApprox(20 * 1000)).toBe('<1 min');
        expect(BaseModel.formatApprox(51 * MIN)).toBe('51 min');
        expect(BaseModel.formatApprox(175 * MIN)).toBe('2h 55m');
        expect(BaseModel.formatApprox(120 * MIN)).toBe('2h');
        expect(BaseModel.formatApprox(27 * 60 * MIN)).toBe('1d 3h');
    });
});
