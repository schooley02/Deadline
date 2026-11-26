# Lab stars plan (people cured)

DESIGNED 2026-11-26 (Fable 5.2, Claude app; Jeremy approved all five picks: "I'm good with your recommendation to start with" / "i agree" x4).
BUILD A BUILT 2026-11-26 (Sonnet 5.5; engine + data, no new screen; DECISIONS 2026-11-26 "Lab stars Build A"). BUILD B (what the player sees) NOT BUILT.
The Lab building is wired (kind `goals`) and now has real stars from Build A (DECISIONS 2026-11-26 "Lab wired").
Read with `docs/GOALS_PLAN.md` (goal rules) and `docs/WORLD_FEEDBACK_PLAN.md` "Village tiers + building cards".

## What it is

The Lab is the ninth village building. Its stars count **people cured this run**, earned by goals. A tap on the Lab opens the Goals
window ("The Lab"). Like every building its tier is per-run, never goes down within a run, and starts at star 1 on a new run.
Goals themselves still carry across runs.

## The core rule

**Every goal slot can earn about one person cured per week, whatever shape the goal has.** Longer shapes earn a little more per
week; dailies earn the least. Counting is in tenths of a person ("credit", an integer) so a daily goal can be worth something small.

| Goal shape | Credit (tenths) | People | Per slot per week |
|---|---|---|---|
| Daily period met | 1 | 0.1 | up to 0.7 |
| Weekly period met | 10 | 1 | 1.0 |
| Monthly period met | 50 | 5 | about 1.15 |
| One-time goal, new stage reached | 12 per week since the last paid stage | 1.2 per week | 1.2 |

Rules:

