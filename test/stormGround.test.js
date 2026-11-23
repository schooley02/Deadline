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
    test('the storm lane + churchyard match the dry ones: lane 640x36, yard 280x36 art (chunky pixels: drawn 2x in landscape, 1:1 on the strip; 2026-11-22)', () => {
        expect(pngSize('Assets/scene/storm-lane-2track.png')).toEqual({ w: 640, h: 36 });
        expect(pngSize('Assets/scene/storm-lane-yard.png')).toEqual({ w: 280, h: 36 });
        expect(pngSize('Assets/scene/lane-2track.png')).toEqual({ w: 640, h: 36 });
        expect(pngSize('Assets/scene/lane-yard.png')).toEqual({ w: 280, h: 36 });
    });

    test('all four lane pictures are in the service worker APP_SHELL (the old -strip copies are not) and the cache was bumped past v405', () => {
        ['lane-2track', 'lane-yard', 'storm-lane-2track', 'storm-lane-yard'].forEach((n) => expect(sw).toContain("'Assets/scene/" + n + ".png'"));
        expect(sw).not.toContain('lane-2track-strip.png');
        expect(sw).not.toContain('lane-yard-strip.png');
        expect(Number(/deadline-shell-v(\d+)/.exec(sw)[1])).toBeGreaterThanOrEqual(406);
    });
});

describe('storm ground css', () => {
    test('the canvas ground swaps its picture only under climate-storm, at the tile\'s real size', () => {
        expect(css).toMatch(/#gameCanvas\.climate-storm \.scene-ground \{\s*background-image: url\("\.\.\/Assets\/scene\/storm-lane-yard\.png"\), url\("\.\.\/Assets\/scene\/storm-lane-2track\.png"\);\s*background-size: 560px 72px, 1280px 72px;/);
    });

    test('the phone strip floor swaps only under climate-storm, at the strip tile\'s real size', () => {
        expect(css).toMatch(/body\.glance-strip #gameCanvas\.climate-storm::before \{\s*background-image: url\("\.\.\/Assets\/scene\/storm-lane-yard\.png"\), url\("\.\.\/Assets\/scene\/storm-lane-2track\.png"\);\s*background-size: 280px 36px, 640px 36px;/);
    });

    test('no other band mentions the storm tiles', () => {
        const uses = css.split('url("../Assets/scene/storm-').length - 1;
        expect(uses).toBe(4); // yard + lane, landscape and strip (the same two files in both rules)
    });
});

describe('haze and fog run the full width, behind the church (2026-11-07)', () => {
    const html = read('index.html');
    const view = read('js/ui/villageView.js');
    const strip = read('css/glanceStrip.css');
    const block = (sel) => new RegExp('\\n' + sel.replace(/[.#>]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css)[1];

    test('the village veils and wrappers start at the canvas left edge, with no mask (a mask start beside the church is what drew the line)', () => {
        expect(block('.village-haze')).toMatch(/left: 0;/);
        expect(block('.village-haze')).not.toMatch(/mask/);
        expect(block('.village-wx')).toMatch(/left: 0;/);
        expect(css).not.toMatch(/\.village-wx \{[^}]*mask/);
    });

    test('the church is lifted above the village layer (z 1, later in the DOM) so the veils and fog pass behind it; zombies stay above', () => {
        expect(css).toMatch(/\n#base \{ z-index: 3; \}/);
        expect(html.indexOf('id="villageLayer"')).toBeLessThan(html.indexOf('id="base"'));
        // (the moonbeam, .climate-beam, was removed 2026-11-09, Jeremy: nothing left over the church to order against)
        expect(html).not.toContain('climate-beam');
    });

    test('the near film is full width and behind the church (z -1, after the ground in the DOM), no mask', () => {
        const near = block('.climate-near');
        expect(near).toMatch(/z-index: -1;/);
        expect(near).toMatch(/inset: 0;/);
        expect(near).not.toMatch(/mask/);
        expect(html.indexOf('id="climateNear"')).toBeGreaterThan(html.indexOf('scene-ground'));
    });

    test('no leftover back layers (they are not needed any more) and the strip list does not name them', () => {
        expect(html).not.toContain('climateHazeBack');
        expect(html).not.toContain('climateWxBack');
        expect(css).not.toContain('climate-haze-back');
        expect(css).not.toContain('climate-wx-back');
        expect(strip).not.toContain('climate-haze-back');
        expect(view).not.toContain("setProperty('--hz-left', plan.left + 'px'); //");
    });
});
