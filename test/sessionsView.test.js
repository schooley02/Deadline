/**
 * @jest-environment jsdom
 */
/**
 * Sessions list (Timer sessions Build B, 2026-11-04): markup, the in-place editor, the live charge / error line, add, delete
 * (two taps), and the card / Edit Task integration.
 */
global.Modal = require('../js/ui/modal.js');
global.Forms = require('../js/ui/forms.js');
global.Timer = require('../js/timer.js');
global.TimerSessions = require('../js/timerSessions.js');
global.Habits = require('../js/habits.js');
global.Clock = require('../js/clock.js');
global.SpriteAnim = { setEnemyCategory: () => {} };
global.SessionsView = require('../js/ui/sessionsView.js');
const SessionsView = global.SessionsView;
const Popups = require('../js/ui/popups.js');

const MIN = 60000;
const at = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime();
const NOW = at(5, 18, 0);
beforeAll(() => { jest.useFakeTimers({ now: NOW }); });
afterAll(() => jest.useRealTimers());

const item = (sessions, untimed, o) => {
    const sum = sessions.reduce((a, s) => a + (s.end - s.start), 0);
    return Object.assign({
        id: 3, type: 'task', name: 'Write report', category: 'career', isHighPriority: false, dueDateTime: new Date(2026, 10, 6, 20, 0),
        timer: null, subTasks: [], timerSessions: sessions, timerUntimedMs: untimed || 0, timerMsBanked: sum + (untimed || 0),
    }, o);
};
const two = () => item([
    { start: at(5, 9), end: at(5, 10, 5), attack: [] },
    { start: at(5, 14), end: at(5, 15), attack: [[at(5, 14), at(5, 15)]] },
], 30 * MIN);

function mount(it, deps, over) {
    document.body.innerHTML = SessionsView.html(it, { idPrefix: 's' });
    const calls = [];
    const d = Object.assign({
        changeSession: jest.fn((id, change) => { calls.push(change); return { ok: true, chargedHp: 0 }; }),
        getBaseHealth: () => 50,
    }, deps || {});
    const onChange = jest.fn();
    const ctl = SessionsView.wire(Object.assign({ idPrefix: 's', getItem: () => it, deps: d, onChange }, over || {}));
    return { ctl, d, onChange, calls };
}
const click = (sel) => document.querySelector(sel).click();
const setVal = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

describe('markup', () => {
    test('rows newest first, each with day, start - stop, duration and Edit; the untimed entry last', () => {
        const html = SessionsView.html(two(), { idPrefix: 's' });
        const rows = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('.sessions-row')];
        expect(rows).toHaveLength(3);
        expect(rows[0].textContent).toContain('Thu Nov 5, 2:00 PM – 3:00 PM');
        expect(rows[0].textContent).toContain('1 hr');
        expect(rows[1].textContent).toContain('9:00 AM – 10:05 AM');
        expect(rows[1].textContent).toContain('1 hr 5 min');
        expect(rows[2].textContent).toContain('No start/stop recorded');
        expect(rows[2].textContent).toContain('30 min');
        expect(rows[2].querySelector('[data-act="edit"]')).toBeNull();
        expect(html).toContain('+ Add session');
        expect(html).toContain('data-index="0"');
    });
    test('a session across midnight shows the stop day', () => {
        const it = item([{ start: at(4, 23, 30), end: at(5, 0, 40), attack: [] }]);
        expect(SessionsView.html(it, { idPrefix: 's' })).toContain('Wed Nov 4, 11:30 PM – Thu Nov 5, 12:40 AM');
    });
    test('an old item shows only its untimed entry; a fresh one says there are none', () => {
        const old = { id: 1, type: 'task', timer: null, timerMsBanked: 45 * MIN };
        expect(SessionsView.html(old, { idPrefix: 's' })).toContain('No start/stop recorded');
        expect(old.timerSessions).toBeUndefined(); // reading never rewrites
        expect(SessionsView.html({ id: 2, type: 'task', timer: null, timerMsBanked: 0 }, { idPrefix: 's' })).toContain('No timer sessions yet.');
    });
    test('while the timer runs: a read-only "Running since" row, no Edit, no Add', () => {
        const it = two();
        it.timer = { startedAt: at(5, 17, 30), checkedAt: at(5, 17, 30), promptedAt: null };
        const html = SessionsView.html(it, { idPrefix: 's' });
        expect(html).toContain('Running since 5:30 PM');
        expect(html).not.toContain('data-act="edit"');
        expect(html).not.toContain('data-act="add"');
    });
    test('follows the wording rule', () => {
        const html = SessionsView.html(two(), { idPrefix: 's' });
        expect(html).not.toMatch(/logged time/i);
    });
});

