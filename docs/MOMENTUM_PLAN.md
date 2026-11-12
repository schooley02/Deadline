# Momentum + the Barricade (PLAN, DESIGNED 2026-11-11; BUILDS A and B BUILT 2026-11-11; BUILD C: the damage bonus + the canvas BUILT 2026-11-11 / 2026-11-12; the PixelLab art PENDING)

Designed 2026-11-11, Claude app session (Opus 5.5 first pass, Fable 5.2 design), with Jeremy. DECISIONS 2026-11-11 (momentum).
Mockup (week strip + Barricade window): https://claude.ai/artifact/M7244g3Vt9ixmbudCvWd4W

## Why
Nights Survived counted every local midnight of a run, so an empty or untouched schedule earned nights forever (and the Radio tower, the
Survivor badge, the tree, the sky unlocks and the Jailhouse with them). Jeremy: "nights survived shouldn't keep counting if nothing was
completed ... achievements and building levels need to promote usage. cheating will happen but we can work to minimize it in a way that
the people actually using it as intended will get the rewards." The goal is not to stop cheating (saves are local; a clock change or a
save edit cannot be stopped) but to make it boring, and to make every slow reward need real use over weeks.

## Rules (decided)
1. **Defended night.** A local day is DEFENDED when the player finished at least 1 priority task that day OR fully completed at least
   1 routine that day. Likely data, to confirm in the build: `DailyRecord` `pri.d` >= 1 (what the Command Post reads) or `att.perfect` >= 1.
2. **Nights Survived = defended nights.** A midnight after an undefended day adds nothing. Applies to the moon, the Radio tower (`nights`),
   the Survivor badge, the lifetime tree bank and the sky unlocks. Per-run and lifetime stay as they are; only what a night IS changes.
3. **Momentum = defended nights among the last 7 nights** (0-7), per run. No warm-up: it works from day 1.
4. **Minimum age.** A priority task counts toward a defended night only if it was at least 10 minutes old when finished (same idea as the
   pushback 10-minute rule). It still pays its points and clears its zombie. Proposed dial `MOMENTUM_MIN_TASK_AGE_MS`.
5. **Late still counts.** A priority finished after its due time defends the night. The sky judges punctuality; momentum judges showing up.
6. **Away days are missed.** No login = no defended night, and the 7-night window keeps sliding, so momentum falls while away and is
   rebuilt on return (3 defended days -> Partial, 5 -> Solid). Jeremy: "they need to rebuild momentum which seems pretty accurate to real life".
7. **Grace uses what exists; no new item.** The 5-of-7 line is the rest-day mechanic (two free misses a week). A **Sick Day / Earned Sick
   Day** EXCUSES the night: not defended, not missed, and the window skips over it (it looks one night further back). Skip Day and Cheat
   Day cover one habit and do not touch momentum. No scheduled rest days. "Shields" (proposed, then dropped) is NOT an item.
8. **Jailhouse** (`defense`) now also needs a defended night (an empty day passed the 75% health test for free).
9. **Radio tower** thresholds stay 4 / 18 / 50 / 100 (star 5 moves from ~100 to ~140 days at five nights a week; accepted).
10. **Nights already recorded stay.** The current run's count and the lifetime bank are kept; the new rule applies from the day it ships.
11. **Time Logged does not defend a night** in v1 (a timer can be left running; one rule is easier to explain). Revisit with play data.
12. **No extra consequence for a missed night**: it does not count and the barricade weakens. No added damage.

## The Barricade (the momentum display, and a small damage bonus)
A barricade stands in front of the base. It is NOT an item. Four states by momentum:

| State | Momentum | Zombie damage at the base |
|---|---|---|
| None | 0-2 | normal |
| Partial | 3-4 | normal |
| Solid | 5-6 | 10% less |
| Reinforced | 7 | 20% less |

