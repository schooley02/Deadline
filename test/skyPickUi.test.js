/**
 * @jest-environment jsdom
 *
 * Sky picker UI (W1c + the 2026-11-09 amendment): the paintbrush "set" mark, the panel's "Sky set to X . your run is Y" line, "Show my
 * real sky", the picker rows (locked / unlocked / Clear gating), the sky-change toast, press-and-hold peek, and ClimateView's key + peek.
 */
const RunClimate = require('../js/runClimate.js');
global.Modal = require('../js/ui/modal.js');
global.HowItWorks = require('../js/ui/howItWorks.js');
global.Theme = require('../js/theme.js');
const SkyPick = require('../js/skyPick.js');
const WeatherPanel = require('../js/ui/weatherPanel.js');
const ClimateView = require('../js/ui/climateView.js');

const real = (band, extra) => Object.assign({
    band, bandIndex: RunClimate.BANDS.indexOf(band), score: 0.6, trend: 'steady', scoredDays: 7, usedPrior: false,
    recent: [{ date: '2026-11-02', score: 0.8, onTime: 0.9, habits: 0.5, church: 1, damage: 0 }],
}, extra);
const picked = (realBand, pickBand) => SkyPick.resolve(real(realBand), pickBand, true).result;

describe('view model with a pick', () => {
    test('describes the REAL band and names the picked one', () => {
        const vm = WeatherPanel.buildViewModel(picked('hazy', 'storm'));
        expect(vm.band).toBe('hazy');
        expect(vm.label).toBe('Hazy');
        expect(vm.line).toBe(WeatherPanel.BAND_INFO.hazy.line);
        expect(vm.pick).toEqual({ band: 'storm', label: 'Storm' });
        expect(vm.setLine).toBe('Sky set to Storm · your run is Hazy');
        expect(vm.rows).toHaveLength(1); // the real days
    });
    test('no pick: unchanged (pick null, no set line)', () => {
        const vm = WeatherPanel.buildViewModel(real('fog'));
        expect(vm.pick).toBeNull();
        expect(vm.setLine).toBe('');
    });
    test('the badge label says the sky is set', () => {
        expect(WeatherPanel.badgeLabel(WeatherPanel.buildViewModel(picked('hazy', 'storm'))))
            .toBe('Weather: Hazy. Your sky is set to Storm. Tap for details.');
    });
});

describe('panel markup', () => {
    const unlocked = (extra) => Object.assign({ unlocked: true, pick: null, realBand: 'hazy' }, extra);

    test('a pick shows the set line, the paintbrush and the "Show my real sky" button; no pick shows none of them', () => {
        const withPick = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(picked('hazy', 'storm')), WeatherPanel.pickerModel(unlocked({ pick: 'storm' })));
        expect(withPick).toContain('Sky set to Storm · your run is Hazy');
        expect(withPick).toContain('class="wx-real-btn" data-sky-pick="follow">Show my real sky</button>');
        expect(withPick).toContain('wx-set-brush');
        const without = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(real('hazy')), WeatherPanel.pickerModel(unlocked()));
        expect(without).not.toContain('Show my real sky');
        expect(without).not.toContain('wx-set-brush');
    });

    test('the picker lists Follow + the five bands; Clear is disabled unless the run is Clear; the pick in force is pressed', () => {
        const pm = WeatherPanel.pickerModel(unlocked({ pick: 'fog' }));
        expect(pm.options.map(o => o.key)).toEqual(['follow', 'clear', 'hazy', 'overcast', 'fog', 'storm']);
        expect(pm.options.find(o => o.key === 'clear').disabled).toBe(true);
        expect(pm.options.filter(o => o.key !== 'clear').every(o => !o.disabled)).toBe(true);
        expect(pm.options.filter(o => o.selected).map(o => o.key)).toEqual(['fog']);
        expect(WeatherPanel.pickerModel(unlocked({ realBand: 'clear' })).options.find(o => o.key === 'clear').disabled).toBe(false);
        expect(WeatherPanel.pickerModel(unlocked()).options.find(o => o.key === 'follow').selected).toBe(true);
        const html = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(real('hazy')), pm);
        expect(html).toContain('data-sky-pick="clear" aria-pressed="false" disabled');
        expect(html).toContain('data-sky-pick="fog" aria-pressed="true"');
        expect(html).toContain('You control the weather (visuals only)');
    });

    test('before Lv 4 the picker is a locked line naming the level, with no buttons', () => {
        const pm = WeatherPanel.pickerModel({ unlocked: false, unlockLevel: 4 });
        expect(pm.unlocked).toBe(false);
        expect(pm.lockedLine).toBe('Geo Storm unlocks at Lv 4: You control the weather (visuals only).');
        const html = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(real('hazy')), pm);
        expect(html).toContain('wx-locked');
        expect(html).not.toContain('data-sky-pick');
    });

    test('a dev-forced sky hides the picker (the dev sky wins)', () => {
        const html = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(real('fog', { forced: true })), WeatherPanel.pickerModel(unlocked()));
        expect(html).not.toContain('wx-picker');
    });

    test('Stats readout carries the set line when a sky is picked', () => {
        expect(WeatherPanel.statsHtml(WeatherPanel.buildViewModel(picked('hazy', 'storm')))).toContain('Sky set to Storm');
        expect(WeatherPanel.statsHtml(WeatherPanel.buildViewModel(real('hazy')))).not.toContain('Sky set to');
    });
});

