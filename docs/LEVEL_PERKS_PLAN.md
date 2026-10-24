# Level Perks + Level Panel — Plan

Designed 2026-10-23 (Claude app session, Fable, balance-tuning protocol). Decisions logged in `docs/DECISIONS.md` 2026-10-23; numbers in `CONFIG.LEVEL_PERKS` (`js/config.js`); economy intent in `docs/ECONOMY.md` "Level perks".

## Why
Jeremy asked (2026-10-23): where can I see how many routine slots I have, which are frozen / empty / used, and how close I am to the next one? Today the only place is the Routines window; the HUD's slot display is dead code (its element is gone from `index.html`), and the XP stat is a running total, not progress. Player levels run 1–9 but only 3/5/7 unlock anything, so a perks list would have shown four empty level-ups. This plan fixes both: a perk at every level, and a level panel that shows them.

## Facts that shaped it
- Level, XP, points, inventory and routine slots all reset on game over (`State.initGame`). Perks are **per-run**: losing the run loses them. Intended — it gives the church stakes.
- Pace at ~70 XP/day (5 tasks + 4 habits): Lv2 ≈ day 2, Lv3 ≈ 4, Lv4 ≈ 7, Lv5 ≈ 12, Lv6 ≈ 17, Lv7 ≈ 24, Lv8 ≈ 33, Lv9 ≈ 43.
- Points earn 5–9/day (2026-07-21 re-tune); a 200-pt token is a 3–5 week save. Gifting one early would trivialise saving a run (balance-tuning red flag #1).
- Pushbacks are instant (`consumable: false`) — they cannot be gifted into inventory without a new credit mechanism. Gifts are held items only.
- Routine slots mean two things: PLAYER routine slots (how many routines may be active) vs each routine's OWN habit/task slots (what the Hero tray shows). The panel says "Routine slots" explicitly.
- A slot is used by an **active** routine. Frozen = still active (keeps its slot). KO'd = auto-deactivated (slot looks free until revive) — the panel shows this as its own state, not as empty.

## The schedule (`CONFIG.LEVEL_PERKS`)
| Lv | ~Day | Perk | Notes |
|---|---|---|---|
| 1 | 0 | 1 routine slot | start |
| 2 | 2 | Repair Kit (Small) ×1 | 25 pts; welcome gift, teaches the shop |
| 3 | 4 | 2nd routine slot | existing |
| 4 | 7 | 10% off the shop | first week |
| 5 | 12 | 3rd routine slot | existing |
| 6 | 17 | Repair Kit (Medium) ×1 | 50 pts (swapped from a pushback — see Facts) |
| 7 | 24 | 4th routine slot | existing |
| 8 | 33 | 20% off the shop | replaces 10% |
| 9 | 43 | Sick Day ×1 + title "Steward of the Church" (+ church skin when art exists) | capstone; shows on that run's review card |

Principles: slots on odd levels, convenience on even levels, no 200-pt token before max level, nothing that softens damage/freezes/earn rate. Discount escalates 10→20% deliberately (Jeremy: deeper runs should feel rewarded and make buying — and therefore using — items more attractive).

## Rejected
Inventory cap / "item slots" (no cap exists; inventing one to lift it is a non-perk). Base-regen boost, frozen-slot or overdue mercy (make failure less reflective). Points earn-rate bonus (undoes the 07-21 re-tune). Feature gating of existing UI (annoying, not rewarding).

## Build sub-sessions (Sonnet, medium)

### A — Perk wiring (pure + script.js)
- `js/progression.js`: `perksForLevels(table, fromLevel, toLevel)` (levels gained, inclusive of `toLevel`), `shopDiscount(table, level)` (highest `discount` at or below level, 0 if none), `xpProgress(xp, thresholds, level)` → `{ into, needed, pct }` (max level → pct 1, needed 0), `nextSlotUnlock(slotsTable, level)`.
- `script.js checkPlayerLevelUp`: for each level gained, apply `item` perks via the existing inventory add path (`Shop`/`State.setPlayerInventory`), then `saveGame`. Multi-level jumps already handled by `Progression.checkLevelUp`.
- `js/shop.js price()` / `Economy.shopPrice`: multiply by `(1 - discount)`, round, min 1. Discount derived from level each call — nothing persisted. Shop card shows "−10%" tag when active.
- Level-up toast names the perk(s) (`Hud.showLevelUpMessage` gets a `perkLabels` dep).
- Run history: `RunStats.finalizeRun` records `peakPlayerLevel` (additive field, no schema bump — old records simply lack it). Run review card shows the Steward title/skin when `peakPlayerLevel >= 9`.
- Tests: new `test/levelPerks.test.js` for the pure helpers + discount pricing + multi-level gift; extend run-history test for `peakPlayerLevel`.

### B — Level panel (UI)
- HUD: XP stat becomes a slim progress bar with "Lv N" beside it; level box is a button with a chevron/ⓘ (never a "+"). `#totalRoutineSlotsDisplay` dead reference deleted from `Hud.updatePlayerDisplays`.
- New `js/ui/levelPanel.js` + `css/levelPanel.css` (Modal pattern; buttons that open other windows need `stopPropagation`): level + "140 / 200 XP" + rough "≈ N completions to go"; **Routine slots** pip row — used (hero avatar via `HeroTray` cell builder → tap opens Manage Routine), frozen (ice tint + recovery line), KO'd ("revives tomorrow"), empty (dashed, **"+"**, tap → create routine), locked (🔒 "Lv 5"); perks list — current, next 1–2, rest hidden; Steward title row at max level.
- Hero tray header gets "Routines 3/4 · 1 frozen" opening the same panel (shared data path, no second renderer).
- sw.js bump; live check at 390×844 and 844×390.

## Open
- Church skin art for the Steward title (V4+ track) — `skin: 'steward'` is a hook only.
- ~~Whether a level-up with a gifted item should auto-open the shop or just toast.~~ **Decided 2026-10-23 (Jeremy): toast only.** The level-up toast names every perk gained (including gifted items); the shop does not open.
