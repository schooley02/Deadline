# Ice (work-timer freeze) -- plan

DESIGNED 2026-11-10 (Claude app session, Opus 5.5; Jeremy: "i agree with your suggestions"). **BUILT 2026-11-10 (Sonnet 5.5, same day; Jeremy: "lets start now and yes to the 2 numbers"; sw v314; DB v12).** Numbers APPROVED: `ICE_MAX_MS` 60 min, `ICE_GRACE_MS` 5 min (DECISIONS 2026-11-10 (ice built)).

**As built (deviations from the plan below):** the pure core is `js/ice.js` with `atBase / state / leftMs / thawAt / onPause / clearGrace / clearOthers / tick / budgetLeftMs / graceLeftMs` (not the `isIced / spend` names). Pause-grace start is a new saved field `item.icePausedAt` (the timer stores no pause timestamp); `item.iceUsedMs` is the budget. Unsaved per-item tracking (last tick, episode length, phase) is a WeakMap inside `Ice`. One-timer rule is now `Timer.startExclusive(items, item, now)` (stops any other running timer, ends other items' grace), used by `toggleWorkTimer`. DailyRecord is **v12** `ice` { n, min }: `n` counts ice STRETCHES (each thaw), `min` = ice minutes; recorded once at each thaw. So W1b mood is now **v13**. `js/baseModel.js` attackers take `iceMs` / `iceThawing`; the Base Health panel rows read "Iced · thaws in X" / "Thawing · thaws in X" and the chip says "Iced" when every attacker is iced. CSS placeholder `css/enemyIce.css` (blue-grey tint + cold glow, sprite sheet paused; thawing flickers). **Follow-ups, same day (Jeremy, phone check, sw v315 / v316):** (1) the church's under-attack flash + shake (`Damage.pulseIfUnderAttack`, new optional `isIced` dep) and the hero's hurt loop (`HeroSpotlight.attackedHeroIds`, new optional 5th arg) now skip iced zombies; a hero with one iced and one live attacker still shows hurt; an iced zombie's hero idles. Hero HP was already safe (the loop skips routine damage for an iced attacker). (2) **Thaw countdown, always on while iced:** a pill badge over the zombie's head (`.ice-countdown`, beside the head in the portrait strip) and a chip beside the row's timer button (`.ice-note`, "Iced 42:10", "Thawing 4:12"), both written every tick by `iceCountdown` in `js/loop.js`, amber in the thawing phase; a sub-task's chip rides in its parent's row. **Not built (deferred):** shard burst on thaw, shatter on completion, fx-off variants beyond the static tint. **Known limits:** the first ~50 ms tick of a stretch is not counted; session charge-back (Timer.trackAttack) still treats iced minutes as attack windows, so shortening a session later charges them back at the half rate.

## Goal

A zombie that is already at the church stops attacking while you are actually working on its task. It is encased in ice. Work too long and the ice cracks: it attacks again at the timer's half rate. Stop working and it thaws at once.

Why: it rewards the hardest step (starting) at the moment players most often give up ("it's already overdue, why bother"). It cannot be bought, stockpiled or used without doing the task, so it pushes toward the real work, not away from it.

## What Jeremy decided (2026-11-10)

- **Not an item.** Free and automatic: running the work timer on the task is the price. No shop row, no held token.
- **Not pushback.** The due time and the zombie's position do not move. A real deadline that cannot be pushed stays honest: the zombie stays at the church, it just cannot hit.
- **Only at the church.** A walking zombie is not iced (its walk IS the clock), and gets no frost cue either (Jeremy, 2026-11-10: the ice clock only starts once it attacks).
- **Capped.** Ice runs out even if the timer keeps running ("if it takes too long, you didn't plan well enough"). After that, the zombie attacks at the work timer's existing half rate.
- **Ice visual wanted.** CSS placeholder first, PixelLab art later.
- **Option 2 dropped** (whole-field "Frost Day"): Sick Day / Skip Day / Habit Cheat Day already cover days off.

## Rules

1. **Iced** = the item is at the base (attacking) AND the work timer is running on THIS item AND the item still has ice left (`iceUsedMs < ICE_MAX_MS`).
2. **Damage:** an iced attacker deals 0 base damage and 0 routine damage. Every other attacker keeps today's rule (half rate while any work timer runs, `WORK_TIMER_DAMAGE_FACTOR`). When the ice runs out with the timer still on, this attacker also goes to the half rate. Timer stopped = normal rate.
3. **Only the timed item.** A timer on a sub-task ices that sub-task's zombie only, never its parent; a timer on a parent never ices its sub-tasks.
4. **Ice used is counted per item, across sessions** (`item.iceUsedMs`), so stop/start cannot refill it. A one-off task has one budget for its life. A recurring instance starts at 0 (each instance is a new item). A new run's carried-over task keeps its count.
5. **Pause grace:** pausing the timer leaves the ice on for `ICE_GRACE_MS` (cracking visual), counted against the budget. Resume within the grace window = still iced. Grace ends, or Stop, or Complete-elsewhere = thaw at once.
6. **Damage clock on thaw:** the attacker's `lastDamageTickTime` is set to the thaw moment, so no hit is back-charged for iced time and the next hit lands one full interval later (same rule as "items created already overdue").
7. **Catch-up ignores ice**, exactly as it already ignores timers ("Catch-up damage ignores timers", MECHANICS Timers line). Offline and live-gap damage are unchanged. No new catch-up math.
8. **Regen stays paused** (Jeremy, 2026-11-10): an iced zombie still counts as attacking, so the church does not heal while it sits there. Ice stops the bleeding; only finishing the task lets the church recover.
9. **Break Habits** never attack (lurker model), so ice never applies to them. Build Habits on a work timer follow the same rules as tasks.
10. **One timer at a time (Jeremy, 2026-11-10: "make sure you can only start a timer on one task/habit at a time").** Already true today: `toggleWorkTimer` in script.js (the only caller of `Timer.start`) stops any running timer before starting a new one, so at most ONE zombie can be iced. Two gaps the build closes: (a) a PAUSED item in its pause grace loses its ice the moment a timer starts on a different item (otherwise two zombies could be iced at once for up to `ICE_GRACE_MS`); (b) no test locks the rule today, so the build adds one (starting B stops A; A's ice and grace end at once).
11. **"Still working?"** (60 min) and the auto-stop 10 min later are unchanged. With the proposed cap equal to the check time, the ice cracks when "Still working?" appears: answering yes keeps the timer at the half rate.

## Numbers (APPROVED 2026-11-10)

| Key | Proposed | Why |
|---|---|---|
| `ICE_MAX_MS` | 60 min | Matches `WORK_TIMER_CHECK_MS`, so "Still working?" and the ice cracking are one moment. One focused hour is a fair "planned well" window. |
| `ICE_GRACE_MS` | 5 min | A short break (bathroom, phone call) without punishing; short enough that pausing is not a shield. |

New `CONFIG` keys, data only. Tune in `js/config.js` per the balance protocol, logged in DECISIONS.

## Data (additive, no schema bump, no migration)

- `item.iceUsedMs` (number, absent = 0): ice spent so far.
- Pause-grace start: `item.icePausedAt` (ms epoch, null when none). The timer stores no pause timestamp, so the build added this field.
- **DailyRecord field `ice` { n, min }** (Jeremy, 2026-11-10: yes): `n` = items iced that day, `min` = whole minutes of ice spent. DailyRecord **v12** (BUILT); W1b mood moves to v13. Followed `docs/DAILY_RECORD_PLAN.md` (seam, roll-up, version bump, tests).

## Pure core: `js/ice.js` (test-first)

- `isIced(item, timerState, now, config)` -> boolean
- `iceLeftMs(item, timerState, now, config)` -> ms
- `spend(item, fromMs, toMs, config)` -> new `iceUsedMs` (clamped to the cap)
- `thawAt(item, timerState, config)` -> timestamp the ice ends if nothing changes (for the damage panel ETA)
- No DOM, no globals; `Timer` and `CONFIG` injected (Baseline engine rule: theme-free; the "ice" look is the Deadline theme).

## Wiring

- `js/loop.js` overdue-damage tick: skip an iced attacker; on its thaw tick set `lastDamageTickTime = now`; spend ice each tick while iced.
- `Timer.stop / pause / resume / autoStop`: settle `iceUsedMs` at the boundary.
- Damage panel (Base Health): the attacker row shows "Iced -- 42 min left" (cracking: "Thawing -- 3 min"); the merged hit schedule and the "church falls in" ETA start this attacker at `thawAt`.
- How Deadline works, `timers` topic: one line, e.g. "Start a timer on a zombie that's at the church and it's iced: it can't attack for up to an hour. Stop, or work past the hour, and it thaws."

## Visual (CSS placeholder; Deadline theme)

- `.enemy-iced`: cool blue tint + frost overlay on the sprite, walk bob stopped, the at-base red pulse suppressed.
- `.enemy-thawing` (pause grace, and the last 5 min before the cap): crack overlay, slow flicker.
- ~~`.enemy-frosted` (walking, timer on)~~ **DROPPED 2026-11-10 (Jeremy):** the ice clock only starts when the zombie is attacking, so a walking zombie with a timer running needs no cue.
- Thaw: a short shard burst. Completing an iced zombie: it shatters (stacks with the screen thump).
- `fx-off` / `fx-reduced` / `prefers-reduced-motion`: static tint only, no flicker or shards.
- Later art (PixelLab): ice-block overlay, cracked frame, shard sprite. Hand Jeremy a reference image + PixelLab prompt per his art workflow.

## Naming

Player-facing: **Iced** / **Thawing**. Code: `ice*`. Do NOT use "frozen" / "freeze": already taken by frozen routine slots (`docs/FROZEN_SLOTS_PLAN.md`) and `FrozenNotice`.

## Tests (Jest, test-first)

- `ice.test.js`: iced only at base + own timer + budget left; sub-task/parent isolation; budget persists across stop/start; grace counts against budget; resume within grace stays iced; cap reached -> half rate, not zero, not full; stop -> full rate; thaw resets the damage clock (no back-charge).
- `loop` damage: iced attacker 0 HP over N ticks; other attackers still half; after cap this one half.
- Catch-up: offline / live-gap damage identical with and without ice.
- Damage panel ETA uses `thawAt`.
- Regen stays paused while the only attacker is iced.
- One timer at a time: starting a timer on B stops a running A and ends A's ice; a paused A in grace thaws when B starts; never two iced zombies at once.
- DailyRecord `ice` { n, min } recorded and rolled up; old records without it read as 0.
- Wording rule test still passes.

## Build order (DONE 2026-11-10)

One build, **Sonnet 5.5, medium effort**: `js/ice.js` + tests -> loop wiring -> timer boundaries -> damage panel -> CSS placeholder -> DailyRecord `ice` -> How Deadline works line -> docs (MECHANICS Timers + Overdue Damage, UI_UX, DATA_SCHEMA, ECONOMY "not a shop item" note) -> sw bump. Phone check by Jeremy.

## Not doing / risks

- No shop item, no held token, no per-day charges.
- No ice on walking zombies (would turn into pushback).
- Risk: a forgotten timer. Covered by the cap and the existing "Still working?" auto-stop.
- Risk: players timing tasks they are not doing. Same honesty limit as the timer today; the cap bounds it to one hour of protection per task.
