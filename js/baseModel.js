/**
 * BaseModel -- pure numbers for the Base Health panel (docs/BASE_PANEL_PLAN.md,
 * step 1, 2026-10-26). No DOM, no globals except an optional `config` argument,
 * so every timer on the panel is unit-tested in test/baseModel.test.js.
 *
 * build(ctx) -> {
 *   state            'full' | 'healing' | 'attacked'
 *   color            'full' | 'moderate' | 'low' | 'critical'  (HP palette key)
 *   health, max
 *   attackerCount, nextHitMs, lossNext15,
 *   worsenAtHp, worsenMs         attacked: church art drops when HP <= worsenAtHp - 1
 *   fallsMs                      attacked: ms until HP reaches 0 (null if no attackers)
 *   nextHealMs, nextStageMs, nextStageHp, healsToStage, fullMs      healing
 *   kits[]                       { id, name, heal, held, effectiveHeal, wasted, landsAt, usable, savesMs | buysMs }
 *   attackers[]                  [{ id, name, overdueMs, nextHitMs }] most overdue first
 * }
 *
 * ctx: { health, nowMs, lastRegenTickMs, attackers:[{id,name,dueMs,tickMs,lastDamageTickMs}],
 *        inventory:{}, shopItems:[], config }
 * Timing mirrors js/loop.js: each attacker hits for OVERDUE_DAMAGE every tickMs
 * (default DAMAGE_INTERVAL_MS; stretched by a running work timer) from its
 * lastDamageTickMs; regen ticks every BASE_REGEN_INTERVAL_MS from lastRegenTickMs.
 */
