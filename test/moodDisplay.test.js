/**
 * @jest-environment jsdom
 *
 * Mood display (W1b Build B1, 2026-11-13): Mood.dayGlyph, the Weather panel's Mood column and the Stats best / worst day faces.
 */
const fs = require('fs');
const path = require('path');
const CONFIG = require('../js/config.js');
const DailyRecord = require('../js/dailyRecord.js');
const RunStats = require('../js/runStats.js');
global.CONFIG = CONFIG;
global.DailyRecord = DailyRecord;
global.RunStats = RunStats;
global.Achievements = require('../js/achievements.js');
global.Modal = require('../js/ui/modal.js');
global.HowItWorks = require('../js/ui/howItWorks.js');
const Mood = require('../js/mood.js');
global.Mood = Mood;
const WeatherPanel = require('../js/ui/weatherPanel.js');
const StatsView = require('../js/ui/statsView.js');

const entry = (hour, level) => Mood.makeEntry({ hour, level, feelings: [], context: [] });

describe('Mood.dayGlyph', () => {
    test('no entries -> null', () => {
        expect(Mood.dayGlyph([])).toBeNull();
        expect(Mood.dayGlyph(undefined)).toBeNull();
        expect(Mood.dayGlyph('junk')).toBeNull();
    });
    test('one entry, or first and last the same level -> one face', () => {
        expect(Mood.dayGlyph([entry(8, 5)])).toEqual({ text: '😄', title: 'Rad' });
        expect(Mood.dayGlyph([entry(8, 3), entry(12, 1), entry(20, 3)]).text).toBe('😐');
    });
    test('first and last differ -> "first -> last"', () => {
        const g = Mood.dayGlyph([entry(8, 2), entry(20, 4)]);
        expect(g.text).toBe('🙁 → 🙂');
        expect(g.title).toBe('Bad to Good');
    });
});

function result(extra) {
    return Object.assign({
        band: 'hazy', trend: 'steady', usedPrior: false, forced: false,
        recent: [
            { date: '2026-11-02', onTime: 0.5, habits: 1, damage: 0 },
            { date: '2026-11-03', onTime: 1, habits: 1, damage: 0 },
        ],
    }, extra);
}

describe('Weather panel Mood column', () => {
    test('no moodFor, or no moods logged -> no Mood column', () => {
        expect(WeatherPanel.panelHtml(WeatherPanel.buildViewModel(result()))).not.toContain('>Mood<');
        const vm = WeatherPanel.buildViewModel(result(), () => []);
        expect(vm.hasMood).toBe(false);
        expect(WeatherPanel.panelHtml(vm)).not.toContain('wx-mood');
    });
    test('a mood on any day adds the column; days without one show a dash', () => {
        const moods = { '2026-11-03': [entry(8, 2), entry(20, 4)] };
        const vm = WeatherPanel.buildViewModel(result(), (k) => moods[k] || []);
        expect(vm.hasMood).toBe(true);
        const html = WeatherPanel.panelHtml(vm);
        expect(html).toContain('<th scope="col">Mood</th>');
        expect(html).toContain('🙁 → 🙂');
        expect(html).toContain('Bad to Good');
        expect(html).toContain('<td class="wx-mood">&mdash;</td>');
        // the header and every body row have the same number of cells
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll('.wx-table tbody tr').forEach((tr) => {
            const cells = Array.from(tr.children).reduce((n, c) => n + (c.colSpan || 1), 0);
            expect(cells).toBe(5);
        });
    });
    test('Today so far: a mood today shows even while "nothing judged yet"', () => {
        const vm = WeatherPanel.buildViewModel(result(), (k) => (k === 'today' ? [entry(9, 5)] : []));
        expect(vm.today).toEqual({ pending: true, mood: { text: '😄', title: 'Rad' } });
        const html = WeatherPanel.panelHtml(vm);
        expect(html).toContain('colspan="3" class="wx-pending">Nothing judged yet</td><td class="wx-mood"');
    });
    test('a dev-forced sky has no today row and no mood', () => {
        const vm = WeatherPanel.buildViewModel(result({ forced: true }), () => [entry(9, 5)]);
        expect(vm.today).toBeNull();
    });
    test('the Stats readout uses the same table', () => {
        const vm = WeatherPanel.buildViewModel(result(), () => [entry(9, 5)]);
        expect(WeatherPanel.statsHtml(vm)).toContain('>Mood<');
    });
});

describe('Stats best / worst day faces', () => {
    const bw = {
        best: { date: '2026-11-03', night: 3, done: 5, missed: 0, damage: 0 },
        worst: { date: '2026-11-04', night: 4, done: 0, missed: 4, damage: 9 },
    };
    test('no moodFor -> unchanged markup', () => {
        expect(StatsView.buildBestWorstDays(bw)).not.toContain('stats-best-worst-mood');
    });
    test('a day with a mood shows its face after the date; a day without shows none', () => {
        const moods = { '2026-11-03': [entry(8, 5)], '2026-11-04': [] };
        const html = StatsView.buildBestWorstDays(bw, (k) => moods[k] || []);
        expect(html.match(/stats-best-worst-mood"/g)).toHaveLength(1);
        expect(html).toContain('😄');
        expect(html).toContain('aria-label="Mood: Rad"');
    });
});

describe('wiring + copy', () => {
    const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    test('script.js feeds the Weather panel, the Stats readout and the Stats window', () => {
        const js = read('script.js');
        expect(js).toMatch(/function moodForDay\(key\)/);
        expect(js).toMatch(/getMood:\s*moodForDay/);
        expect(js).toMatch(/buildViewModel\(climateNow\(\),\s*moodForDay\)/);
        expect(js).toMatch(/moodFor:\s*moodForDay/);
    });
    test('the Stats window passes moodFor through to the current-run panel', () => {
        expect(read('js/ui/managementWindows.js')).toContain('moodFor: deps.moodFor');
        expect(read('js/ui/statsView.js')).toContain('moodFor: deps.moodFor');
    });
    test('The sky topic carries the mood line', () => {
        expect(read('js/ui/howItWorks.js')).toContain('the face on your level button is you');
    });
});
