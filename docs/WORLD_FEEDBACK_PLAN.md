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

## Goal

Turn the empty parts of the landscape/desktop scene into game-like, at-a-glance feedback:
how today is going, how long-term goals are going, and what the player has achieved over time.
Theme: undead apocalypse. Background feedback must never compete with the zombies.

## Organizing principle (PROPOSED)

Each region of the scene owns ONE time scale, so the player always knows where to look:

| Region | Time scale | Shows |
|---|---|---|
| Lane / field + church (exists) | Right now | Zombies, base damage, heroes |
| Sky (moon exists, top-right) | Today | Pace / mood of the day |
| Distant city (new, behind the hills) | Weeks–months | Goals and their Targets |
| Right-side graveyard (new) | All time | Achievements, past runs, lifetime nights |

Why not map city windows to today's zombies (Jeremy's first idea): the field already shows
today's items one-to-one; a second copy in the skyline repeats it at a size that is hard to
read on a phone. The skyline is the only free real estate big enough for something long-lived.

## Global rules (PROPOSED)

1. Background layers stay low-contrast / desaturated; zombies always read first.
2. Anything carrying information is tappable and opens its exact numbers (same pattern as the
   Base Health button and the moon).
3. All motion is fx-gated (`fx-reduced` / `fx-off` / reduced-motion), like V1's clouds.
4. The landscape-only regions (city, graveyard) need a portrait entry point elsewhere
   (Stats window / a Goals window) — the portrait glance strip has no room for them.
5. Pure model module + thin view per region (like `baseModel.js` / `basePanel.js`), so the
   mapping rules are unit-tested without a DOM.

## Region 1 — Sky: today's pace (no new features needed)

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
  Slayer, Habit Hero, On Fire, Steady Hands, Back in Black), material upgrades with tier:
  none → wooden cross → stone (Bronze) → … → mausoleum (Platinum). Progress readable before
  tapping. Tap → that family's tiers + near-miss nudge (reuse `Achievements.nextLockedTier` /
  `nearMissNudges` and the Stats badge markup).
- **A small grave per finished run** with an epitaph ("Fell after 12 nights"), from
  `pastRuns`. Cap the visible count; older runs fade or move to Stats.
- **The tree grows with lifetime nights survived** (sapling → twisted giant; lanterns / crows
  for long streaks).
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
| `slain` | Armory | tasks + sub-tasks + habits completed | `currentRunStats` | 30 / 150 / 450 / 1000 |
| `punctuality` | Clock tower | completed on time | daily records: done - late | 25 / 120 / 350 / 750 |
| `habits` | Hospital | GOOD habit check-ins (2026-10-31: positive habits only; resisting bad habits is the Boxing gym's) | `currentRunStats.goodHabitsCompleted` (falls back to `habitsCompleted` on older runs) | 20 / 80 / 250 / 500 |
| `lurkers` | Boxing gym | days with no slips (>= 1 bad habit due, 0 slipped) | daily records `lurk` | 3 / 14 / 40 / 80 |
| `defense` | Jailhouse | nights the church held (day ended >= 75% health) | daily records `base.endHp` | 3 / 14 / 40 / 80 |
| `heroes` | High school | perfect attendance days (every active routine fully done) | NEW daily-record field | 3 / 10 / 30 / 60 |
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

## High school v2: banked hero stars + report card -- DECIDED 2026-10-31 (Claude app session, Opus; Jeremy). NOT BUILT.

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
stars rating"):** today `Heroes.completionRate` reads only the member HABITS' `occurrenceHistory`; routine task definitions
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

## Suggested build order (PROPOSED; one session each, commit each)

- [x] **W0 — Layout pass (BUILT 2026-10-28, Opus plan / Sonnet build; sw v133):** graveyard hill on the
  right + past-run graves + spawn edge moved (see "W0 layout — DECIDED + BUILT" below). The distant-city
  band was NOT reserved: it waits for Goals (W5), no placeholder skyline was added.
- [ ] **W1 — Sky weather (Sonnet):** pure `skyModel` (state → weather level) + CSS layers,
  fx-gated; tap sky/moon → day summary.
- [ ] **W2 — Achievement VILLAGE, Americana small town (Sonnet + PixelLab art; REPLACES the headstone-markers idea; direction DECIDED 2026-10-28):**
  8 category buildings (5 tiers x 3 conditions, state carried by the art + code filters) on the horizon hill behind the zombies + the
  Memorial on the right hill; tap -> close-up village view (same sprite at 4x). Art spec, 2x pixel-scale rule, vertical budget, Americana
  kit and the Clock-tower test: `docs/ART_STYLE.md` "Achievement village art". Order: (a) Clock tower T3 at 64x80 vs 56x64 on the real-scene
  mock -> pick the size, (b) Clock tower T1-T5, (c) the other 7 kinds + Memorial, (d) ridge/hill background art, (e) build the scene
  layer (draw under the MIDNIGHT line) + close-up view + overlays. The W0 headstones on the hill become the Memorial only.
  Open: Memorial rows tappable for per-category history? Confirm the Americana mapping for the 8 kinds.
- [ ] **W3 — Graveyard history (Sonnet):** run graves + growing tree.
- [ ] **W4 — Today-only battlefield aftermath (Sonnet):** option (a) above.
- [ ] **D1 — Goals + Targets design (Fable):** schema, linking tasks/habits, UI, portrait entry.
- [ ] **W5 — City strongholds (after Goals ships).**
- [ ] **W6 — Horizon threat (after W5).**
- [ ] **D2 — Daily summary record for future AI insights + best/worst days (Fable/Opus; data
  design, schema bump). Not for back-paging the canvas.**

Art: PixelLab, matching the moon / church pixel scale; source files in `Assets/scene/_source/`;
every new shell asset goes in `sw.js` `APP_SHELL` with a `CACHE_NAME` bump.
