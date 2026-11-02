/**
 * @jest-environment jsdom
 */
/** Clock tower star-up notice (pushback charges, Build C): queues behind an open modal, batches, shows each gain. */
global.Modal = { open: jest.fn((html) => { document.body.insertAdjacentHTML('beforeend', html); }) };
const FrozenNotice = require('../js/ui/frozenNotice.js');

beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = ''; Modal.open.mockClear(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

test('shows the star and what it added', () => {
    FrozenNotice.showClockTowerStarUpNotice(2, ['+1 Short pushback a day']);
    jest.advanceTimersByTime(10);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    const html = document.body.innerHTML;
    expect(html).toContain('Clock tower ★★');
    expect(html).toContain('+1 Short pushback a day');
});

test('nothing to say = no notice', () => {
    FrozenNotice.showClockTowerStarUpNotice(2, []);
    FrozenNotice.showClockTowerStarUpNotice(2, null);
    jest.advanceTimersByTime(1000);
    expect(Modal.open).not.toHaveBeenCalled();
});

test('waits behind an open modal instead of being dropped, then batches stars earned together', () => {
    document.body.innerHTML = '<div class="modal-overlay" id="other"></div>';
    FrozenNotice.showClockTowerStarUpNotice(3, ['+1 Short pushback a day']);
    FrozenNotice.showClockTowerStarUpNotice(3, ['+1 Medium pushback a day']);
    jest.advanceTimersByTime(900);
    expect(Modal.open).not.toHaveBeenCalled();
    document.getElementById('other').remove();
    jest.advanceTimersByTime(500);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    const html = document.body.innerHTML;
    expect(html).toContain('Short pushback');
    expect(html).toContain('Medium pushback');
    expect(html).toContain('★★★');
});
