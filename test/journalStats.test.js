/**
 * @jest-environment jsdom
 *
 * Journal Build B (2026-11-13): Stats "Notes: N" + Read on the live run and past-run cards, and the note mark on best / worst days.
 */
global.Mood = require('../js/mood.js');
global.DailyRecord = require('../js/dailyRecord.js');
global.CONFIG = require('../js/config.js');
global.RunStats = require('../js/runStats.js');
global.Achievements = require('../js/achievements.js');
const StatsView = require('../js/ui/statsView.js');

describe('notesLineHtml', () => {
    test('a count, plus a Read button only when there are notes', () => {
        expect(StatsView.notesLineHtml(0, 3)).toContain('Notes: 0');
        expect(StatsView.notesLineHtml(0, 3)).not.toContain('data-journal-run');
        const html = StatsView.notesLineHtml(4, 3);
        expect(html).toContain('Notes: 4');
        expect(html).toContain('data-journal-run="3"');
    });
    test('nothing without a number (hosts that do not wire the journal)', () => {
        expect(StatsView.notesLineHtml(undefined, 3)).toBe('');
        expect(StatsView.notesLineHtml(NaN, 3)).toBe('');
    });
});

describe('best / worst note mark', () => {
    const bw = { best: { date: '2026-11-10', done: 3, missed: 0, damage: 0 }, worst: { date: '2026-11-11', done: 0, missed: 2, damage: 10 } };
    test('a day with notes gets the mark; a day without does not; no function = none', () => {
        const html = StatsView.buildBestWorstDays(bw, null, (k) => (k === '2026-11-10' ? 2 : 0));
        expect(html.match(/stats-best-worst-note/g)).toHaveLength(1);
        expect(html).toContain('2 notes on this day');
        expect(StatsView.buildBestWorstDays(bw, null)).not.toContain('stats-best-worst-note');
    });
});

describe('renderStatsWindow wiring', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="statsCurrentPanel"></div><ul id="statsHistoryList"></ul><div id="statsRoutineRollup"></div><div id="statsGoals"></div><div id="statsAchievements"></div>';
    });
    const record = (n) => ({
        runNumber: n, daysSurvived: 2, endedAtMs: 1000, startedAtMs: 0, endReason: 'base_destroyed', blame: [], routines: [],
        totals: { tasksCompleted: 1, subtasksCompleted: 0, habitsCompleted: 1, habitsMissed: 0, pointsEarned: 5 },
    });
    test('Read buttons open the Journal for that run and never toggle the card', () => {
        const onReadRunNotes = jest.fn();
        StatsView.renderStatsWindow({
            currentRunStats: null, runHistory: [record(2), record(1)], daysSurvivedSoFar: 1,
            noteCountForRun: (n) => (n === 1 ? 0 : n + 1), noteCountForDay: () => 0, onReadRunNotes,
        });
        const live = document.querySelector('.stats-current-panel [data-journal-run]');
        expect(live.getAttribute('data-journal-run')).toBe('3'); // the live run is #3
        live.click();
        const card = document.querySelector('.stats-run-card[data-run-number="2"]');
        card.querySelector('[data-journal-run]').click();
        expect(card.classList.contains('stats-run-card-expanded')).toBe(false);
        expect(onReadRunNotes.mock.calls.map((c) => c[0])).toEqual([3, 2]);
        expect(document.querySelector('.stats-run-card[data-run-number="1"] [data-journal-run]')).toBeNull();
        expect(document.querySelector('.stats-run-card[data-run-number="1"]').textContent).toContain('Notes: 0');
    });
    test('without the count function nothing changes (older hosts)', () => {
        StatsView.renderStatsWindow({ currentRunStats: null, runHistory: [record(1)], daysSurvivedSoFar: 0 });
        expect(document.body.textContent).not.toContain('Notes:');
    });
});
