# "How Deadline works" page + achievements swap (PLAN, 2026-11-03)

Designed in a Claude app session (Opus advice, Jeremy deciding). Status: **the achievements swap is BUILT (2026-11-03, schema 16, sw v223); the page itself is BUILT (2026-11-03, sw v224; `js/ui/howItWorks.js`, `css/howItWorks.css`, `test/howItWorks.test.js`).** Decisions are in `docs/DECISIONS.md` 2026-11-03. Build order: (1) hero window 28 -> 22 (DONE 2026-11-03), (2) achievements swap (DONE 2026-11-03), (3) this page. The page is built LAST so its words match what is in the game.

## Why
The game shows streaks, hero rankings and badges but never says what they are for, and one trap exists: streaks are VISUAL ONLY (no points since 2026-07-18), the points bonus comes from the hit rate over the last 22 scheduled times. Nothing in the game tells the player that.

## What
A "How Deadline works" button in Settings opens a window of short tappable topics (accordion). Each topic: what it is, and why it is there. Plain voice for now (Jeremy: "plain for now"). Same ones-pure-copy-module pattern as `js/pointsInfo.js` and `js/ui/pushbackHelp.js`: the numbers are read from CONFIG so the words cannot drift. Planned file `js/ui/howItWorks.js` (pure copy builder) + a small renderer in the Settings view, `index.html` script tag, `sw.js` CACHE_NAME bump and precache entry, tests (each number matches CONFIG; the streak text says streaks pay no points; the ranking text matches `Heroes`/`rankRoutines` order). Points and Pushbacks topics REUSE `PointsInfo.rulesLines` and `PushbackHelp.hintHtml`. Follow-up (BUILT 2026-11-03, sw v231): inline (i) buttons on the habit popup + streak notice (Streaks), the Heroes popup + Routines window (Hero ranking) and Stats > Achievements, all opening this window on the topic (`HowItWorks.buttonHtml` + one capture-phase document listener; see DECISIONS 2026-11-03 (info buttons + rows)).

## Approved copy (edit freely; the "Why" lines are the design intent)
**Points** (generated): task/habit pays its points; high-priority x2; habit bonus x2 at 80%+ of last 22, x3 for all 22 (x1 until 22 recorded); knocked-out routine pays nothing. NEW last line: "Slipping on a Break habit costs points and is the only thing that can take you below zero. Debt never hurts your base and has no deadline. It just keeps slips costly."

**Pushbacks** (reuse PushbackHelp).

**Streaks.** What: days in a row you've done a habit. At 3 days the zombie catches fire, at 7 it blazes. A miss resets it. Break habits keep their streak while you're away (CONFIRM against DECISIONS 2026-10-31 "Unanswered Break habits settle NEUTRAL", which says Break-habit streaks survive an absence, before shipping). Streaks don't pay points: the bonus comes from your record over the last 22 times, so one slip doesn't erase what you've built. Why: the fire is a nudge to keep the chain going; 22 repetitions is the commonly cited figure for forming a habit, so the points bonus follows that window and the streak is the day-to-day motivator.

**Hero ranking.** What: heroes are listed by level first; ties go to the better hit rate over the last 22 scheduled times, then name. Stars: 1-5 from that same recent hit rate (60/70/80/90/95%), each also needs days on record (2/4/7/14/21). Health: each miss costs health, each completion heals about a third of that, so health holds steady near 75% completion; at 0 the hero is knocked out and can be revived the next day at half health. **[BUILT COPY DIFFERS, 2026-11-03: healing by completion is decided but NOT built, so the page says only: an overdue item attacking the base also hurts its hero; at 0 health the hero is knocked out and its items become ghosts that pay no points; revived the next day at 50% health. Add the healing sentence when it is built; `test/howItWorks.test.js` has a guard that fails if the page mentions healing before then.]** Why: "Hit rate counts your last 22 scheduled times, the same window as the habit bonus and the commonly cited number of repetitions it takes to form a habit. A hero's rating shows whether the habit has taken hold, not whether you had one good week. The top of the list are the routines holding your defense up, and the bottom is a good place to look for improvements. The days requirement means one lucky completion can't earn 5 stars."

