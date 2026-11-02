# Pushback Charges — Plan

Designed 2026-11-02 (Claude app session, Opus; Jeremy); balance pass the same morning (Fable, balance-tuning protocol). Decisions logged in `docs/DECISIONS.md` 2026-11-02. **Status: DESIGNED + BALANCED; Build A BUILT 2026-11-02 (pure logic + config + tests, sw v205); Build B BUILT 2026-11-02 (state + both doors + Base Health panel wired, sw v206); Build C (shop polish, help panels, Clock tower copy) not built.** Numbers are a THEORY pass against the ~7 pts/day earn rate; re-check against real play data once Jeremy has some.

## Why
Jeremy (2026-11-01): the pushback items in the shop have no Buy button (by design: they are applied from the zombie popup), which confuses players. Pushing a deadline and editing its due time are two doors to the same room with different rules. Both are priced far above the goal of **"a few small and medium adjustments a day, a few long ones a week."**

## Facts that shaped it
- Earn rate is about 7 pts/day (`POINTS_PER_TASK`/`HABIT` = 1, re-tuned 2026-07-21). Pushback today costs 50 / 100 / 300 pts (1 hr / 2 hr / 1 day). A 1 hr push is about a week of earnings.
- Editing the due time (`Economy.reschedulePrice`) is free more than 4 h out (calm zone), free within 10 min of creation, has 1 free paid-zone edit per rolling week, then charges the same pushback prices (×0.5 at 2–4 h).
- Points cannot fund "several a day": at ~7 pts/day that would need prices of 1–2 pts, which are meaningless against the rest of the shop. **Everyday flexibility must come from a refilling free allowance; points only pay for going past it.**
- Village building tiers are visual only today. The Clock tower (kind `punctuality`) counts items completed before their due time.
- Hover tooltips do not exist on phones. The app's pattern is a tap-to-show ⓘ (`.form-hint-btn`, `data-hint-for`, `js/ui/forms.js` Habit Goal section).

## The design

### 1. One system, two doors
The zombie popup's pushback row and the edit form's due-time change draw from **the same charges**. The edit form shows what a save will use instead of a price, e.g. *"Uses 1 Medium pushback (1 left today)."*

### 2. When rescheduling is free (unchanged rules, now explained everywhere)
- Moving a task **earlier**: always free.
- Any move while the task is **more than 4 hours away**: free. This is planning ahead.
- Any due-time edit **within 10 minutes of creating** the task: free (typo grace).

Charges only come into play when a zombie is close (4 h or less, or overdue), which is where the game's tension belongs.

### 3. Three sizes; a move uses the smallest that covers it
Distance is measured from the later of the current due time and now (2026-10-26 rule, unchanged).

| Size | Covers | Free allowance (T1) |
|---|---|---|
| Short | up to 30 min | 3 per day |
| Medium | up to 2 hr | 2 per day |
| Long | up to 1 day | 2 per rolling 7 days |

- Medium is 2 hr (Jeremy, 2026-11-02). With 1 hr, a 90-minute push would cost a Long.
- More than 1 day uses ceil(distance / 1 day) Longs.
- Daily charges refill at day rollover (`js/dayRollover.js`) and do not stack. Longs are a rolling 7-day window of use timestamps, like today's `rescheduleFreeUses`.
- The 2–4 h half-price zone factor goes away: inside 4 h any later move uses a charge.

### 4. Overflow: held tokens, then points (Jeremy, 2026-11-02: keep both systems)
When the free charges of a size are spent, the move uses the first available of:
1. a **held token** of that size (buy-to-hold in the shop, like Cheat Day; `consumable: true`), then
2. **points**: the popup button shows the price and pays and applies in one tap. The edit form shows the price before Save, as today.

