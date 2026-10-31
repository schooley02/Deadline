/**
 * @jest-environment jsdom
 *
 * Village Build 3 (2026-10-30): the village at its peak. A finished run stores every building's tier
 * (`peakVillageTiers`, additive, no schema bump); the game-over card and the past-run cards in Stats show it as a strip of
 * eight thumbnails; the scene holds the peak while the game is over. Real modules, fake deps (damage.test.js precedent).
 * Script wiring (script.js / sw.js) is checked as text; the live render is checked in a browser.
 */
const fs = require('fs');
const path = require('path');

global.CONFIG = require('../js/config.js');
global.RunStats = require('../js/runStats.js');
global.VillageLayout = require('../js/villageLayout.js');
global.VillageCard = require('../js/ui/villageCard.js');
const VillagePanel = require('../js/ui/villagePanel.js');
global.VillagePanel = VillagePanel;
const StatsView = require('../js/ui/statsView.js');
global.StatsView = StatsView;
const GameOverView = require('../js/ui/gameOverView.js');
const Damage = require('../js/damage.js');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const KINDS = ['nights', 'slain', 'punctuality', 'habits', 'lurkers', 'defense', 'heroes', 'bestdays'];
const allAt = (t) => Object.fromEntries(KINDS.map((k) => [k, t]));

function runCtx(extra = {}) {
    return { runNumber: 1, startedAtMs: 1000, endedAtMs: 2000, daysSurvived: 3, ...extra };
}

describe('RunStats.finalizeRun -> peakVillageTiers', () => {
    test('stores the supplied tiers on the record', () => {
        const rec = RunStats.finalizeRun(RunStats.freshRunStats(), runCtx({ villageTiers: { ...allAt(2), slain: 5 } }));
        expect(rec.peakVillageTiers).toEqual({ ...allAt(2), slain: 5 });
    });

    test('no tiers supplied -> the field is absent (older record shape)', () => {
        const rec = RunStats.finalizeRun(RunStats.freshRunStats(), runCtx());
        expect('peakVillageTiers' in rec).toBe(false);
    });

    test('drops anything that is not a whole tier 1..5', () => {
        const rec = RunStats.finalizeRun(RunStats.freshRunStats(), runCtx({
            villageTiers: { nights: 3, slain: 9, habits: 0, lurkers: 2.5, defense: '4', heroes: 5 },
        }));
        expect(rec.peakVillageTiers).toEqual({ nights: 3, heroes: 5 });
    });
});

describe('Damage.gameOver saves the village at the moment of death', () => {
    function deps({ history = [], getVillageTiers } = {}) {
        let hist = history;
        const order = [];
        const d = {
            setGameOver: () => {}, getGameLoopInterval: () => null, getRunStartedAtMs: () => Date.now(),
            setDaysSurvived: () => {}, gameOverMessage: null, restartButton: null, baseElement: null,
            enableFormControls: () => {}, saveGame: () => {},
            getCurrentRunStats: () => RunStats.freshRunStats(),
            getRunHistory: () => hist,
            setRunHistory: (arr) => { order.push('setRunHistory'); hist = arr; },
            getDaysSurvived: () => 4,
            _order: order, _history: () => hist,
        };
        if (getVillageTiers) d.getVillageTiers = () => { order.push('getVillageTiers'); return getVillageTiers(); };
        return d;
    }

    test('tiers are read BEFORE the record joins history, and saved on it', () => {
        const d = deps({ getVillageTiers: () => allAt(3) });
        Damage.gameOver(d);
        expect(d._order).toEqual(['getVillageTiers', 'setRunHistory']);
        expect(d._history()[0].peakVillageTiers).toEqual(allAt(3));
    });

    test('a restore of an already-dead save never re-reads the live village', () => {
        const d = deps({ history: [{ runNumber: 1, peakVillageTiers: allAt(4) }], getVillageTiers: () => allAt(1) });
        Damage.gameOver(d, true);
        expect(d._order).toEqual([]);
        expect(d._history()[0].peakVillageTiers).toEqual(allAt(4));
    });

    test('no getVillageTiers dep -> record has no peak field and nothing throws', () => {
        const d = deps();
        expect(() => Damage.gameOver(d)).not.toThrow();
        expect('peakVillageTiers' in d._history()[0]).toBe(false);
    });
});

