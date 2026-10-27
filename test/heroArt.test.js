/**
 * Hero ART integration (HERO_SPOTLIGHT_PLAN sub-session 4, 2026-10-25): Other Hero atlas,
 * KO timing (play once, hold the last frame, restart), head-crop avatars, cache list.
 * DOM rendering is live-checked in the browser; this pins the numbers the CSS, config,
 * JSON and PNG must agree on.
 */
const fs = require('fs');
const path = require('path');
global.Heroes = require('../js/heroes.js');
const CONFIG = require('../js/config.js');
const HeroSpotlight = require('../js/ui/heroSpotlight.js');
const HeroesView = require('../js/ui/heroes.js');

let PNG = null;
try { PNG = require('pngjs').PNG; } catch (e) { /* optional dependency, same as spriteFeet.test.js */ }

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('css/heroSpotlight.css');
const sw = read('sw.js');
const ART = CONFIG.HERO_ART_CATEGORIES;

describe('config', () => {
    test('art categories are real hero categories; KO timing is sane', () => {
        expect(ART.length).toBeGreaterThan(0);
        ART.forEach(c => expect(CONFIG.HERO_CATEGORIES).toContain(c));
        expect(CONFIG.HERO_KO_FPS).toBeGreaterThan(0);
        expect(CONFIG.HERO_KO_HOLD_MS).toBe(3000); // Jeremy 2026-10-25: pause 3 s on the last frame
    });
});

