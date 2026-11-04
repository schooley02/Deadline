/** Timer sessions (2026-11-04): the new module is loaded by the page and precached, in front of timer.js (which reads it as a global). */
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');

describe('timerSessions wiring', () => {
    test('index.html loads js/timerSessions.js before js/timer.js', () => {
        const html = read('index.html');
        const a = html.indexOf('<script src="js/timerSessions.js"></script>');
        const b = html.indexOf('<script src="js/timer.js"></script>');
        expect(a).toBeGreaterThan(-1);
        expect(b).toBeGreaterThan(a);
    });
    test('the service worker precaches it before timer.js', () => {
        const sw = read('sw.js');
        const a = sw.indexOf("'js/timerSessions.js'");
        const b = sw.indexOf("'js/timer.js'");
        expect(a).toBeGreaterThan(-1);
        expect(b).toBeGreaterThan(a);
    });
    test('the loop reports attack state to a running timer', () => {
        expect(read('js/loop.js')).toMatch(/Timer\.trackAttack\(item, currentTimeMs/);
    });
});

describe('a Slipped check-in entry keeps the session list', () => {
    test('items.js copies timerSessions / timerUntimedMs into the pending entry and the slip entry', () => {
        const src = read('js/items.js');
        expect(src).toMatch(/timerSessions: Array\.isArray\(item\.timerSessions\)/);
        expect(src).toMatch(/timerSessions: snap && Array\.isArray\(snap\.timerSessions\)/);
    });
});

describe('Sessions list wiring (Build B, 2026-11-04)', () => {
    test('index.html loads js/ui/sessionsView.js before the popups and routine views that use it', () => {
        const html = read('index.html');
        const a = html.indexOf('<script src="js/ui/sessionsView.js"></script>');
        expect(a).toBeGreaterThan(-1);
        expect(a).toBeGreaterThan(html.indexOf('<script src="js/timerSessions.js"></script>'));
        expect(a).toBeLessThan(html.indexOf('<script src="script.js'));
    });
    test('the service worker precaches it', () => {
        expect(read('sw.js')).toMatch(/'js\/ui\/sessionsView\.js'/);
    });
    test('script.js exposes changeSession to the card, Edit Task and the Completed list', () => {
        const src = read('script.js');
        expect(src).toMatch(/function changeSession\(itemId, change\)/);
        expect((src.match(/\bchangeSession,/g) || []).length).toBeGreaterThanOrEqual(3);
        expect(src).toMatch(/damageBase:/);
    });
});
