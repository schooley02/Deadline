/**
 * MarkerPanel -- the window behind the milestone markers on the graveyard hill (2026-11-08, Jeremy: every marker opens ONE window that lists them all,
 * with the one he tapped highlighted). Modelled on TreePanel / MemorialPanel. Opened by tapping any marker (js/ui/graveyardView.js) and by the link at the
 * bottom of the Village panel, which is how a portrait phone reaches it (the graveyard is hidden in the portrait strip).
 *
 * One row per all-time achievement: the marker's picture at 2x, its name, the tier it has reached (or "No badge yet"), a bar toward the next tier and
 * the progress in words ("42 of 50 tasks to reach Gold."), or that it is at the top tier.
 *
 * READ-ONLY and REAL: the caller (script.js openMarkerPanel) passes the real unlocked tiers and lifetime stats, never the DEV panel's marker chips or
 * `?markers=`, so this window always tells the truth about the save. Nothing here saves, pays or reads State.
 *
 * PURE / DOM split like TreePanel: `buildModel` and `panelHtml` are pure and unit-tested (test/markerPanel.test.js); `open` is DOM.
 * Globals read at call time: MilestoneMarkers (js/milestoneMarkers.js), Theme (js/theme.js, every player-facing word), Modal (open).
 *
 * buildModel(ctx): ctx = { catalog, ids, unlocked, stats, selected }   (selected = the tapped marker's id, or null)
 */
const MarkerPanel = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    function words() {
        return Theme.strings.markers;
    }

    function unitText(unit, n) {
        if (!unit) return n === 1 ? 'point' : 'points';
        return n === 1 ? unit : unit + 's';
    }

    function rowModel(m, selected) {
        const t = words();
        const tierText = m.tierLabel || t.noBadge;
        const text = m.maxed
            ? Theme.fill(t.maxed, { tier: m.tierLabel || '' }).trim()
            : Theme.fill(t.progress, { value: m.value, threshold: m.threshold, unit: unitText(m.unit, m.threshold), tier: m.nextLabel || '' });
        return {
            id: m.id,
            name: m.name,
            stage: m.stage,
            tierText,
            maxed: m.maxed,
            fraction: m.fraction,
            text,
            selected: selected != null && m.id === selected,
        };
    }

    function buildModel(ctx) {
        const c = ctx || {};
        const markers = MilestoneMarkers.build({ catalog: c.catalog, ids: c.ids, unlocked: c.unlocked, stats: c.stats });
        const rows = markers.map(m => rowModel(m, c.selected));
        const earned = rows.filter(r => r.stage >= 1).length;
        return { title: words().paneTitle, rule: words().rule, rows, earned, total: rows.length };
    }

    function rowHtml(r) {
        const pct = Math.round((r.fraction || 0) * 100);
        return `
            <li class="mkp-row${r.selected ? ' mkp-row--selected' : ''}${r.maxed ? ' mkp-row--maxed' : ''}" data-marker="${esc(r.id)}" data-stage="${r.stage}"${r.selected ? ' aria-current="true"' : ''}>
                <span class="mkp-sprite" aria-hidden="true"><span class="mkp-art" data-stage="${r.stage}"></span></span>
                <span class="mkp-main">
                    <span class="mkp-head"><span class="mkp-name">${esc(r.name)}</span><span class="mkp-tier">${esc(r.tierText)}</span></span>
                    <span class="mkp-bar" role="img" aria-label="${esc(r.text)}"><span class="mkp-bar-fill" style="width:${pct}%"></span></span>
                    <span class="mkp-text">${esc(r.text)}</span>
                </span>
            </li>`;
    }

    function panelHtml(model) {
        const m = model || { title: '', rule: '', rows: [], earned: 0, total: 0 };
        return `
            <div class="modal-overlay marker-panel-overlay">
                <div class="modal-content marker-panel" role="dialog" aria-label="${esc(m.title)}">
                    <div class="mkp-title"><h3>${esc(m.title)}</h3><span class="mkp-total">${m.earned} / ${m.total} earned</span></div>
                    <p class="mkp-rule">${esc(m.rule)}</p>
                    <ul class="mkp-list">${m.rows.map(rowHtml).join('')}</ul>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /** Opens the window. Taps inside stopPropagation so Modal's document click handler never sees them. */
    function open(ctx) {
        const overlay = Modal.open(panelHtml(buildModel(ctx)), { dedupeSelector: '.marker-panel-overlay' });
        if (!overlay) return;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            if (btn.dataset.action === 'close') overlay.remove();
        });
        const picked = overlay.querySelector ? overlay.querySelector('.mkp-row--selected') : null;
        if (picked && picked.scrollIntoView) picked.scrollIntoView({ block: 'nearest' });
    }

    return { buildModel, panelHtml, open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkerPanel;
}
