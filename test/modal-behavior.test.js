/**
 * @jest-environment jsdom
 *
 * Unified modal/window behavior layer tests — [P2-UI-011] Stage 1
 * (session 61, 2026-07-19). Covers js/ui/modal.js's new surface
 * (closeTopmost, initDismissHandlers, initFocusManagement, trapTab) plus
 * ManagementWindows' focus-return-to-FAB.
 *
 * First jsdom test file in the suite — the global testEnvironment stays
 * 'node' (jest.config.js); this file opts in via the docblock above.
 * jest-environment-jsdom was added as a devDependency for this
 * ([P2-UI-011] Stage 1 — Stage 2's Modal.open tests will want it too).
 *
 * initDismissHandlers/initFocusManagement are called ONCE for the whole
 * file (they attach document-level listeners/observer; calling them per
 * test would stack duplicate listeners and, e.g., make one ESC close two
 * overlays). Tests reset the DOM, not the module.
 *
 * MutationObserver in jsdom delivers callbacks on the microtask queue —
 * `flush()` awaits a macrotask to be safe.
 */

const Modal = require('../js/ui/modal.js');
const ManagementWindows = require('../js/ui/managementWindows.js');

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const deps = {
    closeAllManagementWindows: jest.fn(),
    closeFabMenu: jest.fn(),
    isAnyManagementWindowOpen: jest.fn(),
};
Modal.initDismissHandlers(deps);
Modal.initFocusManagement();

