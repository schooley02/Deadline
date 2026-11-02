/**
 * Pushback charges (Build A, 2026-11-02) — pure logic + config.
 * See docs/PUSHBACK_CHARGES_PLAN.md.
 */
const Pushback = require('../js/pushback.js');
const CONFIG = require('../js/config.js');

const MIN = 60000;
const H = 60 * MIN;
const DAY = 24 * H;
const SIZES = CONFIG.PUSHBACK_SIZES;
const now = new Date('2026-11-02T12:00:00Z');
const nowMs = now.getTime();
const dayStartMs = new Date('2026-11-02T00:00:00Z').getTime();

describe('CONFIG pushback keys', () => {
    test('sizes ascend: short 30 min / medium 2 hr / long 1 day, prices 5 / 10 / 30', () => {
        expect(SIZES.map(s => s.id)).toEqual(['short', 'medium', 'long']);
        expect(SIZES.map(s => s.ms)).toEqual([30 * MIN, 2 * H, DAY]);
        expect(SIZES.map(s => s.baseCost)).toEqual([5, 10, 30]);
        expect(SIZES.map(s => s.window)).toEqual(['day', 'day', 'week']);
    });
    test('paid zone is 4 hours', () => {
        expect(CONFIG.PUSHBACK_PAID_ZONE_MS).toBe(4 * H);
    });
    test('allowance table: each star adds exactly one charge, per the plan', () => {
        const t = CONFIG.PUSHBACK_ALLOWANCE;
        expect(t[1]).toEqual({ short: 3, medium: 2, long: 2 });
        expect(t[2]).toEqual({ short: 4, medium: 2, long: 2 });
        expect(t[3]).toEqual({ short: 4, medium: 3, long: 2 });
        expect(t[4]).toEqual({ short: 4, medium: 3, long: 3 });
        expect(t[5]).toEqual({ short: 4, medium: 3, long: 4 });
    });
    test('the three held-token shop rows mirror the sizes (Build B)', () => {
        const rows = CONFIG.SHOP_ITEMS.filter(i => i.category === 'pushback');
        expect(rows.map(i => i.id)).toEqual(['pushback_short', 'pushback_medium', 'pushback_long']);
        rows.forEach((row, i) => {
            expect(row.consumable).toBe(true);
            expect(row.effect.pushbackSize).toBe(SIZES[i].id);
            expect(row.baseCost).toBe(SIZES[i].baseCost);
        });
    });
    test('plusLabel names a size for a button', () => {
        expect(SIZES.map(s => Pushback.plusLabel(s.ms))).toEqual(['+30 min', '+2 hr', '+1 day']);
        expect(Pushback.plusLabel(90 * MIN)).toBe('+1.5 hr');
        expect(Pushback.plusLabel(3 * DAY)).toBe('+3 days');
    });
});

describe('sizeFor', () => {
    test('exactly at a size boundary uses that size', () => {
        expect(Pushback.sizeFor(30 * MIN, SIZES)).toEqual({ size: 'short', count: 1 });
        expect(Pushback.sizeFor(2 * H, SIZES)).toEqual({ size: 'medium', count: 1 });
        expect(Pushback.sizeFor(DAY, SIZES)).toEqual({ size: 'long', count: 1 });
    });
    test('one ms past a boundary steps up to the next size', () => {
        expect(Pushback.sizeFor(30 * MIN + 1, SIZES)).toEqual({ size: 'medium', count: 1 });
        expect(Pushback.sizeFor(2 * H + 1, SIZES)).toEqual({ size: 'long', count: 1 });
    });
    test('a 90 minute push is a Medium, not a Long', () => {
        expect(Pushback.sizeFor(90 * MIN, SIZES)).toEqual({ size: 'medium', count: 1 });
    });
    test('beyond a day uses whole Longs', () => {
        expect(Pushback.sizeFor(DAY + 1, SIZES)).toEqual({ size: 'long', count: 2 });
        expect(Pushback.sizeFor(2 * DAY, SIZES)).toEqual({ size: 'long', count: 2 });
        expect(Pushback.sizeFor(2 * DAY + 1, SIZES)).toEqual({ size: 'long', count: 3 });
    });
    test('zero distance still costs the smallest size', () => {
        expect(Pushback.sizeFor(0, SIZES)).toEqual({ size: 'short', count: 1 });
    });
    test('negative, NaN, non-number or no sizes -> null', () => {
        expect(Pushback.sizeFor(-1, SIZES)).toBeNull();
        expect(Pushback.sizeFor(NaN, SIZES)).toBeNull();
        expect(Pushback.sizeFor('5', SIZES)).toBeNull();
        expect(Pushback.sizeFor(10, [])).toBeNull();
        expect(Pushback.sizeFor(10, undefined)).toBeNull();
    });
    test('unsorted sizes still pick the smallest cover', () => {
        const shuffled = [SIZES[2], SIZES[0], SIZES[1]];
        expect(Pushback.sizeFor(45 * MIN, shuffled)).toEqual({ size: 'medium', count: 1 });
    });
});

