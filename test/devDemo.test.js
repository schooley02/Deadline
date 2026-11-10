/**
 * DevDemo (dev tools, 2026-11-03): the in-memory demo state behind the DEV button. Pins the rules in its header: gated by the
 * Settings switch, in memory only, answers "no demo" (null) whenever it is off or unset, and builds the same forced sky the
 * ?climate= override uses.
 */
const RunClimate = require('../js/runClimate.js');
const DevDemo = require('../js/devDemo.js');

beforeEach(() => { DevDemo.resetForTests(); });

describe('gated by the Developer tools switch', () => {
    test('starts off: nothing can be set and every getter says "no demo"', () => {
        expect(DevDemo.snapshot()).toEqual({ enabled: false, band: null, tier: null, church: null, memorial: null, tree: null, markers: null, active: false });
        expect(DevDemo.setBand('fog')).toBe(false);
        expect(DevDemo.setTier(5)).toBe(false);
        expect(DevDemo.weather(RunClimate)).toBeNull();
        expect(DevDemo.villageTier()).toBeNull();
        expect(DevDemo.isActive()).toBe(false);
    });

    test('turning the switch off clears everything that was set', () => {
        DevDemo.setEnabled(true);
        DevDemo.setBand('storm'); DevDemo.setTier(4);
        expect(DevDemo.isActive()).toBe(true);
        DevDemo.setEnabled(false);
        expect(DevDemo.snapshot()).toEqual({ enabled: false, band: null, tier: null, church: null, memorial: null, tree: null, markers: null, active: false });
        DevDemo.setEnabled(true);          // and a later switch-on starts clean, not with the old demo
        expect(DevDemo.weather(RunClimate)).toBeNull();
        expect(DevDemo.villageTier()).toBeNull();
    });

    test('only a real true turns it on', () => {
        ['yes', 1, 'true', null, undefined].forEach((v) => { DevDemo.setEnabled(v); expect(DevDemo.snapshot().enabled).toBe(false); });
        DevDemo.setEnabled(true);
        expect(DevDemo.snapshot().enabled).toBe(true);
    });
});

describe('weather', () => {
    beforeEach(() => DevDemo.setEnabled(true));

    test.each(RunClimate.BANDS)('%s builds the same forced result the ?climate= override does', (band) => {
        expect(DevDemo.setBand(band)).toBe(true);
        expect(DevDemo.weather(RunClimate)).toEqual(RunClimate.forced(band, 'steady'));
        expect(DevDemo.weather(RunClimate).forced).toBe(true);   // the Weather panel says "Dev preview", the badge never pulses
    });

    test('the forced sky is always a steady one (the Dev tools Trend row was removed 2026-11-10); the demo has no trend setter', () => {
        DevDemo.setBand('fog');
        expect(DevDemo.weather(RunClimate)).toMatchObject({ band: 'fog', trend: 'steady', forced: true });
        expect(DevDemo.setTrend).toBeUndefined();
        expect(DevDemo.TRENDS).toBeUndefined();
        expect(DevDemo.snapshot()).not.toHaveProperty('trend');
    });

    test('Real (null or "real") hands the sky back; nothing forced = no weather demo', () => {
        expect(DevDemo.weather(RunClimate)).toBeNull();
        DevDemo.setBand('overcast');
        DevDemo.setBand('real');
        expect(DevDemo.weather(RunClimate)).toBeNull();
        DevDemo.setBand('hazy');
        DevDemo.setBand(null);
        expect(DevDemo.weather(RunClimate)).toBeNull();
    });

    test.each(['blizzard', '', 5, undefined, {}])('a bad band (%p) is ignored and changes nothing', (bad) => {
        DevDemo.setBand('fog');
        expect(DevDemo.setBand(bad)).toBe(false);
        expect(DevDemo.snapshot().band).toBe('fog');
    });

    test('with no RunClimate to ask there is simply no weather demo (never a throw)', () => {
        DevDemo.setBand('fog');
        expect(DevDemo.weather({})).toBeNull();
    });
});

describe('village stars', () => {
    beforeEach(() => DevDemo.setEnabled(true));

    test.each([1, 2, 3, 4, 5])('star %i is accepted as a number or a string', (n) => {
        expect(DevDemo.setTier(n)).toBe(true);
        expect(DevDemo.villageTier()).toBe(n);
        expect(DevDemo.setTier(String(n))).toBe(true);
        expect(DevDemo.villageTier()).toBe(n);
    });

    test('Real hands the village back', () => {
        DevDemo.setTier(3);
        DevDemo.setTier('real');
        expect(DevDemo.villageTier()).toBeNull();
        DevDemo.setTier(2);
        DevDemo.setTier(null);
        expect(DevDemo.villageTier()).toBeNull();
    });

    test.each([0, 6, -1, 2.5, 'x', '', undefined, NaN])('a bad star (%p) is ignored and changes nothing', (bad) => {
        DevDemo.setTier(4);
        expect(DevDemo.setTier(bad)).toBe(false);
        expect(DevDemo.villageTier()).toBe(4);
    });
});

