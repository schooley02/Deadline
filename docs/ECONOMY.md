# Economy — Points, Shop, Tokens, Achievements

Source: PROJECT_SPEC.md (Features List → shop/monetization sections). Numbers below are canonical; they move to `js/config.js` when implemented.

## Points / Currency
- Earned by defeating enemies (completing tasks, completing positive habits, avoiding negative habits).
- Lost by indulging negative habits or missing positive habits. Balance CAN go negative — **debt design decided 2026-07-19 session 26 (Fable, see DECISIONS.md): unbounded, fully orthogonal to base health, no clearing deadline.** Debt's function is keeping indulgence costly at 0 balance (a 0-floor would make lapses free for the player most in trouble), not punishment. Debt UX: red HUD + agency-framed break-even nudge ("−12 · complete 2 tasks to break even"); shop self-gates via `canAfford`; the fuller "recovery plan suggestions" surface is deferred to the run-review screen. Indulgence uses a dedicated non-clamping path in `js/economy.js` ([P1-DATA-005] sub-session 3); uncompletion refunds keep the 0 floor.
- Larger/more complex tasks award more points based on difficulty.
- Habit points bonus (BUILT 2026-07-18 session 16, replaces the old flat streak bonus): a capped multiplier from the habit's rolling success rate over its last 14 recorded occurrences — **≥90% → 2× ("task parity": round(5 × 2) = 10 pts, same as a task), ≥70% → 1.5× (8 pts), else 1× (5 pts)** (`CONFIG.HABIT_RATE_*`, config-tunable; 1× until ≥7 occurrences recorded). `pointsGained = round(POINTS_PER_HABIT × multiplier)`. Points only, never XP. Multipliers TUNED 2026-07-19 (session 24 theory pass, Fable): the top tier is deliberately anchored to `POINTS_PER_TASK` for legibility — "a habit you keep excellently is worth a task." Re-check against real play data. See MECHANICS.md Habits + DECISIONS.md.

## Shop — Exponential Pricing (anti-abuse)
Points math + this pricing formula live in `js/economy.js` (built 2026-07-18 session 19, [P1-DATA-007]): `Economy.shopPrice(baseCost, quantityOwned)`, plus `taskPoints` (high-priority ×2) and `addPoints`/`subtractPoints` (refunds floor at 0 until P1-DATA-005 indulgence adds the negative-balance path). The shop is BUILT ([P1-UI-008], sessions 20–24, 2026-07-18/19): repair kits + pushback live; day-tokens deferred to [P1-DATA-005].

**Formula: price = base cost × 1.5^quantity_owned** where owned = currently-HELD count (consumables only — using an item makes the next cheaper again). Pushback is instant-consume and therefore effectively **flat-priced** (decided session 23/validated session 24: the closed points economy is self-limiting — pushing costs real completed-task earnings — so no per-run inflation counter; revisit only if real play shows push-spam).

**Balance rationale (session-24 theory pass, 2026-07-19, Fable — see DECISIONS.md):** yardstick is a solid day's earnings ≈ 75–85 pts (5 tasks + 4 mid-tier habits). Repair kits: HP-per-point improves with tier (0.60/0.70/0.75), each tier's heal ≈ undoes 1/3/6 offline-neglected items (12 HP cap each), and free regen (12 HP/hr) keeps kits an emergency top-up, not a subscription. Pushback: stacking 1hr tokens breaks even with the 1-day token at exactly 6 hours — hourlies serve small slips, the day token is the ~4-days-of-earnings emergency parachute. All shop numbers VALIDATED as-is; re-check against real play data.

| Item | Base cost | Effect |
|---|---|---|
| Repair kit (small) | 25 pts | Instant base HP restoration (mid-run top-up on top of the free gradual regen decided 2026-07-18 — see MECHANICS.md Base) |
| Repair kit (medium) | 50 pts | Instant base HP restoration |
| Repair kit (large) | 100 pts | Instant base HP restoration |
| Enemy Pushback 1hr | 50 pts | Push enemy back 1 hour (stacking allowed) |
| Enemy Pushback 2hr | 100 pts | Push enemy back 2 hours (stacking allowed) |
| Enemy Pushback 1day | 300 pts | Push enemy back 1 day (stacking allowed) |
| Habit Cheat Day token | 200 pts | 1 day negative-habit indulgence without penalty — semantics decided session 26: while active, indulging costs nothing and NO occurrence is recorded (day excused — not success, not miss); streak preserved, not incremented. Ships in [P1-DATA-005] sub-session 5 (held-inventory exponential pricing, like repair kits) |
| Sick Day token | 200 pts | 1 day habit suspension — DEFERRED to the frozen-slots ticket (session 26: spec ambiguous on per-habit vs global; interacts with recovery streaks) |
| Skip Day token | 200 pts | 1 day temporary habit pause — DEFERRED to the frozen-slots ticket (same reasoning as Sick Day) |

## Shop UI requirements
- Product grid with clear pricing; inventory counter on each card
- Exponential pricing feedback: visual indicator showing WHY the price increased
- Purchase preview (effect shown before confirmation); token stacking preview + confirmation showing total effect
- Repair kit comparison: three tiers side-by-side

## Achievements & Badges
Based on run length (days survived), routine completion rates, and streak rates on individual tasks/habits. Level-up animations + milestone celebrations.

## Future monetization (spec'd, NOT for prototype)
Premium tier (unlimited routine slots, skins, analytics, cloud sync), token bundles.
