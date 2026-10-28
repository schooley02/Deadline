# World Feedback Plan — sky, distant city, graveyard (visual track V7)

**Status: DRAFT, brainstormed 2026-10-27 (Claude app session, Opus). Nothing decided yet** —
every item marked PROPOSED waits for Jeremy's call. Once a fork is settled, log it in
`docs/DECISIONS.md` and flip it to DECIDED here.

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

Open: the scene already has 3 decorative tombstones in the ground layer (V1) — keep, move,
or replace with the real markers? Marker size vs tap-target minimum (44px hit area, visual can
be smaller — the V3c-1 chip trick).

## Suggested build order (PROPOSED; one session each, commit each)

- [ ] **W0 — Layout pass (Opus plan / Sonnet build):** reserve the city band and the
  graveyard zone in landscape + desktop; static placeholder art; confirm zombies still read
  first. Mockup first if wanted.
- [ ] **W1 — Sky weather (Sonnet):** pure `skyModel` (state → weather level) + CSS layers,
  fx-gated; tap sky/moon → day summary.
- [ ] **W2 — Graveyard markers (Sonnet + PixelLab art):** family markers by tier, tap → list.
- [ ] **W3 — Graveyard history (Sonnet):** run graves + growing tree.
- [ ] **W4 — Today-only battlefield aftermath (Sonnet):** option (a) above.
- [ ] **D1 — Goals + Targets design (Fable):** schema, linking tasks/habits, UI, portrait entry.
- [ ] **W5 — City strongholds (after Goals ships).**
- [ ] **W6 — Horizon threat (after W5).**
- [ ] **D2 (optional) — Daily summary record for past-day review (Fable/Opus).**

Art: PixelLab, matching the moon / church pixel scale; source files in `Assets/scene/_source/`;
every new shell asset goes in `sw.js` `APP_SHELL` with a `CACHE_NAME` bump.