describe('VillagePanel.peakStripHtml / peakTotal', () => {
    test('peakTotal sums eight tiers; a missing or invalid kind counts as T1', () => {
        expect(VillagePanel.peakTotal(allAt(3))).toBe(24);
        expect(VillagePanel.peakTotal({ nights: 5 })).toBe(5 + 7);
        expect(VillagePanel.peakTotal({ nights: 9, slain: 2 })).toBe(1 + 2 + 6);
        expect(VillagePanel.peakTotal(null)).toBe(0);
    });

    test('empty for older records / no data', () => {
        expect(VillagePanel.peakStripHtml(undefined)).toBe('');
        expect(VillagePanel.peakStripHtml(null)).toBe('');
        expect(VillagePanel.peakStripHtml({})).toBe('');
        expect(VillagePanel.peakStripHtml({ nights: 0, slain: 7 })).toBe('');
    });

    test('eight cells in panel order, each with its tier sprite and T# label', () => {
        const html = VillagePanel.peakStripHtml({ ...allAt(1), nights: 4, bestdays: 5 });
        expect((html.match(/class="vps-cell"/g) || []).length).toBe(8);
        expect(html).toContain('Assets/Village/nights_t4.png');
        expect(html).toContain('Assets/Village/bestdays_t5.png');
        expect(html).toContain('Assets/Village/slain_t1.png');
        expect(html).toContain('<span class="vps-tier">\u26054</span>');
        expect(html).toContain('Village at its peak');
        expect(html).toContain('12 / 40 tiers'.replace('12', String(VillagePanel.peakTotal({ ...allAt(1), nights: 4, bestdays: 5 }))));
        expect(html.indexOf('nights_t4')).toBeLessThan(html.indexOf('bestdays_t5'));
    });

    test('label "" drops the heading row; a custom spriteFor is used', () => {
        const html = VillagePanel.peakStripHtml(allAt(2), { label: '', spriteFor: (k, t) => ({ url: `x/${k}-${t}.png` }) });
        expect(html).not.toContain('vps-head');
        expect(html).toContain('x/nights-2.png');
    });

    test('a bad tier in an otherwise real record shows as T1', () => {
        const html = VillagePanel.peakStripHtml({ ...allAt(3), habits: 99 });
        expect(html).toContain('habits_t1.png');
        expect(html).not.toContain('habits_t99');
    });
});

describe('game-over card', () => {
    const base = { daysSurvived: 3, totals: { tasksCompleted: 1, habitsCompleted: 1, pointsEarned: 5 }, blame: [] };

    test('shows the peak village strip between the totals and "What hit hardest"', () => {
        const html = GameOverView.buildReviewCardHtml({ ...base, peakVillageTiers: allAt(2) }, 3);
        expect(html).toContain('village-peak-strip');
        expect(html.indexOf('game-over-totals')).toBeLessThan(html.indexOf('village-peak-strip'));
        expect(html.indexOf('village-peak-strip')).toBeLessThan(html.indexOf('What hit hardest'));
    });

    test('older record / no record -> no strip, card otherwise unchanged', () => {
        expect(GameOverView.buildReviewCardHtml(base, 3)).not.toContain('village-peak-strip');
        expect(GameOverView.buildReviewCardHtml(null, 3)).not.toContain('village-peak-strip');
    });
});

describe('past-run card in Stats', () => {
    const rec = (extra = {}) => ({
        runNumber: 2, startedAtMs: 1000, endedAtMs: 2000, daysSurvived: 6, endReason: 'base_destroyed',
        totals: { tasksCompleted: 5, habitsCompleted: 3, habitsMissed: 1, pointsEarned: 50 }, blame: [], routines: [], ...extra,
    });

    test('collapsed line "Village: N / 40 tiers" plus the thumbnails in the expanded details', () => {
        const html = StatsView.buildRunCard(rec({ peakVillageTiers: allAt(3) }), false, null);
        expect(html).toContain('Village: 24 / 40 tiers');
        const details = html.slice(html.indexOf('stats-run-card-details'));
        expect(details).toContain('village-peak-strip');
        expect((details.match(/class="vps-cell"/g) || []).length).toBe(8);
        expect(details).not.toContain('Village at its peak'); // no heading inside the card
    });

    test('older run without the field shows no village markup', () => {
        const html = StatsView.buildRunCard(rec(), false, null);
        expect(html).not.toContain('Village:');
        expect(html).not.toContain('village-peak-strip');
    });
});

describe('shell wiring', () => {
    test('script.js passes the real tiers to Damage and holds the peak while the game is over', () => {
        const s = read('script.js');
        expect(s).toMatch(/getVillageTiers:\s*\(\)\s*=>\s*realVillageTiers\(\)/);
        expect(s).toContain('function peakTierWhileOver');
        expect(s).toMatch(/const peak = peakTierWhileOver\(kind\)/);
        expect(read('js/state.js')).toContain('getVillageTiers: deps.getVillageTiers');
    });

    test('styles ship in the already-cached village panel stylesheet; sw bumped to v161', () => {
        expect(read('css/villagePanel.css')).toContain('.village-peak-strip');
        expect(read('sw.js')).toContain("CACHE_NAME = 'deadline-shell-v161'");
    });
});