describe('church picture (art only)', () => {
    beforeEach(() => DevDemo.setEnabled(true));

    test('starts as the real church (null)', () => {
        expect(DevDemo.churchHealth()).toBeNull();
        expect(DevDemo.snapshot().church).toBeNull();
    });

    test('the five states are the health each picture starts at', () => {
        expect(DevDemo.CHURCH_STATES).toEqual([100, 75, 50, 25, 0]);
    });

    test.each([100, 75, 50, 25, 0])('state %i is accepted as a number or a string (0 included)', (n) => {
        expect(DevDemo.setChurch(n)).toBe(true);
        expect(DevDemo.churchHealth()).toBe(n);
        expect(DevDemo.setChurch(String(n))).toBe(true);
        expect(DevDemo.churchHealth()).toBe(n);
        expect(DevDemo.snapshot().church).toBe(n);
        expect(DevDemo.isActive()).toBe(true);
    });

    test('Real hands the church back', () => {
        DevDemo.setChurch(50);
        DevDemo.setChurch('real');
        expect(DevDemo.churchHealth()).toBeNull();
        DevDemo.setChurch(25);
        DevDemo.setChurch(null);
        expect(DevDemo.churchHealth()).toBeNull();
        expect(DevDemo.isActive()).toBe(false);
    });

    test.each([10, 60, 101, -1, 2.5, 'x', '', undefined, NaN])('a bad state (%p) is ignored and changes nothing', (bad) => {
        DevDemo.setChurch(75);
        expect(DevDemo.setChurch(bad)).toBe(false);
        expect(DevDemo.churchHealth()).toBe(75);
    });

    test('with the switch off it answers null and refuses to be set; turning the switch off clears it', () => {
        DevDemo.setChurch(25);
        DevDemo.setEnabled(false);
        expect(DevDemo.churchHealth()).toBeNull();
        expect(DevDemo.setChurch(50)).toBe(false);
        DevDemo.setEnabled(true);
        expect(DevDemo.churchHealth()).toBeNull();
    });

    test('Reset clears it along with the sky and village, and every change notifies listeners', () => {
        const fn = jest.fn();
        DevDemo.onChange(fn);
        DevDemo.setChurch(0);
        expect(fn).toHaveBeenCalledTimes(1);
        DevDemo.reset();
        expect(DevDemo.churchHealth()).toBeNull();
        expect(fn).toHaveBeenCalledTimes(2);
        DevDemo.reset(); // already real
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('reset + listeners', () => {
    test('reset goes back to the real sky and village but leaves the switch on', () => {
        DevDemo.setEnabled(true);
        DevDemo.setBand('storm'); DevDemo.setTier(5);
        DevDemo.reset();
        expect(DevDemo.snapshot()).toEqual({ enabled: true, band: null, tier: null, church: null, memorial: null, tree: null, markers: null, active: false });
    });

    test('listeners hear every real change, not a no-op, and can unsubscribe', () => {
        const seen = [];
        const off = DevDemo.onChange((snap) => seen.push(snap));
        DevDemo.setEnabled(true);            // 1
        DevDemo.setEnabled(true);            // no change
        DevDemo.setBand('fog');              // 2
        DevDemo.reset();                     // 3
        DevDemo.reset();                     // already real: no change
        expect(seen).toHaveLength(3);
        expect(seen[1]).toMatchObject({ band: 'fog', active: true });
        off();
        DevDemo.setBand('hazy');
        expect(seen).toHaveLength(3);
    });

    test('a listener that throws never breaks the change or the other listeners', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const good = jest.fn();
        DevDemo.onChange(() => { throw new Error('boom'); });
        DevDemo.onChange(good);
        DevDemo.setEnabled(true);
        expect(good).toHaveBeenCalledTimes(1);
        expect(DevDemo.snapshot().enabled).toBe(true);
        spy.mockRestore();
    });
});

describe('in memory only', () => {
    test('the module never touches storage', () => {
        const raw = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'devDemo.js'), 'utf8');
        const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // code only: the header explains the rule in words
        expect(src.length).toBeGreaterThan(500);
        expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|Persistence|saveGame|document\.cookie/);
    });

    test('a demo leaves localStorage untouched', () => {
        const calls = [];
        global.localStorage = { getItem: () => null, setItem: (...a) => calls.push(a), removeItem: (...a) => calls.push(a), clear: () => calls.push(['clear']) };
        DevDemo.setEnabled(true); DevDemo.setBand('storm'); DevDemo.setTier(5); DevDemo.reset(); DevDemo.setEnabled(false);
        delete global.localStorage;
        expect(calls).toEqual([]);
    });
});

