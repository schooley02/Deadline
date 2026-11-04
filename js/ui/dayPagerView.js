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
 * Since 2026-11-04 (Jeremy) every day is hour-scrubbable, Yesterday too:
 * the slider starts at 12:00 AM of the viewed day and a drag walks that
 * day's ghosts (previewGhostsAt). Yesterday's beaten ghosts leave the field
 * at their completedAt (`doneAt`). Ghosts are tappable: a read-only card
 * (js/ui/ghostCard.js) says which zombie it is (optional deps
 * `openItemCard(itemId)` for a live one-off's "Open task" button, and
 * `onTodayShown(fromOtherDay)` = TimeSliderView.onTodayShown).
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
 *   - timeSliderEl: DOM handle (sub-session 3) — kept enabled on every
 *     day (it was disabled on Yesterday until 2026-11-04).
 *   - weekStripRowEl: DOM handle (sub-session 4) — the 7-cell overview row,
 *     rebuilt from DayPager.weekStripSummary on every render() (Today
 *     included, unlike the ghost-agenda path — see renderWeekStrip).
 *   - listScrollEl: DOM handle (2026-11-03) — the scrolling list box
 *     (.task-list-container); see CONTINUOUS LIST below.
 *
 * CONTINUOUS LIST (2026-11-03, Jeremy): in the pinned layout (everything except
 * phone landscape — see CONTINUOUS_QUERY and css/dayPager.css) the agenda is ONE
 * scrolling list under a fixed top (canvas, week strip, slider). Today's real
 * rows stay in #activeItemsList (untouched, still owned by AgendaList); after
 * them (and the Completed Today block) this module appends #dayListFuture: one
 * section per later day (offsets +1..+6) with a divider and the read-only ghost
 * rows. Scrolling a day's divider to the top of the list makes that day active:
 * the week-strip button, header text and canvas switch to it AT ONCE (option 2;
 * the calmer "after scrolling stops" variant is the fallback if it feels busy).
 * Tapping a week-strip button / the pager arrows scrolls the list to that day's
 * divider; scroll-driven switching is paused until that scroll settles
 * (scrollLocked), or the two would fight. Yesterday (offset -1) is still the
 * static snapshot that REPLACES the list, and phone landscape keeps the old
 * one-day-at-a-time pager, exactly as before. The active-day rule is the pure
 * DayPager.activeOffsetFromTops.
 */