describe('editing a session', () => {
    test('Edit opens the row in place with its values filled in', () => {
        mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        expect(document.getElementById('sSesDate').value).toBe('2026-11-05');
        expect(document.getElementById('sSesStart').value).toBe('14:00');
        expect(document.getElementById('sSesStop').value).toBe('15:00');
        expect(document.getElementById('sSesNext').checked).toBe(false);
        expect(document.querySelector('.sessions-editor [data-act="delete"]')).not.toBeNull();
    });
    test('Save sends an edit change in local time and closes the editor with a message', () => {
        const { d, onChange } = mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '14:40');
        click('[data-act="save"]');
        expect(d.changeSession).toHaveBeenCalledWith(3, { type: 'edit', index: 1, start: at(5, 14), end: at(5, 14, 40) });
        expect(document.querySelector('.sessions-editor')).toBeNull();
        expect(document.getElementById('sSesMsg').textContent).toBe('Session saved.');
        expect(onChange).toHaveBeenCalled();
    });
    test('the live line says what saving takes back, capped by the church HP (1 HP floor)', () => {
        const it = two();
        mount(it, { getBaseHealth: () => 50 });
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '14:30'); // 30 attack minutes removed -> 3 HP
        expect(document.getElementById('sSesCharge').textContent).toBe('Saving takes back 3 HP of halved damage.');
        document.body.innerHTML = '';
        mount(it, { getBaseHealth: () => 2 });
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '14:30');
        expect(document.getElementById('sSesCharge').textContent).toBe('Saving takes back 1 HP of halved damage.');
        document.body.innerHTML = '';
        mount(it, { getBaseHealth: () => 1 });
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '14:30');
        expect(document.getElementById('sSesCharge').textContent).toContain('last HP');
    });
    test('no charge line when nothing is taken back (lengthening)', () => {
        mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '16:00');
        expect(document.getElementById('sSesCharge').textContent).toBe('');
        expect(document.querySelector('[data-act="save"]').disabled).toBe(false);
    });
    test('a bad span shows its reason and disables Save', () => {
        mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '13:00');
        expect(document.getElementById('sSesError').textContent).toBe('Stop must be after start.');
        expect(document.querySelector('[data-act="save"]').disabled).toBe(true);
        setVal('sSesStop', '09:30'); // overlaps the 9:00 session when moved earlier
        setVal('sSesStart', '09:15');
        expect(document.getElementById('sSesError').textContent).toBe('That overlaps another session.');
        setVal('sSesStart', '17:00'); setVal('sSesStop', '19:00');
        expect(document.getElementById('sSesError').textContent).toBe('A session can’t end in the future.');
    });
    test('"Stop is the next day" carries a session across midnight', () => {
        const { d } = mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesDate', '2026-11-04');
        setVal('sSesStart', '23:00');
        setVal('sSesStop', '00:30');
        expect(document.getElementById('sSesError').textContent).toBe('Stop must be after start.');
        document.getElementById('sSesNext').checked = true;
        document.getElementById('sSesNext').dispatchEvent(new Event('change', { bubbles: true }));
        click('[data-act="save"]');
        expect(d.changeSession).toHaveBeenCalledWith(3, { type: 'edit', index: 1, start: at(4, 23), end: at(5, 0, 30) });
    });
    test('an existing across-midnight session opens with the box ticked', () => {
        mount(item([{ start: at(4, 23, 30), end: at(5, 0, 40), attack: [] }]), null);
        click('[data-act="edit"][data-index="0"]');
        expect(document.getElementById('sSesNext').checked).toBe(true);
    });
    test('a refusal from the game shows under the fields and keeps the editor open', () => {
        const { d } = mount(two(), { changeSession: jest.fn(() => ({ ok: false, reason: 'overlap' })) });
        click('[data-act="edit"][data-index="1"]');
        click('[data-act="save"]');
        expect(document.getElementById('sSesError').textContent).toBe('That overlaps another session.');
        expect(document.querySelector('.sessions-editor')).not.toBeNull();
    });
    test('Cancel closes without calling the game', () => {
        const { d } = mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        click('[data-act="cancel"]');
        expect(document.querySelector('.sessions-editor')).toBeNull();
        expect(d.changeSession).not.toHaveBeenCalled();
    });
    test('a charge that was taken is reported after saving', () => {
        mount(two(), { changeSession: jest.fn(() => ({ ok: true, chargedHp: 2 })) });
        click('[data-act="edit"][data-index="1"]');
        setVal('sSesStop', '14:40');
        click('[data-act="save"]');
        expect(document.getElementById('sSesMsg').textContent).toBe('Session saved. Took back 2 HP of halved damage.');
    });
});

