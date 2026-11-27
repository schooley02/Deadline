/**
 * @jest-environment jsdom
 *
 * VillageCard (V7 W2 Build 2, 2026-10-30): the building card. buildModel / cardHtml are pure; open() is
 * exercised against a stub Modal. Tier maths itself is covered in villageProgress.test.js.
 */
const VillageProgress = require('../js/villageProgress.js');
const VillageCard = require('../js/ui/villageCard.js');

const progress = (value, kind = 'nights') => VillageProgress.tierFor(value, VillageProgress.DEFAULT_THRESHOLDS[kind]);

describe('buildModel', () => {
    test('a T1 building shows "N / M unit to earn star 2" and one current pip', () => {
        const m = VillageCard.buildModel({ kind: 'nights', progress: progress(1) });
        expect(m.name).toBe('Broadcast tower');
        expect(m.tier).toBe(1);
        expect(m.barText).toBe('1 / 4 nights to earn star 2');
        expect(m.toNext).toBe(3);
        expect(m.pips.map(p => p.state)).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);
        expect(m.maxed).toBe(false);
    });

    test('a mid tier marks earlier pips done and later pips locked', () => {
        const m = VillageCard.buildModel({ kind: 'slain', progress: progress(60, 'slain') });
        expect(m.tier).toBe(3);
        expect(m.barText).toBe('60 / 100 priorities to earn star 4');
        expect(m.pips.map(p => p.state)).toEqual(['done', 'done', 'current', 'locked', 'locked']);
        expect(m.fraction).toBeGreaterThan(0);
        expect(m.fraction).toBeLessThan(1);
    });

    test('T5 reads "Fully rebuilt" with a full bar and nothing to go', () => {
        const m = VillageCard.buildModel({ kind: 'nights', progress: progress(250) });
        expect(m.tier).toBe(5);
        expect(m.maxed).toBe(true);
        expect(m.barText).toBe('Fully rebuilt');
        expect(m.fraction).toBe(1);
        expect(m.toNext).toBe(0);
        expect(m.pips.map(p => p.state)).toEqual(['done', 'done', 'done', 'done', 'current']);
    });

    test('every building kind has a name, a unit, what it measures and why it helps the player', () => {
        VillageProgress.KINDS.filter(k => k !== 'goals').forEach(k => { // the Lab's words live in VillageCard.LAB (its own tests are at the end of this file)
            const meta = VillageCard.KINDS[k];
            expect(meta).toBeTruthy();
            expect(meta.name.length).toBeGreaterThan(0);
            expect(meta.measures.length).toBeGreaterThan(20);
            expect(meta.why.length).toBeGreaterThan(40);
            expect(meta.why).not.toBe(meta.measures);
            expect(meta.unit.length).toBeGreaterThan(0);
        });
    });

    test('missing progress falls back to T1 with no crash', () => {
        const m = VillageCard.buildModel({ kind: 'habits' });
        expect(m.tier).toBe(1);
        expect(m.value).toBe(0);
        expect(m.pips[0].state).toBe('current');
    });

    test('school: no streak line any more; it carries the report card rows instead (2026-10-31)', () => {
        const base = { kind: 'heroes', progress: progress(0, 'heroes'), hasRoutine: true };
        expect(VillageCard.buildModel({ ...base, extras: { attendanceStreak: 4 } }).lines).toEqual([]);
        const rows = [{ id: 1, name: 'Morning', stars: 3 }];
        expect(VillageCard.buildModel({ ...base, reportRows: rows }).reportRows).toBe(rows);
        expect(VillageCard.buildModel({ ...base }).reportRows).toEqual([]);
        // other buildings never carry a report card
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(0), reportRows: rows }).reportRows).toEqual([]);
    });

    test('school copy: banked hero stars, bar unit "stars"', () => {
        const m = VillageCard.buildModel({ kind: 'heroes', progress: { tier: 1, value: 4, nextAt: 10, fraction: 0.4, toNext: 6 }, hasRoutine: true });
        expect(m.unit).toBe('stars');
        expect(m.barText).toBe('4 / 10 stars to earn star 2');
        expect(m.measures).toMatch(/Hero stars banked/);
    });

    test('Water tower (was the windmill): named "Water tower"; comeback line only when > 0; other buildings never show these lines', () => {
        const w = { kind: 'bestdays', progress: progress(0, 'bestdays') };
        expect(VillageCard.buildModel({ ...w, extras: { comebackDays: 0 } }).name).toBe('Water tower');
        const m = VillageCard.buildModel({ ...w, extras: { comebackDays: 0 } });
        expect(m.why).not.toMatch(/windmill/i);
        expect(m.measures).toMatch(/planned ahead/);                      // the planning-ahead rule (2026-11-25): all three set beforehand, at least two finished
        expect(m.measures).toMatch(/all three priorities/);
        expect(m.measures).toMatch(/at least two/);
        expect(m.why).toMatch(/Perfect plan/);                             // all three finished: shown, never worth extra stars
        expect(m.why).toMatch(/never worth extra stars/);
        expect(VillageCard.buildModel({ ...w, extras: { comebackDays: 0 } }).lines).toEqual([]);
        expect(VillageCard.buildModel({ ...w, extras: { comebackDays: 2 } }).lines[0]).toMatch(/Comeback days this run: 2/);
        // Perfect plans (2026-11-25): its own line, only when > 0, ahead of the comeback line
        expect(VillageCard.buildModel({ ...w, extras: { perfectPlans: 0 } }).lines).toEqual([]);
        const both = VillageCard.buildModel({ ...w, extras: { perfectPlans: 3, comebackDays: 2 } }).lines;
        expect(both[0]).toMatch(/Perfect plans this run: 3/);
        expect(both[0]).toMatch(/never add stars/);
        expect(both[1]).toMatch(/Comeback days this run: 2/);
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(0), extras: { perfectPlans: 4 } }).lines).toEqual([]);
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(0), extras: { attendanceStreak: 3, comebackDays: 3 } }).lines).toEqual([]);
    });

    test('empty states: gym with no bad habit, school with no routine (only when explicitly false)', () => {
        expect(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: false }).empty)
            .toBe('Add a Break Habit to start rebuilding.');
        expect(VillageCard.buildModel({ kind: 'heroes', progress: progress(0, 'heroes'), hasRoutine: false }).empty)
            .toBe('Start a routine to open the school.');
        expect(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: true }).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'heroes', progress: progress(0, 'heroes'), hasRoutine: true }).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers') }).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(0), hasBadHabit: false, hasRoutine: false }).empty).toBeNull();
    });
});

