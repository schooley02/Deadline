# Habit Goals — plan (DESIGNED 2026-11-01, Opus; Jeremy)

Replaces the habit "Timer (minutes)" box with a **Habit Goal** section, makes the player (not the timer) the judge of
whether a goal was met, adds an **evening check** for Break habits, and records the actual amount when the player
gives one. Tasks lose the timer-target field. Nothing here changes points, XP, streak or damage numbers (no balance
change); it changes how a Break habit's result is decided and what data we keep.

## Why (Jeremy, 2026-11-01)

- Start/End times (Start time Builds A/B) now say WHEN; the timer target only said HOW LONG, and only via a stopwatch.
- People won't reliably start/stop a timer. A Break limit like social media happens in many short bursts; checking
  the phone's screen-time total at night is realistic, timing each burst is not. No push notifications either.
- Today a Break limit timer decides the day on ONE session ("Stop — I stayed within my limit" = Resisted), and a
  Build target AUTO-completes the habit, even if the timer was started by accident.
- The habit title is the activity ("Meditate"); the goal is the measure ("30 min"). Users need examples of how to
  fill the field in.

## Decisions (Jeremy, 2026-11-01)

1. **Goal types** (one per habit). Build = "at least", Break = "at most" (the wording flips with the Build/Break toggle):

   | Type | Build examples (at least) | Break examples (at most) |
   |---|---|---|
   | **None** (default) — just do it / just avoid it | Floss, journal, take vitamins, make the bed | No smoking, no fast food, no nail biting |
   | **Time** (min or hr; stored as minutes) | Meditate 10 min, practice guitar 30 min, work out 45 min, read 20 min, study 1 hr, stretch 10 min | Social media ≤ 1 hr, gaming ≤ 2 hr, TV/streaming ≤ 1 hr, news scrolling ≤ 15 min |
   | **Amount** (number + unit) | 20 pages, 8 glasses of water, 10,000 steps, 3 miles, 50 push-ups, 500 words, 5 servings of veg, 3 gratitude items, 2 outreach calls, $10 saved | ≤ 2 drinks, ≤ 5 cigarettes, ≤ 2 cups of coffee, ≤ $20 impulse spending, ≤ 1 snooze, ≤ 1 dessert |
   | **Custom note** (free text) | "Call Mom", "One kind act" | "No screens after 10 PM", "No coffee after 2 PM" |

   Units: free text with suggestions (`<datalist>`): pages, glasses, oz, steps, miles, km, reps, words, servings,
   drinks, cigarettes, cups, $, times. Time-of-day goals ("wake by 6", "no caffeine after 2 PM") are NOT a fifth type
   in v1: Build habits already have Custom times; for Break habits they are a Custom note.
2. **The goal shows on the card**: the agenda row and the habit popup get one short line — "Goal: 30 min",
   "Limit: 1 hr", "Goal: 8 glasses", "Limit: 2 drinks", or the note text.
