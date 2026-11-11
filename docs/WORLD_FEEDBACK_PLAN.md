# World Feedback Plan — sky, distant city, graveyard (visual track V7)

**Status: DRAFT, brainstormed 2026-10-27 (Claude app session, Opus; mockups + first decisions
same evening).** Items marked PROPOSED wait for Jeremy's call; DECIDED items are logged in
`docs/DECISIONS.md` (2026-10-27 "World feedback V7").

**Mockups:** Design canvas "Deadline World Feedback Mockups" (7 artboards: zone map, good day,
bad day, horde vs meteor, graveyard tiers, stronghold Target types).

**DECIDED 2026-10-27 (Jeremy):**
- The existing V1 decorative trees + tombstones (inline SVG in `index.html` `.scene-silhouettes`
  / `.scene-ground`) are REMOVED entirely when V7 lands — replaced by the real graveyard
  markers, not kept alongside them.
- Past-day review is NOT the reason to save per-day data. The daily record exists for (1) future
  in-game AI insight ("what worked for you, at which times of year") and (2) best/worst days per
  run in Stats. A back-paging Day Pager is unneeded unless a real use case shows up.
- Mockups first for the deadline threat (horde vs meteor) — both drawn; pick pending.

**DECIDED 2026-11-03 (Jeremy + Opus):** the sky becomes a **run climate** (last ~7 closed days of this run, five
weather bands, haze by depth, fog only at Fog, the night count lifted above the weather, a weather badge as the tap
target). Full design: "W1 Run climate" below; DECISIONS 2026-11-03 "Run climate".

## Goal

Turn the empty parts of the landscape/desktop scene into game-like, at-a-glance feedback:
how today is going, how long-term goals are going, and what the player has achieved over time.
Theme: undead apocalypse. Background feedback must never compete with the zombies.

## Organizing principle (PROPOSED)

Each region of the scene owns ONE time scale, so the player always knows where to look:

| Region | Time scale | Shows |
|---|---|---|
| Lane / field + church (exists) | Right now | Zombies, base damage, heroes |
| Sky (moon exists, top-right) | Last ~7 days of this run (changed 2026-11-03, see "W1 Run climate") | How the run is trending |
| Distant city (new, behind the hills) | Weeks–months | ~~Goals and their Targets~~ (2026-11-04: goals moved to their own pane, `docs/GOALS_PLAN.md`; the band is free) |
| Right-side graveyard (new) | All time | Achievements, past runs, lifetime nights |

Why not map city windows to today's zombies (Jeremy's first idea): the field already shows
today's items one-to-one; a second copy in the skyline repeats it at a size that is hard to
read on a phone. The skyline is the only free real estate big enough for something long-lived.

## Global rules (PROPOSED)

1. Background layers stay low-contrast / desaturated; zombies always read first.
2. Anything carrying information is tappable and opens its exact numbers (same pattern as the
   Base Health button; for the sky, the weather badge -- the moon itself is display-only).
3. All motion is fx-gated (`fx-reduced` / `fx-off` / reduced-motion), like V1's clouds.
4. The landscape-only regions (city, graveyard) need a portrait entry point elsewhere
   (Stats window / a Goals window) — the portrait glance strip has no room for them.
5. Pure model module + thin view per region (like `baseModel.js` / `basePanel.js`), so the
   mapping rules are unit-tested without a DOM.

## Region 1 — Sky: today's pace (no new features needed)

**SUPERSEDED 2026-11-03** by "W1 Run climate" below: today's damage / overdue / missed habits already
have visuals (Base Health, red rows, check-ins), so the sky now shows the run's recent TREND instead.
The text below is kept for history.

PROPOSED, all derivable from existing state:
- **Weather = day mood.** Clear dusk when on pace; red haze builds with base damage taken
  today; storm clouds when several items are overdue at once; fog thickens per missed habit.
- **Crows circling** = lurker (negative habit) damage today; more crows, more damage.
- **Flares / fireworks over the city** on player level-up and goal completion (a V6-style
  juice moment).

Open: exact thresholds (that is balance-adjacent display tuning — put the numbers in
`CONFIG`, not hardcoded). Interaction with the existing cloud layer (clouds drift in front of
the moon since 2026-10-27).

## Region 2 — Battlefield aftermath (needs a data decision)

Idea: when reviewing a day, the field shows what happened — remains for completed items,
scorch marks / broken fence boards for items that reached the church, craters for heavy hits.

**Finding 2026-10-27:** the Day Pager only pages FORWARD (today + up to 6 days ahead), and the
save has no per-day record — DECISIONS 2026-07 chose "lean totals + per-routine rollup, no raw
event log" for runs. So past-day review is NOT a visuals-only job. Options:
- (a) **Today-only aftermath** (decals accumulate through the current day from
  `completedItems[].completedAt` + live damage) — no schema change. Smallest.
- (b) **Daily summary record** — one small object per local day (completed counts by category,
  damage taken, overdue items, habits missed) written at midnight rollover; enables
  back-paging the Day Pager. Schema bump + migration; one-per-session guardrail applies.
- (c) Defer.
Recommendation: (a) now; (b) as its own Fable/Opus design session if past-day review is wanted.

**Update 2026-10-27 (Jeremy):** (b) is wanted, but for a different reason — not for paging the
canvas back, but as the raw material for in-game AI insights (what worked, when, seasonality)
and for "best / worst day per run" in Stats. So D2 becomes a DATA design session: what the daily
record must hold to answer those questions later (per-category completions, damage taken,
overdue counts, habits missed/kept, time-of-day of completions, points delta, weather level),
compaction/size policy over months, export/import coverage. The aftermath decals stay
today-only (a) regardless.

## Region 3 — Distant city: goals (depends on the Goals feature)

**SUPERSEDED 2026-11-04 (Fable, Jeremy; `docs/GOALS_PLAN.md`, DECISIONS 2026-11-04 (goals)):** goals live in their own PANE, not on the skyline, and the skyline gets nothing for now. Why: the skyline is hard to read on a phone (said below), the village now holds the ridge, N goal buildings would be identical (breaking the AT-A-GLANCE DISTINCTNESS RULE) or N designs per theme, and a canvas region cannot hold the form or a variable slot count. The "building stays in the skyline as a record" idea may return later as one lit window per finished goal. Text kept for history.

Prerequisite: Goals + Targets (Jeremy's sketch: Number range, True/False, Currency, Task/list
Targets; tasks and habits can be tied to a goal). That is a separate design session (Fable —
schema, mechanics, UI). This region only renders it.

PROPOSED mapping — each goal is a **survivor stronghold being fortified** (the city is where
the living hold out):
- Number Target → floors / barricade layers fill in as the value moves through its range.
- True/False Target → a rooftop piece (flag, radio mast, water tower) appears when done.
- Currency Target → generators come online; windows light up as the total rises.
- Task Target → a crane hoists sections as tasks / sub-tasks complete.
- Goal complete → rooftop beacon lights; the building stays in the skyline permanently, so
  the skyline becomes a record of finished goals.
- Tap a building → goal panel (Targets, progress, linked tasks/habits).
- Before Goals exist: a ruined, dark skyline silhouette "waiting to be rebuilt".

Open: how many buildings fit (cap + "+N"?); window lights vs category colors; does a goal's
building height mean importance, size of goal, or nothing?

## Region 4 — Deadline threat on the horizon

**SUPERSEDED 2026-11-04 (with Region 3):** the deadline threat is the Goals pane's pace dot (green ahead / amber behind / red overdue) and deadline line; no horde or meteor on the horizon. Text kept for history.

For goals with a deadline. Two candidates (PROPOSED: horde; meteor still on the table):
- **Horde on the horizon:** a dark dust-mass marching toward that goal's building. Distance =
  time left; grows larger and closer as the date nears.
- **Meteor** (Jeremy's idea): crosses the sky, gets larger and lower as the date nears.

Either way, combine TIME with PROGRESS: the threat advances with the clock, the building's
walls (or a dome shield for the meteor) strengthen with progress. Ahead of pace → walls
visibly outclass the threat; behind → it looks like the threat wins. Deadline passes with the
goal unfinished → building overrun, left as a ruin that can be rebuilt.

Open: what "on pace" means per Target type (linear expected progress vs. deadline is the
simple default); whether a missed goal costs anything in-game (that is a mechanics/balance
call, not a visual one — default: visual only).

## Region 5 — Right-side graveyard: achievements and history

Jeremy's idea: graveyard + spooky tree; tapping a headstone opens that aspect's achievement
list. PROPOSED extensions:
- **One marker per achievement family** (`CONFIG.ACHIEVEMENTS` has ~6: Survivor, Task
  Slayer, Habit Hero, On Fire, Honor Roll, Clean Sweep, Iron Will, Back in Black since the 2026-11-03 swap, so 8), material upgrades with tier:
  none → wooden cross → stone (Bronze) → … → mausoleum (Platinum). Progress readable before
  tapping. Tap → that family's tiers + near-miss nudge (reuse `Achievements.nextLockedTier` /
  `nearMissNudges` and the Stats badge markup).
- **A small grave per finished run** with an epitaph ("Fell after 12 nights"), from
  `pastRuns`. Cap the visible count; older runs fade or move to Stats.
- **The tree grows with lifetime nights survived** (sapling → twisted giant; lanterns / crows
  for long streaks). BUILT 2026-11-08 (sapling / young / giant at 0-29 / 30-99 / 100+ nights); lanterns / crows not decided.
- Optional: a fresh grave for a KO'd hero until revived (may be one thing too many).

**Superseded by "W0 layout" below for placement (tree on the right edge, run graves in the field).**
DECIDED 2026-10-27: the V1 decorative tombstones AND the 3 bare trees are removed outright
(Jeremy); the graveyard markers + the growth tree replace them. Marker size vs tap-target minimum (44px hit area, visual can
be smaller — the V3c-1 chip trick).

