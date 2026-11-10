/**
 * DailyRecord v6 (Pushback charges Build B, 2026-11-02): `pb` tally of paid-zone pushbacks by size and source.
 */
const DailyRecord = require('../js/dailyRecord.js');
const CONFIG = require('../js/config.js');

const rec = () => DailyRecord.fresh({ date: '2025-01-03', tz: 0 });

describe('v6 pb tally', () => {
    test('a fresh record starts with an empty pb tally for every size', () => {
        const r = rec();
        expect(r.v).toBe(12);
        expect(r.pb).toEqual({
            late: 0,
            short: { charge: 0, token: 0, points: 0 },
            medium: { charge: 0, token: 0, points: 0 },
            long: { charge: 0, token: 0, points: 0 },
        });
    });
    test('PB_SIZES mirrors CONFIG.PUSHBACK_SIZES', () => {
        expect(DailyRecord.PB_SIZES).toEqual(CONFIG.PUSHBACK_SIZES.map(s => s.id));
    });
    test('a pushback event counts units by size and source, and one late move', () => {
        const r = rec();
        DailyRecord.bump(r, 'pushback', { size: 'short', charges: 1, tokens: 0, points: 0 });
        DailyRecord.bump(r, 'pushback', { size: 'long', charges: 1, tokens: 0, points: 2 });
        DailyRecord.bump(r, 'pushback', { size: 'medium', charges: 0, tokens: 1, points: 0 });
        expect(r.pb.late).toBe(3);
        expect(r.pb.short).toEqual({ charge: 1, token: 0, points: 0 });
        expect(r.pb.medium).toEqual({ charge: 0, token: 1, points: 0 });
        expect(r.pb.long).toEqual({ charge: 1, token: 0, points: 2 });
    });
    test('an unknown size or junk counts is ignored but the move is still late', () => {
        const r = rec();
        DailyRecord.bump(r, 'pushback', { size: 'huge', charges: 5 });
        DailyRecord.bump(r, 'pushback', { size: 'short', charges: -2, tokens: 'x', points: 1.9 });
        expect(r.pb.late).toBe(2);
        expect(r.pb.short).toEqual({ charge: 0, token: 0, points: 1 });
    });
    test('the old token pushback bump is no longer used by the game but the shape stays', () => {
        expect(rec().tokens.pushback).toBe(0);
    });
    test('normalize gives an old (v5) day an empty pb and never rewrites its version', () => {
        const old = rec();
        delete old.pb;
        old.v = 5;
        const n = DailyRecord.normalize(old);
        expect(n.v).toBe(5);
        expect(n.pb.short).toEqual({ charge: 0, token: 0, points: 0 });
    });
    test('normalize keeps a stored pb', () => {
        const r = rec();
        DailyRecord.bump(r, 'pushback', { size: 'medium', charges: 2, tokens: 0, points: 0 });
        const n = DailyRecord.normalize(JSON.parse(JSON.stringify(r)));
        expect(n.pb.medium.charge).toBe(2);
        expect(n.pb.late).toBe(1);
    });
    test('rollUp sums pb across days into the month record', () => {
        const a = rec();
        const b = DailyRecord.fresh({ date: '2025-01-04', tz: 0 });
        DailyRecord.bump(a, 'pushback', { size: 'short', charges: 1 });
        DailyRecord.bump(b, 'pushback', { size: 'short', charges: 1, points: 1 });
        let store = DailyRecord.emptyStore();
        store = DailyRecord.addDay(store, DailyRecord.close(a, { lvl: 1 }));
        store = DailyRecord.addDay(store, DailyRecord.close(b, { lvl: 1 }));
        const rolled = DailyRecord.rollUp(store, new Date(2026, 9, 27));
        const month = rolled.months['2025-01'];
        expect(month.pb.late).toBe(2);
        expect(month.pb.short).toEqual({ charge: 2, token: 0, points: 1 });
    });
});
