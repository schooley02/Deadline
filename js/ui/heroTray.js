/**
 * HeroTray — the "Heroes" tab on the canvas and the pull-up tray behind it
 * (docs/HERO_SPOTLIGHT_PLAN.md sub-session 3, 2026-10-21). Replaces the old
 * per-routine chips at the base (`#heroBaseZone`, retired this session).
 *
 *   TAB   (#heroTab, bottom centre of the canvas): "Heroes" + status dots --
 *         blue = some hero has an unspent slot point, red = some hero is
 *         knocked out or hurt (health <= CONFIG.HERO_HURT_PCT). While a hero is
 *         spotlighted it becomes that hero's status (emoji, name, Lv, health bar).
 *   TRAY  (#heroTray, fixed bottom sheet that rises up in every layout): one row
 *         per routine ranked by HeroesView.rankRoutines -- avatar with a health
 *         ring, name, Lv, stars, state, and the slot row: filled habit/task
 *         cells (category icon; ice when frozen), empty slots, dashed-blue
 *         unspent points, and a lock preview of the next slot. A row tap opens
 *         that routine's Manage Routine window (the add flow there spends points).
 *
 * PURE / DOM split like the other UI modules: slotCells, buildRowViewModel,
 * summarize, tabModel, tabSignature, rowSignature, shouldAutoOpenOnLevelUp are
 * pure and unit-tested; init/render/open/close are DOM and live-checked.
 * `render` is called every game tick (script.js renderHeroesAtBase), so DOM is
 * touched only when a signature changes (rows are reconciled in place, never
 * rebuilt per tick -- DECISIONS 2026-10-14). It also owns the star-up notice
 * detection the old chip renderer did. Globals read at call time: Heroes,
 * HeroesView.
 */
