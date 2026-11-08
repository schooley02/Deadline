/**
 * TreePanel -- the graveyard tree's own window (2026-11-08, Jeremy: "start the Tree window next", modelled on the Memorial window).
 * Opened by tapping the tree's trunk on the graveyard hill (js/ui/graveyardView.js) and by the "Tree" link at the bottom of the Village
 * panel, which is how a portrait phone reaches it (the graveyard is hidden in the portrait strip).
 *
 * It shows what the tree measures and how far along it is:
 *   - the current stage's picture and "Stage N of 3" with its name (Sapling / Young tree / Giant tree);
 *   - the rule in one line (grows with every night survived across all runs, never shrinks, only Reset Game starts it over);
 *   - the lifetime night total, split into nights banked from finished runs and nights in this run;
 *   - a bar toward the next stage and how many more nights it needs (or that it is fully grown).
 *
 * READ-ONLY and REAL: the caller (script.js openTreePanel) passes the real banked + current nights, never the DEV panel's tree chip or
 * `?treeStage=`, so this window always tells the truth about the save. Nothing here saves, pays or reads State.
 *
 * PURE / DOM split like MemorialPanel: `buildModel` and `panelHtml` are pure and unit-tested (test/treePanel.test.js); `open` is DOM.
 * Globals read at call time: TreeGrowth (js/treeGrowth.js), Modal (open).
 *
 * buildModel(ctx): ctx = {
 *   banked,       nights of finished runs (lifetimeStats.nightsSurvived); bad values count as 0
 *   current,      nights of the run in progress (NightsSurvivedView.countMidnights); counts 0 while the game is over
 *   gameOver,     true while the game-over card is up (that run is already in `banked`)
 *   thresholds    [young at, giant at] (CONFIG.TREE_STAGE_NIGHTS)
 * }
 */
const TreePanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    const STAGES = 3;
    const NAMES = { 1: 'Sapling', 2: 'Young tree', 3: 'Giant tree' };
    const RULE = 'Grows with every night you survive, across all your runs. It never shrinks. Only Reset Game starts it over.';

    function whole(n) {
        return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
    }

    function nightsText(n) {
        return `${n} night${n === 1 ? '' : 's'}`;
    }

    function buildModel(ctx) {
        const c = ctx || {};
        const t = Array.isArray(c.thresholds) ? c.thresholds : [];
        const banked = whole(c.banked);
        const current = c.gameOver ? 0 : whole(c.current);
        const total = TreeGrowth.total(banked, current, false);
        const stage = TreeGrowth.stage(total, t);
        const toNext = TreeGrowth.nightsToNext(total, t);
        const maxed = stage >= STAGES;
        // The bar fills across the CURRENT stage: from where this stage began to where the next begins.
        const young = whole(t[0]) || 30;
        const giant = Math.max(young + 1, whole(t[1]) || 100);
        const from = stage === 1 ? 0 : young;
        const to = stage === 1 ? young : giant;
        const fraction = maxed ? 1 : Math.max(0, Math.min(1, (total - from) / (to - from)));
        return {
            stage,
            stageName: NAMES[stage],
            stages: STAGES,
            maxed,
            total,
            banked,
            current,
            toNext,
            fraction,
            rule: RULE,
            nextText: maxed ? 'The tree is fully grown.' : `${nightsText(toNext)} more to reach ${NAMES[stage + 1]}.`,
        };
    }

    function panelHtml(model) {
        const m = model || { stage: 1, stageName: NAMES[1], stages: STAGES, total: 0, banked: 0, current: 0, fraction: 0, rule: RULE, nextText: '' };
        const pct = Math.round((m.fraction || 0) * 100);
        return `
            <div class="modal-overlay tree-panel-overlay">
                <div class="modal-content tree-panel" role="dialog" aria-label="Tree">
                    <div class="tp-title"><h3>Tree</h3><span class="tp-stage">Stage ${m.stage} of ${m.stages}: ${esc(m.stageName)}</span></div>
                    <div class="tp-head">
                        <div class="tp-sprite" data-stage="${m.stage}" aria-hidden="true"><span class="tp-art"></span></div>
                        <p class="tp-rule">${esc(m.rule)}</p>
                    </div>
                    <dl class="tp-stats">
                        <div class="tp-stat"><dt>Nights survived, all runs</dt><dd>${m.total}</dd></div>
                        <div class="tp-stat"><dt>From finished runs</dt><dd>${m.banked}</dd></div>
                        <div class="tp-stat"><dt>This run</dt><dd>${m.current}</dd></div>
                    </dl>
                    <div class="tp-bar" role="img" aria-label="${esc(m.nextText)}"><span class="tp-bar-fill" style="width:${pct}%"></span></div>
                    <p class="tp-next">${esc(m.nextText)}</p>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /** Opens the window. Taps inside stopPropagation so Modal's document click handler never sees them. */
    function open(ctx) {
        const overlay = Modal.open(panelHtml(buildModel(ctx)), { dedupeSelector: '.tree-panel-overlay' });
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            if (btn.dataset.action === 'close') overlay.remove();
        });
    }

    return { buildModel, panelHtml, open, RULE, NAMES, STAGES };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreePanel;
}
