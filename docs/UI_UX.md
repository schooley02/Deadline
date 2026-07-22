# UI / UX — Screens, Navigation, Interactions

## Platform
Mobile-first web app; prioritize Chrome/Android. Must be responsive so it works in any browser. Game canvas in the top portion of the screen; task/habit agenda list stacked below it.

**Installable PWA shell (2026-07-20, MOBILE_PWA_PLAN.md sub-session 3):** `manifest.json` +
`sw.js` (cache-first service worker over an explicit app-shell file list — not a blanket
`Assets/*` glob) make the app installable ("Add to Home Screen") and load offline. Icons
(`Assets/icons/icon-192.png`/`icon-512.png`) are a square crop of the existing church base
sprite. Scope is deliberately shallow (installable shell only, per Jeremy's call) — no offline
game-state sync or write reconciliation; the game's actual data stays exactly as it was,
localStorage-only. Bump `sw.js`'s `CACHE_NAME` on any future shell-file change (new/removed
`<script>`/`<link>`, edited CSS/JS) so returning installs pick up the update.

## Main Screen
- **Canvas (top):** base on the left, enemies advancing from the right. Defaults to showing the CURRENT DAY's tasks and habits. Only active (non-repeating-future) items render.
- **Base Zone heroes ([P1-UI-006] sub-session 3, built 2026-07-19):** one small avatar chip per routine renders over the base's leftmost 120px (`js/ui/heroes.js`) — category emoji, level badge, star row, health bar, state styling (active/frozen 🥶/KO'd 💤/inactive greyed). CSS/emoji placeholders for v1 (no hero sprite assets exist); capped display with a "+N" overflow chip. See docs/ROUTINES.md's "Hero Rendering" section for the full mechanic.
- **Agenda List (below):** today's tasks and habits ordered by closest-to-base (soonest due first). Edit icon next to each item. Complete/Defeat buttons per item. A parent task with any sub-task history shows a live "N/M sub-tasks" progress label next to its category badge (built 2026-07-19, session 51 — see MECHANICS.md "Sub-tasks"). The header's task-count number follows whatever day the pager is currently viewing (real activeItems count on Today; that day's ghost/snapshot count otherwise) — fixed 2026-07-20, Milestone 5 UX batch; previously always showed the global Today count regardless of the viewed page.
- **First-run/onboarding empty state (Milestone 5, 2026-07-20)** — PROJECT_SPEC's "Empty State" spec at MVP fidelity, scoped to this (Jeremy's pick over sample-content seeding or a full guided tutorial). `AgendaList.isFirstRunEmpty` (`js/ui/agendaList.js`) is true only when the player has NEVER engaged with the app at all: no active items, no completions ever, no habit/routine ever defined. Deliberately NOT a persisted flag — fully derived from existing state, so it clears the instant the first task/habit/routine is created, and can harmlessly reappear if a player deletes back to zero (still an empty board either way). Renders a church emoji, "Welcome to Deadline!" headline, a one-line mechanic explainer, and a "+ Add Your First Task" primary button (existing `.primary-button` styling, no new illustration assets) that opens the Tasks window directly — one tap closer than routing through the FAB menu. `#fabButton` gets a subtle `prefers-reduced-motion`-gated CSS pulse (`.onboarding-hint`) while first-run-empty, matching PROJECT_SPEC's "Tutorial Hint...pointing to Floating Action Button" — NOT gated by the session-59 fx-intensity setting, since it's a one-time UI affordance rather than a per-tick gameplay effect. A returning player with real history but an empty board today (e.g. everything completed) gets the plain neutral empty state instead, never the onboarding copy.
- **Add Task's default Due Time (fixed 2026-07-20, Milestone 5 UX batch):** max(5:00 PM, now + 1 hour rounded up to the next half-hour), capped at 11:59 PM same day — never rolls into tomorrow. Previously a hardcoded 5:00 PM, which spawned an untouched evening-created task already overdue (damaging the base immediately). Daytime creation still defaults to the familiar 5 PM anchor. Pure logic in `js/ui/forms.js`'s `computeDefaultDueTime`.
- **Completed Today:** completed sub-tasks render nested and greyed directly under their parent's completed entry, indented, DISPLAY-ONLY (a static "✓ Completed" badge, no uncomplete checkbox — see MECHANICS.md "Sub-tasks" for why) (built 2026-07-19, session 51). Hidden entirely while the Day Pager is viewing any non-Today page (fixed 2026-07-20, Milestone 5 UX batch — it's always real-Today data and previously kept showing under e.g. "Tomorrow's Deadlines," reading as if it belonged there).
- **Time Slider (Today scope BUILT 2026-07-20, session 63):** sits ON the seam between canvas and list (`js/ui/timeSliderView.js`, `css/timeSlider.css`) — time LABEL on the left, range input filling the rest of the row (Jeremy's call, same session). A 24h range input (1-minute steps, Sacred Stone thumb) whose handle tracks the current time live when idle (`TimeSliderView.syncHandle`, called from `js/loop.js`'s per-tick hook). Scrubbing (`input` event) sets `previewTime`, which the SAME pure position math the live loop uses (`Clock.calculateTimelinePosition` / `Movement.calculateTimelineXWithClustering`) re-renders every active item's `left` at — so future-due items already on the board (everything for today spawns at day start, just far off-screen right — see MECHANICS.md) slide into view exactly like "ghosted future spawns," with no separate not-yet-spawned category needed for a single day. Negative-habit lurkers (normally pinned at the fixed right-edge "lurk post," see MECHANICS.md's A2 model) ride the midnight line instead once it's on-screen (previewTime >= 8pm), returning to the lurk post on rewind before 8pm (Jeremy's call, `js/timeSlider.js`'s `getLurkerPreviewX`). Previewed elements get a `.time-preview-ghost` class (dashed outline on enemy sprites; plain opacity dim on the base sprite/HUD-health-number/hero-chip container) — releasing (`change`/`pointerup`/`touchend`/`blur`) snaps everything back to live "now" instantly. PREVIEW IS NON-MUTATING: `js/loop.js`'s `updateActiveItems` early-returns while `isTimePreviewActive()` is true (same "one owner at a time" contract as the offline catch-up guard) — no damage, regen, or real position writes happen during a scrub, however long it lasts (`updateGame`'s `lastLoopTickMs` keeps ticking regardless, so a long scrub is never mistaken for a suspended-loop gap on release). Scope toggle (Today / This Week / This Month) is UNBUILT — Week/Month will need real ghost-conjuring for other days' not-yet-spawned instances, unlike Today. **Week scope, sub-sessions 1-2 BUILT 2026-07-20 (session 71)** — see the Day Pager entry below; Month scope is CUT (session 70 fork, docs/TIME_SLIDER_WEEK_PLAN.md).
- **Day Pager (Week scope sub-sessions 1-2 BUILT 2026-07-20, session 71):** a ‹ › row above the Time Slider (`js/ui/dayPagerView.js`, `js/dayPager.js`, `css/dayPager.css`) pages between Today and up to 6 days ahead (yesterday is sub-session 3). Off Today: the real board sprites hide (base/hero chips stay live and untouched — HP projection is deliberately today-only), conjured ghost sprites + read-only agenda rows show that day's scheduled habits/routine-tasks (existing one-off tasks/sub-tasks already due that day render too, since they aren't respawned daily). Non-mutating: reuses the same `isTimePreviewActive` flag the hour-scrub slider sets, so `js/loop.js` freezes damage/regen/position writes the whole time a non-Today page is open. A session left parked on a future day through a real midnight crossing snaps back to Today automatically. **Yesterday (offset -1) BUILT 2026-07-20 (session 72):** a STATIC snapshot, not hour-scrubbable (the hour slider disables itself only at this offset) — every scheduled habit/task for that day renders once with an outcome badge (✓ Completed/Avoided, ✕ Missed/Indulged, or a neutral "No record" when nothing was tracked) instead of a due time, sourced from `occurrenceHistory` (habits) and `completedItems` membership (routine/one-off tasks). **Week strip BUILT 2026-07-20 (session 73) — Week scope now fully CLOSED:** a 7-cell overview row above the pager (offsets 0..+6) shows each day's total item count, a ★N high-priority badge, and a relative "heavier than this week's own average" highlight (no fixed threshold); tapping a cell jumps the pager straight there. **Live-refreshes on task/habit create/complete/uncomplete (fixed 2026-07-20, Milestone 5 UX batch)** — previously only re-rendered on load or pager navigation, so the strip's per-day counts (including Today's own) went stale until the next ‹ › tap; `DayPagerView.refreshWeekStrip()` is now called from the same script.js choke point every `updateTaskCountDisplay()` call already goes through.
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

