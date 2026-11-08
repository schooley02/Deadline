/**
 * DevPanel -- the DEV button and its demo panel (Jeremy, 2026-11-03; ROADMAP "Dev '+' demo button"). DOM half of js/devDemo.js.
 *
 * The button: a small amber dashed "DEV +" at the bottom-LEFT of the screen (the add-task "+" is the round green one on the
 * right), shown only while the Settings "Developer tools" switch is on. A small dot on it means a demo is active, so the sky
 * or the village you are looking at is not the real one.
 *
 * The panel: a compact card docked above the button, with NO backdrop and no focus trap, on purpose: the whole point is to
 * watch the sky / village change while you tap, so nothing may dim or cover the scene. It is not a Modal overlay. Sections:
 * Weather (Real / Clear / Hazy / Overcast / Fog / Storm + Steady / Up / Down trend), Village stars (Real / 1..5 for all eight
 * buildings), Graveyard monument (Real / 1..5, the Memorial obelisk on its own) and Graveyard tree (Real / 1 Sapling / 2 Young / 3 Giant), Church (Real / 100 / 75 / 50 / 25 / 0 = the damage picture + its idle animation, plus a Hit button that plays the
 * flash + shake once; ART ONLY, no health or stat changes) and Reset. Every choice goes through DevDemo (in-memory only; see its header); this file only draws and wires.
 *
 * Every click inside the button / panel stopPropagation()s: Modal's outside-click dismiss is a bubbling document handler and
 * would otherwise close whatever window is open underneath.
 *
 * Pure parts (panelModel, panelHtml) are exported for tests. Deps: { demo (DevDemo, defaults to the global), onDemoChange?: () => void, onHit?: () => void }.
 */
