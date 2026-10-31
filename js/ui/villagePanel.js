/**
 * VillagePanel -- the village overview (2026-10-30). Opened by the HUD village button (`#villageButton`, next to the
 * level button). Lists all eight buildings with their current tier and progress toward the next one; tapping a row
 * opens that building's card (js/ui/villageCard.js) on top, so closing the card returns to the list.
 *
 * It works on every screen: the village scene only shows on landscape/desktop, so on a portrait phone this panel is
 * the only way to see the village's progress.
 *
 * PURE / DOM split like the other UI modules: `buildModel` and `panelHtml` are pure and unit-tested
 * (test/villagePanel.test.js); `open` is DOM and live-checked. Global read at call time: Modal. Building names,
 * units and bar text come from VillageCard so the panel and the cards can never disagree.
 *
 * buildModel(ctx): ctx = {
 *   progress,    VillageProgress.compute(...) -> { [kind]: { tier, value, nextAt, toNext, maxed, fraction } }
 *   spriteFor?   (kind, tier) -> { url, width, height } for the row thumbnail (omit = no thumbnail)
 * }
 */
const VillagePanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    /** Rows follow the card's building list (VillageCard.KINDS key order). */
    function kinds() {
        return Object.keys(VillageCard.KINDS);
    }

    function buildModel(ctx) {
        const c = ctx || {};
        const progress = c.progress || {};
        const rows = kinds().map((kind) => {
            const m = VillageCard.buildModel({ kind, progress: progress[kind] });
            const sprite = (typeof c.spriteFor === 'function') ? c.spriteFor(kind, m.tier) : null;
            return {
                kind,
                name: m.name,
                tier: m.tier,
                maxed: m.maxed,
                fraction: m.fraction,
                barText: m.barText,
                spriteUrl: sprite && sprite.url ? sprite.url : null,
                spriteW: sprite && sprite.width ? sprite.width : 0,
                spriteH: sprite && sprite.height ? sprite.height : 0,
            };
        });
        const tiersTotal = rows.reduce((n, r) => n + r.tier, 0);
        return { rows, tiersTotal, tiersMax: rows.length * VillageCard.MAX_TIER };
    }

    function rowHtml(r) {
        const pct = Math.round(r.fraction * 100);
        const thumb = r.spriteUrl
            ? `<span class="vp-thumb"><img class="vp-sprite" src="${esc(r.spriteUrl)}" alt="" width="${r.spriteW}" height="${r.spriteH}" draggable="false"></span>`
            : '<span class="vp-thumb"></span>';
        return `
            <button type="button" class="vp-row${r.maxed ? ' vp-row--maxed' : ''}" data-action="open" data-kind="${esc(r.kind)}" aria-label="${esc(r.name)}, tier ${r.tier}. ${esc(r.barText)}">
                ${thumb}
                <span class="vp-main">
                    <span class="vp-head"><span class="vp-name">${esc(r.name)}</span>${VillageCard.starsHtml(r.tier, 14)}</span>
                    <span class="vp-bar" aria-hidden="true"><span class="vp-fill" style="width:${pct}%"></span></span>
                    <span class="vp-text">${esc(r.barText)}</span>
                </span>
            </button>`;
    }

    function panelHtml(model) {
        const m = model || { rows: [], tiersTotal: 0, tiersMax: 0 };
        return `
            <div class="modal-overlay village-panel-overlay">
                <div class="modal-content village-panel" role="dialog" aria-label="Village">
                    <div class="vp-title"><h3>Village</h3><span class="vp-total">${m.tiersTotal} / ${m.tiersMax} tiers</span></div>
                    <div class="vp-list">${m.rows.map(rowHtml).join('')}</div>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /**
     * ctx: buildModel's ctx plus `onOpenBuilding(kind)`. The panel stays open under the building card. Taps inside
     * stopPropagation so Modal's document click handler never sees them.
     */
    function open(ctx) {
        const model = buildModel(ctx);
        const overlay = Modal.open(panelHtml(model), { dedupeSelector: '.village-panel-overlay' });
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            if (btn.dataset.action === 'close') { overlay.remove(); return; }
            if (btn.dataset.action === 'open' && ctx && typeof ctx.onOpenBuilding === 'function') ctx.onOpenBuilding(btn.dataset.kind);
        });
    }

    // ---- Peak strip (Village Build 3, 2026-10-30) ----
    // Eight thumbnails, one per building, at the tier a finished run reached. Used by the game-over card and the
    // past-run cards in Stats. `tiers` is a run record's peakVillageTiers ({ kind: 1..5 }); anything else (an older
    // record, no data) returns '' so callers can drop it in unconditionally.
    function validTier(t) { return Number.isInteger(t) && t >= 1 && t <= 5; }

    function peakTotal(tiers) {
        if (!tiers || typeof tiers !== 'object') return 0;
        return kinds().reduce((n, k) => n + (validTier(tiers[k]) ? tiers[k] : 1), 0);
    }

    // Default sprite source: the same helper script.js hands the panel (VillageLayout size + URL), read from globals.
    function defaultSpriteFor(kind, tier) {
        if (typeof VillageLayout === 'undefined' || typeof CONFIG === 'undefined') return null;
        const size = VillageLayout.sizeOf(kind, VillageLayout.fromConfig(CONFIG));
        return { url: VillageLayout.spriteUrl(kind, tier), width: size[0], height: size[1] };
    }

    function peakStripHtml(tiers, ctx) {
        if (!tiers || typeof tiers !== 'object' || !kinds().some((k) => validTier(tiers[k]))) return '';
        const c = ctx || {};
        const spriteFor = typeof c.spriteFor === 'function' ? c.spriteFor : defaultSpriteFor;
        const label = c.label === undefined ? 'Village at its peak' : c.label;
        const cells = kinds().map((kind) => {
            const tier = validTier(tiers[kind]) ? tiers[kind] : 1;
            const name = VillageCard.KINDS[kind].name;
            const sprite = spriteFor(kind, tier);
            const img = sprite && sprite.url
                ? `<img class="vps-sprite" src="${esc(sprite.url)}" alt="" draggable="false">`
                : '';
            return `<li class="vps-cell" title="${esc(name)} -- Tier ${tier}"><span class="vps-thumb">${img}</span><span class="vps-tier">\u2605${tier}</span></li>`;
        }).join('');
        const max = kinds().length * VillageCard.MAX_TIER;
        const head = label === ''
            ? ''
            : `<div class="vps-head"><span class="vps-label">${esc(label)}</span><span class="vps-total">${peakTotal(tiers)} / ${max} tiers</span></div>`;
        return `<div class="village-peak-strip">${head}<ul class="vps-list">${cells}</ul></div>`;
    }

    return { kinds, buildModel, rowHtml, panelHtml, open, peakTotal, peakStripHtml };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillagePanel;
}
