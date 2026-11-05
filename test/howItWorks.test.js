/**
 * "How Deadline works" page (2026-11-03; js/ui/howItWorks.js, plan docs/HOW_IT_WORKS_PLAN.md).
 *
 * The page's whole job is to never lie, so these tests tie every number in the words to CONFIG (a retuned value must
 * change the page; a stale hardcoded number fails here), pin the claims to the code that makes them true, and check the
 * wiring (Settings button, index.html, service worker). DOM pieces use tiny fakes (this suite runs under node).
 */
const fs = require('fs');
const path = require('path');
global.CONFIG = require('../js/config.js');
global.Habits = require('../js/habits.js');
global.Heroes = require('../js/heroes.js');
global.PointsInfo = require('../js/pointsInfo.js');
global.Pushback = require('../js/pushback.js');
global.PushbackHelp = require('../js/ui/pushbackHelp.js');
const HeroesView = require('../js/ui/heroes.js');
const SettingsView = require('../js/ui/settingsView.js');
const HowItWorks = require('../js/ui/howItWorks.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const all = (cfg) => HowItWorks.topics(cfg || CONFIG);
const topic = (id, cfg) => all(cfg).find(t => t.id === id);
// Everything a player can read in a topic, as one lowercase-insensitive string.
const textOf = (t) => [].concat(t.what || [], t.list || [], t.html || '', t.why || '').join(' ');

describe('the nine topics', () => {
    test('Points, Priorities, Pushbacks, Streaks, Hero ranking, Achievements, The sky, Timers and Time Logged, When a run ends, in that order', () => {
        expect(all().map(t => t.title)).toEqual(['Points', 'Three priorities a day', 'Pushbacks', 'Streaks', 'Hero ranking', 'Achievements', 'The sky', 'Timers and Time Logged', 'When a run ends']);
        expect(all().map(t => t.id)).toEqual(['points', 'priorities', 'pushbacks', 'streaks', 'heroes', 'achievements', 'weather', 'timers', 'runs']);
    });

    test('Streaks, Hero ranking, Achievements, The sky, Timers and When a run ends carry a "Why"; Points and Pushbacks do not invent one', () => {
        ['priorities', 'streaks', 'heroes', 'achievements', 'weather', 'timers', 'runs'].forEach(id => expect(topic(id).why).toBeTruthy());
        ['points', 'pushbacks'].forEach(id => expect(topic(id).why).toBeUndefined());
    });
});

describe('Points', () => {
    test('is PointsInfo.rulesLines, verbatim, plus the debt line', () => {
        const t = topic('points');
        expect(t.list).toEqual(PointsInfo.rulesLines(CONFIG));
        expect(textOf(t)).toContain('only thing that can take you below zero');
        expect(textOf(t)).toContain('Debt never hurts your base and has no deadline');
    });

    test('follows CONFIG (negative control: a retuned value changes the words)', () => {
        const retuned = Object.assign({}, CONFIG, { POINTS_PER_TASK: 7, POINTS_PER_HABIT: 7 });
        expect(textOf(topic('points', retuned))).toContain('pays 7 points');
        expect(textOf(topic('points'))).not.toContain('pays 7 points');
    });
});

describe('Priorities', () => {
    test('quotes the slot count from CONFIG and states the spend / reset / sub-task / move rules', () => {
        const text = textOf(topic('priorities'));
        expect(text).toContain(`${CONFIG.PRIORITY_SLOTS_PER_DAY} priority slots`);
        expect(text).toMatch(/uses a slot for good/);
        expect(text).toMatch(/does not give the slot back/);
        expect(text).toMatch(new RegExp(`Finish all ${CONFIG.PRIORITY_SLOTS_PER_DAY} priorities`));
        expect(text).toMatch(/covers its sub-tasks for one slot/);
        expect(text).toMatch(/drops its priority/);
    });

    test('follows CONFIG (negative control) and never says "High Priority"', () => {
        const retuned = Object.assign({}, CONFIG, { PRIORITY_SLOTS_PER_DAY: 5 });
        expect(topic('priorities', retuned).title).toBe('5 priorities a day');
        expect(textOf(topic('priorities', retuned))).toContain('5 priority slots');
        expect(textOf(topic('priorities'))).not.toMatch(/high.priority/i);
    });
});

describe('Pushbacks', () => {
    test('quotes the base (Clock tower star 1) allowance from CONFIG', () => {
        const a = CONFIG.PUSHBACK_ALLOWANCE[1];
        const html = topic('pushbacks').html;
        expect(html).toContain(`Short (up to 30 min): ${a.short} a day`);
        expect(html).toContain(`Medium (up to 2 hr): ${a.medium} a day`);
        expect(html).toContain(`Long (up to 1 day): ${a.long} a week`);
    });

    test('follows CONFIG (negative control)', () => {
        const cfg = Object.assign({}, CONFIG, { PUSHBACK_ALLOWANCE: { 1: { short: 9, medium: 8, long: 7 } } });
        expect(topic('pushbacks', cfg).html).toContain('Short (up to 30 min): 9 a day');
    });

    test('is the same words as the in-game (i) panel', () => {
        expect(topic('pushbacks').html)
            .toBe(PushbackHelp.hintHtml({ allowance: Pushback.allowanceForStar(1, CONFIG.PUSHBACK_ALLOWANCE) }));
    });
});

describe('Streaks', () => {
    test('says streaks pay no points and the bonus is the record over the last N times (N from CONFIG)', () => {
        const text = textOf(topic('streaks'));
        expect(text).toContain("Streaks don't pay points");
        expect(text).toContain(`over the last ${CONFIG.HABIT_RATE_WINDOW} times`);
        expect(text).toContain(`At ${CONFIG.HABIT_STREAK_BONUS_THRESHOLD} days`);
        expect(text).toContain(`at ${CONFIG.HABIT_STREAK_STRONG_THRESHOLD} it blazes`);
        expect(text).toContain('A miss resets it');
    });

    test('NEGATIVE CONTROL: the numbers are not hardcoded', () => {
        const cfg = Object.assign({}, CONFIG, { HABIT_RATE_WINDOW: 30, HABIT_STREAK_BONUS_THRESHOLD: 5, HABIT_STREAK_STRONG_THRESHOLD: 10 });
        const text = textOf(topic('streaks', cfg));
        expect(text).toContain('over the last 30 times');
        expect(text).toContain('At 5 days');
        expect(text).toContain('at 10 it blazes');
        expect(text).not.toContain('22');
    });

    test('streaks really are visual only: a perfect streak does not change the points a completion pays', () => {
        // The claim "Streaks don't pay points" is true only while points depend on the hit rate, never on `streak`.
        const cfg = {
            xpPerHabitComplete: CONFIG.XP_PER_HABIT_COMPLETE, pointsPerHabit: CONFIG.POINTS_PER_HABIT,
            rateWindow: CONFIG.HABIT_RATE_WINDOW, rateMinSample: CONFIG.HABIT_RATE_MIN_SAMPLE, rateTiers: CONFIG.HABIT_RATE_TIERS,
        };
        const due = new Date('2026-11-03T12:00:00');
        // A full window of wins so the bonus multiplier is live (a vacuous 1x would prove nothing).
        const hist = Array.from({ length: 22 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, success: true }));
        const low = Habits.applyHabitCompletion(0, hist, false, due, cfg);
        const high = Habits.applyHabitCompletion(99, hist, false, due, cfg);
        expect(low.multiplier).toBeGreaterThan(1);
        expect(low.streak).toBe(1);
        expect(high.streak).toBe(100);
        expect(high.pointsGained).toBe(low.pointsGained);
        expect(high.multiplier).toBe(low.multiplier);
    });

    test('Break habits keeping their streak is the documented rule (DECISIONS 2026-10-31, neutral settle)', () => {
        expect(textOf(topic('streaks'))).toContain('Break Habits keep their streak while you');
        expect(read('docs/DECISIONS.md')).toContain('streaks for Break habits survive an absence');
    });
});

