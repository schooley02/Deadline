# Shop Plan ([P1-UI-008] — Milestone 3)

Planning session 2026-07-18 (session 19, Opus). Sequences the 13-point shop ticket into small,
one-system-per-session steps, the same way `UI_EXTRACTION_PLAN.md` handled the UI extraction.
Source of truth for items/prices/effects is `docs/ECONOMY.md`; pricing math already exists in
`js/economy.js` (`Economy.shopPrice`, built session 19).

**Line numbers below WILL drift — always re-Grep before trusting them.**

---

## Scope decisions (Jeremy, 2026-07-18 session 19)

1. **v1 = repair kits + pushback.** Day-tokens (Cheat/Sick/Skip Day) are deferred: Cheat Day needs
   negative-habit indulgence ([P1-DATA-005]), which is sequenced AFTER the shop. Repair kits and
   pushback both work fully against today's systems, so v1 is end-to-end testable.
2. **Entry point = 4th FAB menu item** (`data-type="shop"`), alongside Tasks/Habits/Routines. Reuses
   the existing `js/ui/managementWindows.js` window pattern — minimal new nav plumbing.
3. **Exponential pricing uses `owned = currently held`.** Using/consuming an item lowers the held
   count, so the next one is cheaper again (inventory-based, matches ECONOMY.md's "inventory counter
   on each card"). See the pushback wrinkle below.

---

## What the shop builds on (already exists)

| Need | Where it already is |
|---|---|
| Pricing formula | `Economy.shopPrice(baseCost, owned)` = `round(base × 1.5^owned)` — `js/economy.js` |
| Points balance + spend | `playerPoints` in script.js; `Economy.subtractPoints` (0-floor) / accessor deps |
| Base healing | `Damage.healBase(amount, deps)` — `js/damage.js` (clamps at `CONFIG.MAX_BASE_HEALTH`, no hit-flash) |
| Window + backdrop pattern | `ManagementWindows.openManagementWindow(type, deps)` — dispatch on `type`; `js/ui/managementWindows.js` |
| FAB menu | `#fabMenu` with `data-type` buttons — `index.html` ~95; `js/ui/fabMenu.js` |
| Enemy targeting (for pushback) | enemy-click popup — `handleEnemyClick`/`showTaskDetailsPopup`, `js/ui/popups.js` |
| Timeline position from due time | `movement.js` — pushback shifts an item's `dueDateTime` later, moving the zombie away from base |
| Persistence + migrations | `Persistence.SCHEMA_VERSION` (currently **3**), `migrate()` — `js/persistence.js`; persisted shape in `js/state.js` `getPersistableState` |

---

## The pushback pricing wrinkle (RESOLVED — session 4, 2026-07-19)

`owned = currently held` works for repair kits (you can stockpile them). But pushback is an
**instant-consume** effect — nothing is held, so "currently held" is always 0 and the exponential
price would never climb, defeating the anti-abuse intent. ECONOMY.md lists pushback with flat base
costs and "stacking allowed" but doesn't explicitly say pushback is exponentially priced.

**Resolved: FLAT pricing** (Jeremy, 2026-07-19 session 4, on Opus). Each pushback costs its base
price every time (50/100/300) — which is exactly what `Shop.price` already returns for
non-consumables (`held` is always 0, so `base × 1.5^0 = base`), so it needed zero pricing-code
change. Rejected: per-run purchase-count inflation — it would require a new persisted counter + a
v4→v5 schema migration + reset logic, stacking a persistence change onto this targeting session
against the one-persistence-change-per-session guardrail. If the session-5 balance pass (Fable)
decides pushback SHOULD inflate, that's the deliberate place to add the counter. Until then, the
anti-abuse pressure for pushback comes from the flat cost being non-trivial (50/100/300) plus the
fact that pushback only delays — the task still has to be done.

---

## Session sequence

Each row is one session: one system, tests green before and after, its own commit.
Foundation (state + pure logic) first, then the UI frame, then each effect, then the balance pass.

| # | Session | Scope | Model |
|---|---|---|---|
| **1 ✅** | State + config + `js/shop.js` (pure core, no UI) — **DONE 2026-07-18 session 20** | Added `inventory` to persisted state + `SCHEMA_VERSION` 3→4 migration; `CONFIG.SHOP_ITEMS` (6 items); `js/shop.js` pure `price`/`canAfford`/`purchase`/`consume`/`heldCount`/`getItem` (delegates to `Economy`). `test/shop.test.js` + migration cases; 19 suites, 403/403; live-verified in Chrome. Note built: `price(item, inventory)` (not `catalogPrice(item, owned)` as sketched) — takes the inventory object and derives held internally. See DECISIONS.md. | Opus → Sonnet |
| **2 ✅** | Shop UI frame — FAB 4th item + shop window — **DONE 2026-07-19 session 21** | Built as scoped. Note: shipped as `Shop.price(item, inventory)` (matches session 1's actual signature, not the `catalogPrice` name used in this plan's original sketch). **Bug found + fixed live in Chrome:** the Buy click handler's synchronous DOM rebuild detached the clicked button before its click event finished bubbling to script.js's document-level "click outside closes window" listener, so every purchase self-closed the shop window; fixed via `setTimeout(0)` deferring the rebuild. **This is a hazard for sessions 3 and 4 too** (repair-kit USE button, pushback-targeting popup both trigger their own DOM rebuild from a click) — see the hazards list below, now updated. 19 suites, 403/403 (unchanged — UI-only session). See DECISIONS.md session 21. | Opus → Sonnet |
| **3 ✅** | Repair kit inventory + USE → base heal — **DONE 2026-07-19 session 22** | Built as scoped: each repair-kit card grows a "Use (+N HP)" button once held > 0, calling `Shop.consume` (decrement) + the existing `healBase(amount)` wrapper (session-17 base regen code, reused as-is — clamps at `CONFIG.MAX_BASE_HEALTH`, updates display/sprite, saves). Disabled with "Base at full health" once `baseHealth >= CONFIG.MAX_BASE_HEALTH`, so a kit can't be wasted for zero effect. Applied the session-2 `setTimeout(0)` deferral to this click handler from the start — no repeat of that bug. 19 suites, 403/403 (unchanged — no new pure-core logic, `Shop.consume` already covered since session 1). Live-verified in Chrome: Use healed 60→75 HP, decremented held 1→0 (price dropped back to base 25 pts), window stayed open, persisted correctly across reload; separately verified the full-health disabled guard via a localStorage injection test. See DECISIONS.md. | Sonnet |
| **4 ✅** | Pushback items + enemy targeting — **DONE 2026-07-19 session 23** | Built as scoped. **Pricing wrinkle resolved: flat pricing** (Jeremy, 2026-07-19 — see below). Pushback lives in the enemy-click popup (`showTaskDetailsPopup`): a "Push back this deadline" section with the three tiers + live prices, each enabled only if affordable, applying to ANY enemy (task/sub-task/habit, Jeremy's call). Clicking a tier pays via `Shop.purchase` (non-consumable → inventory unchanged), shifts the target's `dueDateTime` via the new pure `Shop.pushedBackDueDate`, `recomputeOverdueStateAfterEdit`s it (un-camps + repositions if it crosses into the future), re-renders the agenda row + saves, and refreshes the popup IN PLACE (updates the shown Due time + re-checks each tier's affordability) to support stacking. Shop-window pushback cards now show a "Tap a zombie to push it back" hint instead of a dead Buy button. `test/shop.test.js` +4 `pushedBackDueDate` cases; 19 suites, 407/407. Live-verified in Chrome (shift, points, stacking, in-place affordability, overdue→un-camp + damage stop, persistence, console clean). No `setTimeout(0)` needed — the in-place refresh never rebuilds the clicked button's container. See DECISIONS.md. | Opus → Sonnet |
| **5 ✅** | Balance re-tune (THEORY pass) — **DONE 2026-07-19 session 24** | Jeremy chose a theory pass now (real-play re-check later — his save had only injected/test points). Yardstick: solid day ≈ 75–85 pts. Verdicts (all Jeremy's, on Fable): **repair kits VALIDATED as-is** (25/50/100 → 15/35/75; improving HP-per-point, heals ≈ 1/3/6 neglected-item recoveries, regen keeps kits an emergency niche); **pushback stays FLAT at 50/100/300** (closed economy is self-limiting; 6-hr stacking break-even documented; no persistence counter); **habit rate tiers RE-TUNED ≥90% 1.5×→2.0× and ≥70% 1.25×→1.5×** — top tier now = task parity (10 pts), the one change made. config.js + pinned habits.test.js values + ECONOMY.md/MECHANICS.md updated; 19 suites, 407/407. **[P1-UI-008] SHOP TICKET CLOSED** (day-tokens live with [P1-DATA-005]). Re-check all numbers against real play data once Jeremy has some — tracked in ROADMAP. See DECISIONS.md session 24. | Fable ✓ |

---

## Standing hazards for every session in this sequence

- **Inline `onclick=` needs `window.*` exposure** — the whole script.js is a `DOMContentLoaded`
  closure. Any handler referenced from an `onclick="..."` string must be assigned to `window`
  (bit multiple past sessions). Prefer real `addEventListener` listeners when building new markup.
- **Points spend goes through `Economy`** — never mutate `playerPoints` inline; use `Economy.subtractPoints`
  / the accessor deps, so the 0-floor and future negative-balance path ([P1-DATA-005]) stay in one place.
- **`css/*.css` order is load-sensitive** — `responsive.css` MUST stay last in `index.html` (see
  ARCHITECTURE.md / DECISIONS.md session 18). Add `shop.css` before it.
- **Schema migrations are append-only** — the 3→4 migration adds `inventory` defensively; older saves
  restore an empty inventory, never crash. Test with a real v3 save before shipping.
- **Cowork mechanics** (from CLAUDE.md): tests run in the sandbox scratchpad, never `npm install` in
  the repo; git commands are handed to Jeremy for his terminal; Jeremy runs `node server.js` and Claude
  playtests via Chrome control.
- **UI is less unit-testable than logic** — split each session's pure core (pricing, purchase math,
  due-time shift, overdue recompute) into `js/shop.js` and test THAT; lean on `node --check` + live
  Chrome smoke test for the DOM.
- **A click handler that rebuilds its own container's DOM must defer that rebuild** (found session 2,
  see DECISIONS.md). script.js has a document-level "click outside a management window closes it"
  listener (~line 1086) that runs `e.target.closest('.management-window')` on bubble. If a click
  handler does `someContainer.innerHTML = '...'` SYNCHRONOUSLY, it detaches its own event target
  before the event finishes bubbling — `closest()` on a detached node returns `null`, so the click
  reads as "outside" and closes the window immediately. Fix: wrap the rebuild call in
  `setTimeout(fn, 0)`. Repair-kit USE (session 3) and the pushback-targeting popup (session 4) both
  trigger their own click-driven DOM rebuild — apply the same deferral there.

---

## Model guidance

Sessions 1/2/4 open with an Opus judgment call (schema shape, window-integration approach, pushback
targeting UX + pricing basis) then drop to Sonnet for execution. Session 3 is pure execution — Sonnet.
Session 5 is a balance-philosophy batch — worth one Fable session across all three number sets at once.