**Achievements.** Badges (Bronze/Silver/Gold/Platinum) for lasting effort, across all runs, never taken away, trophies only (no points). Families after the swap:
- Survivor: nights survived in your best run (3 / 7 / 14 / 30)
- Task Slayer: tasks completed (10 / 50 / 250 / 1000)
- Habit Hero: habits completed (10 / 50 / 250 / 1000); resisting a Break habit counts
- On Fire: best habit streak (7 / 14 / 30)
- Honor Roll (NEW): "Every day one of your heroes ends on the honor roll (3 stars or better) counts."
- Clean Sweep (NEW): "Every day you finish with nothing missed counts."
- Iron Will (NEW): "Every time you resist a Break habit counts."
- Back in Black: "Dig out of debt: slip into negative points, then earn your way back to zero or above." (single badge)
Why: badges count your whole history across runs, so a run that ends in game over still adds to them.
(Steady Hands is RETIRED and removed from the game: it only counted when a run ended and stopped growing in long runs. Tiers already unlocked stay in the save but are no longer listed. Built tiers: Honor Roll 30/150/500/1500, Clean Sweep 7/30/100/365, Iron Will 7/30/100/365. Dropping Steady Hands completely was Jeremy's call 2026-11-03; the Iron Will ladder is a proposed starting point to retune with play data.)

## Achievements swap (build task 2; BUILT 2026-11-03: see docs/ECONOMY.md "Achievements swap" and DATA_SCHEMA schema 16)
Retire `steady_hands`; add three families. New lifetime counters: `heroHonorDays` (each closed day, every hero banked at >= `HERO_HONOR_ROLL_STARS` (3) adds 1; data is DailyRecord v3 `stars`), `cleanDays` (a closed day with something due and nothing missed; same rule as VillageProgress' clean-day helper), `breaksResisted` (an avoided Break habit; DailyRecord `lurk.avoided`). Needs: `lifetimeStats` shape + schema bump + one-time retro sweep of `deadline.days`, live wiring at day close, tier thresholds via the balance-tuning protocol (suggested start: Clean Sweep 7/30/100/365, Honor Roll 30/150/500/1500, Iron Will TBD), catalog entries in `CONFIG.ACHIEVEMENTS`, stats view, tests with negative controls. `STEADY_HANDS_MIN_*` config and the run-end code can be removed once nothing reads them.

## Model
Page: Sonnet, medium. Achievements: tier design Fable/Opus, build Sonnet medium.

## Added 2026-11-03: topic 7, "When a run ends" (id `runs`)
Copy lives in `js/ui/howItWorks.js` `runsTopic` (slot-unlock levels are read from `CONFIG.ROUTINE_SLOTS_PER_LEVEL`). Says what the next run keeps (habits / routines / heroes, open tasks, routine slots never below the best, items that cannot be re-earned) and what starts over, with a "Why". Same facts as the game-over card's "Next run" lists; if one changes, change both (`docs/RUN_CARRYOVER_PLAN.md`).

## Addendum (2026-11-04): 8th topic

`timers` "Timers and Time Logged" was added (before "When a run ends") by Timer sessions Build C: damage cut while a timer runs, the Still working? check, sessions + the untimed entry, typed totals never below the timed sessions, the take-back rule (numbers from CONFIG). See docs/TIMER_SESSIONS_PLAN.md "Build C as built".

## Addendum (2026-11-05): 10th topic, "Goals" (id `goals`)
Copy in `js/ui/howItWorks.js` `goalsTopic` (slot ladder read from `CONFIG.GOAL_SLOTS_PER_LEVEL`). Includes the reward lines (Build C): `PointsInfo.goalRewardLine(config)` (bonus percentages and the Earned Sick Day, read from `CONFIG.GOAL_REWARDS`; no XP) plus the self-reward and next-period-edit sentence; both appear only when `CONFIG.GOAL_REWARDS` exists. (i) button on the Stats Goals heading.

## Addendum (2026-11-11): 11th topic, "Nights and momentum" (id `momentum`)
Copy in `js/ui/howItWorks.js` `momentumTopic`, placed after "When a run ends". States the defended-night rule (1 priority at least `CONFIG.MOMENTUM.MIN_PRIORITY_AGE_MS` old, or 1 routine fully completed; late counts), what counts defended nights (Nights Survived, Radio tower, Survivor, tree), momentum over the last `WINDOW_NIGHTS`, days away and Sick Days, and the barricade states from `BARRICADE_STATES`, with a "Why". Anything built against cheating is explained here (Jeremy). See docs/MOMENTUM_PLAN.md.
