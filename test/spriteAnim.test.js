/**
 * @jest-environment jsdom
 *
 * SpriteAnim ([P2-GAME-010] Stage 2a, 2026-10-12): the DOM side of the animated
 * zombie sprites, plus consistency checks between the CSS, the sprite atlas
 * JSONs and CONFIG.ZOMBIE_VISIBLE_MARGINS. The actual animation is CSS and is
 * verified live in the browser (Jest never loads real layout).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
const SpriteAnim = require('../js/spriteAnim.js');

const ROOT = path.join(__dirname, '..');

function makeEnemy() {
    const el = document.createElement('div');
    el.className = 'enemy zombie-sprite zombie-career';
    el.appendChild(document.createElement('span')); // pre-existing child
    return el;
}

describe('scaleForWidth', () => {
    test('maps the box width onto the 128px character', () => {
        expect(SpriteAnim.scaleForWidth(128)).toBe(1);
        expect(SpriteAnim.scaleForWidth(64)).toBe(0.5);
        expect(SpriteAnim.scaleForWidth(256)).toBe(2);
    });
    test('bad input falls back to 1', () => {
        expect(SpriteAnim.scaleForWidth(0)).toBe(1);
        expect(SpriteAnim.scaleForWidth(NaN)).toBe(1);
        expect(SpriteAnim.scaleForWidth(undefined)).toBe(1);
    });
});

describe('attach / syncScale', () => {
    test('adds one window + sheet as the FIRST child and marks the enemy', () => {
        const el = makeEnemy();
        const sprite = SpriteAnim.attach(el, 128);
        expect(el.firstChild).toBe(sprite);
        expect(sprite.className).toBe('enemy-sprite');
        expect(sprite.querySelector('.enemy-sprite-sheet')).not.toBeNull();
        expect(el.classList.contains('has-anim-sprite')).toBe(true);
        expect(sprite.style.getPropertyValue('--sprite-scale')).toBe('1');
    });

    test('sub-task width gives half scale', () => {
        const el = makeEnemy();
        const sprite = SpriteAnim.attach(el, 64);
        expect(sprite.style.getPropertyValue('--sprite-scale')).toBe('0.5');
    });

    test('is idempotent: a second attach re-syncs instead of duplicating', () => {
        const el = makeEnemy();
        SpriteAnim.attach(el, 128);
        SpriteAnim.attach(el, 256);
        expect(el.querySelectorAll('.enemy-sprite').length).toBe(1);
        expect(el.querySelector('.enemy-sprite').style.getPropertyValue('--sprite-scale')).toBe('2');
    });

    test('syncScale only writes the style when the scale changed', () => {
        const el = makeEnemy();
        const sprite = SpriteAnim.attach(el, 128);
        const spy = jest.spyOn(sprite.style, 'setProperty');
        SpriteAnim.syncScale(el, 128);
        SpriteAnim.syncScale(el, 128);
        expect(spy).not.toHaveBeenCalled();
        SpriteAnim.syncScale(el, 256);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('null elements are tolerated', () => {
        expect(SpriteAnim.attach(null, 128)).toBeNull();
        expect(() => SpriteAnim.syncScale(null, 128)).not.toThrow();
        expect(() => SpriteAnim.syncScale(makeEnemy(), 128)).not.toThrow(); // nothing attached
    });
});

describe('assets, CSS and CONFIG stay in agreement', () => {
    const css = fs.readFileSync(path.join(ROOT, 'css/enemyAnim.css'), 'utf8');

    test.each(SpriteAnim.CATEGORIES)('%s: atlas, JSON, CSS and margins are consistent', (cat) => {
        const jsonPath = path.join(ROOT, 'Assets/Zombies/anim', `${cat}.json`);
        expect(fs.existsSync(path.join(ROOT, 'Assets/Zombies/anim', `${cat}.png`))).toBe(true);
        const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        // atlas is referenced by the CSS
        expect(css).toContain(`.zombie-${cat} .enemy-sprite-sheet`);
        expect(css).toContain(`Assets/Zombies/anim/${cat}.png`);

        // cell size: CSS default is 180px; other categories must override it
        if (meta.frameWidth !== 180) {
            const re = new RegExp(`\\.zombie-${cat} \\.enemy-sprite\\s*\\{[^}]*--cell:\\s*${meta.frameWidth}px`);
            expect(css).toMatch(re);
        }

        // frame counts: CSS defaults walk 9 / idle 7 / attack 9; deviations must be overridden
        const defaults = { walk: 9, idle: 7, attack: 9 };
        Object.keys(defaults).forEach((anim) => {
            if (meta.animations[anim].frames !== defaults[anim]) {
                const re = new RegExp(`\\.zombie-${cat} \\.enemy-sprite\\s*\\{[^}]*--n-${anim}:\\s*${meta.animations[anim].frames}\\b`);
                expect(css).toMatch(re);
            }
        });

        // row order the CSS hard-codes: walk 0, idle 1, attack 2, death 3
        expect(meta.animations.walk.row).toBe(0);
        expect(meta.animations.idle.row).toBe(1);
        expect(meta.animations.attack.row).toBe(2);
        expect(meta.animations.death.row).toBe(3);

        // margins in CONFIG match the JSON bodyBox
        const pad = (meta.frameWidth - 128) / 2;
        const left = Math.max(0, (meta.bodyBox.left - pad) / 128);
        const right = Math.max(0, (128 - (meta.bodyBox.right + 1 - pad)) / 128);
        const m = CONFIG.ZOMBIE_VISIBLE_MARGINS[cat];
        // CONFIG stores 3 decimals, so allow rounding (<= 0.001)
        expect(Math.abs(m.left - left)).toBeLessThanOrEqual(0.001);
        expect(Math.abs(m.right - right)).toBeLessThanOrEqual(0.001);
    });

    test('state rows: calm (parked) and lurkers idle, overdue attacks, tiers set walk speed', () => {
        expect(css).toMatch(/\.enemy\.urgency-calm \.enemy-sprite-sheet\s*\{[^}]*--row:\s*1;[^}]*--frames:\s*var\(--n-idle\)/);
        expect(css).toMatch(/\.enemy\.negative-habit \.enemy-sprite-sheet\s*\{[^}]*--row:\s*1/);
        expect(css).toMatch(/\.enemy\.enemy-at-base \.enemy-sprite-sheet\s*\{[^}]*--row:\s*2/);
        expect(css).toMatch(/\.enemy\.urgency-approaching \.enemy-sprite-sheet\s*\{[^}]*--fps:\s*8/);
        expect(css).toMatch(/\.enemy\.urgency-urgent \.enemy-sprite-sheet\s*\{[^}]*--fps:\s*12/);
        // calm must not be given a walk row override
        const calm = css.match(/\.enemy\.urgency-calm \.enemy-sprite-sheet\s*\{[^}]*\}/)[0];
        expect(calm).not.toMatch(/--row:\s*0/);
    });

    test('playback is frame-rate based: cycle length derives from the frame count, never a fixed time', () => {
        expect(css).toMatch(/--sprite-dur:\s*calc\(var\(--frames\)\s*\/\s*var\(--fps\)\s*\*\s*1s\)/);
        // no state/tier rule may hard-code a duration (that is what made 7- and 9-frame cycles run at different speeds)
        expect(css.match(/--sprite-dur:\s*[\d.]+s/g)).toBeNull();
        expect(css).not.toMatch(/animation-duration:\s*[\d.]+s/);
    });

    test('effective fps: same state => same fps for every category, whatever its frame count', () => {
        const fpsOf = { walkApproaching: 8, walkUrgent: 12, idle: 5, attack: 8 };
        const durations = (frames, fps) => frames / fps;
        SpriteAnim.CATEGORIES.forEach((cat) => {
            const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'Assets/Zombies/anim', `${cat}.json`), 'utf8'));
            // cycle length * fps recovers the frame count exactly, i.e. playback speed does not depend on it
            expect(durations(meta.animations.walk.frames, fpsOf.walkUrgent) * fpsOf.walkUrgent).toBe(meta.animations.walk.frames);
            expect(durations(meta.animations.attack.frames, fpsOf.attack)).toBeCloseTo(meta.animations.attack.frames / 8, 9);
        });
        // sanity: the longest cycle anywhere stays calm enough to read (>= 0.5s for urgent walk, >= 0.8s idle)
        expect(7 / fpsOf.walkUrgent).toBeGreaterThanOrEqual(0.5);
        expect(7 / fpsOf.idle).toBeGreaterThanOrEqual(0.8);
    });

    test('atlas PNG dimensions are 9 columns x 4 rows of cells', () => {
        SpriteAnim.CATEGORIES.forEach((cat) => {
            const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'Assets/Zombies/anim', `${cat}.json`), 'utf8'));
            const buf = fs.readFileSync(path.join(ROOT, 'Assets/Zombies/anim', `${cat}.png`));
            expect(buf.readUInt32BE(16)).toBe(meta.frameWidth * 9);
            expect(buf.readUInt32BE(20)).toBe(meta.frameHeight * 4);
        });
    });

    test('service worker caches every atlas and the new files, never _source', () => {
        const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
        SpriteAnim.CATEGORIES.forEach((cat) => expect(sw).toContain(`'Assets/Zombies/anim/${cat}.png'`));
        expect(sw).toContain("'css/enemyAnim.css'");
        expect(sw).toContain("'js/spriteAnim.js'");
        expect(sw).not.toMatch(/'Assets\/Zombies\/anim\/_source/);
    });

    test('index.html loads the new CSS and script', () => {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        expect(html).toContain('css/enemyAnim.css');
        expect(html).toContain('js/spriteAnim.js');
        expect(html.indexOf('href="css/enemyAnim.css"')).toBeLessThan(html.indexOf('href="css/responsive.css"'));
        expect(html.indexOf('src="js/spriteAnim.js"')).toBeLessThan(html.indexOf('src="js/spawning.js"'));
    });
});