describe('cardHtml', () => {
    test('renders the name, tier stars, bar, measure + why copy and close button; escapes the sprite url', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({
            kind: 'punctuality', progress: progress(30, 'punctuality'), spriteUrl: 'Assets/Village/p"x.png', spriteW: 128, spriteH: 128,
        }));
        expect(html).toContain('village-card-overlay');
        expect(html).toContain('Clock tower');
        expect(html).toContain('aria-label="Tier 2 of 5"');
        expect((html.match(/<svg class="vc-star/g) || [])).toHaveLength(5);
        expect((html.match(/class="vc-star vc-star--on"/g) || [])).toHaveLength(2);
        expect(html).not.toContain('vc-pip'); // the T1..T5 buttons are gone
        expect(html).toContain('30 / 120 on time to earn star 3');
        expect(html).toContain('What we measure');
        expect(html).toContain('Why it helps');
        expect(html).toContain(VillageCard.KINDS.punctuality.why);
        expect(html).toContain('data-action="close"');
        // a small corner x, not a full-width Close row (2026-10-30)
        expect(html).toContain('class="modal-close-x"');
        expect(html).toContain('aria-label="Close"');
        expect(html).not.toContain('modal-buttons');
        expect(html).not.toContain('primary-button');
        expect(html).toContain('width:384px'); // 3x the 128px canvas
        expect(html).not.toContain('p"x.png');
    });

    test('the empty state and extras render only when present', () => {
        const none = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(0) }));
        expect(none).not.toContain('vc-empty');
        expect(none).not.toContain('vc-line');
        const gym = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: false }));
        expect(gym).toContain('vc-empty');
    });

    test('maxed building gets the maxed bar-text class', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(500) }));
        expect(html).toContain('vc-bar-text--maxed');
        expect(html).toContain('Fully rebuilt');
    });
});