describe('badge, picker clicks, toast and hold-to-peek in the DOM', () => {
    let current;
    let pickedKeys;
    let peeks;
    let info;
    const badge = () => document.getElementById('weatherBadge');
    const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

    beforeEach(() => {
        jest.useFakeTimers();
        WeatherPanel.updateBadge(null);
        document.body.innerHTML = `<div id="gameCanvas"><button id="weatherBadge" class="weather-badge" hidden>
            <span class="weather-badge-chip"><span class="weather-badge-icon"></span><span class="weather-badge-trend"></span></span></button>
            <div id="skyToast" class="sky-toast" hidden></div></div>`;
        localStorage.clear();
        current = picked('hazy', 'storm');
        pickedKeys = [];
        peeks = [];
        info = { unlocked: true, pick: 'storm', realBand: 'hazy', unlockLevel: 4 };
        WeatherPanel.init({
            getResult: () => current,
            getPickerInfo: () => info,
            onPick: (k) => {
                pickedKeys.push(k);
                const next = k === 'follow' ? null : k;
                current = SkyPick.resolve(real('hazy'), next, true).result;
                info = { unlocked: true, pick: next, realBand: 'hazy', unlockLevel: 4 };
            },
            onPeek: (on) => peeks.push(on),
        });
        WeatherPanel.updateBadge(current);
    });
    afterEach(() => { document.querySelectorAll('.wx-overlay').forEach(o => o.remove()); jest.useRealTimers(); });

    test('the badge keeps the REAL band icon and gets the paintbrush only while a sky is picked', () => {
        expect(badge().dataset.band).toBe('hazy');
        expect(badge().querySelector('.weather-badge-set').hidden).toBe(false);
        expect(badge().querySelector('.weather-badge-set svg')).not.toBeNull();
        expect(badge().classList.contains('weather-badge--set')).toBe(true);
        WeatherPanel.updateBadge(real('hazy'));
        expect(badge().querySelector('.weather-badge-set').hidden).toBe(true);
        expect(badge().classList.contains('weather-badge--set')).toBe(false);
    });

    test('picking a band calls onPick and redraws the panel in place; "Show my real sky" follows the run', () => {
        badge().click();
        expect(document.querySelector('.wx-set-text').textContent).toContain('Sky set to Storm');
        document.querySelector('[data-sky-pick="fog"]').click();
        expect(pickedKeys).toEqual(['fog']);
        expect(document.querySelector('.wx-set-text').textContent).toBe('Sky set to Fog · your run is Hazy');
        expect(document.querySelectorAll('.wx-overlay')).toHaveLength(1); // redrawn, not re-opened
        document.querySelector('.wx-real-btn').click();
        expect(pickedKeys).toEqual(['fog', 'follow']);
        expect(document.querySelector('.wx-set')).toBeNull(); // no longer set
        expect(document.querySelector('[data-sky-pick="follow"]').getAttribute('aria-pressed')).toBe('true');
    });

    test('a disabled Clear button does not call onPick', () => {
        badge().click();
        const clear = document.querySelector('[data-sky-pick="clear"]');
        expect(clear.disabled).toBe(true);
        clear.click();
        expect(pickedKeys).toEqual([]);
    });

    test('the sky toast shows the line, then hides after about 5 s; a newer toast replaces it', () => {
        const el = document.getElementById('skyToast');
        WeatherPanel.showSkyToast("Your run's weather is now Storm. Your sky stays Fog.");
        expect(el.hidden).toBe(false);
        expect(el.textContent).toBe("Your run's weather is now Storm. Your sky stays Fog.");
        jest.advanceTimersByTime(3000);
        WeatherPanel.showSkyToast('Clear slipped away. Your run is Hazy now.');
        jest.advanceTimersByTime(3000);
        expect(el.hidden).toBe(false); // the first toast's timer did not cut the second short
        jest.advanceTimersByTime(2100);
        expect(el.hidden).toBe(true);
        WeatherPanel.showSkyToast('');
        expect(el.hidden).toBe(true);
    });

    test('press and hold (with a sky picked) peeks at the real sky and lets go on release; the release does not open the panel', () => {
        fire(badge(), 'pointerdown');
        jest.advanceTimersByTime(300);
        expect(peeks).toEqual([]);
        jest.advanceTimersByTime(200);
        expect(peeks).toEqual([true]);
        expect(badge().classList.contains('weather-badge--peek')).toBe(true);
        fire(badge(), 'pointerup');
        expect(peeks).toEqual([true, false]);
        expect(badge().classList.contains('weather-badge--peek')).toBe(false);
        badge().click(); // the click that follows a hold
        expect(document.querySelector('.wx-panel')).toBeNull();
        badge().click(); // a later plain tap opens it
        expect(document.querySelector('.wx-panel')).not.toBeNull();
    });

    test('a short tap never peeks; with no pick a long press never peeks either', () => {
        fire(badge(), 'pointerdown');
        jest.advanceTimersByTime(100);
        fire(badge(), 'pointerup');
        jest.advanceTimersByTime(1000);
        expect(peeks).toEqual([]);
        current = real('hazy');
        WeatherPanel.updateBadge(current);
        fire(badge(), 'pointerdown');
        jest.advanceTimersByTime(1000);
        expect(peeks).toEqual([]);
    });

    test('dragging off the badge (pointerleave) ends a peek; the long-press menu is blocked on the badge', () => {
        fire(badge(), 'pointerdown');
        jest.advanceTimersByTime(500);
        fire(badge(), 'pointerleave');
        expect(peeks).toEqual([true, false]);
        const evt = new Event('contextmenu', { bubbles: true, cancelable: true });
        badge().dispatchEvent(evt);
        expect(evt.defaultPrevented).toBe(true);
    });
});