Prices (DECIDED 2026-11-02, Fable): **Short 5, Medium 10, Long 30** (under a day's earnings, about 1.5 days, about 4 days). Level discount applies. The ratio is deliberate: Medium buys 4x the time of a Short for 2x the price, Long 12x for 3x, so committing to the bigger size is rewarded the way repair kits reward tier (HP per point). Chain-pushing with the small sizes is self-limiting (12 Mediums = 120 pts for what a Long does for 30). The 1.5^held price curve applies to held tokens as it does for every consumable.

The three new token items **replace** `pushback_1hr` / `pushback_2hr` / `pushback_1day` (50/100/300) and `RESCHEDULE_FREE_PER_WEEK`.

### 5. Clock tower stars add charges
Stars are per run, so they reset when the church falls. This adds stakes to the run without any new punishment.

| Clock tower | ~When | Allowance | Added |
|---|---|---|---|
| ★1 | start | 3 Short / 2 Medium a day, 2 Long a week | base |
| ★2 | ~4 days | 4 Short a day | +1 Short |
| ★3 | ~2.5 weeks | 3 Medium a day | +1 Medium |
| ★4 | ~7 weeks | 3 Long a week | +1 Long |
| ★5 | 3+ months | 4 Long a week | +1 Long |

Why the Clock tower and not player level (Jeremy, 2026-11-02: prioritise long-term engagement):
- It is the matching behaviour: keeping your word earns slack.
- Buildings gain a real, felt benefit, so the village matters.
- Tier pacing (4 days → 3+ months) gives a steady line of goals across months.
- Player levels end at 9 and already have a perk on every level.

### 6. Clock tower loophole (Jeremy, 2026-11-02: agreed)
A task moved **later while 4 h or less from due (or overdue)**, by charge, token or points, does **not** count for the Clock tower when completed. It still pays points and XP and counts for the Armory. Moves made more than 4 h out still count (planning ahead). Implementation: set an item flag (e.g. `pushedLate: true`) when a paid-zone move is applied. `js/villageProgress.js`'s punctuality counter skips flagged items. The flag is additive with no schema bump; document it in DATA_SCHEMA.

## Where the player learns the rules
All the ⓘ panels render ONE shared copy builder (`js/ui/pushbackHelp.js`, `PushbackHelp.hintHtml(ctx)`) so the wording never drifts. `ctx` supplies live counts.

| # | Place | What it shows |
|---|---|---|
| 1 | **Zombie popup**, pushback row | `Push back: [+30 min ●●●] [+2 hr ●●] [+1 day ●●]`, with dots = charges left (a hollow dot = will use a token or points) and an ⓘ that opens the full rules. |
| 2 | **Edit form**, the live `#editRescheduleNote` line | "Free: more than 4 hours away" / "Free: moving earlier" / "Uses 1 Medium pushback (1 left today)" / "Uses a held Medium token" / "Costs 10 pts", plus an ⓘ. |
| 3 | **Shop**, pushback token section | A one-line header "Used automatically when your free pushbacks run out" plus an ⓘ. The cards get normal Buy buttons, which fixes the original confusion. |
| 4 | **Clock tower card** | "What we measure" gets the loophole sentence (below). A new **"Your reward"** block shows the current allowance and what the next star adds. |
| 5 | **Base Health panel**, "what my items buy" | Its pushback buttons use the same charges and show charges left. |
| 6 | **Clock tower star-up toast** | Names the new allowance, e.g. "Clock tower ★2: +1 Short pushback a day". |

### Copy (draft; Jeremy to approve wording in Build C)

**ⓘ panel (shared):**
> **Rescheduling is free when:**
> • you move it earlier
> • it's more than 4 hours away
> • you fix the time within 10 minutes of creating it
>
> **Inside 4 hours, moving it later uses a pushback:**
> Short (up to 30 min): 3 a day · Medium (up to 2 hr): 2 a day · Long (up to 1 day): 2 a week
> Daily pushbacks refill each new day; Long ones refill over the week.
> Out of pushbacks? A held token is used, then points.
>
> Clock tower stars give you more. A task pushed inside its last 4 hours won't count as on time at the Clock tower.

**Where the grace rule is told (Jeremy asked 2026-11-02; wording to approve in Build C).** A move within 10 minutes of creating the task is free and is NEVER flagged, so it stays out of the Clock tower calculation. Tell the player in three places: the Clock tower card's "What we measure" (one sentence: "Fixing the time within 10 minutes of creating a task doesn't count against you."), the edit form's live note while it applies (already "Free: just created"), and the shared ⓘ panel's free-when list (already has the 10-minute bullet; add "and it never counts as pushed back").

**Clock tower "What we measure" (replaces the current text in `VillageCard.KINDS.punctuality.measures`):**
> Things you completed before their due time. Finishing late still counts as done, just not here. A task you pushed back inside its last 4 hours doesn't count here either; rescheduling while it's still more than 4 hours away is planning ahead, and still counts.

The live card copy changes in Build C, not before: until the charges exist, the loophole rule would describe something the game doesn't do.

## Build sub-sessions (Sonnet, medium; after the Fable balance pass)

### A — Pure logic + config (Jest)
**BUILT 2026-11-02 (Sonnet).** New `js/pushback.js` (not `economy.js`) with `sizeFor(deltaMs, sizes)`, `isFreeMove({currentDue,newDue,now,createdAt,graceMs,paidZoneMs})` -> `{later, free, reason, deltaMs, paidZone}`, `allowanceForStar(star, table)`, `chargesLeft(uses, nowMs, allowance, dayStartMs, sizes)` and `resolvePayment({size,count,chargesLeft,held,points,price})` -> `{ok, kind, charges, tokens, pointUnits, cost}` (unit by unit; `kind` = last source reached). `CONFIG.PUSHBACK_SIZES` (array, ascending, with `baseCost` and `window`), `PUSHBACK_ALLOWANCE` (stars 1-5), `PUSHBACK_PAID_ZONE_MS`. 49 tests in `test/pushback.test.js`. **Deviations (approved):** the old `pushback_*` rows, the `RESCHEDULE_*` keys and `Economy.reschedulePrice` stay until B (script.js still uses them); the three token rows go into `SHOP_ITEMS` in B (category `pushback` would change live reschedule prices). See DECISIONS 2026-11-02 (Build A).
- `CONFIG`: `PUSHBACK_SIZES` (`short` 30 min / `medium` 2 h / `long` 24 h), `PUSHBACK_ALLOWANCE` per Clock tower star, `PUSHBACK_PAID_ZONE_MS` (4 h), three token rows in `SHOP_ITEMS`. Remove the old pushback rows, `RESCHEDULE_FREE_PER_WEEK`, and the `approaching` 0.5 factor.
- `js/economy.js` (or a new `js/pushback.js`): `sizeFor(deltaMs)` → `{size, count}`; `chargesLeft(uses, nowMs, allowance, dayStartMs)`; `allowanceForStar(star)`; `resolvePayment({size, count, chargesLeft, held, points, price})` → `charge` | `token` | `points` | `blocked`; `isFreeMove({currentDue, newDue, now, createdAt})` → reason. Replaces `reschedulePrice`'s pricing branch.
- Tests: boundaries (exactly 30 min / 2 h / 24 h / 4 h), overdue distance, multi-day Longs, rollover at ★5, weekly window pruning, payment order.

### B — State + both doors
**BUILT 2026-11-02 (Sonnet).** `Pushback.quote` (one call: free or paid, size, count, payment breakdown), `quoteFixed` (a popup button: push by one size from the later of due and now), `apply` (new use stamps, tokens, points, `pushedLate`), `plusLabel`. `State.pushbackUses` (root save field, replaces `rescheduleFreeUses`); `DailyRecord` v6 `pb` + event `pushback`; `Items` records `done.late` for `pushedLate` items (complete + undo). Popup: one button per size from `deps.pushbackOptionsFor(item)` ("+30 min — free (3 left)" / "uses a token" / "N pts", disabled when blocked), habits Short/Medium only. Edit form: live line from `Popups.pushbackNoteText`. Base Health panel: one Medium button with a `pushbackNote` ("free · 2 left" / "uses a token") or the points price. script.js is the thin adapter (`pushbackInputs`, `reschedulePricingFor`, `commitReschedule`, `pushbackOptionsFor`, `handlePushback(sizeId, item)`); the Clock tower star is the real `villageProgressNow().punctuality.tier`. Removed: the `pushback_1hr/2hr/1day` rows, `RESCHEDULE_ZONE_FACTORS`, `RESCHEDULE_FREE_PER_WEEK`, `Economy.reschedulePrice` + helpers, `State.get/setRescheduleFreeUses`. Added: `pushback_short/medium/long` consumable shop rows (they get ordinary Buy buttons already; Build C adds the section header, ⓘ and copy). Small calls: popup moves also count in `item.rescheduleCount` and the `reschedules` run stat; daily charges are counted from today's local midnight by timestamp (nothing is cleared at rollover); stamps only record FREE charges. Live-checked in a cloud Chromium (charge, then token, then points; Base Health panel; edit-form lines; save round trip). Bullets below are the original build list.
- Persist `pushbackUses: { short: [ts], medium: [ts], long: [ts] }` (+ ★5 carry-over) in state. Additive; document it in DATA_SCHEMA; old saves default to empty.
- The zombie popup row (`js/ui/popups.js` `buildPushbackSectionHtml`), `handlePushback`, the edit form save path and the Base Health panel all route through `resolvePayment`.
- Set the `pushedLate` flag when `isFreeMove` says `paidZone` (grace and calm moves never flag; grace confirmed by Jeremy 2026-11-02); the Clock tower counter skips it. NOTE: `VillageProgress` takes punctuality from the daily record (`done` minus `done.late`), not from items, so a completion of a flagged item must be counted as late in `DailyRecord` at the `Items` completion seam.
- Remove the old `pushback_1hr/2hr/1day` rows, `RESCHEDULE_ZONE_FACTORS`, `RESCHEDULE_FREE_PER_WEEK` and `Economy.reschedulePrice` (+ `test/reschedule-price.test.js`), add the three token rows to `SHOP_ITEMS`, and rewire `reschedulePricingFor` / `commitReschedule` / `baseHealthContext` / `handlePushback` in script.js.
- Day rollover clears daily uses.

### C — Shop, help and copy
**BUILT 2026-11-02 (Sonnet).** `js/ui/pushbackHelp.js` (pure: `hintHtml`, `hintBlockHtml`, `dotsHtml`, `starGain`, `starUpText`, `rewardModel`, `wireHint`) is the one copy builder; live numbers come from script.js `pushbackHelpCtx()` (the same inputs the quotes use). ⓘ: popup (`#popupPushbackHint`), edit form (`#editPushbackHint`), Shop header (`#shopPushbackHint`). Dots on popup buttons (`o.total` = the star's allowance; none when the move is free because the zombie is calm). The copy is the draft above plus the grace line ("this never counts as pushed back" in the free-when list; "Fixing the time within 10 minutes of creating a task doesn't count against you." in the Clock tower card). Clock tower card: "Your reward" = current allowance + "Star N adds +1 X pushback a day/week" (or "Top star"). Star-up: `observeClockStar` (afterTick, 1/s) compares the Clock tower tier with the last one seen in memory; first reading after boot / new run / game over / offline catch-up only records it; notice is a queued modal (`FrozenNotice.showClockTowerStarUpNotice`). The Base Health panel keeps its one-line note ("free · 2 left", no ⓘ). Bullets below are the original build list.
- Shop token cards with Buy buttons (remove `.shop-pushback-hint`), plus the section header + ⓘ.
- `js/ui/pushbackHelp.js` + the ⓘ in the popup, edit form and shop.
- Clock tower card: new measures copy + "Your reward" block. Star-up toast line.
- Update ECONOMY.md, MECHANICS.md, UI_UX.md, SHOP_PLAN.md (pushback section superseded).
- sw bump; phone check of all six places.

### 7. Habits (DECIDED 2026-11-02, Fable)
A positive habit's popup offers **Short and Medium only**, applied to **today's instance** (the instance's own `dueDateTime`, which is what the popup already moves; the definition's time of day is untouched). No Long for habits: a 1-day push would land on top of tomorrow's spawn. Negative habits (lurkers) and KO ghosts keep no pushback, as today. Changing a habit's time of day for every day stays a free definition edit. The `pushedLate` flag applies to habits too (the Clock tower counts habits done on time). The sub-task clamp to its parent's due (existing rule) stays.

### 8. Daily record (CLAUDE.md rule)
Build B adds, in the same session: `DailyRecord` counters for pushbacks by size and by source (`charge` / `token` / `points`), bumps `DailyRecord.v`, and notes them in DATA_SCHEMA. Today's `token: {kind:'pushback'}` bump is replaced.

## Balance pass (2026-11-02, Fable) -- sanity check by run day
- **Day 1** (0 pts, ★1): 3 Short / 2 Medium / 2 Long free. Nothing to buy, nothing needed.
- **Day 7** (~50 pts, Lv4 10% off, Clock tower ★2 likely): a Long token is 27 pts, about half the balance, so buying one is a real choice against a Repair Kit (Small, 25). Shorts at 5 are cheap enough to cover one bad afternoon.
- **Day 30** (~200 pts, ★3): the allowance (4 / 3 / 2) covers an ordinary week; points go to day tokens (200) and kits, as intended. Held pushback tokens inflate 1.5^held like every consumable, so hoarding is discouraged.
- **Red flags:** a Long defers one item one day and avoids at most 12 HP of offline damage (the per-item cap) plus a miss; at 4 days of earnings it cannot save a run on its own, and the free allowance is capped per day/week. A pushed task never counts as on time (section 6), so pushback cannot farm the Clock tower. Nothing softens damage, freezes or the earn rate. Failure stays reflective: the allowance runs out exactly on the days worth noticing.

## Decided (Fable, 2026-11-02)
- Token prices 5 / 10 / 30 (above).
- ★5 = +1 Long a week (4). The Medium-rollover idea is rejected: it needs carry-over state, takes two sentences to explain, and is worth less than it sounds (one extra Medium on some days). The top two stars both add Longs on purpose: the Clock tower's late rewards are about the big slips.
- Habits: Short/Medium on today's instance, no Long (section 7).

## Rejected
- Pushback as player-level perks (levels already have a perk every level and end at 9; the Clock tower matches the behaviour and spans months).
- Points-only pushback at low prices (meaningless against the rest of the shop; undoes the 07-21 re-tune).
- Allowance only, with no points or tokens (a player who runs out on a bad day has no move, which is a common reason to quit).
- Keeping the 2–4 h half-price zone (a third rule nobody can predict).
- ★5 Medium rollover (see Decided).
- Long pushback on habits (collides with tomorrow's instance).
- Unlimited Shorts at ★5 (chain-deferring 30 min at a time undermines the behaviour change).
- Medium = 1 hr (a 90-minute push would cost a Long).
