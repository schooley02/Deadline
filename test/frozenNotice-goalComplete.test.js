/**
 * @jest-environment jsdom
 */
/** Goal complete notice (Goals Build B1, 2026-11-05): one modal for every goal just finished; waits behind an open modal; words from Theme. */
global.Theme = require('../js/theme.js');
global.Modal = { open: jest.fn((html) => { document.body.insertAdjacentHTML('beforeend', html); }) };
const FrozenNotice = require('../js/ui/frozenNotice.js');

beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = ''; Modal.open.mockClear(); });
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

test('names the finished goal with the theme words', () => {
    FrozenNotice.showGoalCompleteNotice([{ name: 'Read a book' }]);
    jest.advanceTimersByTime(10);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    const html = document.body.innerHTML;
    expect(html).toContain(Theme.strings.goals.completeLine);
    expect(html).toContain('Read a book is now one of your survivors.');
});

test('several goals at once are ONE window', () => {
    FrozenNotice.showGoalCompleteNotice([{ name: 'A' }, { name: 'B' }]);
    FrozenNotice.showGoalCompleteNotice([{ name: 'C' }]);
    jest.advanceTimersByTime(10);
    expect(Modal.open).toHaveBeenCalledTimes(1);
    expect(document.body.querySelectorAll('li')).toHaveLength(3);
});

test('waits for an open modal to close', () => {
    document.body.innerHTML = '<div class="modal-overlay"></div>';
    FrozenNotice.showGoalCompleteNotice([{ name: 'A' }]);
    jest.advanceTimersByTime(1000);
    expect(Modal.open).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    jest.advanceTimersByTime(1000);
    expect(Modal.open).toHaveBeenCalledTimes(1);
});

test('names are escaped and empty input says nothing', () => {
    FrozenNotice.showGoalCompleteNotice([{ name: '<i>x</i>' }]);
    jest.advanceTimersByTime(10);
    expect(document.body.innerHTML).not.toContain('<i>x</i>');
    Modal.open.mockClear();
    FrozenNotice.showGoalCompleteNotice([]);
    FrozenNotice.showGoalCompleteNotice(null);
    FrozenNotice.showGoalCompleteNotice([{ name: '' }, null]);
    jest.advanceTimersByTime(1000);
    expect(Modal.open).not.toHaveBeenCalled();
});
