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
    test('a T1 building shows "N / M unit to reach T2" and one current pip', () => {
        const m = VillageCard.buildModel({ kind: 'nights', progress: progress(1) });
        expect(m.name).toBe('Radio tower');
        expect(m.tier).toBe(1);
        expect(m.barText).toBe('1 / 4 nights to reach T2');
        expect(m.toNext).toBe(3);
        expect(m.pips.map(p => p.state)).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);
        expect(m.maxed).toBe(false);
    });

    test('a mid tier marks earlier pips done and later pips locked', () => {
        const m = VillageCard.buildModel({ kind: 'slain', progress: progress(160, 'slain') });
        expect(m.tier).toBe(3);
        expect(m.barText).toBe('160 / 450 done to reach T4');
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

    test('every building kind has a name, a measures line and a unit', () => {
        VillageProgress.KINDS.forEach(k => {
            const meta = VillageCard.KINDS[k];
            expect(meta).toBeTruthy();
            expect(meta.name.length).toBeGreaterThan(0);
            expect(meta.measures.length).toBeGreaterThan(0);
            expect(meta.unit.length).toBeGreaterThan(0);
        });
    });

    test('missing progress falls back to T1 with no crash', () => {
        const m = VillageCard.buildModel({ kind: 'habits' });
        expect(m.tier).toBe(1);
        expect(m.value).toBe(0);
        expect(m.pips[0].state).toBe('current');
    });

    test('school: streak line only when the streak is > 0 (singular for 1)', () => {
        const base = { kind: 'heroes', progress: progress(0, 'heroes'), hasRoutine: true };
        expect(VillageCard.buildModel({ ...base, extras: { attendanceStreak: 0 } }).lines).toEqual([]);
        expect(VillageCard.buildModel({ ...base, extras: { attendanceStreak: 1 } }).lines[0]).toMatch(/streak: 1 day\./);
        expect(VillageCard.buildModel({ ...base, extras: { attendanceStreak: 4 } }).lines[0]).toMatch(/streak: 4 days\./);
    });

    test('windmill: comeback line only when > 0; other buildings never show these lines', () => {
        const w = { kind: 'bestdays', progress: progress(0, 'bestdays') };
        expect(VillageCard.buildModel({ ...w, extras: { comebackDays: 0 } }).lines).toEqual([]);
        expect(VillageCard.buildModel({ ...w, extras: { comebackDays: 2 } }).lines[0]).toMatch(/Comeback days this run: 2/);
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(0), extras: { attendanceStreak: 3, comebackDays: 3 } }).lines).toEqual([]);
    });

    test('empty states: gym with no bad habit, school with no routine (only when explicitly false)', () => {
        expect(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: false }).empty)
            .toBe('Add a habit to resist to start rebuilding.');
        expect(VillageCard.buildModel({ kind: 'heroes', progress: progress(0, 'heroes'), hasRoutine: false }).empty)
            .toBe('Start a routine to open the school.');
        expect(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers'), hasBadHabit: true }).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'heroes', progress: progress(0, 'heroes'), hasRoutine: true }).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'lurkers', progress: progress(0, 'lurkers') }).empty).toBeNull();
        expect(VillageCard.buildModel({ kind: 'nights', progress: progress(0), hasBadHabit: false, hasRoutine: false }).empty).toBeNull();
    });
});

describe('cardHtml', () => {
    test('renders the name, tier, pips, bar and close button; escapes the sprite url', () => {
        const html = VillageCard.cardHtml(VillageCard.buildModel({
            kind: 'punctuality', progress: progress(30, 'punctuality'), spriteUrl: 'Assets/Village/p"x.png', spriteW: 128, spriteH: 128,
        }));
        expect(html).toContain('village-card-overlay');
        expect(html).toContain('Clock tower');
        expect(html).toContain('Tier 2');
        expect((html.match(/class="vc-pip /g) || [])).toHaveLength(5);
        expect(html).toContain('30 / 120 on time to reach T3');
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
    test('3x for a 128px canvas, 2x when only that fits, else fitted to the column height (the Clock tower)', () => {
        expect(VillageCard.spriteScale(128, 128)).toBe(3);
        expect(VillageCard.spriteScale(128, 133)).toBe(3);
        expect(VillageCard.spriteScale(128, 160)).toBe(2);
        expect(VillageCard.spriteScale(146, 150)).toBe(2);
        expect(VillageCard.spriteScale(128, 256)).toBe(1.5); // Clock tower: 256 * 1.5 = 384 tall, same as a 3x building
        expect(VillageCard.spriteScale(0, 0)).toBe(3); // unknown size: the card omits the width style
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
});
