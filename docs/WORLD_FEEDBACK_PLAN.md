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

## Suggested build order (PROPOSED; one session each, commit each)

- [x] **W0 — Layout pass (BUILT 2026-10-28, Opus plan / Sonnet build; sw v133):** graveyard hill on the
  right + past-run graves + spawn edge moved (see "W0 layout — DECIDED + BUILT" below). The distant-city
  band was NOT reserved: it waits for Goals (W5), no placeholder skyline was added.
- [ ] **W1 — Sky weather (Sonnet):** pure `skyModel` (state → weather level) + CSS layers,
  fx-gated; tap sky/moon → day summary.
- [ ] **W2 — Achievement VILLAGE (Sonnet + PixelLab art; REPLACES the headstone-markers idea, DECIDED in the 2026-10-28 mockups):**
  8 category buildings (5 tiers x 3 conditions) on a ridge behind the zombies + the Memorial on the right hill, tap -> close-up village
  view. Art spec, sizes (48x56 native, 1x scene / 2x close-up) and the Clock-tower test: `docs/ART_STYLE.md` "Achievement village
  art". Order: (a) Clock-tower test art -> size check, (b) remaining 8 kinds, (c) background ridge art, (d) build the scene layer +
  close-up view. The W0 headstones on the hill become the Memorial only. Open: Memorial rows tappable for per-category history?
- [ ] **W3 — Graveyard history (Sonnet):** run graves + growing tree.
- [ ] **W4 — Today-only battlefield aftermath (Sonnet):** option (a) above.
- [ ] **D1 — Goals + Targets design (Fable):** schema, linking tasks/habits, UI, portrait entry.
- [ ] **W5 — City strongholds (after Goals ships).**
- [ ] **W6 — Horizon threat (after W5).**
- [ ] **D2 — Daily summary record for future AI insights + best/worst days (Fable/Opus; data
  design, schema bump). Not for back-paging the canvas.**

Art: PixelLab, matching the moon / church pixel scale; source files in `Assets/scene/_source/`;
every new shell asset goes in `sw.js` `APP_SHELL` with a `CACHE_NAME` bump.