const HeroTray = (() => {
    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESC[c]);
    }

    // ---- pure ---------------------------------------------------------------

    /**
     * The slot row for one routine. Order: habits (filled, then empty), tasks
     * (filled, then empty), unspent points, then ONE lock preview for the next
     * level's point while the routine can still level.
     * cell kinds: habit | task | empty (itemType) | point | locked (level)
     */
    function slotCells(routine, definedHabits, definedTasks, config) {
        const cells = [];
        const habitIds = new Set(routine.habitDefinitionIds || []);
        const taskIds = new Set(routine.taskDefinitionIds || []);
        const habits = (definedHabits || []).filter(d => !d.archivedAt && (d.routineId === routine.id || habitIds.has(d.id)));
        const tasks = (definedTasks || []).filter(d => taskIds.has(d.id));
        const frozenBy = routine.frozenState ? routine.frozenState.frozenBy : null;

        habits.forEach(d => cells.push({ kind: 'habit', category: d.category || 'other', frozen: frozenBy !== null && frozenBy === d.id }));
        const emptyHabits = Math.max(0, Heroes.slotCapacity(routine, 'habit', config) - habits.length);
        for (let i = 0; i < emptyHabits; i++) cells.push({ kind: 'empty', itemType: 'habit' });

        tasks.forEach(d => cells.push({ kind: 'task', category: d.category || 'other', frozen: false }));
        const emptyTasks = Math.max(0, Heroes.slotCapacity(routine, 'task', config) - tasks.length);
        for (let i = 0; i < emptyTasks; i++) cells.push({ kind: 'empty', itemType: 'task' });

        const points = Heroes.availableSlotPoints(routine, config);
        for (let i = 0; i < points; i++) cells.push({ kind: 'point' });

        const level = routine.level || 1;
        if (level < config.ROUTINE_MAX_SLOT_POINTS + 1) cells.push({ kind: 'locked', level: level + 1 });
        return cells;
    }

    function buildRowViewModel(routine, ctx) {
        const chip = HeroesView.buildChipViewModel(routine, ctx.definedHabits, ctx.config, ctx.runStartedAtMs);
        return {
            chip,
            cells: slotCells(routine, ctx.definedHabits, ctx.definedTasks, ctx.config),
            points: Heroes.availableSlotPoints(routine, ctx.config),
        };
    }

    function summarize(rows, config) {
        const hurtPct = typeof config.HERO_HURT_PCT === 'number' ? config.HERO_HURT_PCT : 0.5;
        return {
            hasOpenSlot: rows.some(r => r.points > 0),
            hasHurt: rows.some(r => r.chip.state === 'ko' || r.chip.healthPct <= hurtPct),
        };
    }

    /** What the tab shows: the spotlit hero's status, else "Heroes" + dots. */
    function tabModel(rows, spotlitId, config) {
        const spot = (spotlitId !== null && spotlitId !== undefined)
            ? rows.find(r => r.chip.id === spotlitId) : null;
        if (spot) {
            return {
                mode: 'spot',
                id: spot.chip.id,
                emoji: spot.chip.emoji,
                name: spot.chip.name,
                level: spot.chip.level,
                health: spot.chip.health,
                maxHealth: config.ROUTINE_MAX_HEALTH,
                healthPct: spot.chip.healthPct,
            };
        }
        const s = summarize(rows, config);
        return { mode: 'idle', count: rows.length, hasOpenSlot: s.hasOpenSlot, hasHurt: s.hasHurt };
    }

    function tabSignature(model) {
        return model.mode === 'spot'
            ? ['spot', model.id, model.name, model.level, model.health, model.emoji].join('|')
            : ['idle', model.count, model.hasOpenSlot ? 1 : 0, model.hasHurt ? 1 : 0].join('|');
    }

    function rowSignature(row) {
        const c = row.chip;
        const cells = row.cells.map(x => [x.kind, x.category || x.itemType || x.level || '', x.frozen ? 'f' : ''].join(':')).join(',');
        return [c.id, c.name, c.level, c.stars, c.health, c.state, c.emoji, row.points, cells].join('|');
    }

    /**
     * Level-up detection for the one-shot auto-open. Mutates `memory`
     * (routineId -> last seen level, session only). True only when the level
     * ROSE since the last observation (the first observation just seeds) and
     * an unspent point is waiting.
     */
    function shouldAutoOpenOnLevelUp(memory, routine, availablePoints) {
        const level = routine.level || 1;
        const previous = memory[routine.id];
        memory[routine.id] = level;
        if (previous === undefined) return false;
        return level > previous && availablePoints > 0;
    }

    // ---- DOM ----------------------------------------------------------------
    let els = null;
    let deps = null;
    let isOpen = false;
    let lastRows = [];
    let focusId = null;
    let pulseId = null;
    let tabSig = null;
    const levelMemory = {};

    const STATE_LABEL = { ko: 'Knocked out', frozen: 'Frozen', inactive: 'Inactive', active: 'Active' };

    function slotCellHtml(cell, config) {
        if (cell.kind === 'habit' || cell.kind === 'task') {
            const emoji = cell.frozen ? '🥶' : HeroesView.categoryEmoji(cell.category, config);
            const label = `${cell.kind === 'habit' ? 'Habit' : 'Task'} slot${cell.frozen ? ' (frozen)' : ''}`;
            return `<span class="hero-slot hero-slot--${cell.kind}${cell.frozen ? ' hero-slot--frozen' : ''}" title="${label}">${emoji}</span>`;
        }
        if (cell.kind === 'empty') {
            return `<span class="hero-slot hero-slot--empty hero-slot--${cell.itemType}" title="Open ${cell.itemType} slot">+</span>`;
        }
        if (cell.kind === 'point') {
            return '<span class="hero-slot hero-slot--point" title="Unspent slot point">+</span>';
        }
        return `<span class="hero-slot hero-slot--locked" title="Next slot point at Lv ${cell.level}">🔒</span>`;
    }

    function rowHtml(row, config) {
        const c = row.chip;
        const hp = Math.round(c.healthPct * 100);
        return `
            <div class="hero-tray-avatar" style="--hp:${hp}; --hp-color:${HeroesView.healthColorVar(c.healthPct)};">
                <span class="hero-tray-avatar-inner" aria-hidden="true">${c.emoji}</span>
            </div>
            <div class="hero-tray-main">
                <div class="hero-tray-name"><span class="hero-tray-name-text">${esc(c.name)}</span><span class="hero-tray-level">Lv ${c.level}</span><span class="hero-tray-stars" aria-label="${c.stars} of 5 stars"><span class="hero-tray-star-on">${'★'.repeat(Math.max(0, c.stars))}</span><span class="hero-tray-star-off">${'☆'.repeat(Math.max(0, 5 - c.stars))}</span></span></div>
                <div class="hero-tray-status">${STATE_LABEL[c.state] || 'Active'} · ❤ ${c.health}/${config.ROUTINE_MAX_HEALTH}</div>
                <div class="hero-tray-slots">${row.cells.map(cell => slotCellHtml(cell, config)).join('')}</div>
            </div>`;
    }

    function updateList() {
        if (!els) return;
        const config = deps.config;
        const listEl = els.listEl;
        if (lastRows.length === 0) {
            if (!listEl.querySelector('.hero-tray-empty')) {
                listEl.innerHTML = '<div class="hero-tray-empty"><p>No heroes yet. A routine is a hero: create one to recruit your first.</p><button type="button" class="hero-tray-empty-btn" data-action="open-routines">Open routines</button></div>';
            }
            return;
        }
        const existing = {};
        Array.from(listEl.children).forEach(el => { if (el.dataset.routineId != null) existing[el.dataset.routineId] = el; });
        const desired = lastRows.map(row => {
            const id = String(row.chip.id);
            const sig = rowSignature(row);
            let el = existing[id];
            if (!el || el.dataset.sig !== sig) {
                el = document.createElement('div');
                el.className = 'hero-tray-row';
                el.dataset.routineId = id;
                el.dataset.sig = sig;
                el.setAttribute('role', 'button');
                el.tabIndex = 0;
                el.setAttribute('aria-label', `${row.chip.name}, level ${row.chip.level}. Open routine`);
                el.innerHTML = rowHtml(row, config);
            }
            el.classList.toggle('hero-tray-row--focus', focusId !== null && String(focusId) === id);
            el.classList.toggle('hero-tray-row--pulse', pulseId !== null && String(pulseId) === id);
            ['ko', 'frozen', 'inactive', 'active'].forEach(s => el.classList.toggle(`hero-tray-row--${s}`, row.chip.state === s));
            return el;
        });
        const current = Array.from(listEl.children);
        const same = current.length === desired.length && current.every((el, i) => el === desired[i]);
        if (!same) listEl.replaceChildren(...desired);
    }

    function updateTab(model, config) {
        const sig = tabSignature(model);
        if (sig === tabSig) return;
        tabSig = sig;
        const tab = els.tabEl;
        if (model.mode === 'spot') {
            const pct = Math.round(model.healthPct * 100);
            tab.className = 'hero-tab hero-tab--spot';
            tab.innerHTML = `<span class="hero-tab-emoji" aria-hidden="true">${model.emoji}</span><span class="hero-tab-name">${esc(model.name)} · Lv ${model.level}</span><span class="hero-tab-track" aria-hidden="true"><span class="hero-tab-fill" style="width:${pct}%; background:${HeroesView.healthColorVar(model.healthPct)};"></span></span><span class="hero-tab-hp">${model.health}/${config.ROUTINE_MAX_HEALTH}</span>`;
            tab.setAttribute('aria-label', `${model.name}, level ${model.level}, health ${model.health} of ${config.ROUTINE_MAX_HEALTH}. Open heroes`);
        } else {
            const notes = [];
            if (model.hasOpenSlot) notes.push('open slot');
            if (model.hasHurt) notes.push('hero hurt');
            tab.className = 'hero-tab';
            tab.innerHTML = `<span class="hero-tab-chevron" aria-hidden="true">▲</span><span>Heroes</span>${model.hasOpenSlot ? '<span class="hero-tab-dot hero-tab-dot--open" aria-hidden="true"></span>' : ''}${model.hasHurt ? '<span class="hero-tab-dot hero-tab-dot--hurt" aria-hidden="true"></span>' : ''}`;
            tab.setAttribute('aria-label', `Heroes${notes.length ? ': ' + notes.join(', ') : ''}`);
        }
        tab.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function open(routineId, opts) {
        if (!els) return;
        isOpen = true;
        focusId = (routineId !== undefined && routineId !== null) ? routineId : null;
        pulseId = opts && opts.pulse ? focusId : null;
        updateList();
        els.trayEl.classList.add('open');
        els.backdropEl.classList.add('open');
        els.trayEl.setAttribute('aria-hidden', 'false');
        els.tabEl.setAttribute('aria-expanded', 'true');
        if (focusId !== null) {
            const row = els.listEl.querySelector(`[data-routine-id="${String(focusId).replace(/"/g, '')}"]`);
            if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
        }
    }

    function close() {
        if (!els || !isOpen) return;
        isOpen = false;
        focusId = null;
        pulseId = null;
        els.trayEl.classList.remove('open');
        els.backdropEl.classList.remove('open');
        els.trayEl.setAttribute('aria-hidden', 'true');
        els.tabEl.setAttribute('aria-expanded', 'false');
        updateList();
    }

    function toggle() { if (isOpen) close(); else open(); }

    /**
     * d: { tabEl, trayEl, backdropEl, listEl, closeEl, config,
     *      onManage(routineId), onOpenRoutines(), getSpotlitId(), dismissSpotlight(),
     *      isModalOpen() }
     */
    function init(d) {
        deps = d;
        els = { tabEl: d.tabEl, trayEl: d.trayEl, backdropEl: d.backdropEl, listEl: d.listEl };
        d.tabEl.addEventListener('click', () => {
            const spotlit = d.getSpotlitId();
            if (spotlit !== null && spotlit !== undefined) {
                d.dismissSpotlight();
                open(spotlit);
            } else {
                toggle();
            }
        });
        d.backdropEl.addEventListener('click', close);
        if (d.closeEl) d.closeEl.addEventListener('click', close);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });
        const activate = (target, ev) => {
            if (target.closest && target.closest('[data-action="open-routines"]')) {
                // stopPropagation is required: Modal.initDismissHandlers closes
                // management windows on any document click outside them, so the
                // same click that opens Routines would close it again.
                if (ev && ev.stopPropagation) ev.stopPropagation();
                close();
                d.onOpenRoutines();
                return;
            }
            const row = target.closest ? target.closest('.hero-tray-row') : null;
            if (!row) return;
            const id = row.dataset.routineId;
            close();
            d.onManage(id);
        };
        d.listEl.addEventListener('click', (e) => activate(e.target, e));
        d.listEl.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('hero-tray-row')) {
                e.preventDefault();
                activate(e.target);
            }
        });
    }

    /**
     * Per-tick render. r: { definedRoutines (override-able), definedHabits,
     * definedTasks, config, runStartedAtMs, starMemory, onStarThresholdCrossed }
     */
    function render(r) {
        if (!els) return;
        const config = r.config;
        const routines = r.definedRoutines || [];
        const ranked = HeroesView.rankRoutines(routines, r.definedHabits, config, r.runStartedAtMs);
        const ctx = { definedHabits: r.definedHabits, definedTasks: r.definedTasks, config, runStartedAtMs: r.runStartedAtMs };
        const rows = ranked.map(routine => buildRowViewModel(routine, ctx));
        lastRows = rows;

        let autoOpenId = null;
        rows.forEach((row, i) => {
            const routine = ranked[i];
            if (r.starMemory && r.onStarThresholdCrossed) {
                if (HeroesView.trackStarCrossing(r.starMemory, routine.id, row.chip.stars)) {
                    r.onStarThresholdCrossed(routine, row.chip.stars);
                }
            }
            if (shouldAutoOpenOnLevelUp(levelMemory, routine, row.points) && autoOpenId === null) autoOpenId = routine.id;
        });

        const spotlitId = deps.getSpotlitId();
        updateTab(tabModel(rows, spotlitId, config), config);
        if (isOpen) updateList();
        if (autoOpenId !== null && !isOpen && !deps.isModalOpen()) open(autoOpenId, { pulse: true });
    }

    function resetMemory() {
        Object.keys(levelMemory).forEach(k => delete levelMemory[k]);
    }

    return {
        slotCells,
        buildRowViewModel,
        summarize,
        tabModel,
        tabSignature,
        rowSignature,
        shouldAutoOpenOnLevelUp,
        init,
        render,
        open,
        close,
        toggle,
        resetMemory,
        isOpen: () => isOpen,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeroTray;
}
