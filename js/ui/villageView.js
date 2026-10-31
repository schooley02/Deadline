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
    function inArtBox(rect, naturalW, art, clientX, clientY) {
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) return false;
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

    function spriteHit(img, clientX, clientY) {
        const rect = img.getBoundingClientRect();
        const c = cfg();
        const art = c.VILLAGE_ART_X && c.VILLAGE_ART_X[img.dataset.kind];
        if (!rect.width || !rect.height) return false;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false;
        const a = readAlpha(img);
        if (!a) return inArtBox(rect, img.naturalWidth, art, clientX, clientY);
        const px = Math.min(a.w - 1, Math.max(0, Math.floor((clientX - rect.left) * a.w / rect.width)));
        const py = Math.min(a.h - 1, Math.max(0, Math.floor((clientY - rect.top) * a.h / rect.height)));
        return a.data[(py * a.w + px) * 4 + 3] > HIT_ALPHA;
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
        });
    }

    function clear() {
        if (layerEl) layerEl.textContent = '';
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
            img.style.filter = (slot.back && slot.brightness > 0 && slot.brightness < 1) ? 'brightness(' + slot.brightness + ')' : '';
        });
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

    return { init, render, pickHit, inArtBox };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageView;
}
