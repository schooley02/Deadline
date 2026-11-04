# Timer sessions -- plan

_Designed 2026-11-04 (Claude app session, Opus; Jeremy). **Build A BUILT 2026-11-04 (Sonnet; sw v248): pure core + recording + DailyRecord v8. Builds B and C NOT BUILT.** DECISIONS 2026-11-04 (timer sessions design). ROADMAP M5 "Timer sessions list"._

## Goal

Under **Time Logged**, show every timer session an item has banked, each with its start and stop time, and let the player fix them. Two real cases drive it:

- **Exact fixes.** The player checks their phone or Zoom and sees the meeting ran 2:00-3:05 PM, but the timer stopped at 2:40 by accident (or was left running until 4:10). They set the session's real start / stop.
- **Guesstimates.** No exact times, just "about 45 minutes". They type the total, as today.

Both keep working side by side.

## What Jeremy decided (2026-11-04)

1. **Time from before this ships** (and any time typed by hand) shows as ONE entry with no start / stop: "No start/stop recorded".
2. **The total stays typable** (guesstimates). Typing it changes only that untimed entry, so the total always equals the list. **It can't go below the timed sessions:** to remove timed time, the player edits the session (this keeps rule 6 honest).
3. **Sessions can be added by hand and deleted.**
4. **Checks:** stop after start, not in the future, at most 24 hours (the existing total cap stays 24 h too), no overlap with the item's OTHER sessions (same item only; other items' sessions are not checked).
5. **Days:** a session's minutes count on the day(s) they happened; an edit that moves minutes across midnight corrects each day's daily record.
6. **Damage correction, one way only.** A running timer halves its zombie's damage. If a session is **shortened or deleted** over minutes when that zombie was really attacking, the game charges back the missing half for those minutes. **Lengthening or adding** a session never gives damage back (otherwise a fake session over an attack would win HP back). The charge **never takes the church below 1 HP** (an honest correction must not end the run).
7. **Where:** wherever Time Logged can be edited -- the item's card (zombie popup), Edit Task, and the completed-entry editors (tasks and Build / Break Habits, limit timers included).

## Numbers (from CONFIG, nothing new)

`OVERDUE_DAMAGE` 1 HP per `DAMAGE_INTERVAL_MS` 5 min; `WORK_TIMER_DAMAGE_FACTOR` 0.5 stretches it to 1 HP per 10 min. So the charge is **1 HP per 10 minutes removed while attacking** (rounded down, so a few minutes cost nothing). A forgotten timer stops itself about 70 minutes in (`WORK_TIMER_CHECK_MS` 60 min + `WORK_TIMER_AUTO_STOP_MS` 10 min) if "Still working?" goes unanswered, so one forgotten session is worth at most about 7 HP.

## Data (additive on the item; no schema bump, no migration pass)

- `item.timerSessions`: `[{ start, end, attack: [[from, to], ...] }]`, ms epoch, oldest first. `attack` = the windows inside the session when its zombie was attacking with the timer halving it (usually zero or one window).
- `item.timerUntimedMs`: the untimed entry (>= 0).
- **Invariant:** `item.timerMsBanked` (kept, everything already reads it) = sum of `end - start` + `timerUntimedMs`.
- **Old items** are normalised lazily the first time the list is shown or edited: no sessions yet and `timerMsBanked > 0` -> `timerUntimedMs = timerMsBanked`, `timerSessions = []`. Nothing is rewritten at load.
- Export / import and completed items carry the fields because they live on the item.

## Recording

- `Timer.start` stays as is (`item.timer.startedAt`). While a timer runs, the live loop marks the attack window on `item.timer` (`attackFrom` when the item is overdue, attacking and not non-threatening; closed when it stops attacking, e.g. a pushback). Offline catch-up ignores the timer today, so it records no window and can never be charged back.
- `Timer.stop` (and so `pause`, `autoStop`) appends `{ start: startedAt, end, attack }` with `end` = the banked end (`autoStop` caps it at the prompt, as now). `discardSession` ("Started by mistake") appends nothing.
- The **running** session shows as a read-only row ("Running since 2:05 PM") until stopped.

## Editing rules (pure, in `js/timer.js` or a new `js/timerSessions.js`)