describe('Hero ranking', () => {
    const text = () => textOf(topic('heroes'));

    test('every number comes from CONFIG: window, star rates, days on record, revive health', () => {
        const tiers = CONFIG.HERO_STAR_TIERS.slice().sort((a, b) => a.stars - b.stars);
        expect(text()).toContain(`last ${CONFIG.HERO_STAR_RATE_WINDOW} scheduled times`);
        expect(text()).toContain(HowItWorks.andList(tiers.map(t => Math.round(t.minRate * 100) + '%')));
        expect(text()).toContain(HowItWorks.andList(tiers.map(t => t.minDays)));
        expect(text()).toContain(`Stars run from 1 to ${tiers[tiers.length - 1].stars}`);
        expect(text()).toContain(`revived the next day at ${Math.round(100 * CONFIG.HERO_REVIVE_HEALTH / CONFIG.ROUTINE_MAX_HEALTH)}% health`);
    });

    test('NEGATIVE CONTROL: retuned star tiers and window change the words', () => {
        const cfg = Object.assign({}, CONFIG, {
            HERO_STAR_RATE_WINDOW: 14,
            HERO_STAR_TIERS: [{ minRate: 0.5, minDays: 1, stars: 1 }, { minRate: 0.99, minDays: 30, stars: 2 }],
            HERO_REVIVE_HEALTH: 25,
        });
        const t = textOf(topic('heroes', cfg));
        expect(t).toContain('last 14 scheduled times');
        expect(t).toContain('50% and 99%');
        expect(t).toContain('(1 and 30)');
        expect(t).toContain('Stars run from 1 to 2');
        expect(t).toContain('at 25% health');
    });

    test('the ghost clause follows KO_GHOST_POINTS_FACTOR (only claims "no points" while it is 0)', () => {
        expect(text()).toContain('ghosts that pay no points');
        const paying = textOf(topic('heroes', Object.assign({}, CONFIG, { KO_GHOST_POINTS_FACTOR: 0.5 })));
        expect(paying).not.toContain('pay no points');
    });

    test('the order it states (level, then hit rate, then name) is the order rankRoutines really uses', () => {
        expect(text()).toMatch(/level first.*better hit rate.*then the name/);
        // Fixture: B outranks A on level; C beats D on rate within a level; E before F on name at equal rate.
        const day = 24 * 60 * 60 * 1000;
        const created = Date.now() - 40 * day;
        const mk = (id, name, level, wins, total) => ({ id, name, level, createdAt: created, habitDefinitionIds: ['h' + id] });
        const habit = (id, wins, total) => ({
            id: 'h' + id, routineId: id, isNegative: false,
            occurrenceHistory: Array.from({ length: total }, (_, i) => ({
                date: new Date(created + (i + 1) * day).toISOString().slice(0, 10), success: i < wins,
            })),
        });
        const routines = [mk('A', 'Alpha', 1), mk('B', 'Bravo', 2), mk('C', 'Charlie', 3), mk('D', 'Delta', 3), mk('F', 'Foxtrot', 4), mk('E', 'Echo', 4)];
        const habits = [habit('A', 22, 22), habit('B', 1, 22), habit('C', 22, 22), habit('D', 10, 22), habit('F', 22, 22), habit('E', 22, 22)];
        const order = HeroesView.rankRoutines(routines, habits, CONFIG, created).map(r => r.id);
        expect(order).toEqual(['E', 'F', 'C', 'D', 'B', 'A']);
    });

    test('does NOT promise healing by completion: that is decided but not built (DECISIONS 2026-11-02)', () => {
        // Remove this guard in the same session that builds hero healing and add the real sentence.
        expect(text().toLowerCase()).not.toMatch(/\bheal(s|ed|ing)?\b/);
        const routinesSrc = read('js/routines.js') + read('js/heroes.js');
        expect(routinesSrc).not.toMatch(/ROUTINE_HEAL|HERO_HEAL|healByCompletion/);
    });
});