const DevPanel = (() => {
    const BAND_LABELS = { clear: 'Clear', hazy: 'Hazy', overcast: 'Overcast', fog: 'Fog', storm: 'Storm' };
    const TREND_LABELS = { steady: 'Steady', up: 'Up', down: 'Down' };
    const TREE_LABELS = { 1: '1 Sapling', 2: '2 Young', 3: '3 Giant' };

    /** Pure. A DevDemo snapshot -> what the panel shows: option lists with a `selected` flag each. */
    function panelModel(snap, bands, trends, tiers, churchStates, memorialStages, treeStages) {
        const s = snap || {};
        const bandList = bands || ['clear', 'hazy', 'overcast', 'fog', 'storm'];
        const trendList = trends || ['steady', 'up', 'down'];
        const tierList = tiers || [1, 2, 3, 4, 5];
        const churchList = churchStates || [100, 75, 50, 25, 0];
        const memorialList = memorialStages || [1, 2, 3, 4, 5];
        const treeList = treeStages || [1, 2, 3];
        const weatherOn = !!s.band;
        return {
            bands: [{ value: 'real', label: 'Real', selected: !s.band }]
                .concat(bandList.map((b) => ({ value: b, label: BAND_LABELS[b] || b, selected: s.band === b }))),
            trends: trendList.map((t) => ({ value: t, label: TREND_LABELS[t] || t, selected: weatherOn && (s.trend || 'steady') === t, disabled: !weatherOn })),
            tiers: [{ value: 'real', label: 'Real', selected: s.tier == null }]
                .concat(tierList.map((n) => ({ value: String(n), label: n + '★', selected: s.tier === n }))),
            church: [{ value: 'real', label: 'Real', selected: s.church == null }]
                .concat(churchList.map((n) => ({ value: String(n), label: String(n), selected: s.church === n }))),
            memorial: [{ value: 'real', label: 'Real', selected: s.memorial == null }]
                .concat(memorialList.map((n) => ({ value: String(n), label: String(n), selected: s.memorial === n }))),
            tree: [{ value: 'real', label: 'Real', selected: s.tree == null }]
                .concat(treeList.map((n) => ({ value: String(n), label: TREE_LABELS[n] || String(n), selected: s.tree === n }))),
            active: !!s.active,
        };
    }

    function esc(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function chips(list, attr) {
        return list.map((o) => '<button type="button" class="dev-chip' + (o.selected ? ' dev-chip--on' : '') + '" ' + attr + '="' + esc(o.value) + '"'
            + ' aria-pressed="' + (o.selected ? 'true' : 'false') + '"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.label) + '</button>').join('');
    }

    /** Pure. The panel's inner markup for a model. */
    function panelHtml(model) {
        return ''
            + '<div class="dev-panel-head"><strong>Dev tools</strong>'
            + '<button type="button" class="dev-panel-close" data-dev-close aria-label="Close dev tools">×</button></div>'
            + '<div class="dev-panel-body">'
            + '<section class="dev-section"><h4>Weather</h4>'
            + '<div class="dev-chips" role="group" aria-label="Weather band">' + chips(model.bands, 'data-dev-band') + '</div>'
            + '<div class="dev-chips dev-chips--sub" role="group" aria-label="Weather trend"><span class="dev-chips-label">Trend</span>' + chips(model.trends, 'data-dev-trend') + '</div>'
            + '</section>'
            + '<section class="dev-section"><h4>Village stars</h4>'
            + '<div class="dev-chips" role="group" aria-label="Star level for every building">' + chips(model.tiers, 'data-dev-tier') + '</div>'
            + '</section>'
            + '<section class="dev-section"><h4>Graveyard monument</h4>'
            + '<div class="dev-chips" role="group" aria-label="Memorial obelisk stage">' + chips(model.memorial, 'data-dev-memorial') + '</div>'
            + '</section>'
            + '<section class="dev-section"><h4>Graveyard tree</h4>'
            + '<div class="dev-chips" role="group" aria-label="Graveyard tree stage">' + chips(model.tree, 'data-dev-tree') + '</div>'
            + '</section>'
            + '<section class="dev-section"><h4>Church (picture only)</h4>'
            + '<div class="dev-chips" role="group" aria-label="Church damage picture">' + chips(model.church, 'data-dev-church')
            + '<button type="button" class="dev-chip dev-chip--action" data-dev-hit aria-label="Play a hit on the church">Hit</button></div>'
            + '</section>'
            + '</div>'
            + '<div class="dev-panel-foot"><button type="button" class="dev-reset" data-dev-reset' + (model.active ? '' : ' disabled') + '>Reset demos</button>'
            + '<span class="dev-note">Preview only. Nothing here is saved.</span>'
            + '<span class="dev-portrait-hint">The sky and village show in landscape.</span></div>';
    }

    let deps = null;
    let demo = null;
    let buttonEl = null;
    let panelEl = null;
    let unsubscribe = null;
    let open = false;

    function render() {
        if (!demo || !buttonEl || !panelEl) return;
        const snap = demo.snapshot();
        const model = panelModel(snap, demo.BANDS, demo.TRENDS, demo.TIERS, demo.CHURCH_STATES, demo.MEMORIAL_STAGES, demo.TREE_STAGES);
        panelEl.innerHTML = panelHtml(model);
        buttonEl.classList.toggle('dev-button--active', model.active);
        buttonEl.setAttribute('aria-label', model.active ? 'Developer tools (a demo is active)' : 'Developer tools');
    }

    function setOpen(next) {
        open = !!next && !!(demo && demo.snapshot().enabled);
        if (panelEl) panelEl.hidden = !open;
        if (buttonEl) {
            buttonEl.setAttribute('aria-expanded', open ? 'true' : 'false');
            buttonEl.classList.toggle('dev-button--open', open);
        }
        if (open) render();
    }

    function onPanelClick(e) {
        e.stopPropagation();
        const t = e.target && e.target.closest ? e.target.closest('button') : null;
        if (!t || t.disabled) return;
        if (t.hasAttribute('data-dev-close')) { setOpen(false); return; }
        if (t.hasAttribute('data-dev-band')) demo.setBand(t.getAttribute('data-dev-band'));
        else if (t.hasAttribute('data-dev-trend')) demo.setTrend(t.getAttribute('data-dev-trend'));
        else if (t.hasAttribute('data-dev-tier')) demo.setTier(t.getAttribute('data-dev-tier'));
        else if (t.hasAttribute('data-dev-church')) demo.setChurch(t.getAttribute('data-dev-church'));
        else if (t.hasAttribute('data-dev-memorial')) demo.setMemorial(t.getAttribute('data-dev-memorial'));
        else if (t.hasAttribute('data-dev-tree')) demo.setTree(t.getAttribute('data-dev-tree'));
        else if (t.hasAttribute('data-dev-hit')) {
            if (deps && typeof deps.onHit === 'function') {
                try { deps.onHit(); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: dev church hit failed', err); }
            }
        }
        else if (t.hasAttribute('data-dev-reset')) demo.reset();
    }

    /** Show / hide the button to match the Settings switch (and turn the demo state on / off with it). */
    function setEnabled(on) {
        if (!demo) return;
        demo.setEnabled(on === true);
        const enabled = demo.snapshot().enabled;
        if (buttonEl) buttonEl.hidden = !enabled;
        if (!enabled) setOpen(false);
        render();
    }

    function init(d) {
        deps = d || {};
        demo = deps.demo || (typeof DevDemo !== 'undefined' ? DevDemo : null);
        if (!demo || typeof document === 'undefined' || !document.body) return;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        if (buttonEl && buttonEl.parentNode) buttonEl.parentNode.removeChild(buttonEl);
        if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
        open = false;

        buttonEl = document.createElement('button');
        buttonEl.type = 'button';
        buttonEl.id = 'devButton';
        buttonEl.className = 'dev-button';
        buttonEl.hidden = true;
        buttonEl.setAttribute('aria-haspopup', 'true');
        buttonEl.setAttribute('aria-expanded', 'false');
        buttonEl.innerHTML = '<span class="dev-button-text">DEV</span><span class="dev-button-plus" aria-hidden="true">+</span><span class="dev-button-dot" aria-hidden="true"></span>';
        buttonEl.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!open); });

        panelEl = document.createElement('div');
        panelEl.id = 'devPanel';
        panelEl.className = 'dev-panel';
        panelEl.hidden = true;
        panelEl.setAttribute('role', 'region');
        panelEl.setAttribute('aria-label', 'Developer tools');
        panelEl.addEventListener('click', onPanelClick);

        document.body.appendChild(panelEl);
        document.body.appendChild(buttonEl);

        unsubscribe = demo.onChange(() => {
            render();
            if (typeof deps.onDemoChange === 'function') {
                try { deps.onDemoChange(); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: dev demo refresh failed', err); }
            }
        });
        render();
    }

    return { panelModel, panelHtml, init, setEnabled, isOpen: () => open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevPanel;
}
