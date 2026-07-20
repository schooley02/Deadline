/**
 * DayPagerView — DOM wiring for the day pager (Time Slider Week scope,
 * sub-session 2, 2026-07-20 session 71; sequenced/forked session 70, see
 * docs/TIME_SLIDER_WEEK_PLAN.md / DECISIONS.md).
 *
 * Pure ghost conjuring lives in js/dayPager.js (DayPager, bare stable
 * global — clock.js/timeSlider.js precedent); this module only touches the
 * DOM and owns the SESSION-ONLY viewed-day-offset state (never persisted,
 * resets to 0/Today on every page load — fork/scope guard, session 70).
 *
 * SCOPE: offset -1 (yesterday, STATIC snapshot — sub-session 3, 2026-07-20
 * session 72) .. +6 (six days ahead, ghosted preview — sub-session 2).
 * Yesterday is NOT hour-scrubbable (see js/dayPager.js's yesterday-snapshot
 * header for why — completion TIMES aren't stored anywhere) — the hour
 * slider is disabled at that offset, re-enabled everywhere else.
 *
 * NON-MUTATING CONTRACT (fork/scope guard, session 70 — "the whole feature
 * stays non-mutating under the session-63 contract"): entering a non-today
 * page calls the SAME `setTimePreviewActive(true)` flag the hour-scrub
 * slider uses (js/ui/timeSliderView.js) — js/loop.js's updateActiveItems
 * already early-returns on that flag, so paging away from Today freezes
 * damage/regen/position writes with NO changes to loop.js's guard itself.
 * Returning to Today flips it back false. HP PROJECTION STAYS TODAY-ONLY
 * (fork 4): this module never calls TimeSliderView's damage-preview path,
 * so future-day pages show scheduled ghosts only, never a projected HP
 * number.
 *
 * REAL BOARD IS HIDDER, NOT REPLACED: while off Today, the game canvas gets
 * a `.viewing-other-day` class (css/dayPager.css hides real `.enemy`
 * sprites via that class, leaving `.day-pager-ghost` sprites and the
 * base/hero chips — which are DELIBERATELY untouched, fork 4 — visible).
 * The real agenda list's innerHTML is swapped for read-only ghost rows and
 * restored via `deps.renderTodayAgenda()` (script.js's existing
 * sortAndRenderActiveList wrapper) on return to Today — no parallel
 * rendering path to keep in sync.
 *
 * GHOST SPRITES ARE NOT SUB-TASK-AWARE (known v1 simplification): ghosts are
 * positioned via plain Clock.calculateTimelinePosition, not the clustering
 * math real sub-tasks use (Movement.calculateTimelineXWithClustering
 * expects live siblings already positioned in activeItems, which ghosts
 * aren't part of) — a future day's sub-task ghosts render at their own
 * timeline position rather than fanned next to a parent ghost.
 *
 * ROLLOVER-WHILE-PARKED (scope guard, session 70): `checkRolloverReset` is
 * called EVERY tick regardless of preview state (js/loop.js's updateGame,
 * before its early returns — see that file's header) so a session left
 * open on a future-day page through midnight snaps back to Today (offset 0)
 * the moment currentGameDate actually advances, rather than staying parked
 * on what's now a stale offset. Re-derives (goToOffset(0)) rather than
 * trying to reconcile the old anchor day.
 *
 * Deps contract (see script.js's dayPagerViewDeps()):
 *   - prevBtn, nextBtn, labelEl, taskSectionTitleEl: DOM handles.
 *   - gameCanvasEl: DOM handle — gets `.viewing-other-day` toggled, ghost
 *     sprites appended/removed here.
 *   - activeItemsListEl: DOM handle — the real agenda <ul>, innerHTML
 *     swapped for ghost rows while off Today.
 *   - getCurrentGameDate(): () => Date — script.js's currentGameDate
 *     (reassigned on rollover, so a GETTER, not a plain reference).
 *   - getDefinedHabits/getDefinedRoutines/getDefinedTasks/getCompletedItems/
 *     getActiveItems/getSickDayDate: getters (all reassigned on
 *     restore/reset except activeItems, which stays a getter here too for
 *     symmetry with the others — no functional difference).
 *   - dims(): () => ({ gameScreenWidth, baseWidth, enemyWidth,
 *     habitEnemyWidth }) — same shape as timeSliderDeps()'s dims().
 *   - setTimePreviewActive(bool): the SAME flag timeSliderDeps() flips.
 *   - renderTodayAgenda(): () => void — script.js's sortAndRenderActiveList
 *     wrapper, called on return to Today to restore the real list.
 *   - timeSliderEl: DOM handle (sub-session 3) — disabled while viewing
 *     Yesterday (offset -1), re-enabled everywhere else.
 *   - weekStripRowEl: DOM handle (sub-session 4) — the 7-cell overview row,
 *     rebuilt from DayPager.weekStripSummary on every render() (Today
 *     included, unlike the ghost-agenda path — see renderWeekStrip).
 */
