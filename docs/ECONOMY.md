# Economy — Points, Shop, Tokens, Achievements

Source: PROJECT_SPEC.md (Features List → shop/monetization sections). Numbers below are canonical; they move to `js/config.js` when implemented.

## Points / Currency
- Earned by defeating enemies (completing tasks, completing positive habits, avoiding negative habits).
- Lost by indulging negative habits or missing positive habits. Balance CAN go negative (debt state gets clear visualization + recovery plan suggestions).
- Larger/more complex tasks award more points based on difficulty.
- High-streak habits: higher chance of DOUBLE points on completion.

## Shop — Exponential Pricing (anti-abuse)
**Formula: price = base cost × 1.5^quantity_owned** (unlimited scaling — encourages routine optimization over token dependency; base costs designed for weekly affordability)

| Item | Base cost | Effect |
|---|---|---|
| Repair kit (small) | 25 pts | Instant base HP restoration |
| Repair kit (medium) | 50 pts | Instant base HP restoration |
| Repair kit (large) | 100 pts | Instant base HP restoration |
| Enemy Pushback 1hr | 50 pts | Push enemy back 1 hour (stacking allowed) |
| Enemy Pushback 2hr | 100 pts | Push enemy back 2 hours (stacking allowed) |
| Enemy Pushback 1day | 300 pts | Push enemy back 1 day (stacking allowed) |
| Habit Cheat Day token | 200 pts | 1 day negative-habit indulgence without penalty |
| Sick Day token | 200 pts | 1 day habit suspension |
| Skip Day token | 200 pts | 1 day temporary habit pause |

## Shop UI requirements
- Product grid with clear pricing; inventory counter on each card
- Exponential pricing feedback: visual indicator showing WHY the price increased
- Purchase preview (effect shown before confirmation); token stacking preview + confirmation showing total effect
- Repair kit comparison: three tiers side-by-side

## Achievements & Badges
Based on run length (days survived), routine completion rates, and streak rates on individual tasks/habits. Level-up animations + milestone celebrations.

## Future monetization (spec'd, NOT for prototype)
Premium tier (unlimited routine slots, skins, analytics, cloud sync), token bundles.
