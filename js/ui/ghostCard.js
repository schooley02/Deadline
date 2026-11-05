/**
 * GhostCard -- the small read-only card a tapped ghost zombie opens on another day (2026-11-04, Jeremy: ghosts "should
 * also be clickable so the user can look at which zombie that is").
 *
 * Ghosts are not real items (DayPager conjures them from definitions for a future day, or from the record for
 * Yesterday), so the normal task card cannot open for them. This card shows what the ghost is: name, Task / Sub-task /
 * Build Habit / Break Habit, category, routine, its Start and Due on that day, and on Yesterday what happened to it.
 * A ghost that IS a real one-off task still waiting in the board (`ghost.itemId`, and ctx.canOpen says it is live) also
 * gets an "Open task" button that opens its real card.
 *
 *   GhostCard.buildModel(ghost, ctx) -> { title, rows: [{ label, value }], canOpen }   (pure)
 *   GhostCard.cardHtml(model)        -> markup                                        (pure)
 *   GhostCard.open(ghost, ctx)       -> shows the card (one at a time)
 *
 * ctx: { dayLabel, routineName, canOpen, formatTime(date), onOpen(itemId), onClose() } -- all optional.
 * Whatever tap opens the card MUST stopPropagation, or Modal's document click handler closes it in the same click.
 * Modal is a bare global (loaded first).
 */
const GhostCard = (() => {

    function esc(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, ch => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    function kindLabel(ghost) {
        if (ghost.isHabit) return ghost.isNegative ? 'Break Habit' : 'Build Habit';
        return ghost.parentId != null ? 'Sub-task' : 'Task';
    }

    function categoryLabel(category) {
        const c = String(category || 'other');
        return c.charAt(0).toUpperCase() + c.slice(1);
    }

    function outcomeText(ghost, formatTime) {
        const at = (ghost.doneAt != null) ? ' at ' + formatTime(new Date(ghost.doneAt)) : '';
        switch (ghost.outcome) {
            case 'completed': return 'Completed' + at;
            case 'avoided': return 'Resisted' + at;
            case 'missed': return 'Missed';
            case 'indulged': return 'Slipped';
            default: return 'No record';
        }
    }

    function defaultFormatTime(date) {
        return (typeof TimeSlider !== 'undefined' && TimeSlider.formatLabel)
            ? TimeSlider.formatLabel(date)
            : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function buildModel(ghost, ctx) {
        const c = ctx || {};
        const fmt = typeof c.formatTime === 'function' ? c.formatTime : defaultFormatTime;
        const rows = [{ label: 'Type', value: kindLabel(ghost) }];
        rows.push({ label: 'Category', value: categoryLabel(ghost.category) });
        if (c.routineName) rows.push({ label: 'Routine', value: c.routineName });
        if (c.dayLabel) rows.push({ label: 'Day', value: c.dayLabel });
        const due = ghost.dueTime ? new Date(ghost.dueTime) : null;
        const start = ghost.startTime ? new Date(ghost.startTime) : null;
        if (start && due && start.getTime() < due.getTime() && !ghost.anytime) {
            rows.push({ label: 'Start', value: fmt(start) });
        }
        if (ghost.anytime) rows.push({ label: 'Due', value: 'Midnight' });
        else if (due) rows.push({ label: 'Due', value: fmt(due) });
        if (ghost.outcome) rows.push({ label: 'Result', value: outcomeText(ghost, fmt) });
        if (ghost.isHighPriority) rows.push({ label: 'Priority', value: 'Yes' });
        return {
            title: ghost.name || 'Zombie',
            rows,
            canOpen: !!(c.canOpen && ghost.itemId != null),
        };
    }

    function cardHtml(m) {
        const rowsHtml = m.rows.map(r =>
            `<div class="ghost-card-row"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('');
        const openBtn = m.canOpen
            ? '<button type="button" class="primary-button" data-action="open">Open task</button>' : '';
        return `
            <div class="modal-overlay ghost-card-overlay">
                <div class="modal-content ghost-card" role="dialog" aria-label="${esc(m.title)}">
                    <h3 class="ghost-card-title">${esc(m.title)}</h3>
                    <dl class="ghost-card-rows">${rowsHtml}</dl>
                    <div class="modal-buttons">
                        ${openBtn}
                        <button type="button" class="secondary-button" data-action="close">Close</button>
                    </div>
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    // The overlay may be removed by Modal's outside-click / Esc too, so onClose rides a MutationObserver (Dialog's
    // pattern) and fires exactly once whichever way it closed.
    function open(ghost, ctx) {
        if (typeof Modal === 'undefined' || !ghost) return null;
        const c = ctx || {};
        const existing = document.querySelector('.ghost-card-overlay');
        if (existing) existing.remove();
        const overlay = Modal.open(cardHtml(buildModel(ghost, c)));
        if (!overlay) return null;
        let closed = false;
        const finish = () => {
            if (closed) return;
            closed = true;
            observer.disconnect();
            if (typeof c.onClose === 'function') c.onClose();
        };
        const observer = new MutationObserver(() => { if (!document.body.contains(overlay)) finish(); });
        observer.observe(document.body, { childList: true });
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            e.stopPropagation();
            overlay.remove();
            finish();
            // Open the real task's card AFTER this one is gone (the click is already stopped, so Modal's
            // outside-click dismiss can't close the new popup).
            if (btn.dataset.action === 'open' && typeof c.onOpen === 'function') c.onOpen(ghost.itemId);
        });
        const first = overlay.querySelector('[data-action]');
        if (first && typeof first.focus === 'function') first.focus();
        return overlay;
    }

    return { kindLabel, buildModel, cardHtml, open };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GhostCard;
}