## Settings window — "Backup & Transfer" (Milestone 5 first item, 2026-07-20)
FAB → Settings gained a second section below Streak Fire Effects: Export (Download file / Copy to
clipboard) and Import (file picker / paste textarea → "Import pasted text"). A bad/corrupt/
newer-than-supported paste shows an inline red status line under Import, no modal. A valid paste
opens a stacked confirm-replace modal (`Modal.open`, dedupeSelector-guarded) with a side-by-side
Current-vs-Incoming compare (days survived/level/XP/points/active items/habits/routines) before
anything is written — see docs/DATA_SCHEMA.md's Export/Import section for the full contract.

## Settings window — "Reset Game" + FAB menu contrast (2026-07-21)
The dev-only "↺ Reset" button (previously a floating bottom-left corner button on the main game
screen, always one accidental tap away from wiping a real save) moved into the Settings window as
a clearly-flagged destructive section below Backup & Transfer: red-tinted heading/border, warning
copy pointing at Export first, and a "Reset Game" button. Clicking it opens an in-app `Modal.open`
confirm dialog (same pattern as the Import replace-confirm) instead of the browser's native
`confirm()` the old button used — consistent look, and native `confirm()`/`alert()` are known to
freeze Claude-in-Chrome CDP automation mid-playtest (see CLAUDE.md), so this also makes the flow
testable without the navigate-away recovery trick. Confirming calls `handleConfirmReset` in
script.js (unchanged wipe logic: definedHabits/definedRoutines/definedTasks/runHistory/lifetime
achievements, then re-init); Cancel closes only the confirm dialog.

