# UI / UX — Screens, Navigation, Interactions

## Platform
Mobile-first web app; prioritize Chrome/Android. Must be responsive so it works in any browser. Game canvas in the top portion of the screen; task/habit agenda list stacked below it.

## Main Screen
- **Canvas (top):** base on the left, enemies advancing from the right. Defaults to showing the CURRENT DAY's tasks and habits. Only active (non-repeating-future) items render.
- **Base Zone heroes ([P1-UI-006] sub-session 3, built 2026-07-19):** one small avatar chip per routine renders over the base's leftmost 120px (`js/ui/heroes.js`) — category emoji, level badge, star row, health bar, state styling (active/frozen 🥶/KO'd 💤/inactive greyed). CSS/emoji placeholders for v1 (no hero sprite assets exist); capped display with a "+N" overflow chip. See docs/ROUTINES.md's "Hero Rendering" section for the full mechanic.
- **Agenda List (below):** today's tasks and habits ordered by closest-to-base (soonest due first). Edit icon next to each item. Complete/Defeat buttons per item. A parent task with any sub-task history shows a live "N/M sub-tasks" progress label next to its category badge (built 2026-07-19, session 51 — see MECHANICS.md "Sub-tasks").
- **Completed Today:** completed sub-tasks render nested and greyed directly under their parent's completed entry, indented, DISPLAY-ONLY (a static "✓ Completed" badge, no uncomplete checkbox — see MECHANICS.md "Sub-tasks" for why) (built 2026-07-19, session 51).
- **Time Slider (Today scope BUILT 2026-07-20, session 63):** sits ON the seam between canvas and list (`js/ui/timeSliderView.js`, `css/timeSlider.css`) — time LABEL on the left, range input filling the rest of the row (Jeremy's call, same session). A 24h range input (1-minute steps, Sacred Stone thumb) whose handle tracks the current time live when idle (`TimeSliderView.syncHandle`, called from `js/loop.js`'s per-tick hook). Scrubbing (`input` event) sets `previewTime`, which the SAME pure position math the live loop uses (`Clock.calculateTimelinePosition` / `Movement.calculateTimelineXWithClustering`) re-renders every active item's `left` at — so future-due items already on the board (everything for today spawns at day start, just far off-screen right — see MECHANICS.md) slide into view exactly like "ghosted future spawns," with no separate not-yet-spawned category needed for a single day. Negative-habit lurkers (normally pinned at the fixed right-edge "lurk post," see MECHANICS.md's A2 model) ride the midnight line instead once it's on-screen (previewTime >= 8pm), returning to the lurk post on rewind before 8pm (Jeremy's call, `js/timeSlider.js`'s `getLurkerPreviewX`). Previewed elements get a `.time-preview-ghost` class (dashed outline on enemy sprites; plain opacity dim on the base sprite/HUD-health-number/hero-chip container) — releasing (`change`/`pointerup`/`touchend`/`blur`) snaps everything back to live "now" instantly. PREVIEW IS NON-MUTATING: `js/loop.js`'s `updateActiveItems` early-returns while `isTimePreviewActive()` is true (same "one owner at a time" contract as the offline catch-up guard) — no damage, regen, or real position writes happen during a scrub, however long it lasts (`updateGame`'s `lastLoopTickMs` keeps ticking regardless, so a long scrub is never mistaken for a suspended-loop gap on release). Scope toggle (Today / This Week / This Month) is UNBUILT — Week/Month will need real ghost-conjuring for other days' not-yet-spawned instances, unlike Today. **Week scope, sub-sessions 1-2 BUILT 2026-07-20 (session 71)** — see the Day Pager entry below; Month scope is CUT (session 70 fork, docs/TIME_SLIDER_WEEK_PLAN.md).
- **Day Pager (Week scope sub-sessions 1-2 BUILT 2026-07-20, session 71):** a ‹ › row above the Time Slider (`js/ui/dayPagerView.js`, `js/dayPager.js`, `css/dayPager.css`) pages between Today and up to 6 days ahead (yesterday is sub-session 3). Off Today: the real board sprites hide (base/hero chips stay live and untouched — HP projection is deliberately today-only), conjured ghost sprites + read-only agenda rows show that day's scheduled habits/routine-tasks (existing one-off tasks/sub-tasks already due that day render too, since they aren't respawned daily). Non-mutating: reuses the same `isTimePreviewActive` flag the hour-scrub slider sets, so `js/loop.js` freezes damage/regen/position writes the whole time a non-Today page is open. A session left parked on a future day through a real midnight crossing snaps back to Today automatically. **Yesterday (offset -1) BUILT 2026-07-20 (session 72):** a STATIC snapshot, not hour-scrubbable (the hour slider disables itself only at this offset) — every scheduled habit/task for that day renders once with an outcome badge (✓ Completed/Avoided, ✕ Missed/Indulged, or a neutral "No record" when nothing was tracked) instead of a due time, sourced from `occurrenceHistory` (habits) and `completedItems` membership (routine/one-off tasks). **Week strip BUILT 2026-07-20 (session 73) — Week scope now fully CLOSED:** a 7-cell overview row above the pager (offsets 0..+6) shows each day's total item count, a ★N high-priority badge, and a relative "heavier than this week's own average" highlight (no fixed threshold); tapping a cell jumps the pager straight there.
  - **Base/routine HP projection (same session, Jeremy's follow-up "the preview also needs to show base damage and freezes"):** while scrubbing, the HUD's base HP number, the base sprite's damage tier, and each hero chip's health bar show a PROJECTED value for `previewTime` — not the real live value — computed by `js/timeSlider.js`'s `projectBaseHealth`/`projectRoutineHealthDeltas`: a pure delta from "now" to `previewTime` using the SAME `CONFIG.DAMAGE_INTERVAL_MS`/`OVERDUE_DAMAGE`/`BASE_REGEN_INTERVAL_MS`/`BASE_REGEN_HP` constants the live loop/regen tick use (anchored at the current known-correct HP, not simulated from scratch — see the module's header for why). Symmetric for rewind: scrubbing behind an item's due date raises its projected HP back toward what it actually was. "Freezes" needed no new code — hero chips already re-render every live tick regardless of preview state, so frozen/KO'd badges stay correctly current through a scrub on their own; freeze itself is a day-level trigger (3+ consecutive indulges) that can't change from time-of-day scrubbing anyway (see ROUTINES.md). Nothing is written to real game state — `HeroesView.renderHeroesAtBase` is called with a shallow-cloned routines array (real `definedRoutines` untouched) via `script.js`'s `renderHeroesAtBase(routinesOverride?)`.
