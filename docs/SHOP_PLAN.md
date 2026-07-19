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

## The pushback pricing wrinkle (sub-decision, resolve in session 4)

`owned = currently held` works for repair kits (you can stockpile them). But pushback is an
**instant-consume** effect — nothing is held, so "currently held" is always 0 and the exponential
price would never climb, defeating the anti-abuse intent. ECONOMY.md lists pushback with flat base
costs and "stacking allowed" but doesn't explicitly say pushback is exponentially priced.

**Proposed (confirm when building session 4):** price pushback by **count purchased in the current
run** (resets on new run / game-over), so repeated same-run pushback inflates but a fresh run starts
cheap. Alternative: flat price for pushback (simplest, matches the table's face value). This is a
balance call — fold into the session-5 tuning pass if unresolved.

---

## Session sequence

Each row is one session: one system, tests green before and after, its own commit.
Foundation (state + pure logic) first, then the UI frame, then each effect, then the balance pass.

| # | Session | Scope | Model |
|---|---|---|---|
| **1** | State + config + `js/shop.js` (pure core, no UI) | Add `inventory` to persisted state (`getPersistableState` + restore) with a `SCHEMA_VERSION` 3→4 migration seeding `inventory: {}` on old saves. Define the shop catalog in `js/config.js` (`SHOP_ITEMS`: id, name, category, baseCost, effect params) — balance-tuning protocol for the numbers. `js/shop.js`: pure `catalogPrice(item, owned)` (wraps `Economy.shopPrice`), `canAfford`, `purchase` (returns new points + new inventory, no DOM), `heldCount`. `test/shop.test.js`. | Opus → Sonnet |
| **2** | Shop UI frame — FAB 4th item + shop window | `index.html`: 4th FAB button `data-type="shop"` + `#shopWindow` markup. `js/ui/shopView.js`: render the catalog grid, per-card price (live via `Shop.catalogPrice`) + inventory counter + Buy button wired to `Shop.purchase`, purchase preview, and the "why did the price go up" exponential feedback (ECONOMY.md UI reqs). Wire `type === 'shop'` into `ManagementWindows.openManagementWindow`. `css/shop.css` (linked before `responsive.css`). Repair kits land in inventory; USE comes next session. | Opus → Sonnet |
| **3** | Repair kit inventory + USE → base heal | Inventory panel (held counts) with a "Use" action per repair-kit tier → `Damage.healBase(amount)`, decrement held count, re-render price (now cheaper — the `owned=held` loop). Three tiers side-by-side (ECONOMY.md). Closes the repair-kit loop end-to-end. | Sonnet |
| **4** | Pushback items + enemy targeting | Resolve the pricing wrinkle above. Buy pushback → select target enemy (hang off the existing enemy-click popup in `popups.js`: add a "Push back" action when pushback is affordable/held) → shift that item's `dueDateTime` later by the tier's amount, re-render its position, clear overdue state if it moves into the future (reuse `recomputeOverdueStateAfterEdit` from `items.js`). Stacking allowed. `test/` for the pure due-time shift + overdue recompute. | Opus → Sonnet |
| **5** | Balance re-tune (balance-tuning protocol) | Now that real shop prices exist, re-tune: repair-kit base costs, pushback pricing basis, AND the habit rate-tier multipliers (`CONFIG.HABIT_RATE_TIERS` — flagged since session 16 as legibility placeholders pending shop prices). Log every number to `docs/DECISIONS.md` per the balance-tuning skill. | Fable (batch the balance judgment) |

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

---

## Model guidance

Sessions 1/2/4 open with an Opus judgment call (schema shape, window-integration approach, pushback
targeting UX + pricing basis) then drop to Sonnet for execution. Session 3 is pure execution — Sonnet.
Session 5 is a balance-philosophy batch — worth one Fable session across all three number sets at once.
