/**
 * GoalsPane -- the HUD flagpole button and the popup window behind it (Goals Build B1, 2026-11-05; docs/GOALS_PLAN.md "Screens").
 *
 *   BUTTON (#goalsButton, HUD, right after the heroes button): a flagpole icon, "N/M" = goals on pace / active goals, then one
 *          status dot per active goal (green ahead, amber behind, red overdue, grey no clock; at most 6). Opens the pane.
 *   PANE   (#goalsPane, a centred window over a dimmed backdrop in every layout, like the heroes popup): header with the
 *          theme's pane title, "Goals . 3 of 4 slots" and the finished count (opens the roster of finished goals); body = a grid of
 *          SLOT CELLS: a goal (art + name + progress + pace dot + one line + streak pips), an open slot, and ONE locked cell showing
 *          the next unlock. A tap on a goal opens its card (js/ui/goalCard.js).
 *
 * Baseline rule (CLAUDE.md): this file speaks engine words only. Every player-facing theme word (pane title, "survivors") comes
 * from Theme.strings.goals at call time; the sprites are CSS/SVG placeholders until the art lands (artHtml below), so no theme noun
 * is spelled here -- test/wording-rule.test.js fails this file on one.
 *
 * PURE / DOM split like HeroTray: everything above "DOM" is pure and unit-tested (test/goalsPane.test.js); init / render / open /
 * close are DOM. `render` runs every game tick: the DOM is touched only when a signature changes.
 */
