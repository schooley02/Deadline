/**
 * Economy tests ([P1-DATA-007], 2026-07-18).
 *
 * js/economy.js is pure — no CONFIG global, no DOM — so it's required
 * directly, same style as progression.test.js. shopPrice cases pin the
 * docs/ECONOMY.md formula (base × 1.5^owned, rounded) against the real
 * base costs so a silent formula change fails loudly.
 */
const Economy = require('../js/economy.js');
const CONFIG = require('../js/config.js');

describe('taskPoints', () => {
    test('normal task awards pointsPerTask', () => {
        expect(Economy.taskPoints(false, CONFIG.POINTS_PER_TASK)).toBe(CONFIG.POINTS_PER_TASK);
    });

    test('high-priority task awards double', () => {
        expect(Economy.taskPoints(true, CONFIG.POINTS_PER_TASK)).toBe(CONFIG.POINTS_PER_TASK * 2);
    });

    test('undefined isHighPriority (older saved items) is treated as normal', () => {
        expect(Economy.taskPoints(undefined, 10)).toBe(10);
    });
});

describe('addPoints / subtractPoints', () => {
    test('addPoints is a plain sum', () => {
        expect(Economy.addPoints(15, 10)).toBe(25);
        expect(Economy.addPoints(0, 5)).toBe(5);
    });

    test('subtractPoints floors at 0 (refund can never go negative today)', () => {
        expect(Economy.subtractPoints(15, 10)).toBe(5);
        expect(Economy.subtractPoints(5, 10)).toBe(0);
        expect(Economy.subtractPoints(0, 20)).toBe(0);
    });

    test('earn-then-refund round-trips exactly when balance covers it', () => {
        const start = 40;
        const amount = Economy.taskPoints(true, CONFIG.POINTS_PER_TASK);
        expect(Economy.subtractPoints(Economy.addPoints(start, amount), amount)).toBe(start);
    });
});

describe('shopPrice — exponential pricing (docs/ECONOMY.md)', () => {
    test('first purchase (0 owned) costs the base price', () => {
        expect(Economy.shopPrice(25, 0)).toBe(25);
        expect(Economy.shopPrice(200, 0)).toBe(200);
    });

    test('price multiplies by 1.5 per unit owned', () => {
        expect(Economy.shopPrice(25, 1)).toBe(38);   // 37.5 rounds up
        expect(Economy.shopPrice(25, 2)).toBe(56);   // 56.25 rounds down
        expect(Economy.shopPrice(100, 1)).toBe(150);
        expect(Economy.shopPrice(100, 2)).toBe(225);
    });

    test('unlimited scaling — keeps growing, never caps', () => {
        const p5 = Economy.shopPrice(50, 5);
        const p6 = Economy.shopPrice(50, 6);
        expect(p5).toBe(380);  // 50 × 1.5^5 = 379.6875
        expect(p6).toBeGreaterThan(p5);
    });

    test('result is always a whole number of points', () => {
        for (let owned = 0; owned < 10; owned++) {
            expect(Number.isInteger(Economy.shopPrice(25, owned))).toBe(true);
        }
    });
});