describe('Achievements', () => {
    test('lists EVERY family in CONFIG.ACHIEVEMENTS with its tier numbers, and no Steady Hands', () => {
        const t = topic('achievements');
        const joined = textOf(t);
        CONFIG.ACHIEVEMENTS.forEach((family) => {
            const row = t.list.find(l => l.startsWith(family.name));
            expect(row).toBeDefined();
            if (family.tiers.length > 1) expect(row).toContain(`(${family.tiers.map(x => x.threshold).join(' / ')})`);
        });
        expect(t.list).toHaveLength(CONFIG.ACHIEVEMENTS.length);
        expect(joined).not.toContain('Steady Hands');
    });

    test('NEGATIVE CONTROL: a retuned tier changes the numbers; a brand-new family still lists', () => {
        const cfg = Object.assign({}, CONFIG, {
            ACHIEVEMENTS: [
                { id: 'clean_sweep', name: 'Clean Sweep', metric: 'cleanDays', tiers: [{ id: 'a', label: 'Bronze', threshold: 11 }, { id: 'b', label: 'Silver', threshold: 22 }] },
                { id: 'brand_new', name: 'Brand New', metric: 'x', tiers: [{ id: 'c', label: 'Bronze', threshold: 5 }] },
            ],
        });
        const rows = topic('achievements', cfg).list;
        expect(rows[0]).toContain('(11 / 22)');
        expect(rows[1]).toBe('Brand New');
    });

    test('the new badges are described the way they really count', () => {
        const rows = topic('achievements').list.join(' | ');
        expect(rows).toContain(`Honor Roll: Every day one of your heroes ends on the honor roll (${CONFIG.HERO_HONOR_ROLL_STARS} stars or better) counts.`);
        expect(rows).toContain('Clean Sweep: Every day you finish with something due and nothing missed counts.');
        expect(rows).toContain('Iron Will: Every time you resist a Break Habit counts.');
        expect(rows).toContain('Back in Black: Dig out of debt');
    });

    test('says badges are never taken away and pay no points', () => {
        const t = textOf(topic('achievements'));
        expect(t).toContain('never taken away');
        expect(t).toContain('no points');
    });
});

