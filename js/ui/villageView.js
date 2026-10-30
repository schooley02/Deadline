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
 *                   buildings (the Radio tower, the high school, the hospital) carry `.village-back` and a brightness filter. Not
 *                   tappable yet (the close-up view is a later step).
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
 *         getHospitalTier: () => 1..5 or null (kind `habits`; DEV: CONFIG.VILLAGE_DEV_HOSPITAL_TIER / ?hospitalTier=; optional) }
 */
const VillageView = (() => {
    let deps = null;
    let canvasEl = null;
    let layerEl = null;
    let lastSig = null;

    function cfg() {
        return (typeof CONFIG !== 'undefined') ? CONFIG : {};
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
        };
        const sig = [hillW, canvasW, canvasH, baseW, tiers.punctuality, tiers.defense, tiers.slain, tiers.nights, tiers.lurkers, tiers.heroes, tiers.habits].join('|');
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
        render();
    }

    return { init, render };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VillageView;
}
