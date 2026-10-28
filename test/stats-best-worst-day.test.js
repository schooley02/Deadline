/** @jest-environment jsdom */
/**
 * Stats best/worst day per run (D2 step 5, 2026-10-27).
 * Markup builder + renderStatsWindow wiring (jsdom). Scoring itself is
 * covered in dailyRecord.test.js.
 */
const DailyRecord = require('../js/dailyRecord.js');
const CONFIG = require('../js/config.js');
const RunStats = require('../js/runStats.js');
global.DailyRecord = DailyRecord;
global.CONFIG = CONFIG;
global.RunStats = RunStats;
global.Achievements = require('../js/achievements.js');
const StatsView = require('../js/ui/statsView.js');

function day(date, run, night, done, missed, dmg) {
    const r = DailyRecord.fresh({ date, run, night });
    r.run = run; r.night = night;
    r.done.task = done; r.missed.task = missed; r.dmg.taken = dmg;
    return r;
}
const bw = {
    best: { date: '2026-10-03', night: 4, score: 6, done: 6, missed: 0, damage: 0 },
    worst: { date: '2026-10-05', night: 6, score: -5, done: 1, missed: 4, damage: 2 },
};

describe('StatsView.buildBestWorstDays', () => {
    test('null / partial -> empty string (no placeholder)', () => {
        expect(StatsView.buildBestWorstDays(null)).toBe('');
        expect(StatsView.buildBestWorstDays({ best: bw.best })).toBe('');
    });
    test('renders best and worst rows with counts and night', () => {
        const html = StatsView.buildBestWorstDays(bw);
        expect(html).toContain('stats-best-day');
        expect(html).toContain('stats-worst-day');
        expect(html).toContain('night 4');
        expect(html).toContain('6 done · 0 missed · 0 dmg');
        expect(html).toContain('1 done · 4 missed · 2 dmg');
    });
});

describe('run card / current panel', () => {
    const rec = {
        runNumber: 1, startedAtMs: 1000, endedAtMs: 2000, daysSurvived: 3, endReason: 'base_destroyed',
        totals: { tasksCompleted: 1, habitsCompleted: 1, habitsMissed: 0, pointsEarned: 1 }, blame: [], routines: [],
    };
    test('run card shows the section only when given best/worst', () => {
        expect(StatsView.buildRunCard(rec, false, bw)).toContain('Best &amp; worst day');
        expect(StatsView.buildRunCard(rec, false, null)).not.toContain('Best &amp; worst day');
        expect(StatsView.buildRunCard(rec, false)).not.toContain('Best &amp; worst day');
    });
    test('current panel shows it when deps.bestWorst is set', () => {
        const base = { currentRunStats: RunStats.freshRunStats(), daysSurvivedSoFar: 1, currentRunNumber: 2, lastRunRecord: null };
        expect(StatsView.buildCurrentRunPanel({ ...base, bestWorst: bw })).toContain('Best &amp; worst day');
        expect(StatsView.buildCurrentRunPanel(base)).not.toContain('Best &amp; worst day');
    });
});

describe('renderStatsWindow wiring', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="statsCurrentPanel"></div><ul id="statsHistoryList"></ul><div id="statsRoutineRollup"></div>';
    });
    const rec1 = {
        runNumber: 1, startedAtMs: 1000, endedAtMs: 2000, daysSurvived: 3, endReason: 'base_destroyed',
        totals: { tasksCompleted: 1, habitsCompleted: 1, habitsMissed: 0, pointsEarned: 1 }, blame: [], routines: [],
    };
    test('past run uses the days store; live run adds today; older runs without days show nothing', () => {
        let days = DailyRecord.emptyStore();
        [day('2026-10-01', 1, 1, 5, 0, 0), day('2026-10-02', 1, 2, 0, 3, 4),
         day('2026-10-03', 2, 1, 2, 0, 0)].forEach(r => { days = DailyRecord.addDay(days, r); });
        const today = day('2026-10-04', 2, 2, 0, 5, 0);
        StatsView.renderStatsWindow({
            currentRunStats: RunStats.freshRunStats(), runHistory: [rec1], daysSurvivedSoFar: 2,
            achievementsCatalog: [], lifetimeStats: {}, achievements: {},
            days, todayRecord: today, scoreWeights: CONFIG.DAILY_SCORE_WEIGHTS,
        });
        const card = document.getElementById('statsHistoryList').innerHTML;
        expect(card).toContain('Best &amp; worst day');
        expect(card).toContain('5 done · 0 missed · 0 dmg');
        const cur = document.getElementById('statsCurrentPanel').innerHTML;
        expect(cur).toContain('Best &amp; worst day');
        expect(cur).toContain('0 done · 5 missed · 0 dmg');
    });
    test('no days store -> no section, no throw', () => {
        StatsView.renderStatsWindow({
            currentRunStats: RunStats.freshRunStats(), runHistory: [rec1], daysSurvivedSoFar: 0,
            achievementsCatalog: [], lifetimeStats: {}, achievements: {},
        });
        expect(document.getElementById('statsHistoryList').innerHTML).not.toContain('Best &amp; worst day');
        expect(document.getElementById('statsCurrentPanel').innerHTML).not.toContain('Best &amp; worst day');
    });
});
