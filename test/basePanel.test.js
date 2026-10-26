/**
 * @jest-environment jsdom
 *
 * BasePanel tests (docs/BASE_PANEL_PLAN.md step 2, 2026-10-26): the pure view model,
 * the markup, and the DOM behavior of open() -- dedupe, live patching, disabled
 * pushbacks, info popover + ESC, cleanup when the overlay is removed.
 */
const CONFIG = require('../js/config.js');
global.BaseModel = require('../js/baseModel.js');
global.Modal = require('../js/ui/modal.js');
const BasePanel = require('../js/ui/basePanel.js');

const MIN = 60 * 1000;
const NOW = 1_000_000_000_000;
const att = (id, overdueMin, extra) => Object.assign({
    id, name: 'Task ' + id, dueMs: NOW - overdueMin * MIN, tickMs: CONFIG.DAMAGE_INTERVAL_MS,
    lastDamageTickMs: NOW - 1 * MIN,
}, extra);
const ctxFor = (health, attackers, extra) => Object.assign({
    health, nowMs: NOW, lastRegenTickMs: NOW - 1 * MIN, attackers: attackers || [],
    inventory: { repair_small: 2, repair_medium: 1, repair_large: 0 },
    shopItems: CONFIG.SHOP_ITEMS, config: CONFIG, points: 200, pushbackPrice: 50, pushbackLabel: '1 hr',
}, extra);

describe('buildViewModel', () => {
    test('healing: timer counts to the next church look, strip shows +1 HP and full', () => {
        const vm = BasePanel.buildViewModel(ctxFor(40));
        expect(vm.state).toBe('healing');
        expect(vm.stateLabel).toBe('Healing');
        expect(vm.timer.label).toBe('Church looks better in');
        expect(vm.timer.sub).toBe('at 51 HP · 11 heals to go');
        expect(vm.strip).not.toBeNull();
        expect(vm.binds.nextHeal).toBe('4:00');
        expect(vm.attackers).toBeNull();
        expect(vm.warning).toBeNull();
    });
    test('healing in the top stage counts to full instead', () => {
        const vm = BasePanel.buildViewModel(ctxFor(90));
        expect(vm.timer.label).toBe('Back to full strength in');
        expect(vm.timer.sub).toBe('10 HP to go');
    });
    test('attacked: worsen timer, next hit, falls warning, loss segment, no strip', () => {
        const vm = BasePanel.buildViewModel(ctxFor(58, [att('a', 10), att('b', 30)]));
        expect(vm.state).toBe('attacked');
        expect(vm.timer.label).toBe('Church looks worse in');
        expect(vm.binds.timerSub).toBe('Next hit in 4:00');
        expect(vm.warning).toEqual({ key: 'falls' });
        expect(vm.binds.falls).not.toBe('');
        expect(vm.strip).toBeNull();
        expect(vm.lossPct).toBeGreaterThan(0);
        expect(vm.attackers.rows[0].id).toBe('b'); // most overdue first
    });
    test('full: all clear, and the next due task when given', () => {
        const vm = BasePanel.buildViewModel(ctxFor(100, [], { nextDue: { name: 'Taxes', dueMs: NOW + 90 * MIN } }));
        expect(vm.state).toBe('full');
        expect(vm.binds.timer).toBe('All clear');
        expect(vm.binds.timerSub).toBe('Next due: Taxes in 1h 30m');
        expect(BasePanel.buildViewModel(ctxFor(100)).binds.timerSub).toBe('Nothing due soon');
    });
    test('shows at most 3 attackers until Show all', () => {
        const five = [1, 2, 3, 4, 5].map(i => att('a' + i, i * 10));
        let vm = BasePanel.buildViewModel(ctxFor(80, five), { showAll: false });
        expect(vm.attackers.rows).toHaveLength(3);
        expect(vm.attackers.more).toBe(2);
        vm = BasePanel.buildViewModel(ctxFor(80, five), { showAll: true });
        expect(vm.attackers.rows).toHaveLength(5);
        expect(vm.attackers.more).toBe(0);
        expect(vm.attackers.expanded).toBe(true);
    });
    test('pushback is disabled with the reason when points are short', () => {
        const row = BasePanel.buildViewModel(ctxFor(80, [att('a', 10)], { points: 20 })).attackers.rows[0];
        expect(row.canBuy).toBe(false);
        expect(row.need).toBe(30);
        expect(row.ariaLabel).toContain('you need 30 more points');
        const ok = BasePanel.buildViewModel(ctxFor(80, [att('a', 10)], { points: 50 })).attackers.rows[0];
        expect(ok.canBuy).toBe(true);
    });
    test('no pushback price -> no buy buttons', () => {
        const vm = BasePanel.buildViewModel(ctxFor(80, [att('a', 10)], { pushbackPrice: null }));
        expect(vm.attackers.rows[0].price).toBeNull();
        expect(BasePanel.innerHtml(vm)).not.toContain('data-action="pushback"');
    });
    test('kits: usable when held, "none held" when not, "not needed" at full, "buys" while attacked', () => {
        const heal = BasePanel.buildViewModel(ctxFor(40)).kits;
        expect(heal.map(k => k.short)).toEqual(['Small', 'Medium', 'Large']);
        expect(heal[0]).toMatchObject({ usable: true, held: 2 });
        expect(heal[0].note).toMatch(/^\+15 HP · saves /);
        expect(heal[2]).toMatchObject({ usable: false, note: 'none held' });
        const attacked = BasePanel.buildViewModel(ctxFor(40, [att('a', 10)])).kits;
        expect(attacked[0].note).toMatch(/ · buys /);
        const full = BasePanel.buildViewModel(ctxFor(100)).kits;
        expect(full.every(k => !k.usable && k.note === 'not needed')).toBe(true);
    });
    test('kit notes: wasted HP and landing 1 HP short of a church look', () => {
        const notes = BasePanel.buildViewModel(ctxFor(60)).kitNotes; // small lands at exactly 75
        expect(notes.join(' ')).toContain('Small kit lands at 75 HP, 1 HP short');
        const waste = BasePanel.buildViewModel(ctxFor(90)).kitNotes;
        expect(waste.join(' ')).toContain('Large kit heals 75 but only 10 would fit, so 65 HP would be wasted');
    });
    test('HP colors follow the palette keys', () => {
        expect(BasePanel.buildViewModel(ctxFor(90)).color).toBe('full');
        expect(BasePanel.buildViewModel(ctxFor(60)).color).toBe('moderate');
        expect(BasePanel.buildViewModel(ctxFor(40)).color).toBe('low');
        expect(BasePanel.buildViewModel(ctxFor(10)).color).toBe('critical');
    });
});

