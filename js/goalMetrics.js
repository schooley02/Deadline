/**
 * GoalMetrics -- the daily-record numbers a Goals "Your days" (aggregate) target may watch, and picking the records inside a
 * period or window (Goals Build A, 2026-11-05; docs/GOALS_PLAN.md).
 *
 * The allowlist itself lives in CONFIG.GOAL_METRICS (the caller passes it in; this module reads no CONFIG). A metric is either a dotted
 * `path` into a DailyRecord or a derived `special`. Pure functions, no DOM, no State: unit-tested directly (test/goalMetrics.test.js).
 */
const GoalMetrics = (() => {

    function byId(defs, id) {
        if (!Array.isArray(defs)) return null;
        for (let i = 0; i < defs.length; i++) if (defs[i] && defs[i].id === id) return defs[i];
        return null;
    }

    function isAllowed(defs, id) {
        return byId(defs, id) !== null;
    }

    function num(v) {
        return (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
    }

    /** A metric's value on one DailyRecord (0 for anything missing or junk). */
    function value(rec, def) {
        if (!rec || typeof rec !== 'object' || !def) return 0;
        if (def.special === 'prioritySets') {
            // `pri.s` is only written when the day closes; the open day derives it from the finished count.
            return Math.floor(num(rec.pri && rec.pri.d) / 3);
        }
        if (def.special === 'perfectDay') {
            const a = num(rec.att && rec.att.active);
            const p = num(rec.att && rec.att.perfect);
            return (a >= 1 && p === a) ? 1 : 0;
        }
        if (typeof def.path !== 'string') return 0;
        let cur = rec;
        const keys = def.path.split('.');
        for (let i = 0; i < keys.length; i++) {
            if (cur == null || typeof cur !== 'object') return 0;
            cur = cur[keys[i]];
        }
        return num(cur);
    }

    function valueById(defs, rec, id) {
        return value(rec, byId(defs, id));
    }

    /**
     * The records whose date falls in [startKey, endKey] (both 'YYYY-MM-DD', inclusive): the closed days of the store, plus the open
     * day when it is in range. The open day wins over a stale closed copy of the same date. Returns { records (oldest first), openKey }
     * where openKey is the open day's date when it was included, else null.
     */
    function recordsBetween(daysObj, openRec, startKey, endKey) {
        const keyOk = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
        if (!keyOk(startKey) || !keyOk(endKey)) return { records: [], openKey: null };
        const byDate = {};
        if (daysObj && typeof daysObj === 'object') {
            Object.keys(daysObj).forEach((k) => {
                if (keyOk(k) && k >= startKey && k <= endKey && daysObj[k] && typeof daysObj[k] === 'object') byDate[k] = daysObj[k];
            });
        }
        let openKey = null;
        if (openRec && typeof openRec === 'object' && keyOk(openRec.date) && openRec.date >= startKey && openRec.date <= endKey) {
            byDate[openRec.date] = openRec;
            openKey = openRec.date;
        }
        const records = Object.keys(byDate).sort().map((k) => byDate[k]);
        return { records, openKey };
    }

    return { byId, isAllowed, value, valueById, recordsBetween };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoalMetrics;
}
