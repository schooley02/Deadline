/**
 * @jest-environment jsdom
 *
 * WeatherPanel (run climate Build 2, 2026-11-03): the badge, the Weather panel and the Stats readout. The sky's rules are in
 * runClimate.test.js; here: the pure view model / markup / icons / first-change pulse, and the DOM behaviour of the badge + panel.
 */
const CONFIG = require('../js/config.js');
const RunClimate = require('../js/runClimate.js');
global.Modal = require('../js/ui/modal.js');
global.HowItWorks = require('../js/ui/howItWorks.js');
const WeatherPanel = require('../js/ui/weatherPanel.js');

const day = (date, extra) => Object.assign({ date, score: 0.8, onTime: 0.9, habits: 0.5, church: 1, damage: 0 }, extra);
const result = (band, extra) => Object.assign({
    band, bandIndex: RunClimate.BANDS.indexOf(band), score: 0.8, trend: 'steady', scoredDays: 7, usedPrior: false,
    recent: [day('2026-11-02'), day('2026-11-01', { onTime: 0.25, damage: 7.5 })],
}, extra);

describe('icons + labels (pure)', () => {
    test.each(RunClimate.BANDS)('%s has an info entry and a 13x13 pixel icon', (band) => {
        expect(WeatherPanel.bandInfo(band).label.length).toBeGreaterThan(0);
        const svg = WeatherPanel.iconSvg(band);
        expect(svg).toMatch(/^<svg viewBox="0 0 13 13"/);
        expect(svg).toContain('aria-hidden="true"');
        expect(svg).toContain('<rect');
    });

    test('the five icons are all different, and an unknown band has none', () => {
        const icons = RunClimate.BANDS.map(WeatherPanel.iconSvg);
        expect(new Set(icons).size).toBe(5);
        expect(WeatherPanel.iconSvg('tornado')).toBe('');
        expect(WeatherPanel.bandInfo('tornado')).toBeNull();
    });

    test('dayLabel: YYYY-MM-DD -> "Mon Nov 2"; anything else comes back as-is', () => {
        expect(WeatherPanel.dayLabel('2026-11-02')).toBe('Mon Nov 2');
        expect(WeatherPanel.dayLabel('2026-12-31')).toBe('Thu Dec 31');
        expect(WeatherPanel.dayLabel('soon')).toBe('soon');
        expect(WeatherPanel.dayLabel(null)).toBe('');
    });
});

