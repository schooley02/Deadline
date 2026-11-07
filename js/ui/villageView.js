/**
 * VillageView -- DOM half of the achievement village (V7 W2, first slice 2026-10-29). The maths
 * is in js/villageLayout.js (pure, unit-tested); this file only measures the canvas and writes
 * each building's sprite position (Clock tower + Jailhouse + Armory + Radio tower + boxing gym + high school + hospital so far).
 *
 *   #villageLayer   decorative layer inside #gameCanvas (aria-hidden, pointer-events none,
 *                   z-index 1: above the scene layers, UNDER #midnightLine (5), the church's
 *                   hero layers and every zombie (30+)). One <img class="village-sprite">
 *                   one per building, keyed by data-kind, stacked in slot order (z-index = paint
 *                   order, so a building that appears later still lands in the right place). Back-row
 *                   buildings (the Radio tower, the high school, the hospital, the far-row windmill) carry `.village-back` and a brightness filter.
 *                   TAPPABLE (Build 2, 2026-10-30): each sprite has pointer-events auto while the layer stays none; a tap
 *                   is resolved by `pickHit` over every sprite under the finger (topmost first) using an alpha hit-test, so
 *                   transparent corners and a back-row building tucked behind a front one still go to the right building.
 *                   Zombies (z 30+) sit above the layer and keep their own taps.
 *
 * HAZE BY DEPTH (run climate, 2026-11-03; css/climate.css): the layer also holds up to three decorative veils
 *   (`.village-haze--row1|row2|mid`, pointer-events none, so every tap still reaches the sprites and zombies). Each
 *   is z-indexed to the LAST sprite of the row it follows and appended after all the sprites, so it paints over that row
 *   and every row behind it but under the next row forward: row1 over the far row, row2 over the back row (and row 1
 *   again), mid over the whole village. They stop at the horizon (--hz = the front row's feet). Their strength comes from
 *   the --clm-row1/row2/mid vars the weather band sets on #gameCanvas (0 = invisible). See hazePlan().
 *
 * WEATHER WRAPPERS (run climate Build 2): two more decorative wrappers follow the veils, clipped to the canvas, built the same
 *   way (z-index of the row they follow, appended last): `.village-wx--row` (Fog's cloud bank BETWEEN the back and front rows)
 *   and `.village-wx--mid` (Fog's two banks and Storm's rain IN FRONT of the village, over the mid haze). css/climate.css decides
 *   which child shows per band. The horizon is also published as --clm-hz on #gameCanvas so every weather layer can be placed
 *   relative to it (the near layers in index.html use it too).
 *
 * Landscape/desktop only: css/glanceStrip.css hides the layer in the portrait strip, and
 * getHillWidth() is 0 there so nothing is placed. script.js calls render(BASE_WIDTH) after every
 * layout change and every tick; render() is idempotent (a signature of everything it depends on
 * gates the DOM writes).
 *
 * Deps: { getHillWidth: () => px of the graveyard hill (0 in the portrait strip),
 *         getClockTier: () => 1..5 or null (DEV: CONFIG.VILLAGE_DEV_CLOCK_TIER / ?villageTier=),
 *         getJailTier:  () => 1..5 or null (kind `defense`; DEV: CONFIG.VILLAGE_DEV_JAIL_TIER / ?jailTier=; optional),
 *         getArmoryTier: () => 1..5 or null (DEV: CONFIG.VILLAGE_DEV_ARMORY_TIER / ?armoryTier=; optional),
 *         getRadioTier: () => 1..5 or null (kind `nights`; DEV: CONFIG.VILLAGE_DEV_RADIO_TIER / ?radioTier=; optional),
 *         getGymTier: () => 1..5 or null (kind `lurkers`; DEV: CONFIG.VILLAGE_DEV_GYM_TIER / ?gymTier=; optional),
 *         getSchoolTier: () => 1..5 or null (kind `heroes`; DEV: CONFIG.VILLAGE_DEV_SCHOOL_TIER / ?schoolTier=; optional),
 *         getHospitalTier: () => 1..5 or null (kind `habits`; DEV: CONFIG.VILLAGE_DEV_HOSPITAL_TIER / ?hospitalTier=; optional),
 *         getWindmillTier: () => 1..5 or null (kind `bestdays`, FAR row; DEV: CONFIG.VILLAGE_DEV_WINDMILL_TIER / ?windmillTier=; optional),
 *         onOpenBuilding: ({ kind, tier, url, width, height }) => void  (a tap landed on a building; optional) }
 * (Since Build 2 the get<Kind>Tier deps return the REAL tier; the DEV params only override it. See VillageLayout.resolveTier.)
 */