describe('spriteScale', () => {
    test('3x when it fits 480x480, 2x when only that fits, else fitted to the column height', () => {
        expect(VillageCard.spriteScale(128, 128)).toBe(3);
        expect(VillageCard.spriteScale(128, 133)).toBe(3);
        expect(VillageCard.spriteScale(128, 160)).toBe(3); // 384x480: fits since the limits grew to 480x480 (2026-11-27)
        expect(VillageCard.spriteScale(128, 161)).toBe(2);
        expect(VillageCard.spriteScale(161, 128)).toBe(2);
        expect(VillageCard.spriteScale(112, 208)).toBe(2); // Clock tower (112x208 since 2026-11-24): an even 2x, 416px tall
        expect(VillageCard.spriteScale(128, 256)).toBe(1.5); // a canvas too tall for 2x (the old 128x256 tower) is fitted: 256 * 1.5 = 384 tall
        expect(VillageCard.spriteScale(0, 0)).toBe(3); // unknown size: the card omits the width style
    });
    test('bigger art (2026-11-27): the 160x160 squares show at 3x; every other shipped canvas keeps its scale', () => {
        expect(VillageCard.spriteScale(160, 160)).toBe(3); // Lab, Command Post, Police station: 480px (was 2x = 320px)
        expect(VillageCard.spriteScale(192, 160)).toBe(2); // Gym
        expect(VillageCard.spriteScale(176, 144)).toBe(2); // High school, Hospital
        expect(VillageCard.spriteScale(128, 208)).toBe(2); // Water tower
        expect(VillageCard.spriteScale(144, 208)).toBe(2); // Broadcast tower
    });
    test('a sprite shown wider than 384px gets the wider card; the others do not', () => {
        const html = (w, h) => VillageCard.cardHtml(VillageCard.buildModel({ kind: 'slain', progress: progress(0, 'slain'), spriteUrl: 'a.png', spriteW: w, spriteH: h }));
        expect(html(160, 160)).toContain('class="modal-content village-card village-card--wide"');
        expect(html(160, 160)).toContain('width:480px;--vc-h:480px;'); // --vc-h: the full shown height, which the short-screen CSS scales down from
        expect(html(192, 160)).toContain('class="modal-content village-card"'); // 384px: not wider
        expect(html(128, 128)).toContain('class="modal-content village-card"');
        expect(VillageCard.cardHtml(VillageCard.buildModel({ kind: 'slain', progress: progress(0, 'slain') }))).toContain('class="modal-content village-card"'); // no sprite
    });
    test('the card is two columns: art (.vc-art) beside the info (.vc-info)', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(0) }));
        expect(html.indexOf('vc-body')).toBeLessThan(html.indexOf('vc-art'));
        expect(html.indexOf('vc-art')).toBeLessThan(html.indexOf('vc-info'));
        expect(html.indexOf('vc-info')).toBeLessThan(html.indexOf('vc-head'));
        expect(html.indexOf('vc-bar-text')).toBeLessThan(html.indexOf('data-action="close"'));
    });
    test('a mirrored building is mirrored on the card too', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(0), spriteUrl: 'a.png', spriteW: 128, spriteH: 160, spriteFlip: true }));
        expect(html).toContain('transform:scaleX(-1)');
        const plain = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(0), spriteUrl: 'a.png', spriteW: 128, spriteH: 160 }));
        expect(plain).not.toContain('scaleX');
    });
    test('the card html uses the model scale', () => {
        const tall = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress: progress(0, 'punctuality'), spriteUrl: 'a.png', spriteW: 146, spriteH: 262 }));
        expect(tall).toContain('width:215px'); // 146 * 1.47 (fitted to 384px tall)
    });
});

