/**
 * DevPanel -- the DEV button and its demo panel (Jeremy, 2026-11-03; ROADMAP "Dev '+' demo button"). DOM half of js/devDemo.js.
 *
 * The button: a small amber dashed "DEV +" at the bottom-LEFT of the screen (the add-task "+" is the round green one on the
 * right), shown only while the Settings "Developer tools" switch is on. A small dot on it means a demo is active, so the sky
 * or the village you are looking at is not the real one.
 *
 * The panel: a compact card docked above the button, with NO backdrop and no focus trap, on purpose: the whole point is to
 * watch the sky / village change while you tap, so nothing may dim or cover the scene. It is not a Modal overlay. Sections:
 * Weather (Real / Clear / Hazy / Overcast / Fog / Storm), Village stars (Real / 1..5 for all eight
 * buildings), Graveyard monument (Real / 1..5, the Memorial obelisk on its own) and Graveyard tree (Real / 1 Sapling / 2 Young / 3 Giant), Graveyard headstones (Real / 0 Cross .. 4 Platinum, every milestone marker at that stage), Church (Real / 100 / 75 / 50 / 25 / 0 = the damage picture + its idle animation, plus a Hit button that plays the
 * flash + shake once; ART ONLY, no health or stat changes), Ice (Iced / Thawing / Burst: shows the ice art on every zombie on screen, ART ONLY: see icePreview) Buzz (Normal / Heavy / Massive: plays the completion thump + vibration at that size, 2026-11-11; nothing saved) and Reset. Every choice goes through DevDemo (in-memory only; see its header); this file only draws and wires.
 *
 * Every click inside the button / panel stopPropagation()s: Modal's outside-click dismiss is a bubbling document handler and
 * would otherwise close whatever window is open underneath.
 *
 * Pure parts (panelModel, panelHtml) are exported for tests. Deps: { demo (DevDemo, defaults to the global), onDemoChange?: () => void, onHit?: () => void, onBuzz?: (tier) => void }.
 */
