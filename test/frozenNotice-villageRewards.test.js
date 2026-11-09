/**
 * @jest-environment jsdom
 */
/** Village rewards notice (village tier drops, 2026-11-03): one modal listing every item just paid; queues behind an open modal; batches. */
global.Modal = { open: jest.fn((html) => { document.body.insertAdjacentHTML('beforeend', html); }) };
const FrozenNotice = require('../js/ui/frozenNotice.js');

beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = ''; Modal.open.mockClear(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

const row = (building, star, label) => ({ building, star, label });

test('shows the building, its star count and the item', () => {
    FrozenNotice.showVillageRewardNotice([row('Radio tower', 3, 'Repair Kit (Small) ×1')]);
    jest.advanceTimersByTime(10);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    const html = document.body.innerHTML;
    expect(html).toContain('Village rewards');
    expect(html).toContain('Radio tower ★★★: Repair Kit (Small) ×1');
});

test('a single reward and several rewards read differently but are ONE window either way', () => {
    FrozenNotice.showVillageRewardNotice([row('Command Post', 2, 'Medium Pushback (2 hr) ×1')]);
    jest.advanceTimersByTime(10);
    expect(document.body.innerHTML).toContain('A village building earned a new star.');
    document.body.innerHTML = '';
    Modal.open.mockClear();
    FrozenNotice.showVillageRewardNotice([row('Command Post', 2, 'A ×1'), row('Clock tower', 4, 'B ×1'), row('Hospital', 2, 'C ×1')]);
    jest.advanceTimersByTime(10);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    expect(document.body.innerHTML).toContain('Your village earned new stars.');
    expect(document.body.querySelectorAll('li')).toHaveLength(3);
});

test('nothing to say = no notice', () => {
    FrozenNotice.showVillageRewardNotice([]);
    FrozenNotice.showVillageRewardNotice(null);
    FrozenNotice.showVillageRewardNotice([{ building: 'Command Post', star: 2 }, null, { building: 'x', label: '' }]);
    jest.advanceTimersByTime(1000);
    expect(Modal.open).not.toHaveBeenCalled();
});

test('waits behind an open modal instead of being dropped, then batches rewards that arrived meanwhile', () => {
    document.body.innerHTML = '<div class="modal-overlay" id="other"></div>';
    FrozenNotice.showVillageRewardNotice([row('Command Post', 2, 'First ×1')]);
    FrozenNotice.showVillageRewardNotice([row('Hospital', 3, 'Second ×1')]);
    jest.advanceTimersByTime(900);
    expect(Modal.open).not.toHaveBeenCalled();
    document.getElementById('other').remove();
    jest.advanceTimersByTime(500);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    const html = document.body.innerHTML;
    expect(html).toContain('First');
    expect(html).toContain('Second');
});

test('a second payout after the notice closed gets its own notice (nothing is stuck)', () => {
    FrozenNotice.showVillageRewardNotice([row('Command Post', 2, 'One ×1')]);
    jest.advanceTimersByTime(10);
    document.body.innerHTML = '';
    FrozenNotice.showVillageRewardNotice([row('Command Post', 3, 'Two ×1')]);
    jest.advanceTimersByTime(10);
    expect(Modal.open).toHaveBeenCalledTimes(2);
    expect(document.body.innerHTML).toContain('Two');
    expect(document.body.innerHTML).not.toContain('One');
});

test('text is escaped and the star count is clamped to 1..5', () => {
    FrozenNotice.showVillageRewardNotice([row('<i>Tower</i>', 99, '<b>x</b>'), row('Z', 0, 'y')]);
    jest.advanceTimersByTime(10);
    const html = document.body.innerHTML;
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('★★★★★: ');
    expect(html).toContain('Z ★: y');
});