describe('graveyard monument + tree stages (2026-11-08)', () => {
    test('both answer "no demo" until set, and while the switch is off', () => {
        expect(DevDemo.memorialStage()).toBeNull();
        expect(DevDemo.treeStage()).toBeNull();
        expect(DevDemo.setMemorial(3)).toBe(false);
        expect(DevDemo.setTree(2)).toBe(false);
        expect(DevDemo.memorialStage()).toBeNull();
        expect(DevDemo.treeStage()).toBeNull();
    });

    test('the lists are 1..5 and 1..3', () => {
        expect(DevDemo.MEMORIAL_STAGES).toEqual([1, 2, 3, 4, 5]);
        expect(DevDemo.TREE_STAGES).toEqual([1, 2, 3]);
    });

    test('set / real / bad values: only whole numbers in the list stick, "real" and null clear', () => {
        DevDemo.setEnabled(true);
        expect(DevDemo.setMemorial('5')).toBe(true);
        expect(DevDemo.memorialStage()).toBe(5);
        expect(DevDemo.setMemorial(6)).toBe(false);
        expect(DevDemo.setMemorial(0)).toBe(false);
        expect(DevDemo.setMemorial('')).toBe(false);
        expect(DevDemo.setMemorial(2.5)).toBe(false);
        expect(DevDemo.memorialStage()).toBe(5);
        expect(DevDemo.setMemorial('real')).toBe(true);
        expect(DevDemo.memorialStage()).toBeNull();
        expect(DevDemo.setTree(3)).toBe(true);
        expect(DevDemo.treeStage()).toBe(3);
        expect(DevDemo.setTree(4)).toBe(false);
        expect(DevDemo.setTree(null)).toBe(true);
        expect(DevDemo.treeStage()).toBeNull();
    });

    test('they make the demo active, show in the snapshot, and Reset / switching off clears them', () => {
        DevDemo.setEnabled(true);
        DevDemo.setMemorial(2);
        expect(DevDemo.isActive()).toBe(true);
        expect(DevDemo.snapshot()).toMatchObject({ memorial: 2, tree: null, active: true });
        DevDemo.reset();
        expect(DevDemo.isActive()).toBe(false);
        DevDemo.setTree(1);
        expect(DevDemo.snapshot()).toMatchObject({ memorial: null, tree: 1, active: true });
        DevDemo.setEnabled(false);
        DevDemo.setEnabled(true);
        expect(DevDemo.snapshot()).toMatchObject({ memorial: null, tree: null, markers: null, active: false });
    });

    test('Headstones chips: 0..4 or real; they make the demo active and reset clears them', () => {
        expect(DevDemo.MARKER_STAGES).toEqual([0, 1, 2, 3, 4]);
        expect(DevDemo.markerStage()).toBeNull();
        expect(DevDemo.setMarkers(2)).toBe(false); // switch still off
        DevDemo.setEnabled(true);
        expect(DevDemo.setMarkers(0)).toBe(true);
        expect(DevDemo.markerStage()).toBe(0);
        expect(DevDemo.isActive()).toBe(true);
        expect(DevDemo.setMarkers('4')).toBe(true);
        expect(DevDemo.markerStage()).toBe(4);
        expect(DevDemo.setMarkers(5)).toBe(false);
        expect(DevDemo.setMarkers(1.5)).toBe(false);
        expect(DevDemo.markerStage()).toBe(4);
        expect(DevDemo.setMarkers('real')).toBe(true);
        expect(DevDemo.markerStage()).toBeNull();
        DevDemo.setMarkers(3);
        DevDemo.reset();
        expect(DevDemo.markerStage()).toBeNull();
        DevDemo.setMarkers(3);
        DevDemo.setEnabled(false);
        expect(DevDemo.markerStage()).toBeNull();
    });

    test('they change nothing else: the village star and church stay as they were', () => {
        DevDemo.setEnabled(true);
        DevDemo.setTier(4); DevDemo.setChurch(50);
        DevDemo.setMemorial(1); DevDemo.setTree(2);
        expect(DevDemo.villageTier()).toBe(4);
        expect(DevDemo.churchHealth()).toBe(50);
    });
});