const DevPanel = (() => {
    const BAND_LABELS = { clear: 'Clear', hazy: 'Hazy', overcast: 'Overcast', fog: 'Fog', storm: 'Storm' };
    const TREE_LABELS = { 1: '1 Sapling', 2: '2 Young', 3: '3 Giant' };
    const ICE_LABELS = { iced: 'Iced', thawing: 'Thawing', burst: 'Burst' };
    const MARKER_LABELS = { 0: '0 Cross', 1: '1 Bronze', 2: '2 Silver', 3: '3 Gold', 4: '4 Platinum' };

    /** Pure. A DevDemo snapshot -> what the panel shows: option lists with a `selected` flag each. */
    function panelModel(snap, bands, tiers, churchStates, memorialStages, treeStages, markerStages) {
        const s = snap || {};
        const bandList = bands || ['clear', 'hazy', 'overcast', 'fog', 'storm'];
        const tierList = tiers || [1, 2, 3, 4, 5];
        const churchList = churchStates || [100, 75, 50, 25, 0];
        const memorialList = memorialStages || [1, 2, 3, 4, 5];
        const treeList = treeStages || [1, 2, 3];
        const markerList = markerStages || [0, 1, 2, 3, 4];
        return {
            bands: [{ value: 'real', label: 'Real', selected: !s.band }]
                .concat(bandList.map((b) => ({ value: b, label: BAND_LABELS[b] || b, selected: s.band === b }))),
            tiers: [{ value: 'real', label: 'Real', selected: s.tier == null }]
                .concat(tierList.map((n) => ({ value: String(n), label: n + '★', selected: s.tier === n }))),
            church: [{ value: 'real', label: 'Real', selected: s.church == null }]
                .concat(churchList.map((n) => ({ value: String(n), label: String(n), selected: s.church === n }))),
            memorial: [{ value: 'real', label: 'Real', selected: s.memorial == null }]
                .concat(memorialList.map((n) => ({ value: String(n), label: String(n), selected: s.memorial === n }))),
            tree: [{ value: 'real', label: 'Real', selected: s.tree == null }]
                .concat(treeList.map((n) => ({ value: String(n), label: TREE_LABELS[n] || String(n), selected: s.tree === n }))),
            markers: [{ value: 'real', label: 'Real', selected: s.markers == null }]
                .concat(markerList.map((n) => ({ value: String(n), label: MARKER_LABELS[n] || String(n), selected: s.markers === n }))),
            ice: [{ value: 'real', label: 'Real', selected: !s.ice }]
                .concat(['iced', 'thawing', 'burst'].map((p) => ({ value: p, label: ICE_LABELS[p], selected: s.ice === p }))),
            active: !!s.active || !!s.ice,
        };
    }

    /**
     * The Ice section's preview (2026-11-10, Jeremy: quick buttons to test freezing, thawing and the burst). ART ONLY, like Hit:
     * it puts the ice look on every zombie currently on screen via IceOverlay + the same `.enemy-iced` / `.enemy-thawing` classes
     * the loop uses, and touches no item, timer, budget (`iceUsedMs`), save or record. 'iced' = form once, then hold (Burst, then
     * Iced replays the form); 'thawing' = the cracked frame (+ the wiggle and drips); 'burst' = the thaw: an iced zombie bursts
     * now, a bare one forms first and bursts when the form is done. 'real' (the Real chip, Reset, switching the dev tools off) =
     * take the preview off and put every zombie back as the game had it (a really iced zombie gets its ice back). `icePhase` is
     * the chip that shows as selected. Returns how many zombies it touched.
     */
    let icePhase = null;
    const iceOrig = new WeakMap();   // el -> 'iced' | 'thawing' | null, as the game had it when the preview first touched it
    const iceTimers = new Set();

    function icePreview(phase, root) {
        const doc = root || (typeof document !== 'undefined' ? document : null);
        const Overlay = typeof IceOverlay !== 'undefined' ? IceOverlay : null;
        if (!doc || !Overlay || (phase !== 'real' && phase !== 'iced' && phase !== 'thawing' && phase !== 'burst')) return 0;
        iceTimers.forEach((t) => clearTimeout(t));
        iceTimers.clear();
        const els = Array.prototype.slice.call(doc.querySelectorAll('.enemy:not(.enemy-dying)'));
        els.forEach((el) => {
            if (!iceOrig.has(el)) iceOrig.set(el, el.classList.contains('enemy-thawing') ? 'thawing' : (el.classList.contains('enemy-iced') ? 'iced' : null));
            const setClasses = (p) => {
                el.classList.toggle('enemy-iced', p === 'iced');
                el.classList.toggle('enemy-thawing', p === 'thawing');
            };
            if (phase === 'real') {
                const ov = Overlay.get(el);
                if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
                const orig = iceOrig.get(el);
                setClasses(orig);
                if (orig) Overlay.sync(el, orig);
                iceOrig.delete(el);
            } else if (phase === 'burst') {
                const burstNow = () => { Overlay.sync(el, null); setClasses(null); };
                if (Overlay.get(el)) burstNow();
                else {
                    setClasses('iced');
                    Overlay.sync(el, 'iced');
                    iceTimers.add(setTimeout(burstNow, (Overlay.FORM_MS || 480) + 450));
                }
            } else {
                setClasses(phase);
                Overlay.sync(el, phase);
            }
        });
        icePhase = phase === 'real' ? null : phase;
        return els.length;
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
            + '<section class="dev-section"><h4>Graveyard headstones</h4>'
            + '<div class="dev-chips" role="group" aria-label="Headstone stage for every marker">' + chips(model.markers, 'data-dev-markers') + '</div>'
            + '</section>'
            + '<section class="dev-section"><h4>Ice (zombies on screen, picture only)</h4>'
            + '<div class="dev-chips" role="group" aria-label="Ice preview on every zombie on screen">' + chips(model.ice, 'data-dev-ice') + '</div>'
            + '</section>'
            + '<section class="dev-section"><h4>Buzz (the completion thump + vibration)</h4>'
            + '<div class="dev-chips" role="group" aria-label="Play the completion buzz at each size">'
            + '<button type="button" class="dev-chip dev-chip--action" data-dev-buzz="normal" aria-label="Play the normal buzz">Normal</button>'
            + '<button type="button" class="dev-chip dev-chip--action" data-dev-buzz="heavy" aria-label="Play the heavy buzz">Heavy</button>'
            + '<button type="button" class="dev-chip dev-chip--action" data-dev-buzz="massive" aria-label="Play the massive buzz">Massive</button></div>'
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
        const snap = Object.assign({}, demo.snapshot(), { ice: icePhase });
        const model = panelModel(snap, demo.BANDS, demo.TIERS, demo.CHURCH_STATES, demo.MEMORIAL_STAGES, demo.TREE_STAGES, demo.MARKER_STAGES);
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
        else if (t.hasAttribute('data-dev-tier')) demo.setTier(t.getAttribute('data-dev-tier'));
        else if (t.hasAttribute('data-dev-church')) demo.setChurch(t.getAttribute('data-dev-church'));
        else if (t.hasAttribute('data-dev-memorial')) demo.setMemorial(t.getAttribute('data-dev-memorial'));
        else if (t.hasAttribute('data-dev-tree')) demo.setTree(t.getAttribute('data-dev-tree'));
        else if (t.hasAttribute('data-dev-markers')) demo.setMarkers(t.getAttribute('data-dev-markers'));
        else if (t.hasAttribute('data-dev-ice')) {
            try { icePreview(t.getAttribute('data-dev-ice')); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: dev ice preview failed', err); }
            render();
        }
        else if (t.hasAttribute('data-dev-hit')) {
            if (deps && typeof deps.onHit === 'function') {
                try { deps.onHit(); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: dev church hit failed', err); }
            }
        }
        else if (t.hasAttribute('data-dev-buzz')) {
            if (deps && typeof deps.onBuzz === 'function') {
                try { deps.onBuzz(t.getAttribute('data-dev-buzz')); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: dev buzz failed', err); }
            }
        }
        else if (t.hasAttribute('data-dev-reset')) {
            try { icePreview('real'); } catch (err) { if (typeof console !== 'undefined') console.error('Deadline: dev ice reset failed', err); }
            demo.reset();
            render();
        }
    }

    /** Show / hide the button to match the Settings switch (and turn the demo state on / off with it). */
    function setEnabled(on) {
        if (!demo) return;
        demo.setEnabled(on === true);
        const enabled = demo.snapshot().enabled;
        if (buttonEl) buttonEl.hidden = !enabled;
        if (!enabled) { try { icePreview('real'); } catch (err) { /* nothing to restore */ } setOpen(false); }
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

    return { panelModel, panelHtml, icePreview, init, setEnabled, isOpen: () => open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DevPanel;
}