describe('isFreeMove', () => {
    const base = (over) => Pushback.isFreeMove(Object.assign({
        currentDue: new Date(nowMs + 2 * H),
        newDue: new Date(nowMs + 3 * H),
        now,
        createdAt: new Date(nowMs - 5 * H),
        graceMs: CONFIG.RESCHEDULE_GRACE_MS,
        paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS,
    }, over));

    test('earlier or equal is free and not later', () => {
        expect(base({ newDue: new Date(nowMs + 1 * H) })).toMatchObject({ later: false, free: true, reason: 'not-later', paidZone: false });
        expect(base({ newDue: new Date(nowMs + 2 * H) })).toMatchObject({ later: false, free: true, reason: 'not-later' });
    });
    test('missing dates are not a later move', () => {
        expect(base({ currentDue: null }).later).toBe(false);
        expect(base({ newDue: undefined }).later).toBe(false);
    });
    test('more than 4 hours away is free (calm), even a long move', () => {
        const r = base({ currentDue: new Date(nowMs + 4 * H + 1), newDue: new Date(nowMs + 3 * DAY) });
        expect(r).toMatchObject({ later: true, free: true, reason: 'calm', paidZone: false });
    });
    test('exactly 4 hours away is already the paid zone', () => {
        const r = base({ currentDue: new Date(nowMs + 4 * H), newDue: new Date(nowMs + 5 * H) });
        expect(r).toMatchObject({ free: false, reason: 'paid', paidZone: true });
    });
    test('inside 4 hours, a later move is paid and measures the distance', () => {
        const r = base({ currentDue: new Date(nowMs + 3 * H), newDue: new Date(nowMs + 3 * H + 45 * MIN) });
        expect(r).toMatchObject({ later: true, free: false, reason: 'paid', paidZone: true, deltaMs: 45 * MIN });
    });
    test('no half-price middle zone: 2-4 h is paid like under 2 h', () => {
        const a = base({ currentDue: new Date(nowMs + 3 * H), newDue: new Date(nowMs + 4 * H) });
        const b = base({ currentDue: new Date(nowMs + 1 * H), newDue: new Date(nowMs + 2 * H) });
        expect(a.reason).toBe('paid');
        expect(b.reason).toBe('paid');
        expect(a.deltaMs).toBe(b.deltaMs);
    });
    test('overdue: distance runs from now, not from the old due', () => {
        const r = base({ currentDue: new Date(nowMs - 5 * H), newDue: new Date(nowMs + 1 * H) });
        expect(r).toMatchObject({ free: false, reason: 'paid', paidZone: true, deltaMs: 1 * H });
    });
    test('overdue moved to a time still in the past: later, paid, zero distance', () => {
        const r = base({ currentDue: new Date(nowMs - 5 * H), newDue: new Date(nowMs - 1 * H) });
        expect(r).toMatchObject({ later: true, free: false, reason: 'paid', deltaMs: 0 });
        expect(Pushback.sizeFor(r.deltaMs, SIZES)).toEqual({ size: 'short', count: 1 });
    });
    test('within 10 minutes of creating is free even in the paid zone, and never flags paidZone', () => {
        const r = base({ createdAt: new Date(nowMs - 10 * MIN) });
        expect(r).toMatchObject({ later: true, free: true, reason: 'grace', paidZone: false });
        expect(base({ createdAt: new Date(nowMs - 10 * MIN - 1) }).reason).toBe('paid');
    });
    test('createdAt accepts ms or ISO and null means no grace', () => {
        expect(base({ createdAt: nowMs - 5 * MIN }).reason).toBe('grace');
        expect(base({ createdAt: new Date(nowMs - 5 * MIN).toISOString() }).reason).toBe('grace');
        expect(base({ createdAt: null }).reason).toBe('paid');
    });
    test('now can be ms', () => {
        expect(base({ now: nowMs }).reason).toBe('paid');
    });
});