describe('windowHtml', () => {
    test('one <details> per topic, in order, with the corner x', () => {
        const html = HowItWorks.windowHtml(all());
        expect((html.match(/<details /g) || []).length).toBe(9);
        const order = ['Points', 'Three priorities a day', 'Pushbacks', 'Streaks', 'Hero ranking', 'Achievements', 'The sky', 'Timers and Time Logged', 'When a run ends'].map(n => html.indexOf(`<summary>${n}</summary>`));
        expect(order.every(i => i > 0)).toBe(true);
        expect(order).toEqual(order.slice().sort((a, b) => a - b));
        expect(html).toContain('modal-close-x');
        expect(html).toContain('role="dialog"');
    });

    test('opens the requested topic and only that one', () => {
        const html = HowItWorks.windowHtml(all(), 'streaks');
        expect((html.match(/<details [^>]* open>/g) || []).length).toBe(1);
        expect(html).toMatch(/data-topic="streaks" open>/);
        expect(HowItWorks.windowHtml(all())).not.toMatch(/ open>/);
    });

    test('plain-text topics are escaped; only PushbackHelp markup is trusted', () => {
        const html = HowItWorks.topicHtml({ id: 'x', title: '<b>T</b>', what: ['a <script>alert(1)</script> & b'], list: ['<i>x</i>'] });
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<b>T</b>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&amp; b');
        expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
    });

    test('Points shows its rules list before the debt paragraph; the others lead with their paragraphs', () => {
        const pts = HowItWorks.topicHtml(topic('points'));
        expect(pts.indexOf('<ul')).toBeLessThan(pts.indexOf('only thing that can take you below zero'));
        const ach = HowItWorks.topicHtml(topic('achievements'));
        expect(ach.indexOf('Badges (Bronze')).toBeLessThan(ach.indexOf('<ul'));
    });
});

