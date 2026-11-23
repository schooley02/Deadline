/**
 * Lifetime nights survived (2026-11-23). The growing tree is gone; its saved number (lifetimeStats.nightsSurvived, the nights of every
 * finished run) is kept and shown on the Stats tab. Pins the pure helpers in js/achievements.js, the Stats line in js/ui/statsView.js and
 * the wiring (script.js banks at game over, state.js seeds old saves, nothing reads a tree).
 */
const fs = require('fs');
const path = require('path');
const Achievements = require('../js/achievements.js');
const StatsView = require('../js/ui/statsView.js');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

describe('Achievements.lifetimeNights', () => {
    test('banked nights plus the live run', () => {
        expect(Achievements.lifetimeNights(12, 3, false)).toBe(15);
    });
    test('once the game is over the live run counts 0 (it is already in the bank): no jump at game over, no drop at Restart', () => {
        expect(Achievements.lifetimeNights(15, 3, true)).toBe(15);
        expect(Achievements.lifetimeNights(15, 0, false)).toBe(15);
    });
    test('bad input counts as 0; fractions floor', () => {
        expect(Achievements.lifetimeNights(undefined, undefined, false)).toBe(0);
        expect(Achievements.lifetimeNights(NaN, -4, false)).toBe(0);
        expect(Achievements.lifetimeNights('9', null, false)).toBe(0);
        expect(Achievements.lifetimeNights(4.9, 2.9, false)).toBe(6);
    });
});

describe('Achievements.seedNightsBanked', () => {
    test('sums daysSurvived over the runs still in history', () => {
        expect(Achievements.seedNightsBanked([{ run: 3, daysSurvived: 5 }, { run: 2, daysSurvived: 0 }, { run: 1, daysSurvived: 7 }])).toBe(12);
    });
    test('empty, missing and junk entries seed 0', () => {
        expect(Achievements.seedNightsBanked([])).toBe(0);
        expect(Achievements.seedNightsBanked(undefined)).toBe(0);
        expect(Achievements.seedNightsBanked([null, 7, { daysSurvived: 'x' }, { daysSurvived: -2 }])).toBe(0);
    });
});

describe('Stats tab line', () => {
    test('says how many nights were survived across all runs, singular and plural', () => {
        expect(StatsView.lifetimeNightsLineHtml(15)).toBe('<div class="stats-lifetime-nights"><strong>15</strong> nights survived across all runs</div>');
        expect(StatsView.lifetimeNightsLineHtml(1)).toContain('<strong>1</strong> night survived across all runs');
        expect(StatsView.lifetimeNightsLineHtml(0)).toContain('<strong>0</strong> nights survived');
    });
    test('no number, no line (old callers)', () => {
        expect(StatsView.lifetimeNightsLineHtml(undefined)).toBe('');
        expect(StatsView.lifetimeNightsLineHtml(NaN)).toBe('');
        expect(StatsView.lifetimeNightsLineHtml(-1)).toBe('');
    });
    test('has a style rule', () => {
        expect(read('css/stats.css')).toMatch(/\.stats-lifetime-nights \{/);
    });
});

describe('wiring: nothing reads a tree, the bank and the Stats line are connected', () => {
    const script = read('script.js');
    test('script.js passes the live lifetime total to the Stats window and still banks at game over', () => {
        expect(script).toMatch(/lifetimeNights: lifetimeNightsNow\(\)/);
        expect(script).toMatch(/function lifetimeNightsNow\(\)/);
        expect(script).toMatch(/nightsSurvived/);
        expect(script).not.toMatch(/TreeGrowth|TreePanel|getTreeStage|openTreePanel|treeStageNow/);
    });
    test('state.js seeds an old save from the run history, without TreeGrowth', () => {
        const state = read('js/state.js');
        expect(state).toMatch(/Achievements\.seedNightsBanked\(getRunHistory\(\)\)/);
        expect(state).not.toMatch(/TreeGrowth/);
    });
    test('no source, page or doc-page file mentions the tree modules any more', () => {
        ['index.html', 'sw.js', 'js/config.js', 'js/devDemo.js', 'js/ui/devPanel.js', 'js/ui/villagePanel.js', 'js/ui/howItWorks.js'].forEach((f) => {
            expect(read(f)).not.toMatch(/TreeGrowth|treeGrowth|treePanel|TreePanel|GRAVEYARD_TREE|TREE_STAGE/);
        });
    });
});