Same session: the FAB menu's six pop-out items (`css/fabMenu.css` `.fab-menu-item`) were white
cards with pale-green borders over the light game background — low contrast ("light buttons on a
light background, hard on the eyes," Jeremy). Restyled to the same dark-green gradient as the FAB
button itself, white text/icons, stronger shadow — the whole popped-out menu now reads as one
clearly visible dark cluster instead of near-invisible outlines.

**Reset Game gated to dev mode (V3a, 2026-07-21).** Moving Reset into Settings fixed the
accidental-tap risk but left it unconditionally visible to every player on the live GitHub Pages
build, which is dev chrome that shouldn't ship. `js/ui/settingsView.js`'s `isDevMode(loc)` (pure,
location-injected, exported for tests) now gates the whole "Reset Game" section: true on
`localhost`/`127.0.0.1` (any port — covers `node server.js`/`npx serve .`), or when a `?dev` query
param is present on any origin (so it can still be reached for a spot-check on the live build).
False for a real player on the plain Pages URL. `test/settings-view-devmode.test.js` covers the
pure function directly.

## Agenda rows — mobile flex fixes (V3a, 2026-07-21)
Agenda rows (`js/ui/agendaList.js`'s `createListItem`) were clipping off the right edge at 390px.
Two independent flex chains needed fixing inside the `@media (max-width: 768px)` block in
`css/responsive.css`, both because a nowrap flex row's automatic minimum width is the SUM of its
children's minimum widths, not the container's available width:
- The title/details rows inside `.item-info` (due date + category badge + sub-task-progress +
  streak + the "+ Sub-task" button) are unclassed JS-built divs, so the fix targets them
  structurally (`.item-info div { flex-wrap: wrap }`) rather than adding new classes.
- `.task-controls` (edit icon + "Mark as Complete" checkbox) carries an inline `flex-shrink: 0`
  (script keeps it from competing with the item name on wide screens) that pinned it to its full
  unwrapped width even after wrapping onto its own line — needed `flex-shrink: 1 !important` to
  win over the inline declaration, plus `min-width: 0` so its own content can wrap.
- Sub-tasks render as a **sibling** of `.item-info` (not a descendant), so its own unwrapped row
  (`.sub-task-item`/`.sub-task-info`/`.sub-task-controls` — all classed, unlike the rows above)
  needed the same wrap + `min-width: 0` treatment, or it drags the whole card wider regardless of
  the `.item-info` fix.
Verified with `getBoundingClientRect`/`scrollWidth` checks (no li/container overflow at 390px) via
a same-origin iframe injected at 390×844 into Jeremy's live `node server.js`, not just visually.

## Game canvas — graveyard atmosphere (V1, 2026-07-21)
`#gameCanvas` (`css/gameCanvas.css`, `index.html`) gained a `.graveyard-scene` layer stack behind
`#base`/`#heroBaseZone`/`#midnightLine`/`.enemy`: night-sky gradient + static moon glow, a faint
cloud layer, a far hill + three bare-tree silhouettes (inline SVG), and a fixed ground band with a
fence + three tombstone silhouettes (inline SVG). All decorative/`aria-hidden`. Matches
`docs/ART_STYLE.md`'s "pixel art / cartoonish, playful, slightly eerie graveyard — never grim" —
low-detail silhouettes only; V4 will regenerate the pixel-art church into this scene later.

**Slider-coupled parallax** (2026-07-21 art-direction decision): `js/ui/timeSliderView.js` sets a
`--scene-progress` CSS custom property (0–1, minutes-of-day / MINUTES_PER_DAY) on `#graveyardScene`
on every live tick (`syncHandle`) and scrub (`handleScrubInput`) — NOT threaded through the deps
contract like the rest of that module, since it's a purely decorative DOM query with no game-state
coupling (matches the direct `document.getElementById` precedent already used throughout
`js/ui/*.js`; missing element no-ops). `.scene-clouds`/`.scene-silhouettes` read it via
`translateX(calc((var(--scene-progress, 0.5) - 0.5) * rate))` (clouds fastest, silhouettes slower);
`.scene-ground` is deliberately NOT transformed (fixed — the differential against the moving layers
above it is what sells the depth). No rotate transforms anywhere (camera tilt was rejected,
DECISIONS.md 2026-07-21). Idle cloud drift + ground fog are separate CSS keyframe animations (own
element/pseudo-element, so they never fight the parallax `transform` on the same property), gated
behind `fx-off`/`fx-reduced` (`js/settings.js` body classes) + `prefers-reduced-motion`, same
pattern as `css/enemyStatus.css`'s streak-fire/walk-bob effects.

**Stacking-context gotcha (found live in Chrome this session):** the scene layers use NEGATIVE
z-index (-4 to -1) so they paint behind `#gameCanvas`'s own auto-stacked children without touching
those elements' z-index. This only works if `#gameCanvas` itself establishes a stacking context —
it didn't (plain `position: relative`, no `z-index`), so the negative-z children escaped upward
past `#gameCanvas` entirely and never appeared on screen, even though their computed styles/rects
were all correct. Fixed by adding `z-index: 0` to `#gameCanvas`. Flagging as a general pattern: any
future negative-z-index decorative layer needs its positioned ancestor to have an explicit
non-auto `z-index` too, or repeat this exact silent-failure mode.

**Midnight line restyle:** `#midnightLine` (`css/gameCanvas.css`) changed from a red alarm hairline
to a dark iron gate-post with a warm lantern glow at the top — reads as scenery ("a gate/fence break
in the graveyard") rather than a warning stripe. Purely CSS; `js/clock.js`'s `updateMidnightLine`
only ever touches `.style.left`/`.style.display`, never color, so no JS changes were needed.

**Deferred (NOT done this session — see ROADMAP):** "zombies stand on the ground band" is only
partially true today. `Movement.getItemTopPosition` still randomizes a top-level item's vertical
position across the FULL canvas height (`canvasHeight - itemHeight`), not a narrow bottom band —
changing that range is real lane-math (affects multi-item overlap), which the ROADMAP task itself
flagged as a stop-and-split condition. The visual ground band is real and ready; the next small
`movement.js` session needs to narrow the random range to sit on it.

Live-verified in Chrome against Jeremy's real `node server.js`: scene renders correctly at desktop
width and at 390×844 (same-origin iframe recipe, no page-level overflow — `.graveyard-scene`
itself is `overflow: hidden` by design, so its own `scrollWidth > clientWidth` is expected and not
a bug); `--scene-progress` and the resulting `translateX` verified across the full 0–1439 minute
range (ground transform stayed `none` throughout); `fx-off`/`fx-reduced` correctly stop both idle
animations, default leaves them running; hero-chip zone (base's leftmost 120px) unchanged; zero
console errors beyond the standard Chrome-extension message-channel noise.

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