- **Plus Button (floating, bottom-left):** Add New Task, Add New Routine, switch to Routine View, open Inventory (tokens), open Store.
- **HUD:** base HP, player level/XP, days survived, active routines count.

## Routine View
Replaces the agenda list with routines ranked by level (top performers first). Manage habits within each routine here (add, activate/deactivate).

## Other Screens
- Add/Edit screens for tasks, habits, routines.
- Overview screens: all current tasks / all habits / all routines.
- Recently Defeated view (undo accidental completes).
- Run history / run review screen (post-game-over and on demand). On-demand half BUILT 2026-07-19 (session 54, RUN_HISTORY_PLAN.md sub-session 3): Stats window, 5th FAB item — live current-run panel (days survived, counters, top-3 blame) + past-run cards. Post-game-over half BUILT 2026-07-19/20 (session 55, sub-session 4): the game-over screen is now a review card (framing copy + totals + top-5 blame) instead of one line; the Stats window also gained a per-routine "Routine Performance" rollup across recent runs. Polish BUILT 2026-07-20 (session 69, sub-session 5 — ticket CLOSED): past-run cards are expandable (click/Enter/Space; started date + end reason, full top-10 offender list, per-run routine snapshot), the personal-record run carries a 🏆 "Best run" badge, and the current-run panel shows vs-last-run delta markers (green for improvement only, never red; fewer habits missed counts as improvement).
- **Settings window BUILT ([P2-UI-009], Milestone 4, session 59, 2026-07-19):** 6th FAB item, `js/ui/settingsView.js`. First real content in what's meant to grow into a general settings surface (DATA_SCHEMA.md's long-forward-declared `deadline.settings` key) — today just a "Streak Fire Effects" radio group (Full / Reduced / Off), persisted separately from the game save via `js/settings.js` and applied as a `<body>` class (`fx-reduced`/`fx-off`) that CSS keys off. `prefers-reduced-motion` is honored unconditionally regardless of the in-app setting.

