/**
 * V7 W0 wiring checks (2026-10-28): things Jest can verify about the graveyard zone without
 * loading script.js -- shell list, script order, CSS/CONFIG agreement, portrait hiding, and the
 * parked-zombie rule in Clock. Live behaviour is checked in a browser (script.js is not loaded).
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const Clock = require('../js/clock.js');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const css = read('css/graveyard.css');
const strip = read('css/glanceStrip.css');

describe('shell + load order', () => {
    test.each(['css/graveyard.css', 'js/graveyardLayout.js', 'js/ui/graveyardView.js'])('%s is in the service worker APP_SHELL', f => {
        expect(sw).toContain(`'${f}'`);
    });

    test('every graveyard file exists on disk', () => {
        ['css/graveyard.css', 'js/graveyardLayout.js', 'js/ui/graveyardView.js'].forEach(f =>
            expect(fs.existsSync(path.join(__dirname, '..', f))).toBe(true));
    });

    test('layout module loads before the view, both before script.js; graveyard.css before glanceStrip.css', () => {
        const at = s => html.indexOf(`"${s}"`); // the tag's src/href, not a comment mention
        expect(at('js/graveyardLayout.js')).toBeGreaterThan(at('js/config.js'));
        expect(at('js/graveyardLayout.js')).toBeLessThan(at('js/ui/graveyardView.js'));
        expect(at('js/ui/graveyardView.js')).toBeLessThan(at('script.js'));
        expect(at('css/graveyard.css')).toBeGreaterThan(0);
        expect(at('css/graveyard.css')).toBeLessThan(at('css/glanceStrip.css'));
        expect(at('css/glanceStrip.css')).toBeLessThan(at('css/responsive.css'));
    });

    test('the zone, its stone layer and the run-grave layer exist inside #gameCanvas', () => {
        const canvas = html.slice(html.indexOf('id="gameCanvas"'), html.indexOf('id="base"') + 30);
        expect(canvas).toContain('id="graveyardZone"');
        expect(canvas).toContain('id="graveyardStones"');
        expect(canvas).toContain('id="runGraves"');
    });

    test('the old V1 fence/ground SVG leftovers are gone', () => {
        expect(html).not.toContain('scene-fence');
        expect(html).not.toContain('scene-ground-fill');
        expect(read('css/gameCanvas.css')).not.toContain('scene-fence');
    });

    test('the run-grave wrapper has no z-index (it would flatten the per-lane z-indexes)', () => {
        const block = css.slice(css.indexOf('.run-graves {'), css.indexOf('}', css.indexOf('.run-graves {')));
        expect(block).not.toMatch(/z-index/);
    });
});

describe('CSS agrees with CONFIG', () => {
    test('fallback hill width in graveyard.css equals CONFIG.GRAVEYARD_HILL_WIDTH_PX', () => {
        expect(css).toMatch(new RegExp(`--gy-hill-w:\\s*${CONFIG.GRAVEYARD_HILL_WIDTH_PX}px`));
    });

    test('the portrait strip hides both layers', () => {
        expect(strip).toMatch(/body\.glance-strip \.graveyard-zone,\s*body\.glance-strip \.run-graves\s*\{\s*display:\s*none/);
    });

    test('headstone and run-grave tap boxes meet the 44px minimum', () => {
        expect(CONFIG.GRAVEYARD_STONE_HIT_PX).toBeGreaterThanOrEqual(44);
        expect(css).toMatch(/\.graveyard-stone,\s*\.run-grave\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
    });
});

describe('run graves sit just under their lane\'s zombies', () => {
    test('lane z slices start at LIST_Z_MIN + lane * stride, so the grave z (slice start - 1) is below the lane', () => {
        for (let lane = 0; lane < 3; lane++) {
            const sliceStart = CONFIG.LIST_Z_MIN + lane * CONFIG.LIST_Z_LANE_STRIDE;
            expect(sliceStart - 1).toBeLessThan(sliceStart);
            expect(sliceStart - 1).toBeGreaterThanOrEqual(CONFIG.LIST_Z_MIN - 1);
        }
        expect(CONFIG.LIST_Z_MIN + 2 * CONFIG.LIST_Z_LANE_STRIDE - 1).toBeLessThan(80); // under the overlay layers
    });
});

describe('Clock: shrinking gameScreenWidth keeps every zombie off the hill', () => {
    // Even tasks due days from now are placed by the 75-100% zone of the field (the "off-screen right"
    // branch in Clock is unreachable for ordinary items), so the field's right edge is a hard
    // ceiling for a zombie's RIGHT edge. script.js passes canvasWidth - hillWidth as gameScreenWidth.
    const NOW = new Date('2026-10-28T10:00:00');
    const FIELD = 704; // 844 canvas - 140 hill
    const DIMS = { gameScreenWidth: FIELD, baseWidth: 160, enemyWidth: 128, habitEnemyWidth: 128 };
    const due = [
        '2026-10-28T10:30:00', '2026-10-28T12:30:00', '2026-10-28T23:59:00',
        '2026-10-29T10:00:00', '2026-11-05T09:00:00', '2027-01-01T00:00:00',
    ];

    test.each(due)('task due %s ends left of the hill', iso => {
        const x = Clock.calculateTimelinePosition({ type: 'task', dueDateTime: new Date(iso) }, NOW, DIMS);
        expect(x).toBeGreaterThanOrEqual(DIMS.baseWidth);
        expect(x + DIMS.enemyWidth).toBeLessThanOrEqual(FIELD + 0.001);
    });

    test('so does a habit', () => {
        const x = Clock.calculateTimelinePosition({ type: 'habit', dueDateTime: new Date('2026-11-05T09:00:00') }, NOW, DIMS);
        expect(x + DIMS.habitEnemyWidth).toBeLessThanOrEqual(FIELD + 0.001);
    });
});