1. **Recurring goals pay once per period**, on the night the target is reached (at that day's close), not at the period's end.
   A per-goal marker holds the last period paid. Taking progress back later does not refund and cannot pay twice.
2. **One-time goals pay when the patient reaches a NEW stage** (a high-water mark per goal: each stage once). The payment is
   `round(12 * days / 7)` where `days` = time since the later of: the goal's creation, its last paid stage, the start of this run.
   So a goal made and ticked in one sitting pays about nothing, several stages jumped at once pay only the time that passed, and
   a six-month goal cures about 30 people across its stages. This is the "cannot pay more than the time it was open" rule.
   Paid at the moment the stage is reached (a finished one-time goal leaves its slot at once, so it cannot wait for the close).
3. **This run only.** Only periods met and time passed inside the current run count. Time a one-time goal was open in an earlier
   run is not paid in this one.
4. **Never goes down.** A missed period or a relapse shows on the patient (stage down), never on the count.
5. **Daily cap: at most 2 daily goals at once**, in the shared slot pool. Checked when a goal is added (a goal's period cannot be
   edited). Dailies already above the cap stay.
6. **No yearly period.** A one-time goal with a deadline covers yearly and lifetime goals. Periods stay day / week / month.
7. **Nothing else changes:** the points bonus, the Earned Sick Day item and the goal slots per level stay as they are.

## Star ladder (THEORY numbers, balance process)

Stars 2 to 5 at **1 / 6 / 18 / 40 people cured** (credit 10 / 60 / 180 / 400).

| Player | Credit per week | Star 2 | Star 3 | Star 4 | Star 5 |
|---|---|---|---|---|---|
| 4 goals going reasonably well (1 daily 5 of 7, 2 weekly at 75%, 1 one-time) | about 32 | first days | about 2 weeks | about 6 weeks | about 12.5 weeks |
| 3 goals (1 daily, 1 weekly, 1 one-time) | about 22 | first week | about 3 weeks | about 8 weeks | about 18 weeks |
| Dailies only (2, every day) | 14 | about 5 days | about 4 weeks | about 13 weeks | about 28 weeks |
| Six slots of trivial weekly goals (cheating) | 60 | first week | 1 week | 3 weeks | about 6.5 weeks |

Target pacing for the village is star 2 about 4 days, star 3 about 2.5 weeks, star 4 about 7 weeks, star 5 3+ months.
Known limit, accepted for now (Jeremy): trivial goals in every slot reach star 5 in about 6.5 weeks. Same class as marking easy
priorities. A weekly cap on cures is the lever if play data shows it matters; it was left out because it would also cap an honest
long one-time goal.

## Memorial with nine buildings

The Memorial's stage becomes floor(average of NINE best tiers). Adding a ninth building at star 1 would lower the average, so the
stage itself is saved as a high-water mark (`bestMemorialStage`, a root save field like `bestVillageTiers`) and the shown stage is
max(saved mark, the nine-building average). It never drops. Rejected: gifting the Lab a starting best tier equal to the current
Memorial stage (it would show a star the Lab never earned).

## Goals window header

Five star pips, "People cured this run: 12", "6 more to star 4" ("Fully rebuilt" at star 5), a "Tonight: +1.0" line when a recurring
goal has reached its target and is waiting for the day to close, and an info button: what the Lab measures, why it helps, and the
rules above. The anti-cheat rules (time-based pay for one-time goals, once per period, the daily cap, this run only) also go into
"How Deadline works".

## Not in this design

- The Goals button stays in the top bar (it carries the pace dots, and the Lab is still partly under the graveyard). Revisit when the
  graveyard moves or in the UI rework. It must always stay in the upright phone view (the village is hidden there).
- Tank art inside the Goals window that matches the building: its own art session.
- A themed star-5 item: the Lab uses the default drop ladder.

## Builds

**Build A, engine and data (Sonnet, medium).** No new screen.
- `js/config.js`: `GOAL_CREDIT: { day: 1, week: 10, month: 50, oneTimePerWeek: 12, perPerson: 10 }`, `GOAL_DAILY_MAX: 2`,
  `VILLAGE_TIER_THRESHOLDS.goals: [10, 60, 180, 400]` (credit; a comment gives the people numbers). Log in DECISIONS as new numbers.
- `js/goals.js` (engine words only: "credit", never the theme nouns; `test/wording-rule.test.js`): per-goal fields `creditKey`
  (last period key paid), `creditStage` (highest stage paid), `creditAt` (ms of the last paid stage), normalized in `normalizeGoal`;
  pure helpers for the recurring check and the one-time payment; the daily cap in `addGoal` with a clear refusal reason.
- `js/state.js`: pay one-time credit where milestones are settled (`settleMilestones` call site, line about 1114) and recurring
  credit at day close (near the `closePeriods` call site, about 1148); `bumpToday('pgoal', { credit })`; additive root field
  `bestMemorialStage` (save / load, raise-only setter).
- `js/dailyRecord.js`: v19, `pg.credit` (tenths; older days read 0); sanitize, merge and roll-up like `pg.pts`.
- `js/villageProgress.js`: `'goals'` in `KINDS`, `DEFAULT_THRESHOLDS.goals`, counter = this run's closed days' `pg.credit` plus the
  open day's (the Clock tower pattern). `js/memorial.js`: nine kinds; `stage(best, savedStage)`.
- Check everything that iterates the kinds: `villageDrops.js` + `VILLAGE_TIER_DROPS` (default ladder), peak tiers in run records,
  `villagePanel.js`, `memorialPanel.js`, `devDemo.js`, sky unlocks, the star-up notice. `script.js` `villageTierDep('goals', ...)`
  already falls back to tier 1 and picks the real tier up once `VillageProgress` has the kind.
- Tests: goals credit (each shape, once per period, stage high-water, one-sitting pays 0, run-start clamp, multi-stage jump),
  the daily cap, DailyRecord v19, the Lab counter and ladder, Memorial nine + never drops, wiring. sw bump.

**Build B, what the player sees (Sonnet, medium).**
- Goals window header strip (pips, people cured, to next star, Tonight line, info button). Theme words from `js/theme.js`.
- Goal card: one line saying what this goal pays.
- "How Deadline works": a Lab topic with the rules. Add Goal form: the daily-cap message.
- Village panel / Memorial panel rows for the Lab (a Lab row opens the Goals window, not a card). sw bump.

**Later:** balance check with real play data (the ladder and the four rates), the Goals button, the tank art, the graveyard move.