describe('KO animation never loops without the hold (css <-> config)', () => {
    const frames = 9;
    const play = frames / CONFIG.HERO_KO_FPS;
    const total = play + CONFIG.HERO_KO_HOLD_MS / 1000;

    test('the animation duration is play time + hold', () => {
        const m = css.match(/\[data-anim="ko"\] \.hero-sprite-sheet \{[^}]*animation:\s*hero-ko\s+([\d.]+)s\s+linear\s+infinite/);
        expect(m).not.toBeNull();
        expect(Number(m[1])).toBeCloseTo(total, 3);
    });

    test('the last frame is reached at play/total and held to 100%', () => {
        const block = css.match(/@keyframes hero-ko \{([\s\S]*?)\n\}/)[1];
        const stops = [...block.matchAll(/([\d.]+)%\s*\{\s*transform:\s*translate3d\((-?\d+)(?:px)?/g)].map(x => [Number(x[1]), Number(x[2])]);
        expect(stops).toEqual([[0, 0], [expect.closeTo(play / total * 100, 2), -1312], [100, -1312]]);
        expect(block).toMatch(/steps\(9, jump-none\)/);
        expect(-1312).toBe(-(frames - 1) * 164);
    });

    test('effects-off / reduced motion hold the FINAL frame, not frame 1', () => {
        expect(css).toMatch(/\.fx-off \.hero-sprite\[data-anim="ko"\] \.hero-sprite-sheet \{ transform: translate3d\(-1312px/);
    });

    test('the KO animation is not faded', () => {
        expect(css).toMatch(/\.hero-spotlight--ko\.hero-spotlight--atlas \{ filter: none; \}/);
    });
});

describe('hero size fit (2026-10-26)', () => {
    test('every art category has a --hero-fit of at least 1; scale = base x fit; portrait base 0.5', () => {
        CONFIG.HERO_ART_CATEGORIES.forEach(cat => {
            const m = css.match(new RegExp(`\\.hero-spotlight--atlas\\[data-category="${cat}"\\] \\{ --hero-fit: ([0-9.]+); \\}`));
            expect(m).not.toBeNull();
            expect(parseFloat(m[1])).toBeGreaterThanOrEqual(1);
            expect(parseFloat(m[1])).toBeLessThanOrEqual(1.5);
        });
        expect(css).toMatch(/--hero-scale: calc\(var\(--hero-base\) \* var\(--hero-fit\)\);/);
        expect(css).toMatch(/body\.glance-strip \.hero-spotlight--atlas \{\s*--hero-base: 0\.5;/);
    });
});

describe('hero lane position (2026-10-26)', () => {
    test('atlas heroes take their feet line from --hero-lane-bottom, defaulting to the old spots', () => {
        expect(css).toMatch(/bottom: calc\(var\(--hero-lane-bottom, 8px\) - \(var\(--hero-cell\) - var\(--hero-feet\)\) \* var\(--hero-scale\)\);/);
        expect(css).toMatch(/bottom: calc\(var\(--hero-lane-bottom, 2px\) - \(var\(--hero-cell\) - var\(--hero-feet\)\) \* var\(--hero-scale\)\);/);
    });
});

describe('selected row outline (2026-10-26)', () => {
    test('css outlines the row whose hero is held', () => {
        expect(css).toMatch(/li\.hero-selected-list-item \{\s*outline: 2px solid/);
    });
});

describe('hurtloop row (2026-10-26)', () => {
    test('css loops the hurt row with the same frames/fps as the one-shot', () => {
        expect(css).toMatch(new RegExp(`\\.hero-sprite\\[data-anim="hurtloop"\\] \\{ --hero-row: 2; --hero-oneshot-frames: 9; --hero-oneshot-fps: ${CONFIG.HERO_HURT_FPS}; \\}`));
        expect(css).toMatch(/\[data-anim="hurtloop"\] \.hero-sprite-sheet \{\s*animation: hero-oneshot[^;]*infinite;/);
        expect(css).toMatch(/\.hero-spotlight\[data-category="health"\] \.hero-sprite\[data-anim="hurtloop"\] \{ --hero-oneshot-frames: 7; \}/);
    });
});

describe('hurt / levelup one-shot rows (css <-> config <-> json)', () => {
    test('config defaults match the css vars', () => {
        expect(CONFIG.HERO_ONESHOT_FPS).toBeGreaterThan(0);
        expect(css).toMatch(new RegExp(`--hero-oneshot-frames: ${CONFIG.HERO_ONESHOT_FRAMES}; --hero-oneshot-fps: ${CONFIG.HERO_ONESHOT_FPS};`));
        expect(css).toMatch(/\.hero-sprite\[data-anim="hurt"\] \{ --hero-row: 2; \}/);
        expect(css).toMatch(/\.hero-sprite\[data-anim="levelup"\] \{ --hero-row: 3; \}/);
        expect(css).toMatch(/steps\(var\(--hero-oneshot-frames\), jump-none\) 1 forwards/);
    });

    test.each(ART)('%s: configured frame counts equal the atlas json, overrides are in the css', (cat) => {
        const meta = JSON.parse(read(`Assets/Heroes/anim/${cat}.json`));
        ['hurt', 'levelup'].forEach(kind => {
            expect(meta.animations[kind].loop).toBe(false);
            expect(HeroSpotlight.oneShotFrames(kind, cat, CONFIG)).toBe(meta.animations[kind].frames);
            if (meta.animations[kind].frames !== CONFIG.HERO_ONESHOT_FRAMES) {
                expect(css).toMatch(new RegExp(`data-category="${cat}"\\] \\.hero-sprite\\[data-anim="${kind}"\\]`));
            }
        });
        expect(meta.animations.hurt.row).toBe(2);
        expect(meta.animations.levelup.row).toBe(3);
    });
});

describe('every hurt animation runs at HERO_HURT_FPS (2026-10-26)', () => {
    test('one-shot hurt and the attacked loop share the slower fps with the css', () => {
        expect(CONFIG.HERO_HURT_FPS).toBeGreaterThan(0);
        expect(CONFIG.HERO_HURT_FPS).toBeLessThan(CONFIG.HERO_ONESHOT_FPS);
        expect(css).toMatch(new RegExp(`\\.hero-sprite\\[data-anim="hurt"\\] \\{ --hero-oneshot-frames: 9; --hero-oneshot-fps: ${CONFIG.HERO_HURT_FPS}; \\}`));
        expect(css).toMatch(new RegExp(`\\[data-anim="hurtloop"\\] \\{ --hero-row: 2; --hero-oneshot-frames: 9; --hero-oneshot-fps: ${CONFIG.HERO_HURT_FPS}; \\}`));
    });
    test.each(['career', 'financial'])('%s: the one-shot hurt lasts frames / HERO_HURT_FPS (matches the css animation)', (cat) => {
        const frames = HeroSpotlight.oneShotFrames('hurt', cat, CONFIG);
        expect(HeroSpotlight.oneShotMs('hurt', cat, CONFIG)).toBe(Math.round(frames / CONFIG.HERO_HURT_FPS * 1000));
        expect(HeroSpotlight.oneShotMs('levelup', cat, CONFIG)).toBe(Math.round(9 / CONFIG.HERO_ONESHOT_FPS * 1000));
    });
});

describe('all 8 heroes show the hurt loop when attacked (2026-10-26)', () => {
    test.each(ART)('%s: an attacked hero loops hurt, a calm one idles, a KO\'d one stays KO', (cat) => {
        const hero = { id: 'h-' + cat, name: cat, isActive: true, frozenState: null, koState: null, heroCategory: cat };
        expect(HeroSpotlight.heroLookFor(hero, CONFIG, { underAttack: true })).toMatchObject({ kind: 'atlas', category: cat, anim: 'hurtloop' });
        expect(HeroSpotlight.heroLookFor(hero, CONFIG, { underAttack: false }).anim).toBe('idle');
        expect(HeroSpotlight.heroLookFor({ ...hero, koState: { koAt: 1 } }, CONFIG, { underAttack: true }).anim).toBe('ko');
    });
    test.each(ART)('%s: css gives it a sprite sheet, and the atlas hurt row is row 2 so hurtloop shows it', (cat) => {
        const meta = JSON.parse(read(`Assets/Heroes/anim/${cat}.json`));
        expect(css).toMatch(new RegExp(`data-category="${cat}"\\] \\.hero-sprite-sheet \\{ background-image: url\\('\\.\\./Assets/Heroes/anim/${cat}\\.png'\\); \\}`));
        expect(meta.animations.hurt.row).toBe(2);
        const frames = HeroSpotlight.oneShotFrames('hurt', cat, CONFIG);
        if (frames !== 9) expect(css).toMatch(new RegExp(`data-category="${cat}"\\] \\.hero-sprite\\[data-anim="hurtloop"\\][^{]*\\{ --hero-oneshot-frames: ${frames}; \\}`));
    });
});

describe('attack row on completion (2026-10-26)', () => {
    test('css plays attack (row 1) once with the shared one-shot frames / fps', () => {
        expect(css).toMatch(/\.hero-sprite\[data-anim="attack"\] \{ --hero-row: 1; \}/);
        expect(css).toMatch(/\.hero-sprite\[data-anim="attack"\],\s*\.hero-sprite\[data-anim="levelup"\] \{ --hero-oneshot-frames: 9; --hero-oneshot-fps: 10; \}/);
        expect(css).toMatch(/\.hero-sprite\[data-anim="attack"\] \.hero-sprite-sheet,\s*\.hero-sprite\[data-anim="hurt"\] \.hero-sprite-sheet,\s*\.hero-sprite\[data-anim="levelup"\] \.hero-sprite-sheet \{\s*animation: hero-oneshot[^;]*1 forwards;/);
    });

    test.each(ART)('%s: the atlas attack row is row 1 with the configured frame count (no override needed)', (cat) => {
        const meta = JSON.parse(read(`Assets/Heroes/anim/${cat}.json`));
        expect(meta.animations.attack.row).toBe(1);
        expect(meta.animations.attack.frames).toBe(CONFIG.HERO_ONESHOT_FRAMES);
        expect(HeroSpotlight.oneShotFrames('attack', cat, CONFIG)).toBe(meta.animations.attack.frames);
    });
});

describe('heroLookFor with art', () => {
    const base = { id: 'r', name: 'x', isActive: true, heroCategory: 'other' };
    test('an art category draws the atlas: idle normally, ko when knocked out', () => {
        expect(HeroSpotlight.heroLookFor(base, CONFIG)).toMatchObject({ kind: 'atlas', anim: 'idle', state: 'active' });
        expect(HeroSpotlight.heroLookFor({ ...base, koState: { koAt: 1 } }, CONFIG)).toMatchObject({ kind: 'atlas', anim: 'ko', state: 'ko' });
    });
    test('HERO_KO_LOOK never applies to an art hero (no grey zombie / faded stand-in)', () => {
        const ko = { ...base, koState: { koAt: 1 } };
        expect(HeroSpotlight.heroLookFor(ko, { ...CONFIG, HERO_KO_LOOK: 'zombie' }).kind).toBe('atlas');
    });
    test('a category without art keeps the emoji placeholder and its KO looks', () => {
        // (all 8 categories have art now, so simulate one that doesn't: career with the art list cut to 'other')
        const OTHER_ONLY = { ...CONFIG, HERO_ART_CATEGORIES: ['other'] };
        const career = { ...base, heroCategory: 'career', koState: { koAt: 1 } };
        expect(HeroSpotlight.heroLookFor(career, { ...OTHER_ONLY, HERO_KO_LOOK: 'faded' }).kind).toBe('emoji');
        expect(HeroSpotlight.heroLookFor(career, { ...OTHER_ONLY, HERO_KO_LOOK: 'zombie' }).kind).toBe('zombie');
        expect(HeroSpotlight.hasHeroArt('career', OTHER_ONLY)).toBe(false);
        expect(HeroSpotlight.hasHeroArt('other', CONFIG)).toBe(true);
        expect(HeroSpotlight.hasHeroArt('other', {})).toBe(false);
    });
});

describe('head-crop avatars', () => {
    test('art categories get a head crop; others keep the emoji', () => {
        expect(HeroesView.headSrcFor('other', CONFIG)).toBe('Assets/Heroes/other-head.png');
        expect(HeroesView.headSrcFor('career', { ...CONFIG, HERO_ART_CATEGORIES: ['other'] })).toBeNull();
        expect(HeroesView.headSrcFor('other', {})).toBeNull();
    });
    test('avatarHtml: <img> when there is a head, emoji otherwise', () => {
        expect(HeroesView.avatarHtml({ headSrc: 'Assets/Heroes/other-head.png', emoji: '⭐' })).toMatch(/^<img class="hero-head" src="Assets\/Heroes\/other-head\.png"/);
        expect(HeroesView.avatarHtml({ headSrc: null, emoji: '💼' })).toBe('💼');
        expect(HeroesView.avatarHtml(null)).toBe('');
    });
});

describe('assets + cache list', () => {
    test.each(ART)('%s: atlas, json, head crop exist and are in the service worker shell list', (cat) => {
        ['Assets/Heroes/anim/' + cat + '.png', 'Assets/Heroes/anim/' + cat + '.json', 'Assets/Heroes/' + cat + '-head.png']
            .forEach(f => expect(fs.existsSync(path.join(ROOT, f))).toBe(true));
        expect(sw).toContain(`'Assets/Heroes/anim/${cat}.png'`);
        expect(sw).toContain(`'Assets/Heroes/${cat}-head.png'`);
        expect(css).toContain(`../Assets/Heroes/anim/${cat}.png`);
    });
});

(PNG ? describe : describe.skip)('atlas geometry + feet (css <-> json <-> png)', () => {
    test.each(ART)('%s', (cat) => {
        const meta = JSON.parse(read(`Assets/Heroes/anim/${cat}.json`));
        const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, `Assets/Heroes/anim/${cat}.png`)));
        const cell = meta.frameWidth;
        const rows = Object.values(meta.animations);
        expect(meta.facing).toBe('right');
        expect(cell).toBe(164);
        expect(png.width).toBe(9 * cell);
        expect(png.height).toBe(5 * cell);
        expect(css).toMatch(new RegExp(`--hero-cell: ${cell}px`));
        expect(css).toMatch(new RegExp(`--hero-feet: ${meta.feetY}px`));
        expect(css).toMatch(/width: 1476px/);
        expect(css).toMatch(/--hero-idle-frames: 9;/);
        expect(css).toMatch(/height: 820px/);
        expect(meta.animations.idle.row).toBe(0);
        expect(meta.animations.ko).toMatchObject({ row: 4, frames: 9, loop: false });
        expect(rows.map(r => r.row).sort()).toEqual([0, 1, 2, 3, 4]);

        // Lowest opaque row (bottom EDGE) per frame, idle + ko.
        const edge = (row, f) => {
            for (let y = row * cell + cell - 1; y >= row * cell; y--) {
                for (let x = f * cell; x < (f + 1) * cell; x++) {
                    if (png.data[(y * png.width + x) * 4 + 3] > 20) return y - row * cell + 1;
                }
            }
            return 0;
        };
        // Idle may have fewer than 9 frames (lifestyle: 7); the CSS must say so (--hero-idle-frames).
        const idleN = meta.animations.idle.frames;
        const m = css.match(new RegExp(`data-category="${cat}"\\] \\.hero-sprite \\{ --hero-idle-frames: (\\d+)`));
        expect(m ? Number(m[1]) : 9).toBe(idleN);
        expect(meta.animations.ko.frames).toBe(9); // KO keyframes assume 9 (hurt may be 7: health)
        Object.values(meta.animations).forEach(a => expect(a.frames).toBeLessThanOrEqual(9));
        const idle = Array.from({ length: idleN }, (_, f) => edge(meta.animations.idle.row, f));
        const ko = Array.from({ length: 9 }, (_, f) => edge(meta.animations.ko.row, f));
        idle.forEach(e => expect(e).toBe(meta.feetY));
        // KO: frame 1 standing and the last 3 lying frames are grounded (+-4px); the middle fall
        // frames may be airborne (higher = smaller edge) but never BELOW the floor line.
        // (a prone final frame may sit a few px below the standing line: relationships +2, lifestyle +4)
        ko.forEach(e => expect(e).toBeLessThanOrEqual(meta.feetY + 4));
        [0, 6, 7, 8].forEach(f => expect(Math.abs(ko[f] - meta.feetY)).toBeLessThanOrEqual(4));
    });
});