describe('open()', () => {
    afterEach(() => { delete global.Modal; });

    function fakeOverlay() {
        const handlers = [];
        return { removed: false, addEventListener: (ev, fn) => handlers.push([ev, fn]), remove() { this.removed = true; }, handlers };
    }

    test('shows one overlay via Modal.open (deduped) and the x removes it without leaking the click', () => {
        const overlay = fakeOverlay();
        global.Modal = { open: jest.fn(() => overlay) };
        HowItWorks.open({ topic: 'heroes' });
        const [html, opts] = Modal.open.mock.calls[0];
        expect(opts.dedupeSelector).toBe('.hiw-overlay');
        expect(html).toMatch(/data-topic="heroes" open>/);

        const click = overlay.handlers.find(([ev]) => ev === 'click')[1];
        const stop = jest.fn();
        click({ target: { closest: () => null }, stopPropagation: stop });
        expect(overlay.removed).toBe(false);                    // a tap on a topic is not a close
        click({ target: { closest: () => ({}) }, stopPropagation: stop });
        expect(overlay.removed).toBe(true);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('Modal declining to open (already open) is harmless', () => {
        global.Modal = { open: jest.fn(() => null) };
        expect(HowItWorks.open()).toBeNull();
    });
});

describe('Settings button', () => {
    function renderWith(howItWorks) {
        const buttons = {};
        const btn = { addEventListener: jest.fn((ev, fn) => { btn.handler = fn; }) };
        const container = {
            innerHTML: '',
            querySelector: (sel) => (sel === '#howItWorksBtn' ? btn : null),
            querySelectorAll: () => [],
        };
        global.document = { getElementById: (id) => (id === 'settingsWindowContent' ? container : null) };
        if (howItWorks) global.HowItWorks = howItWorks; else delete global.HowItWorks;
        SettingsView.renderSettingsWindow({ currentIntensity: 'full' });
        return { container, btn, buttons };
    }
    afterEach(() => { delete global.document; delete global.HowItWorks; });

    test('Settings shows the button first and tapping it opens the page without letting the tap through', () => {
        const open = jest.fn();
        const { container, btn } = renderWith({ open });
        expect(container.innerHTML).toContain('id="howItWorksBtn"');
        expect(container.innerHTML.indexOf('How Deadline works')).toBeLessThan(container.innerHTML.indexOf('Streak Fire Effects'));
        const stop = jest.fn();
        btn.handler({ stopPropagation: stop });
        expect(stop).toHaveBeenCalled();                        // else Modal's outside-click closes Settings
        expect(open).toHaveBeenCalledTimes(1);
    });

    test('a missing HowItWorks never throws on tap', () => {
        const { btn } = renderWith(null);
        expect(() => btn.handler({ stopPropagation: () => {} })).not.toThrow();
    });
});

describe('shell wiring', () => {
    test('index.html loads the script and stylesheet (css before responsive.css, which must load last)', () => {
        const html = read('index.html');
        expect(html).toContain('<script src="js/ui/howItWorks.js"></script>');
        expect(html).toContain('<link rel="stylesheet" href="css/howItWorks.css">');
        expect(html.indexOf('href="css/howItWorks.css"')).toBeLessThan(html.indexOf('href="css/responsive.css"'));
    });

    test('the service worker precaches both files', () => {
        const sw = read('sw.js');
        expect(sw).toContain("'js/ui/howItWorks.js'");
        expect(sw).toContain("'css/howItWorks.css'");
    });

    test('howItWorks.js never uses a native dialog', () => {
        expect(read('js/ui/howItWorks.js')).not.toMatch(/\b(alert|confirm|prompt)\s*\(/);
    });
});


describe('The sky (run climate)', () => {
    test('quotes the scoring weights, the window and the damage cap from CONFIG.CLIMATE', () => {
        const text = textOf(topic('weather'));
        expect(text).toContain(`last ${CONFIG.CLIMATE.windowDays} finished days`);
        expect(text).toContain('finishing on time counts 50%');
        expect(text).toContain('keeping your habits 25%');
        expect(text).toContain('keeping the church healthy 25%');
        expect(text).toContain(`${CONFIG.CLIMATE.damageCap} HP of damage in one day scores zero`);
    });

    test('follows CONFIG (negative control: a retuned weight changes the words)', () => {
        const retuned = Object.assign({}, CONFIG, { CLIMATE: Object.assign({}, CONFIG.CLIMATE, { weights: { onTime: 0.6, habits: 0.2, church: 0.2 }, windowDays: 5 }) });
        const text = textOf(topic('weather', retuned));
        expect(text).toContain('finishing on time counts 60%');
        expect(text).toContain('last 5 finished days');
        expect(textOf(topic('weather'))).not.toContain('counts 60%');
    });

    test('names all five skies, says a new run starts Hazy and that the sky changes once a day', () => {
        const text = textOf(topic('weather'));
        ['Clear', 'Hazy', 'Overcast', 'Fog', 'Storm'].forEach(b => expect(text).toContain(b));
        expect(text).toContain('A new run starts Hazy');
        expect(text).toContain('once a day');
    });
});

describe('When a run ends (run-end carryover, 2026-11-03)', () => {
    const textOf = (t) => [].concat(t.what || [], t.list || [], t.why || '').join(' ');
    test('says what is kept and what starts over, in plain words', () => {
        const text = textOf(topic('runs'));
        expect(text).toContain('habits, routines and heroes');
        expect(text).toContain('open tasks and sub-tasks with their due dates');
        expect(text).toContain('never starts with fewer slots than the most you have ever earned');
        expect(text).toContain('church health, level, XP and points');
        expect(text).toContain('cannot be earned again by playing is kept until you use it');
        expect(text).toContain('fresh clock');
    });
    test('quotes the slot-unlock levels from CONFIG, not a hardcoded list', () => {
        expect(textOf(topic('runs'))).toContain('Routine slots normally unlock at level 3, level 5 and level 7.');
        const retuned = Object.assign({}, CONFIG, { ROUTINE_SLOTS_PER_LEVEL: { 1: 1, 2: 2, 3: 2 } });
        expect(textOf(topic('runs', retuned))).toContain('unlock at level 2.');
    });
});

describe('Timers and Time Logged (Timer sessions Build C, 2026-11-04)', () => {
    const t = () => topic('timers');
    test('says what the timer does to damage, from CONFIG', () => {
        const text = textOf(t());
        expect(text).toContain(`${Math.round(CONFIG.WORK_TIMER_DAMAGE_FACTOR * 100)}%`);
        expect(text).toContain(`${CONFIG.WORK_TIMER_CHECK_MS / 60000} minutes`);
        expect(text).toContain(`${CONFIG.WORK_TIMER_AUTO_STOP_MS / 60000} minutes`);
    });
    test('explains sessions, the untimed entry, and that a typed total never goes below the timed sessions', () => {
        const text = textOf(t());
        expect(text).toContain('Sessions');
        expect(text).toContain('No start/stop recorded');
        expect(text).toContain('never below');
    });
    test('the take-back rule uses the real numbers and the 1 HP floor, and never refunds', () => {
        const text = textOf(t());
        const minutes = Math.round(CONFIG.DAMAGE_INTERVAL_MS / (1 - CONFIG.WORK_TIMER_DAMAGE_FACTOR) / 60000);
        expect(text).toContain(`1 HP for every ${minutes} minutes`);
        expect(text).toContain('never below 1 HP');
        expect(text).toContain('never gives HP back');
    });
    test('follows the wording rule: "Time Logged", never "logged time"', () => {
        expect(textOf(t())).toContain('Time Logged');
        expect(textOf(t()).toLowerCase()).not.toContain('logged time');
    });
    test('retuned numbers flow through', () => {
        const retuned = Object.assign({}, CONFIG, { WORK_TIMER_DAMAGE_FACTOR: 0.25, WORK_TIMER_CHECK_MS: 30 * 60000 });
        expect(textOf(topic('timers', retuned))).toContain('25%');
        expect(textOf(topic('timers', retuned))).toContain('30 minutes');
    });
});
