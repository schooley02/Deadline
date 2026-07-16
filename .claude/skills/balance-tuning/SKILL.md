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
- Max enemies on screen: 20 (overflow offscreen right)
- Routine start: level 1, 1 habit slot + 1 task slot; slots grow per level
- Streak: resets to 0 on miss; high streak = chance of double points (exact % TBD — ask Jeremy)
- Shop pricing: price = base × 1.5^quantity_owned. Bases: repair kits 25/50/100; pushback 50 (1hr)/100 (2hr)/300 (1day); cheat/sick/skip day tokens 200 each
- Frozen routine slots: negative-habit streak ≥3 days freezes; recover via habit edit or 3-day avoidance
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
