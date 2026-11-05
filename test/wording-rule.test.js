/**
 * Wording rule (Jeremy, 2026-11-04; CLAUDE.md "Habit wording", DECISIONS 2026-11-04 (wording rule)).
 * Player-facing text says "Build Habit" / "Break Habit" (capital H), never "habit to build" / "habit to break",
 * and "Time Logged" (capital T and L), never "logged time" or a bare "Logged:" label.
 *
 * Scans the code with comments stripped (comments, CSS class names and function names may keep the old words), so
 * this only looks at text that can reach the screen: string literals, template literals and index.html.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');

function jsFiles(dir) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) return jsFiles(rel);
        return e.name.endsWith('.js') ? [rel] : [];
    });
}

// Strip /* */ blocks, whole-line // comments and trailing " // " comments. Good enough for this codebase's style;
// a URL inside a string ("https://") has no space before its slashes, so it survives.
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/\s\/\/\s.*$/, '')))
        .join('\n');
}
const stripHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, '');

// Forward slashes on every OS, so ALLOWED entries match on Windows too (path.join gives "js\\ui\\x.js" there).
const SOURCES = [...jsFiles('js'), 'script.js'].map((rel) => rel.split(path.sep).join('/'))
    .map((rel) => ({ rel, text: stripComments(read(rel)) }))
    .concat([{ rel: 'index.html', text: stripHtmlComments(read('index.html')) }]);

const BANNED = [
    { name: '"habit to build / break"', re: /\bhabits? to (build|break)\b/i },
    { name: '"habit(s) you are building / breaking"', re: /\bhabits? you(?:'re| are) (building|breaking)\b/i },
    { name: '"logged time" (say "Time Logged")', re: /\blogged time\b/i },
    { name: '"Logged:" label (say "Time Logged:")', re: /(?<!Time )\bLogged:/ },
    { name: '"Build habit" / "Break habit" (capital H)', re: /\b(Build|Break) habits?\b/ },
];

// Spots Jeremy chose to leave as they are (2026-11-04). Each is matched by file + a snippet of the line.
const ALLOWED = [
    { rel: 'js/ui/villageCard.js', snippet: 'every habit you are building, checked off in its window. Habits you are breaking count at the Boxing gym.' },
];

function findings() {
    const out = [];
    SOURCES.forEach(({ rel, text }) => {
        text.split('\n').forEach((line, i) => {
            BANNED.forEach(({ name, re }) => {
                if (!re.test(line)) return;
                if (ALLOWED.some((a) => a.rel === rel && line.includes(a.snippet))) return;
                out.push(`${rel}:${i + 1} ${name}: ${line.trim().slice(0, 140)}`);
            });
        });
    });
    return out;
}

describe('wording rule: Build Habit / Break Habit, Time Logged', () => {
    test('no banned phrase in player-facing text', () => {
        expect(findings()).toEqual([]);
    });

    test('the guard itself catches each banned phrase (and ignores comments)', () => {
        const probe = (s) => BANNED.filter(({ re }) => re.test(stripComments(s))).map(b => b.name);
        expect(probe("x = 'Add a habit to break';")).toHaveLength(1);
        expect(probe("x = 'Pause to edit the logged time.';")).toHaveLength(1);
        expect(probe('x = `Logged: ${m} min`;')).toHaveLength(1);
        expect(probe("x = 'Tap a Break habit';")).toHaveLength(1);
        expect(probe("x = 'Time Logged: 5 min'; y = 'Tap a Break Habit';")).toHaveLength(0);
        expect(probe('// a habit to break, the logged time')).toHaveLength(0);
        expect(probe("f(); // the logged time")).toHaveLength(0);
        expect(probe('x = `<button class="logged-time-input">`;')).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Baseline vs Deadline (Jeremy, 2026-11-04; docs/GOALS_PLAN.md "Baseline seam", CLAUDE.md "Baseline vs Deadline").
// The Goals engine files speak engine words only. Every theme word (and every sprite path) lives in js/theme.js, so a second theme
// (fantasy, say) is another Theme table plus assets, with no edit to these files. Comments are stripped like the scan above.
// ---------------------------------------------------------------------------------------------------------------------------
const THEME_WORDS = /\b(zombies?|undead|church(?:es)?|village|vats?|lab|laboratory|patients?|cure[ds]?|cures|curing|survivors?|graveyard|horde)\b/i;
const ENGINE_GOAL_FILE = /^(js|js\/ui|css)\/goal[^/]*\.(js|css)$/;

function engineGoalSources() {
    const rels = [...jsFiles('js'), ...(fs.existsSync(path.join(root, 'css')) ? fs.readdirSync(path.join(root, 'css')).map(f => path.join('css', f)) : [])]
        .map((rel) => rel.split(path.sep).join('/'))
        .filter((rel) => ENGINE_GOAL_FILE.test(rel));
    return rels.map((rel) => ({ rel, text: stripComments(read(rel)) }));
}

describe('Baseline vs Deadline: no theme word in the Goals engine files', () => {
    test('js/goals*.js, js/ui/goal*.js and css/goal*.css carry no theme word', () => {
        const hits = [];
        engineGoalSources().forEach(({ rel, text }) => {
            text.split('\n').forEach((line, i) => {
                if (THEME_WORDS.test(line)) hits.push(`${rel}:${i + 1} ${line.trim().slice(0, 140)}`);
            });
        });
        expect(hits).toEqual([]);
    });

    test('the scan really covers the Goals files (goals.js and goalMetrics.js)', () => {
        const rels = engineGoalSources().map(s => s.rel);
        expect(rels).toEqual(expect.arrayContaining(['js/goals.js', 'js/goalMetrics.js']));
    });

    test('js/theme.js is where the theme words live', () => {
        expect(THEME_WORDS.test(stripComments(read('js/theme.js')))).toBe(true);
    });

    test('the guard catches a theme word and ignores comments and look-alikes', () => {
        const probe = (s) => THEME_WORDS.test(stripComments(s));
        expect(probe("label = 'Cure the zombie';")).toBe(true);
        expect(probe("title = 'The Lab';")).toBe(true);
        expect(probe("const n = 1; // a zombie, in a comment")).toBe(false);
        expect(probe("const label = 'Slipped a stage'; const collab = 1;")).toBe(false); // 'label' / 'collab' are not 'lab'
    });
});