describe('buildViewModel (pure)', () => {
    test('no result / an unknown band -> null', () => {
        expect(WeatherPanel.buildViewModel(null)).toBeNull();
        expect(WeatherPanel.buildViewModel({ band: 'tornado' })).toBeNull();
    });

    test.each(RunClimate.BANDS)('%s: label, line and rows', (band) => {
        const vm = WeatherPanel.buildViewModel(result(band));
        expect(vm.band).toBe(band);
        expect(vm.label).toBe(WeatherPanel.BAND_INFO[band].label);
        expect(vm.rows).toHaveLength(2);
        expect(vm.rows[0]).toEqual({ date: '2026-11-02', label: 'Mon Nov 2', onTime: '90%', habits: '50%', damage: '0 HP' });
        expect(vm.rows[1].onTime).toBe('25%');
        expect(vm.rows[1].damage).toBe('7.5 HP');
        expect(vm.note).toBe('');
    });

    test('trend words + arrows', () => {
        expect(WeatherPanel.buildViewModel(result('fog', { trend: 'up' }))).toMatchObject({ trendKey: 'up', trendLabel: 'Clearing', arrow: '▲' });
        expect(WeatherPanel.buildViewModel(result('fog', { trend: 'down' }))).toMatchObject({ trendKey: 'down', trendLabel: 'Worsening', arrow: '▼' });
        expect(WeatherPanel.buildViewModel(result('fog', { trend: 'steady' }))).toMatchObject({ trendKey: 'steady', trendLabel: 'Holding steady', arrow: '' });
        expect(WeatherPanel.buildViewModel(result('fog', { trend: 'weird' })).trendKey).toBe('steady');
    });

    test('a day with nothing to measure shows a dash, not 0%', () => {
        const vm = WeatherPanel.buildViewModel(result('hazy', { recent: [day('2026-11-02', { onTime: null, habits: null })] }));
        expect(vm.rows[0].onTime).toBe('—');
        expect(vm.rows[0].habits).toBe('—');
    });

    test('notes: a brand-new run, an early run, and a forced dev preview', () => {
        expect(WeatherPanel.buildViewModel(result('hazy', { recent: [], scoredDays: 0, usedPrior: true })).note).toMatch(/first finished day/);
        expect(WeatherPanel.buildViewModel(result('hazy', { usedPrior: true })).note).toMatch(/lean/);
        const forced = WeatherPanel.buildViewModel(RunClimate.forced('storm', 'down'));
        expect(forced.forced).toBe(true);
        expect(forced.note).toMatch(/Dev preview/);
        expect(forced.rows).toEqual([]);
    });

    test('works on a real RunClimate.compute result', () => {
        const days = [{ date: '2026-11-01', run: 1, due: { task: 2 }, done: { task: 2 }, dmg: { taken: 3 } }];
        const vm = WeatherPanel.buildViewModel(RunClimate.compute(days, 1, CONFIG.CLIMATE));
        expect(RunClimate.BANDS).toContain(vm.band);
        expect(vm.rows).toHaveLength(1);
        expect(vm.rows[0].damage).toBe('3 HP');
        expect(vm.rows[0].onTime).toBe('100%');
    });
});

describe('RunClimate hands the panel the HP lost that day', () => {
    test('dayParts.damage = taken + offline', () => {
        const p = RunClimate.dayParts({ due: { task: 1 }, done: { task: 1 }, dmg: { taken: 4, offline: 2.5 } });
        expect(p.damage).toBe(6.5);
        expect(RunClimate.dayParts({ due: { task: 1 }, done: { task: 1 } }).damage).toBe(0);
    });
});

describe('markup (pure)', () => {
    const vm = WeatherPanel.buildViewModel(result('overcast', { trend: 'down' }));

    test('panel: dialog, band, trend, table, close X, the How-the-sky-works (i)', () => {
        const html = WeatherPanel.panelHtml(vm);
        expect(html).toContain('modal-overlay wx-overlay');
        expect(html).toContain('role="dialog"');
        expect(html).toContain('Overcast');
        expect(html).toContain('Worsening');
        expect(html).toContain('Today and the last 2 finished days');
        expect(html).toContain('<th scope="row">Mon Nov 2</th>');
        expect(html).toContain('data-action="close"');
        expect(html).toContain('data-hiw-topic="weather"');
        expect(html).toContain('Today moves the sky as it fills in');
    });

    test('panel: no finished days yet -> just the Today row under a "Today" heading; one day -> singular', () => {
        const empty = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(result('hazy', { recent: [] })));
        expect(empty).toContain('<h4 class="wx-days-heading">Today</h4>');
        expect(empty).toContain('Nothing judged yet');
        expect(empty).not.toContain('the last');
        const one = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(result('hazy', { recent: [day('2026-11-02')] })));
        expect(one).toContain('Today and the last 1 finished day<');
    });

    test('a dev-forced sky has no Today row and no table when there are no days', () => {
        const f = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(RunClimate.forced('storm', 'down')));
        expect(f).not.toContain('<table');
        expect(f).not.toContain('wx-days-heading');
    });

    test('stats section: the same facts, no modal chrome', () => {
        const html = WeatherPanel.statsHtml(vm);
        expect(html).toContain('stats-weather');
        expect(html).toContain('Overcast');
        expect(html).toContain('▼ Worsening');
        expect(html).toContain('<table');
        expect(html).not.toContain('modal-overlay');
        expect(WeatherPanel.statsHtml(null)).toBe('');
        expect(WeatherPanel.panelHtml(null)).toBe('');
    });

    test('text from the data is escaped', () => {
        const evil = Object.assign({}, vm, { label: '<img onerror=x>', rows: [{ label: '<b>', onTime: '1', habits: '2', damage: '3' }] });
        const html = WeatherPanel.panelHtml(evil);
        expect(html).not.toContain('<img onerror');
        expect(html).not.toContain('<b>');
    });

    test('badgeLabel names the sky and the trend', () => {
        expect(WeatherPanel.badgeLabel(vm)).toBe('Weather: Overcast, worsening. Tap for details.');
        expect(WeatherPanel.badgeLabel(WeatherPanel.buildViewModel(result('clear')))).toBe('Weather: Clear. Tap for details.');
        expect(WeatherPanel.badgeLabel(null)).toBe('Weather');
    });
});