## W0 layout — DECIDED + BUILT 2026-10-28 (Jeremy + Opus plan, Sonnet build)

Mockups: Design canvas "Deadline World Feedback Mockups", boards 7a-7f (7f is a live tweakable scene).

- **Graveyard hill = its own zone on the RIGHT of `#gameCanvas`, fixed `CONFIG.GRAVEYARD_HILL_WIDTH_PX`
  (140).** Landscape + desktop only (hidden in the portrait strip by css/glanceStrip.css). Full brightness
  (not dimmed: it is interactive and must look tappable). The zombie field ENDS at its left edge:
  script.js `GAME_SCREEN_WIDTH = canvas width - GraveyardView.zoneWidth()` (measured, so 0 in portrait).
  `Clock`/`Movement` are unchanged: even tasks due days away sit in the 75-100% zone, so a zombie's right
  edge never passes the field edge. Zombies "spawn" just left of the hill.
- **Achievement headstones stand on the hill in 3 staggered lanes** (lane rise 28px, odd lane shifted half
  a 44px pitch so a back stone peeks between two front stones). One button per family
  (`CONFIG.ACHIEVEMENTS`), 44px tap box, tap -> Stats. W0 art is a placeholder stone for every family;
  tier art (wooden cross -> mausoleum) is W2. 140px holds 6 families (capacity = `GraveyardLayout.stoneCapacity`).
- **The tree is its own graphic at the right edge, pushed partly off-screen** (only a trunk strip +
  the canopy overhanging the back stones show). It sits in a clipper (`.graveyard-tree-clip`) because
  `#gameCanvas` is `overflow: visible` and `clip-path` does NOT stop an element widening the page
  (found live: 18px horizontal overflow). Placeholder SVG; growth stages (sapling/young/giant by lifetime
  nights) are W3.
- **Past-run graves creep out across the FIELD:** newest next to the hill, oldest furthest left, on the
  same 3 lanes as the zombies, each drawn just UNDER its lane's zombies (z = `LIST_Z_MIN + lane*STRIDE - 1`)
  so zombies walk over them; low contrast (opacity 0.7), 26px tall (a zombie box is 128px). Placement is
  seeded by the run number (stable as newer runs push a grave left): jitter, lane, height, tilt. Spacing
  starts wide (110px) and tightens with the run count (min 22px); the oldest FADE over the last 90px before
  the church and graves past the church are dropped from the scene (Stats lists every run).
  Tappable wherever no zombie covers them -> Stats. Hill width does not grow with runs.
- The moon moves left of the hill (`right: hill width + 12px`) so a grown tree never covers it.
- **Overflow zombies fan LEFT at the hill.** `Layout.computeGroundLayout` takes `opts.fieldRight`
  (script.js passes `GAME_SCREEN_WIDTH`): a 4th+ stacked zombie that would fan right across the field edge
  fans left toward the church instead (same distance, never past the church), so none stand on the stones.
- Pure maths: `js/graveyardLayout.js` (tests: graveyardLayout, graveyardView, graveyardWiring, layout +3).
  DOM: `js/ui/graveyardView.js` (render is signature-gated and called from `refreshLayoutDims` + afterTick).
  Geometry in `CONFIG.GRAVEYARD_*` / `CONFIG.RUN_GRAVE_*`; CSS `css/graveyard.css`.
- **Known limitations (W0):** (1) sub-tasks fan to the RIGHT of their parent (Movement), so a late-today
  parent's sub-tasks can stand on the hill edge. (2) The "+" FAB (bottom-right) overlaps the lowest ~20px of
  the front-lane stones' tap boxes on a landscape phone. (3) Placeholder art only; no tier art or tree growth.

## Village tiers + building cards -- DECIDED 2026-10-30 (night), build plan (Opus plan -> Sonnet build)

Decisions, counters and thresholds: DECISIONS 2026-10-30 (night). Summary: each building's tier is progress in the CURRENT
run (only up, back to T1 on game over), read from one per-run counter against `[T2, T3, T4, T5]` thresholds. Tapping a
building opens a card that shows how far it is to the next tier.