const GoalsPane = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const PACE_WORD = { ahead: 'Ahead', behind: 'Behind', overdue: 'Overdue', none: 'No deadline', done: 'Complete' };
    const MAX_DOTS = 6;
    const PIP_COUNT = 5;

    const themeStrings = () => (typeof Theme !== 'undefined' && Theme.strings && Theme.strings.goals) ? Theme.strings.goals : {};
    const fillText = (text, vars) => (typeof Theme !== 'undefined' && Theme.fill) ? Theme.fill(text, vars) : String(text || '');

    // ---- pure -----------------------------------------------------------------------------------------------------------------

    /** 'Dec 31' from a 'YYYY-MM-DD' key ('' for anything else). */
    function shortDate(key) {
        const m = typeof key === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
        if (!m) return '';
        return MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]);
    }

    /** Whole numbers stay whole; others keep at most one decimal. */
    function fmtNum(n) {
        if (typeof n !== 'number' || !isFinite(n)) return '0';
        return String(Math.round(n * 10) / 10);
    }

    function percent(progress) {
        return Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);
    }

    function periodWord(period) {
        return period === 'day' ? 'day' : period === 'month' ? 'month' : 'week';
    }

    /** The level-based facts the HUD button shows: how many goals are on pace, and one pace per goal (capped). */
    function buttonModel(views) {
        const list = Array.isArray(views) ? views : [];
        const dots = list.map(v => v.pace || 'none');
        const onPace = list.filter(v => v.pace === 'ahead' || v.pace === 'none' || v.pace === 'done').length;
        return { active: list.length, onPace, dots: dots.slice(0, MAX_DOTS), more: Math.max(0, dots.length - MAX_DOTS) };
    }

    function buttonSignature(model) {
        return [model.active, model.onPace, model.dots.join(','), model.more].join('|');
    }

    function buttonLabel(model) {
        if (model.active === 0) return 'Goals: none yet. Open goals';
        const behind = model.dots.filter(d => d === 'behind').length;
        const overdue = model.dots.filter(d => d === 'overdue').length;
        const notes = [`${model.onPace} of ${model.active} goals on pace`];
        if (behind) notes.push(`${behind} behind`);
        if (overdue) notes.push(`${overdue} overdue`);
        return `Goals: ${notes.join(', ')}. Open goals`;
    }

    /** The streak pips for a recurring goal: the last PIP_COUNT closed periods, oldest first, true = met. */
    function streakPips(goal) {
        if (!goal || goal.kind !== 'recurring' || !Array.isArray(goal.history)) return [];
        return goal.history.slice(-PIP_COUNT).map(h => h.met === true);
    }

    /** "3 of 5" for a single counting target, else the percent. */
    function progressText(view) {
        const only = view.targets.length === 1 ? view.targets[0] : null;
        const d = only ? only.detail : null;
        if (d && d.kind !== 'bool' && d.need > 1 && !(d.kind === 'number' && d.start)) {
            if (d.mode === 'limit') return `${fmtNum(d.have)} so far`;
            return `${fmtNum(d.have)} of ${fmtNum(d.need)}`;
        }
        return `${percent(view.progress)}%`;
    }

    /** The one line under a slot's name. */
    function cellLine(view) {
        const g = view.goal;
        if (view.pace === 'done') return 'Complete';
        const lead = g.kind === 'recurring'
            ? `Every ${periodWord(g.period)}`
            : (g.deadline ? `Due ${shortDate(g.deadline)}` : 'No deadline');
        return `${lead} · ${progressText(view)}`;
    }

    /** The chip on a cell: 'Example' (suggested goal), the first-day-of-period result, or nothing. */
    function cellChip(view) {
        if (view.recent === 'slipped') return { kind: 'slipped', text: view.goal.stage === 0 ? 'Missed last period' : 'Slipped a stage' };
        if (view.recent === 'met') return { kind: 'met', text: 'Period met' };
        if (view.goal.suggested) return { kind: 'example', text: 'Example' };
        return null;
    }

    /**
     * The cells of the grid, in order: every active goal, the open slots, then ONE locked cell (the next unlock) when there is one.
     * slotInfo = { slots, used, next: { level, slots } | null }.
     */
    function cellModels(views, slotInfo) {
        const list = Array.isArray(views) ? views : [];
        const info = slotInfo || { slots: list.length, used: list.length, next: null };
        const cells = list.map(view => ({ kind: 'goal', view }));
        const open = Math.max(0, info.slots - list.length);
        for (let i = 0; i < open; i++) cells.push({ kind: 'open' });
        if (info.next) cells.push({ kind: 'locked', level: info.next.level });
        return cells;
    }

    function cellSignature(cell) {
        if (cell.kind === 'open') return 'open';
        if (cell.kind === 'locked') return 'locked:' + cell.level;
        const v = cell.view;
        return ['goal', v.id, v.goal.name, v.stage, percent(v.progress), v.pace, cellLine(v), (cellChip(v) || {}).text || '', streakPips(v.goal).map(b => (b ? 1 : 0)).join('')].join('|');
    }

    function headerText(slotInfo) {
        const info = slotInfo || { slots: 0, used: 0 };
        return `Goals · ${info.used} of ${info.slots} slots`;
    }

    /** Short kind line for the card and the roster: 'Repeats every week' / 'One-time · Due Dec 31'. */
    function kindLine(goalLike) {
        if (goalLike.kind === 'recurring') return `Repeats every ${periodWord(goalLike.period)}`;
        return goalLike.deadline ? `One-time · Due ${shortDate(goalLike.deadline)}` : 'One-time · No deadline';
    }

    /** Where a recurring period ends, in words: 'tonight', 'Sunday', 'Nov 30'. */
    function periodEndsText(goal, nowMs, weekStartsOn) {
        if (typeof Goals === 'undefined') return '';
        const key = Goals.periodKeyFor(goal.period, nowMs, weekStartsOn);
        const endExclusive = Goals.periodEnd(goal.period, key);
        if (!endExclusive) return '';
        const last = new Date(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate() - 1);
        if (goal.period === 'day') return 'tonight';
        if (goal.period === 'week') return WEEKDAYS[last.getDay()];
        return MONTHS[last.getMonth()] + ' ' + last.getDate();
    }

    /** The pace in words for the card: 'Ahead of pace . ends Sunday', 'Overdue ...'. */
    function paceText(view, nowMs, weekStartsOn) {
        const g = view.goal;
        let head;
        switch (view.pace) {
            case 'done': return 'Complete';
            case 'ahead': head = 'Ahead of pace'; break;
            case 'behind': head = 'Behind pace'; break;
            case 'overdue': head = 'Overdue. It still counts when you finish it'; break;
            default: return g.kind === 'milestone' ? 'No deadline, no pressure' : '';
        }
        if (g.kind === 'recurring') {
            const ends = periodEndsText(g, nowMs, weekStartsOn);
            return ends ? `${head} · ends ${ends}` : head;
        }
        if (g.deadline && view.pace !== 'overdue' && typeof Goals !== 'undefined') {
            const due = Goals.periodStart('day', g.deadline);
            if (due) {
                const now = new Date(nowMs);
                const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const days = Math.round((due.getTime() - today0.getTime()) / 86400000);
                if (days <= 0) return `${head} \u00b7 due today`;
                return `${head} \u00b7 due in ${days} day${days === 1 ? '' : 's'}`;
            }
        }
        return head;
    }

    /** The roster rows, newest first: { id, name, kindLine, finished, periodsMet, bestStreak }. */
    function rosterRows(done) {
        return (Array.isArray(done) ? done : []).map(r => ({
            id: r.id,
            name: r.name,
            kindLine: kindLine(r),
            finished: shortDate(typeof Goals !== 'undefined' ? Goals.dateKey(r.finishedAt) : ''),
            periodsMet: r.periodsMet || 0,
            bestStreak: r.bestStreak || 0,
            kind: r.kind,
        }));
    }

    // ---- placeholder art ------------------------------------------------------------------------------------------------------
    // One footprint, six stages (docs/GOALS_PLAN.md "Art contract"): a container, and a subject whose posture and colour follow the
    // stage. Plain SVG shapes, no theme art, so the pane works before any sprite exists. The real art swaps in here (Theme.goalAsset).
    const STAGE_COLORS = ['#7d8f6a', '#8f9a6a', '#a8a56a', '#c4ad6a', '#dcae62', '#f0b84f'];

    function artHtml(kind, stage) {
        const s = Math.max(0, Math.min(5, Math.floor(Number(stage)) || 0));
        const frame = '<rect class="goal-art-frame" x="4" y="4" width="40" height="56" rx="7" ry="7"/>';
        if (kind === 'open') {
            return `<svg viewBox="0 0 48 64" class="goal-art goal-art--open" aria-hidden="true" focusable="false"><rect class="goal-art-frame goal-art-frame--dashed" x="4" y="4" width="40" height="56" rx="7" ry="7"/><path class="goal-art-plus" d="M24 26v12M18 32h12"/></svg>`;
        }
        if (kind === 'locked') {
            return `<svg viewBox="0 0 48 64" class="goal-art goal-art--locked" aria-hidden="true" focusable="false">${frame}<rect class="goal-art-lock" x="16" y="30" width="16" height="13" rx="2"/><path class="goal-art-lock-arc" d="M19 30v-4a5 5 0 0 1 10 0v4"/></svg>`;
        }
        const tilt = (5 - s) * 5; // degrees: the subject straightens as the stage climbs
        const color = STAGE_COLORS[s];
        const star = s === 5 ? '<path class="goal-art-star" d="M24 9l1.6 3.3 3.6.5-2.6 2.5.6 3.6L24 17.2l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/>' : '';
        return `<svg viewBox="0 0 48 64" class="goal-art goal-art--stage${s}" aria-hidden="true" focusable="false">${frame}`
            + `<rect class="goal-art-liquid" x="6" y="${40 - s * 2}" width="36" height="${18 + s * 2}" rx="5" ry="5"/>`
            + `<g transform="rotate(${tilt} 24 54)"><rect x="17" y="30" width="14" height="24" rx="6" fill="${color}"/><circle cx="24" cy="25" r="6.5" fill="${color}"/></g>${star}</svg>`;
    }

    // ---- html -----------------------------------------------------------------------------------------------------------------

    function pipsHtml(goal) {
        const pips = streakPips(goal);
        if (pips.length === 0) return '';
        return `<span class="goal-pips" aria-hidden="true">${pips.map(met => `<i class="goal-pip${met ? ' goal-pip--met' : ''}"></i>`).join('')}</span>`;
    }

    function chipHtml(chip) {
        return chip ? `<span class="goal-chip goal-chip--${chip.kind}">${esc(chip.text)}</span>` : '';
    }

    function cellAriaLabel(view) {
        const chip = cellChip(view);
        return `${view.goal.name}. ${cellLine(view).replace(/·/g, ',')}. Stage ${view.stage} of 5.${chip ? ' ' + chip.text + '.' : ''} Open goal`;
    }

    function cellHtml(cell) {
        if (cell.kind === 'open') {
            return `<div class="goal-slot goal-slot--open" role="group" aria-label="Open goal slot">${artHtml('open')}<span class="goal-slot-name">Open slot</span></div>`;
        }
        if (cell.kind === 'locked') {
            return `<div class="goal-slot goal-slot--locked" role="group" aria-label="Locked goal slot, unlocks at level ${cell.level}">${artHtml('locked')}<span class="goal-slot-name">${esc(fillText(themeStrings().lockedLine || 'Unlocks at Lv {level}', { level: cell.level }))}</span></div>`;
        }
        const v = cell.view;
        const chip = chipHtml(cellChip(v));
        return `<button type="button" class="goal-slot goal-slot--goal goal-pace--${esc(v.pace)}" data-goal-id="${esc(v.id)}" aria-label="${esc(cellAriaLabel(v))}">`
            + `${chip}${artHtml('stage', v.stage)}`
            + `<span class="goal-slot-name">${esc(v.goal.name)}</span>`
            + `<span class="goal-slot-bar" aria-hidden="true"><span class="goal-slot-fill" style="width:${percent(v.progress)}%"></span></span>`
            + `<span class="goal-slot-line"><i class="goal-pace-dot" aria-hidden="true"></i><span class="goal-slot-line-text">${esc(cellLine(v))}</span></span>`
            + `${pipsHtml(v.goal)}</button>`;
    }

    function rosterHtml(rows) {
        if (rows.length === 0) {
            return `<div class="goal-roster-empty"><p>Nothing here yet. Finish a goal and it joins this list.</p></div>`;
        }
        return `<ul class="goal-roster">${rows.map(r => `<li class="goal-roster-row"><span class="goal-roster-name">${esc(r.name)}</span>`
            + `<span class="goal-roster-meta">${esc(r.kindLine)}${r.finished ? ' · finished ' + esc(r.finished) : ''}`
            + `${r.kind === 'recurring' ? ` · ${r.periodsMet} met, best streak ${r.bestStreak}` : ''}</span></li>`).join('')}</ul>`;
    }

    // ---- DOM ------------------------------------------------------------------------------------------------------------------
    const FLAG_ICON = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5 18V2.5"/><path d="M5 3.5h9.5l-2 3.2 2 3.2H5"/></svg>';

    let els = null;
    let deps = null;
    let isOpen = false;
    let showRoster = false;
    let escHadModal = false;
    let buttonSig = null;
    let bodySig = null;
    let lastViews = [];
    let lastInfo = { slots: 0, used: 0, next: null };

    function updateButton(model) {
        const sig = buttonSignature(model);
        if (sig === buttonSig) return;
        buttonSig = sig;
        const btn = els.tabEl;
        const text = model.active > 0 ? `<span class="goals-button-count" aria-hidden="true">${model.onPace}/${model.active}</span>` : '';
        const dots = model.dots.length
            ? `<span class="goals-button-dots" aria-hidden="true">${model.dots.map(d => `<i class="goals-dot goals-dot--${esc(d)}"></i>`).join('')}</span>`
            : '';
        btn.innerHTML = FLAG_ICON + text + dots;
        btn.setAttribute('aria-label', buttonLabel(model));
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function updateBody() {
        const finishedCount = deps.getRoster().length;
        const ts = themeStrings();
        const sig = [showRoster ? 'r' : 'g', finishedCount, lastInfo.slots, lastInfo.used, lastInfo.next ? lastInfo.next.level : '-',
            lastViews.length, cellModels(lastViews, lastInfo).map(cellSignature).join('~')].join('#');
        if (sig === bodySig) return;
        bodySig = sig;
        if (els.titleEl) els.titleEl.textContent = ts.paneTitle || 'Goals';
        if (els.subEl) els.subEl.textContent = headerText(lastInfo);
        if (els.rosterBtnEl) {
            els.rosterBtnEl.textContent = showRoster ? 'Back to goals' : `${ts.finishedPlural || 'Finished'}: ${finishedCount}`;
            els.rosterBtnEl.setAttribute('aria-pressed', showRoster ? 'true' : 'false');
        }
        els.bodyEl.innerHTML = showRoster
            ? rosterHtml(rosterRows(deps.getRoster()))
            : `<div class="goal-grid">${cellModels(lastViews, lastInfo).map(cellHtml).join('')}</div>`;
    }

    function open() {
        if (!els) return;
        isOpen = true;
        showRoster = false;
        bodySig = null;
        refresh();
        els.paneEl.classList.add('open');
        els.backdropEl.classList.add('open');
        els.paneEl.setAttribute('aria-hidden', 'false');
        els.tabEl.setAttribute('aria-expanded', 'true');
    }

    function close() {
        if (!els || !isOpen) return;
        isOpen = false;
        els.paneEl.classList.remove('open');
        els.backdropEl.classList.remove('open');
        els.paneEl.setAttribute('aria-hidden', 'true');
        els.tabEl.setAttribute('aria-expanded', 'false');
    }

    function toggle() { if (isOpen) close(); else open(); }

    function refresh() {
        if (!els) return;
        lastViews = deps.getViews();
        lastInfo = deps.getSlotInfo();
        updateButton(buttonModel(lastViews));
        if (isOpen) updateBody();
    }

    /**
     * d: { tabEl, paneEl, backdropEl, bodyEl, titleEl?, subEl?, closeEl?, rosterBtnEl?,
     *      getViews() -> views, getSlotInfo() -> { slots, used, next }, getRoster() -> GoalRecord[], onOpenGoal(goalId) }
     */
    function init(d) {
        deps = d;
        els = { tabEl: d.tabEl, paneEl: d.paneEl, backdropEl: d.backdropEl, bodyEl: d.bodyEl, titleEl: d.titleEl || null, subEl: d.subEl || null, rosterBtnEl: d.rosterBtnEl || null };
        d.tabEl.addEventListener('click', (e) => {
            // stopPropagation: Modal's document click handler would otherwise see this tap as an outside click.
            e.stopPropagation();
            toggle();
        });
        d.backdropEl.addEventListener('click', close);
        if (d.closeEl) d.closeEl.addEventListener('click', close);
        if (d.rosterBtnEl) {
            d.rosterBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                showRoster = !showRoster;
                bodySig = null;
                updateBody();
            });
        }
        // Esc closes the topmost window first (a goal card); only an Esc with nothing above the pane closes the pane.
        document.addEventListener('keydown', () => { escHadModal = !!document.querySelector('.modal-overlay'); }, true);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen && !escHadModal) close(); });
        d.bodyEl.addEventListener('click', (e) => {
            const cell = e.target.closest ? e.target.closest('.goal-slot--goal') : null;
            if (!cell) return;
            // stopPropagation: Modal's outside-click handler would treat the tap that opens a card as a dismiss.
            e.stopPropagation();
            d.onOpenGoal(cell.dataset.goalId);
        });
    }

    return {
        shortDate, fmtNum, percent, periodWord, buttonModel, buttonSignature, buttonLabel, streakPips, progressText, cellLine, cellChip,
        cellModels, cellSignature, headerText, kindLine, periodEndsText, paceText, rosterRows, artHtml, cellHtml, rosterHtml, pipsHtml,
        FLAG_ICON, PACE_WORD,
        init, refresh, open, close, toggle,
        isOpen: () => isOpen,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoalsPane;
}
