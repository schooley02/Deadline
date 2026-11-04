/**
 * @jest-environment jsdom
 *
 * ClimateView (run climate, 2026-11-03): the DOM half. The rules are in runClimate.test.js; here we check that a result becomes
 * the right classes on #gameCanvas, that nothing usable means NO class (the old look), the ?climate= dev override, and that
 * refresh() writes the DOM only when something changed.
 */
const RunClimate = require('../js/runClimate.js');
const ClimateView = require('../js/ui/climateView.js');

function build() {
    document.body.innerHTML = '<div id="gameCanvas" class="keep-me"></div>';
    return document.getElementById('gameCanvas');
}

describe('classesFor (pure)', () => {
    test.each(RunClimate.BANDS)('band %s -> climate-%s', (band) => {
        expect(ClimateView.classesFor({ band, trend: 'steady' })).toEqual(['climate-' + band]);
    });

    test('the view and the logic agree on the band names and their order', () => {
        expect(ClimateView.BANDS).toEqual(RunClimate.BANDS);
    });

    test('a clear trend adds its class; steady / unknown adds none', () => {
        expect(ClimateView.classesFor({ band: 'fog', trend: 'up' })).toEqual(['climate-fog', 'climate-trend-up']);
        expect(ClimateView.classesFor({ band: 'fog', trend: 'down' })).toEqual(['climate-fog', 'climate-trend-down']);
        expect(ClimateView.classesFor({ band: 'fog', trend: 'steady' })).toEqual(['climate-fog']);
        expect(ClimateView.classesFor({ band: 'fog', trend: 'sideways' })).toEqual(['climate-fog']);
    });

    test.each([null, undefined, 5, 'fog', {}, { band: 'blizzard' }, { band: '' }])('unusable result %p -> no classes', (r) => {
        expect(ClimateView.classesFor(r)).toEqual([]);
    });

    test('works on a real RunClimate result and on a forced one', () => {
        expect(ClimateView.classesFor(RunClimate.compute([], 1))).toEqual(['climate-hazy']);
        expect(ClimateView.classesFor(RunClimate.forced('storm', 'down'))).toEqual(['climate-storm', 'climate-trend-down']);
    });
});

describe('parseOverride (?climate=&trend=)', () => {
    test('a valid band, with and without a trend', () => {
        expect(ClimateView.parseOverride('?climate=fog')).toEqual({ band: 'fog', trend: 'steady' });
        expect(ClimateView.parseOverride('?climate=storm&trend=down')).toEqual({ band: 'storm', trend: 'down' });
        expect(ClimateView.parseOverride('?x=1&climate=clear&trend=up')).toEqual({ band: 'clear', trend: 'up' });
    });

    test('case-insensitive; a bad trend falls back to steady', () => {
        expect(ClimateView.parseOverride('?climate=FOG&trend=UP')).toEqual({ band: 'fog', trend: 'up' });
        expect(ClimateView.parseOverride('?climate=hazy&trend=wild')).toEqual({ band: 'hazy', trend: 'steady' });
    });

    test.each(['', '?', '?climate=', '?climate=blizzard', '?trend=up', '?other=fog', null, undefined, 42])('no override for %p', (q) => {
        expect(ClimateView.parseOverride(q)).toBeNull();
    });

    test('feeds RunClimate.forced', () => {
        const o = ClimateView.parseOverride('?climate=overcast&trend=up');
        expect(RunClimate.forced(o.band, o.trend)).toMatchObject({ band: 'overcast', trend: 'up', forced: true });
    });
});

describe('apply / refresh', () => {
    test('apply sets the band class and keeps unrelated classes', () => {
        const el = build();
        ClimateView.apply(el, { band: 'fog', trend: 'up' });
        expect(el.classList.contains('climate-fog')).toBe(true);
        expect(el.classList.contains('climate-trend-up')).toBe(true);
        expect(el.classList.contains('keep-me')).toBe(true);
        expect(el.dataset.climate).toBe('fog');
    });

    test('apply replaces the old band and trend, never stacks them', () => {
        const el = build();
        ClimateView.apply(el, { band: 'storm', trend: 'down' });
        ClimateView.apply(el, { band: 'hazy', trend: 'steady' });
        expect(Array.from(el.classList).filter(c => c.startsWith('climate-'))).toEqual(['climate-hazy']);
        expect(el.dataset.climate).toBe('hazy');
    });

    test('apply with nothing usable removes every climate class and the data attribute', () => {
        const el = build();
        ClimateView.apply(el, { band: 'fog', trend: 'up' });
        ClimateView.apply(el, null);
        expect(Array.from(el.classList)).toEqual(['keep-me']);
        expect(el.dataset.climate).toBeUndefined();
    });

    test('apply on a missing element does not throw', () => {
        expect(ClimateView.apply(null, { band: 'fog' })).toEqual([]);
    });

    test('init applies the first result; refresh follows it when it changes', () => {
        const el = build();
        let result = { band: 'hazy', trend: 'steady' };
        ClimateView.init({ getResult: () => result });
        expect(el.classList.contains('climate-hazy')).toBe(true);
        result = { band: 'fog', trend: 'down' };
        ClimateView.refresh();
        expect(el.classList.contains('climate-hazy')).toBe(false);
        expect(el.classList.contains('climate-fog')).toBe(true);
        expect(el.classList.contains('climate-trend-down')).toBe(true);
    });

    test('refresh writes the DOM only when the classes change', () => {
        const el = build();
        let result = { band: 'overcast', trend: 'steady' };
        ClimateView.init({ getResult: () => result });
        const spy = jest.spyOn(el.classList, 'add');
        ClimateView.refresh();
        ClimateView.refresh();
        expect(spy).not.toHaveBeenCalled();
        result = { band: 'storm', trend: 'steady' };
        ClimateView.refresh();
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });

    test('a throwing getResult leaves the sky with NO climate class (the old look) and logs once per refresh', () => {
        const el = build();
        const err = jest.spyOn(console, 'error').mockImplementation(() => {});
        ClimateView.init({ getResult: () => { throw new Error('boom'); } });
        expect(Array.from(el.classList).filter(c => c.startsWith('climate-'))).toEqual([]);
        expect(err).toHaveBeenCalled();
        err.mockRestore();
    });

    test('a null result clears a previous band', () => {
        const el = build();
        let result = { band: 'fog', trend: 'steady' };
        ClimateView.init({ getResult: () => result });
        result = null;
        ClimateView.refresh();
        expect(el.classList.contains('climate-fog')).toBe(false);
    });

    test('init without #gameCanvas is a safe no-op', () => {
        document.body.innerHTML = '';
        expect(() => { ClimateView.init({ getResult: () => ({ band: 'fog' }) }); ClimateView.refresh(); }).not.toThrow();
    });
});
