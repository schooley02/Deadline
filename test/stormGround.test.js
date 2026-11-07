/**
 * Storm ground (2026-11-07): the puddle version of the ground tile. Pins the asset sizes (a wrong size would scale the pixel art
 * off 1:1), that the swap is scoped to the Storm band only, and that the service worker caches both pictures.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
function pngSize(rel) {
    const b = fs.readFileSync(path.join(root, rel));
    expect(b.slice(1, 4).toString()).toBe('PNG');
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const css = read('css/climate.css');
const sw = read('sw.js');

describe('storm ground assets', () => {
    test('the tile is floor-tile.png x4 (508x72, same height) and the strip is strip-floor.png x4 (256x36)', () => {
        expect(pngSize('Assets/scene/storm-floor-tile.png')).toEqual({ w: 508, h: 72 });
        expect(pngSize('Assets/scene/storm-strip-floor.png')).toEqual({ w: 256, h: 36 });
        expect(pngSize('Assets/scene/floor-tile.png')).toEqual({ w: 127, h: 72 });
    });

    test('both are in the service worker APP_SHELL and the cache was bumped past v271', () => {
        expect(sw).toContain("'Assets/scene/storm-floor-tile.png'");
        expect(sw).toContain("'Assets/scene/storm-strip-floor.png'");
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(272);
    });
});

describe('storm ground css', () => {
    test('the canvas ground swaps its picture only under climate-storm, at the tile\'s real size', () => {
        expect(css).toMatch(/#gameCanvas\.climate-storm \.scene-ground \{\s*background-image: url\("\.\.\/Assets\/scene\/storm-floor-tile\.png"\);\s*background-size: 508px 72px;/);
    });

    test('the phone strip floor swaps only under climate-storm, at the strip tile\'s real size', () => {
        expect(css).toMatch(/body\.glance-strip #gameCanvas\.climate-storm::before \{\s*background-image: url\("\.\.\/Assets\/scene\/storm-strip-floor\.png"\);\s*background-size: 256px 36px;/);
    });

    test('no other band mentions the storm tiles', () => {
        const uses = css.split('url("../Assets/scene/storm-').length - 1;
        expect(uses).toBe(2);
    });
});

describe('haze behind the church, fog both sides (2026-11-07)', () => {
    const html = read('index.html');
    const view = read('js/ui/villageView.js');

    test('the near haze film is masked off the church (it starts at --hz-left, the church\'s right edge)', () => {
        const block = /\.climate-near \{([^}]*)\}/.exec(css)[1];
        expect(block).toMatch(/mask-image: linear-gradient\(90deg, transparent var\(--hz-left, 0px\), #000 calc\(var\(--hz-left, 0px\) \+ 32px\)\)/);
    });

    test('villageView publishes --hz-left on the canvas so the near film can use it', () => {
        expect(view).toContain("canvasEl.style.setProperty('--hz-left', plan.left + 'px')");
    });

    test('a haze layer sits behind the church (z -1, before #base) and carries the near, mid, row2 and row1 films over 0..--hz-left', () => {
        expect(html).toMatch(/id="climateHazeBack" class="climate-haze-back" aria-hidden="true"/);
        expect(html.indexOf('id="climateHazeBack"')).toBeLessThan(html.indexOf('id="base"'));
        expect(html.indexOf('id="climateHazeBack"')).toBeGreaterThan(html.indexOf('scene-ground'));
        const block = /\n\.climate-haze-back \{([^}]*)\}/.exec(css)[1];
        expect(block).toMatch(/z-index: -1/);
        expect(block).toMatch(/pointer-events: none/);
        expect(block).toMatch(/left: 0/);
        expect(block).toMatch(/width: calc\(var\(--hz-left, 0px\) \+ 32px\)/);
        ['near', 'mid', 'row2', 'row1'].forEach((k) => expect(html).toContain('<i class="hb--' + k + '"></i>'));
        ['near', 'mid', 'row2', 'row1'].forEach((k) => expect(css).toMatch(new RegExp('\\.hb--' + k + ' \\{ --a: var\\(--clm-' + k + ', 0\\);')));
        expect(css).not.toMatch(/pointer-events:\s*auto/);
    });

    test('no seam: each back film fades out with the exact complement of the veil fading in, a * (1-t)/(1-a*t)', () => {
        const child = /\n\.climate-haze-back > i \{([^}]*)\}/.exec(css)[1];
        expect(child).toContain('calc(0.875 / (1 - 0.125 * var(--a)))');
        expect(child).toContain('calc(0.5 / (1 - 0.5 * var(--a)))');
        expect(child).toContain('calc(0.125 / (1 - 0.875 * var(--a)))');
        // the maths itself: (1 - b)(1 - a t) = 1 - a with b = a (1-t)/(1-a t), for every film and every t
        [0.04, 0.08, 0.16, 0.24, 0.3].forEach((a) => [0, 0.25, 0.5, 0.75, 1].forEach((tt) => {
            const b = a * (1 - tt) / (1 - a * tt);
            expect((1 - b) * (1 - a * tt)).toBeCloseTo(1 - a, 10);
        }));
    });

    test('one fog bank sits behind the church: z -1, after the ground and before #base in the DOM, shown in Fog only, never takes a tap', () => {
        expect(html).toMatch(/id="climateWxBack" class="climate-wx-back" aria-hidden="true"[\s\S]*?fog-bank--back1/);
        expect(html.indexOf('id="climateWxBack"')).toBeLessThan(html.indexOf('id="base"'));
        expect(html.indexOf('id="climateWxBack"')).toBeGreaterThan(html.indexOf('scene-ground'));
        const block = /\n\.climate-wx-back \{([^}]*)\}/.exec(css)[1];
        expect(block).toMatch(/z-index: -1/);
        expect(block).toMatch(/pointer-events: none/);
        expect(css).toContain('#gameCanvas.climate-fog .climate-wx-back { display: block; }');
    });

    test('the phone strip hides both back layers (no weather there: the haze-back feather would show as a line beside the 56px church)', () => {
        const strip = read('css/glanceStrip.css');
        const list = /body\.glance-strip \.weather-badge,[\s\S]*?\{\s*display: none !important;/.exec(strip)[0];
        expect(list).toContain('body.glance-strip .climate-haze-back,');
        expect(list).toContain('body.glance-strip .climate-wx-back,');
    });
});