## Visual Feedback
- Urgent task: glow / bright border (enemy and list item).
- Base damage: shake on hit, progressive destruction visuals.
- Enemy defeat: explosion + points/XP popup.
- Game over: "Your Base survived X days. What adjustments can you make to have a stronger Base in your life?" + New Base button.

## Navigation
Plus icon / hamburger menu opens options. Keep taps-to-action minimal — completing a task should be 1-2 taps.

## Windows & Modals — unified behavior ([P2-UI-011] Stage 1, session 61, 2026-07-19)
Two window systems share one behavior layer (`js/ui/modal.js`, wired via `Modal.initDismissHandlers`/`initFocusManagement` in script.js):
- **Management windows** (FAB-opened Tasks/Habits/Routines/Shop/Stats/Settings panels) and **modal overlays** (form/popup `.modal-overlay`s) both close on ESC and outside/backdrop click.
- **ESC order:** topmost modal overlay first (ONE per press — stacked modals unwind one at a time), then management windows + FAB menu.
- **Backdrop click** closes only the clicked overlay. **Stacked-context Cancel buttons** use `closeTopmost()` (returns to the modal beneath); other close buttons keep `closeModal()` close-all.
- **Focus:** opening a window/overlay moves focus into it (`tabindex="-1"` containers); closing returns focus to the opener (FAB for windows). Tab is trapped inside the topmost overlay.
- **ARIA:** overlays get `role="dialog"`/`aria-modal`/`aria-label` (auto, from their heading) at open; management windows carry them statically in index.html.
Stage 2 (unscheduled): migrate per-cluster inline modal HTML onto a central `Modal.open()` builder.

## Canonical Wireframes (image-only PDFs — do NOT open in Claude; ask Jeremy)
In `OneDrive\Documents\Baseline - Old\Deadline\`: `Tasks.pdf` (task input fields), `Habits.pdf` (habit input fields), `Routines.pdf` (routine screens), `Agenda-view.pdf` (main screen layout), `wireframe1.pdf`. Also `Deadline-Mockup-1.jpg` and `Base-View-Mockup-v1.png` there (safe to view), and `UI_Inspiration/` in this repo. Deep UI detail: Grep PROJECT_SPEC.md section 7 (UI Specifications).

## Accessibility
Keyboard operable, adequate contrast, tap targets ≥44px, works one-handed on a phone.

**Tap targets fixed 2026-07-20 ([P2] Mobile UX pass, MOBILE_PWA_PLAN.md sub-session 1):** the
edit-pencil button (`.edit-icon-btn`, was 32×32px), the completion checkbox's clickable label
(`.completion-checkbox`, was 32px tall), the management-window close button (`.close-window`, was
28×28px via a since-removed override), the day-pager `‹ ›` buttons (`.day-pager-btn`, was 32×32px),
and the week-strip day cells (`.week-strip-cell`, was 42px tall) are all now ≥44×44px. Also fixed:
`css/responsive.css`'s two `@media` breakpoints had FAB/management-window/fab-menu compacting
rules living under `min-width: 1024px` (desktop) instead of `max-width: 768px` (mobile) — moved to
where they actually apply. See DECISIONS.md session 74 for the full breakdown. Accessibility
pass done same day (MOBILE_PWA_PLAN.md sub-session 2): most controls were already
keyboard-accessible with `aria-label`s (day pager `‹ ›`, week-strip cells, time slider are all
real `<button>`/`<input>`), so the fixes were narrow — darkened `--color-neutral` (#9E9E9E→#757575)
for WCAG AA text contrast, `role="status"`/`aria-live` on `#dayPagerLabel` so day changes are
announced, and `aria-current="true"` on the active week-strip cell. Remaining Mobile UX work is
MOBILE_PWA_PLAN.md sub-session 3 (PWA installable shell).