describe('add and delete', () => {
    test('+ Add session opens an empty editor defaulting to today; Save sends an add', () => {
        const { d } = mount(two(), null);
        click('[data-act="add"]');
        expect(document.getElementById('sSesDate').value).toBe('2026-11-05');
        expect(document.querySelector('.sessions-editor [data-act="delete"]')).toBeNull();
        expect(document.querySelector('[data-act="save"]').disabled).toBe(true); // times still blank
        setVal('sSesStart', '11:00'); setVal('sSesStop', '11:45');
        click('[data-act="save"]');
        expect(d.changeSession).toHaveBeenCalledWith(3, { type: 'add', start: at(5, 11), end: at(5, 11, 45) });
        expect(document.getElementById('sSesMsg').textContent).toBe('Session added.');
    });
    test('Delete needs a second tap and says what it costs first', () => {
        const { d } = mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        click('[data-act="delete"]');
        expect(d.changeSession).not.toHaveBeenCalled();
        expect(document.querySelector('[data-act="delete"]').textContent).toBe('Tap again to delete');
        expect(document.getElementById('sSesCharge').textContent).toBe('Deleting takes back 6 HP of halved damage.');
        click('[data-act="delete"]');
        expect(d.changeSession).toHaveBeenCalledWith(3, { type: 'delete', index: 1 });
        expect(document.getElementById('sSesMsg').textContent).toBe('Session deleted.');
    });
    test('editing a field after the first Delete tap resets it', () => {
        const { d } = mount(two(), null);
        click('[data-act="edit"][data-index="1"]');
        click('[data-act="delete"]');
        setVal('sSesStop', '14:50');
        expect(document.querySelector('[data-act="delete"]').textContent).toBe('Delete');
        click('[data-act="delete"]');
        expect(d.changeSession).not.toHaveBeenCalled();
    });
    test('a delete that costs nothing says so plainly', () => {
        mount(item([{ start: at(5, 14), end: at(5, 15), attack: [] }]), null);
        click('[data-act="edit"][data-index="0"]');
        click('[data-act="delete"]');
        expect(document.getElementById('sSesCharge').textContent).toBe('This removes the session and its time.');
    });
});

describe('clicks never reach the document (Modal outside-click dismiss)', () => {
    test('Edit, Add and Cancel stop at the list', () => {
        mount(two(), null);
        const seen = jest.fn();
        document.addEventListener('click', seen);
        click('[data-act="edit"][data-index="1"]');
        click('[data-act="cancel"]');
        click('[data-act="add"]');
        click('[data-act="cancel"]');
        document.removeEventListener('click', seen);
        expect(seen).not.toHaveBeenCalled();
    });
});