const BaseModel = (() => {
    const STAGE_FLOORS = [0, 25, 50, 75]; // church art changes at >75 / >50 / >25 / >0
    const FIFTEEN_MIN = 15 * 60 * 1000;

    function colorKey(health) {
        if (health > 75) return 'full';
        if (health > 50) return 'moderate';
        if (health > 25) return 'low';
        return 'critical';
    }

    // Highest stage floor strictly below health: the church worsens once HP <= it.
    function worsenFloor(health) {
        let f = null;
        STAGE_FLOORS.forEach(t => { if (t < health) f = t; });
        return f;
    }

    // Lowest stage floor at or above health: HP floor+1 repairs the art one stage.
    function repairFloor(health) {
        for (let i = 0; i < STAGE_FLOORS.length; i++) {
            if (STAGE_FLOORS[i] >= health) return STAGE_FLOORS[i];
        }
        return null; // already in the top stage
    }

    // Simulates attacker hit schedules. Returns { msToReach(hp) , hitsWithin(ms) }.
    function simulateHits(attackers, nowMs, dmg) {
        const nexts = attackers.map(a => ({ at: a.nextHitAt, tick: a.tickMs }));
        function run(stopFn) {
            const state = nexts.map(n => ({ at: n.at, tick: n.tick }));
            let taken = 0;
            for (let guard = 0; guard < 5000; guard++) {
                let best = null;
                state.forEach(s => { if (best === null || s.at < best.at) best = s; });
                if (!best) return null;
                const at = best.at;
                taken += dmg;
                best.at += best.tick;
                const r = stopFn(taken, at);
                if (r !== undefined) return r;
            }
            return null;
        }
        return {
            // ms from now until cumulative damage >= hpLoss (null if impossible)
            msToLose(hpLoss) {
                if (!(hpLoss > 0) || !nexts.length) return null;
                return run((taken, at) => (taken >= hpLoss ? Math.max(0, at - nowMs) : undefined));
            },
            // HP lost within windowMs from now
            lossWithin(windowMs) {
                if (!nexts.length) return 0;
                let lost = 0;
                run((taken, at) => {
                    if (at - nowMs > windowMs) return true;
                    lost = taken;
                    return undefined;
                });
                return lost;
            },
        };
    }

    function build(ctx) {
        const c = ctx.config;
        const max = c.MAX_BASE_HEALTH;
        const health = Math.max(0, Math.min(max, ctx.health));
        const nowMs = ctx.nowMs;
        const dmg = c.OVERDUE_DAMAGE;
        const regenMs = c.BASE_REGEN_INTERVAL_MS;
        const regenHp = c.BASE_REGEN_HP;

        const attackers = (ctx.attackers || []).map(a => {
            const tickMs = a.tickMs > 0 ? a.tickMs : c.DAMAGE_INTERVAL_MS;
            const last = (typeof a.lastDamageTickMs === 'number') ? a.lastDamageTickMs : nowMs;
            let nextHitAt = last + tickMs;
            if (nextHitAt < nowMs) nextHitAt = nowMs; // loop is about to fire it
            return { id: a.id, name: a.name, dueMs: a.dueMs, tickMs, nextHitAt,
                overdueMs: Math.max(0, nowMs - a.dueMs), nextHitMs: Math.max(0, nextHitAt - nowMs) };
        }).sort((x, y) => y.overdueMs - x.overdueMs);

        const attacked = attackers.length > 0 && health > 0;
        const state = attacked ? 'attacked' : (health >= max ? 'full' : 'healing');
        const out = {
            state, color: colorKey(health), health, max,
            attackerCount: attackers.length,
            attackers: attackers.map(a => ({ id: a.id, name: a.name, overdueMs: a.overdueMs, nextHitMs: a.nextHitMs })),
            nextHitMs: null, lossNext15: 0, worsenAtHp: null, worsenMs: null, fallsMs: null,
            nextHealMs: null, nextStageMs: null, nextStageHp: null, healsToStage: null, fullMs: null,
            kits: [],
        };

        const sim = simulateHits(attackers, nowMs, dmg);
        // ms per HP while attacked (average, for "time bought"); null otherwise
        let msPerHp = null;
        if (attacked) {
            out.nextHitMs = Math.min.apply(null, attackers.map(a => a.nextHitMs));
            out.lossNext15 = Math.min(health, sim.lossWithin(FIFTEEN_MIN));
            out.fallsMs = sim.msToLose(health);
            const floor = worsenFloor(health);
            if (floor !== null) {
                out.worsenAtHp = floor + 1;
                out.worsenMs = sim.msToLose(health - floor);
            }
            const rate = attackers.reduce((s, a) => s + dmg / a.tickMs, 0); // HP per ms
            msPerHp = rate > 0 ? 1 / rate : null;
        } else if (state === 'healing') {
            const last = (typeof ctx.lastRegenTickMs === 'number') ? ctx.lastRegenTickMs : nowMs;
            let next = last + regenMs;
            if (next < nowMs) next = nowMs;
            out.nextHealMs = next - nowMs;
            const heals = Math.ceil((max - health) / regenHp);
            out.fullMs = out.nextHealMs + (heals - 1) * regenMs;
            const rf = repairFloor(health);
            if (rf !== null && rf < max) {
                out.nextStageHp = rf + 1;
                out.healsToStage = Math.ceil((rf + 1 - health) / regenHp);
                out.nextStageMs = out.nextHealMs + (out.healsToStage - 1) * regenMs;
            }
        }

        (ctx.shopItems || []).filter(i => i.category === 'repair').forEach(i => {
            const heal = i.effect.healAmount;
            const held = (ctx.inventory && ctx.inventory[i.id]) || 0;
            const effective = Math.max(0, Math.min(heal, max - health));
            const kit = {
                id: i.id, name: i.name, heal, held, effectiveHeal: effective,
                wasted: heal - effective, landsAt: Math.min(max, health + heal),
                usable: held > 0 && health < max && health > 0,
            };
            if (state === 'healing') kit.savesMs = effective / regenHp * regenMs;
            if (attacked && msPerHp !== null) kit.buysMs = effective * msPerHp;
            out.kits.push(kit);
        });
        return out;
    }

    // ---- formatting ----------------------------------------------------------

    // "3:42" (m:ss) under an hour, "1:05:09" (h:mm:ss) after. For live countdowns.
    function formatCountdown(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
        const p = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
    }

    // "~51 min", "~2h 55m", "~1d 3h", "<1 min". For estimates that change slowly.
    function formatApprox(ms) {
        const mins = Math.round(ms / 60000);
        if (mins < 1) return '<1 min';
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60), m = mins % 60;
        if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
        const d = Math.floor(h / 24), rh = h % 24;
        return rh ? `${d}d ${rh}h` : `${d}d`;
    }

    return { build, colorKey, worsenFloor, repairFloor, formatCountdown, formatApprox, STAGE_FLOORS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseModel;
}
