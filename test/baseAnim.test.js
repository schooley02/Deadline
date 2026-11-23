/**
 * @jest-environment jsdom
 *
 * Animated church loops + throttled hit shake (V4 follow-up, 2026-10-20); angled base wired 2026-11-22
 * (184x200 frames, 16 frames at 8 fps, idle + attack strips, 25% smoke layer).
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
const FRAME_W = 184;
const FRAME_H = 200;
const FRAMES = 16;

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
        [0, '000'],
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
    test('0% has an idle strip of its own and no attack strip', () => {
        const el = document.createElement('div');
        Damage.applyBaseArt(el, 90);
        el.dataset.baseAttack = '1';
        Damage.applyBaseArt(el, 0);
        expect(el.style.backgroundImage).toBe('url("Assets/Base/base_000.png")');
        expect(el.dataset.baseAnim).toBe('000');
        expect(el.dataset.baseAttack).toBeUndefined();
    });
    test('a state keeps its attack flag when the art is re-applied for the same state', () => {
        const el = document.createElement('div');
        Damage.applyBaseArt(el, 90);
        el.dataset.baseAttack = '1';
        Damage.applyBaseArt(el, 80);
        expect(el.dataset.baseAttack).toBe('1');
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
    test('iced attackers do not make the church flash or shake (docs/ICE_PLAN.md)', () => {
        const a = overdue({ id: 1 }); const b = overdue({ id: 2 });
        const iced = (it) => it === a;
        const { el, deps } = mk([a], { isIced: iced });
        expect(Damage.pulseIfUnderAttack(10_000, deps)).toBe(false);
        expect(el.classList.contains('base-hit-flash')).toBe(false);
        expect(el.classList.contains('base-hit-shake')).toBe(false);
        // one iced + one live attacker: the live one still pulses
        expect(Damage.pulseIfUnderAttack(10_000, mk([a, b], { isIced: iced }).deps)).toBe(true);
        // no isIced dep: unchanged behaviour
        expect(Damage.pulseIfUnderAttack(20_000, mk([a]).deps)).toBe(true);
    });
    test('changes no health and never calls save', () => {
        let saved = 0; let hp = 80;
        const { deps } = mk([overdue()], { saveGame: () => { saved++; }, getBaseHealth: () => hp });
        Damage.pulseIfUnderAttack(10_000, deps);
        expect(saved).toBe(0);
        expect(hp).toBe(80);
    });
});

describe('under-attack strip (data-base-attack)', () => {
    const overdue = (extra = {}) => ({ isOverdue: true, type: 'task', ...extra });
    function mk(items, over = {}) {
        const el = document.createElement('div');
        Damage.applyBaseArt(el, 90);
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

    test('on while a threatening overdue zombie is dealing damage, off again when it is gone', () => {
        let items = [overdue()];
        const { el, deps } = mk(items, { getActiveItems: () => items });
        expect(Damage.syncBaseAttack(deps)).toBe(true);
        expect(el.dataset.baseAttack).toBe('1');
        items = [{ isOverdue: false, type: 'task' }];
        expect(Damage.syncBaseAttack(deps)).toBe(false);
        expect(el.dataset.baseAttack).toBeUndefined();
    });
    test('off for nothing overdue, a lurker, game over, or only iced attackers', () => {
        expect(Damage.syncBaseAttack(mk([{ isOverdue: false, type: 'task' }]).deps)).toBe(false);
        expect(Damage.syncBaseAttack(mk([overdue({ type: 'habit', isNegative: true })]).deps)).toBe(false);
        expect(Damage.syncBaseAttack(mk([overdue()], { isGameOver: () => true }).deps)).toBe(false);
        const a = overdue({ id: 1 });
        const b = overdue({ id: 2 });
        const iced = (it) => it === a;
        expect(Damage.syncBaseAttack(mk([a], { isIced: iced }).deps)).toBe(false);
        expect(Damage.syncBaseAttack(mk([a, b], { isIced: iced }).deps)).toBe(true);
    });
    test('never on at 0% (no attack strip), even with attackers overdue', () => {
        const { el, deps } = mk([overdue()]);
        Damage.applyBaseArt(el, 0);
        expect(Damage.syncBaseAttack(deps)).toBe(false);
        expect(el.dataset.baseAttack).toBeUndefined();
    });
    test('ignores fx-off (the strip swap is not a flash) and a null element', () => {
        document.body.className = 'fx-off';
        const { el, deps } = mk([overdue()]);
        expect(Damage.syncBaseAttack(deps)).toBe(true);
        expect(el.dataset.baseAttack).toBe('1');
        document.body.className = '';
        expect(Damage.syncBaseAttack({ baseElement: null })).toBe(false);
    });
    test('the loop wires it next to the pulse', () => {
        const src = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
        expect(src).toMatch(/Damage\.pulseIfUnderAttack\(Date\.now\(\), attackDeps\);\s*Damage\.syncBaseAttack\(attackDeps\);/);
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
        expect(w / FRAME_W).toBe(FRAMES);

        expect(sw).toContain(`'${file}'`);
    });

    test.each(Damage.BASE_ATTACK_STATES.map((k) => [k]))('base_%s_attack', (key) => {
        const file = `Assets/Base/base_${key}_attack.png`;
        const { w, h } = pngSize(path.join(ROOT, file));
        expect(h).toBe(FRAME_H);
        expect(w).toBe(FRAME_W * FRAMES); // same frame count as the idle strip, so --base-frames covers both
        const rule = new RegExp(`#base\\[data-base-anim="${key}"\\]\\[data-base-attack\\]\\s*\\{([^}]*)\\}`).exec(css);
        expect(rule).not.toBeNull();
        expect(rule[1]).toContain(`base_${key}_attack.png`);
        expect(sw).toContain(`'${file}'`);
    });

    test('0% has no attack strip', () => {
        expect(Damage.BASE_ATTACK_STATES).not.toContain('000');
        expect(fs.existsSync(path.join(ROOT, 'Assets/Base/base_000_attack.png'))).toBe(false);
    });

    test('the static stills are 184x200 and in sw.js', () => {
        ['000', '025', '050', '075', '100'].forEach((key) => {
            const file = `Assets/Base/base_${key}.png`;
            const { w, h } = pngSize(path.join(ROOT, file));
            expect([w, h]).toEqual([FRAME_W, FRAME_H]);
            expect(sw).toContain(`'${file}'`);
        });
    });

    test('the loop frame geometry is 368x400 (2x), 8 fps', () => {
        const base = /#base \{([^}]*)\}/.exec(css)[1];
        expect(base).toMatch(/--base-fw:\s*368px/);
        expect(base).toMatch(/--base-fh:\s*400px/);
        expect(base).toMatch(/--base-fps:\s*8/);
        expect(base).toMatch(/width:\s*var\(--base-w, 188px\)/);
    });

    test('the church shows the right part of the art: --base-w per screen, the portrait strip shows 76px', () => {
        expect(css).toMatch(/#gameCanvas \{ --base-w: 188px; \}/);
        expect(css).toMatch(/min-width: 1280px\) and \(min-height: 521px\)\s*\{ #gameCanvas \{ --base-w: 368px; \}/);
        const glance = fs.readFileSync(path.join(ROOT, 'css/glanceStrip.css'), 'utf8');
        expect(glance).toMatch(/body\.glance-strip #gameCanvas \{ --base-w: 92px; \}/);
        // the strip draws the church at full size (184x200, 1:1 with the file); half size made the enemies look giant (see css/glanceStrip.css)
        expect(glance).toMatch(/--base-fw:\s*184px/);
        expect(glance).toMatch(/--base-fh:\s*200px/);
    });
});

describe('25% smoke layer', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css/gameCanvas.css'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

    test('the sheet is 8 x 10 frames of 448x306 art px (3584x3060) and in sw.js', () => {
        const { w, h } = pngSize(path.join(ROOT, 'Assets/Base/base_025_smoke_layer.png'));
        expect([w, h]).toEqual([8 * 448, 10 * 306]);
        expect(sw).toContain("'Assets/Base/base_025_smoke_layer.png'");
    });
    test('shown on screen at 2x (896x612) and stepped through the grid', () => {
        const rule = /#baseSmoke \{([^}]*)\}/.exec(css)[1];
        expect(rule).toMatch(/width:\s*896px/);
        expect(rule).toMatch(/height:\s*612px/);
        expect(rule).toMatch(/7168px 6120px/);
        expect(rule).toMatch(/steps\(8\)/);
        expect(rule).toMatch(/steps\(10\)/);
        expect(css).toMatch(/@keyframes base-smoke-x[\s\S]*?-7168px/);
        expect(css).toMatch(/@keyframes base-smoke-y[\s\S]*?-6120px/);
    });
    test('only at 25%, never in the portrait strip', () => {
        expect(css).toMatch(/#gameCanvas:has\(#base\[data-base-anim="025"\]\) #baseSmokeClip \{ display: block; \}/);
        expect(css).toMatch(/body\.glance-strip #baseSmokeClip \{ display: none !important; \}/);
    });
    test('sits directly behind #base in the DOM, above the village layer and its haze (z 2) and under the church (z 3)', () => {
        const smoke = html.indexOf('id="baseSmokeClip"');
        const base = html.indexOf('<div id="base"></div>');
        expect(smoke).toBeGreaterThan(-1);
        expect(smoke).toBeLessThan(base);
        expect(/#baseSmokeClip \{([^}]*)\}/.exec(css)[1]).toMatch(/z-index: 2;/);
        expect(/#baseSmoke \{([^}]*)\}/.exec(css)[1]).not.toMatch(/z-index/);
        expect(fs.readFileSync(path.join(__dirname, '..', 'css', 'climate.css'), 'utf8')).toMatch(/#base \{ z-index: 3; \}/);
    });
    test('holds still under fx-off and reduced motion', () => {
        expect(css).toMatch(/body\.fx-off #baseSmoke \{ animation: none; \}/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ #baseSmoke \{ animation: none; \} \}/);
    });

});

describe('strip files on disk', () => {
    test('every strip on disk is registered in BASE_ANIM_STATES / BASE_ATTACK_STATES', () => {
        const files = fs.readdirSync(path.join(ROOT, 'Assets/Base'));
        const idle = files.map((f) => /^base_(\d{3})_anim\.png$/.exec(f)).filter(Boolean).map((m) => m[1]);
        const attack = files.map((f) => /^base_(\d{3})_attack\.png$/.exec(f)).filter(Boolean).map((m) => m[1]);
        expect(idle.sort()).toEqual([...Damage.BASE_ANIM_STATES].sort());
        expect(attack.sort()).toEqual([...Damage.BASE_ATTACK_STATES].sort());
    });
});
