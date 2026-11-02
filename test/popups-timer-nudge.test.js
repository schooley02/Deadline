/**
 * @jest-environment jsdom
 */
/**
 * The words behind the red timer pulse, in the item popup (2026-11-02, Jeremy).
 */
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
const Popups = require('../js/ui/popups.js');

const task = (o) => Object.assign({
    id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false, isOverdue: true,
    dueDateTime: new Date(2026, 10, 1, 20, 0), timer: null, timerMsBanked: 0, subTasks: [],
}, o);

function deps(over) {
    return Object.assign({
        activeItems: [], completeItem: jest.fn(), toggleWorkTimer: jest.fn(() => ({ ok: true, running: true })),
        setLoggedTime: jest.fn(), recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(),
        createListItem: jest.fn(), saveGame: jest.fn(), pushbackOptionsFor: () => [],
    }, over);
}
beforeEach(() => { document.body.innerHTML = ''; });

describe('popup timer nudge note', () => {
    test('overdue item, no timer running: says to start the timer to halve the damage', () => {
        Popups.showTaskDetailsPopup(task(), deps());
        const note = document.getElementById('timerNudgeNote');
        expect(note.hidden).toBe(false);
        expect(note.className).toContain('timer-nudge-attack');
        expect(note.textContent).toMatch(/cut the damage in half/);
    });

    test('another item is running: names it (escaped) and says its time is kept', () => {
        const other = task({ id: 8, name: 'Roof <i>repair</i>', isOverdue: false });
        Timer.start(other, Date.now());
        const mine = task();
        Popups.showTaskDetailsPopup(mine, deps({ activeItems: [mine, other] }));
        const note = document.getElementById('timerNudgeNote');
        expect(note.className).toContain('timer-nudge-switch');
        expect(note.textContent).toContain('Roof <i>repair</i>');
        expect(note.querySelector('i')).toBeNull();
        expect(note.textContent).toContain('is kept');
    });

    test('item not overdue: the note exists but is hidden', () => {
        Popups.showTaskDetailsPopup(task({ isOverdue: false }), deps());
        expect(document.getElementById('timerNudgeNote').hidden).toBe(true);
    });

    test('clicking the timer button refreshes the note to the running reassurance', () => {
        const mine = task();
        const d = deps({ toggleWorkTimer: jest.fn((id) => { Timer.start(mine, Date.now()); return { ok: true, running: true }; }) });
        Popups.showTaskDetailsPopup(mine, d);
        document.getElementById('workTimerBtn').click();
        const note = document.getElementById('timerNudgeNote');
        expect(note.hidden).toBe(false);
        expect(note.className).toContain('timer-nudge-running');
        expect(note.textContent).toMatch(/halved/);
    });
});
