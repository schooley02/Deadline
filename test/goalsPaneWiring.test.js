/** Goals pane wiring (Build B1, 2026-11-05). Jest never loads script.js or index.html, so these are source-level checks of the seams. */
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('index.html', () => {
    const html = read('index.html');
    test('has the HUD button, the pane markup and its styles/scripts in the right order', () => {
        expect(html).toContain('id="goalsButton"');
        expect(html).toContain('id="goalsPane"');
        expect(html).toContain('id="goalsPaneBackdrop"');
        expect(html).toContain('id="goalsPaneBody"');
        expect(html).toContain('href="css/goalsPane.css"');
        expect(html.indexOf('href="css/goalsPane.css"')).toBeLessThan(html.indexOf('href="css/responsive.css"'));
        const scripts = ['js/theme.js', 'js/goals.js', 'js/ui/modal.js', 'js/ui/goalsPane.js', 'js/ui/goalCard.js'].map(s => html.indexOf(`src="${s}"`));
        scripts.forEach(i => expect(i).toBeGreaterThan(-1));
        expect(scripts[3]).toBeGreaterThan(scripts[1]);
        expect(scripts[4]).toBeGreaterThan(scripts[3]);
    });
    test('the goals button is the LAST HUD button, so the first five keep their one-row fit on a phone', () => {
        expect(html.indexOf('id="goalsButton"')).toBeGreaterThan(html.indexOf('id="playerPointsStat"'));
    });
});

describe('sw.js', () => {
    const sw = read('sw.js');
    test('caches the new shell files', () => {
        ['css/goalsPane.css', 'js/ui/goalsPane.js', 'js/ui/goalCard.js'].forEach(f => expect(sw).toContain(`'${f}'`));
    });
});

describe('script.js', () => {
    const src = read('script.js');
    test('lazy-inits the pane, refreshes it every tick and drains the goal events into the notice', () => {
        expect(src).toContain('let goalsPaneReady = false');
        expect(src).toMatch(/function ensureGoalsPane\(\)/);
        expect(src).toContain('GoalsPane.init(');
        expect(src).toContain('State.takeGoalEvents()');
        expect(src).toContain('FrozenNotice.showGoalCompleteNotice(');
        const update = src.slice(src.indexOf('function updateGame()'), src.indexOf('// Habit system functions'));
        expect(update).toContain('renderGoals();');
    });
    test('a linked completion refreshes the pane at once', () => {
        expect(src).toMatch(/onGoalProgress: \(info, dir\) => \{ State\.applyGoalCompletion\(info, dir\); renderGoals\(\); \}/);
    });
    test('the card edits go through State, never the saved goals directly', () => {
        ['State.updateGoalTarget(', 'State.retireGoal(', 'State.deleteGoal('].forEach(call => expect(src).toContain(call));
    });
});
