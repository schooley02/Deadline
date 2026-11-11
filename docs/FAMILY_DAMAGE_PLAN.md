# Family damage tiers -- plan and as built

DESIGNED + APPROVED 2026-11-11 (Claude app session, Opus 5.5; Jeremy: "i agree with your suggestions", "maybe we have three tiers of damage based on how many active subtasks the user has"). **BUILT 2026-11-11 (Sonnet 5.5, Claude app; "continue with build 2"; sw v325).** Not phone-checked.

## Problem
A parent and its attacking sub-tasks each hit for full damage, and a timer on the parent left an attacking sub at full rate, so splitting a task made the church take MORE damage than the task whole. It also looked like more damage than there was.

## Rules (as built)
1. **Family** = a parent plus every item whose `parentId` is that parent. A lone item is a family of one.
2. **Tier** = family members attacking right now (at the church: overdue, not a Break-habit lurker, not a KO ghost, not completed, **not iced**). The parent counts. Sub-tasks that exist or are due later never count. 1-2 attackers -> x1.0, 3-4 -> x1.5, 5+ -> x2.0 of ONE zombie's damage (`FAMILY_TIER_2_AT` 3, `FAMILY_TIER_3_AT` 5, `FAMILY_DAMAGE_TIER_2` 1.5, `FAMILY_DAMAGE_TIER_3` 2.0).
3. **Timer:** a work timer running on ANY family member halves the whole family (`WORK_TIMER_DAMAGE_FACTOR`). Live loop only.
4. **Ice:** a timer on the PARENT ices every family member at the church; a timer on a SUB-TASK ices only that sub-task (the rest are halved by rule 3). Each member spends its OWN ice budget (`item.iceUsedMs`), so a late sub never refills anything. Iced members drop out of the tier count.
5. **Pace:** damage is whole points per hit, so the rate is set by stretching each member's hit interval: with n attackers and multiplier m, every member swings every `DAMAGE_INTERVAL_MS * n / m` (halved by a timer: `/ 0.5`). The family lands m hits per base interval in total, and the members' own damage clocks (set by their due times) make them take turns. Theme-free: it counts attackers, never art.
6. **Catch-up** (offline reload and live gap) uses the same tier pace but ignores timers and ice, as before (`Damage.computeGapCatchUpHits` / `runOfflineCatchUp` take the member interval from `Family.intervalMs` with a due-time test for "at the church").

Net effect: parent + 1 sub = 2 attackers = x1.0 total (was x2); parent + 2-3 subs = x1.5; parent + 4 subs or more = x2.

## Code
- NEW `js/family.js` (global `Family`, optional like `Ice`): `members / attackers / tierMultiplier / tier / timerOn / intervalMs / rootId`.
- `js/ice.js`: `state / tick / thawAt / leftMs` take an optional `holder` (the item whose timer does the icing); `holderFor(item, items)`, `stateIn`, `leftMsIn` resolve it (a sub-task's holder is its parent when the parent's timer runs or is in its pause grace).
- `js/loop.js`: ice tick passes the holder; the overdue-damage interval comes from `Family.intervalMs` (falls back to `Timer.damageIntervalMs` when `Family` is not loaded).
- `js/damage.js`: `computeOfflineTicks / computeOfflineOverdueDamage` take an optional interval; `computeGapCatchUpHits` marks everything that fell due first (pass 1), then charges each member at its family interval (pass 2); `familyInterval` helper.
- `script.js`: the Base Health panel's attacker `tickMs` uses `Family.intervalMs`; the church pulse, hero hurt loop and panel read ice through `Ice.stateIn` / `leftMsIn`. `index.html` loads `js/family.js` after `js/ice.js`; `sw.js` v325 caches it.
- Tests: `test/family.test.js` (24: pure tiers, ice x family, live loop per-hour totals, catch-up parity).

## Known limits / dials
- Whole hits: an hour can read one or two hits short of the ideal when a family's clocks line up; over two hours the totals are exact (36 vs 24 for x1.5; 48 vs 24 for x2). Members' clocks are NOT staggered on purpose beyond their due times, so a family created together swings together (visual turn-taking is not enforced).
- A parent's pause grace only exists when the parent itself was at the church (`Ice.onPause`); pausing a parent that is not overdue thaws its subs at once.
- The Base Health panel's "church falls in" estimate holds each member's interval fixed (it does not model a tier changing as members thaw or finish).
- Dials (3 / 5, 1.0 / 1.5 / 2.0) are untested. If harsh, raise the thresholds (4 / 6); do not drop the parent from the count.