describe('item card integration', () => {
    const baseDeps = (over) => Object.assign({
        activeItems: [], completeItem: jest.fn(), indulgeHabit: jest.fn(), toggleWorkTimer: jest.fn(() => ({ ok: true, running: false })),
        setLoggedTime: jest.fn(() => ({ ok: true, deltaMin: 5, completed: false })),
        changeSession: jest.fn(() => ({ ok: true, chargedHp: 0 })), getBaseHealth: () => 50,
        recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(),
        pushbackOptionsFor: () => [],
    }, over);
    beforeEach(() => { document.body.innerHTML = ''; });

    test('the card shows the Sessions list under Time Logged', () => {
        Popups.showTaskDetailsPopup(two(), baseDeps());
        expect(document.getElementById('popupSesSessions')).not.toBeNull();
        expect(document.querySelectorAll('#popupSesSessions .sessions-row')).toHaveLength(3);
    });
    test('without deps.changeSession the card is exactly as before (no list)', () => {
        Popups.showTaskDetailsPopup(two(), baseDeps({ changeSession: undefined }));
        expect(document.getElementById('popupSesSessions')).toBeNull();
        expect(document.getElementById('popupLoggedHours')).not.toBeNull();
    });
    test('a session change refreshes the hours / minutes boxes and their baseline', () => {
        const it = two(); // 65 min + 60 min + 30 min untimed = 2 hr 35 min
        const deps = baseDeps({
            changeSession: jest.fn(() => { it.timerSessions[1].end = at(5, 14, 30); it.timerMsBanked -= 30 * MIN; return { ok: true, chargedHp: 0 }; }),
        });
        Popups.showTaskDetailsPopup(it, deps);
        expect(document.getElementById('popupLoggedHours').value).toBe('2');
        expect(document.getElementById('popupLoggedMinutes').value).toBe('35');
        document.querySelector('#popupSesSessions [data-act="edit"][data-index="1"]').click();
        const stop = document.getElementById('popupSesSesStop');
        stop.value = '14:30'; stop.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#popupSesSessions [data-act="save"]').click();
        expect(document.getElementById('popupLoggedHours').value).toBe('2');
        expect(document.getElementById('popupLoggedMinutes').value).toBe('5');
        expect(document.getElementById('popupLoggedGroup').getAttribute('data-initial-min')).toBe('125');
    });
    test('a typed total below the sessions says how to fix it', () => {
        const it = two(); // 2 h 5 min + 30 min untimed
        const deps = baseDeps({ setLoggedTime: jest.fn(() => ({ ok: false, reason: 'below-timed' })) });
        Popups.showTaskDetailsPopup(it, deps);
        document.getElementById('popupLoggedHours').value = '0';
        document.getElementById('popupLoggedMinutes').value = '20';
        document.getElementById('popupLoggedSave').click();
        expect(document.getElementById('popupLoggedMsg').textContent).toBe('To remove timed time, edit its session below.');
    });
    test('a successful total save redraws the list', () => {
        const it = two();
        const deps = baseDeps({ setLoggedTime: jest.fn(() => { it.timerUntimedMs = 90 * MIN; it.timerMsBanked += 60 * MIN; return { ok: true, deltaMin: 60, completed: false }; }) });
        Popups.showTaskDetailsPopup(it, deps);
        document.getElementById('popupLoggedHours').value = '4';
        document.getElementById('popupLoggedMinutes').value = '35';
        document.getElementById('popupLoggedSave').click();
        expect(document.querySelector('.sessions-untimed').textContent).toContain('1 hr 30 min');
    });
});

describe('Edit Task integration', () => {
    const d = (over) => Object.assign({
        activeItems: [], setLoggedTime: jest.fn(() => ({ ok: true, deltaMin: 5, completed: false })),
        changeSession: jest.fn(() => ({ ok: true, chargedHp: 0 })), getBaseHealth: () => 50,
        recomputeOverdueStateAfterEdit: jest.fn(), sortAndRenderActiveList: jest.fn(), createListItem: jest.fn(), saveGame: jest.fn(),
        pushbackOptionsFor: () => [], reschedulePricingFor: () => null,
    }, over);
    beforeEach(() => { document.body.innerHTML = ''; });

    test('the form shows the Sessions list under the Time Logged boxes', () => {
        Popups.showEditTaskModal(two(), d());
        expect(document.getElementById('editSesSessions')).not.toBeNull();
        expect(document.querySelectorAll('#editSesSessions .sessions-row')).toHaveLength(3);
    });
    test('saving a total below the timed sessions is blocked with the way out', () => {
        const dd = d();
        const it = two(); // 2 hr 5 min timed
        Popups.showEditTaskModal(it, dd);
        document.getElementById('editLoggedHours').value = '0';
        document.getElementById('editLoggedMinutes').value = '40';
        document.getElementById('saveTaskChanges').click();
        expect(dd.setLoggedTime).not.toHaveBeenCalled();
        expect(document.querySelector('.form-error').textContent).toBe('To remove timed time, edit its session below.');
    });
    test('a total at or above the timed sessions saves as before', () => {
        const dd = d();
        Popups.showEditTaskModal(two(), dd);
        document.getElementById('editLoggedHours').value = '3';
        document.getElementById('editLoggedMinutes').value = '0';
        document.getElementById('saveTaskChanges').click();
        expect(dd.setLoggedTime).toHaveBeenCalledWith(3, 180 * MIN);
    });
    test('an old item (no session fields) is never blocked', () => {
        const dd = d();
        const old = { id: 3, type: 'task', name: 'Old', category: 'career', isHighPriority: false, dueDateTime: new Date(2026, 10, 6, 20, 0), timer: null, subTasks: [], timerMsBanked: 50 * MIN };
        Popups.showEditTaskModal(old, dd);
        document.getElementById('editLoggedMinutes').value = '5';
        document.getElementById('saveTaskChanges').click();
        expect(dd.setLoggedTime).toHaveBeenCalledWith(3, 5 * MIN);
    });
});