- **Edit a session:** new start / end. Validate (decision 4). Removed time = old span minus new span. **Charge** = (removed time overlapping `attack`) / 10 min, rounded down. Added time charges nothing and refunds nothing.
- **Delete a session:** removed time = the whole span (same charge rule).
- **Add a session:** validate; never charges or refunds.
- **Type a total:** `timerUntimedMs = typed - timedSum`; refuse if `typed < timedSum` with the inline error "To remove timed time, edit its session below." Never charges.
- After any change: recompute `timerMsBanked`, then reuse the existing `Items.setLoggedTime` follow-ups (Time-goal habit `actual`, save, re-render).
- **The total's live preview** in the form shows the charge before saving: "Saving takes back 3 HP of halved damage." No surprise hits.

## Daily record

- Timed minutes: per day by where each minute falls (split at local midnight). An edit adjusts every affected day with the existing `State.adjustDayTimer(date, kind, deltaMin)`.
- Untimed changes land on the item's own day, as `setLoggedTime` does today.
- **New counter (DailyRecord v8):** `tcorr` { n, hp } = damage charged back by corrections, on the day the correction is saved. The charge also goes through the normal damage path for run stats / blame, with the 1 HP floor.

## Screens (copy follows the wording rule)

Under the Time Logged field:

```
Time Logged:  [1] hr [5] min   [Save time]
Sessions
  Tue 2:05 PM - 3:10 PM   1 hr 5 min    Edit
  No start/stop recorded  45 min         Edit total above
  + Add session
```

- **Edit** opens the row in place: Date, Start, Stop, the live charge line (only when there is one), Save / Delete / Cancel.
- **+ Add session**: the same three fields, empty.
- While the timer runs: the list is read-only and the note "Stop the timer to edit the Time Logged." (its link stops it) covers both the total and the list.
- **"Timer stopped" notice** (the auto-stop notice built 2026-11-04): its Edit button opens THIS session's row, prefilled, instead of the total. That is the forgot-to-stop case.

## Build order (Sonnet, medium, after this plan is approved)

- **Build A, pure core + recording:** session record on stop / pause / autoStop, attack windows from the loop, lazy normaliser, validators, removed-span + charge maths, per-day minute deltas, DailyRecord v8 `tcorr`. Tests first (overlap, midnight split, 24 h caps, charge rounding, one-way rule, floor).
- **Build B, list + editors:** the Sessions list and row editor on the card, Edit Task and the completed-entry editors; total-typing rule; the charge preview; the damage charge with the 1 HP floor through the normal damage path; DailyRecord wiring.
- **Build C, glue + words:** the auto-stop notice opens the session row; a "Time Logged" line in How Deadline works (timers topic); docs (MECHANICS, DATA_SCHEMA, UI_UX); phone check.

## Build A as built (2026-11-04) -- differences from the design above

- `js/timerSessions.js` (pure; loaded before `timer.js`): `ensure`, `recordSession`, `validate` (reasons invalid / order / future / too-long / overlap / total-cap), `apply` / `preview` (`{ type: 'edit'|'delete'|'add' }` -> `{ ok, deltaMs, chargeHp, dayDeltas }` or `{ ok:false, reason }`), `setTotal` (the strict rule, reason `below-timed`), `forceTotal` (interim), `capCharge` (1 HP floor), `chargeIntervalMs`, `dayKey`.
- **Charge interval = `DAMAGE_INTERVAL_MS / (1 - WORK_TIMER_DAMAGE_FACTOR)`** (the damage a timer skips), 10 min today. The plan's "interval / factor" gives the same 10 min only because the factor is 0.5.
- **(Superseded 2026-11-04 by Jeremy: split at midnight, see Build B follow-up.) Day attribution = the day a session ENDS** (not split at midnight): it matches how `Timer.onSpan` reports a span today, so a session's recorded day and its edit deltas agree. Only a session that crosses midnight differs from the plan; revisit if that matters.
- **Interim:** `Timer.setLogged` (the existing Time Logged field) calls `forceTotal`: raising / lowering to anything at or above the timed sessions changes only the untimed entry; lowering BELOW them collapses the sessions into the untimed entry (what the old single number did). **Build B replaces the collapse with the `below-timed` refusal** and adds the list.
- `Timer.trackAttack(item, now, attacking)` is called by the live loop for a running timer; windows ride on `item.timer` (`attackFrom`, `attackSeen`, `attack`). A gap in ticks over `LIVE_GAP_THRESHOLD_MS` ends the window at the last tick seen (offline time was never halved).
- A span under 1 s is banked into the untimed entry (no empty row). "Started by mistake" records nothing.
- The Slipped check-in entry (`habitDef.pendingCheckIn.entry` and the rebuilt Completed entry) now carries `timerSessions` / `timerUntimedMs`.
- Not yet done: the HP charge itself, the list and editors, the `tcorr` bump call site (Build B); the auto-stop notice link (Build C).