describe('allowanceForStar', () => {
    const T = CONFIG.PUSHBACK_ALLOWANCE;
    test('returns the table row per star, and ★5 has 4 Longs a week', () => {
        expect(Pushback.allowanceForStar(1, T)).toEqual({ short: 3, medium: 2, long: 2 });
        expect(Pushback.allowanceForStar(3, T)).toEqual({ short: 4, medium: 3, long: 2 });
        expect(Pushback.allowanceForStar(5, T)).toEqual({ short: 4, medium: 3, long: 4 });
    });
    test('clamps below 1, above 5, and junk to a valid star', () => {
        expect(Pushback.allowanceForStar(0, T)).toEqual(T[1]);
        expect(Pushback.allowanceForStar(-3, T)).toEqual(T[1]);
        expect(Pushback.allowanceForStar(9, T)).toEqual(T[5]);
        expect(Pushback.allowanceForStar('x', T)).toEqual(T[1]);
        expect(Pushback.allowanceForStar(undefined, T)).toEqual(T[1]);
        expect(Pushback.allowanceForStar(2.9, T)).toEqual(T[2]);
    });
    test('returns a copy, and an empty table gives zeros', () => {
        const a = Pushback.allowanceForStar(1, T);
        a.short = 99;
        expect(T[1].short).toBe(3);
        expect(Pushback.allowanceForStar(1, {})).toEqual({ short: 0, medium: 0, long: 0 });
        expect(Pushback.allowanceForStar(1, undefined)).toEqual({ short: 0, medium: 0, long: 0 });
    });
    test('a missing middle star falls back to the nearest lower one', () => {
        const gappy = { 1: { short: 1, medium: 1, long: 1 }, 3: { short: 3, medium: 3, long: 3 } };
        expect(Pushback.allowanceForStar(2, gappy)).toEqual(gappy[1]);
    });
});

describe('chargesLeft', () => {
    const A = CONFIG.PUSHBACK_ALLOWANCE[1];
    const left = (uses, allowance = A, at = nowMs) => Pushback.chargesLeft(uses, at, allowance, dayStartMs, SIZES);

    test('no uses = the full allowance', () => {
        expect(left(undefined)).toEqual({ short: 3, medium: 2, long: 2 });
        expect(left({})).toEqual({ short: 3, medium: 2, long: 2 });
    });
    test('daily charges count uses since the start of the day only', () => {
        const uses = { short: [dayStartMs - 1, dayStartMs, nowMs - H], medium: [dayStartMs - H] };
        expect(left(uses)).toEqual({ short: 1, medium: 2, long: 2 });
    });
    test('long charges are a rolling 7 days, pruned by age, not by day start', () => {
        const uses = { long: [nowMs - 7 * DAY, nowMs - 7 * DAY + 1, nowMs - 1 * H] };
        // the stamp exactly 7 days old has expired; the other two count
        expect(left(uses).long).toBe(0);
        expect(left({ long: [nowMs - 7 * DAY] }).long).toBe(2);
        expect(left({ long: [nowMs - 7 * DAY + 1] }).long).toBe(1);
    });
    test('a Long used yesterday still counts today', () => {
        expect(left({ long: [dayStartMs - 3 * H] }).long).toBe(1);
    });
    test('uses stamped in the future never count', () => {
        expect(left({ short: [nowMs + H], long: [nowMs + H] })).toEqual({ short: 3, medium: 2, long: 2 });
    });
    test('accepts ISO timestamps and ignores junk', () => {
        const uses = { short: [new Date(nowMs - H).toISOString(), 'nope', null, {}] };
        expect(left(uses).short).toBe(2);
    });
    test('never goes below zero and a ★5 allowance gives 4 Longs', () => {
        expect(left({ short: [1, 2, 3, 4, 5].map(i => nowMs - i * MIN) }).short).toBe(0);
        const five = CONFIG.PUSHBACK_ALLOWANCE[5];
        expect(left({}, five).long).toBe(4);
        expect(left({ long: [nowMs - H, nowMs - 2 * H, nowMs - DAY] }, five).long).toBe(1);
    });
    test('does not mutate its input', () => {
        const uses = { short: [nowMs - H], long: [nowMs - 8 * DAY] };
        const copy = JSON.parse(JSON.stringify(uses));
        left(uses);
        expect(uses).toEqual(copy);
    });
    test('a size missing from the allowance has none', () => {
        expect(left({}, { short: 1 })).toEqual({ short: 1, medium: 0, long: 0 });
    });
});