describe('open', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        global.Modal = {
            open: (html, opts) => {
                if (opts.dedupeSelector && document.querySelector(opts.dedupeSelector)) return null;
                document.body.insertAdjacentHTML('beforeend', html);
                return document.body.lastElementChild;
            },
        };
    });
    afterEach(() => { delete global.Modal; });

    test('opens one card at a time and the corner x removes it', () => {
        VillageCard.open({ kind: 'nights', progress: progress(2) });
        VillageCard.open({ kind: 'slain', progress: progress(2, 'slain') });
        expect(document.querySelectorAll('.village-card-overlay')).toHaveLength(1);
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelectorAll('.village-card-overlay')).toHaveLength(0);
    });

    // 2026-11-04 (Jeremy): the Boxing gym's empty line reads "Add a Break Habit to start rebuilding." and its
    // "Break Habit" words are a text-link button that closes the card and opens Add Habit with Break Habit picked.
    test('Boxing gym empty line: "Break Habit" is a link that closes the card and calls onAddBreakHabit', () => {
        const onAddBreakHabit = jest.fn();
        VillageCard.open({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: false, onAddBreakHabit });
        const empty = document.querySelector('.vc-empty');
        expect(empty.textContent).toBe('Add a Break Habit to start rebuilding.');
        const link = empty.querySelector('button.vc-text-link[data-action="add-break-habit"]');
        expect(link).not.toBeNull();
        expect(link.textContent).toBe('Break Habit');
        const outside = jest.fn();
        document.addEventListener('click', outside);
        link.click();
        document.removeEventListener('click', outside);
        expect(onAddBreakHabit).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('.village-card-overlay')).toHaveLength(0);
        expect(outside).not.toHaveBeenCalled(); // stopped, so Modal's outside-click dismiss never sees it
    });

    test('without a handler the empty line stays plain text (no dead link)', () => {
        VillageCard.open({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: false });
        const empty = document.querySelector('.vc-empty');
        expect(empty.textContent).toBe('Add a Break Habit to start rebuilding.');
        expect(empty.querySelector('button')).toBeNull();
    });

    test('a gym that already has a Break Habit shows no empty line and no link', () => {
        VillageCard.open({ kind: 'lurkers', progress: progress(2, 'lurkers'), hasBadHabit: true, onAddBreakHabit: jest.fn() });
        expect(document.querySelector('.vc-empty')).toBeNull();
        expect(document.querySelector('.vc-text-link')).toBeNull();
    });
});

describe('wording (2026-11-04): Build Habit / Break Habit, never "habit to build / break"', () => {
    test('Boxing gym and Hospital "What we measure" lines', () => {
        const gym = VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers') }).measures;
        expect(gym).toBe('Days you had a Break Habit due and did not slip. Days with nothing to resist do not count.');
        const hosp = VillageCard.buildModel({ kind: 'habits', progress: progress(0, 'habits') }).measures;
        expect(hosp.startsWith('Build Habits done:')).toBe(true);
    });
});

describe('starsHtml (tier as five stars, 2026-10-30)', () => {
    test('filled stars = tier, the rest empty; always five; labelled for screen readers', () => {
        [1, 2, 3, 4, 5].forEach((t) => {
            const html = VillageCard.starsHtml(t);
            expect((html.match(/<svg /g) || [])).toHaveLength(5);
            expect((html.match(/vc-star--on/g) || [])).toHaveLength(t);
            expect(html).toContain(`aria-label="Tier ${t} of 5"`);
        });
    });

    test('out-of-range or missing tiers clamp to 1..5; size is applied', () => {
        expect((VillageCard.starsHtml(0).match(/vc-star--on/g) || [])).toHaveLength(1);
        expect((VillageCard.starsHtml(9).match(/vc-star--on/g) || [])).toHaveLength(5);
        expect((VillageCard.starsHtml(undefined).match(/vc-star--on/g) || [])).toHaveLength(1);
        expect(VillageCard.starsHtml(3, 14)).toContain('width="14" height="14"');
    });

    test('the village panel rows use stars, not "Tier N" text', () => {
        const VillagePanel = require('../js/ui/villagePanel.js');
        global.VillageCard = VillageCard;
        const model = VillagePanel.buildModel({ progress: { nights: { tier: 3, value: 20, nextAt: 50, toNext: 30, maxed: false, fraction: 0.4 } } });
        const row = VillagePanel.rowHtml(model.rows.find(r => r.kind === 'nights'));
        expect(row).toContain('aria-label="Tier 3 of 5"');
        expect(row).not.toContain('vp-tier');
    });
});

