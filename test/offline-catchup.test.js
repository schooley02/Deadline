/**
 * Offline catch-up — back-charged overdue damage (Milestone 1, decided 2026-07-17).
 *
 * Mirror-style test (script.js has no module.exports; see docs/ARCHITECTURE.md):
 * computeOfflineOverdueDamage below is a hand-maintained copy of the pure
 * function in script.js. If the policy changes, update BOTH and DECISIONS.md.
 *
 * Policy: charge real elapsed overdue ticks (OVERDUE_DAMAGE per
 * DAMAGE_INTERVAL_MS) for the portion of the offline window an item spent
 * overdue. Capped at OFFLINE_DAMAGE_CAP_PER_ITEM for the item's ENTIRE
 * LIFETIME (tracked via item.offlineDamageCharged, passed in as
 * alreadyCharged), not per offline window/restore — otherwise repeatedly
 * closing and reopening the app with the same still-overdue item would let
 * duration compound the charge, which is exactly what the cap is meant to
 * prevent (revised 2026-07-17 after Jeremy asked whether it was a per-day
 * cap — it explicitly is NOT). The window starts at the LATER of (due time,
 * now - offlineMs) so damage already charged live before the save is never
 * double-charged.
 *
 * Also covers the companion fix: editing an overdue task's due date forward
 * must clear isOverdue (recomputeOverdueStateAfterEdit in script.js) — that
 * logic isn't pure/mirrorable here since it touches DOM/module state, but
 * see docs/DECISIONS.md for the reasoning and script.js for the live-verified
 * behavior.
 */
const CONFIG = require('../js/config.js');

const DAMAGE_INTERVAL_MS = CONFIG.DAMAGE_INTERVAL_MS;
const OVERDUE_DAMAGE = CONFIG.OVERDUE_DAMAGE;

// MIRROR of script.js computeOfflineOverdueDamage — keep in sync.
function computeOfflineOverdueDamage(dueMs, nowMs, offlineMs, alreadyCharged) {
    const remaining = CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM - (alreadyCharged || 0);
    if (offlineMs <= 0 || dueMs >= nowMs || remaining <= 0) return 0;
    const overdueStartMs = Math.max(dueMs, nowMs - offlineMs);
    const ticks = Math.floor((nowMs - overdueStartMs) / DAMAGE_INTERVAL_MS);
    return Math.min(ticks * OVERDUE_DAMAGE, remaining);
}

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000; // arbitrary fixed epoch

describe('computeOfflineOverdueDamage', () => {
    test('not overdue: due in the future costs nothing', () => {
        expect(computeOfflineOverdueDamage(NOW + HOUR, NOW, 8 * HOUR, 0)).toBe(0);
    });

    test('no offline time costs nothing even if overdue', () => {
        expect(computeOfflineOverdueDamage(NOW - 5 * HOUR, NOW, 0, 0)).toBe(0);
    });

    test('a little late hurts a little: 20 min overdue = 4 ticks, under the cap', () => {
        const dmg = computeOfflineOverdueDamage(NOW - 20 * 60 * 1000, NOW, 8 * HOUR, 0);
        expect(dmg).toBe(4 * OVERDUE_DAMAGE);
        expect(dmg).toBeLessThan(CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM);
    });

    test('sub-interval lateness charges zero full ticks', () => {
        expect(computeOfflineOverdueDamage(NOW - (DAMAGE_INTERVAL_MS - 1), NOW, 8 * HOUR, 0)).toBe(0);
    });

    test('overnight overdue item hits the per-item cap, not 96 HP', () => {
        expect(computeOfflineOverdueDamage(NOW - 8 * HOUR, NOW, 8 * HOUR, 0))
            .toBe(CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM);
    });

    test('cap is duration-independent within a single window: a weekend away costs the same as overnight', () => {
        const overnight = computeOfflineOverdueDamage(NOW - 8 * HOUR, NOW, 8 * HOUR, 0);
        const weekend = computeOfflineOverdueDamage(NOW - 60 * HOUR, NOW, 60 * HOUR, 0);
        expect(weekend).toBe(overnight);
    });

    test('already-overdue-before-save items only charge the offline window (no double-charging)', () => {
        // Due 10h ago, but the save was written 1h ago — live play covered the
        // first 9h. Only 1h of offline overdue time is chargeable: 12 ticks.
        const dmg = computeOfflineOverdueDamage(NOW - 10 * HOUR, NOW, 1 * HOUR, 0);
        expect(dmg).toBe(Math.min(12 * OVERDUE_DAMAGE, CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM));
    });

    test('became overdue mid-offline-window: charged only from due time', () => {
        // Offline 8h, item went overdue 30min before now → 6 ticks.
        const dmg = computeOfflineOverdueDamage(NOW - 30 * 60 * 1000, NOW, 8 * HOUR, 0);
        expect(dmg).toBe(6 * OVERDUE_DAMAGE);
    });

    test('per-item cap means base death requires breadth of neglect, not duration', () => {
        // One item overnight can never exceed the cap...
        const one = computeOfflineOverdueDamage(NOW - 72 * HOUR, NOW, 72 * HOUR, 0);
        expect(one).toBe(CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM);
        // ...but enough neglected items can still sum past MAX_BASE_HEALTH.
        const itemsToKill = Math.ceil(CONFIG.MAX_BASE_HEALTH / CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM);
        expect(one * itemsToKill).toBeGreaterThanOrEqual(CONFIG.MAX_BASE_HEALTH);
    });

    test('LIFETIME cap: once an item has been charged the full cap, further offline time on it charges nothing', () => {
        // Already charged the full cap in a prior restore/session.
        const dmg = computeOfflineOverdueDamage(NOW - 20 * HOUR, NOW, 20 * HOUR, CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM);
        expect(dmg).toBe(0);
    });

    test('LIFETIME cap: partial prior charge only allows the remaining budget, not a fresh cap', () => {
        const alreadyCharged = CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM - 3; // 3 HP of headroom left
        // 20h overdue would normally hit the full cap on its own — but budget caps it at 3.
        const dmg = computeOfflineOverdueDamage(NOW - 20 * HOUR, NOW, 20 * HOUR, alreadyCharged);
        expect(dmg).toBe(3);
    });

    test('repeated same-day open/close cycles on one still-overdue item never exceed the lifetime cap in total', () => {
        // Simulates 5 separate restores across several days, same overdue item,
        // each with its own short offline window — the kind of pattern that
        // would blow past the cap if it were reset per-restore instead of lifetime.
        let charged = 0;
        const dueMs = NOW - 100 * HOUR; // overdue well before any of these windows
        for (let i = 0; i < 5; i++) {
            const windowNow = NOW + i * 24 * HOUR;
            const dmg = computeOfflineOverdueDamage(dueMs, windowNow, 8 * HOUR, charged);
            charged += dmg;
        }
        expect(charged).toBe(CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM);
    });
});

describe('CONFIG offline values', () => {
    test('offline constants exist and are sane', () => {
        expect(CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM).toBeGreaterThan(0);
        expect(CONFIG.OFFLINE_DAMAGE_CAP_PER_ITEM).toBeLessThan(CONFIG.MAX_BASE_HEALTH / 2);
        expect(CONFIG.OFFLINE_MAX_MS).toBe(3 * 24 * HOUR); // spec: 3-day max
        expect(CONFIG.OFFLINE_CATCHUP_MAX_MS).toBeLessThanOrEqual(5000); // spec: ≤5s animation
        expect(CONFIG.OFFLINE_CATCHUP_MIN_MS).toBeLessThanOrEqual(CONFIG.OFFLINE_CATCHUP_MAX_MS);
    });
});
