/**
 * @jest-environment jsdom
 */
/*
 * CheckIn.queueArrivalPrompt -- the same-day "time has arrived" popup for negative habits (2026-10-21).
 */
global.CONFIG = require('../js/config.js');
global.Modal = require('../js/ui/modal.js');
const CheckIn = require('../js/ui/checkIn.js');

function deps() {
    const calls = [];
    return { calls, completeItem: id => calls.push(['avoid', id]), indulgeHabit: id => calls.push(['indulge', id]) };
}
beforeEach(() => { document.body.innerHTML = ''; });

test('shows one card with the habit name and avoid / indulge / later', () => {
    CheckIn.queueArrivalPrompt({ id: 7, name: 'Soda <b>' }, deps());
    const o = document.querySelector('.arrival-overlay');
    expect(o).not.toBeNull();
    expect(o.querySelectorAll('.arrival-card').length).toBe(1);
    expect(o.textContent).toContain('Soda <b>');
    expect(o.querySelector('b')).toBeNull(); // escaped
    expect(o.querySelector('.arrival-later-link')).not.toBeNull();
});

test('Avoided calls completeItem, Indulged calls indulgeHabit, popup closes after the last card', () => {
    const d = deps();
    CheckIn.queueArrivalPrompt({ id: 1, name: 'A' }, d);
    CheckIn.queueArrivalPrompt({ id: 2, name: 'B' }, d);
    expect(document.querySelectorAll('.arrival-card').length).toBe(2);
    document.querySelector('[data-item-id="1"] [data-outcome="avoided"]').click();
    expect(document.querySelectorAll('.arrival-card').length).toBe(1);
    document.querySelector('[data-item-id="2"] [data-outcome="indulged"]').click();
    expect(d.calls).toEqual([['avoid', 1], ['indulge', 2]]);
    expect(document.querySelector('.arrival-overlay')).toBeNull();
});

test('the same habit is not queued twice; Later closes without resolving', () => {
    const d = deps();
    CheckIn.queueArrivalPrompt({ id: 1, name: 'A' }, d);
    CheckIn.queueArrivalPrompt({ id: 1, name: 'A' }, d);
    expect(document.querySelectorAll('.arrival-card').length).toBe(1);
    document.querySelector('.arrival-later-link').click();
    expect(document.querySelector('.arrival-overlay')).toBeNull();
    expect(d.calls).toEqual([]);
});
