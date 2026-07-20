# Time Slider — Week Scope (Day Pager + Week Strip) Plan

Planning session 2026-07-20 (session 70, Cowork, Fable). Sequences the ROADMAP "Week/Month
scope" sub-item under the Time Slider into one-system-per-session steps, mirroring
`RUN_HISTORY_PLAN.md` / `ACHIEVEMENTS_PLAN.md`. Sources of truth: `docs/UI_UX.md` Time Slider
entry (session 63 build), `docs/MECHANICS.md` (spawn model), PROJECT_SPEC.md ~135/~404 (the
"Today/This Week/This Month view modes" big-dream lines — v1 deliberately ships a subset).

**Line numbers WILL drift — always re-Grep before trusting them.**

---

## Jeremy's use cases (drove every fork)

1. Evening review of TOMORROW — "what's coming up tomorrow?" in one gesture.
2. Seeing BIG items later in the week — "what big deadlines are ahead?" at a glance.
3. Light review of the recent past (yesterday) without leaving the board.

---

## Design forks — RESOLVED 2026-07-20 session 70 (Jeremy's verdicts)

1. **Interaction model = DAY PAGER + WEEK STRIP, phased (not a week-scale slider).**
   ‹ › paging between days; the existing 24h slider stays a WITHIN-day scrubber for whichever
   day is being viewed. A 7-day overview strip lands as a later phase (tap a day → pager jumps
   there). REJECTED: stretching the slider range to 7 days (thumb-pixel ≈ 3.5h on mobile —
   kills the precision the Today scope depends on; 7 days of enemies compressed on one canvas
   destroys the distance-= -urgency metaphor).
2. **Month scope = CUT.** Nothing in the mechanics operates at month scale (no monthly habits);
   30 days of ghosts has no honest canvas representation. The spec's Today/Week/Month triple is
   treated as boilerplate; a month-out planner is a calendar's job, not a tower defense's.
3. **Past days = YESTERDAY ONLY, as a STATIC snapshot ("battlefield aftermath").** ‹ one step
   back reconstructs yesterday: scheduled set re-derived from defs (same pure selection
   functions as future ghosts), outcomes overlaid from `occurrenceHistory` (defeated vs
   breached vs indulged). NOT hour-scrubbable — completion times aren't stored, so an animated
   yesterday would be fiction; the slider disables/hides at offset −1. Known fidelity limit
   (accepted): one-off tasks have weaker post-rollover records and may render incomplete.
   Anything older than yesterday stays list-based review in the Stats window.
4. **HP projection stays TODAY-ONLY.** Future-day pages show scheduled ghosts only — no
   multi-day "if you do nothing your base dies Thursday" doom forecast (GAME_DESIGN principle
   2, reflection over punishment). The within-day HP projection (session 63) keeps working on
   the Today page and ONLY there. Revisit-later idea (not v1): a gentle "heavy day" flag on
   the week strip carries the useful signal without the dread.

**Scope guards:**
- Pager range: −1 (yesterday) … +6 (six days ahead). Today is offset 0 and the default.
- Viewed-day offset is SESSION-ONLY state — never persisted, resets to 0 (today) on reload
  and on window/page re-entry. No schema bump anywhere in this plan.
- The whole feature stays NON-MUTATING under the session-63 contract: `js/loop.js`'s
  `updateActiveItems` guard extends to "viewing any non-today page" exactly like an active
  scrub; releasing/paging back to Today snaps to live instantly.
- Ghost conjuring is PURE + rendered-only: future instances are view-models, never written to
  `activeItems`, never given ids from `IdCounter`, never persisted.
- Midnight rollover while parked on a non-today page: on the next live tick after
  `currentGameDate` changes, force offset back to 0 (the day the user was previewing may now
  BE today; re-derive rather than reconcile).

---

## Recon assets (what already exists — this is mostly assembly)

- `Habits.selectHabitDefsToSpawn(definedHabits, definedRoutines, activeItems, forWhichGameDay,
  sickDayDate)` and `Routines.selectTaskDefsToSpawn(...)` are PURE and take a target day —
  built for spawn gating (sessions 36/39). Ghost conjuring = calling them with a future date
  and mapping results to view-models. Frozen/suspended routines and Skip/Sick/Cheat-day
  markers are already respected by these functions for free.
- `TimeSlider.getDayBounds(referenceTime)` was explicitly written to extend to other days.
- The preview machinery (session 63): `previewTime`, `isTimePreviewActive()`, the loop guard,
  `.time-preview-ghost` styling, `Clock.calculateTimelinePosition` /
  `Movement.calculateTimelineXWithClustering` position math — all reusable as-is for a future
  day once ghost view-models exist.
- `habitDef.occurrenceHistory` ({date, success-string} entries, rate-windowed) is the
  yesterday-outcome source. `DayRollover` owns date arithmetic.

---

## Sub-sessions (one per session, Sonnet unless noted)

1. **Pure core: day paging + ghost conjuring.** New `js/dayPager.js` (or extend
   js/timeSlider.js if it stays small): `clampDayOffset(offset)` (−1..+6),
   `dayBoundsForOffset(nowMs, offset)` (via getDayBounds), pure
   `conjureGhostsForDay(defs..., targetDate)` mapping the existing selection functions'
   output to ghost view-models `{name, category, isHabit, routineId, dueTime, isNegative}`
   with synthetic keys (`ghost:<defId>`), plus one-off task defs due that day. Jest for
   clamping, bounds, conjuring incl. frozen-routine exclusion + token-excused days.
2. **Pager UI + future-day rendering.** ‹ › buttons + day label on the slider row
   (`timeSliderView.js`), ghost sprites rendered from view-models on non-today pages (reuse
   `.time-preview-ghost`), slider scrubs WITHIN the viewed day (position math already takes a
   time), agenda list shows the viewed day's ghost agenda (read-only rows, no
   complete/edit affordances on ghosts), loop guard extension, HP projection suppressed off
   Today (fork 4), rollover-while-parked reset. Live-verify in Chrome.
3. **Yesterday static snapshot.** Offset −1: re-derive yesterday's scheduled set, overlay
   `occurrenceHistory` outcomes (defeated = completed/avoided sprite treatment, breached =
   missed/indulged), slider hidden/disabled, read-only agenda with outcome badges.
   Live-verify in Chrome (hand-edited occurrenceHistory).
4. **Week strip (phase 2).** 7-day overview row: per-day ghost counts (reuse sub-session 1's
   conjuring), high-priority/big-deadline flag, tap a day → pager jumps there. Placement:
   above the agenda list, only while the pager UI is active (exact placement is a
   sub-session-4 call with Jeremy). Optional "heavy day" marker (fork 4's revisit) — ask
   Jeremy at build time.

Testing per established convention: pure helpers get Jest (sandbox $HOME method); DOM/UI
paths get live Chrome verification against the real server. Every sub-session ends with the
full suite green + `node --check` on touched files.
