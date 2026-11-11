# Live sky -- today moves the weather (designed 2026-11-11, Opus 5.5 + Jeremy)

Jeremy: "what if today starts off great but then turns to crap as the day goes on ... it would be good user feedback for them
to see the weather drop if their current moment is impacting it, and likewise if they had a very productive day that lifts
them out of it." Status: DESIGNED + APPROVED (option B, Jeremy 2026-11-11: "it will make the weather match how the user might feel as their day progresses"), BUILT 2026-11-11 (Sonnet 5.5, sw v327; DECISIONS 2026-11-11 (live sky)).

## The rule in one line

The sky the canvas wears = the closed-day climate (unchanged) blended with TODAY's score so far, where today's share grows
with how much of today has resolved and, at full strength, is what today would weigh if it were `liveWeight` (2) newest
days. So the sky follows how the day feels; at rollover (usually overnight) it settles back to today's real 1-day weight.

## 1. Today's score so far (`RunClimate.liveParts(todayRec, options)`, pure)

Read from the open DailyRecord (`State.getToday()`), which already counts live: `done`, `missed` (bumped when an item goes
overdue), `lurk`, `dmg`. `due` is only stamped at close, so "due so far" is derived:

- `doneN = done.task + done.habit`
- `dueSoFar = max(doneN, done.task + done.habit + missed.task + missed.habit - done.late)`
  (a late finish was already counted once as missed; items due later today are in neither, so they never count against you)
- `onTime = dueSoFar > 0 ? (doneN - (1 - lateCredit) * done.late) / dueSoFar : null` (clamped 0..1, same as a closed day)
- `habits`, `church`, `score` = exactly the closed-day formulas (`partsWith`), so a closed day and the live day agree.
- `resolved = dueSoFar + lurk.avoided + lurk.slipped` (things the day has actually judged). `null` parts when nothing resolved
  and no damage: today has no say yet.
- Sub-tasks stay out (v13 rule): `done.subtask` / `missed.subtask` are not read.

## 2. How much today counts (the ramp)

- `ramp = min(1, resolved / CLIMATE.liveFullAt)` -- **new dial `liveFullAt = 4`** (four resolved items = full strength).
- Full strength (**option B, new dial `liveWeight = 2`**): today weighs `liveWeight` against the closed days each moved back
  one step (x decay): `fullShare = liveWeight / (liveWeight + decay * Wclosed)`, where `Wclosed` = the closed window's weights
  incl. the start prior, as `climateAfter` builds them. A full week gives ~0.34 (option A, liveWeight 1, would be ~0.21);
  early in a run (prior still heavy) it is smaller.
- Rejected: option A (liveWeight 1 = exactly the closed weight, no settle at rollover) -- honest but too quiet mid-band
  (Hazy 0.80 + a 0.30 day stays Hazy). With B the same day reads Overcast; the overnight settle is the accepted cost.
- `liveScore = closedScore * (1 - a) + todayScore * a`, `a = ramp * fullShare`.
- Church damage needs no ramp of its own: a hit means a zombie went overdue, which already counts as resolved.

## 3. Band, hysteresis, what stays closed-day only

- `band = nextBandIndex(closedBandIndex, liveScore)` -- recomputed from the CLOSED band every time, never stored, so the
  live part cannot ratchet or flicker; the existing 0.03 hysteresis still applies.
- **Live:** the canvas sky, rain, the badge icon, the Weather panel band + line, the Stats readout.
- **Closed-day only:** the trend arrow / "Clearing / Worsening", the "real band moved" toast (`watchRealSky` reads the new
  `closedBand`), sky unlocks (already level / village based, untouched), Windmill / best days, DailyRecord (no new field, no
  `V` bump: the live score is never saved).
- Off during game over, for a forced / dev sky, and when `today.run` is not the current run.

## 4. Readouts

- Weather panel + Stats table: first row **"Today so far"** (italic, `wx-row--live`) from `liveParts`, or "Nothing judged
  yet" when it is null; then the finished days. Heading: "Today and the last N finished days".
- Footer: "Today moves the sky as it fills in, and counts extra until it closes." (replaces "The sky changes once a day").
- How Deadline works > The sky: one line saying today moves the sky as it goes.

## 5. Wiring (script.js `realClimateNow`)

The closed result stays cached per day (unchanged). On top: `RunClimate.withToday(closedResult, todayRec, runNumber, CONFIG.CLIMATE)`
returns `closedResult` itself when today has no say, else a NEW result `{ ...closed, band, bandIndex, score, closedBand,
closedBandIndex, closedScore, today: parts, live: true }`, cached by a signature of the counters it reads, so `skyNow()` /
`ClimateView` (identity-compared) only see a change when a counter changed.

## 6. Tests (`test/runClimate.test.js` + `test/weatherPanel.test.js`)

liveParts formulas (late counted once; future items never count); ramp 0 -> identical to closed; liveWeight 1 + full ramp ~= the
closed result after that day closes; liveWeight 2 lands further toward today; hysteresis from the closed band; trend + closedBand unchanged;
forced / game over / other run -> closed result returned as-is; signature cache returns the same object; panel's live row.
CONFIG.CLIMATE.liveFullAt + liveWeight mirrored in DEFAULTS (existing mirror test).

## As built (2026-11-11)

- `RunClimate.liveParts` reuses `partsWith` on a copy of the open record with `due` set to "due so far", so live and closed days share one formula. `closedWeight(n)` + `withToday` as in sections 2-3; `withToday` returns the closed result itself when today has no say.
- Not exact at midnight: closing also slides the 7-day window (the oldest closed day drops out) and fades the start prior; with `liveWeight` 1 the live and post-close scores differ by < 0.01 (tests).
- The panel shows "Today so far" for every real (non-forced) sky; "Nothing judged yet" while the day has resolved nothing, and after game over (no live layer then).
- `watchRealSky` / `armSkyWatch` read `result.closedBand` first, so the toast follows finished days only.