describe('resolvePayment', () => {
    const pay = (over) => Pushback.resolvePayment(Object.assign(
        { size: 'medium', count: 1, chargesLeft: 0, held: 0, points: 0, price: 10 }, over));

    test('a free charge comes first', () => {
        expect(pay({ chargesLeft: 1, held: 3, points: 100 })).toMatchObject({
            ok: true, kind: 'charge', charges: 1, tokens: 0, pointUnits: 0, cost: 0 });
    });
    test('then a held token', () => {
        expect(pay({ held: 2, points: 100 })).toMatchObject({
            ok: true, kind: 'token', charges: 0, tokens: 1, pointUnits: 0, cost: 0 });
    });
    test('then points, at the unit price', () => {
        expect(pay({ points: 10 })).toMatchObject({
            ok: true, kind: 'points', charges: 0, tokens: 0, pointUnits: 1, cost: 10 });
    });
    test('blocked when the points do not cover it, and the result still shows the need', () => {
        expect(pay({ points: 9 })).toMatchObject({ ok: false, kind: 'blocked', pointUnits: 1, cost: 10 });
    });
    test('a negative balance (debt) cannot pay', () => {
        expect(pay({ points: -5 }).ok).toBe(false);
    });
    test('multi-day Longs mix sources unit by unit: charges, tokens, then points', () => {
        const r = pay({ size: 'long', count: 4, chargesLeft: 1, held: 1, points: 60, price: 30 });
        expect(r).toMatchObject({ ok: true, kind: 'points', charges: 1, tokens: 1, pointUnits: 2, cost: 60 });
    });
    test('multi-unit move covered by charges and tokens spends no points', () => {
        expect(pay({ size: 'long', count: 3, chargesLeft: 2, held: 1, points: 0 })).toMatchObject({
            ok: true, kind: 'token', charges: 2, tokens: 1, pointUnits: 0, cost: 0 });
    });
    test('multi-unit move one point short is blocked as a whole', () => {
        const r = pay({ size: 'long', count: 3, chargesLeft: 0, held: 0, points: 89, price: 30 });
        expect(r).toMatchObject({ ok: false, kind: 'blocked', pointUnits: 3, cost: 90 });
    });
    test('a bad price cannot be paid in points but charges and tokens still work', () => {
        expect(pay({ price: undefined, points: 999 }).ok).toBe(false);
        expect(pay({ price: NaN, points: 999 }).ok).toBe(false);
        expect(pay({ price: undefined, chargesLeft: 1 })).toMatchObject({ ok: true, kind: 'charge' });
        expect(pay({ price: undefined, held: 1 })).toMatchObject({ ok: true, kind: 'token' });
    });
    test('count 0 or junk is a free no-op', () => {
        expect(pay({ count: 0 })).toMatchObject({ ok: true, kind: 'charge', charges: 0, tokens: 0, pointUnits: 0, cost: 0 });
        expect(pay({ count: undefined })).toMatchObject({ ok: true, count: 0, cost: 0 });
    });
    test('negative or fractional inputs are clamped', () => {
        expect(pay({ chargesLeft: -2, held: -1, points: 10 })).toMatchObject({ charges: 0, tokens: 0, pointUnits: 1 });
        expect(pay({ chargesLeft: 1.9 })).toMatchObject({ charges: 1, kind: 'charge' });
    });
    test('keeps the size on the result', () => {
        expect(pay({ size: 'short', chargesLeft: 1 }).size).toBe('short');
    });
    test('a free price (0) lets points cover it even with no balance', () => {
        expect(pay({ price: 0, points: 0 })).toMatchObject({ ok: true, kind: 'points', cost: 0 });
    });
});

describe('end to end: a move through the three functions', () => {
    test('an urgent 75 minute push with the Mediums used up pays 10 points', () => {
        const move = Pushback.isFreeMove({
            currentDue: new Date(nowMs + 1 * H), newDue: new Date(nowMs + 1 * H + 75 * MIN),
            now, createdAt: new Date(nowMs - DAY), graceMs: CONFIG.RESCHEDULE_GRACE_MS,
            paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS,
        });
        const need = Pushback.sizeFor(move.deltaMs, SIZES);
        const allowance = Pushback.allowanceForStar(1, CONFIG.PUSHBACK_ALLOWANCE);
        const uses = { medium: [nowMs - 3 * H, nowMs - 4 * H] };
        const charges = Pushback.chargesLeft(uses, nowMs, allowance, dayStartMs, SIZES);
        const size = SIZES.find(s => s.id === need.size);
        const r = Pushback.resolvePayment({
            size: need.size, count: need.count, chargesLeft: charges[need.size], held: 0, points: 12, price: size.baseCost });
        expect(need).toEqual({ size: 'medium', count: 1 });
        expect(charges.medium).toBe(0);
        expect(r).toMatchObject({ ok: true, kind: 'points', cost: 10 });
    });
});