const DayPagerView = (() => {
    let deps = null;
    let viewedDayOffset = 0;
    let anchorDateString = null; // currentGameDate.toDateString() at the moment paging started; null while on Today

    function isViewingToday() {
        return viewedDayOffset === 0;
    }

    function getViewedDayOffset() {
        return viewedDayOffset;
    }

    // Human day label — "Yesterday", "Today", "Tomorrow", or
    // "<Weekday> · <Mon D>" for offset 2+.
    function formatDayLabel(offset, bounds) {
        if (offset === -1) return 'Yesterday';
        if (offset === 0) return 'Today';
        if (offset === 1) return 'Tomorrow';
        const weekday = bounds.start.toLocaleDateString('en-US', { weekday: 'short' });
        const month = bounds.start.toLocaleDateString('en-US', { month: 'short' });
        return `${weekday} · ${month} ${bounds.start.getDate()}`;
    }

    // Outcome -> { icon, label, cssClass } for the snapshot's read-only rows
    // and ghost sprites. 'unknown' (no occurrenceHistory entry — the habit
    // didn't exist yet, or predates tracking) gets a neutral treatment, not
    // a red one — an absent record isn't a failure.
    function outcomeBadge(outcome) {
        switch (outcome) {
            case 'completed': return { icon: '✓', label: 'Completed', cssClass: 'outcome-completed' };
            case 'avoided': return { icon: '✓', label: 'Avoided', cssClass: 'outcome-completed' };
            case 'missed': return { icon: '✕', label: 'Missed', cssClass: 'outcome-missed' };
            case 'indulged': return { icon: '✕', label: 'Indulged', cssClass: 'outcome-missed' };
            default: return { icon: '—', label: 'No record', cssClass: 'outcome-unknown' };
        }
    }

    function clearGhostSprites() {
        if (!deps.gameCanvasEl) return;
        deps.gameCanvasEl.querySelectorAll('.day-pager-ghost').forEach(el => el.remove());
    }

    function buildGhostSprite(ghost, previewTime, ghostList, index) {
        const dims = deps.dims();
        const el = document.createElement('div');
        el.classList.add('enemy', 'day-pager-ghost', 'time-preview-ghost');
        el.classList.add(`category-${ghost.category}`);
        el.classList.add('zombie-sprite', `zombie-${ghost.category}`);

        const width = ghost.isHabit ? dims.habitEnemyWidth : dims.enemyWidth;
        const height = ghost.isHabit ? 70 : 128;
        el.style.width = width + 'px';
        el.style.height = height + 'px';
        if (ghost.isHabit) {
            el.classList.add('habit-enemy', 'zombie-small');
            if (ghost.isNegative) el.classList.add('negative-habit');
        }

        const x = Clock.calculateTimelinePosition({ type: ghost.isHabit ? 'habit' : 'task', dueDateTime: ghost.dueTime }, previewTime, dims);
        el.style.left = Math.max(dims.baseWidth, x) + 'px';
        // Simple deterministic vertical spread (no live canvas-height read
        // needed for a read-only preview) — index-based, capped so ghosts
        // never stack past a reasonable band.
        el.style.top = (20 + (index % 5) * 40) + 'px';

        // Yesterday snapshot entries carry an `outcome` (sub-session 3) —
        // future-day ghosts never do, so this is a no-op for those.
        if (ghost.outcome) {
            const badge = outcomeBadge(ghost.outcome);
            el.classList.add(badge.cssClass);
            const badgeEl = document.createElement('span');
            badgeEl.className = 'day-pager-outcome-icon';
            badgeEl.textContent = badge.icon;
            el.appendChild(badgeEl);
            el.title = `${ghost.name} — ${badge.label}`;
        } else {
            el.title = `${ghost.name} — ${TimeSlider.formatLabel(ghost.dueTime)}`;
        }

        return el;
    }

    function renderGhostCanvas(ghosts, previewTime) {
        clearGhostSprites();
        if (!deps.gameCanvasEl) return;
        ghosts.forEach((ghost, i) => {
            deps.gameCanvasEl.appendChild(buildGhostSprite(ghost, previewTime, ghosts, i));
        });
    }

    // `emptyMessage` differs between the future-day ghost agenda ("Nothing
    // scheduled") and the yesterday snapshot ("Nothing was scheduled") —
    // caller-supplied so this one renderer serves both (sub-session 3).
    function renderGhostAgenda(ghosts, emptyMessage) {
        if (!deps.activeItemsListEl) return;
        if (ghosts.length === 0) {
            deps.activeItemsListEl.innerHTML = `<li class="ghost-agenda-empty">${emptyMessage}</li>`;
            return;
        }
        deps.activeItemsListEl.innerHTML = ghosts.map(ghost => {
            const outcomeHtml = ghost.outcome ? (() => {
                const badge = outcomeBadge(ghost.outcome);
                return `<span class="day-pager-outcome-badge ${badge.cssClass}">${badge.icon} ${badge.label}</span>`;
            })() : `<span class="ghost-agenda-time">${TimeSlider.formatLabel(ghost.dueTime)}</span>`;
            return `
            <li class="ghost-agenda-row">
                <div>
                    <span class="ghost-agenda-name">${ghost.name}</span>
                    <span class="ghost-agenda-meta">${ghost.category}${ghost.isHabit ? ' · habit' : ''}</span>
                </div>
                ${outcomeHtml}
            </li>
        `;
        }).join('');
    }

    // Week strip (sub-session 4, phase 2) — 7 tappable cells, one per
    // offset 0..MAX_OFFSET, ALWAYS built from a fresh DayPager.weekStripSummary
    // call so it can never drift from whatever the pager itself is showing.
    // Delegated click (assigned, not addEventListener — same re-open-safe
    // pattern as statsView.js's run-card expansion) reads the offset off
    // each cell's data attribute and jumps the pager straight there.
    function renderWeekStrip() {
        if (!deps.weekStripRowEl) return;
        const currentGameDate = deps.getCurrentGameDate();
        const summary = DayPager.weekStripSummary({
            definedHabits: deps.getDefinedHabits(),
            definedRoutines: deps.getDefinedRoutines(),
            definedTasks: deps.getDefinedTasks(),
            activeItems: deps.getActiveItems(),
            completedItems: deps.getCompletedItems(),
            sickDayDate: deps.getSickDayDate ? deps.getSickDayDate() : null,
        }, currentGameDate);

        deps.weekStripRowEl.innerHTML = summary.map(entry => {
            const weekday = entry.offset === 0
                ? 'Today'
                : entry.dayStart.toLocaleDateString('en-US', { weekday: 'short' });
            const classes = ['week-strip-cell'];
            if (entry.offset === 0) classes.push('week-strip-today');
            if (entry.offset === viewedDayOffset) classes.push('week-strip-active');
            if (entry.isHeavy) classes.push('week-strip-heavy');
            const priorityHtml = entry.highPriorityCount > 0
                ? `<span class="week-strip-priority">★${entry.highPriorityCount}</span>`
                : '';
            return `
                <button type="button" class="${classes.join(' ')}" data-offset="${entry.offset}"
                        aria-label="${weekday}, ${entry.totalCount} item${entry.totalCount === 1 ? '' : 's'}${entry.highPriorityCount ? `, ${entry.highPriorityCount} high priority` : ''}${entry.isHeavy ? ', heavier than usual' : ''}">
                    <span class="week-strip-weekday">${weekday}</span>
                    <span class="week-strip-count">${entry.totalCount}</span>
                    ${priorityHtml}
                </button>
            `;
        }).join('');

        deps.weekStripRowEl.onclick = (e) => {
            const cell = e.target.closest('.week-strip-cell');
            if (!cell || !deps.weekStripRowEl.contains(cell)) return;
            goToOffset(Number(cell.dataset.offset));
        };
    }

    // Renders whatever `viewedDayOffset` currently is. Called after every
    // state change (goToOffset) — never call render() directly from outside
    // without going through goToOffset first, or the label/button-disabled
    // state can drift from the offset it's describing.
    function render() {
        const currentGameDate = deps.getCurrentGameDate();
        const bounds = DayPager.dayBoundsForOffset(currentGameDate, viewedDayOffset);

        renderWeekStrip();

        if (deps.labelEl) deps.labelEl.textContent = formatDayLabel(viewedDayOffset, bounds);
        if (deps.prevBtn) deps.prevBtn.disabled = (viewedDayOffset <= DayPager.MIN_OFFSET);
        if (deps.nextBtn) deps.nextBtn.disabled = (viewedDayOffset >= DayPager.MAX_OFFSET);
        // Yesterday is NOT hour-scrubbable (sub-session 3 — see file
        // header); the slider is otherwise enabled (Today's live-tracking
        // behavior, and future days' fixed-noon-anchor preview, both use it).
        if (deps.timeSliderEl) deps.timeSliderEl.disabled = (viewedDayOffset === DayPager.MIN_OFFSET);

        if (isViewingToday()) {
            if (deps.gameCanvasEl) deps.gameCanvasEl.classList.remove('viewing-other-day');
            clearGhostSprites();
            if (deps.taskSectionTitleEl) deps.taskSectionTitleEl.textContent = "Today's Deadlines";
            deps.setTimePreviewActive(false);
            if (deps.renderTodayAgenda) deps.renderTodayAgenda();
            return;
        }

        deps.setTimePreviewActive(true);
        if (deps.gameCanvasEl) deps.gameCanvasEl.classList.add('viewing-other-day');
        if (deps.taskSectionTitleEl) {
            deps.taskSectionTitleEl.textContent = formatDayLabel(viewedDayOffset, bounds) + "'s Deadlines";
        }

        const conjureDeps = {
            definedHabits: deps.getDefinedHabits(),
            definedRoutines: deps.getDefinedRoutines(),
            definedTasks: deps.getDefinedTasks(),
            activeItems: deps.getActiveItems(),
            completedItems: deps.getCompletedItems(),
            sickDayDate: deps.getSickDayDate ? deps.getSickDayDate() : null,
        };

        if (viewedDayOffset === DayPager.MIN_OFFSET) {
            // Yesterday: a STATIC snapshot, not a live-preview-time ghost
            // board — every entry already carries its own resolved outcome,
            // so there's no single "preview anchor" hour to compute (see
            // js/dayPager.js's yesterday-snapshot header). All entries
            // render at once, each labeled with its outcome badge instead
            // of a due time.
            const snapshot = DayPager.conjureYesterdaySnapshot(conjureDeps, currentGameDate);
            renderGhostCanvas(snapshot, bounds.start);
            renderGhostAgenda(snapshot, 'Nothing was scheduled');
            return;
        }

        const ghosts = DayPager.conjureGhostsForDay(conjureDeps, currentGameDate, viewedDayOffset);

        // Preview anchor: noon of the viewed day (a stable, representative
        // hour — see file header's "not fully hour-scrubbable this
        // sub-session" note). Every ghost that's due before noon renders
        // camped at the base like an overdue item would; due-after-noon
        // ghosts spread out toward the right edge by time-to-due, same
        // interpolation Today scope already uses.
        const previewTime = new Date(bounds.start);
        previewTime.setHours(12, 0, 0, 0);

        renderGhostCanvas(ghosts, previewTime);
        renderGhostAgenda(ghosts, 'Nothing scheduled');
    }

    function goToOffset(offset) {
        const clamped = DayPager.clampDayOffset(offset);
        viewedDayOffset = clamped;
        anchorDateString = (clamped !== 0) ? deps.getCurrentGameDate().toDateString() : null;
        render();
    }

    function stepDay(delta) {
        goToOffset(viewedDayOffset + delta);
    }

    // Called EVERY tick (js/loop.js's updateGame, unconditionally — see that
    // file's header) so a session left parked on a future-day page through
    // a real midnight crossing re-derives rather than staying stale. A no-op
    // while already on Today (anchorDateString is null there).
    function checkRolloverReset() {
        if (anchorDateString === null) return;
        const nowDateString = deps.getCurrentGameDate().toDateString();
        if (nowDateString !== anchorDateString) {
            goToOffset(0);
        }
    }

    function init(injectedDeps) {
        deps = injectedDeps;
        if (deps.prevBtn) deps.prevBtn.addEventListener('click', () => stepDay(-1));
        if (deps.nextBtn) deps.nextBtn.addEventListener('click', () => stepDay(1));
        render();
    }

    return {
        init,
        goToOffset,
        stepDay,
        getViewedDayOffset,
        isViewingToday,
        checkRolloverReset,
        formatDayLabel,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayPagerView;
}
