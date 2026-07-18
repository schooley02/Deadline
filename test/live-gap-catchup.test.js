/**
 * Live-gap catch-up + real-time day count (2026-07-18).
 *
 * Regression tests for the overnight bug: the page stayed OPEN while the
 * machine slept, so there was no reload → no restoreGameState()/
 * runOfflineCatchUp() → the live loop replayed the whole gap at one
 * DAMAGE_INTERVAL_MS per 50ms tick (~120 damage in 6s) and flattened the base.
 * Meanwhile "days survived" came from a 60s-per-day accelerated timer that only
 * advanced while awake, so an overnight run reported "22 Days".
 *
 * These mirror the logic in script.js's runLiveGapCatchUp/computeDaysSurvived
 * (script.js has no module.exports — same convention as offline-catchup.test.js
 * and create-list-item-branching.test.js; see docs/ARCHITECTURE.md).
 */
const CONFIG = require('../js/config.js');

const CAP = CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM;   // 12
const INTERVAL = CONFIG.DAMAGE_INTERVAL_MS;       // 5 min
const DMG = CONFIG.OVERDUE_DAMAGE;                // 1
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// --- mirror of runLiveGapCatchUp's per-item logic ---
function catchUpItem(item, nowMs) {
    if (item.dueMs > nowMs) return 0;
    if (!item.isOverdue) {
        item.isOverdue = true;
        item.lastDamageTickTime = item.dueMs; // markAsOverdue sets the clock to the due time
    }
    const pendingTicks = Math.floor((nowMs - item.lastDamageTickTime) / INTERVAL);
    if (pendingTicks <= 0) return 0;
    item.lastDamageTickTime += pendingTicks * INTERVAL; // whole intervals only — keep remainder
    const remaining = CAP - (item.offlineDamageCharged || 0);
    const dmg = Math.min(pendingTicks * DMG, Math.max(0, remaining));
    item.offlineDamageCharged = (item.offlineDamageCharged || 0) + dmg;
    return dmg;
}

function makeItem(dueMs, extra = {}) {
    return { dueMs, isOverdue: false, lastDamageTickTime: null, offlineDamageCharged: 0, ...extra };
}

// --- mirror of computeDaysSurvived ---
function computeDaysSurvived(runStartedAtMs, nowMs) {
    if (!runStartedAtMs) return 0;
    return Math.max(0, Math.floor((nowMs - runStartedAtMs) / CONFIG.MS_PER_REAL_DAY));
}

describe('live-gap catch-up damage', () => {
    test('THE BUG: a 10-hour sleep on one overdue item is capped, not ~120 damage', () => {
        const due = Date.now() - 10 * HOUR;
        const item = makeItem(due, { isOverdue: true, lastDamageTickTime: due });
        const dmg = catchUpItem(item, due + 10 * HOUR);
        // Uncapped this would be floor(10h / 5min) = 120 — enough to kill a 100 HP base.
        expect(dmg).toBe(CAP);
        expect(dmg).toBeLessThan(CONFIG.MAX_BASE_HEALTH);
    });

    test('a single overdue item can never drop a full-health base alone', () => {
        const due = 0;
        const item = makeItem(due, { isOverdue: true, lastDamageTickTime: due });
        let total = 0;
        // hammer it with many separate gap events across days
        for (let i = 1; i <= 20; i++) total += catchUpItem(item, due + i * 12 * HOUR);
        expect(total).toBe(CAP);
        expect(total).toBeLessThan(CONFIG.MAX_BASE_HEALTH);
    });

    test('lifetime cap is shared with the reload path via offlineDamageCharged', () => {
        const due = 0;
        const item = makeItem(due, { isOverdue: true, lastDamageTickTime: due, offlineDamageCharged: CAP - 2 });
        expect(catchUpItem(item, due + 10 * HOUR)).toBe(2); // only the remaining budget
        expect(catchUpItem(item, due + 20 * HOUR)).toBe(0); // budget exhausted
    });

    test('no damage-evasion loophole: 1-minute background ticks still accumulate', () => {
        // A throttled tab wakes ~once a minute. Computing from each gap WINDOW
        // would floor(60s / 5min) = 0 every time and charge nothing forever.
        const due = 0;
        const item = makeItem(due, { isOverdue: true, lastDamageTickTime: due });
        let total = 0;
        for (let m = 1; m <= 25; m++) total += catchUpItem(item, due + m * MINUTE);
        expect(total).toBe(5); // 25 minutes / 5-minute interval
    });

    test('the damage clock keeps its sub-interval remainder', () => {
        const due = 0;
        const item = makeItem(due, { isOverdue: true, lastDamageTickTime: due });
        catchUpItem(item, due + 7 * MINUTE); // 1 whole tick, 2 min left over
        expect(item.lastDamageTickTime).toBe(due + INTERVAL);
        expect(catchUpItem(item, due + 10 * MINUTE)).toBe(1); // the leftover 2min + 3min = next tick
    });

    test('an item that fell due DURING the gap gets marked and charged from its due time', () => {
        const now = 100 * HOUR;
        const item = makeItem(now - 30 * 60 * 1000); // became due 30 min into the gap
        const dmg = catchUpItem(item, now);
        expect(item.isOverdue).toBe(true);
        expect(dmg).toBe(6); // 30 min / 5-min interval
    });

    test('an item not yet due is untouched', () => {
        const now = 100 * HOUR;
        const item = makeItem(now + HOUR);
        expect(catchUpItem(item, now)).toBe(0);
        expect(item.isOverdue).toBe(false);
    });

    test('breadth still hurts: many neglected items add up past the per-item cap', () => {
        // The decided principle — punish the COUNT of neglected items, not hours away.
        const due = 0;
        const items = Array.from({ length: 10 }, () => makeItem(due, { isOverdue: true, lastDamageTickTime: due }));
        const total = items.reduce((sum, it) => sum + catchUpItem(it, due + 10 * HOUR), 0);
        expect(total).toBe(10 * CAP);
        expect(total).toBeGreaterThan(CONFIG.MAX_BASE_HEALTH);
    });
});