| Kind | Building | Counter (per run) | Source | T2 / T3 / T4 / T5 |
|---|---|---|---|---|
| `nights` | Radio tower | nights survived | `Damage.computeDaysSurvived` | 4 / 18 / 50 / 100 |
| `slain` | Command Post (the Armory until 2026-11-09) | priority tasks finished, max 3 a day (completion day) | daily records `pri.d` (closed days + today) | 8 / 36 / 100 / 200 |
| `punctuality` | Clock tower | completed on time | daily records: done - late | 25 / 120 / 350 / 750 |
| `habits` | Hospital | GOOD habit check-ins (2026-10-31: positive habits only; resisting bad habits is the Boxing gym's) | `currentRunStats.goodHabitsCompleted` (falls back to `habitsCompleted` on older runs) | 20 / 80 / 250 / 500 |
| `lurkers` | Boxing gym | days with no slips (>= 1 bad habit due, 0 slipped) | daily records `lurk` | 3 / 14 / 40 / 80 |
| `defense` | Jailhouse | nights the church held (day ended >= 75% health) | daily records `base.endHp` | 3 / 14 / 40 / 80 |
| `heroes` | High school | hero stars banked (each closed day adds every routine's star rating, 0-5 each; High school v2, 2026-10-31) | daily records `stars` | 10 / 75 / 300 / 750 |
| `bestdays` | Windmill | heavy days handled (due > avg of last 14 closed days, >= 3 days history, 0 missed) | daily records `due`/`missed` | 2 / 5 / 15 / 30 |

Day-based counters use this run's closed days in `deadline.days` (matching `run`) plus the open `save.today` where it
makes sense (a day only counts once it can no longer change: closed days for `defense`, `heroes`, `bestdays`, `lurkers`;
`punctuality` may include today's running count). Days recorded before a field existed simply do not count.

**Build 1 -- data + pure model (Sonnet, medium; Jest):**
1. `CONFIG.VILLAGE_TIER_THRESHOLDS = { kind: [t2, t3, t4, t5] }` plus `VILLAGE_DEFENSE_HELD_FRAC` 0.75,
   `VILLAGE_HEAVY_DAY_WINDOW` 14, `VILLAGE_HEAVY_DAY_MIN_DAYS` 3 (balance numbers, already approved; comment them as such).
2. Daily record: add per-day routine attendance (e.g. `routines: { active, perfect }` or per-routine due/done, decide in the
   build) bumped through the existing `recordDaily` seams; frozen/KO'd routines excluded; bump `DailyRecord.v`, note it in
   `docs/DATA_SCHEMA.md` (CLAUDE.md daily-record rule). Check first whether `load.routines` already covers "active".
3. New pure `js/villageProgress.js`: `counters(ctx)` -> `{ kind: value }` from `currentRunStats`, nights, this run's day
   records + today; `tierFor(value, thresholds)` -> `{ tier, value, nextAt, toNext, maxed }`; `heavyDays`, `comebackDays`,
   `attendanceStreak` helpers. Tests in `test/villageProgress.test.js` (each counter, threshold edges, history < 3 days,
   no-routine / no-bad-habit days, reset on a new run).

**Build 2 -- real tiers + building card (Sonnet, medium; Jest + live check) -- BUILT 2026-10-30 (sw v145; see DECISIONS 2026-10-30 night "Village Build 2"):**
1. script.js `get<Kind>Tier` read `VillageProgress`; the dev URL params (`?gymTier=` etc.) still override for art checks.
   A new game shows a T1 village.
2. Tappable buildings: `.village-layer` stays `pointer-events: none`, `.village-sprite` gets `pointer-events: auto` +
   cursor; zombies (z 30+) stay above so they keep their taps. Watch the transparent corners of each 128px canvas (alpha
   hit-test or the `VILLAGE_ART_X` box) and the back row tucked behind the front row.
3. `js/ui/villageCard.js` + `css/villageCard.css`, opened through `Modal` like the level panel (the opening click MUST
   `stopPropagation`): sprite at 2x, building name, one-line "what it measures", T1-T5 pips, progress bar
   "N / M <unit> to reach T<n+1>", "Fully rebuilt" at T5. Extra lines: school = current attendance streak; windmill =
   comeback days this run. Empty states: gym with no bad habits = "Add a habit to resist to start rebuilding"; school with
   no routines = "Start a routine to open the school".
4. sw.js bump + new files in `APP_SHELL`; ART_STYLE/UI_UX notes; live check in the pane and on a phone.

**Build 3 -- BUILT 2026-10-30 (Sonnet; sw v158; Jest 101 suites / 2,348):** each run record keeps every building's peak tier
(`peakVillageTiers`, additive; read in `Damage.gameOver` BEFORE the record joins history, because the live village derives
its run from history length); the game-over card shows the eight thumbnails ("Village at its peak, N / 40 tiers", shared
`VillagePanel.peakStripHtml`); past-run cards show "Village: N / 40 tiers" plus the thumbnails when expanded; the scene holds the
peak while the game is over and Restart returns it to T1. Side fix: portrait game-over card centred on the viewport.
Condition overlays stay their own queued item.

**Tier drops BUILT 2026-11-03 (Claude app session, Opus design -> Sonnet build; sw v235; Jest 151 suites / 3,258; DECISIONS 2026-11-03 "village tier drops"; docs/ECONOMY.md "Village tier drops"):** reaching star 2-5 on any building pays one fixed item into the held inventory (shared ladder Medium Pushback / Small / Medium / Large kit, themed star-5 Cheat Day / Skip Day / Sick Day on the gym / hospital / radio tower), once per star per run via the ledger `currentRunStats.villageDropsPaid`, shown as a Next item line on each card and one batched notice. Paid from the real tiers only; existing stars are paid once on first load.

## High school v2: banked hero stars + report card -- DECIDED 2026-10-31 (Claude app session, Opus; Jeremy). BUILT 2026-10-31 (Sonnet; steps 0-5, sw v164; see DECISIONS 2026-10-31 "High school v2 BUILT").

**Why:** the High school counted perfect-attendance days (every active routine fully done). One routine with one easy item
farms a day every day, and every routine you add makes a perfect day HARDER -- it punished the player we want. Jeremy's goal:
players should SEE that their routines are working, through a number that measures it.

**Decided:**
- **Counter = banked hero stars.** At each day's close, every routine banks its CURRENT hero star rating (0-5, the existing
  `Heroes.completionRate` + `Heroes.starRating`, same window as the hero chips: `max(routine.createdAt, runStartedAtMs)`,
  last `HERO_STAR_RATE_WINDOW` = 28 occurrences, `HERO_STAR_TIERS` rate + tenure). The High school counter = the sum over
  this run's closed days. Frozen or KO'd routines bank 0 that day. One-item routines count (Jeremy: yes).
- **Honor roll = 3 stars or better (80%+ with >= 7 days).** It is a LABEL on the report card, not the counter. Rejected as
  the counter: it pays nothing for lifting a 1-star routine to 2 (players would drop weak routines instead of fixing them)
  and nothing extra for great routines.
- **Cheating bounds:** routine slots cap the farm (1 slot at the start, max 4 at Lv3/5/7, so max 20 stars a day); stars need
  tenure (2-21 days); a re-made routine restarts its history. Ticking items off without doing them is not detectable by any
  metric.
- **Thresholds (theory pass, replace `CONFIG.VILLAGE_TIER_THRESHOLDS.heroes` [3, 10, 30, 60]):** T2 **10** / T3 **75** /
  T4 **300** / T5 **750** banked stars. Model: ~85% completion, routines added as slots unlock; lands ~end of week 1 / ~3
  weeks / ~7 weeks / ~100 days (Radio tower pace: 100 nights for T5). Re-check with real play.
- **Report card** (Jeremy: on the High school card AND on each routine's own card, the Manage Routine window): one row per
  routine -- name, stars, completion % over its last 28 check-ins, an "Honor roll" mark at 3+ stars, and the next step
  ("90% for 4 stars", or "N more days" when tenure is what is missing). This is the quick, everyday check; the hero tray keeps
  showing stars only.
- **Copy:** measures becomes something like "Hero stars banked: each night every routine banks its star rating"; the "Why
  it helps" stays Jeremy's ("This game puts your routines to the test..."). Bar unit "stars". Final wording with Jeremy.
- **Honest limit:** stars move slowly (one check-in shifts a routine's rate ~3-4%), so the instant feedback is the report
  card's %, not the tier.

**Build (one session, Sonnet medium; touches the daily record, so it is its own task):**
1. `DailyRecord` v3: closed days carry `stars: { [routineId]: 0..5 }` (per routine, not a sum -- feeds best-routine and AI
   insights later). `State.closeDailyRecord` gets it from a pre-bound `routineStarsNow()` collaborator passed from script.js
   (Heroes loads after state.js; same forward-reference reason as `heroesCompletionRate`). Note in DATA_SCHEMA.md, bump `v`.
2. `VillageProgress.counters().heroes` = sum of `stars` over this run's closed days; days without the field count 0.
   Remove `isPerfectAttendance` from the counter (keep `att` in the record; it stays useful data). Thresholds in CONFIG with a
   balance comment; DECISIONS entry.
3. Pure `ReportCard.rows(routines, habits, config, runStartedAtMs)` (stars, rate, samples, distinctDays, honorRoll, next
   step); rendered in `VillageCard` (heroes kind) and in the Manage Routine window (`js/ui/routineViews.js`, one row).
4. Card copy + bar unit; empty state "Start a routine to open the school" stays.
5. Tests: DailyRecord v3 close, counter sum (frozen/KO = 0, old days = 0), report-card rows (tenure gaps, honor-roll edge
   at 80%), wiring. sw bump; live check of both report cards.

**Routine tasks count too (DECIDED 2026-10-31, Jeremy: "anything inside a routine, habit or task, should count toward the
stars rating") -- step 0 BUILT 2026-10-31 (sw v162; see DECISIONS 2026-10-31 late morning). Steps 1-5 still to build.** today `Heroes.completionRate` reads only the member HABITS' `occurrenceHistory`; routine task definitions
(`definedTasks`, ids in `routine.taskDefinitionIds`) keep no history. Build step 0 (before step 1):
- Give routine task defs an `occurrenceHistory` (additive; a missing one reads as `[]`, no schema bump; note in DATA_SCHEMA),
  one entry per spawned instance per day, same `{ date, success }` shape as habits: **success** = the instance was completed
  that day; **failure** = it went overdue / was still undone when the day rolled over. Check in the build how a routine task
  instance currently ends at rollover (carried over vs removed) and record exactly one entry per instance-day. Late
  completion after it went overdue: follow the habit rule (`Habits.applyHabitCompletion` on an overdue habit) so habits and
  tasks grade the same way.
- `Heroes.completionRate(routine, definedHabits, ...)` also reads the routine's task defs (new param or a merged list), so
  the hero chips, the hero tray, the level-up star notice and the report card all use ONE rate. This changes stars for
  routines that hold tasks -- expected.
- Tests: a routine with one habit + one task (both done, one missed), tenure counts days from both, task-only routine.

## W1 Run climate (sky weather) -- DESIGNED 2026-11-03 (Claude app session, Opus; Jeremy). **BUILD 1 BUILT 2026-11-03 (Sonnet); Builds 2-3 NOT BUILT.**

Replaces the Region 1 "today's pace" idea. Mockups (real art, approximate village placement):
`docs/mockups/run-climate/` (`run-climate-bands.png` = all five bands still, `fog-motion.mp4`, `storm-motion.mp4`,
`run-climate-mock.html` = the source; open it from that folder, it loads `../../../Assets/`).

### What it shows (and why)
The weather is a **run climate**: how this run has been going over the last ~7 closed days, all categories together, able
to recover in a few good days. Nothing else shows this. Base HP = how hurt right now; village = cumulative per-category
progress (only goes up); heroes = per routine; moon = how long. Today's damage / overdue / missed habits are NOT
re-shown in the sky (they already have visuals).

### The signal (pure `js/runClimate.js`; numbers in CONFIG, THEORY PASS -- re-check with play data)
- **Data:** closed `deadline.days` records of the CURRENT run only (`rec.run === current run`). No new counters, no
  DailyRecord bump, no schema change, nothing persisted: the band is DERIVED by replaying the run's closed days.
- **Day score 0..1** (a day with nothing due is skipped; absent days are skipped):
  - On time, weight 0.5: `(done.task + done.habit - 0.5 * done.late) / (due.task + due.habit)` (late finishes = half credit).
  - Habits kept, weight 0.25: `(done.habit + lurk.avoided) / (done.habit + missed.habit + lurk.avoided + lurk.slipped)`
    (no habits answered that day = drop this part and renormalise the other two).
  - Church held, weight 0.25: `1 - min(1, (dmg.taken + dmg.offline) / 25)` (25 HP or more of damage in a day = 0).
  - Clamp to 0..1.
- **Climate = weighted average of the last 7 scored days**, yesterday weight 1, each day further back x0.85.
- **Start at Hazy (Jeremy: "clear the sky by playing well"):** a prior score of 0.75 is blended in with weight
  `6 * (1 - n/7)` (n = scored days, floor 0; `CONFIG.CLIMATE.startWeightDays` 6, raised from 2 in the build because 2 cleared the
  sky in 3 days), so it fades out over the first week. Strong play (~90% on time and habits kept, little damage) clears the sky on
  day 5; a perfect run on day 4 (test-checked).
- **Bands:** Clear >= 0.85, Hazy >= 0.70, Overcast >= 0.55, Fog >= 0.40, Storm < 0.40. **Hysteresis 0.03**: moving UP a band
  needs threshold + 0.03, moving DOWN needs threshold - 0.03. Because the band is derived by replaying day by day from the
  run's start (start band Hazy), hysteresis needs no stored state.
- **Trend:** climate now vs the climate replayed 3 closed days ago: >= +0.05 improving, <= -0.05 worsening, else steady.
- **When it changes:** only when a day closes (rollover) and on load. No mid-day changes -- the morning sky is the report.
- **Sanity checks (theory):** a strong week stays Clear; one bad day after a good streak drops one band; two bad days ->
  Overcast; an "okay" run (~70% on time, 60% habits, 10 HP/day) sits at Overcast; a collapsing run reaches Storm.
- **Dev override:** `?climate=clear|hazy|overcast|fog|storm` (+ `&trend=up|down`) for testing, like the village tier params. Since 2026-11-03 the same forced sky (and a pretend village star) can be picked on the phone from the DEV panel behind Settings > Developer tools (`js/devDemo.js`, in memory only; the panel wins over the URL param).

### What each band looks like (all decided against the mockups)
| Band | Sky | Clouds (TOP of the sky only, except Fog) | Haze | Ground clouds | Extras |
|---|---|---|---|---|---|
| Clear | today's indigo dusk, all stars | NONE (removed 2026-11-07, Jeremy) | none | none | fireflies (36, bright, blinking: 24 in the upper lanes + 12 low over the ground art, 28 behind the zombies + 8 in front; 2026-11-07) |
| Hazy (new run) | slightly lighter / desaturated | exactly today's original cloud layer (2026-11-07: Clear's clouds moved here; no extra cloud) | light, strongest far away | none | stars thin out |
| Overcast | grey-violet | more and darker, still top only, never down behind the buildings | a step stronger | none | few stars, moon dimmer |
| Fog | muted grey, low contrast | heavy | heavy, by depth (below) | YES: the pixel cloud sprites, lightened + see-through, at 4 depths | no stars, moon a smudge |
| Storm | bruised green-grey | a THICK ceiling (~5 overlapping strips) moving very slowly (~6 px/s) | the heaviest, green-grey | none | heavy rain at 3 depths, rare soft lightning (no strobe) |
| Any band, trend up | -- | a break opens near the moon | -- | -- | a moonbeam falls on the church |
| Any band, trend down | -- | sky clouds drift a little faster | -- | -- | -- |

### Depth: haze and fog get worse the further away (Jeremy 2026-11-03)
Weather layers sit IN FRONT of things, like real haze: near things barely affected, far things a lot. Every weather layer
is `pointer-events: none`, so zombies, buildings, the church and the HUD stay fully tappable (checked in the mockup with
`elementFromPoint` on zombies, two buildings and the church door in the Fog and Storm panels).
- Paint order (back to front): sky, stars, moon, sky clouds, hills -> **far haze** -> ground -> village **far row** ->
  **row haze 1** -> **back row** -> **row haze 2** -> (Fog: **bank between the rows**) -> **front row** -> **mid haze** ->
  (Fog: **bank in front of the village**) -> church + zombies -> (Fog: **front banks**; Storm: **near rain**) -> **near haze**
  -> UI (night count + label, weather badge) -> HUD.
  **AS BUILT 2026-11-07 (Jeremy: "haze behind the base"):** the church (`#base`, z 1) sits ABOVE the village layer, so row haze 1 / 2, mid haze and the village fog run the FULL canvas width and pass behind it; the **near haze** is full width at z -1 (over the ground, under the church and village) and no longer lies over the zombies; the near fog + rain wrapper (z 87) stays in front of everything. Nothing starts or stops at the church, so there is no seam (three earlier tries with masks / a haze-back layer all left a line where two hazes overlapped).
- The village haze layers (row haze 1, row haze 2, mid haze) **stop at the horizon** (the front row's feet) with a ~16px
  soft edge, so the lane's ground stays clear (Jeremy: "the ground has too much haze"). The lane only gets the near haze
  (+ Fog banks / Storm rain).
- The row hazes live INSIDE `.village-layer` (z-index 1, its own stacking context) as siblings between the rows; the
  front-of-village bank and the near layers need z-indexes between the village (1) and the zombies / above the zombies
  -- the builder maps them onto the real stack (`#midnightLine` is 5).
- Fog, approximate total haze (mockup values): far row ~50%, back row ~40%, front row ~20%, zombies + church ~8%.
  Storm the same shape, green-grey, plus rain. **Hazy and Overcast (2026-11-07, Jeremy: "the further back you go, the hazier")** use the
  same shape at a lower strength (veils stack, so the far row carries all three): Hazy row1/row2/mid 0.15 / 0.13 / 0.12 = far row
  ~35%, back ~23%, front ~12% (mid raised from 0.08 the same day: "the haze should start in front of the first buildings a little"); Overcast 0.25 / 0.19 / 0.17 = ~50% / 33% / 17%; Fog 0.36 / 0.28 / 0.24 = ~65% / 45% / 24% (raised from 0.30 / 0.24 / 0.16 = 55 / 36 / 16 the same day: Jeremy saw no building difference between bands); Storm 0.44 / 0.31 / 0.28 = ~72% / 50% / 28% (was 0.30 / 0.24 / 0.18). No fog banks below Fog. Clear: none.
- Known risk: at Fog the near haze also dims zombie status icons slightly -- phone-check; if too much, lower the near haze
  for that band only.

### Motion (fx-gated like the clouds today)
All weather drifts the SAME way (the wind, rightward like today's clouds); the nearer, the faster. Speeds in CONFIG:
Fog: sky clouds 10-12 px/s, bank between the village rows 16, bank in front of the village 22, banks in front of the
zombies + church 34. Storm ceiling ~6 px/s. Rain: nearer = faster and denser. Other bands keep today's 45 px/s sky drift.
`fx-reduced` / `fx-off` / `prefers-reduced-motion`: everything static (no drift, no rain motion, no lightning, no fireflies);
the tint, haze and cloud amount still show the band. The SKY cloud layers follow the time slider like today's clouds (each carries `.scene-clouds-drift`, the scrub target; the slower
ones move less per slider minute, which reads as depth). Haze, fog banks and rain are NOT scrub targets (run-level, not time-of-day).

### The moon and the Nights Survived number
- The moon disc + glow are part of the sky: BEHIND all weather (Jeremy: "the moon is in space"). Glow shrinks band by band;
  at Fog it is a smudge, at Storm nearly gone.
- The **count + "Nights Survived" label move to a UI layer ABOVE the weather** so they always read. This partly supersedes
  the 2026-10-27 call that clouds pass in front of the moon AND the label: the moon still goes behind the clouds, the
  number and label no longer do.
- Styles: Clear + Hazy = today's look (dark digits printed on the moon). Overcast and worse = "lit sign": cream digits with a
  crisp 2px dark pixel outline (no blur) + a faint warm glow; the label gets a 1px dark outline. Fog + Storm also put a dim
  plate (`rgba(11,11,36,.6)`) behind the label.

### Weather badge (the tap target)
- Not the moon (it disappears in bad weather) and not the open sky (misclicks on the village / lane). A small **pixel
  weather icon** on the UI layer, top-left of the sky just right of the church (mockup: left 176px, top 8px), 34px chip in a
  44px tap area. **BUILT beside the moon instead** (the mockup spot collides with the HUD chips at phone sizes). Icon per band (clear moon + stars / moon + cloud / clouds / fog lines / storm cloud + bolt); a small up or
  down arrow when the trend is not steady. It doubles as the legend when effects are off.
- Tap -> a small **Weather** panel: band, trend ("clearing" / "worsening" / "steady"), the last 7 days' on-time %, habits
  kept and damage, and an (i) link to a new "How Deadline works" topic. The same readout goes in the **Stats** window (the
  portrait entry point; the portrait glance strip has no sky).
- A one-time soft pulse on the badge the first time the band changes, so the player learns it is tappable.
- Position must be checked against the village + HUD at phone sizes (844x390, 915x412) before it is final.

### Rule: weather may hide decoration, never recovery info (Jeremy 2026-11-03)
Losing visual clutter on a bad run is part of the design ("so you can focus more"), but anything that helps the player
dig out stays readable: zombies, the church, the night count, Base Health, points, items, the HUD. Stars, moon glow,
hills, distant buildings (and later the distant city) may fade.

### Build order
1. **Build 1 (Sonnet, medium) -- BUILT 2026-11-03 (see "Build 1 as built" below):** `js/runClimate.js` (pure: `dayScore`, `climate`, `bandFor` with hysteresis replay,
   `trend`) + `CONFIG.CLIMATE_*` + tests; script.js computes it on load and at rollover and puts `climate-<band>` (+
   `climate-trend-up/down`) on `#gameCanvas`; CSS per band: sky tint, star fade, moon glow, top-of-sky cloud count, the
   far / row / mid / near haze layers (row hazes inside `.village-layer`, stopping at the horizon), the number restyle
   (lit sign + plate) on its own UI layer; dev override; `sw.js` bump.
2. **Build 2 (Sonnet, medium) -- BUILT 2026-11-03 (see "Build 2 as built" below):** Fog ground banks at 4 depths with the parallax speeds; Storm ceiling + rain at 3 depths +
   soft lightning; fireflies at Clear; trend cloud-break + moonbeam; the weather badge + Weather panel + Stats readout +
   How Deadline works topic + first-change pulse.
3. **Build 3 (PixelLab, after the Nov 7 token reset):** cloud variants in the existing lavender palette at 2x: wispy (Hazy),
   heavy with a dark underbelly (Overcast / Fog), storm ceiling (the code-tinted storm clouds read weakly under heavy haze
   in the mockup -- real art fixes that). Fog stays code + reused sprites unless the sprites read wrong.

### Build 1 as built (2026-11-03, Sonnet)
- **Logic:** `js/runClimate.js` (pure; `dayScore`, `scoredDays`, `climateAfter`, `nextBandIndex` hysteresis, `compute`, `forced`), one `CONFIG.CLIMATE` object (THEORY pass; `RunClimate.DEFAULTS` mirrors it, a test checks), `test/runClimate.test.js` (40 tests incl. the clearing-speed scenarios). Derived by replaying the run's closed days; nothing persisted.
- **View:** `js/ui/climateView.js` puts `climate-<band>` on `#gameCanvas` (no trend class since 2026-11-10: the trend visuals are gone, the trend itself still feeds the badge / panel); script.js `climateNow()` caches on date|run|over and re-reads `deadline.days` only when that changes; on any failure no class = the old look. Dev override `?climate=clear|hazy|overcast|fog|storm&trend=up|down`.
- **Looks:** `css/climate.css` (all band values from the approved mockup). Sky gradient / hill colour / moon dim + glow / stars via `--clm-*` vars with the OLD values as the fallbacks in gameCanvas.css (Clear = today's look). Stars: Hazy keeps 9 at 0.85, Overcast 4 at 0.6, Fog/Storm none. Sky clouds: five extra `.scene-clouds-x1..x5` layers (hidden by default, per-band tops/tints/speeds; the base layer is hidden at Clear (2026-11-07), is Hazy's only cloud, and is replaced from Overcast on; Fog sky ~11 px/s, Storm ~6 px/s).
- **Haze by depth:** far veil = `.climate-haze-far` scene layer (z -2, over clouds + hill, under the ground); row1 / row2 / mid veils are built by `VillageView` inside `#villageLayer` (`hazePlan`: each z-indexed to the last sprite of the row it follows, appended last, `--hz` = the front row's feet, solid to 10px above the horizon, gone 6px below); near film = `#climateNear` (z 88). All `pointer-events: none` (checked live: taps reach every building and the church through Fog and Storm). **Veils run the full canvas width (2026-11-07):** the church is lifted above the village layer (`#base { z-index: 1 }`, later in the DOM than `#villageLayer`), so it is never veiled and nothing masks or feathers at its edge; `--hz-left` is no longer used by the CSS (still set inline by `syncHaze`). The near film is `#climateNear` at z -1 (it was z 88).
- **Number:** `#nightsSurvived` is now the moon disc only (z -3, keeps role=img + aria-label); the count + label live on `#nightsSurvivedUi.nights-ui` (z 89, aria-hidden, same box and position, graveyard.css moves both left of the hill). Ids unchanged, so `NightsSurvivedView` is untouched. Lit-sign ink from Overcast, plate behind the label at Fog/Storm.
- **Portrait strip:** the number layer and every weather layer are hidden there (the strip keeps its own sky; the weather badge / Stats readout in Build 2 are how portrait sees the band). **CHANGED 2026-11-11 (Jeremy):** the strip now shows a strip-sized cut of the weather (sky tint, clouds from Overcast, Storm rain + splashes on the strip floor + lightning, two Fog banks over the lanes, 5 Clear fireflies), all in `css/glanceStrip.css`; `js/ui/rainFx.js` uses the strip floor (56px) as the horizon and 3x the drop density there. The badge, sky toast, village haze and near film stay hidden in the strip. DECISIONS 2026-11-11 (strip weather).
- **Not in Build 1 (all added in Build 2, below):** fog ground banks, Storm rain + lightning, fireflies, trend visuals, the badge / Weather panel / Stats readout / How-it-works topic.

### Build 2 as built (2026-11-03, Sonnet)
- **Ground + rain + sky effects (css/climate.css, all `pointer-events: none`, all off by default and switched on by the band class):** Fog = pixel-cloud banks at four depths moving the same way, nearest fastest (between the village rows 16 px/s, in front of the village 22, in front of the zombies + church 34); Storm = rain at three depths (far in the scene, mid inside the village, two near sheets) + one slow soft lightning swell behind the clouds; Clear = six drifting fireflies (z 28, under the zombies); trend up = a moonbeam to the church door + a glow in the sky + the moon a touch brighter; trend down = the sky clouds drift faster. Static under `.fx-reduced` / `.fx-off` / `prefers-reduced-motion` (banks and rain stay as still pictures; lightning and fireflies vanish).
- **Where the banks live (stacking):** `VillageView.hazePlan` now also returns `wx`; `syncHaze` builds `.village-wx--row` (the bank BETWEEN the back and front rows) and `.village-wx--mid` (two banks + the rain IN FRONT of the village), z-indexed to the last sprite of the row they follow and appended last (same trick as the haze veils, so no sprite z-index changed). They clip themselves (`overflow: hidden`: `#gameCanvas` and `#villageLayer` are overflow-visible) and start at the church's right edge with the same 32px feather. The near layer is `#climateWxNear` (z 87: over the zombie band 80 / hover 85, under the near haze 88 and the number layer 89). Banks and rain are positioned from the horizon (`--clm-hz`, the front row's feet, published by VillageView), not from fixed canvas offsets, so they follow the village at every size.
- **Fog art, no filter:** `Assets/scene/fog-tile.png` is `clouds-tile.png` pre-baked (brightness 1.35, saturation 0.35); a runtime CSS filter on moving layers was rejected for phone performance. Added to the sw `APP_SHELL`.
- **Badge:** `#weatherBadge` (button in `#gameCanvas`, z 89, 44px tap area around a 34px chip) sits **just left of the moon** (the mockup's "right of the church" spot collides with the HUD chips at phone sizes); the 13x13 pixel icon per band + a green up / red down arrow; hidden with no result and in the portrait strip. **First-change pulse:** the first time the band changes after the badge has been seen it pulses softly until tapped once; the tiny state `{ band, pending, learned }` is in localStorage `deadline.weatherBadge` (a per-device hint like Settings' timer hint; not game state, not exported, never touched by the `?climate=` override).
- **Panel + Stats:** `js/ui/weatherPanel.js` (pure view model / markup / icons / pulse logic + DOM `init`, `updateBadge`, `open`); `css/weatherPanel.css`. The panel (a Modal, one at a time) shows the band, the trend in words, the last 7 finished days (on time %, habits kept %, church damage HP; `RunClimate` result rows now carry `damage`) and an (i) to the new **"The sky"** topic of How Deadline works (quotes `CONFIG.CLIMATE`, so retuning updates the text). The Stats window's current-run panel shows the same readout under the nights-survived line (`weatherHtml` passed through `openManagementWindow` -> `managementWindows` -> `StatsView.renderStatsWindow`); that is the portrait entry point. A forced dev sky shows a "Dev preview" note and no day rows.
- **Checked:** Jest 155 suites / 3,457 (+1 suite, +74 tests). Deliberate breakages (a learned badge pulsing again; a weather rule given `pointer-events: auto`) each fail 5 tests. Live in headless Chromium (service worker blocked): the badge sits left of the moon and clear of the HUD at 844x390, 915x412, 667x375, 1280x720 and 568x320 (hidden at 390x844), no horizontal overflow, no console errors; with seeded closed days the real sky came out Storm / worsening and the panel, the (i), the Stats readout and the pulse (pulses, a tap stops it for good, saved state flips to learned) all worked; taps reach the buildings and the church through Fog and Storm (two village sprites that report not-hit are overlapped by other sprites in the same way with a clear sky).
- **Not checked:** a real phone (Jeremy). Watch the frame rate in Fog / Storm on the phone: the sky clouds are tinted animated layers and the rain is several gradient sheets.
- **Next after this:** Build 3 (PixelLab cloud variants, after the Nov 7 reset); the dev "+" demo button (see ROADMAP).

### Storm rain rework (2026-11-07, Claude app session; Sonnet 5.5, medium; Jeremy: "I definitely want to do C")
- **Why:** on the phone the CSS rain read as slanted lines: too many drops, too close together, all one length and speed. The four `.rain` layers were tiled `repeating-linear-gradient(105deg)` sheets with a dash mask, so every layer was one regular pattern. CSS cannot vary drops, add splashes or change the wind.
- **Research basis (web, 2026-11-07):** thin 1px streaks at one consistent angle, scattered, not packed (clutter is not density); a short splash loop (dot, two dots apart, two further apart and higher, gone) under the streaks grounds the rain; depth comes from layers that look different (distance = dimmer, thinner, slower) with clearly separated speeds, three layers is plenty.
- **Built (mockup C):** `js/rainSim.js` (pure, seeded, `test/rainSim.test.js`) + `js/ui/rainFx.js` (canvas + loop, `test/rainFx.test.js`). The four `.rain` elements stay as hosts in the same stacking spots (far behind the ground, mid inside the village, near1 + near2 over the zombies); each gets one canvas drawn at 1/2 size and stretched `image-rendering: pixelated` (whole 2x2 blocks). The CSS gradient sheets and `climate-rainfall` keyframes are gone.
  - **Layers (per canvas pixel area, intensity 1):** far 1 drop / 1,100 px (1-2 long, 70-95 px/s, a=0.34), mid 1 / 2,050 (2-3, 110-150, 0.42, lands at the horizon), near1 1 / 4,800 (3-5, 170-220, 0.55, lands anywhere in the zombie lanes), near2 1 / 13,000 (5-8, 260-330, 0.70, no splash). About 55-60 drops on a phone-portrait canvas in total. Every drop has its own length, speed and one of two brightness shades. Tune the `LAYERS` table at the top of rainSim.js.
  - **Wind:** one shared wind: base lean 0.22 px sideways per px fallen, a +/-0.10 sine drift (38 s), and a gust every 22-45 s (first within 8-16 s) that leans the rain up to +0.30 harder and speeds it +35% for 2.5-4.5 s on a sine envelope. Each depth takes a share of the lean (far 0.6 ... near2 1.15). Slope is clamped 0.04-0.6.
  - **Splashes:** mid + near1 only, 3 frames (70 / 70 / 90 ms), capped at 28 per layer.
  - **Intensity:** `RainSim.intensityFor(score)` = 0.8 at the Storm line (0.40) up to 1.5 at 0.10 or worse; a forced dev sky (no score) = 1. Re-read every 600 ms rescan, so it follows a day rollover.
  - **Lightning:** a jagged one-pixel bolt (plus at most one short branch) drawn on the FAR canvas for 0.6 s (was 0.14 s, too easy to miss; Jeremy 2026-11-07), 10-22 s apart (first within 5-10 s), and it restarts the soft CSS glow once (`.climate-lightning.is-flash`: 1.6 s in all: quick rise to 0.35, then a slow fade). One flash per bolt, never two in a row, peak at or under the old 0.4. Hidden under reduced motion exactly as before.
  - **Motion settings:** `fx-reduced` / `fx-off` / `prefers-reduced-motion` draw one still frame per host (no loop, splashes, bolt or flash). The loop runs only while `#gameCanvas` has `climate-storm` (a MutationObserver on its class), is capped at ~30 fps, and stops while the page is hidden.
  - **Hosts are re-found every 600 ms** because VillageView rebuilds the mid `.village-wx` on every full render; the old canvas is dropped when its host leaves the page.
- **Not built (deliberate):** roof / church splashes. The near layers sit IN FRONT of the church, so a drop there cannot hit its roof; the drip / roof-edge overlay is a PixelLab art item anchored to the church. Real puddles, bolt sprite and splash art are the PixelLab follow-ups (splash, bolt, puddle, storm clouds), swapped in after this.
- **Storm ground (PixelLab puddles on the normal ground, same day):** shown only under `climate-storm`. Jeremy generated puddle art in PixelLab (option 4 of four) but the whole tile looked like different ground (no grass, different dark band), so the three puddles (small, big, medium) were cut out of it and pasted onto 4 copies of the normal `floor-tile.png`: `Assets/scene/storm-floor-tile.png` 508x72, puddles ~130 px apart, so they repeat only every 508 px. `storm-strip-floor.png` = `strip-floor.png` x4 (256x36) with the puddles halved. `css/climate.css`: `#gameCanvas.climate-storm .scene-ground` swaps image + `background-size: 508px 72px`; `body.glance-strip #gameCanvas.climate-storm::before` does the strip at 256x36. Same surface height and grass as the normal ground. sw v267. `test/stormGround.test.js` (5). Raw PixelLab output kept in `Assets/scene/_source/storm-floor-pixellab-128.png`.
- **Checked:** Jest `rainSim` 27 + `rainFx` 21 + the existing climate suites (`climateWiring` 66, `climateView`, `devToolsWiring`) green in a cloud copy. A stand-in page (the real `climate.css` + the two scripts) in headless Chromium at 390x700 and 844x390: four canvases, no console errors, ~16.5 ms per frame, splashes at the horizon. NOT checked: the real game in a browser, a real phone (Jeremy). Look at: density feel, the lean, splash height against the village's feet, bolt position, frame rate on the phone. Preview through Settings > Developer tools > DEV > Storm.

## W1b Mood check-in -- DESIGNED 2026-11-07 (Claude app session, Fable 5.1; Jeremy). NOT BUILT.

Decision logged in `docs/DECISIONS.md` 2026-11-07 "Weather stays the run climate; mood is its own check-in". Record
shape in `docs/DAILY_RECORD_PLAN.md` "v12 addition: mood" and `docs/DATA_SCHEMA.md`.

### Why (Jeremy 2026-11-07) and the verdict
Jeremy's starting point: the sky's "how has it been going lately" is something the player already feels in the moment, so
it is most useful when reviewing past runs and for the AI; tying the weather to the player's MOOD instead might help more,
because mood drives performance and the AI could use it to stop a run derailing, spot patterns and suggest ways into a
productive state. His old notes mapped the five run-climate bands onto five moods and asked about setting the weather
"for the vibe", setting it several times a day, and what the history shows.

**Verdict: the sky STAYS the run climate (objective, earned). Mood becomes its own one-tap check-in. The two meet in the
Weather panel's day table and in the AI, never in the scene.** Reasons (all Jeremy agreed):
1. Everything in the scene is a consequence of play (HP, village, heroes, moon, sky). A mood sky would be the one thing you
   type into rather than earn, and a happy player on a collapsing run would see fireflies: the world would be lying.
   "Clear the sky by playing well" is the W1 design.
2. A visual payoff for a mood report poisons the data: people report the pretty mood (Jeremy had already felt this with the
   "set it for the vibe" idea). Rule: the thing you want honest data from must never control a reward. Mood is purely
   informational, so the vibe problem disappears (the vibe case is handled separately by the Sky picker below).
3. Mood-congruent environments amplify mood. Someone who taps Awful and watches the world go to fog and storm is being
   mirrored, not helped; a steady world is better than a mirror.
Pushback kept on record: the climate DOES earn its place in the present. People cannot feel a 7-day weighted average; one bad
morning feels like a bad week. A Clear sky after a rough morning says "your week is still fine" (a catastrophizing
corrective). Low engagement (it changes once a day) is fine; it is the morning report.

### The check-in
- **Scale (one required tap):** five levels stored 1..5: Rad 5 / Good 4 / Meh 3 / Bad 2 / Awful 1. Baseline-neutral words
  (a theme may rename them; the numbers are the contract).
- **Tags (optional, up to 2):** one fixed list in `CONFIG.MOOD.tags`; the list ORDER is the bit index and is additive-only
  (append, never reorder): excited, proud, content, peaceful, bored, flat, sad, lonely, disappointed, angry, exhausted,
  overwhelmed, sick, travel, busy. The picker shows the chosen level's own words plus the three context tags (sick / travel /
  busy); any tag may be stored. Tags are what make the insights actionable: "Awful" hides three different problems
  (exhausted -> a light day; overwhelmed -> priorities / pushback; angry -> nothing the game can do).
- **Entry points:** (a) **first open of a local day**: a small card "How are you starting?" with the five glyphs + Skip; one
  tap, never blocks, never nags (one card per day). (b) **rollover / game-over**: the same five glyphs folded into the planned
  journal prompt ("How did today go?", skip by default; see DAILY_RECORD_PLAN "Future - Daily Journal"). (c) **any time**:
  the Weather panel gets a Mood row with the glyph picker; the mood glyph beside the weather badge opens that panel.
- **Glyph:** a 5-step pixel glyph on the UI layer next to the weather badge (same 44px tap area rules); hidden in the
  portrait strip (the Stats readout is the portrait entry, like weather). Theme-neutral. **It never changes the scene** --
  no sky, tint, fireflies or anything else reacts to mood.
- **Record (numbers only):** DailyRecord `mood: [[hour, level, tagBits], ...]`, bump `DailyRecord.V` (11 -> 12 at the time of
  writing; check `js/dailyRecord.js`). Several entries a day are allowed; a new entry in the SAME local hour replaces that
  hour's entry (fiddling does not log six rows). Derived at read, never stored: `first` (morning), `last` (closing), `min`,
  `max`. The month roll-up keeps a histogram `moodHist [5 ints]` (count of entries per level) and drops the entries. Older
  days have no field = no mood. `deadline.journal` (free text) stays reserved and separate.
- **Review:** the Weather panel's last-7-days table gets a **Mood** column: one glyph, or "first -> last" when the day's
  first and last entries differ. Stats best / worst day rows show the same glyph(s). Past-run cards: nothing in v1.
- **In-the-moment help (the derail-prevention hook):** a morning Bad / Awful check-in shows ONE soft, dismissible card:
  "Rough start. N things due today -- want to look?" -> opens the agenda (priorities first). Tag-aware second line:
  exhausted -> "a light day is allowed" (points at Sick Day / reschedule); overwhelmed -> "pick your three" (priorities).
  **Nothing free, no numbers change**: it only points at the levers that already exist (priorities, pushback charges,
  reschedule, Sick Day), so reporting low earns nothing and there is no reason to lie. Later the AI writes this card from
  the player's own patterns.
- **Rewards: none in v1.** No points, no streak, no toast for checking in. Rewarding the act (not the answer) is a later
  experiment once there is data on whether people check in unprompted.
- **Privacy:** level + tags are numbers in the record like every other counter; the journal plan's text opt-in rules do not
  apply to them. Free text stays in the journal.
- **What the AI should look for (intent, for the future insights work):** mood vs afternoon on-time % ("Low days cost you
  afternoons, not weeks"); mood vs damage; mood the day AFTER a Storm day (lag); tags vs lateness; morning -> closing delta vs
  completions; load (`load.*`) vs mood.
- **How Deadline works:** "The sky" topic gets one line: the sky is your run; the mood glyph is you.
- **Old-notes answers:** several times a day = yes (two prompted anchors + any time). Which one shows in review = the pair
  "started -> ended" when they differ, one glyph when not; the AI sees every entry with its hour. Marks on the within-day
  time slider = possible later (entries carry an hour), not v1. "Set the weather for the vibe" = the Sky picker, below.

### Build (Sonnet, medium; one session)
`js/mood.js` (pure: levels, tags, log merge-by-hour, derived first/last/min/max, histogram) + tests; DailyRecord v12 (`mood`
event, roll-up histogram, normalize) + tests; glyph (UI layer, hidden in the strip) + Weather panel Mood row + picker; the
morning card (once per local day, in-memory flag + `save.today` check) + the rollover / game-over prompt; the Weather
table column + Stats readout; the Bad / Awful help card (copy in one place; CONFIG for the threshold); How-it-works line;
`sw.js` bump; DATA_SCHEMA + DAILY_RECORD_PLAN "as built". Art: the 5-step glyph set is **fine as planned for now** (Jeremy 2026-11-07): code-drawn pixel glyphs, theme-neutral, as a placeholder; PixelLab art can replace them later without touching logic.

## W1c Sky picker (Lv 4 perk) -- DESIGNED 2026-11-07 (Claude app session, Fable 5.1; Jeremy). BUILT 2026-11-09 (Sonnet 5.5, with the amendment below; sw v305; see "W1c as built"). Not yet phone-checked.

Decision logged in `docs/DECISIONS.md` 2026-11-07 (same entry). Perk table: `docs/LEVEL_PERKS_PLAN.md` Lv 4.

### Why
The honest "vibe" case is someone who wants rain or fog for ambience (cozy); nobody sets Clear for ambience, they set it to
hide a bad run. The record, the panel table, Stats and the AI always carry the REAL climate (Jeremy), so the only thing an
override can harm is the earned reward in the scene, and the only band with trophy value is Clear (fireflies, all stars,
the look a run starts without). A struggling player who opens to a bleak world every morning may stop opening (engagement
priority), so the gloom bands should be free to lift too.

**Rule, one sentence: every band is yours to pick, Clear included.** (UPDATED 2026-11-09, Jeremy: "let the user select clear if they want to". It was "Clear is the only band you earn; every other band is yours to pick" with Clear offered only while the run was Clear. The rest of this section still describes that original design; where it talks about Clear gating, the Clear greying out or the "Clear slipped away" toast, read it as superseded by the "Clear is free" note in "W1c as built".)

### How it works
- **Unlock = Level 4 perk** (about day 7), beside the existing 10% shop discount. Perks are per run, so game over loses the
  picker until Lv 4 is reached again; that is consistent with the run-end rule (only unlocks that cannot be re-earned by play
  are kept) and gives the church stakes. Timing is deliberate: the climate's start-weight fades over the first week and Clear
  is reachable around day 4-5, so the player lives with the honest sky for a week before touching it. Not a shop item
  (the shop sells survival tools; cosmetics are perk territory, see the Lv 9 title + church skin). Rejected: a free Settings
  toggle (half of players set Clear on day one and the climate dies for them).
- **Picker** in the Weather panel (needs the perk; otherwise a locked row "Lv 4"): **Follow my run** (default), Hazy,
  Overcast, Fog, Storm always; **Clear only while the real band is Clear**. If set to Clear and the run slips, the sky
  falls to the real band and Clear greys out in the picker (the fireflies leaving is a sharper cue than a slide through Hazy).
  Picking a band WORSE than the real one is always allowed (rain lovers).
- **Truth stays visible:** the weather badge always shows the REAL band plus a small "set" mark; the panel header reads
  "Sky set to Storm . your run is Hazy". **Trend visuals (moonbeam + sky break, faster clouds) follow the REAL run**, so a
  cozy storm with a moonbeam on the church means the week is improving.
- **View-only override.** `RunClimate` is untouched; the record, the 7-day table, Stats and the AI never see the pick.
  Precedence in `ClimateView` / `climateNow()`: DEV panel forced sky > player pick > real. Rain intensity for a picked Storm =
  1 (no score, like the dev sky). The "weather may hide decoration, never recovery info" rule applies to whatever band is
  shown. The picked band also drives the Storm ground swap and the Clear fireflies (they are part of the band's look).
- **Persistence:** the pick is game state, per run: `save.skyPick` (`null` = follow; a band name) in `deadline.save`, reset by
  `initGame` like the perks, exported with the save, never in `deadline.days`. One schema bump (one persistence change per
  session guardrail). A pick the player no longer qualifies for (Clear without Clear, or no perk after game over) is simply
  ignored, not deleted.
- **Phone cost:** a permanent Storm runs the rain loop every session; watch it on the phone (the loop already stops while the
  page is hidden and under reduced motion).
- **Baseline naming:** `skyPick` / perk key `skyPicker`; the Deadline-facing perk name is **"Geo Storm"**, tagline **"You control the weather (visuals only)"** (Jeremy 2026-11-07, "for now"). The tagline is
  the honesty line: the pick changes the picture, never the run's real climate. The name lives in `js/theme.js` (theme words only
  there, per the Baseline rule), never in a key, CSS class or CONFIG name. A future Baseline theme supplies its own band looks; the rule and the picker are theme-neutral.
- **Later, if wanted:** premium skies (snow, aurora, a theme's own weather) could become a shop category; not planned.

### Amendment 2026-11-09: telling the player the sky is theirs (Claude app session, Opus 5.5; Jeremy: "yes, i like your ideas")
Once a pick is on, the sky stops reporting the run, so something else has to. The badge already shows the REAL band; this
amendment pins down how the pick reads and adds the moment of change the sky would have shown.
- **"Set" mark = a small paintbrush** in the badge chip's top-left corner (the trend arrow keeps its corner). Code-drawn
  pixel placeholder like the band icons; PixelLab later if wanted. The badge icon itself never changes to the picked band.
- **Panel header** (as designed): "Sky set to Storm · your run is Hazy", plus one line on what the real band means for the
  run (from the existing trend words), and a **"Show my real sky"** button right in the header = sets the pick back to
  Follow my run (same as choosing Follow in the picker; one tap, no confirm). Explicit background class on the button,
  per the UI rules.
- **Sky-change toast while a pick is on:** when the REAL band changes and the shown sky is the player's pick, one short
  toast: "Your run's weather is now Storm. Your sky stays Fog." When a Clear pick drops because the run slipped:
  "Clear slipped away. Your run is Hazy now." At most one per band change, never while no pick is set (the sky itself
  says it then), never for the dev forced sky. Reuses the existing toast surface; copy lives in `js/theme.js` only if it
  carries theme words.
- **Hold the badge to peek** (optional polish; build it last, drop it if it fights the tap): press and hold the badge
  ~0.5 s and the scene shows the REAL band while held, fading back on release; a plain tap still opens the panel.
  Reduced motion / fx-off = instant swap. On the badge, not the sky, because sky taps belong to buildings and zombies.
  Phones: block the long-press menu on the badge (`contextmenu` + `-webkit-touch-callout: none`).
- **One change from the text above, made while building:** the toast is NOT on "the existing toast surface". The only toast the game has is the big green LEVEL UP / GAME OVER banner (`.message-overlay`), which would read as a celebration, so the sky toast is its own small line (`#skyToast`, see "W1c as built").
- **Rejected:** a tint, frame or vignette on the scene to mark a picked sky (fights the art, players stop seeing it); a
  "custom sky" label only in Settings (set once, forgotten); turning the pick off when the run gets worse (breaks the
  perk's promise; the toast is the gentle version).

### Build (Sonnet, medium; one session; balance-tuning protocol applies to the perk table change, no economy number moves)
`CONFIG.LEVEL_PERKS` Lv 4 gains `{ unlock: 'skyPicker' }` beside the discount (+ `Progression.hasUnlock(table, level, key)`,
tests, toast copy); `save.skyPick` + schema bump + migration + `initGame` reset + export; `ClimateView` precedence + badge
"set" mark + panel header copy; Weather panel picker row (locked state, Clear gating, Follow); trend classes from the real
result; tests (`climateView`, `weatherPanel`, `levelPerks`, persistence migration); `sw.js` bump; LEVEL_PERKS_PLAN + UI_UX
"as built"; phone check of Storm-forever frame rate; 2026-11-09 amendment: paintbrush "set" mark, "Show my real sky"
header button, sky-change toast (tests: fires once per real band change with a pick on, never without a pick, Clear-drop
copy), hold-to-peek last.

### W1c as built (2026-11-09, Claude app session; Sonnet 5.5; sw v305, schema 19)
- **Rules, pure + tested:** `js/skyPick.js` (`sanitize`, `pickableBands`, `resolve`, `realBandOf`, `changeNotice`). `resolve(real, savedPick, unlocked)` returns the REAL result untouched for no perk / no pick / a dev-forced sky / a Clear pick while the run is not Clear (`slipped`, ignored not deleted); otherwise a COPY of the real result with the picked band, `score: null` when the band differs (rain at full strength, like the dev sky) and `pick: { band, realBand }`. Trend and `recent` stay the REAL run's, so the moonbeam / darker clouds and the Weather table keep telling the truth.
- **Perk:** `CONFIG.LEVEL_PERKS[4]` = the 10% discount + `{ type: 'unlock', unlock: 'skyPicker', label: '' }` (the label is empty ON PURPOSE: the name is a theme word). `Progression.hasUnlock(table, level, key)` / `unlockLevel(table, key)` derive it from the level every call. `Theme.strings.perks.skyPicker` = "Geo Storm" + "You control the weather (visuals only)"; `Theme.perkLabel(perk)` is read by the level-up toast and the Level panel. "Geo Storm" appears nowhere else (test).
- **Save:** schema 19, `save.skyPick` (null | band). `State.getSkyPick/setSkyPick` (sanitised), reset by `initGame`, restored on load, exported with the save, never in `deadline.days`; migration v18 -> v19 seeds null and keeps a valid band. One persistence change in this session.
- **script.js:** `realClimateNow()` (dev panel sky > `?climate=` > the run's climate) and `climateNow()` = `skyNow().result` (the real sky + the pick, cached on real result / pick / perk). ClimateView, RainFx, the badge, the panel and the Stats readout all read `climateNow`. `setSkyPick(band)` saves and repaints; it refuses a pick without the perk and Clear while the run is not Clear.
- **Badge + panel (`js/ui/weatherPanel.js`, `css/weatherPanel.css`):** the badge keeps the REAL band icon; a 14px paintbrush (code-drawn placeholder) sits in the chip's top-left while a pick is in force. The panel shows "Sky set to Storm . your run is Hazy" + a "Show my real sky" button (= Follow my run), then the real band's line, trend, note, the picker (Follow my run, Clear, Hazy, Overcast, Fog, Storm; Clear disabled unless the run is Clear, the pick in force pressed; before Lv 4 one locked line, "Geo Storm unlocks at Lv 4: ...") and the table. Picking redraws the panel in place. A dev-forced sky hides the picker. Stats readout gets the same set line. Every new button has its own background in the CSS.
- **Sky toast:** `#skyToast` (small line under the Nights Survived label, about 5 s, `pointer-events: none`, hidden in the portrait strip). `watchRealSky` in script.js compares the REAL band across `ClimateView` changes and asks `SkyPick.changeNotice`: "Your run's weather is now Storm. Your sky stays Fog." / "Clear slipped away. Your run is Hazy now." Once per real change; never without a pick or the perk, never for a dev / `?climate=` sky, never when the sky already shows the new band, and NOT on load (armed only after the saved game is restored, `armSkyWatch`).
- **Hold to peek:** press and hold the badge about 0.45 s with a sky picked: `ClimateView.peek(true)` wears the real result (`getRealResult`) until release / leave / cancel; no `onChange` while peeking; the release does not open the panel; a plain tap still does. `contextmenu` blocked on the badge, `-webkit-touch-callout` / `user-select: none`, `touch-action: manipulation`. No pick = no peek.
- **Tests:** `test/skyPick.test.js` (22: rules, Lv 4 perk, theme name, State field), `test/skyPickUi.test.js` (19: view model, panel markup, badge mark, picker clicks, toast, peek, ClimateView key + peek), `test/climateWiring.test.js` (+8 wiring checks); older tests updated for schema 19, the two-perk Lv 4 and `realClimateNow`. Full Jest in a scratch copy of the repo + this session's files: 205 suites, 4,713 tests, all pass (index.html and script.js kept CRLF). Headless Chromium at 844x390: locked row at Lv 1, picker at Lv 4, Storm pick saved, badge real + brush, hold shows Hazy and release restores Storm without opening the panel, no console errors.
- **Not checked:** a real phone (tap sizes of the picker buttons, the 450 ms hold with a finger, the long-press menu, Storm-forever frame rate on a phone), and the toast firing at a REAL rollover (covered by the pure `changeNotice` tests, not driven end to end).
- **Clear is free (2026-11-09):** `resolve` has no Clear special case (no `slipped`), `pickableBands()` = all five, the Clear button is never disabled, `setSkyPick` has no Clear check, and the toast has no "Clear slipped away" line (a Clear pick gets the normal "Your run's weather is now X. Your sky stays Clear."). The picker's note says the pick changes the picture only. Tests updated (skyPick 22, skyPickUi 19, climateWiring; counts unchanged).
- **Where the picker sits:** at 390px landscape the picker is below the fold of the Weather panel (it scrolls). If that is annoying, move the picker above the trend line.

### W1d Sky unlocks -- DESIGNED 2026-11-09 (Claude app session; Sonnet 5.5; Jeremy: "weather types unlock as a perk or reward for lvl ups of various kinds, first is hazy/starter" -> "i agree with your suggestions"). BUILT 2026-11-09 (Sonnet 5.5; sw v306; no schema bump)
- **Rule, one sentence:** each sky is its own LIFETIME unlock on a different track; the picker opens with the first one you earn and a locked sky shows what unlocks it. Lifetime = a new run or a game over never takes one back.
- **The tracks (`CONFIG.SKY_UNLOCKS`, every number reuses an existing level or village threshold, nothing new is measured):**

  | Sky | Unlock | Why this track |
  |---|---|---|
  | Hazy | player Lv 4 (the Geo Storm perk) | the starter; about the first week |
  | Overcast | Radio tower star 3 (18 nights) | nights survived, about 3 weeks |
  | Fog | Jailhouse star 3 (14 nights held at 75%+ health) | defending the church |
  | Storm | Windmill star 3 (5 heavy days handled) | surviving hard days |
  | Clear | Radio tower star 4 (50 nights) | the one you really earn |

- **Dropped:** a player max-level change (every level-keyed table would need new rows). "Star N" = tier N, so star 3 is the SECOND number of `VILLAGE_TIER_THRESHOLDS[kind]` (nights 18, defense 14, bestdays 5) and star 4 is the third (nights 50).
- **What it reads:** `bestPlayerLevel` (NEW, one additive root save field, no schema bump) and the existing `bestVillageTiers` (the Memorial's high-water mark). `State.setPlayerLevel` raises `bestPlayerLevel` (it only goes up); `initGame` never touches it; a save from before the field is seeded from the current level and the `peakPlayerLevel` of every run still in history (`SkyPick.bestLevelFromHistory`); a dev Reset Game forgets it (`State.resetBestPlayerLevel`).
- **Pure rules (`js/skyPick.js`):** `unlockedBands(rules, { level, tiers })` -> the earned bands in sky order; `ruleMet`; `allowedBands`. `resolve` / `changeNotice` now take the LIST of earned bands as the third argument (a boolean still works: true = all five, false = none). A saved pick whose band is not earned is ignored, so the canvas shows the real sky (no pick is ever written for a locked band: `setSkyPick` refuses it).
- **Picker opens when ANY sky is earned** (in practice Lv 4 / Hazy). Before that: the old locked line "Geo Storm unlocks at Lv 4".
- **Weather panel (`js/ui/weatherPanel.js`, `css/weatherPanel.css`):** `pickerModel(info)` takes `info.bands = [{ band, unlocked, requirement }]`. An earned sky is a normal button; a locked one is a DISABLED button with a lock, the sky name, and its requirement under it ("Jailhouse star 3"), with an `aria-label` like "Fog, locked. Unlocks at Jailhouse star 3". Follow my run is always enabled. Without `bands` (an old caller) every sky is offered.
- **Theme words:** requirement lines come from `Theme.skyRequirement(rule)` and `Theme.strings.skyUnlocks` ("Player Lv {level}", "{building} star {tier}", building names Radio tower / Jailhouse / Windmill). Neither `SkyPick` nor the panel holds a building name (a test checks).
- **script.js:** `skyBest()`, `skyUnlockedBands()`; `skyNow()` caches on real result / pick / earned list; `setSkyPick` refuses a locked band; `getPickerInfo` builds `bands`; `handleConfirmReset` calls `State.resetBestPlayerLevel()`. The once-a-second best-tier tracker already raises `bestVillageTiers`, so a sky unlocks the moment the star is reached.
- **Tests:** `test/skyUnlocks.test.js` (rules, config, history seed, theme lines, locked-row markup, State field + wiring), `test/climateWiring.test.js` (wiring checks updated). Full suite in a fresh clone: 207 suites, 4,747 of 4,748 pass (the one failure is the CRLF check on the clone's LF `index.html`, which does not apply to the device).
- **Checked:** headless Chromium at 844x390 with a save at Lv 4 + Radio tower star 3: Hazy and Overcast are buttons, Clear / Fog / Storm are locked rows showing their requirement, no console errors, page width unchanged (846 vs 844 is the same without this change). Phone: Jeremy confirmed it works (2026-11-09, after the stale sw v305 cache cleared); tap size and wrapping of the two-line locked rows were not reported separately.
- **Watch out:** (1) no unlock toast yet, a sky just becomes available (an idea if it feels silent); (2) the Windmill's pace (heavy days handled) has never been measured, so Storm's timing is a guess; (3) Clear at 50 nights vs the 100-night star 5 is a dial to confirm after play; (4) the dev level tools raise `bestPlayerLevel` too (they go through `setPlayerLevel`), so a dev jump to Lv 4 unlocks Hazy for good until a Reset Game; (5) the pick itself is still per run (reset by `initGame`), only the unlocks are lifetime.

### Parked ideas (later enhancements, Jeremy 2026-11-03)
- **Observatory** (a telescope aimed at the moon) or a **weather balloon** in the distance as the weather tap target
  instead of the badge. An observatory would need its own stat to be a village building, or be the one building that only
  reports the weather.
- **Fence + gate** as another upgradeable structure tied to a game stat (stat not chosen; must not repeat a village stat).
  Placement: NOT around the village (too small on phone landscape, covers buildings); options = a low picket line along
  the front edge of the lane, or a gate in front of the church that zombies walk through (mock it first).

## Suggested build order (PROPOSED; one session each, commit each)

- [x] **W0 — Layout pass (BUILT 2026-10-28, Opus plan / Sonnet build; sw v133):** graveyard hill on the
  right + past-run graves + spawn edge moved (see "W0 layout — DECIDED + BUILT" below). The distant-city
  band was NOT reserved: it waits for Goals (W5), no placeholder skyline was added.
- [ ] **W1 — Run climate (sky weather) -- DESIGNED 2026-11-03 (Opus, Jeremy), see "W1 Run climate" below. Build 1 BUILT 2026-11-03.** Build 1 (logic +
  sky/haze/number, Sonnet, DONE), Build 2 (fog banks, rain, fireflies, trend, badge + panel, Sonnet, BUILT 2026-11-03), Build 3 (PixelLab cloud
  variants after the Nov 7 token reset).
- [ ] **W1b — Mood check-in (DESIGNED 2026-11-07, Fable; Sonnet build):** five-level one-tap mood + optional tags, on the
  DailyRecord (v12), glyph beside the weather badge, Mood column in the Weather table, Bad / Awful help card. The sky stays
  the run climate. See "W1b Mood check-in" below.
- [x] **W1c — Sky picker, Lv 4 perk (DESIGNED 2026-11-07, Fable; BUILT 2026-11-09, Sonnet, sw v305; phone check owed):** Clear is the only band you earn; every
  other band is yours to pick; badge, trend, record and AI keep the real climate. See "W1c Sky picker" below.
- [x] **W1d — Sky unlocks (DESIGNED + BUILT 2026-11-09, Sonnet, sw v306; seen working on Jeremy's phone):** each sky is its own lifetime unlock (Hazy Lv 4, Overcast Radio tower star 3,
  Fog Jailhouse star 3, Storm Windmill star 3, Clear Radio tower star 4); locked skies show their requirement. See "W1d Sky unlocks" below.
- [ ] **W2 — Achievement VILLAGE, Americana small town (Sonnet + PixelLab art; REPLACES the headstone-markers idea; direction DECIDED 2026-10-28):**
  8 category buildings (5 tiers x 3 conditions, state carried by the art + code filters) on the horizon hill behind the zombies + the
  Memorial on the right hill; tap -> close-up village view (same sprite at 4x). Art spec, 2x pixel-scale rule, vertical budget, Americana
  kit and the Clock-tower test: `docs/ART_STYLE.md` "Achievement village art". Order: (a) Clock tower T3 at 64x80 vs 56x64 on the real-scene
  mock -> pick the size, (b) Clock tower T1-T5, (c) the other 7 kinds + Memorial, (d) ridge/hill background art (DONE 2026-11-07: mountains + tree line + moonlit field, ART_STYLE "Backdrop"; village roads dropped, props instead), (e) build the scene
  layer (draw under the MIDNIGHT line) + close-up view + overlays. The W0 headstones on the hill become the Memorial only (DONE 2026-11-08: the six stones are gone, one Memorial obelisk stands there; stage = floor of the average of the 8 all-time best tiers, `js/memorial.js`).
  Open: Memorial rows tappable for per-category history? Confirm the Americana mapping for the 8 kinds.
- [ ] **W3 — Graveyard history (Sonnet):** run graves + growing tree. **Growing tree BUILT 2026-11-08** (3 PixelLab stages, lifetime nights = banked `lifetimeStats.nightsSurvived` + live run, 0-29 / 30-99 / 100+; DECISIONS "Growing tree", ART_STYLE "Growing tree"); run graves were built in W0.
- [ ] **W4 — Today-only battlefield aftermath (Sonnet):** option (a) above.
- [x] **D1 — Goals + Targets design (DONE 2026-11-04, Fable; Jeremy):** `docs/GOALS_PLAN.md` -- a Goals pane, not the city; builds A-C in ROADMAP M5.
- [ ] ~~**W5 — City strongholds (after Goals ships).**~~ RETIRED 2026-11-04 (goals are a pane; nothing on the skyline for now).
- [ ] ~~**W6 — Horizon threat (after W5).**~~ RETIRED 2026-11-04 (the pane's pace dot carries it).
- [ ] **D2 — Daily summary record for future AI insights + best/worst days (Fable/Opus; data
  design, schema bump). Not for back-paging the canvas.**

Art: PixelLab, matching the moon / church pixel scale; source files in `Assets/scene/_source/`;
every new shell asset goes in `sw.js` `APP_SHELL` with a `CACHE_NAME` bump.
