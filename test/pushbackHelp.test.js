/**
 * @jest-environment jsdom
 */
const PushbackHelp = require('../js/ui/pushbackHelp.js');

const TABLE = {
    1: { short: 3, medium: 2, long: 2 },
    2: { short: 4, medium: 2, long: 2 },
    3: { short: 4, medium: 3, long: 2 },
    4: { short: 4, medium: 3, long: 3 },
    5: { short: 4, medium: 3, long: 4 },
};

describe('PushbackHelp.hintHtml', () => {
    test('rules only without ctx: names the sizes, no numbers, grace line says it is never flagged', () => {
        const html = PushbackHelp.hintHtml();
        expect(html).toContain('Rescheduling is free when');
        expect(html).toContain('within 10 minutes of creating it (this never counts as pushed back)');
        expect(html).toContain('Short (up to 30 min)');
        expect(html).not.toMatch(/a day<\/p>|a week<\/p>.*Short \(up/);
        expect(html).not.toContain('Right now');
        expect(html).not.toContain('Tokens held');
    });

    test('live numbers come from ctx', () => {
        const html = PushbackHelp.hintHtml({
            allowance: TABLE[2], left: { short: 1, medium: 2, long: 0 }, held: { short: 2, medium: 0, long: 1 }, star: 2,
        });
        expect(html).toContain('Short (up to 30 min): 4 a day');
        expect(html).toContain('Right now (Clock tower ★2)');
        expect(html).toContain('Short 1 of 4 left today');
        expect(html).toContain('Long 0 of 2 left this week');
        expect(html).toContain('2 Short · 1 Long');
    });

    test('no tokens held says none; left never exceeds the allowance', () => {
        const html = PushbackHelp.hintHtml({ allowance: TABLE[1], left: { short: 9, medium: 0, long: 0 }, held: {} });
        expect(html).toContain('Short 3 of 3 left today');
        expect(html).toContain('Tokens held:</strong> none');
    });
});

describe('PushbackHelp.dotsHtml', () => {
    test('filled = left, hollow = used', () => {
        const html = PushbackHelp.dotsHtml(2, 3);
        expect((html.match(/pb-dot--on/g) || []).length).toBe(2);
        expect((html.match(/class="pb-dot[ "]/g) || []).length).toBe(3);
        expect(html).toContain('2 of 3 free pushbacks left');
    });
    test('zero left is all hollow; zero total is empty; left clamps to total', () => {
        expect(PushbackHelp.dotsHtml(0, 2)).not.toContain('pb-dot--on');
        expect(PushbackHelp.dotsHtml(1, 0)).toBe('');
        expect((PushbackHelp.dotsHtml(9, 2).match(/pb-dot--on/g) || []).length).toBe(2);
    });
});

describe('star gains and the Clock tower reward', () => {
    test('each star names what it adds', () => {
        expect(PushbackHelp.starUpText(2, TABLE)).toBe('Clock tower ★2: +1 Short pushback a day');
        expect(PushbackHelp.starUpText(3, TABLE)).toBe('Clock tower ★3: +1 Medium pushback a day');
        expect(PushbackHelp.starUpText(4, TABLE)).toBe('Clock tower ★4: +1 Long pushback a week');
        expect(PushbackHelp.starUpText(5, TABLE)).toBe('Clock tower ★5: +1 Long pushback a week');
    });
    test('no text for star 1, unknown stars or a missing table', () => {
        expect(PushbackHelp.starUpText(1, TABLE)).toBeNull();
        expect(PushbackHelp.starUpText(9, TABLE)).toBeNull();
        expect(PushbackHelp.starUpText(2, null)).toBeNull();
    });
    test('rewardModel: current allowance + the next star', () => {
        const m = PushbackHelp.rewardModel({ star: 1, table: TABLE });
        expect(m.current).toBe('Short 3 a day · Medium 2 a day · Long 2 a week');
        expect(m.next).toBe('Star 2 adds +1 Short pushback a day');
        expect(m.maxed).toBe(false);
        const top = PushbackHelp.rewardModel({ star: 5, table: TABLE });
        expect(top.next).toBeNull();
        expect(top.maxed).toBe(true);
    });
});

describe('PushbackHelp.wireHint', () => {
    test('the (i) button toggles its panel and aria-expanded, once even if wired twice', () => {
        document.body.innerHTML = `<div id="r">${PushbackHelp.hintBlockHtml('pbTest', {})}</div>`;
        const root = document.getElementById('r');
        PushbackHelp.wireHint(root);
        PushbackHelp.wireHint(root);
        const btn = root.querySelector('.form-hint-btn');
        const pop = document.getElementById('pbTest');
        expect(pop.hidden).toBe(true);
        btn.click();
        expect(pop.hidden).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
        btn.click();
        expect(pop.hidden).toBe(true);
    });
    test('the click does not bubble to the document (Modal outside-click dismiss)', () => {
        document.body.innerHTML = `<div id="r">${PushbackHelp.hintBlockHtml('pbTest2', {})}</div>`;
        PushbackHelp.wireHint(document.getElementById('r'));
        const spy = jest.fn();
        document.addEventListener('click', spy);
        document.querySelector('.form-hint-btn').click();
        document.removeEventListener('click', spy);
        expect(spy).not.toHaveBeenCalled();
    });
});
