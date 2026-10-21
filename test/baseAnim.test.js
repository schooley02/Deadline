/**
 * @jest-environment jsdom
 *
 * Animated church idle loops + throttled hit shake (V4 follow-up, 2026-10-20).
 * The animation itself is CSS (css/gameCanvas.css) and is checked live in the
 * browser; these tests pin the JS hooks and keep the CSS frame counts, the
 * sprite strips and sw.js in agreement.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.RunStats = require('../js/runStats.js');
const Damage = require('../js/damage.js');

const ROOT = path.join(__dirname, '..');
const FRAME_W = 80;
const FRAME_H = 200;

// PNG width/height straight from the IHDR chunk (no image library needed).
function pngSize(file) {
    const buf = fs.readFileSync(file);
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('resolveBaseAnimKey', () => {
    test.each([
        [100, '100'], [76, '100'],
        [75, '075'], [51, '075'],
        [50, '050'], [26, '050'],
        [25, '025'], [1, '025'],
        [0, ''],
    ])('health %i -> "%s"', (hp, key) => {
        expect(Damage.resolveBaseAnimKey(hp)).toBe(key);
    });
});

describe('applyBaseArt', () => {
    test('sets the static png and the idle-loop key', () => {
        const el = document.createElement('div');
        Damage.applyBaseArt(el, 90);
        expect(el.style.backgroundImage).toBe('url("Assets/Base/base_100.png")');
        expect(el.dataset.baseAnim).toBe('100');
    });
    test('drops the key for a state without a strip', () => {
        const el = document.createElement('div');
        Damage.applyBaseArt(el, 90);
        Damage.applyBaseArt(el, 0);
        expect(el.style.backgroundImage).toBe('url("Assets/Base/base_000.png")');
        expect(el.dataset.baseAnim).toBeUndefined();
    });
    test('null element is a no-op', () => {
        expect(() => Damage.applyBaseArt(null, 50)).not.toThrow();
    });
});

describe('hit shake throttle', () => {
    function deps(el) {
        let hp = 100;
        return {
            getBaseHealth: () => hp, setBaseHealth: (n) => { hp = n; },
            isGameOver: () => false, baseElement: el, baseHealthDisplay: null,
            saveGame: () => {},
        };
    }

    beforeEach(() => {
        jest.useFakeTimers();
        Damage.resetShakeForTests();
    });
    afterEach(() => jest.useRealTimers());

    test('shouldShake honours the cooldown', () => {
        expect(Damage.shouldShake(5000, 2000, 3000)).toBe(true);
        expect(Damage.shouldShake(4999, 2000, 3000)).toBe(false);
        expect(Damage.shouldShake(0, -Infinity, 3000)).toBe(true);
    });

    test('shakes on the first hit, not again inside the cooldown, again after it', () => {
        const el = document.createElement('div');
        const d = deps(el);
        jest.setSystemTime(1_000_000);
        Damage.damageBase(1, d);
        expect(el.classList.contains('base-hit-shake')).toBe(true);
        expect(el.classList.contains('base-hit-flash')).toBe(true);

        jest.advanceTimersByTime(CONFIG.BASE_SHAKE_DURATION_MS);
        expect(el.classList.contains('base-hit-shake')).toBe(false);

        jest.setSystemTime(1_000_000 + CONFIG.BASE_SHAKE_COOLDOWN_MS - 1);
        Damage.damageBase(1, d);
        expect(el.classList.contains('base-hit-shake')).toBe(false);
        expect(el.classList.contains('base-hit-flash')).toBe(true); // flash on every hit

        jest.advanceTimersByTime(400);
        jest.setSystemTime(1_000_000 + CONFIG.BASE_SHAKE_COOLDOWN_MS);
        Damage.damageBase(1, d);
        expect(el.classList.contains('base-hit-shake')).toBe(true);
    });

    test('cooldown is 3 seconds (Jeremy, 2026-10-20)', () => {
        expect(CONFIG.BASE_SHAKE_COOLDOWN_MS).toBe(3000);
    });
});

describe('under-attack pulse (visual only)', () => {
    const overdue = (extra = {}) => ({ isOverdue: true, type: 'task', ...extra });
    function mk(items, over = {}) {
        const el = document.createElement('div');
        return {
            el,
            deps: {
                baseElement: el,
                getActiveItems: () => items,
                isGameOver: () => false,
                isNonThreatening: (i) => i.type === 'habit' && i.isNegative === true,
                ...over,
            },
        };
    }
    beforeEach(() => { jest.useFakeTimers(); Damage.resetShakeForTests(); document.body.className = ''; });
    afterEach(() => jest.useRealTimers());

    test('pulses every cooldown while a threatening item is overdue', () => {
        const { el, deps } = mk([overdue()]);
        expect(Damage.pulseIfUnderAttack(10_000, deps)).toBe(true);
        expect(el.classList.contains('base-hit-flash')).toBe(true);
        expect(el.classList.contains('base-hit-shake')).toBe(true);
        jest.advanceTimersByTime(400);
        expect(Damage.pulseIfUnderAttack(10_000 + CONFIG.BASE_SHAKE_COOLDOWN_MS - 1, deps)).toBe(false);
        expect(Damage.pulseIfUnderAttack(10_000 + CONFIG.BASE_SHAKE_COOLDOWN_MS, deps)).toBe(true);
        expect(Damage.pulseIfUnderAttack(10_000 + 2 * CONFIG.BASE_SHAKE_COOLDOWN_MS, deps)).toBe(true);
    });
    test('quiet with nothing overdue, only a lurker, or game over', () => {
        expect(Damage.pulseIfUnderAttack(10_000, mk([{ isOverdue: false, type: 'task' }]).deps)).toBe(false);
        expect(Damage.pulseIfUnderAttack(10_000, mk([overdue({ type: 'habit', isNegative: true })]).deps)).toBe(false);
        expect(Damage.pulseIfUnderAttack(10_000, mk([overdue()], { isGameOver: () => true }).deps)).toBe(false);
    });
    test('skipped under fx-off', () => {
        document.body.classList.add('fx-off');
        expect(Damage.pulseIfUnderAttack(10_000, mk([overdue()]).deps)).toBe(false);
    });
    test('a real hit resets the shared timer so the pulse does not double up', () => {
        const { deps } = mk([overdue()]);
        let hp = 100;
        jest.setSystemTime(50_000);
        Damage.damageBase(1, { ...deps, getBaseHealth: () => hp, setBaseHealth: (n) => { hp = n; }, baseHealthDisplay: null, saveGame: () => {} });
        expect(Damage.pulseIfUnderAttack(50_000 + 1000, deps)).toBe(false);
        expect(Damage.pulseIfUnderAttack(50_000 + CONFIG.BASE_SHAKE_COOLDOWN_MS, deps)).toBe(true);
    });
    test('changes no health and never calls save', () => {
        let saved = 0; let hp = 80;
        const { deps } = mk([overdue()], { saveGame: () => { saved++; }, getBaseHealth: () => hp });
        Damage.pulseIfUnderAttack(10_000, deps);
        expect(saved).toBe(0);
        expect(hp).toBe(80);
    });
});

describe('strips, CSS and sw.js agree', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css/gameCanvas.css'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

    test.each(Damage.BASE_ANIM_STATES.map((k) => [k]))('base_%s_anim', (key) => {
        const file = `Assets/Base/base_${key}_anim.png`;
        const { w, h } = pngSize(path.join(ROOT, file));
        expect(h).toBe(FRAME_H);
        expect(w % FRAME_W).toBe(0);

        const rule = new RegExp(`#base\\[data-base-anim="${key}"\\]\\s*\\{([^}]*)\\}`).exec(css);
        expect(rule).not.toBeNull();
        expect(rule[1]).toContain(`base_${key}_anim.png`);
        const frames = /--base-frames:\s*(\d+)/.exec(rule[1]);
        expect(frames).not.toBeNull();
        expect(Number(frames[1])).toBe(w / FRAME_W);

        expect(sw).toContain(`'${file}'`);
    });

    test('every strip on disk is registered in BASE_ANIM_STATES', () => {
        const onDisk = fs.readdirSync(path.join(ROOT, 'Assets/Base'))
            .map((f) => /^base_(\d{3})_anim\.png$/.exec(f)).filter(Boolean).map((m) => m[1]);
        expect(onDisk.sort()).toEqual([...Damage.BASE_ANIM_STATES].sort());
    });
});