describe('chipModel (HUD chip)', () => {
    test('healing: "+1 in Nm" rounds the next heal up to whole minutes', () => {
        expect(BasePanel.chipModel(ctxFor(40)).text).toBe('+1 in 4m'); // next heal in 4:00
        expect(BasePanel.chipModel(ctxFor(40, [], { lastRegenTickMs: NOW - 4 * MIN - 30 * 1000 })).text).toBe('+1 in 1m');
    });
    test('attacked: HP lost per 5 minutes across attackers, with the unicode minus', () => {
        expect(BasePanel.chipModel(ctxFor(80, [att('a', 10)])).text).toBe('\u22121 / 5m');
        expect(BasePanel.chipModel(ctxFor(80, [att('a', 10), att('b', 20), att('c', 30)])).text).toBe('\u22123 / 5m');
    });
    test('a work timer slows its zombie, so the rate can be fractional', () => {
        const slow = att('a', 10, { tickMs: CONFIG.DAMAGE_INTERVAL_MS * 2 });
        expect(BasePanel.chipModel(ctxFor(80, [slow])).text).toBe('\u22120.5 / 5m');
    });
    test('full and fallen', () => {
        expect(BasePanel.chipModel(ctxFor(100)).text).toBe('Full');
        expect(BasePanel.chipModel(ctxFor(100)).aria).toBe('Base health 100 of 100, full strength. Open base health panel');
        expect(BasePanel.chipModel(ctxFor(0, [att('a', 10)])).text).toBe('Fallen');
    });
    test('carries state, color, ring fraction and an aria label', () => {
        const chip = BasePanel.chipModel(ctxFor(58, [att('a', 10)]));
        expect(chip).toMatchObject({ state: 'attacked', color: 'moderate' });
        expect(chip.pct).toBeCloseTo(58);
        expect(chip.aria).toBe('Base health 58 of 100, under attack. \u22121 / 5m. Open base health panel');
    });
});

describe('markup', () => {
    test('structureSignature ignores ticking text but not structure', () => {
        const a = BasePanel.innerHtml(BasePanel.buildViewModel(ctxFor(40)));
        const b = BasePanel.innerHtml(BasePanel.buildViewModel(ctxFor(40, [], { nowMs: NOW + 60 * 1000, lastRegenTickMs: NOW - 1 * MIN })));
        expect(a).not.toBe(b);
        expect(BasePanel.structureSignature(a)).toBe(BasePanel.structureSignature(b));
        const c = BasePanel.innerHtml(BasePanel.buildViewModel(ctxFor(41)));
        expect(BasePanel.structureSignature(a)).not.toBe(BasePanel.structureSignature(c));
    });
    test('threshold ticks at 25/50/75 and the chip carries an accessible label', () => {
        const html = BasePanel.innerHtml(BasePanel.buildViewModel(ctxFor(40)));
        expect((html.match(/class="bp-tick"/g) || [])).toHaveLength(3);
        expect(html).toContain('left:25%');
        expect(html).toContain('left:75%');
        expect(html).toContain('role="img" aria-label="40 of 100 health"');
    });
    test('attacker names are escaped', () => {
        const html = BasePanel.innerHtml(BasePanel.buildViewModel(ctxFor(80, [att('a', 10, { name: '<b>x</b>' })])));
        expect(html).not.toContain('<b>x</b>');
        expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    });
});