const DayPagerView = (() => {
    let deps = null;
    let viewedDayOffset = 0;
    let anchorDateString = null; // currentGameDate.toDateString() at the moment paging started; null while on Today

    // Pinned (continuous) layout = every size EXCEPT phone landscape (the
    // canvas fills that screen, so the list there keeps the old pager).
    // KEEP IN SYNC with the @media block at the end of css/dayPager.css.
    const CONTINUOUS_QUERY = 'not all and (orientation: landscape) and (max-height: 500px)';
    const LOCK_QUIET_MS = 150;     // scroll events this far apart = the programmatic scroll has settled
    const LOCK_START_MS = 300;     // grace before the first scroll event of a programmatic scroll
    const LOCK_MAX_MS = 1500;      // hard cap, so a lock can never stick
    let continuousMq = null;
    let futureEl = null;           // #dayListFuture (continuous mode only)
    let lastFutureHtml = null;     // skip rewriting the sections when nothing changed
    let listShowsSwapped = false;  // #activeItemsList currently holds ghost/snapshot rows, not Today's real ones
    let lastRenderedOffset = 0;
    let scrollLocked = false;
    let lockTimer = null;
    let lockStartedAt = 0;
    let syncRaf = 0;
    let resizeObserver = null;

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

    // Divider text for a later day's section in the continuous list. Tomorrow
    // also spells out its date ("Tomorrow · Wed Nov 4"); later days already
    // carry theirs ("Thu · Nov 5").
    function formatDividerLabel(offset, bounds) {
        if (offset === 1) {
            const weekday = bounds.start.toLocaleDateString('en-US', { weekday: 'short' });
            const month = bounds.start.toLocaleDateString('en-US', { month: 'short' });
            return `Tomorrow · ${weekday} ${month} ${bounds.start.getDate()}`;
        }
        return formatDayLabel(offset, bounds);
    }

    // Task and habit names are the player's own text, so the ghost rows escape
    // them (the old pager markup dropped them in raw).
    function escapeText(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
        ));
    }

    // Outcome -> { icon, label, cssClass } for the snapshot's read-only rows
    // and ghost sprites. 'unknown' (no occurrenceHistory entry — the habit
    // didn't exist yet, or predates tracking) gets a neutral treatment, not
    // a red one — an absent record isn't a failure.
    function outcomeBadge(outcome) {
        switch (outcome) {
            case 'completed': return { icon: '✓', label: 'Completed', cssClass: 'outcome-completed' };
            case 'avoided': return { icon: '✓', label: 'Resisted', cssClass: 'outcome-completed' };
            case 'missed': return { icon: '✕', label: 'Missed', cssClass: 'outcome-missed' };
            case 'indulged': return { icon: '✕', label: 'Slipped', cssClass: 'outcome-missed' };
            default: return { icon: '—', label: 'No record', cssClass: 'outcome-unknown' };
        }
    }

    function clearGhostSprites() {
        shownGhosts = [];
        if (!deps.gameCanvasEl) return;
        deps.gameCanvasEl.querySelectorAll('.day-pager-ghost').forEach(el => el.remove());
    }

    // Horizontal spot for a ghost when the viewed day's clock reads `previewTime` (the same timeline math live
    // zombies use). Split out so the slider can slide a day's ghosts without rebuilding them (2026-11-03).
    // Yesterday (2026-11-04, Jeremy): a ghost that was beaten (Completed / Resisted, `doneAt`) leaves the field once the
    // slider passes the moment it was beaten; a missed one stays at the church with its ✕.
    function positionGhostSprite(el, ghost, previewTime) {
        const dims = deps.dims();
        const x = Clock.calculateTimelinePosition({ type: ghost.isHabit ? 'habit' : 'task', dueDateTime: ghost.dueTime, startDateTime: ghost.startTime || null }, previewTime, dims);
        el.style.left = Math.max(dims.baseWidth, x) + 'px';
        const gone = ghost.doneAt != null && previewTime.getTime() >= ghost.doneAt;
        el.classList.toggle('ghost-done', gone);
    }

    function buildGhostSprite(ghost, previewTime, ghostList, index) {
        const dims = deps.dims();
        const el = document.createElement('div');
        el.classList.add('enemy', 'day-pager-ghost', 'time-preview-ghost');
        el.classList.add(`category-${ghost.category}`);
        el.classList.add('zombie-sprite', `zombie-${ghost.category}`);

        const width = ghost.isHabit ? dims.habitEnemyWidth : dims.enemyWidth;
        // 2026-07-21: habit ghosts render at regular (128) size now, matching
        // spawning.js's resolveEnemyVisual — see docs/DECISIONS.md.
        const height = 128;
        el.style.width = width + 'px';
        el.style.height = height + 'px';
        if (ghost.isHabit) {
            el.classList.add('habit-enemy');
            if (ghost.isNegative) el.classList.add('negative-habit');
        }

        positionGhostSprite(el, ghost, previewTime);
        // Vertical placement: stand on the V1 ground band like live zombies
        // do (Movement.getItemTopPosition), spread deterministically by index
        // across the band so ghosts don't stack. (Was a fixed 20-180px offset,
        // which floated ghosts in the sky; fixed 2026-10-12.) Falls back to
        // the old spread when the canvas height isn't measurable.
        const canvasH = deps.gameCanvasEl ? deps.gameCanvasEl.offsetHeight : 0;
        if (canvasH > 0 && typeof CONFIG !== 'undefined' && CONFIG.GROUND_BAND_FEET_TOP_FRAC != null) {
            const feetTop = CONFIG.GROUND_BAND_FEET_TOP_FRAC * canvasH;
            const feetBottom = CONFIG.GROUND_BAND_FEET_BOTTOM_FRAC * canvasH;
            const feet = feetTop + ((index % 5) / 4) * (feetBottom - feetTop);
            el.style.top = Math.max(0, Math.min(feet - height, canvasH - height)) + 'px';
        } else {
            el.style.top = (20 + (index % 5) * 40) + 'px';
        }
        // Same animated sprite as live zombies (paused on frame 0 by the
        // .time-preview-ghost rule in css/enemyAnim.css).
        if (typeof SpriteAnim !== 'undefined') SpriteAnim.attach(el, width);

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

        // Tap a ghost to see which zombie it is (2026-11-04, Jeremy). stopPropagation: Modal's document click handler
        // would otherwise close the card in the same click.
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', ghost.name);
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showGhostCard(ghost, el);
        });

        return el;
    }

    // The agenda row that belongs to `ghost` on the day on screen (paged list, or that day's section in the
    // continuous list), or null.
    function ghostRowFor(ghost) {
        let scope = null;
        if (isContinuous() && viewedDayOffset > 0 && futureEl) {
            scope = futureEl.querySelector(`.day-list-section[data-offset="${viewedDayOffset}"]`);
        } else {
            scope = deps.activeItemsListEl;
        }
        if (!scope) return null;
        return Array.from(scope.querySelectorAll('.ghost-agenda-row')).find(row => row.dataset.ghostKey === ghost.key) || null;
    }

    function clearGhostSelection() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.ghost-agenda-row--selected').forEach(r => r.classList.remove('ghost-agenda-row--selected'));
        document.querySelectorAll('.day-pager-ghost.ghost-selected').forEach(g => g.classList.remove('ghost-selected'));
    }

    // Opens the read-only ghost card (js/ui/ghostCard.js) and marks the sprite + its list row until it closes.
    function showGhostCard(ghost, spriteEl) {
        clearGhostSelection();
        if (spriteEl) spriteEl.classList.add('ghost-selected');
        const row = ghostRowFor(ghost);
        if (row) {
            row.classList.add('ghost-agenda-row--selected');
            if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
        }
        if (typeof GhostCard === 'undefined') return;
        const bounds = DayPager.dayBoundsForOffset(deps.getCurrentGameDate(), viewedDayOffset);
        const routines = deps.getDefinedRoutines ? (deps.getDefinedRoutines() || []) : [];
        const routine = ghost.routineId != null ? routines.find(r => r.id === ghost.routineId) : null;
        const live = ghost.itemId != null && (deps.getActiveItems() || []).some(i => i.id === ghost.itemId);
        GhostCard.open(ghost, {
            dayLabel: formatDayLabel(viewedDayOffset, bounds),
            routineName: routine ? routine.name : '',
            canOpen: live && typeof deps.openItemCard === 'function',
            onOpen: (itemId) => deps.openItemCard(itemId),
            onClose: clearGhostSelection,
        });
    }

    // The ghosts currently on the canvas, in sprite order (so a scrub can reposition them by index).
    let shownGhosts = [];

    function renderGhostCanvas(ghosts, previewTime) {
        clearGhostSprites();
        shownGhosts = ghosts.slice();
        if (!deps.gameCanvasEl) return;
        ghosts.forEach((ghost, i) => {
            deps.gameCanvasEl.appendChild(buildGhostSprite(ghost, previewTime, ghosts, i));
        });
    }

    // The <li> rows for one day's ghosts (or the single empty-state <li>).
    // Shared by the paged agenda swap, the yesterday snapshot and the
    // continuous list's later-day sections. `emptyMessage` differs between
    // them ("Nothing scheduled" / "Nothing was scheduled").
    function ghostRowsHtml(ghosts, emptyMessage) {
        if (!ghosts || ghosts.length === 0) {
            return `<li class="ghost-agenda-empty">${escapeText(emptyMessage)}</li>`;
        }
        return ghosts.map(ghost => {
            const outcomeHtml = ghost.outcome ? (() => {
                const badge = outcomeBadge(ghost.outcome);
                return `<span class="day-pager-outcome-badge ${badge.cssClass}">${badge.icon} ${badge.label}</span>`;
            })() : `<span class="ghost-agenda-time">${ghost.anytime ? 'Midnight' : TimeSlider.formatLabel(ghost.dueTime)}</span>`;
            return `
            <li class="ghost-agenda-row" data-ghost-key="${escapeText(ghost.key || '')}">
                <div>
                    <span class="ghost-agenda-name">${escapeText(ghost.name)}</span>
                    <span class="ghost-agenda-meta">${escapeText(ghost.category)}${ghost.isHabit ? ' · habit' : ''}</span>
                </div>
                ${outcomeHtml}
            </li>
        `;
        }).join('');
    }

    // Markup for the continuous list's later days: one section per entry of
    // [{ offset, label, ghosts }], a divider heading then the ghost rows. A day
    // with nothing keeps its section (and says so) so the list matches the
    // week-strip buttons one to one.
    function futureSectionsHtml(sections) {
        return (sections || []).map(section => `
            <section class="day-list-section" data-offset="${section.offset}">
                <h3 class="day-list-divider">${escapeText(section.label)}</h3>
                <ul class="task-list day-list-ghosts">${ghostRowsHtml(section.ghosts, 'Nothing scheduled')}</ul>
            </section>`).join('');
    }

    function renderGhostAgenda(ghosts, emptyMessage) {
        if (!deps.activeItemsListEl) return;
        listShowsSwapped = true;
        deps.activeItemsListEl.innerHTML = ghostRowsHtml(ghosts, emptyMessage);
    }

    function conjureDeps() {
        return {
            definedHabits: deps.getDefinedHabits(),
            definedRoutines: deps.getDefinedRoutines(),
            definedTasks: deps.getDefinedTasks(),
            activeItems: deps.getActiveItems(),
            completedItems: deps.getCompletedItems(),
            sickDayDate: deps.getSickDayDate ? deps.getSickDayDate() : null,
        };
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
            const isActive = entry.offset === viewedDayOffset;
            if (isActive) classes.push('week-strip-active');
            if (entry.isHeavy) classes.push('week-strip-heavy');
            const priorityHtml = entry.highPriorityCount > 0
                ? `<span class="week-strip-priority">★${entry.highPriorityCount}</span>`
                : '';
            // aria-current on the actively-viewed cell (MOBILE_PWA_PLAN.md
            // sub-session 2) — the selected day was CSS-only (.week-strip-active),
            // invisible to assistive tech otherwise.
            return `
                <button type="button" class="${classes.join(' ')}" data-offset="${entry.offset}"
                        ${isActive ? 'aria-current="true"' : ''}
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

    // ---------------------------------------------------------------------
    // Continuous list (2026-11-03) — see CONTINUOUS LIST in the file header.
    // ---------------------------------------------------------------------

    function isContinuous() {
        return !!(continuousMq && continuousMq.matches && futureEl && deps && deps.listScrollEl);
    }

    // Single place that moves the viewed day (the rollover guard needs the
    // anchor date set whenever we are off Today).
    function setOffsetState(offset) {
        viewedDayOffset = DayPager.clampDayOffset(offset);
        anchorDateString = (viewedDayOffset !== 0) ? deps.getCurrentGameDate().toDateString() : null;
    }

    // The last section has to be able to reach the TOP of the list, or a short
    // final day could never become the active one by scrolling: its min-height
    // is the list box's own height (css: .day-list-section:last-child).
    function updateViewportPad() {
        if (!futureEl || !deps.listScrollEl) return;
        const h = deps.listScrollEl.clientHeight;
        if (h > 0) futureEl.style.setProperty('--day-list-viewport-h', h + 'px');
    }

    // Rebuild the later-day sections from the definitions. Called on every
    // render and from refreshWeekStrip (script.js's shared updateTaskCountDisplay
    // runs after every task / habit / routine change), but the DOM is only
    // touched when the markup actually changed.
    function renderFutureSections() {
        if (!futureEl) return;
        const currentGameDate = deps.getCurrentGameDate();
        const cd = conjureDeps();
        const sections = [];
        for (let offset = 1; offset <= DayPager.MAX_OFFSET; offset++) {
            const bounds = DayPager.dayBoundsForOffset(currentGameDate, offset);
            sections.push({
                offset,
                label: formatDividerLabel(offset, bounds),
                ghosts: DayPager.conjureGhostsForDay(cd, currentGameDate, offset),
            });
        }
        const html = futureSectionsHtml(sections);
        updateViewportPad();
        if (html === lastFutureHtml) return;
        lastFutureHtml = html;
        futureEl.innerHTML = html;
        scheduleSync(); // the sections moved; re-check which day owns the top
    }

    // Where each day's section starts, measured from the top of the scrolled
    // content (Today is the top). Reads layout, so only call it from the
    // scroll / sync paths.
    function dividerTops() {
        const box = deps.listScrollEl;
        if (!box || !futureEl) return [];
        const origin = box.getBoundingClientRect().top - box.scrollTop;
        const tops = [{ offset: 0, top: 0 }];
        futureEl.querySelectorAll('.day-list-section').forEach(section => {
            tops.push({ offset: Number(section.dataset.offset), top: section.getBoundingClientRect().top - origin });
        });
        return tops;
    }

    // Scroll-driven switching is paused while WE are scrolling the list (a
    // button tap), or the active day would flicker through every day between.
    // It releases once scroll events go quiet, with a hard cap.
    function armLockRelease(ms) {
        clearTimeout(lockTimer);
        const remaining = LOCK_MAX_MS - (Date.now() - lockStartedAt);
        lockTimer = setTimeout(releaseLock, Math.max(0, Math.min(ms, remaining)));
    }

    function lockScroll() {
        scrollLocked = true;
        lockStartedAt = Date.now();
        armLockRelease(LOCK_START_MS);
    }

    function releaseLock() {
        scrollLocked = false;
        lockTimer = null;
        syncFromScroll(); // settle on whatever day the list really ended on
    }

    function scheduleSync() {
        if (syncRaf || !deps) return;
        if (typeof requestAnimationFrame === 'function') syncRaf = requestAnimationFrame(syncFromScroll);
    }

    // Scroll position -> active day. Sets the viewed day WITHOUT scrolling
    // (the list is already where the player put it).
    function syncFromScroll() {
        syncRaf = 0;
        if (scrollLocked || !deps || !isContinuous() || viewedDayOffset === DayPager.MIN_OFFSET) return;
        const offset = DayPager.activeOffsetFromTops(dividerTops(), deps.listScrollEl.scrollTop);
        if (offset === viewedDayOffset) return;
        setOffsetState(offset);
        render();
    }

    function onListScroll() {
        if (scrollLocked) { armLockRelease(LOCK_QUIET_MS); return; }
        scheduleSync();
    }

    function scrollToOffset(offset, smooth) {
        const box = deps.listScrollEl;
        if (!box) return;
        let top = 0;
        if (offset > 0) {
            const entry = dividerTops().find(e => e.offset === offset);
            if (!entry) return;
            top = entry.top;
        }
        top = Math.max(0, Math.min(top, box.scrollHeight - box.clientHeight));
        lockScroll();
        const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (typeof box.scrollTo === 'function') box.scrollTo({ top, behavior: (smooth && !reduce) ? 'smooth' : 'auto' });
        else box.scrollTop = top;
    }

    // Header row + week strip + pager arrows + slider: identical in both modes.
    function renderChrome(bounds) {
        renderWeekStrip();

        if (deps.labelEl) deps.labelEl.textContent = formatDayLabel(viewedDayOffset, bounds);
        if (deps.prevBtn) deps.prevBtn.disabled = (viewedDayOffset <= DayPager.MIN_OFFSET);
        if (deps.nextBtn) deps.nextBtn.disabled = (viewedDayOffset >= DayPager.MAX_OFFSET);
        // Every day can be scrubbed (2026-11-04, Jeremy: Yesterday's ghosts follow the slider too; it used to be
        // disabled there). Kept as an explicit enable so a stale disabled attribute never sticks.
        if (deps.timeSliderEl) deps.timeSliderEl.disabled = false;
    }

    // Renders whatever `viewedDayOffset` currently is. Called after every
    // state change (goToOffset) — never call render() directly from outside
    // without going through goToOffset first, or the label/button-disabled
    // state can drift from the offset it's describing.
    function render() {
        const currentGameDate = deps.getCurrentGameDate();
        const bounds = DayPager.dayBoundsForOffset(currentGameDate, viewedDayOffset);
        const continuous = isContinuous() && viewedDayOffset !== DayPager.MIN_OFFSET;

        if (futureEl) futureEl.classList.toggle('day-pager-hidden', !continuous);
        renderChrome(bounds);

        const previousOffset = lastRenderedOffset;
        lastRenderedOffset = viewedDayOffset;
        if (continuous) renderContinuous(bounds, currentGameDate, previousOffset);
        else renderPaged(bounds, currentGameDate, previousOffset);
    }

    // Continuous mode: Today's real rows are never swapped out (AgendaList owns
    // them); only the canvas, header text and time-preview flag follow the day.
    function renderContinuous(bounds, currentGameDate, previousOffset) {
        // Back from the yesterday snapshot (or a layout change): Today's rows
        // were replaced by ghost rows, so put the real list back first.
        const restoreToday = listShowsSwapped;
        if (restoreToday && deps.renderTodayAgenda) {
            listShowsSwapped = false;
            deps.renderTodayAgenda();
        }
        // Yesterday's page showed yesterday's completions; Today's go back (no-op if unchanged).
        if (restoreToday && deps.renderCompletedItems) deps.renderCompletedItems();
        // "Completed Today" is Today's own block and stays in the list.
        if (deps.completedTasksSectionEl) deps.completedTasksSectionEl.classList.remove('day-pager-hidden');
        renderFutureSections();

        if (isViewingToday()) {
            if (deps.gameCanvasEl) deps.gameCanvasEl.classList.remove('viewing-other-day');
            clearGhostSprites();
            if (deps.taskSectionTitleEl) deps.taskSectionTitleEl.textContent = "Today's Deadlines";
            todayShown(previousOffset !== 0);
            // Live play was paused while another day was shown: refresh the
            // real rows once on the way back.
            if (!restoreToday && previousOffset !== 0 && deps.renderTodayAgenda) deps.renderTodayAgenda();
            if (deps.updateTaskCountDisplay) deps.updateTaskCountDisplay();
            return;
        }

        deps.setTimePreviewActive(true);
        if (deps.gameCanvasEl) deps.gameCanvasEl.classList.add('viewing-other-day');
        if (deps.taskSectionTitleEl) {
            deps.taskSectionTitleEl.textContent = formatDayLabel(viewedDayOffset, bounds) + "'s Deadlines";
        }
        const ghosts = DayPager.conjureGhostsForDay(conjureDeps(), currentGameDate, viewedDayOffset);
        const previewTime = startOfViewedDay(bounds);
        syncSliderTo(previewTime);
        renderGhostCanvas(ghosts, previewTime);
        setDayScopedTaskCount(ghosts.length);
    }

    // Paged mode (phone landscape, and the yesterday snapshot everywhere):
    // one day at a time, the agenda list swapped for that day's ghost rows.
    function renderPaged(bounds, currentGameDate, previousOffset) {
        if (isViewingToday()) {
            if (deps.gameCanvasEl) deps.gameCanvasEl.classList.remove('viewing-other-day');
            clearGhostSprites();
            if (deps.taskSectionTitleEl) deps.taskSectionTitleEl.textContent = "Today's Deadlines";
            todayShown(previousOffset !== 0);
            listShowsSwapped = false;
            if (deps.renderTodayAgenda) deps.renderTodayAgenda();
            // Playtest finding #3 (2026-07-20): restore the REAL global
            // count — a prior visit to a ghost/snapshot page below
            // overwrote taskCountDisplayEl with that day's ghost count.
            if (deps.updateTaskCountDisplay) deps.updateTaskCountDisplay();
            // Playtest finding #4 (2026-07-20): "Completed Today" is
            // genuinely today-scoped (renderCompletedItems has no day
            // parameter — it always reads real completedItems for the
            // live day), so un-hide it again on return; it manages its own
            // "no completions yet" hidden state independently via
            // AgendaList.renderCompletedItems, called by deps.renderTodayAgenda
            // -> script.js's sortAndRenderActiveList path elsewhere. Here we
            // only undo OUR forced hide from the branch below.
            if (deps.completedTasksSectionEl) deps.completedTasksSectionEl.classList.remove('day-pager-hidden');
            // ...and it may have been showing YESTERDAY's completions a moment ago: draw Today's again.
            if (deps.renderCompletedItems) deps.renderCompletedItems();
            return;
        }

        deps.setTimePreviewActive(true);
        if (deps.gameCanvasEl) deps.gameCanvasEl.classList.add('viewing-other-day');
        if (deps.taskSectionTitleEl) {
            deps.taskSectionTitleEl.textContent = formatDayLabel(viewedDayOffset, bounds) + "'s Deadlines";
        }
        // Playtest finding #4 (2026-07-20): "Completed Today" always reflects
        // the REAL current day regardless of what's being previewed, which
        // read as confusing bleed-through under e.g. "Tomorrow's Deadlines".
        // Hidden via its own class (not AgendaList's 'hidden', which it
        // toggles itself based on whether there are any real completions —
        // stomping that would fight with renderCompletedItems on the next
        // real completion/uncompletion while still off Today).
        // Exception (2026-11-03, Jeremy): Yesterday shows YESTERDAY's completions (read-only). script.js's
        // completedView() keys off this pager's offset, so the same render call draws the right day.
        if (viewedDayOffset === DayPager.MIN_OFFSET) {
            if (deps.completedTasksSectionEl) deps.completedTasksSectionEl.classList.remove('day-pager-hidden');
            if (deps.renderCompletedItems) deps.renderCompletedItems();
        } else if (deps.completedTasksSectionEl) {
            deps.completedTasksSectionEl.classList.add('day-pager-hidden');
        }

        const cd = conjureDeps();

        if (viewedDayOffset === DayPager.MIN_OFFSET) {
            // Yesterday: a STATIC snapshot, not a live-preview-time ghost
            // board — every entry already carries its own resolved outcome,
            // so there's no single "preview anchor" hour to compute (see
            // js/dayPager.js's yesterday-snapshot header). All entries
            // render at once, each labeled with its outcome badge instead
            // of a due time.
            // 2026-11-04 (Jeremy): Yesterday follows the slider like the later days. It starts at 12:00 AM and a
            // drag walks the snapshot through the day (previewGhostsAt); beaten ghosts leave at their `doneAt`.
            const snapshot = DayPager.conjureYesterdaySnapshot(cd, currentGameDate);
            const yStart = startOfViewedDay(bounds);
            syncSliderTo(yStart);
            renderGhostCanvas(snapshot, yStart);
            renderGhostAgenda(snapshot, 'Nothing was scheduled');
            setDayScopedTaskCount(snapshot.length);
            return;
        }

        const ghosts = DayPager.conjureGhostsForDay(cd, currentGameDate, viewedDayOffset);

        // Preview anchor: the START of the viewed day (2026-11-03, Jeremy: the slider should begin at the start of
        // the day, because ghosts placed from a noon anchor piled every morning item at the base and confused
        // the picture). The slider is set to 12:00 AM to match, and dragging it slides that day's ghosts
        // (previewGhostsAt). Nothing is due before the anchor, so every ghost walks in from the right by its due time.
        const previewTime = startOfViewedDay(bounds);
        syncSliderTo(previewTime);

        renderGhostCanvas(ghosts, previewTime);
        renderGhostAgenda(ghosts, 'Nothing scheduled');
        setDayScopedTaskCount(ghosts.length);
    }

    // Today is on screen. The slider no longer snaps back on release (2026-11-04, Jeremy), so a handle parked on Today
    // stays put through a re-render of Today itself; coming back from ANOTHER day returns it to now. Without the
    // TimeSliderView hook (tests, stale wiring) it falls back to the old flag-off + slider-to-now.
    function todayShown(fromOtherDay) {
        if (typeof deps.onTodayShown === 'function') { deps.onTodayShown(fromOtherDay); return; }
        deps.setTimePreviewActive(false);
        syncSliderTo(new Date());
    }

    // The clock a viewed day starts at (its first minute) and the matching slider reset.
    function startOfViewedDay(bounds) {
        return new Date(bounds.start);
    }

    // Point the hour slider (handle + label) at `time`. Optional dep: absent in tests / before script.js wires it.
    function syncSliderTo(time) {
        if (deps && typeof deps.syncSlider === 'function') deps.syncSlider(time);
    }

    // Start of the day on screen when that day is a ghosted preview (Yesterday and offsets 1..6), else null (Today).
    // TimeSliderView asks this to decide whether a drag moves the REAL board (Today) or the viewed day's ghosts.
    function getViewedDayStart() {
        if (!deps || viewedDayOffset === 0) return null;
        return DayPager.dayBoundsForOffset(deps.getCurrentGameDate(), viewedDayOffset).start;
    }

    // Slider drag on a viewed day: slide that day's ghosts to `time` (no rebuild, no damage preview).
    function previewGhostsAt(time) {
        if (!deps || !deps.gameCanvasEl || viewedDayOffset === 0) return;
        const sprites = deps.gameCanvasEl.querySelectorAll('.day-pager-ghost');
        sprites.forEach((el, i) => { if (shownGhosts[i]) positionGhostSprite(el, shownGhosts[i], time); });
    }

    // Playtest finding #3 (2026-07-20): matches Hud.updateTaskCountDisplay's
    // own "N task(s)" formatting exactly so the header doesn't visibly
    // change style when paging off Today.
    function setDayScopedTaskCount(count) {
        if (!deps.taskCountDisplayEl) return;
        deps.taskCountDisplayEl.textContent = `${count} task${count !== 1 ? 's' : ''}`;
    }

    // Public choke point (2026-07-20, Milestone 5 UX batch, playtest finding
    // #1): lets script.js's updateTaskCountDisplay() refresh just the strip
    // after any task/habit create/complete/uncomplete WITHOUT re-running the
    // rest of render() (which would also touch the ghost canvas/agenda and
    // the ".viewing-other-day" class — unwanted side effects on every
    // routine task-count update). Guarded the same way renderWeekStrip
    // already guards itself; also safe to call before init() (deps null).
    // 2026-11-03: in the continuous list it also refreshes the later-day
    // sections, which are built from the same definitions the strip counts.
    function refreshWeekStrip() {
        if (!deps) return;
        renderWeekStrip();
        if (isContinuous() && viewedDayOffset !== DayPager.MIN_OFFSET) renderFutureSections();
    }

    // A week-strip button, a pager arrow or the midnight rollover: move to a
    // day. In the continuous list the list scrolls to that day's divider.
    function goToOffset(offset) {
        const previous = viewedDayOffset;
        setOffsetState(offset);
        render();
        if (isContinuous() && viewedDayOffset >= 0) {
            scrollToOffset(viewedDayOffset, previous !== DayPager.MIN_OFFSET);
        }
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

        // Continuous list wiring (skipped where there is no list box / no
        // matchMedia, e.g. a test harness: the pager then behaves as before).
        if (deps.listScrollEl && typeof document !== 'undefined') {
            futureEl = document.createElement('div');
            futureEl.id = 'dayListFuture';
            futureEl.className = 'day-list-future day-pager-hidden';
            deps.listScrollEl.appendChild(futureEl);
            deps.listScrollEl.addEventListener('scroll', onListScroll, { passive: true });
            if (typeof ResizeObserver === 'function') {
                resizeObserver = new ResizeObserver(() => { updateViewportPad(); scheduleSync(); });
                resizeObserver.observe(deps.listScrollEl);
                if (deps.activeItemsListEl) resizeObserver.observe(deps.activeItemsListEl);
            }
        }
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            continuousMq = window.matchMedia(CONTINUOUS_QUERY);
            const onModeChange = () => {
                render();
                if (isContinuous() && viewedDayOffset > 0) scrollToOffset(viewedDayOffset, false);
            };
            if (typeof continuousMq.addEventListener === 'function') continuousMq.addEventListener('change', onModeChange);
            else if (typeof continuousMq.addListener === 'function') continuousMq.addListener(onModeChange);
        }

        render();
    }

    return {
        init,
        goToOffset,
        stepDay,
        getViewedDayOffset,
        getViewedDayStart,
        previewGhostsAt,
        isViewingToday,
        checkRolloverReset,
        formatDayLabel,
        formatDividerLabel,
        ghostRowsHtml,
        futureSectionsHtml,
        refreshWeekStrip,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayPagerView;
}
