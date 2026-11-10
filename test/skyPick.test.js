/**
 * Sky picker (W1c, 2026-11-09; docs/WORLD_FEEDBACK_PLAN.md "W1c Sky picker" + its amendment): the pure rules (js/skyPick.js), the Lv 4
 * perk helpers, the theme name, and the State field. How it LOOKS is checked in a browser.
 */
const CONFIG = require('../js/config.js');
const RunClimate = require('../js/runClimate.js');
const Progression = require('../js/progression.js');
const Theme = require('../js/theme.js');
const SkyPick = require('../js/skyPick.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
global.SkyPick = SkyPick;
const State = require('../js/state.js');

const real = (band, extra) => Object.assign({
    band, bandIndex: RunClimate.BANDS.indexOf(band), score: 0.42, trend: 'up', scoredDays: 7, usedPrior: false,
    recent: [{ date: '2026-11-02', onTime: 0.9, habits: 0.5, damage: 0 }],
}, extra);

describe('bands', () => {
    test('the picker and the logic agree on the band names and their order', () => {
        expect(SkyPick.BANDS).toEqual(RunClimate.BANDS);
    });
    test('sanitize keeps a band name, everything else = follow (null)', () => {
        RunClimate.BANDS.forEach(b => expect(SkyPick.sanitize(b)).toBe(b));
        [null, undefined, '', 'blizzard', 4, {}, 'STORM'].forEach(v => expect(SkyPick.sanitize(v)).toBeNull());
    });
    test('Clear is offered only while the run is Clear; the other four always', () => {
        expect(SkyPick.pickableBands('clear')).toEqual(['clear', 'hazy', 'overcast', 'fog', 'storm']);
        ['hazy', 'overcast', 'fog', 'storm'].forEach(b =>
            expect(SkyPick.pickableBands(b)).toEqual(['hazy', 'overcast', 'fog', 'storm']));
    });
});

describe('resolve: what the canvas wears', () => {
    test('no perk, no pick, no result, a dev-forced sky: the real result, untouched', () => {
        const r = real('hazy');
        expect(SkyPick.resolve(r, 'storm', false)).toMatchObject({ result: r, active: false });
        expect(SkyPick.resolve(r, null, true)).toMatchObject({ result: r, active: false });
        expect(SkyPick.resolve(null, 'storm', true)).toMatchObject({ result: null, active: false });
        const f = real('hazy', { forced: true });
        expect(SkyPick.resolve(f, 'storm', true)).toMatchObject({ result: f, active: false }); // dev sky > player pick
    });

    test('a pick wears the picked band; trend, recent days and the rest stay the REAL run', () => {
        const r = real('hazy');
        const s = SkyPick.resolve(r, 'storm', true);
        expect(s.active).toBe(true);
        expect(s.result).toMatchObject({ band: 'storm', bandIndex: 4, trend: 'up', recent: r.recent, scoredDays: 7 });
        expect(s.result.pick).toEqual({ band: 'storm', realBand: 'hazy' });
        expect(r.band).toBe('hazy'); // the real result is not mutated
        expect(r.pick).toBeUndefined();
    });

    test('a different band has no score (rain at full strength, like the dev sky); the same band keeps it', () => {
        expect(SkyPick.resolve(real('hazy'), 'storm', true).result.score).toBeNull();
        expect(SkyPick.resolve(real('storm'), 'storm', true).result.score).toBe(0.42);
    });

    test('Clear is only yours while the run is Clear: a saved Clear pick is ignored (not deleted) once the run slips', () => {
        const slipped = SkyPick.resolve(real('hazy'), 'clear', true);
        expect(slipped).toMatchObject({ active: false, slipped: true, pick: 'clear' });
        expect(slipped.result.band).toBe('hazy');
        const holds = SkyPick.resolve(real('clear'), 'clear', true);
        expect(holds).toMatchObject({ active: true, slipped: false });
        expect(holds.result.band).toBe('clear');
    });

    test('picking a band WORSE than the real one is always allowed (rain lovers)', () => {
        ['hazy', 'overcast', 'fog', 'storm'].forEach(b =>
            expect(SkyPick.resolve(real('clear'), b, true).result.band).toBe(b));
    });

    test('realBandOf reads the band behind a worn result', () => {
        expect(SkyPick.realBandOf(SkyPick.resolve(real('hazy'), 'storm', true).result)).toBe('hazy');
        expect(SkyPick.realBandOf(real('fog'))).toBe('fog');
        expect(SkyPick.realBandOf(null)).toBeNull();
    });
});

describe('changeNotice: the toast when the REAL band moves under a pick', () => {
    test('a pick in force + a real change -> one line naming both skies', () => {
        expect(SkyPick.changeNotice('hazy', 'storm', 'fog', true)).toBe("Your run's weather is now Storm. Your sky stays Fog.");
        expect(SkyPick.changeNotice('storm', 'hazy', 'storm', true)).toBe("Your run's weather is now Hazy. Your sky stays Storm.");
    });
    test('a Clear pick that loses its Clear run gets its own line', () => {
        expect(SkyPick.changeNotice('clear', 'hazy', 'clear', true)).toBe('Clear slipped away. Your run is Hazy now.');
    });
    test('never without a pick, without the perk, or when nothing moved', () => {
        expect(SkyPick.changeNotice('hazy', 'storm', null, true)).toBe('');
        expect(SkyPick.changeNotice('hazy', 'storm', 'fog', false)).toBe('');
        expect(SkyPick.changeNotice('hazy', 'hazy', 'fog', true)).toBe('');
        expect(SkyPick.changeNotice(null, 'hazy', 'fog', true)).toBe('');
    });
    test('never when the sky already shows the new real band', () => {
        expect(SkyPick.changeNotice('hazy', 'storm', 'storm', true)).toBe('');
    });
    test('a Clear pick says nothing for changes that are not leaving Clear (it was already ignored)', () => {
        expect(SkyPick.changeNotice('hazy', 'overcast', 'clear', true)).toBe('');
        expect(SkyPick.changeNotice('hazy', 'clear', 'clear', true)).toBe('');
    });
});

describe('the Lv 4 perk (no number moves)', () => {
    test('Lv 4 grants the 10% discount AND the sky picker unlock', () => {
        expect(CONFIG.LEVEL_PERKS[4].map(p => p.type)).toEqual(['discount', 'unlock']);
        expect(CONFIG.LEVEL_PERKS[4][1].unlock).toBe(SkyPick.UNLOCK_KEY);
        expect(CONFIG.LEVEL_PERKS[4][0].value).toBe(0.10);
    });
    test('hasUnlock is derived from the level: false below 4, true from 4 on, false for an unknown key or table', () => {
        const t = CONFIG.LEVEL_PERKS;
        [1, 2, 3].forEach(lv => expect(Progression.hasUnlock(t, lv, 'skyPicker')).toBe(false));
        [4, 5, 9].forEach(lv => expect(Progression.hasUnlock(t, lv, 'skyPicker')).toBe(true));
        expect(Progression.hasUnlock(t, 9, 'nope')).toBe(false);
        expect(Progression.hasUnlock(null, 9, 'skyPicker')).toBe(false);
        expect(Progression.hasUnlock(t, 'x', 'skyPicker')).toBe(false);
    });
    test('unlockLevel names the level that grants it', () => {
        expect(Progression.unlockLevel(CONFIG.LEVEL_PERKS, 'skyPicker')).toBe(4);
        expect(Progression.unlockLevel(CONFIG.LEVEL_PERKS, 'nope')).toBeNull();
    });
    test('the shop discount and the other perks are unchanged by the new row', () => {
        expect(Progression.shopDiscount(CONFIG.LEVEL_PERKS, 4)).toBe(0.10);
        expect(Progression.shopDiscount(CONFIG.LEVEL_PERKS, 8)).toBe(0.20);
    });
});

describe('the player-facing name lives in the theme only', () => {
    test('Theme.perkLabel gives "Geo Storm: You control the weather (visuals only)" for the unlock; own labels win', () => {
        expect(Theme.perkLabel(CONFIG.LEVEL_PERKS[4][1])).toBe('Geo Storm: You control the weather (visuals only)');
        expect(Theme.perkLabel({ type: 'discount', label: '10% off the shop' })).toBe('10% off the shop');
        expect(Theme.perkLabel({ type: 'unlock', unlock: 'unknown', label: '' })).toBe('');
        expect(Theme.perkLabel(null)).toBe('');
    });
    test('"Geo Storm" is not in the config, the pure rules, a key or a CSS class', () => {
        const fs = require('fs');
        const path = require('path');
        ['js/config.js', 'js/skyPick.js', 'js/progression.js', 'js/state.js', 'css/weatherPanel.css'].forEach((f) => {
            expect(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).not.toMatch(/Geo Storm/);
        });
    });
});

describe('State.skyPick (schema 19)', () => {
    beforeAll(() => { global.window = { definedTasks: [] }; });
    afterAll(() => { delete global.window; });
    beforeEach(() => State.setSkyPick(null));

    test('starts as follow (null); the setter keeps only a band name', () => {
        expect(State.getSkyPick()).toBeNull();
        State.setSkyPick('fog');
        expect(State.getSkyPick()).toBe('fog');
        State.setSkyPick('blizzard');
        expect(State.getSkyPick()).toBeNull();
    });
    test('it rides in getPersistableState as skyPick', () => {
        State.setSkyPick('storm');
        expect(State.getPersistableState({}).skyPick).toBe('storm');
        State.setSkyPick(null);
        expect(State.getPersistableState({}).skyPick).toBeNull();
    });
});