describe('open()', () => {
    let current;
    const deps = (extra) => Object.assign({
        getContext: () => current,
        onPushback: jest.fn(), onUseKit: jest.fn(),
    }, extra);
    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = '';
        current = ctxFor(58, [att('a', 10), att('b', 30)]);
    });
    afterEach(() => { jest.useRealTimers(); });

    test('opens once (dedupe) and renders the three-state content', () => {
        BasePanel.open(deps());
        BasePanel.open(deps());
        expect(document.querySelectorAll('.base-panel-overlay')).toHaveLength(1);
        expect(document.querySelector('.base-panel').textContent).toContain('Under attack');
    });
    test('pushback and kit buttons call their handlers; the panel stays open', () => {
        const d = deps();
        BasePanel.open(d);
        document.querySelector('[data-action="pushback"][data-attacker-id="b"]').click();
        expect(d.onPushback).toHaveBeenCalledWith('b');
        document.querySelector('[data-action="kit"][data-kit-id="repair_small"]').click();
        expect(d.onUseKit).toHaveBeenCalledWith('repair_small');
        expect(document.querySelector('.base-panel-overlay')).not.toBeNull();
    });
    test('a disabled pushback does nothing and says why', () => {
        current = ctxFor(58, [att('a', 10)], { points: 10 });
        const d = deps();
        BasePanel.open(d);
        const btn = document.querySelector('[data-action="pushback"]');
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toContain('Need 40 more pts');
        btn.click();
        expect(d.onPushback).not.toHaveBeenCalled();
    });
    test('the tick patches countdown text in place without rebuilding buttons', () => {
        BasePanel.open(deps());
        const btn = document.querySelector('[data-action="kit"]');
        const before = document.querySelector('[data-bind="timerSub"]').textContent;
        current = Object.assign({}, current, { nowMs: NOW + 30 * 1000 });
        jest.advanceTimersByTime(1000);
        expect(document.querySelector('[data-action="kit"]')).toBe(btn); // same node
        expect(document.querySelector('[data-bind="timerSub"]').textContent).not.toBe(before);
    });
    test('the tick rebuilds when the structure changes (an attacker is pushed back)', () => {
        BasePanel.open(deps());
        expect(document.querySelectorAll('.bp-attacker')).toHaveLength(2);
        current = ctxFor(58, [att('a', 10)]);
        jest.advanceTimersByTime(1000);
        expect(document.querySelectorAll('.bp-attacker')).toHaveLength(1);
    });
    test('the panel switches state live (attacked -> healing)', () => {
        BasePanel.open(deps());
        current = ctxFor(58, []);
        jest.advanceTimersByTime(1000);
        expect(document.querySelector('.bp-status').textContent).toContain('Healing');
        expect(document.querySelector('.bp-attackers')).toBeNull();
    });
    test('info popover toggles; ESC closes the popover first and leaves the panel open', () => {
        BasePanel.open(deps());
        document.querySelector('[data-info="attackers"]').click();
        expect(document.querySelector('.bp-popover')).not.toBeNull();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.querySelector('.bp-popover')).toBeNull();
        expect(document.querySelector('.base-panel-overlay')).not.toBeNull();
    });
    test('an outside click closes the popover', () => {
        BasePanel.open(deps());
        document.querySelector('[data-info="kits"]').click();
        expect(document.querySelector('.bp-popover')).not.toBeNull();
        document.querySelector('.bp-timer').click();
        expect(document.querySelector('.bp-popover')).toBeNull();
    });
    test('Show all expands the attacker list', () => {
        current = ctxFor(80, [1, 2, 3, 4, 5].map(i => att('a' + i, i * 10)));
        BasePanel.open(deps());
        expect(document.querySelectorAll('.bp-attacker')).toHaveLength(3);
        document.querySelector('[data-action="showall"]').click();
        expect(document.querySelectorAll('.bp-attacker')).toHaveLength(5);
    });
    test('Close removes the overlay and stops the refresh; removing it from outside also stops it', () => {
        const d = deps();
        BasePanel.open(d);
        document.querySelector('[data-action="close"]').click();
        expect(document.querySelector('.base-panel-overlay')).toBeNull();
        d.getContext.mockClear && d.getContext.mockClear();
        let calls = 0;
        const d2 = deps({ getContext: () => { calls++; return current; } });
        BasePanel.open(d2);
        document.querySelector('.base-panel-overlay').remove();
        jest.advanceTimersByTime(1000); // one tick notices it is gone and stops
        const after = calls;
        jest.advanceTimersByTime(5000);
        expect(calls).toBe(after);
    });
});
