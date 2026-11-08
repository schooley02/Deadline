/**
 * MemorialPanel -- the Memorial's own window (2026-11-08, Jeremy: "give the memorial its own window ... and leave Stats under the
 * Stats tab"). Opened by tapping the Memorial obelisk on the graveyard hill (js/ui/graveyardView.js) and by the "Memorial" link at the
 * bottom of the Village panel, which is how a portrait phone reaches it (the graveyard is hidden in the portrait strip).
 *
 * It shows what the Memorial measures and how the player measures up:
 *   - the current stage's obelisk and "Stage N of 5";
 *   - the rule in one line (the average of the 8 buildings' best-ever tiers, rounded down, never goes down);
 *   - one row per building: its best-ever tier (green pips) and the tier it is at THIS run (gold outline), so it is clear the Memorial
 *     keeps your best even when a new run starts every building back at T1;
 *   - how many tier-ups, in any buildings, reach the next stage (or that it is fully restored).
 *
 * PURE / DOM split like VillagePanel: `buildModel` and `panelHtml` are pure and unit-tested (test/memorialPanel.test.js); `open` is DOM.
 * Globals read at call time: Memorial (js/memorial.js), VillageCard (building names), Modal (open).
 *
 * buildModel(ctx): ctx = {
 *   best,      { [kind]: 1..5 } the saved all-time bests (State.getBestVillageTiers); missing kinds count as T1
 *   current?   { [kind]: 1..5 } the tiers of THIS run (script.js realVillageTiers); missing = T1
 * }
 */
const MemorialPanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    const MAX_TIER = 5;
    const RULE = 'Stands for your best-ever tier in each of your 8 buildings: the average, rounded down. It never goes down.';

    function tierOr1(map, kind) {
        const t = map && map[kind];
        return (Number.isInteger(t) && t >= 1 && t <= MAX_TIER) ? t : 1;
    }

    /** The line under the rows: tier-ups still needed for the next stage, or the finished message. */
    function nextText(p) {
        if (p.maxed) return 'The Memorial is fully restored.';
        const n = p.toNextStage;
        return `${n} more tier-up${n === 1 ? '' : 's'}, in any buildings, ${n === 1 ? 'reaches' : 'reach'} Stage ${p.stage + 1}.`;
    }

    function buildModel(ctx) {
        const c = ctx || {};
        const p = Memorial.progress(c.best);
        const rows = p.kinds.map((k) => ({
            kind: k.kind,
            name: (VillageCard.KINDS[k.kind] || { name: k.kind }).name,
            best: k.best,
            current: tierOr1(c.current, k.kind),
        }));
        return {
            stage: p.stage,
            maxed: p.maxed,
            toNextStage: p.toNextStage,
            sum: p.sum,
            max: rows.length * MAX_TIER,
            rule: RULE,
            nextText: nextText(p),
            rows,
        };
    }

    function pipsHtml(best, current) {
        let out = '';
        for (let t = 1; t <= MAX_TIER; t++) {
            out += `<span class="mp-pip${t <= best ? ' mp-best' : ''}${t === current ? ' mp-now' : ''}"></span>`;
        }
        return out;
    }

    function rowHtml(r) {
        return `
            <li class="mp-row" aria-label="${esc(r.name)}: best tier ${r.best}, this run tier ${r.current}">
                <span class="mp-name">${esc(r.name)}</span>
                <span class="mp-pips" aria-hidden="true">${pipsHtml(r.best, r.current)}</span>
            </li>`;
    }

    function panelHtml(model) {
        const m = model || { stage: 1, rows: [], rule: RULE, nextText: '' };
        return `
            <div class="modal-overlay memorial-panel-overlay">
                <div class="modal-content memorial-panel" role="dialog" aria-label="Memorial">
                    <div class="mp-title"><h3>Memorial</h3><span class="mp-stage">Stage ${m.stage} of ${MAX_TIER}</span></div>
                    <div class="mp-head">
                        <div class="mp-sprite" data-stage="${m.stage}" aria-hidden="true"><span class="mp-art"></span></div>
                        <p class="mp-rule">${esc(m.rule)}</p>
                    </div>
                    <ul class="mp-grid">${m.rows.map(rowHtml).join('')}</ul>
                    <div class="mp-legend" aria-hidden="true">
                        <span><i class="mp-key mp-key-best"></i>Best ever</span>
                        <span><i class="mp-key mp-key-now"></i>This run</span>
                    </div>
                    <p class="mp-next">${esc(m.nextText)}</p>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /** Opens the window. Taps inside stopPropagation so Modal's document click handler never sees them. */
    function open(ctx) {
        const overlay = Modal.open(panelHtml(buildModel(ctx)), { dedupeSelector: '.memorial-panel-overlay' });
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            if (btn.dataset.action === 'close') overlay.remove();
        });
    }

    return { buildModel, panelHtml, rowHtml, nextText, open, RULE };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemorialPanel;
}
