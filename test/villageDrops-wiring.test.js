/**
 * Village tier drops wiring checks (2026-11-03): things Jest can verify without loading script.js -- shell list, load order, cache bump,
 * and the script.js hook-up (script.js is boot/wiring only and never loaded by Jest, so a missing call would only show in a live browser).
 */
const fs = require('fs');
const path = require('path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const script = read('script.js');

describe('shell + load order', () => {
    test('js/villageDrops.js is in the service worker APP_SHELL and exists', () => {
        expect(sw).toContain("'js/villageDrops.js'");
        expect(fs.existsSync(path.join(__dirname, '..', 'js/villageDrops.js'))).toBe(true);
    });

    test('CACHE_NAME was bumped for the shell change (v235 or later)', () => {
        const m = /CACHE_NAME = 'deadline-shell-v(\d+)'/.exec(sw);
        expect(Number(m[1])).toBeGreaterThanOrEqual(235);
    });

    test('index.html loads villageDrops.js once, after config.js and before script.js', () => {
        const tag = '<script src="js/villageDrops.js"></script>';
        expect(html.split(tag).length - 1).toBe(1);
        expect(html.indexOf('<script src="js/config.js">')).toBeLessThan(html.indexOf(tag));
        expect(html.indexOf(tag)).toBeLessThan(html.indexOf('<script src="script.js">'));
    });

    test('villageDrops.js is pure: its CODE (comments aside) never touches the DOM, State, CONFIG or Shop', () => {
        const code = read('js/villageDrops.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        expect(code).not.toMatch(/\b(document|window|State|CONFIG|Shop)\b/);
    });
});

describe('script.js hook-up', () => {
    test('the payout runs from the per-tick afterTick, next to the Clock tower star check', () => {
        const tick = script.slice(script.indexOf('afterTick: () => {'));
        expect(tick.slice(0, 2500)).toContain('payVillageDrops(Date.now());');
    });

    test('the payout reads the REAL tiers (never the dev URL overrides), via the fresh realVillageTiers', () => {
        const fn = script.slice(script.indexOf('function payVillageDrops('), script.indexOf('// Live numbers for the (i) help panels'));
        expect(fn).toContain('realVillageTiers()');
        expect(fn).not.toContain('villageTierDep');
        expect(fn).not.toContain('location.search');
    });

    test('it stands down while the game is over and during offline catch-up', () => {
        const fn = script.slice(script.indexOf('function payVillageDrops('), script.indexOf('// Live numbers for the (i) help panels'));
        expect(fn).toContain('State.isGameOver()');
        expect(fn).toContain('offlineCatchUpActive');
    });

    test('it pays through the pure settle with Shop.grant, writes the ledger back, records the day, saves and notifies', () => {
        const fn = script.slice(script.indexOf('function payVillageDrops('), script.indexOf('// Live numbers for the (i) help panels'));
        expect(fn).toContain('VillageDrops.settle(');
        expect(fn).toContain('grant: Shop.grant');
        expect(fn).toContain('CONFIG.VILLAGE_TIER_DROPS');
        expect(fn).toContain('stats.villageDropsPaid = res.newPaid');
        expect(fn).toContain('State.setPlayerInventory(res.newInventory)');
        expect(fn).toContain("State.bumpToday('drop'");
        expect(fn).toContain('saveGame()');
        expect(fn).toContain('FrozenNotice.showVillageRewardNotice(');
    });

    test('it bails out when progress cannot be computed (unknown is not "star 1 reached")', () => {
        const fn = script.slice(script.indexOf('function payVillageDrops('), script.indexOf('// Live numbers for the (i) help panels'));
        expect(fn).toMatch(/if \(!tiers \|\| !stats\) return;/);
    });

    test('the building card is opened with the next drop', () => {
        const open = script.slice(script.indexOf('function openVillageCard('), script.indexOf('VillageView.init('));
        expect(open).toContain('nextDrop:');
        expect(open).toContain('VillageDrops.nextDrop(');
        expect(open).toContain('VillageDrops.label(');
    });
});