function addOverlay(id, inner) {
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="${id}">
            <div class="modal-content">${inner || `<h3>Title ${id}</h3><button id="${id}Btn">Ok</button>`}</div>
        </div>
    `);
    return document.getElementById(id);
}

function pressKey(key, opts) {
    const e = new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, opts));
    document.dispatchEvent(e);
    return e;
}

function clickOn(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

beforeEach(async () => {
    document.body.innerHTML = '';
    deps.isAnyManagementWindowOpen.mockReturnValue(false);
    await flush(); // drain observer records from the innerHTML wipe
    jest.clearAllMocks();
    deps.isAnyManagementWindowOpen.mockReturnValue(false);
});

// Drain any still-queued MutationObserver callbacks while the jsdom window
// is alive — records queued by a test's last DOM mutation otherwise fire
// during environment teardown and crash inside jsdom's error reporting.
afterEach(async () => {
    await flush();
});

describe('Modal.open ([P2-UI-011] Stage 2 sub-session 1)', () => {
    const html = (id) => `<div class="modal-overlay" id="${id}"><div class="modal-content"><h3>T</h3></div></div>`;

    test('inserts the overlay as the last child of body and returns it', () => {
        const overlay = Modal.open(html('x'));
        expect(overlay).toBe(document.getElementById('x'));
        expect(document.body.lastElementChild).toBe(overlay);
    });

    test('returned element matches getTopmostOverlay (DOM order = stacking order)', () => {
        Modal.open(html('a'));
        const b = Modal.open(html('b'));
        expect(Modal.getTopmostOverlay()).toBe(b);
    });

    test('dedupeSelector: no-ops and returns null if a match already exists', () => {
        Modal.open(html('first'), { dedupeSelector: '.dedupe-me' });
        document.getElementById('first').classList.add('dedupe-me');
        const second = Modal.open(html('second'), { dedupeSelector: '.dedupe-me' });
        expect(second).toBeNull();
        expect(document.getElementById('second')).toBeNull();
        expect(document.getElementById('first')).not.toBeNull();
    });

    test('dedupeSelector: inserts normally when nothing matches', () => {
        const overlay = Modal.open(html('y'), { dedupeSelector: '.nothing-has-this' });
        expect(overlay).toBe(document.getElementById('y'));
    });

    test('defer: does not insert synchronously and returns undefined', () => {
        const result = Modal.open(html('later'), { defer: true });
        expect(result).toBeUndefined();
        expect(document.getElementById('later')).toBeNull();
    });

    test('defer: inserts one tick later', async () => {
        Modal.open(html('later2'), { defer: true });
        await flush();
        expect(document.getElementById('later2')).not.toBeNull();
    });

    test('defer + dedupeSelector: skips the deferred insert if a match landed before the tick fires', async () => {
        Modal.open(html('winner'), { dedupeSelector: '.race' });
        document.getElementById('winner').classList.add('race');
        Modal.open(html('loser'), { dedupeSelector: '.race', defer: true });
        await flush();
        expect(document.getElementById('loser')).toBeNull();
        expect(document.getElementById('winner')).not.toBeNull();
    });
});

describe('closeTopmost / closeModal semantics', () => {
    test('closeTopmost removes only the most recently opened overlay and returns true', () => {
        addOverlay('a');
        addOverlay('b');
        expect(Modal.closeTopmost()).toBe(true);
        expect(document.getElementById('b')).toBeNull();
        expect(document.getElementById('a')).not.toBeNull();
    });

    test('closeTopmost returns false when nothing is open', () => {
        expect(Modal.closeTopmost()).toBe(false);
    });

    test('closeModal still removes ALL overlays (regression: existing call sites rely on nuke-all)', () => {
        addOverlay('a');
        addOverlay('b');
        Modal.closeModal();
        expect(document.querySelectorAll('.modal-overlay').length).toBe(0);
    });
});

describe('ESC handling', () => {
    test('one ESC closes only the topmost of two stacked overlays', () => {
        addOverlay('under');
        addOverlay('top');
        pressKey('Escape');
        expect(document.getElementById('top')).toBeNull();
        expect(document.getElementById('under')).not.toBeNull();
        expect(deps.closeAllManagementWindows).not.toHaveBeenCalled();
    });

    test('ESC with no overlays falls through to management windows + FAB', () => {
        pressKey('Escape');
        expect(deps.closeAllManagementWindows).toHaveBeenCalledTimes(1);
        expect(deps.closeFabMenu).toHaveBeenCalledTimes(1);
    });
});

describe('click handling', () => {
    test('backdrop click removes only the clicked overlay', () => {
        addOverlay('under');
        const top = addOverlay('top');
        clickOn(top); // target = the overlay itself = backdrop
        expect(document.getElementById('top')).toBeNull();
        expect(document.getElementById('under')).not.toBeNull();
    });

    test('click inside .modal-content does not close the overlay and never closes windows beneath', () => {
        deps.isAnyManagementWindowOpen.mockReturnValue(true);
        const ov = addOverlay('a');
        clickOn(ov.querySelector('.modal-content'));
        expect(document.getElementById('a')).not.toBeNull();
        expect(deps.closeAllManagementWindows).not.toHaveBeenCalled();
    });

    test('outside click closes management windows when one is open', () => {
        deps.isAnyManagementWindowOpen.mockReturnValue(true);
        document.body.insertAdjacentHTML('beforeend', '<div id="playfield"></div>');
        clickOn(document.getElementById('playfield'));
        expect(deps.closeAllManagementWindows).toHaveBeenCalledTimes(1);
    });

    test('clicks inside a management window or the FAB container do not close windows', () => {
        deps.isAnyManagementWindowOpen.mockReturnValue(true);
        document.body.insertAdjacentHTML('beforeend', `
            <div class="management-window"><button id="inWin">x</button></div>
            <div class="fab-container"><button id="inFab">+</button></div>
        `);
        clickOn(document.getElementById('inWin'));
        clickOn(document.getElementById('inFab'));
        expect(deps.closeAllManagementWindows).not.toHaveBeenCalled();
    });
});

describe('focus management + ARIA (MutationObserver)', () => {
    test('opening an overlay sets role/aria-modal/aria-label and focuses .modal-content', async () => {
        const ov = addOverlay('a');
        await flush();
        expect(ov.getAttribute('role')).toBe('dialog');
        expect(ov.getAttribute('aria-modal')).toBe('true');
        expect(ov.getAttribute('aria-label')).toBe('Title a');
        const content = ov.querySelector('.modal-content');
        expect(content.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(content);
    });

    test('closing an overlay returns focus to the element that had focus when it opened', async () => {
        document.body.insertAdjacentHTML('beforeend', '<button id="opener">open</button>');
        const opener = document.getElementById('opener');
        opener.focus();
        const ov = addOverlay('a');
        await flush();
        expect(document.activeElement).not.toBe(opener);
        ov.remove();
        await flush();
        expect(document.activeElement).toBe(opener);
    });

    test('closing the topmost of two stacked overlays returns focus into the one beneath', async () => {
        addOverlay('under');
        await flush();
        const underBtn = document.getElementById('underBtn');
        underBtn.focus(); // the "opener" of the next overlay
        const top = addOverlay('top');
        await flush();
        top.remove();
        await flush();
        expect(document.activeElement).toBe(underBtn);
    });
});

describe('Tab trap (topmost overlay)', () => {
    test('Tab on the last focusable wraps to the first', async () => {
        addOverlay('a', '<h3>T</h3><button id="first">1</button><button id="last">2</button>');
        await flush();
        document.getElementById('last').focus();
        const e = pressKey('Tab');
        expect(e.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(document.getElementById('first'));
    });

    test('Shift+Tab on the first focusable wraps to the last', async () => {
        addOverlay('a', '<h3>T</h3><button id="first">1</button><button id="last">2</button>');
        await flush();
        document.getElementById('first').focus();
        const e = pressKey('Tab', { shiftKey: true });
        expect(e.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(document.getElementById('last'));
    });

    test('Tab with focus outside the overlay pulls focus to its first focusable', async () => {
        addOverlay('a', '<h3>T</h3><button id="first">1</button>');
        await flush();
        document.body.insertAdjacentHTML('beforeend', '<button id="outside">o</button>');
        document.getElementById('outside').focus();
        pressKey('Tab');
        expect(document.activeElement).toBe(document.getElementById('first'));
    });

    test('Tab with no overlay open is left alone', () => {
        const e = pressKey('Tab');
        expect(e.defaultPrevented).toBe(false);
    });
});

describe('ManagementWindows focus return', () => {
    function buildWindows() {
        document.body.innerHTML = `
            <button id="fabButton">+</button>
            <div id="tasksWindow" class="management-window hidden" tabindex="-1"><button id="inTasks">x</button></div>
            <div id="habitsWindow" class="management-window hidden" tabindex="-1"></div>
        `;
        return {
            tasks: document.getElementById('tasksWindow'),
            habits: document.getElementById('habitsWindow'),
        };
    }

    test('closeAllManagementWindows returns stranded focus to the FAB', () => {
        const managementWindows = buildWindows();
        managementWindows.tasks.classList.remove('hidden');
        document.getElementById('inTasks').focus(); // focus inside the window
        ManagementWindows.closeAllManagementWindows({ managementWindows });
        expect(document.activeElement).toBe(document.getElementById('fabButton'));
    });

    test('closeAllManagementWindows does NOT steal focus the user placed elsewhere', () => {
        const managementWindows = buildWindows();
        document.body.insertAdjacentHTML('beforeend', '<button id="elsewhere">e</button>');
        document.getElementById('elsewhere').focus();
        ManagementWindows.closeAllManagementWindows({ managementWindows });
        expect(document.activeElement).toBe(document.getElementById('elsewhere'));
    });

    test('closeManagementWindow only refocuses the FAB once the LAST window closes', () => {
        const managementWindows = buildWindows();
        managementWindows.tasks.classList.remove('hidden');
        managementWindows.habits.classList.remove('hidden');
        document.getElementById('inTasks').focus();
        ManagementWindows.closeManagementWindow('tasksWindow', { managementWindows });
        // habits still open — focus untouched
        expect(document.activeElement).toBe(document.getElementById('inTasks'));
        ManagementWindows.closeManagementWindow('habitsWindow', { managementWindows });
        expect(document.activeElement).toBe(document.getElementById('fabButton'));
    });
});
