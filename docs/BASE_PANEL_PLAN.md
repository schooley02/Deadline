# Base Health Panel — Plan

Designed 2026-10-26 (Claude app session). Mockups: Design canvas "Base Health Panel" (Healing / Under attack / Full / HUD chip). Rule changes already shipped and logged in `docs/DECISIONS.md` 2026-10-26 (quiet-span healing, pushbacks count from max(now, due)).

## Why
Players can't see how fast the base heals or dies, so they can't judge whether to spend kits or pushbacks. The panel opens from the HUD health number (like the Level panel) and answers: when is +1 HP, when does the church art improve, how fast is it being damaged, when does the church fall, and what do my items buy.

## Panel contents
- Header: HP chip colored by state (full #4CAF50 >75, moderate #FFC107 >50, low #FF9800 >25, critical #F44336), title "Base Health", points pill top right.
- Status row: Healing / Under attack / Full strength.
- Timer card: healing = time to next church art stage (75/50/25%) + at-HP + heals needed; attacked = time until damage worsens a stage + next hit countdown; full = "No zombies at the walls" + next due task.
- Bar: dark-slate track, state-colored fill, white threshold ticks at 25/50/75, striped loss segment (next 15 min at current rate) while attacked.
- Healing strip: "+1 HP in m:ss", "Full in Xh Ym".
- Attackers card (attacked only): up to 3 rows, "Push back 1 hr · 50 pts" each; disabled + "Need N more pts" when unaffordable; "N more attackers · Show all"; info icon opens popover (how attackers work).
- Repair kits: compact two-button row, "Use Small kit ×N / +15 HP · saves/buys …", "Use Medium kit ×N / +35 HP · …". Greyed "not needed" at full. Large-kit waste and "lands 1 HP short" notes live in an info popover.
- Warning: "At this rate the church falls in …" whenever any zombie is attacking.
- Footnote: heals offline too; pauses only while a zombie is attacking.

## Files
- `js/baseModel.js` — pure model (state, timers, loss rate, kit time-bought, fall ETA) from CONFIG constants + state; no DOM; fully Jest-tested.
- `js/ui/basePanel.js`, `css/basePanel.css` — modeled on `levelPanel.js`/`levelPanel.css`; `Modal.open(html,{dedupeSelector})`.
- HUD chip (ring + "+1 in 3m" / "−N / 5m" / "Full") in `js/ui/heroes.js`; ring color = state color.
- `sw.js` CACHE_NAME bump (currently v98 → v99) and CLAUDE.md mirror.

## Behavior notes
- 1 s live refresh while open; clear timer on close.
- Pushback/kit buttons: `data-action`, `stopPropagation`, close-first before opening another window (Level panel pattern).
- Info popover closes on outside click / ESC.
- `.modal-content` max-height `min(80vh, 80dvh)`; header (chip, points) sticky.
- Pushbacks: cheapest (1 hr) only in the list; price uses the shipped from-now rule.
- Accessibility: chip `role=img` with aria-label, disabled buttons carry reason in aria-label, 44px touch targets.

## Tests
- Model: thresholds 25/50/75 boundaries, 1 vs 8 attackers, full state, kit times, fall ETA, quiet-span interaction.
- Panel: opens from HUD, dedupe, closes on ESC/backdrop, disabled pushback when short on points.

## Order
1. baseModel + tests  2. panel markup/CSS  3. HUD chip  4. wire open + live refresh  5. docs (MECHANICS, UI_UX, ROADMAP)

## Open items
- Live loop still pauses regen while anything is overdue; `TimeSlider.projectBaseHealth` is conservative (no regen if an item is due by preview time). Not changed (see DECISIONS).
- Balance flag: 50-pt pushback ≈ kit cost per HP; revisit with real play data via the balance-tuning process.
- Model rec: Sonnet, medium effort, one roadmap task per session.

## Status
Steps 1-5 done (step 5, the MECHANICS note, 2026-10-27). Panel + chip phone-verified by Jeremy 2026-10-27: COMPLETE.