describe('spawning an already-overdue item (js/spawning.js addItemToGame)', () => {
    // Third instance of the same bug class, found live 2026-07-18: markAsOverdue
    // parks the damage clock at the DUE time, so creating a task backdated 3h
    // made the live loop replay 36 missed intervals at one per 50ms tick and
    // cost 36 HP instantly. The item didn't exist during that window.
    function spawnOverdue(item, nowMs) {
        item.isOverdue = true;
        item.lastDamageTickTime = item.dueMs; // what markAsOverdue does
        item.lastDamageTickTime = nowMs;      // the fix: start the clock now
        return item;
    }

    test('damage clock starts at spawn time, not the (past) due time', () => {
        const now = 100 * HOUR;
        const item = spawnOverdue(makeItem(now - 3 * HOUR), now);
        expect(item.lastDamageTickTime).toBe(now);
        // nothing owed the instant it spawns
        expect(Math.floor((now - item.lastDamageTickTime) / INTERVAL)).toBe(0);
    });

    test('no retroactive burst: a 3h-backdated task costs 0 HP on creation', () => {
        const now = 100 * HOUR;
        const item = spawnOverdue(makeItem(now - 3 * HOUR), now);
        expect(catchUpItem(item, now)).toBe(0);
        // (before the fix this would have been floor(3h / 5min) = 36)
        expect(Math.floor((3 * HOUR) / INTERVAL)).toBe(36);
    });

    test('but it still takes normal live damage going forward', () => {
        const now = 100 * HOUR;
        const item = spawnOverdue(makeItem(now - 3 * HOUR), now);
        expect(catchUpItem(item, now + 20 * MINUTE)).toBe(4); // 20 min / 5-min interval
    });
});

describe('computeDaysSurvived (real elapsed time)', () => {
    test('THE BUG: an overnight run reads 0 days, not 22', () => {
        const start = Date.now();
        expect(computeDaysSurvived(start, start + 10 * HOUR)).toBe(0);
    });

    test('22 minutes of runtime is not 22 days', () => {
        const start = Date.now();
        expect(computeDaysSurvived(start, start + 22 * MINUTE)).toBe(0);
    });

    test('counts whole real days', () => {
        const start = Date.now();
        expect(computeDaysSurvived(start, start + 24 * HOUR)).toBe(1);
        expect(computeDaysSurvived(start, start + 47 * HOUR)).toBe(1);
        expect(computeDaysSurvived(start, start + 72 * HOUR)).toBe(3);
    });

    test('survives sleep — derived from wall clock, not tick count', () => {
        const start = Date.now();
        // The old timer only advanced while awake; elapsed real time is what counts.
        expect(computeDaysSurvived(start, start + 5 * 24 * HOUR)).toBe(5);
    });

    test('missing/!unset run start is 0, never negative', () => {
        expect(computeDaysSurvived(null, Date.now())).toBe(0);
        const start = Date.now();
        expect(computeDaysSurvived(start, start - HOUR)).toBe(0); // clock skew
    });
});