3. **Examples via tap-to-show hints, not hover tooltips** (hover doesn't exist on phones): short examples in the field
   placeholders ("e.g. 30", "e.g. glasses"); fuller examples behind a small ⓘ button that opens a popover (works on
   touch, mouse and keyboard). Built as a reusable `FormHint` so other form fields can use it later.
4. **Stopwatch on habits only for a Time goal.** (Tasks keep the stopwatch: damage halving + the planned-work cue.)
5. **Build habit, Time goal — no auto-complete.** Reaching the goal opens a popup:
   "**Meditate:** 30 min logged — your goal." → **Mark done** · **Keep going** (timer keeps running) ·
   **Pause** (time stays logged; the stopwatch resumes it; was "Stop, not done yet" until 2026-11-01) · **Started by mistake** (this session's time is discarded).
   If the app was closed when the goal was reached, the popup shows on the next open.
6. **Break habit, Time limit — the timer is a "logged so far" helper.** It counts UP across sessions in the day
   (time logged in the button, the limit as a "Limit: 60 min" caption under it since 2026-11-01), turns red once over, and never decides anything: Stop just banks time (no Resisted), going over
   pops nothing (the old "Time's up — did you stay within it?" limit-expiry prompt is removed).
7. **Evening check** (new): at an evening time (default 9 PM, a Settings field) the game asks about every Break habit
   still unanswered TODAY — one modal, one card each: the goal line, the timer hint if any ("timer logged 18 min"),
   an optional **How much?** box, and **Resisted / Slipped / Later**. In-app only (shows when the app is open at or
   after that time; no push). **The next-morning check-in card stays** as the backstop for a day that was never
   answered (fell asleep, never opened the app); it gets the same goal line + How much? box.
8. **Record the actual amount (optional).** Answering a Break habit (evening check, check-in card, popup) or marking a
   Build habit done from its popup offers an optional "How much?" (number; minutes for Time goals). The row checkbox
   stays one tap and records nothing extra. Met / not met is still the player's Resisted / Slipped / done answer, never
   computed from the number.
9. **Tasks:** remove the "Timer target (min, optional)" field from Add Task and Edit Task. Existing saved task targets
   are kept and use the same Decision-5 popup instead of auto-completing.

## Data

- `habitDef.goal`: `{ type: 'none'|'time'|'amount'|'note', amount: number|null, unit: string|null, note: string|null }`.
  Time stores minutes (`unit: 'min'`); the form's min/hr picker converts.
- **Additive, no schema bump** (same approach as `startDateTime`): `Habits.goalOf(def)` reads `def.goal`, else derives
  `{type:'time', amount: def.timerMinutes, unit:'min'}` from an old timer, else `{type:'none'}`. Saving a habit writes
  `goal` and keeps `timerMinutes` in step for a Time goal (so `js/timer.js` keeps reading `item.timerMinutes`);
  `timerMode` stays derived from Build/Break.
- Instances: `item.goal` copied at spawn (and on edit, like the re-time path), so a card shows the goal of its day.
- Actual amount: `item.goalActual` (number|null) on the instance; carried into the habit's occurrence record and the
  **daily record** (guardrail: `DailyRecord` gains a per-habit goal tally, `DailyRecord.v` 3 → 4, documented in
  DATA_SCHEMA.md): for each answered habit with a goal, `{ type, amount, unit, met, actual }`.
- Settings: `eveningCheckTime` ("21:00" default) in `deadline.settings`; `CONFIG.EVENING_CHECK_DEFAULT` holds the default.

## Builds (each one session, Sonnet medium; tests + docs + sw bump each)

1. **[BUILT 2026-11-01, sw v178] Goal data + forms + card.** `Habits.goalOf/formatGoal`, Habit Goal section (type select; Time = number + min/hr;
   Amount = number + unit datalist; Note = text; label flips At least / At most with Build/Break) on Add Habit, routine
   New Habit and Edit Habit, replacing "Timer (minutes)"; `FormHint` ⓘ popover with the examples above; goal line on
   the row + popup; stopwatch hidden on habits without a Time goal; remove the task timer-target fields.
2. **[BUILT 2026-11-01, sw v179; popup button explanations v180, Pause/Resume v181, Pause + Stop icons v182, Play icon when paused v183] Timer behavior.** Build Time goal → Decision-5 popup (replaces `pendingAction` 'target' auto-complete; also for old
   task targets). Break limit → count-up helper, Stop = bank only, no expiry prompt (`'limit-expired'` path and the
   `expired` arrival card go away); row shows a live "18:20 / 60 min", red when over.
   *Built as:* `pendingAction` returns `'goal-reached'` (once per answer, `item.goalAcked`); `Timer.discardSession`
   for "Started by mistake"; limit timers return no pending action; starting a limit timer no longer sets
   `arrivalPromptedFor` (the timer answers nothing now); `TimerView.showGoalReached`; dismissing the popup
   (outside tap / Esc) leaves the timer running and asks again on the next app open.
3. **Evening check + How much? + DailyRecord v4.** Evening modal (reuses check-in card styles), Settings time field,
   How much? box on evening / check-in / popup answers, `goalActual` storage, daily record tally.

## Open (decide before the build that needs it)

- **Arrival prompt for Break habits with a Time/Amount limit: DECIDED 2026-11-01 (Jeremy) -- KEEP IT.** If the player knows
  they'll be tempted at certain times of day / days of the week, the popup asks "did you resist?" when that time arrives, for
  EVERY Break habit including Time/Amount limits. A Resisted / Slipped answer settles the habit for the day; the evening check
  (Build 3) only asks about Break habits still unanswered. Nothing to build for this in Build 2 (starting a Break timer simply
  doesn't suppress the prompt).
- **Build habits without a Time goal lose the stopwatch** (and its overdue-damage halving). Fine for Floss / 8 glasses;
  confirm in Build 1.
- **Partial credit** (e.g. 25 of 30 min) is out of scope: met/not met stays the player's answer. Any reward for actual
  amounts would be a balance change via the balance-tuning skill.