describe('Clock tower copy and "Your reward" (pushback charges, Build C)', () => {
    const reward = { current: 'Short 3 a day \u00B7 Medium 2 a day \u00B7 Long 2 a week', next: 'Star 2 adds +1 Short pushback a day', maxed: false };

    test('What we measure explains the 4-hour rule and the 10-minute grace', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress: progress(0, 'punctuality') }));
        expect(html).toContain('A task you pushed back inside its last 4 hours');
        expect(html).toContain('more than 4 hours away is planning ahead, and still counts');
        expect(html).toContain('Fixing the time within 10 minutes of creating a task');
    });

    test('Clock tower shows the reward block: current allowance and what the next star adds', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress: progress(0, 'punctuality'), reward }));
        expect(html).toContain('Your reward');
        expect(html).toContain('Free pushbacks: Short 3 a day');
        expect(html).toContain('Star 2 adds +1 Short pushback a day.');
        expect(html.indexOf('Your reward')).toBeGreaterThan(html.indexOf('What we measure'));
        expect(html.indexOf('Your reward')).toBeLessThan(html.indexOf('Why it helps'));
    });

    test('top star says so; other buildings and a missing reward show no block', () => {
        const top = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress: progress(0, 'punctuality'), reward: { current: 'x', next: null, maxed: true } }));
        expect(top).toContain('Top star');
        expect(VillageCard.cardHtml(VillageCard.buildModel({ kind: 'punctuality', progress: progress(0, 'punctuality') }))).not.toContain('Your reward');
        expect(VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(0, 'nights'), reward }))).not.toContain('Your reward');
    });
});

describe('"Next item" -- the item the next star pays (village tier drops, 2026-11-03)', () => {
    const VillageDrops = require('../js/villageDrops.js');
    const CONFIG = require('../js/config.js');
    const ctxFor = (kind, value) => {
        const p = VillageProgress.tierFor(value, VillageProgress.DEFAULT_THRESHOLDS[kind]);
        const d = VillageDrops.nextDrop(kind, p.tier, CONFIG.VILLAGE_TIER_DROPS);
        return { kind, progress: p, nextDrop: d ? { star: d.star, label: VillageDrops.label(d, CONFIG.SHOP_ITEMS) } : null };
    };

    test('a T1 building shows the star-2 item under the bar', () => {
        const m = VillageCard.buildModel(ctxFor('slain', 1));
        expect(m.nextItem).toEqual({ star: 2, label: 'Medium Pushback (2 hr) ×1' });
        const html = VillageCard.cardHtml(m);
        expect(html).toContain('Next item');
        expect(html).toContain('Star 2: Medium Pushback (2 hr) ×1');
    });

    test('it moves up the ladder with the tier', () => {
        expect(VillageCard.buildModel(ctxFor('slain', 8)).nextItem).toEqual({ star: 3, label: 'Repair Kit (Small) ×1' });
        expect(VillageCard.buildModel(ctxFor('slain', 36)).nextItem).toEqual({ star: 4, label: 'Repair Kit (Medium) ×1' });
        expect(VillageCard.buildModel(ctxFor('slain', 100)).nextItem).toEqual({ star: 5, label: 'Repair Kit (Large) ×1' });
    });

    test('the themed star-5 prize shows on the building that earns it', () => {
        expect(VillageCard.buildModel(ctxFor('lurkers', 40)).nextItem).toEqual({ star: 5, label: 'Habit Cheat Day ×1' });
        expect(VillageCard.buildModel(ctxFor('habits', 250)).nextItem).toEqual({ star: 5, label: 'Skip Day ×1' });
        expect(VillageCard.buildModel(ctxFor('nights', 50)).nextItem).toEqual({ star: 5, label: 'Sick Day ×1' });
    });

    test('at the top star the card says every item reward is earned', () => {
        const m = VillageCard.buildModel(ctxFor('slain', 200));
        expect(m.nextItem).toBeNull();
        expect(m.maxed).toBe(true);
        const html = VillageCard.cardHtml(m);
        expect(html).toContain('All item rewards earned.');
        expect(html).not.toContain('Next item');
    });

    test('a top-star building ignores a stale nextDrop', () => {
        const m = VillageCard.buildModel({ kind: 'slain', progress: progress(200, 'slain'), nextDrop: { star: 2, label: 'Stale ×1' } });
        expect(m.nextItem).toBeNull();
    });

    test('no nextDrop given (older callers) = no line and no crash', () => {
        const m = VillageCard.buildModel({ kind: 'nights', progress: progress(1) });
        expect(m.nextItem).toBeNull();
        const html = VillageCard.cardHtml(m);
        expect(html).not.toContain('Next item');
        expect(html).not.toContain('All item rewards earned.');
    });

    test('malformed nextDrop values are ignored', () => {
        [{ star: 'x', label: 'A' }, { star: 3, label: '' }, { star: 3 }, { label: 'A' }, null, 'junk'].forEach((nd) => {
            expect(VillageCard.buildModel({ kind: 'nights', progress: progress(1), nextDrop: nd }).nextItem).toBeNull();
        });
    });

    test('the label is escaped', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(1), nextDrop: { star: 2, label: '<b>x</b>' } }));
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
        expect(html).not.toContain('<b>x</b>');
    });

    test('the item line sits under the progress bar text, above the explanations', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel(ctxFor('slain', 1)));
        const bar = html.indexOf('vc-bar-text');
        const item = html.indexOf('vc-next-item');
        const measures = html.indexOf('What we measure');
        expect(bar).toBeGreaterThan(-1);
        expect(item).toBeGreaterThan(bar);
        expect(measures).toBeGreaterThan(item);
    });

    test('every building gets a next-item line at star 1 (all eight kinds)', () => {
        VillageProgress.KINDS.forEach((kind) => {
            const m = VillageCard.buildModel(ctxFor(kind, 0));
            expect(m.nextItem).not.toBeNull();
            expect(m.nextItem.star).toBe(2);
        });
    });

    test('the Clock tower shows BOTH its pushback reward block and the next item line', () => {
        const reward = { current: '3 Short a day', next: 'Star 2 adds +1 Short a day', maxed: false };
        const html = VillageCard.cardHtml(VillageCard.buildModel(Object.assign(ctxFor('punctuality', 1), { reward })));
        expect(html).toContain('Your reward');
        expect(html).toContain('Next item');
    });
});