// ---- Build B: quote / quoteFixed / apply ----
describe('quote / quoteFixed / apply', () => {
    const allowance = CONFIG.PUSHBACK_ALLOWANCE[1]; // 3 / 2 / 2
    const base = (over) => Object.assign({
        currentDue: new Date(nowMs + 1 * H), newDue: new Date(nowMs + 1 * H + 20 * MIN),
        now, createdAt: new Date(nowMs - DAY), graceMs: CONFIG.RESCHEDULE_GRACE_MS,
        paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS, sizes: SIZES, allowance, uses: {},
        dayStartMs, held: {}, points: 100, prices: { short: 5, medium: 10, long: 30 },
    }, over);

    test('a calm move (due more than 4 h away) is free and flags nothing', () => {
        const q = Pushback.quote(base({ currentDue: new Date(nowMs + 5 * H), newDue: new Date(nowMs + 8 * H) }));
        expect(q).toMatchObject({ later: true, free: true, reason: 'calm', kind: 'free', ok: true, cost: 0, size: null, paidZone: false });
        const a = Pushback.apply(q, { now, sizes: SIZES, uses: {} });
        expect(a).toMatchObject({ ok: true, pushedLate: false, pointsSpent: 0, chargesUsed: {}, tokensUsed: {} });
    });
    test('an earlier move is free', () => {
        const q = Pushback.quote(base({ newDue: new Date(nowMs + 30 * MIN) }));
        expect(q).toMatchObject({ later: false, kind: 'free', ok: true });
    });
    test('grace move is free even in the paid zone and does not flag', () => {
        const q = Pushback.quote(base({ createdAt: new Date(nowMs - 2 * MIN) }));
        expect(q).toMatchObject({ reason: 'grace', kind: 'free', ok: true });
        expect(Pushback.apply(q, { now, sizes: SIZES }).pushedLate).toBe(false);
    });
    test('a paid-zone move takes the smallest covering size and a free charge', () => {
        const q = Pushback.quote(base());
        expect(q).toMatchObject({ size: 'short', count: 1, kind: 'charge', ok: true, charges: 1, cost: 0, paidZone: true });
        expect(q.left).toEqual({ short: 3, medium: 2, long: 2 });
    });
    test('a 90 minute move uses a Medium', () => {
        const q = Pushback.quote(base({ newDue: new Date(nowMs + 1 * H + 90 * MIN) }));
        expect(q).toMatchObject({ size: 'medium', kind: 'charge' });
    });
    test('charges spent: a held token is used next, then points', () => {
        const spent = { short: [nowMs - H, nowMs - 2 * H, nowMs - 3 * H] };
        const withToken = Pushback.quote(base({ uses: spent, held: { short: 1 } }));
        expect(withToken).toMatchObject({ kind: 'token', tokens: 1, charges: 0, cost: 0, ok: true });
        const withPoints = Pushback.quote(base({ uses: spent }));
        expect(withPoints).toMatchObject({ kind: 'points', pointUnits: 1, cost: 5, ok: true });
    });
    test('not enough points -> blocked, canAfford false, apply refuses', () => {
        const spent = { short: [nowMs - H, nowMs - 2 * H, nowMs - 3 * H] };
        const q = Pushback.quote(base({ uses: spent, points: 4 }));
        expect(q).toMatchObject({ kind: 'blocked', ok: false, canAfford: false, cost: 5 });
        expect(Pushback.apply(q, { now, sizes: SIZES })).toEqual({ ok: false });
    });
    test('overdue item moved 20 min from now is a Short', () => {
        const q = Pushback.quote(base({ currentDue: new Date(nowMs - 6 * H), newDue: new Date(nowMs + 20 * MIN) }));
        expect(q).toMatchObject({ size: 'short', count: 1, paidZone: true });
    });
    test('multi-day move needs several Longs, mixing charge + points', () => {
        const q = Pushback.quote(base({ newDue: new Date(nowMs + 1 * H + 3 * DAY), uses: { long: [nowMs - H] } }));
        expect(q).toMatchObject({ size: 'long', count: 3, charges: 1, pointUnits: 2, cost: 60, kind: 'points' });
    });
    test('quoteFixed: popup buttons push from the later of due and now', () => {
        const q = Pushback.quoteFixed('medium', base({ newDue: undefined }));
        expect(q).toMatchObject({ size: 'medium', kind: 'charge', paidZone: true });
        const overdue = Pushback.quoteFixed('short', base({ currentDue: new Date(nowMs - 3 * H), newDue: undefined }));
        expect(overdue).toMatchObject({ size: 'short', kind: 'charge' });
        expect(Pushback.quoteFixed('huge', base())).toBeNull();
    });
    test('quoteFixed on a calm zombie is free', () => {
        const q = Pushback.quoteFixed('long', base({ currentDue: new Date(nowMs + 6 * H), newDue: undefined }));
        expect(q).toMatchObject({ kind: 'free', ok: true, paidZone: false });
    });
    test('apply stamps charges, reports tokens/points and flags every paid-zone move', () => {
        const q = Pushback.quote(base({ uses: { short: [nowMs - 10 * DAY, nowMs - H] } }));
        const a = Pushback.apply(q, { now, sizes: SIZES, uses: { short: [nowMs - 10 * DAY, nowMs - H] } });
        expect(a.ok).toBe(true);
        expect(a.pushedLate).toBe(true);
        expect(a.chargesUsed).toEqual({ short: 1 });
        expect(a.uses.short).toEqual([nowMs - H, nowMs]); // the 10-day-old stamp is pruned
        expect(a.uses.medium).toEqual([]);
        const spent = { short: [nowMs - H, nowMs - 2 * H, nowMs - 3 * H] };
        const tok = Pushback.apply(Pushback.quote(base({ uses: spent, held: { short: 1 } })), { now, sizes: SIZES, uses: spent });
        expect(tok).toMatchObject({ pushedLate: true, tokensUsed: { short: 1 }, pointsSpent: 0 });
        const pts = Pushback.apply(Pushback.quote(base({ uses: spent })), { now, sizes: SIZES, uses: spent });
        expect(pts).toMatchObject({ pushedLate: true, pointsSpent: 5, tokensUsed: {} });
    });
    test('apply does not mutate its inputs', () => {
        const uses = { short: [nowMs - H] };
        const copy = JSON.stringify(uses);
        Pushback.apply(Pushback.quote(base({ uses })), { now, sizes: SIZES, uses });
        expect(JSON.stringify(uses)).toBe(copy);
    });
});

