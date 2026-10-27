---
name: balance-tuning
description: Governs any change to Deadline gameplay numbers — XP values, damage rates, token prices, timings, streak probabilities, level curves. Use whenever tuning game balance, adding a new constant, or when a mechanic "feels" too easy/hard.
---

# Balance Tuning Protocol

Every gameplay number in Deadline lives in `js/config.js`. Follow this protocol for ANY change:

## Before changing
1. Read the current value and its comment in `js/config.js`.
2. Read the relevant section of `docs/MECHANICS.md` or `docs/ECONOMY.md` — the docs state intent; the config states the number.
3. Check `docs/DECISIONS.md` — was this value already deliberated?

## Canonical values (as of restructure — config.js is authoritative once it exists)
- Base HP: 100, replenishes fully each day
- Overdue damage: 1 HP per 5 minutes until item completed
- Enemy enters base (damages routine health): after 1 hour overdue
- XP: 10 per task defeat, 5 per habit completion
- Points (currency): 1 per task defeat, 1 per habit completion base (re-tuned 2026-07-21 from 10/5). High-priority ×2. Sub-task pays 1 pt on its own (and counts in `subtasksCompleted`, not `tasksCompleted` / Task Slayer, since 2026-10-27); a parent that ever had a sub-task pays 0 pts of its own on final completion. Habit rate bonus: 100% of a full 22-occurrence window → 3×, ≥80% → 2×, else 1×.
- Max enemies on screen: 20 (overflow offscreen right)
- Routine start: level 1, 1 habit slot + 1 task slot; slots grow per level
- Player level perks (`CONFIG.LEVEL_PERKS`, 2026-10-23): Lv2 small repair kit, Lv3 2nd routine slot, Lv4 10% shop discount, Lv5 3rd slot, Lv6 medium repair kit, Lv7 4th slot, Lv8 20% discount, Lv9 Sick Day + "Steward" title. Per-run (reset on game over). No 200-pt token before max level.
- Streak: resets to 0 on miss; VISUAL only (no economy effect since 2026-07-18)
- Shop pricing: price = base × 1.5^quantity_owned. Bases: repair kits 25/50/100; pushback 50 (1hr)/100 (2hr)/300 (1day); cheat/sick/skip day tokens 200 each
- Frozen routine slots: negative-habit streak ≥3 days freezes; recover via habit edit or 3-day avoidance
- KO ghosts (2026-10-25, decided not built): ghost completion pays points × `KO_GHOST_POINTS_FACTOR` 0 (XP + habit success occurrence unchanged); undone ghosts are excused
- Rescheduling (2026-10-25, decided not built): later-move price = pushback tier for distance × `RESCHEDULE_ZONE_FACTORS` {>4h 0, 2-4h 0.5, <2h 1, overdue 1}; `RESCHEDULE_GRACE_MS` 10 min after creation free; `RESCHEDULE_FREE_PER_WEEK` 1
- Work timer (2026-10-25, decided not built): overdue damage × `WORK_TIMER_DAMAGE_FACTOR` 0.5 while running; `WORK_TIMER_CHECK_MS` 60 min, `WORK_TIMER_AUTO_STOP_MS` 10 min
- Survival count (2026-10-27): NIGHTS = local midnights crossed since run start (`Damage.computeDaysSurvived`; was floor(elapsed / 24h)). Survivor tiers 3 / 7 / 14 / 30 nights; Steady Hands needs >= 7 nights.
- Demo clock: 60s = 1 day (testing only, `config.DEMO_MODE`)

## Making the change
1. Change ONLY `js/config.js`. If the number is hardcoded elsewhere, that's a bug — move it to config first.
2. Sanity-check the player experience at day 1, day 7, day 30 of a run (or ask the `game-designer` agent).
3. Update the value in this SKILL.md's canonical list and in the relevant docs/*.md.
4. Append to `docs/DECISIONS.md`: old value → new value, why.

## Red flags — stop and ask Jeremy
- A change that lets tokens/pushbacks trivially save a run (undermines real behavior change)
- Anything making failure feel punishing rather than reflective
- Changing run-defining numbers (base HP, damage rate) after runs exist in saved data
