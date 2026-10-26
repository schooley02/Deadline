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
        const career = { ...base, heroCategory: 'career', koState: { koAt: 1 } };
        expect(HeroSpotlight.heroLookFor(career, { ...CONFIG, HERO_KO_LOOK: 'faded' }).kind).toBe('emoji');
        expect(HeroSpotlight.heroLookFor(career, { ...CONFIG, HERO_KO_LOOK: 'zombie' }).kind).toBe('zombie');
        expect(HeroSpotlight.hasHeroArt('career', CONFIG)).toBe(false);
        expect(HeroSpotlight.hasHeroArt('other', CONFIG)).toBe(true);
        expect(HeroSpotlight.hasHeroArt('other', {})).toBe(false);
    });
});

describe('head-crop avatars', () => {
    test('art categories get a head crop; others keep the emoji', () => {
        expect(HeroesView.headSrcFor('other', CONFIG)).toBe('Assets/Heroes/other-head.png');
        expect(HeroesView.headSrcFor('career', CONFIG)).toBeNull();
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
        const idle = Array.from({ length: 9 }, (_, f) => edge(meta.animations.idle.row, f));
        const ko = Array.from({ length: 9 }, (_, f) => edge(meta.animations.ko.row, f));
        idle.forEach(e => expect(e).toBe(meta.feetY));
        // KO: frame 1 standing and the last 3 lying frames are grounded (+-1px); the middle fall
        // frames may be airborne (higher = smaller edge) but never BELOW the floor line.
        ko.forEach(e => expect(e).toBeLessThanOrEqual(meta.feetY + 1));
        [0, 6, 7, 8].forEach(f => expect(Math.abs(ko[f] - meta.feetY)).toBeLessThanOrEqual(1));
    });
});