describe('graceCreatedAt (grace is for tasks and sub-tasks only, Jeremy 2026-11-02)', () => {
    const made = new Date(2026, 10, 2, 9, 0);
    test('a typed-in task or sub-task counts', () => {
        expect(Pushback.graceCreatedAt({ type: 'task', creationTime: made })).toBe(made);
        expect(Pushback.graceCreatedAt({ type: 'task', parentId: 7, definitionId: null, creationTime: made })).toBe(made);
    });
    test('habit instances and routine task instances never get the grace', () => {
        expect(Pushback.graceCreatedAt({ type: 'habit', creationTime: made })).toBeNull();
        expect(Pushback.graceCreatedAt({ type: 'task', definitionId: 12, creationTime: made })).toBeNull();
    });
    test('missing item or creation time = no grace', () => {
        expect(Pushback.graceCreatedAt(null)).toBeNull();
        expect(Pushback.graceCreatedAt({ type: 'task' })).toBeNull();
    });
    test('through quote: a habit just spawned is in the paid zone, a task just typed is free', () => {
        const justNow = new Date(nowMs - 2 * MIN);
        const inputs = {
            currentDue: new Date(nowMs + 2 * H), newDue: new Date(nowMs + 2 * H + 30 * MIN), now, graceMs: CONFIG.RESCHEDULE_GRACE_MS,
            paidZoneMs: CONFIG.PUSHBACK_PAID_ZONE_MS, sizes: SIZES, allowance: CONFIG.PUSHBACK_ALLOWANCE[1], uses: {},
            dayStartMs, held: {}, points: 100, prices: { short: 5, medium: 10, long: 30 },
        };
        const habit = Pushback.quote(Object.assign({}, inputs, { createdAt: Pushback.graceCreatedAt({ type: 'habit', creationTime: justNow }) }));
        const task = Pushback.quote(Object.assign({}, inputs, { createdAt: Pushback.graceCreatedAt({ type: 'task', creationTime: justNow }) }));
        expect(habit.reason).toBe('paid');
        expect(habit.kind).toBe('charge');
        expect(task.reason).toBe('grace');
    });
});