- **Bonus only.** A fallen barricade means NORMAL damage (today's game), never extra. Why: a struggling or returning player already takes
  overdue damage, and a penalty on top is a death spiral; a consistent player rarely has zombies at the church, so the bonus mostly
  cushions their one bad day.
- **Kept small on purpose**, so one trivial priority a day is not worth faking.
- **Red-line exception (Jeremy, 2026-11-11):** LEVEL_PERKS says nothing softens damage. The barricade is the one approved exception,
  "because momentum is so important for the user". The level-perk red line itself is unchanged.
- **Away:** offline / live-gap catch-up damage uses NORMAL damage, no barricade bonus (no coasting on a Reinforced barricade while gone).
- **BUILT 2026-11-11 (Build C, damage half; DECISIONS 2026-11-11 (momentum build C, damage bonus)):** `damageCut` on each `CONFIG.MOMENTUM.BARRICADE_STATES` row; the live loop divides the hit interval by `1 - cut` (`Momentum.cutIntervalMs`, `js/loop.js` dep `getBarricadeDamageCut`, `script.js barricadeDamageCut()` cached 5 s); the Base Health panel uses the same cut; catch-up (`js/damage.js`) never does; wording in the Barricade window and the topic.
- **The 10% / 20% values and the 3 / 5 / 7 state lines are THEORY dials** (proposed `CONFIG.MOMENTUM`): change only via the balance process.
- **BUILT 2026-11-11 (Build C, canvas half; DECISIONS 2026-11-11 (momentum build C, canvas)):** `#barricade` + `js/ui/barricadeView.js` + `Theme.barricadeAsset`, four PLACEHOLDER pictures in `Assets/Barricade/`, tap opens the window, `?barricade=<state>` dev preview, portrait strip at half size. Not phone-checked.
- **BUILT 2026-11-12 (Build C, placement; DECISIONS 2026-11-12):** the wall stands across the lane just right of the stairs (40x52 art at 2x). The zombie front line moved 28px right (`CONFIG.FRONT_LINE_GAP_PX`; 14 in the portrait strip) so it has real width; zombies are drawn on a 30px back-lane slant and slid so their feet nearly touch it (drawn only: timeline, due times and damage unchanged). Because an overdue zombie's box covers the wall, the Base Health window has a Barricade card (state + damage cut) that opens the Barricade window; the week-strip mark still works.
- **Theme:** barricade -> palisade / wards in a fantasy theme; state names and art come from the theme seam.
- **This is the parked "Fence + gate structure"** (ROADMAP, 2026-11-03): its stat is momentum. Mock it on the real canvas first, as that
  item says (a low line in front of the church the zombies reach).
- **Art:** 4 states (None may be bare ground or broken stakes). Jeremy regenerates in PixelLab from Claude's reference + prompt.

## Where the player sees it
- **Tap the barricade** -> the Barricade window: "N of 7" + state name, the last 7 nights (Defended / Missed / Excused), today's status
  ("Today: not yet secured" / secured), one line on away days and Sick Days, a link to How Deadline works. New HUD window -> `HudButtons.WINDOWS`.
- **The moon** keeps Nights Survived (now defended nights).
- **Week strip:** the strip is today + 6 days AHEAD, so only TODAY's cell gets a mark: hollow ring = not yet secured, filled check = secured.
  Past nights live in the Barricade window, not the strip.
- **Wording (Jeremy):** "Finish 1 priority or 1 routine to secure today's momentum." Used in the priority window / pips explainer and the
  Barricade window.
- **How Deadline works:** new topic "Nights and momentum" with the rules above and a Why line. Jeremy: anything built against cheating is
  explained there. Publishing the exact rules is fine; none depend on secrecy. Numbers read from CONFIG.
- **Return after time away:** plain, never scolding ("The barricade has fallen." -- no "while you were away", since it also falls when you are present but finish nothing; 2026-11-12).

## Parked (not v1)
- **Momentum check-ins (Jeremy, 2026-11-11):** when momentum falls off, step in with recommendations or check-ins to help the player get
  back on track; "will probably work better once we have an AI layer working".
- Time Logged as a third way to defend a night.
- A "weeks held" counter (momentum 5+ at a night's close) as a future headstone / achievement stat.

## Open for the build session
- Confirm `pri.d` and `att.perfect` mean exactly rule 1 (a priority finished that completion day; a routine with every item finished);
  where the 10-minute age test must be recorded (a counter in the daily record may be needed -> DailyRecord v14 or v15; mood has v14 reserved).
- How the per-run night count is stored once it is no longer "midnights since run start" (`Damage.computeDaysSurvived`,
  `NightsSurvivedView.countMidnights`, the test that keeps them identical), and the grandfathered offset for the current run.
- Undo: un-completing the only priority of a closed day should un-defend it (the Command Post already handles this for `pri.d`).
- The damage bonus must apply in the live loop only (`js/loop.js` / `js/damage.js`), and stack sanely with the work-timer half rate and family tiers.
- Suggested builds: A = rule + data + Nights Survived / Jailhouse + tests; B = Barricade window, today's strip mark, wording, How Deadline
  works; C = barricade art on the canvas + the damage bonus. Sonnet for all three once this plan is approved.
