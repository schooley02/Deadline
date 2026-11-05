/**
 * @jest-environment jsdom
 */
/**
 * Goals Build B2 (2026-11-05): the Stats window's Goals row (periods met, one-time goals finished, best streak) and the roster of
 * finished goals. Pure builders in js/ui/statsView.js; source-level checks for the markup and the deps pass-through.
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Theme = require('../js/theme.js');
global.RunStats = require('../js/runStats.js');
global.Achievements = require('../js/achievements.js');
const StatsView = require('../js/ui/statsView.js');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime();

const goals = {
    bestSlots: 3,
    active: [
        { id: 1, name: 'Weekly', kind: 'recurring', periodsMet: 4, bestStreak: 3 },
        { id: 2, name: 'Big', kind: 'milestone', periodsMet: 0, bestStreak: 0 },
    ],
    done: [
        { id: 7, name: 'Launch', kind: 'milestone', period: null, finishedAt: at(2026, 11, 2), periodsMet: 0, bestStreak: 0 },
        { id: 6, name: 'Daily walk', kind: 'recurring', period: 'day', finishedAt: at(2026, 10, 20), periodsMet: 12, bestStreak: 9 },
    ],
};

describe('goalsSummary', () => {
    test('adds periods met over active and retired goals, counts finished one-time goals, takes the best streak', () => {
        expect(StatsView.goalsSummary(goals)).toEqual({ periodsMet: 16, milestonesDone: 1, bestStreak: 9, active: 2, finished: 2 });
    });
    test('an empty or missing list is all zeros', () => {
        const zero = { periodsMet: 0, milestonesDone: 0, bestStreak: 0, active: 0, finished: 0 };
        expect(StatsView.goalsSummary(null)).toEqual(zero);
        expect(StatsView.goalsSummary({ active: [], done: [] })).toEqual(zero);
    });
});

describe('buildGoalsSection', () => {
    test('shows the three numbers and the finished list newest first, with the theme\'s plural word', () => {
        const html = StatsView.buildGoalsSection({ goals });
        expect(html).toContain('Periods met');
        expect(html).toContain('>16<');
        expect(html).toContain('One-time goals finished');
        expect(html).toContain('Best streak');
        expect(html).toContain('>9<');
        expect(html.indexOf('Launch')).toBeLessThan(html.indexOf('Daily walk'));
        expect(html).toContain(Theme.strings.goals.finishedPlural);
        expect(html).toMatch(/Retired/);
        expect(html).toMatch(/Finished/);
    });
    test('says so when nothing is finished yet, and escapes names', () => {
        expect(StatsView.buildGoalsSection({ goals: { active: [], done: [] } })).toMatch(/No goals finished yet/);
        const html = StatsView.buildGoalsSection({ goals: { active: [], done: [{ id: 1, name: '<b>x</b>', kind: 'milestone', finishedAt: 1, periodsMet: 0, bestStreak: 0 }] } });
        expect(html).not.toContain('<b>x</b>');
    });
    test('caps the list at ten and says how many more there are', () => {
        const done = Array.from({ length: 13 }, (_, i) => ({ id: i + 1, name: 'G' + i, kind: 'milestone', finishedAt: i, periodsMet: 0, bestStreak: 0 }));
        const html = StatsView.buildGoalsSection({ goals: { active: [], done } });
        expect((html.match(/class="stats-goal-row"/g) || []).length).toBe(10);
        expect(html).toMatch(/and 3 more/);
    });
});

describe('renderStatsWindow fills #statsGoals', () => {
    test('with the goals dep, when the element exists', () => {
        document.body.innerHTML = '<div id="statsCurrentPanel"></div><ul id="statsHistoryList"></ul><div id="statsGoals"></div>';
        StatsView.renderStatsWindow({ currentRunStats: {}, runHistory: [], daysSurvivedSoFar: 0, achievementsCatalog: [], lifetimeStats: {}, achievements: {}, goals });
        expect(document.getElementById('statsGoals').innerHTML).toContain('Periods met');
    });
});

describe('seams (source level)', () => {
    test('index.html has the Goals heading with its (i) button and the container; the deps reach the window', () => {
        const html = read('index.html');
        expect(html).toContain('id="statsGoals"');
        expect(html).toContain('data-hiw-topic="goals"');
        expect(read('js/ui/managementWindows.js')).toMatch(/goals: deps\.goals/);
        expect(read('script.js')).toMatch(/goals: State\.getGoals\(\)/);
    });
});
