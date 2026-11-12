/**
 * BarricadeWindow -- the Barricade window (Momentum Build B, 2026-11-11; docs/MOMENTUM_PLAN.md "Where the player sees it").
 *
 * Shows the player's MOMENTUM: "N of 7" and the barricade state, the nights the count looked at (Defended / Missed / Excused),
 * today's status, and one line each on days away and Sick Days. The ways in: the barricade on the canvas (Build C) and the mark on
 * today's cell of the week strip (dayPagerView); Build C adds the barricade itself as a second tap target for the same window.
 *
 * PURE / DOM split like the other UI windows: every word and the markup are pure strings (unit-tested in test/barricadeWindow.test.js,
 * which also checks the numbers against CONFIG.MOMENTUM); `open` touches the DOM (Modal) and is live-checked.
 *
 *   BarricadeWindow.todayLine(info)            -> the one-line status for today
 *   BarricadeWindow.nightLabel(night)          -> "Mon 9" style label for a night
 *   BarricadeWindow.windowHtml(info, opts?)    -> the overlay markup. `info` is Momentum.momentum()'s result.
 *   BarricadeWindow.open(info)                 -> shows it (one at a time)
 *
 * The wording the player was given (Jeremy, 2026-11-11) is SECURE_TEXT; the priority pips explainer uses the same sentence.
 */
const BarricadeWindow = (() => {
    const SECURE_TEXT = "Finish 1 priority or 1 routine to secure today's momentum.";
    const AWAY_TEXT = 'A night counts only when you finish a priority or complete a routine that day. Any other day is missed, whether you opened the game or not, so momentum slides when you are away or do nothing, and rebuilds as you secure days again.';
    const SICK_TEXT = 'A Sick Day is skipped: it is not missed, and the count looks one night further back.';
    const FALLEN_TEXT = 'The barricade has fallen. Finish a priority or a routine to start building it again.';
    const STATUS_WORD = { defended: 'Defended', missed: 'Missed', excused: 'Sick Day' };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /** Today's status line: secured / pending (the approved wording) / a Sick Day. */
    function todayLine(info) {
        const t = info && info.today;
        if (t === 'secured') return "Today is secured. Today's momentum is counted.";
        if (t === 'excused') return 'Today is a Sick Day. It does not count for or against you.';
        return 'Today: not yet secured. ' + SECURE_TEXT;
    }

    /**
     * What the barricade does for damage right now, from the state rows (`damageCut`). A state with a cut says so; otherwise it names the next
     * state that has one. Wording never says a weak barricade adds damage: it does not.
     */
    function damageLine(info, states) {
        const rows = (Array.isArray(states) ? states : []).filter((r) => r && Number(r.damageCut) > 0);
        if (!rows.length || !info || !info.state) return '';
        const pct = (r) => Math.round(r.damageCut * 100);
        const mine = rows.find((r) => r.id === info.state.id);
        if (mine) return `${mine.name}: zombies do ${pct(mine)}% less damage at the church.`;
        const next = rows.slice().sort((a, b) => a.min - b.min)[0];
        return `Reach ${next.name} (${next.min} of ${info.max || 7}) and zombies do ${pct(next)}% less damage at the church.`;
    }

    /** "Mon 9" for a "YYYY-MM-DD" key (local calendar, no timezone drift). */
    function nightLabel(night) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(night && night.date));
        if (!m) return '';
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        return d.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d.getDate();
    }

    /** The barricade fell when the state is None and the latest finished night was missed. */
    function hasFallen(info) {
        if (!info || !info.state || info.state.id !== 'none') return false;
        const closed = (info.nights || []).filter((n) => n.status !== 'excused' && n.date !== info.todayKey);
        if (!closed.length) return false;
        return closed[closed.length - 1].status === 'missed' && info.today !== 'secured';
    }

    function nightsHtml(info) {
        const nights = (info && info.nights) || [];
        if (!nights.length) return '<p class="barricade-empty">No nights yet. Your first night counts when you finish a priority or a routine.</p>';
        return '<ul class="barricade-nights">' + nights.map((n) => {
            const status = STATUS_WORD[n.status] ? n.status : 'missed';
            return '<li class="barricade-night barricade-night--' + status + '"><span class="barricade-night-day">' + esc(nightLabel(n)) +
                '</span><span class="barricade-night-status">' + esc(STATUS_WORD[status]) + '</span></li>';
        }).join('') + '</ul>';
    }

    function windowHtml(info, opts) {
        const i = info || { count: 0, max: 7, state: { id: 'none', name: 'None' }, today: 'pending', nights: [] };
        const o = opts || {};
        const more = (typeof HowItWorks !== 'undefined' && HowItWorks.buttonHtml)
            ? HowItWorks.buttonHtml('momentum', 'How nights and momentum work') : '';
        const dmg = damageLine(i, (typeof CONFIG !== 'undefined' && CONFIG.MOMENTUM) ? CONFIG.MOMENTUM.BARRICADE_STATES : null);
        const fallen = hasFallen(i) ? '<p class="barricade-fallen">' + esc(FALLEN_TEXT) + '</p>' : '';
        return `
            <div class="modal-overlay barricade-overlay">
                <div class="modal-content barricade-panel" role="dialog" aria-label="The Barricade">
                    <h3 class="barricade-title">The Barricade ${more}</h3>
                    <div class="barricade-score barricade-score--${esc(i.state.id)}">
                        <span class="barricade-count">${esc(i.count)} of ${esc(i.max)}</span>
                        <span class="barricade-state">${esc(i.state.name)}</span>
                    </div>
                    <p class="barricade-today barricade-today--${esc(i.today)}">${esc(todayLine(i))}</p>
                    ${dmg ? '<p class="barricade-damage">' + esc(dmg) + '</p>' : ''}
                    ${fallen}
                    <h4 class="barricade-sub">Your last nights</h4>
                    ${nightsHtml(i)}
                    <p class="barricade-note">${esc(AWAY_TEXT)}</p>
                    <p class="barricade-note">${esc(SICK_TEXT)}</p>
                    ${o.extraHtml || ''}
                    <button type="button" class="modal-close-x" data-action="close" aria-label="Close">
                        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>`;
    }

    /** Opens the window (one at a time). The caller that opens it from a tap MUST stopPropagation, or Modal's outside-click sees the same tap. */
    function open(info) {
        const overlay = Modal.open(windowHtml(info), { dedupeSelector: '.barricade-overlay' });
        if (!overlay) return null;
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest ? e.target.closest('[data-action="close"]') : null;
            if (!btn) return;
            e.stopPropagation();
            overlay.remove();
        });
        return overlay;
    }

    return { SECURE_TEXT, AWAY_TEXT, SICK_TEXT, FALLEN_TEXT, todayLine, damageLine, nightLabel, hasFallen, nightsHtml, windowHtml, open, esc };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarricadeWindow;
}
