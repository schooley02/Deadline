/**
 * Sky unlocks (W1d, 2026-11-09; docs/WORLD_FEEDBACK_PLAN.md "W1d Sky unlocks"): each sky is its own LIFETIME unlock on a different track.
 * Covers CONFIG.SKY_UNLOCKS, the pure rules in js/skyPick.js (unlockedBands, resolve / changeNotice with a band list), the theme's
 * requirement lines, the Weather panel's locked rows, and the State field `bestPlayerLevel` (raise-only, saved, seeded from history).
 * How it LOOKS is checked in a browser.
 */
const CONFIG = require('../js/config.js');
const RunClimate = require('../js/runClimate.js');
const Progression = require('../js/progression.js');
const Theme = require('../js/theme.js');
const SkyPick = require('../js/skyPick.js');
const Memorial = require('../js/memorial.js');
const VillageProgress = require('../js/villageProgress.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.DayRollover = require('../js/dayRollover.js');
global.Persistence = require('../js/persistence.js');
global.SkyPick = SkyPick;
const State = require('../js/state.js');
const WeatherPanel = require('../js/ui/weatherPanel.js');

const real = (band) => ({
    band, bandIndex: RunClimate.BANDS.indexOf(band), score: 0.42, trend: 'up', scoredDays: 7, usedPrior: false,
    recent: [{ date: '2026-11-02', onTime: 0.9, habits: 0.5, damage: 0 }],
});
const best = (level, tiers) => ({ level, tiers: tiers || {} });

describe('CONFIG.SKY_UNLOCKS: the five tracks', () => {
    const R = CONFIG.SKY_UNLOCKS;

    test('every band has exactly one rule, and the rules are the designed ones', () => {
        expect(Object.keys(R).sort()).toEqual([...RunClimate.BANDS].sort());
        expect(R).toEqual({
            hazy: { level: 4 },
            overcast: { kind: 'nights', tier: 3 },
            fog: { kind: 'defense', tier: 3 },
            storm: { kind: 'bestdays', tier: 3 },
            clear: { kind: 'nights', tier: 4 },
        });
    });

    test('Hazy rides the Lv 4 perk: the two numbers cannot drift apart', () => {
        expect(R.hazy.level).toBe(Progression.unlockLevel(CONFIG.LEVEL_PERKS, SkyPick.UNLOCK_KEY));
    });

    test('every building rule names a real village kind and a real star (2..5), reusing an existing threshold', () => {
        Object.values(R).filter(r => r.kind).forEach((r) => {
            expect(Memorial.KINDS).toContain(r.kind);
            expect(VillageProgress.KINDS).toContain(r.kind);
            expect(r.tier).toBeGreaterThanOrEqual(2);
            expect(r.tier).toBeLessThanOrEqual(5);
            expect(CONFIG.VILLAGE_TIER_THRESHOLDS[r.kind].length).toBeGreaterThanOrEqual(r.tier - 1); // star N = the (N-1)th number
        });
    });
});

describe('unlockedBands', () => {
    const R = CONFIG.SKY_UNLOCKS;

    test('a brand-new player has nothing; Lv 4 opens Hazy only', () => {
        expect(SkyPick.unlockedBands(R, best(0))).toEqual([]);
        expect(SkyPick.unlockedBands(R, best(1))).toEqual([]);
        expect(SkyPick.unlockedBands(R, best(3))).toEqual([]);
        expect(SkyPick.unlockedBands(R, best(4))).toEqual(['hazy']);
        expect(SkyPick.unlockedBands(R, best(9))).toEqual(['hazy']);
    });

    test('each building track opens its own sky, in sky order', () => {
        expect(SkyPick.unlockedBands(R, best(4, { nights: 3 }))).toEqual(['hazy', 'overcast']);
        expect(SkyPick.unlockedBands(R, best(4, { defense: 3 }))).toEqual(['hazy', 'fog']);
        expect(SkyPick.unlockedBands(R, best(4, { bestdays: 3 }))).toEqual(['hazy', 'storm']);
        expect(SkyPick.unlockedBands(R, best(4, { nights: 4 }))).toEqual(['clear', 'hazy', 'overcast']);
        expect(SkyPick.unlockedBands(R, best(4, { nights: 4, defense: 5, bestdays: 3 }))).toEqual(RunClimate.BANDS);
    });

    test('star 2 is not enough, and a building star does not open Hazy (that is the level track)', () => {
        expect(SkyPick.unlockedBands(R, best(1, { nights: 2, defense: 2, bestdays: 2 }))).toEqual([]);
        expect(SkyPick.unlockedBands(R, best(1, { nights: 3 }))).toEqual(['overcast']);
    });

    test('junk in, nothing out (never throws)', () => {
        expect(SkyPick.unlockedBands(null, best(9))).toEqual([]);
        expect(SkyPick.unlockedBands(R, null)).toEqual([]);
        expect(SkyPick.unlockedBands(R, { level: 'x', tiers: 'y' })).toEqual([]);
        expect(SkyPick.unlockedBands({ fog: { kind: 'defense' }, storm: 'no', hazy: {} }, best(9, { defense: 9 }))).toEqual([]);
    });
});

describe('resolve / changeNotice with a list of earned bands', () => {
    test('a pick on an earned band is worn; a pick on a locked band is ignored (the real sky shows)', () => {
        const r = real('hazy');
        expect(SkyPick.resolve(r, 'fog', ['hazy', 'fog'])).toMatchObject({ active: true, pick: 'fog' });
        expect(SkyPick.resolve(r, 'fog', ['hazy', 'fog']).result.band).toBe('fog');
        const none = SkyPick.resolve(r, 'storm', ['hazy', 'fog']);
        expect(none).toMatchObject({ active: false, result: r });
    });

    test('the old boolean still works: true = every band, false / nothing earned = none', () => {
        const r = real('hazy');
        expect(SkyPick.resolve(r, 'storm', true).active).toBe(true);
        expect(SkyPick.resolve(r, 'storm', false).active).toBe(false);
        expect(SkyPick.resolve(r, 'storm', []).active).toBe(false);
        expect(SkyPick.allowedBands(true)).toEqual(RunClimate.BANDS);
        expect(SkyPick.allowedBands(['fog', 'blizzard', 'clear'])).toEqual(['clear', 'fog']);
        expect(SkyPick.allowedBands(undefined)).toEqual([]);
    });

    test('the sky-change toast only fires for a pick that is earned', () => {
        expect(SkyPick.changeNotice('hazy', 'storm', 'fog', ['hazy', 'fog'])).toContain('Your sky stays Fog');
        expect(SkyPick.changeNotice('hazy', 'storm', 'clear', ['hazy', 'fog'])).toBe('');
        expect(SkyPick.changeNotice('hazy', 'storm', 'fog', true)).toContain('Your sky stays Fog');
    });
});

describe('best level from history, and the sanitiser', () => {
    test('the highest peakPlayerLevel wins; records without it add nothing', () => {
        expect(SkyPick.bestLevelFromHistory([{ peakPlayerLevel: 3 }, { peakPlayerLevel: 6 }, {}, null, { peakPlayerLevel: 2.5 }])).toBe(6);
        expect(SkyPick.bestLevelFromHistory([])).toBe(0);
        expect(SkyPick.bestLevelFromHistory(null)).toBe(0);
    });
    test('sanitizeLevel keeps a positive whole number, everything else is 0', () => {
        expect(SkyPick.sanitizeLevel(5)).toBe(5);
        expect(SkyPick.sanitizeLevel(5.9)).toBe(5);
        [0, -2, NaN, Infinity, '4', null, undefined, {}].forEach(v => expect(SkyPick.sanitizeLevel(v)).toBe(0));
    });
});

describe('theme requirement lines', () => {
    test('a level rule and a star rule read as player words; building names live in the theme', () => {
        expect(Theme.skyRequirement(CONFIG.SKY_UNLOCKS.hazy)).toBe('Player Lv 4');
        expect(Theme.skyRequirement(CONFIG.SKY_UNLOCKS.overcast)).toBe('Radio tower star 3');
        expect(Theme.skyRequirement(CONFIG.SKY_UNLOCKS.fog)).toBe('Jailhouse star 3');
        expect(Theme.skyRequirement(CONFIG.SKY_UNLOCKS.storm)).toBe('Windmill star 3');
        expect(Theme.skyRequirement(CONFIG.SKY_UNLOCKS.clear)).toBe('Radio tower star 4');
    });
    test('a malformed rule is an empty line, never "undefined"', () => {
        [null, undefined, {}, { kind: 'nope', tier: 3 }, { kind: 'nights' }, 'x'].forEach(r => expect(Theme.skyRequirement(r)).toBe(''));
    });
    test('SkyPick and the panel hold no building names (the theme is the only place)', () => {
        const fs = require('fs');
        ['js/skyPick.js', 'js/ui/weatherPanel.js'].forEach((f) => {
            const text = fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8');
            expect(text).not.toMatch(/Radio tower|Jailhouse|Windmill/);
        });
    });
});

describe('Weather panel: locked rows', () => {
    const rules = CONFIG.SKY_UNLOCKS;
    const info = (earned, extra) => Object.assign({
        unlocked: earned.length > 0, pick: null, realBand: 'hazy', unlockLevel: 4,
        bands: RunClimate.BANDS.map(b => ({ band: b, unlocked: earned.indexOf(b) >= 0, requirement: Theme.skyRequirement(rules[b]) })),
    }, extra);

    test('an earned sky is a normal button, a locked one is a disabled row naming what unlocks it', () => {
        const pm = WeatherPanel.pickerModel(info(['hazy']));
        expect(pm.options.map(o => o.key)).toEqual(['follow', 'clear', 'hazy', 'overcast', 'fog', 'storm']);
        expect(pm.options.find(o => o.key === 'follow').disabled).toBe(false);
        expect(pm.options.find(o => o.key === 'hazy')).toMatchObject({ disabled: false });
        expect(pm.options.find(o => o.key === 'hazy').locked).toBeUndefined();
        expect(pm.options.find(o => o.key === 'fog')).toMatchObject({ disabled: true, locked: true, requirement: 'Jailhouse star 3' });
        expect(pm.options.find(o => o.key === 'clear')).toMatchObject({ locked: true, requirement: 'Radio tower star 4' });
    });

    test('the markup shows the lock, the requirement, and a disabled button for each locked sky', () => {
        const html = WeatherPanel.panelHtml(WeatherPanel.buildViewModel(real('hazy')), WeatherPanel.pickerModel(info(['hazy'])));
        expect(html).toContain('wx-pick wx-pick--locked');
        expect(html).toContain('Jailhouse star 3');
        expect(html).toContain('Windmill star 3');
        expect(html).toContain('Radio tower star 3');
        expect(html).toContain('aria-label="Fog, locked. Unlocks at Jailhouse star 3"');
        expect((html.match(/wx-pick--locked/g) || []).length).toBe(4);
        expect(html).toContain('data-sky-pick="hazy" aria-pressed="false">Hazy</button>');
        expect(html).toContain('data-sky-pick="follow"');
    });

    test('all five earned = no locked row at all', () => {
        const pm = WeatherPanel.pickerModel(info(RunClimate.BANDS));
        expect(pm.options.some(o => o.locked)).toBe(false);
        expect(WeatherPanel.panelHtml(WeatherPanel.buildViewModel(real('hazy')), pm)).not.toContain('wx-pick--locked');
    });

    test('a locked sky is never shown as the pick in force', () => {
        const pm = WeatherPanel.pickerModel(info(['hazy'], { pick: 'storm' }));
        expect(pm.options.find(o => o.key === 'storm').selected).toBe(false);
        expect(pm.options.find(o => o.key === 'follow').selected).toBe(false); // (the caller passes the pick IN FORCE, so this is a stale-state edge only)
    });

    test('nothing earned yet = the old locked line naming the level, no buttons', () => {
        const pm = WeatherPanel.pickerModel(info([]));
        expect(pm.unlocked).toBe(false);
        expect(pm.options).toEqual([]);
        expect(pm.lockedLine).toContain('Lv 4');
    });

    test('without a `bands` list (an old caller) every sky is a normal button', () => {
        const pm = WeatherPanel.pickerModel({ unlocked: true, pick: null, realBand: 'hazy' });
        expect(pm.options.every(o => !o.disabled && !o.locked)).toBe(true);
    });
});

describe('State.bestPlayerLevel', () => {
    beforeEach(() => { State.setPlayerLevel(1); State.resetBestPlayerLevel(); });

    test('it rises with the player level and never goes down', () => {
        expect(State.getBestPlayerLevel()).toBe(0);
        State.setPlayerLevel(3);
        expect(State.getBestPlayerLevel()).toBe(3);
        State.setPlayerLevel(1);
        expect(State.getBestPlayerLevel()).toBe(3);
        State.setPlayerLevel(5);
        expect(State.getBestPlayerLevel()).toBe(5);
    });

    test('a new run keeps it: initGame drops the level to 1 but never resets the best, so a game over cannot take a sky back', () => {
        State.setPlayerLevel(6);
        State.setPlayerLevel(1); // what initGame does
        expect(State.getPlayerLevel()).toBe(1);
        expect(State.getBestPlayerLevel()).toBe(6);
        const fs = require('fs');
        const state = fs.readFileSync(require('path').join(__dirname, '..', 'js/state.js'), 'utf8');
        const start = state.indexOf('function initGame(deps) {');
        const initBody = state.slice(start, state.indexOf('\n    function ', start + 10));
        expect(initBody).toContain('setPlayerLevel(1);');
        expect(initBody).not.toMatch(/resetBestPlayerLevel\(|raiseBestPlayerLevel\(|bestPlayerLevel =/);
    });

    test('a dev Reset Game forgets it', () => {
        State.setPlayerLevel(6);
        State.resetBestPlayerLevel();
        expect(State.getBestPlayerLevel()).toBe(0);
    });

    test('junk levels are ignored', () => {
        [NaN, -1, 'x', null, undefined].forEach(v => State.setPlayerLevel(v));
        expect(State.getBestPlayerLevel()).toBe(0);
    });

    test('the save carries it, and State.js / script.js wire it', () => {
        const fs = require('fs');
        const read = f => fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8');
        const state = read('js/state.js');
        const script = read('script.js');
        expect(state).toContain('bestPlayerLevel: getBestPlayerLevel(),');
        expect(state).toContain('raiseBestPlayerLevel(save.bestPlayerLevel);');
        expect(state).toContain('SkyPick.bestLevelFromHistory(getRunHistory())');
        expect(state.indexOf('resetBestPlayerLevel();\n        raiseBestPlayerLevel(save.bestPlayerLevel)')).toBeGreaterThan(-1);
        expect(script).toContain('State.resetBestPlayerLevel();');
    });
});