describe('nextBadgeState: the first-change pulse', () => {
    const next = WeatherPanel.nextBadgeState;

    test('the first time we see the badge: remember the band, no pulse', () => {
        expect(next(null, 'hazy', false)).toEqual({ pulse: false, next: { band: 'hazy', pending: false, learned: false } });
    });
    test('same band again: nothing to do', () => {
        expect(next({ band: 'hazy', pending: false, learned: false }, 'hazy', false)).toEqual({ pulse: false, next: null });
    });
    test('the first change pulses and stays pending (even across a second change) until tapped', () => {
        expect(next({ band: 'hazy', pending: false, learned: false }, 'fog', false))
            .toEqual({ pulse: true, next: { band: 'fog', pending: true, learned: false } });
        expect(next({ band: 'fog', pending: true, learned: false }, 'fog', false)).toEqual({ pulse: true, next: null });
        expect(next({ band: 'fog', pending: true, learned: false }, 'storm', false).pulse).toBe(true);
    });
    test('a tap learns it for good: never pulses again', () => {
        const learned = next({ band: 'fog', pending: true, learned: false }, 'fog', true);
        expect(learned).toEqual({ pulse: false, next: { band: 'fog', pending: false, learned: true } });
        expect(next(learned.next, 'clear', false).pulse).toBe(false);
        expect(next(learned.next, 'clear', false).next).toEqual({ band: 'clear', pending: false, learned: true });
    });
    test('junk in storage is treated as nothing stored', () => {
        expect(next('garbage', 'hazy', false)).toEqual({ pulse: false, next: { band: 'hazy', pending: false, learned: false } });
    });
});