const VillageView = (() => {
    let deps = null;
    let canvasEl = null;
    let layerEl = null;
    let lastSig = null;

    function cfg() {
        return (typeof CONFIG !== 'undefined') ? CONFIG : {};
    }

    const HIT_ALPHA = 16; // 0..255: a pixel counts as part of the building above this alpha
    const HIT_SLOP_PX = 3; // forgiving taps: an opaque pixel within this many art px of the finger counts (thin masts / spokes)

    /**
     * Pure. `candidates` = the sprites under the tap, TOPMOST FIRST; `hitAt(candidate)` = true when the tap lands on a
     * visible pixel of it. Returns the first candidate that is hit, or null (a tap on empty sky / a transparent corner).
     */
    function pickHit(candidates, hitAt) {
        const list = Array.isArray(candidates) ? candidates : [];
        for (let i = 0; i < list.length; i++) {
            if (hitAt(list[i])) return list[i];
        }
        return null;
    }

    /**
     * Pure. Is the point (clientX, clientY) inside the visible-art box of a sprite whose on-screen rect is `rect`
     * and whose authored canvas is naturalW wide? `art` = [x0, x1] in canvas pixels (CONFIG.VILLAGE_ART_X); the whole
     * canvas when absent. Used when the alpha channel cannot be read (file://, tainted canvas).
     */
    function inArtBox(rect, naturalW, art, clientX, clientY, flip) {
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) return false;
        if (flip && Array.isArray(art)) art = [naturalW - art[1], naturalW - art[0]];
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
        const k = naturalW > 0 ? rect.width / naturalW : 1;
        const x0 = rect.left + (Array.isArray(art) ? art[0] : 0) * k;
        const x1 = rect.left + (Array.isArray(art) ? art[1] : naturalW) * k;
        return clientX >= x0 && clientX <= x1;
    }

    const alphaCache = new Map(); // src -> { w, h, data } | null (unreadable)

    function readAlpha(img) {
        const src = img.currentSrc || img.getAttribute('src');
        if (alphaCache.has(src)) return alphaCache.get(src);
        let entry = null;
        try {
            const w = img.naturalWidth, h = img.naturalHeight;
            if (w > 0 && h > 0) {
                const cv = document.createElement('canvas');
                cv.width = w; cv.height = h;
                const ctx = cv.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw new Error('no 2d context');
                ctx.drawImage(img, 0, 0);
                entry = { w, h, data: ctx.getImageData(0, 0, w, h).data };
            }
        } catch (e) {
            entry = null; // tainted canvas: fall back to the art box
        }
        if (entry || img.complete) alphaCache.set(src, entry);
        return entry;
    }

    /**
     * Pure. Is any pixel within `slop` of (px, py) more opaque than `minAlpha`? `data` = RGBA bytes of a w x h image.
     * Forgiving taps: thin far-row art (the radio mast, the windmill spokes) is mostly transparent between its lines.
     */
    function opaqueNear(data, w, h, px, py, slop, minAlpha) {
        const r = Math.max(0, slop | 0);
        for (let y = Math.max(0, py - r); y <= Math.min(h - 1, py + r); y++) {
            for (let x = Math.max(0, px - r); x <= Math.min(w - 1, px + r); x++) {
                if (data[(y * w + x) * 4 + 3] > minAlpha) return true;
            }
        }
        return false;
    }

    function spriteHit(img, clientX, clientY) {
        const rect = img.getBoundingClientRect();
        const c = cfg();
        const art = c.VILLAGE_ART_X && c.VILLAGE_ART_X[img.dataset.kind];
        const flip = img.dataset.flip === '1';
        if (!rect.width || !rect.height) return false;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
        const a = readAlpha(img);
        if (!a) return inArtBox(rect, img.naturalWidth, art, clientX, clientY, flip);
        let px = Math.min(a.w - 1, Math.max(0, Math.floor((clientX - rect.left) * a.w / rect.width)));
        const py = Math.min(a.h - 1, Math.max(0, Math.floor((clientY - rect.top) * a.h / rect.height)));
        if (flip) px = a.w - 1 - px; // the sprite is drawn mirrored; its pixels are not
        return opaqueNear(a.data, a.w, a.h, px, py, HIT_SLOP_PX, HIT_ALPHA);
    }

    function onLayerClick(e) {
        if (!deps || !deps.onOpenBuilding || !layerEl) return;
        const under = (document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [])
            .filter(el => el.classList && el.classList.contains('village-sprite') && layerEl.contains(el));
        const hit = pickHit(under, (img) => spriteHit(img, e.clientX, e.clientY));
        if (!hit) return;
        e.stopPropagation(); // Modal's document click handler would close the card the same click opens
        deps.onOpenBuilding({
            kind: hit.dataset.kind,
            tier: Number(hit.dataset.tier) || 1,
            url: hit.getAttribute('src'),
            width: hit.naturalWidth || 0,
            height: hit.naturalHeight || 0,
            flip: hit.dataset.flip === '1',
        });
    }

    function clear() {
        if (layerEl) layerEl.textContent = '';
        if (canvasEl && canvasEl.style) canvasEl.style.removeProperty('--clm-hz');
    }

    /**
     * Pure. Where the haze veils go for these slots (sorted far -> back -> front, as villageSlots returns them; the sprite at
     * index i gets z-index i). Returns { hz, veils: [{ key, z }] } with veils in paint order:
     *   row1  only when a far-row building exists   z = the far row's last index
     *   row2  only when a back-row building exists  z = the back row's last index
     *   mid   always (when any building exists)     z = the last index (above every sprite)
     * hz = the horizon in canvas px: the front row's feet (else the lowest feet of any slot).
     * wx = the weather wrappers: { key: 'row', z: last back-row index (else last far-row index) } when a rear row exists, then
     * { key: 'mid', z: last index }; same rules as the veils (appended after them, so they win equal z-indexes).
     * left = where the veils start: just inside the church's right edge (baseW - 8; 0 when there is no church width), so the
     * CHURCH is never veiled by the village haze (it sits under #villageLayer in the stacking order; the approved mock has it
     * clear of the row and mid haze). css/climate.css feathers that edge over 32px so there is no hard line.
     */
    function hazePlan(slots, baseW) {
        const list = Array.isArray(slots) ? slots : [];
        const left = (Number(baseW) > 8) ? Math.round(Number(baseW)) - 8 : 0;
        if (!list.length) return { hz: 0, left, veils: [], wx: [] };
        let hz = 0, hzFront = 0, lastFar = -1, lastBack = -1;
        list.forEach((sl, i) => {
            const feet = Number(sl.feetY) || 0;
            if (feet > hz) hz = feet;
            if (sl.row === 'front' && feet > hzFront) hzFront = feet;
            if (sl.row === 'far') lastFar = i;
            if (sl.row === 'back') lastBack = i;
        });
        const veils = [];
        if (lastFar >= 0) veils.push({ key: 'row1', z: lastFar });
        if (lastBack >= 0) veils.push({ key: 'row2', z: lastBack });
        veils.push({ key: 'mid', z: list.length - 1 });
        const wx = [];
        const rear = lastBack >= 0 ? lastBack : lastFar;
        if (rear >= 0) wx.push({ key: 'row', z: rear });
        wx.push({ key: 'mid', z: list.length - 1 });
        return { hz: hzFront || hz, left, veils, wx };
    }

    // Rebuilt on every full render (the sprites above may have been appended since): the veils must be LAST in the DOM so
    // that, at an equal z-index, they paint over the row's sprites.
    const WX_CHILDREN = {
        row: ['fog-bank fog-bank--row1'],
        mid: ['fog-bank fog-bank--mid1', 'fog-bank fog-bank--mid2', 'rain rain--mid'],
    };

    function syncHaze(slots, baseW) {
        Array.from(layerEl.querySelectorAll('.village-haze, .village-wx')).forEach(el => el.remove());
        const plan = hazePlan(slots, baseW);
        if (canvasEl && canvasEl.style) {
            canvasEl.style.setProperty('--clm-hz', plan.hz + 'px');
            canvasEl.style.setProperty('--hz-left', plan.left + 'px'); // the church's right edge: the near haze film stays off the church
        }
        plan.veils.forEach(v => {
            const el = document.createElement('div');
            el.className = 'village-haze village-haze--' + v.key;
            el.style.zIndex = String(v.z);
            el.style.setProperty('--hz', plan.hz + 'px');
            el.style.setProperty('--hz-left', plan.left + 'px');
            layerEl.appendChild(el);
        });
        plan.wx.forEach(w => {
            const el = document.createElement('div');
            el.className = 'village-wx village-wx--' + w.key;
            el.style.zIndex = String(w.z);
            el.style.setProperty('--hz-left', plan.left + 'px');
            (WX_CHILDREN[w.key] || []).forEach(cls => {
                const child = document.createElement('div');
                child.className = cls;
                el.appendChild(child);
            });
            layerEl.appendChild(el);
        });
    }

    function render(baseWidth) {
        if (!deps || !canvasEl || !layerEl) return;
        const c = cfg();
        if (c.VILLAGE_ENABLED === false) { lastSig = 'off'; clear(); return; }
        const opts = VillageLayout.fromConfig(c);
        const hillW = (deps.getHillWidth && deps.getHillWidth()) || 0;
        const canvasW = canvasEl.offsetWidth || 0;
        const canvasH = canvasEl.offsetHeight || 0;
        const baseW = (typeof baseWidth === 'number' ? baseWidth : 0);
        const tiers = {
            punctuality: deps.getClockTier ? deps.getClockTier() : null,
            defense: deps.getJailTier ? deps.getJailTier() : null,
            slain: deps.getArmoryTier ? deps.getArmoryTier() : null,
            nights: deps.getRadioTier ? deps.getRadioTier() : null,
            lurkers: deps.getGymTier ? deps.getGymTier() : null,
            heroes: deps.getSchoolTier ? deps.getSchoolTier() : null,
            habits: deps.getHospitalTier ? deps.getHospitalTier() : null,
            bestdays: deps.getWindmillTier ? deps.getWindmillTier() : null,
        };
        const sig = [hillW, canvasW, canvasH, baseW, tiers.punctuality, tiers.defense, tiers.slain, tiers.nights, tiers.lurkers, tiers.heroes, tiers.habits, tiers.bestdays].join('|');
        if (sig === lastSig) return;
        lastSig = sig;
        const slots = VillageLayout.villageSlots(canvasW, canvasH, baseW, hillW, tiers, opts);
        if (!slots.length) { clear(); return; }
        const keep = new Set(slots.map(sl => sl.kind));
        Array.from(layerEl.querySelectorAll('.village-sprite')).forEach(el => {
            if (!keep.has(el.dataset.kind)) el.remove();
        });
        slots.forEach((slot, order) => {
            let img = Array.from(layerEl.querySelectorAll('.village-sprite')).find(el => el.dataset.kind === slot.kind);
            if (!img) {
                img = document.createElement('img');
                img.className = 'village-sprite village-' + slot.kind;
                img.alt = '';
                img.draggable = false;
                img.dataset.kind = slot.kind;
                layerEl.appendChild(img);
            }
            if (img.getAttribute('src') !== slot.url) img.setAttribute('src', slot.url);
            img.dataset.tier = String(slot.tier);
            img.style.left = slot.left + 'px';
            img.style.top = slot.top + 'px';
            img.style.width = slot.width + 'px';
            img.style.height = slot.height + 'px';
            img.style.zIndex = String(order); // paint order = slot order (back row first, tower last)
            img.classList.toggle('village-back', !!slot.back);
            img.dataset.flip = slot.flip ? '1' : '0';
            img.style.transform = slot.flip ? 'scaleX(-1)' : '';
            img.style.filter = (slot.back && slot.brightness > 0 && slot.brightness < 1) ? 'brightness(' + slot.brightness + ')' : '';
        });
        syncHaze(slots, baseW);
    }

    function init(d) {
        deps = d;
        canvasEl = document.getElementById('gameCanvas');
        layerEl = document.getElementById('villageLayer');
        lastSig = null;
        if (!canvasEl || !layerEl) { deps = null; return; }
        if (!layerEl.dataset.tapWired) {
            layerEl.dataset.tapWired = '1';
            layerEl.addEventListener('click', onLayerClick);
        }
        render();
    }

    return { init, render, pickHit, inArtBox, opaqueNear, hazePlan };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageView;
}
