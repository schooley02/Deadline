/**
 * Wiring of the past / future canvas look (2026-11-19; DECISIONS 2026-11-19 (view-time look)).
 * Jest never loads script.js or index.html, so the load order, the shell cache and the TimeSliderView hooks are
 * checked from the source, and the CSS contract (what stays full colour, nothing blocks taps) from the stylesheet.
 */
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');

describe('index.html + sw.js', () => {
    const html = read('index.html');
    const sw = read('sw.js');
    test('the stylesheet loads before responsive.css', () => {
        const at = html.indexOf('href="css/viewTimeLook.css"');
        expect(at).toBeGreaterThan(-1);
        expect(at).toBeLessThan(html.indexOf('href="css/responsive.css"'));
    });
    test('the core loads before the view, and the view before TimeSliderView', () => {
        const core = html.indexOf('src="js/viewTimeLook.js"');
        const view = html.indexOf('src="js/ui/viewTimeLookView.js"');
        const slider = html.indexOf('src="js/ui/timeSliderView.js"');
        expect(core).toBeGreaterThan(-1);
        expect(core).toBeLessThan(view);
        expect(view).toBeLessThan(slider);
    });
    test('all three files are in the shell cache', () => {
        ['css/viewTimeLook.css', 'js/viewTimeLook.js', 'js/ui/viewTimeLookView.js'].forEach((f) => {
            expect(sw).toContain("'" + f + "'");
        });
    });
});

describe('TimeSliderView reports the time on screen', () => {
    const src = read('js/ui/timeSliderView.js');
    const body = (name) => {
        const start = src.indexOf('function ' + name + '(');
        expect(start).toBeGreaterThan(-1);
        const next = src.indexOf('\n    function ', start + 10);
        return src.slice(start, next === -1 ? undefined : next);
    };
    test('syncHandle (live tick, day-pager jumps, Now) and both scrub branches call reportViewTime', () => {
        expect(body('syncHandle')).toContain('reportViewTime(time)');
        const scrub = body('handleScrubInput');
        expect(scrub).toContain('reportViewTime(otherTime)');
        expect(scrub).toContain('reportViewTime(previewTime)');
    });
    test('live = not parked and Today on screen; the view is optional', () => {
        const r = body('reportViewTime');
        expect(r).toContain("typeof ViewTimeLookView === 'undefined'");
        expect(r).toContain('!isParked() && viewedOffset() === 0');
    });
});

describe('css/viewTimeLook.css contract', () => {
    const css = read('css/viewTimeLook.css');
    test('the layers never take taps', () => {
        expect(css).toMatch(/\.view-look-tint,\s*\.view-look-fx\s*\{[^}]*pointer-events:\s*none/);
    });
    test('the tint sits just under the zombie band and the effects under the Nights counter and HUD', () => {
        expect(css).toMatch(/\.view-look-tint\s*\{\s*z-index:\s*29;/);
        expect(css).toMatch(/\.view-look-fx\s*\{\s*z-index:\s*88;/);
    });
    test('zombies are tinted through --g-ghost only (first in the glow chain), never a filter on .enemy', () => {
        expect(css).toContain('--g-ghost: var(--view-look-past-filter)');
        expect(css).toContain('--g-ghost: var(--view-look-future-filter)');
        expect(css).not.toMatch(/\.enemy\s*\{[^}]*filter:/);
        const chain = read('css/enemyStatus.css').match(/filter:\s*var\(--g-ghost,\)([^;]*);/);
        expect(chain).not.toBeNull(); // --g-ghost still leads the chain, so the glows after it keep their colour
    });
    test('no filter on the run graves wrapper or the scene wrappers (stacking contexts)', () => {
        expect(css).not.toMatch(/\.run-graves\s*\{/);
        expect(css).not.toMatch(/#graveyardScene\s*\{[^}]*filter/);
        expect(css).not.toMatch(/#gameCanvas\.view-look-(past|future)\s*\{[^}]*filter/);
    });
    test('moving parts only with full effects and motion allowed', () => {
        const anims = css.match(/animation:\s*view-look-[a-z]+/g) || [];
        expect(anims.length).toBe(4);
        const motionBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
        anims.forEach((a) => expect(motionBlock).toContain(a));
        expect(css).toContain('body:not(.fx-reduced):not(.fx-off)');
    });
});