describe('badge + panel in the DOM', () => {
    const badge = () => document.getElementById('weatherBadge');
    let current;

    beforeEach(() => {
        WeatherPanel.updateBadge(null); // forget the previous test's result (module state)
        document.body.innerHTML = `<div id="gameCanvas"><button id="weatherBadge" class="weather-badge" hidden>
            <span class="weather-badge-chip"><span class="weather-badge-icon"></span><span class="weather-badge-trend"></span></span></button></div>`;
        localStorage.clear();
        current = result('hazy');
        WeatherPanel.init({ getResult: () => current });
    });

    test('hidden with no result; shown with the band icon, arrow, label and tooltip once there is one', () => {
        expect(badge().hidden).toBe(true);
        WeatherPanel.updateBadge(result('fog', { trend: 'up' }));
        expect(badge().hidden).toBe(false);
        expect(badge().dataset.band).toBe('fog');
        expect(badge().querySelector('svg')).not.toBeNull();
        expect(badge().querySelector('.weather-badge-trend').textContent).toBe('▲');
        expect(badge().querySelector('.weather-badge-trend').className).toContain('weather-badge-trend--up');
        expect(badge().getAttribute('aria-label')).toBe('Weather: Fog, clearing. Tap for details.');
        WeatherPanel.updateBadge(null);
        expect(badge().hidden).toBe(true);
    });

    test('first change pulses; a tap stops it for good and opens the panel', () => {
        WeatherPanel.updateBadge(result('hazy'));
        expect(badge().classList.contains('weather-badge--pulse')).toBe(false);
        WeatherPanel.updateBadge(result('fog'));
        expect(badge().classList.contains('weather-badge--pulse')).toBe(true);
        current = result('fog');
        badge().click();
        expect(badge().classList.contains('weather-badge--pulse')).toBe(false);
        expect(document.querySelector('.wx-panel')).not.toBeNull();
        document.querySelector('.wx-overlay').remove();
        WeatherPanel.updateBadge(result('storm'));
        expect(badge().classList.contains('weather-badge--pulse')).toBe(false);
        expect(JSON.parse(localStorage.getItem(WeatherPanel.STORAGE_KEY)).learned).toBe(true);
    });

    test('a forced dev sky never pulses and never touches the saved hint', () => {
        WeatherPanel.updateBadge(RunClimate.forced('storm', 'down'));
        expect(badge().classList.contains('weather-badge--pulse')).toBe(false);
        expect(localStorage.getItem(WeatherPanel.STORAGE_KEY)).toBeNull();
        current = RunClimate.forced('storm', 'down');
        badge().click();
        expect(localStorage.getItem(WeatherPanel.STORAGE_KEY)).toBeNull();
        expect(document.querySelector('.wx-panel').textContent).toMatch(/Dev preview/);
    });

    test('opening twice shows one panel; the X closes it', () => {
        WeatherPanel.updateBadge(current);
        badge().click();
        badge().click();
        expect(document.querySelectorAll('.wx-overlay')).toHaveLength(1);
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelector('.wx-overlay')).toBeNull();
    });

    test('the panel carries a working (i) that opens the sky topic', () => {
        WeatherPanel.updateBadge(current);
        badge().click();
        expect(document.querySelector('.wx-panel [data-hiw-topic="weather"]')).not.toBeNull();
    });

    test('open() with no result does nothing', () => {
        current = null;
        expect(WeatherPanel.open()).toBeNull();
        expect(document.querySelector('.wx-overlay')).toBeNull();
    });

    test('broken storage never breaks the badge', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(() => WeatherPanel.updateBadge(result('fog'))).not.toThrow();
        expect(badge().hidden).toBe(false);
        spy.mockRestore(); setSpy.mockRestore();
    });

    test('init with no badge in the page is a no-op', () => {
        document.body.innerHTML = '';
        expect(() => WeatherPanel.init({ getResult: () => current })).not.toThrow();
        expect(() => WeatherPanel.updateBadge(current)).not.toThrow();
    });
});

describe('live sky: the Today so far row (2026-11-11, docs/LIVE_SKY_PLAN.md)', () => {
    const live = (extra) => result('hazy', Object.assign({
        live: true, closedBand: 'hazy', today: { score: 0.4, onTime: 0.5, habits: 1, church: 0.8, damage: 5, resolved: 4 },
    }, extra));

    test('view model: the first table row is today, from the result\'s live numbers', () => {
        const vm = WeatherPanel.buildViewModel(live());
        expect(vm.today).toEqual({ pending: false, onTime: '50%', habits: '100%', damage: '5 HP' });
        expect(WeatherPanel.buildViewModel(result('hazy')).today).toEqual({ pending: true });
        expect(WeatherPanel.buildViewModel(RunClimate.forced('fog')).today).toBeNull();
    });

    test('the Today row comes first, is marked live, and the finished days follow; the Stats table has it too', () => {
        const vm = WeatherPanel.buildViewModel(live());
        const html = WeatherPanel.panelHtml(vm);
        expect(html).toContain('<tr class="wx-row--live"><th scope="row">Today so far</th><td>50%</td><td>100%</td><td>5 HP</td></tr>');
        expect(html.indexOf('Today so far')).toBeLessThan(html.indexOf('Mon Nov 2'));
        expect(WeatherPanel.statsHtml(vm)).toContain('Today so far');
    });

    test('nothing judged yet reads as a words row, not a row of dashes', () => {
        const html = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(result('hazy')));
        expect(html).toContain('<td colspan="3" class="wx-pending">Nothing judged yet</td>');
    });
});
