/**
 * Rescheduling cost (Build 2, 2026-10-25) was RETIRED by pushback charges (Build B, 2026-11-02):
 * the pricing now lives in js/pushback.js (see test/pushback.test.js). This file keeps the
 * checks that the old pieces are really gone, the typo-grace constant is still there, and the
 * run-stat counter still works. (Safe to rename to a pushback-retired test with `git mv`.)
 */
const Economy = require('../js/economy.js');
const CONFIG = require('../js/config.js');
const RunStats = require('../js/runStats.js');

describe('the distance-priced rescheduling is retired', () => {
    test('Economy no longer exports the old pricing or free-use helpers', () => {
        ['reschedulePrice', 'reschedulePriceTiers', 'pruneRescheduleFreeUses', 'rescheduleFreeUsesLeft'].forEach((k) => {
            expect(Economy[k]).toBeUndefined();
        });
    });
    test('the old config keys and shop rows are gone, the typo grace stays', () => {
        expect(CONFIG.RESCHEDULE_ZONE_FACTORS).toBeUndefined();
        expect(CONFIG.RESCHEDULE_FREE_PER_WEEK).toBeUndefined();
        expect(CONFIG.SHOP_ITEMS.find(i => ['pushback_1hr', 'pushback_2hr', 'pushback_1day'].includes(i.id))).toBeUndefined();
        expect(CONFIG.RESCHEDULE_GRACE_MS).toBe(10 * 60 * 1000);
    });
});

describe('RunStats reschedules', () => {
    test('fresh stats start at 0 and record increments', () => {
        const s = RunStats.freshRunStats();
        expect(s.reschedules).toBe(0);
        RunStats.recordReschedule(s);
        RunStats.recordReschedule(s);
        expect(s.reschedules).toBe(2);
    });
});