describe('Command Post (the Armory re-aimed at priorities, 2026-11-09)', () => {
    test('the slain kind is named Command Post and speaks about priorities, not kills', () => {
        const m = VillageCard.buildModel({ kind: 'slain', progress: progress(1, 'slain') });
        expect(m.name).toBe('Command Post');
        expect(m.barText).toBe('1 / 8 priorities to earn star 2');
        expect(m.measures).toContain('up to three a day');
        expect(JSON.stringify(m)).not.toMatch(/Armory|zombie/i);
    });
    test('nothing counted yet shows the empty line, with no link (the Priority box lives in the task forms)', () => {
        const m = VillageCard.buildModel({ kind: 'slain', progress: progress(0, 'slain'), onAddBreakHabit() {} });
        expect(m.empty).toBe('Tick Priority on a task to start building.');
        expect(m.emptyLink).toBeNull();
        expect(VillageCard.buildModel({ kind: 'slain', progress: progress(1, 'slain') }).empty).toBeNull();
    });
});

describe('Lab card (kind `goals`, 2026-11-27): the art preview, with the Goals window behind a "View Goals" button', () => {
    const lab = (value, extra = {}) => VillageCard.buildModel({ kind: 'goals', progress: progress(value, 'goals'), perPerson: 10, ...extra });

    test('the Lab has its own words and is not in KINDS (the village panel walks KINDS for the other eight)', () => {
        expect(VillageCard.KINDS.goals).toBeUndefined();
        const meta = VillageCard.LAB;
        expect(meta.name).toBe('Lab');
        expect(meta.unit).toBe('people cured');
        expect(meta.measures.length).toBeGreaterThan(20);
        expect(meta.why.length).toBeGreaterThan(40);
        expect(meta.why).not.toBe(meta.measures);
        expect(meta.measures + meta.why).not.toMatch(/\u2014/); // no em dashes, like the other cards
    });

    test('the bar counts PEOPLE, not tenths: "0.4 / 1 people cured to earn star 2"', () => {
        const m = lab(4);
        expect(m.name).toBe('Lab');
        expect(m.tier).toBe(1);
        expect(m.barText).toBe('0.4 / 1 people cured to earn star 2');
        expect(m.measures).toBe(VillageCard.LAB.measures);
        expect(m.why).toBe(VillageCard.LAB.why);
        expect(lab(0).barText).toBe('0 / 1 people cured to earn star 2');
        expect(lab(25).barText).toBe('2.5 / 6 people cured to earn star 3');
        expect(lab(180).barText).toBe('18 / 40 people cured to earn star 5');
    });

    test('`perPerson` comes from the caller (default 10)', () => {
        expect(VillageCard.buildModel({ kind: 'goals', progress: progress(4, 'goals') }).barText).toBe('0.4 / 1 people cured to earn star 2');
        expect(VillageCard.buildModel({ kind: 'goals', progress: progress(4, 'goals'), perPerson: 1 }).barText).toBe('4 / 10 people cured to earn star 2');
    });

    test('star 5 reads "Fully rebuilt"', () => {
        const m = lab(400);
        expect(m.tier).toBe(5);
        expect(m.maxed).toBe(true);
        expect(m.barText).toBe('Fully rebuilt');
    });

    test('"View Goals" shows only when the card is given onOpenGoals, and only on the Lab', () => {
        expect(lab(4).action).toBeNull();
        expect(lab(4, { onOpenGoals: () => {} }).action).toEqual({ text: 'View Goals', action: 'open-goals' });
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(1), onOpenGoals: () => {} }).action).toBeNull();
        const html = VillageCard.cardHtml(lab(4, { onOpenGoals: () => {} }));
        expect(html).toMatch(/<button type="button" class="primary-button vc-action" data-action="open-goals">View Goals<\/button>/);
        expect(html.indexOf('vc-action')).toBeLessThan(html.indexOf('What we measure')); // above the long text: on screen without scrolling
        expect(VillageCard.cardHtml(lab(4))).not.toContain('vc-action');
        expect(VillageCard.cardHtml(VillageCard.buildModel({ kind: 'nights', progress: progress(1) }))).not.toContain('vc-action');
    });

    test('two columns like every other card: the sprite at 3x in the art column', () => {
        const m = lab(4, { spriteUrl: 'Assets/Village/goals_t1.png', spriteW: 160, spriteH: 160 });
        expect(m.spriteScale).toBe(3);
        const html = VillageCard.cardHtml(m);
        expect(html).toMatch(/<div class="vc-art"><img class="vc-sprite" src="Assets\/Village\/goals_t1\.png"/);
        expect(html).toContain('width:480px');
        expect(html).toContain('aria-label="Lab, tier 1"');
    });

    test('no active goal: an empty line points at the button; with a goal (or unknown) there is none', () => {
        expect(lab(0, { hasGoal: false }).empty).toBe(VillageCard.EMPTY_TEXT.goals);
        expect(lab(0, { hasGoal: true }).empty).toBeNull();
        expect(lab(0).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(1), hasGoal: false }).empty).toBeNull();
    });

    test('the next star\'s item shows like on the other cards', () => {
        const m = lab(4, { nextDrop: { star: 2, label: 'Medium Pushback (2 hr)' } });
        expect(m.nextItem).toEqual({ star: 2, label: 'Medium Pushback (2 hr)' });
    });

    describe('open', () => {
        let overlay;
        beforeEach(() => {
            document.body.innerHTML = ''; // cards left open by the tests above
            global.Modal = {
                open: jest.fn((html) => {
                    const host = document.createElement('div');
                    host.innerHTML = html.trim();
                    overlay = host.firstChild;
                    document.body.appendChild(overlay);
                    return overlay;
                }),
            };
        });
        afterEach(() => { delete global.Modal; document.body.innerHTML = ''; });

        test('"View Goals" closes the card, then opens the Goals window; the click never reaches the document', () => {
            const onOpenGoals = jest.fn(() => expect(document.querySelector('.village-card-overlay')).toBeNull()); // the card is already gone
            const outside = jest.fn();
            document.addEventListener('click', outside);
            VillageCard.open({ kind: 'goals', progress: progress(4, 'goals'), perPerson: 10, onOpenGoals });
            overlay.querySelector('[data-action="open-goals"]').click();
            document.removeEventListener('click', outside);
            expect(onOpenGoals).toHaveBeenCalledTimes(1);
            expect(outside).not.toHaveBeenCalled();
        });

        test('the x closes the card without opening the Goals window', () => {
            const onOpenGoals = jest.fn();
            VillageCard.open({ kind: 'goals', progress: progress(4, 'goals'), perPerson: 10, onOpenGoals });
            overlay.querySelector('[data-action="close"]').click();
            expect(document.querySelector('.village-card-overlay')).toBeNull();
            expect(onOpenGoals).not.toHaveBeenCalled();
        });
    });
});