## Build B as built (2026-11-04)

- `js/ui/sessionsView.js` (`SessionsView.html / wire`; loaded after `timerSessions.js`, before the popups): newest session first, then the untimed row ("No start/stop recorded") and "+ Add session". Edit opens Date / Start / Stop inputs (a Stop earlier than the Start is the next day, with a note line; there is no checkbox); Save session / Delete (second tap confirms) / Cancel. Live validation text: invalid, order, future, too-long, overlap, total-cap; the charge preview line appears while the edit would remove attacked minutes.
- `Items.changeSession(id, change, deps, opts)` (edit / delete / add via `TimerSessions.apply`) charges `capCharge(chargeHp, baseHealth)` through `deps.damageBase`, records run damage and `tcorr`, then settles the totals and day records (`finishLoggedChange`). `Items.setLoggedTime` is strict (`below-timed`); `{ collapse: true }` is for internal callers.
- Hosts: task card (`popupSes`), Edit Task (`editSes`), completed-entry editor (`editHabitSes`; below-timed pre-check in `saveEditedHabit`). Each keeps its hours / minutes boxes in step after a session change. Running timer: list read-only.
- (Done in Build C below.) The auto-stop notice's Edit opens that session's row (it used `{ collapse: true }`); the How Deadline works line.

## Build B follow-up (2026-11-04, from Jeremy's phone check)

- Rows show seconds under an hour so they add up to the Time Logged boxes; an untouched start / stop keeps its seconds and Save waits for a change.
- **Midnight split: sessions crossing local midnight are split across the days** (`TimerSessions.splitByDay`; live via `Timer.onSpan(item, span, from, to)` in script.js; edits via `dayDeltas`). Replaces the "day it ends" rule.
- "Stop is the next day" box removed: Stop < Start reads as the next day, with a note under the fields.

## Build C as built (2026-11-04)

- **Auto-stop notice** ("Timer stopped"): the buttons are now **Edit This Session** / Keep New Time Logged / Delete New Time Logged, and the third line says "Please fix when this run really started and stopped, or delete it." Edit opens `TimerView.showSessionEditor`: the item's Sessions list in a small window with the run that just ended already open in its editor (start / stop / Delete; the usual take-back preview) and a Done button. Delete removes that session through `changeSession` (so the halved damage for attacked minutes is taken back, floor 1 HP). The run is found with `TimerSessions.latest(item)` and must match the banked span within 1.5 s; a run under a second leaves no row, and then the old typed-total editor / `{ collapse: true }` delete is the fallback.
- `SessionsView.wire(...)` returns `open(index)` so a host can open a row from outside.
- **How Deadline works:** 8th topic `timers` "Timers and Time Logged" (damage cut while timing, the Still working? check, sessions, the untimed entry, typed totals never below the timed sessions, the take-back rule with its numbers from CONFIG, never a refund; midnight split noted). `HowItWorks.TOPIC_IDS` has `timers` (before `runs`).
- The other `{ collapse: true }` callers stay on purpose: the Break-limit "How much time did you actually spend?" editor and the check-in card "How much?" answers state the real total after the fact, so they replace the sessions' split with a typed total (nothing is taken back).

## Not doing / risks

- No cross-item overlap check (decision 4).
- Editing never changes points, XP, on-time status or completion; only time, day records and the one-way damage charge.
- Pushback while a timer runs closes the attack window, so the charge never covers minutes that were not attacking.
- A save that already holds a large `timerMsBanked` keeps it as the untimed entry forever; that is expected.