describe('ClimateView with a sky pick', () => {
    function build() {
        document.body.innerHTML = '<div id="gameCanvas"></div>';
        return document.getElementById('gameCanvas');
    }

    test('the sky wears the picked band with the REAL trend', () => {
        const el = build();
        const trendUp = SkyPick.resolve(real('hazy', { trend: 'up' }), 'storm', true).result;
        ClimateView.init({ getResult: () => trendUp });
        expect(el.classList.contains('climate-storm')).toBe(true);
        expect(el.classList.contains('climate-trend-up')).toBe(true);
        expect(el.classList.contains('climate-hazy')).toBe(false);
    });

    test('the change key includes the real band and the pick, so the badge follows a real change under a pick', () => {
        build();
        const seen = [];
        let r = picked('hazy', 'fog');
        ClimateView.init({ getResult: () => r, onChange: (x) => seen.push(SkyPick.realBandOf(x)) });
        ClimateView.refresh();
        expect(seen).toEqual(['hazy']);
        r = picked('storm', 'fog'); // same shown classes (fog), the real band moved
        ClimateView.refresh();
        expect(seen).toEqual(['hazy', 'storm']);
        r = picked('storm', 'fog');
        ClimateView.refresh();
        expect(seen).toEqual(['hazy', 'storm']); // nothing changed -> quiet
        expect(ClimateView.keyFor(real('fog'))).toBe('climate-fog'); // no pick: the key is just the classes, as before
    });

    test('peek(true) wears the REAL sky and does not fire onChange; peek(false) puts the pick back', () => {
        const el = build();
        const shown = picked('hazy', 'storm');
        const seen = [];
        ClimateView.init({ getResult: () => shown, getRealResult: () => real('hazy'), onChange: (x) => seen.push(x.band) });
        expect(el.classList.contains('climate-storm')).toBe(true);
        ClimateView.peek(true);
        expect(el.classList.contains('climate-hazy')).toBe(true);
        expect(el.classList.contains('climate-storm')).toBe(false);
        expect(seen).toEqual(['storm']); // the first call only: a peek is a glance, not a change
        ClimateView.peek(false);
        expect(el.classList.contains('climate-storm')).toBe(true);
        expect(el.classList.contains('climate-hazy')).toBe(false);
    });

    test('peek without a getRealResult dep does nothing', () => {
        const el = build();
        ClimateView.init({ getResult: () => picked('hazy', 'storm') });
        ClimateView.peek(true);
        expect(el.classList.contains('climate-storm')).toBe(true);
    });
});
