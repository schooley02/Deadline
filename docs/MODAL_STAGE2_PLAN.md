# [P2-UI-011] Stage 2 — central Modal.open() builder — SEQUENCED 2026-07-20 (Cowork session, Opus)

Mirrors the format of NEGATIVE_HABITS_PLAN.md / FROZEN_SLOTS_PLAN.md / HEROES_PLAN.md /
TIME_SLIDER_WEEK_PLAN.md. Lighter-weight than those — this is pure engineering (how overlay
HTML gets inserted + wired), not a product/UX decision, so no Fable fork session was needed;
scoped directly at Opus after a full-repo survey of every overlay call site.

## Scope (per ROADMAP.md / ARCHITECTURE.md's modal.js entry)
Central `Modal.open()` builder; migrate the per-cluster inline `.modal-overlay` HTML strings
onto it; drop forms.js's 50ms `setTimeout` listener-wiring delay; full keyboard-nav pass stays
folded into the Milestone 4 accessibility item (untouched here).

## Survey — every overlay-creation call site (17 total, 5 active files)
Found via `grep -n 'class="modal-overlay"\|insertAdjacentHTML'` across `js/`:

| File | Sites | Pattern today |
|---|---|---|
| `js/ui/checkIn.js` | 1 | `insertAdjacentHTML` → sync `querySelector`/`addEventListener` |
| `js/ui/frozenNotice.js` | 6 | `setTimeout(0)` defer (closeModal-same-tick hazard) → `insertAdjacentHTML`, all six wire ONLY a static inline `onclick="closeModal()"` — no `addEventListener`. One (`showAchievementUnlockNotice`) additionally queues/batches/polls. |
| `js/ui/popups.js` | 3 | `insertAdjacentHTML` → sync wiring, heaviest listener load (pushback in-place refresh, Cheat Day `setTimeout(0)` rebuild-in-place dance) |
| `js/ui/forms.js` | 1 | `document.createElement`+`appendChild` (not `insertAdjacentHTML`) → `setTimeout(50)` → `attachModalEventListeners` + `wireScheduleFieldsToggle` |
| `js/ui/routineViews.js` | 7 | `insertAdjacentHTML` → sync wiring; the ONLY cluster with STACKED overlays (`addItemModal`/`transferItemModal` open on top of `routineManagementModal`) — exercises `closeTopmost()` hardest |
| `js/TaskManager.js` | 1 | Legacy parallel extraction, NOT the live path (HANDOFF.md session 58 already flags its stale UTC-prefill twin as dead-ish) — **excluded from migration**, don't touch speculatively |

`js/ui/modal.js` itself already provides the shared teardown/focus/ARIA/dismiss layer (Stage 1,
session 61) via a `MutationObserver` on `document.body`'s childList — that observer fires
regardless of HOW an overlay was inserted, so `Modal.open()` doesn't need to duplicate any of
that; it only needs to do the insertion + return what today's `document.querySelector` follow-up
already expects.

## API design

```js
Modal.open(html, options = {}) -> HTMLElement | null
```

- `html`: a full `<div class="modal-overlay">...</div>` string — unchanged caller responsibility,
  same as today. `Modal.open` does NOT template the content; it only inserts it.
- Inserts via `document.body.insertAdjacentHTML('beforeend', html)` and **returns the newly
  inserted overlay element synchronously** — matching the fact that 100% of surveyed call sites
  already do `document.querySelector('.modal-overlay')` (or an id-scoped variant) on the very
  next line. Migration becomes mechanical: `insertAdjacentHTML(...); const overlay =
  document.querySelector(...)` → `const overlay = Modal.open(html)`.
- `options.dedupeSelector`: if a matching element already exists in the DOM, no-op and return
  `null`. Replaces the repeated `if (document.querySelector('.check-in-overlay')) return;` /
  `.frozen-notice-overlay` guards hand-written at 7 of the 17 sites with one reusable check.
- `options.defer`: `true` schedules the insert via `setTimeout(0)` instead of inserting
  synchronously, and returns nothing (fire-and-forget) — replaces the `setTimeout(0)` dance at
  every `frozenNotice.js` site (the closeModal-same-tick hazard from sessions 21/34/37). Confirmed
  safe to keep dead-simple: every deferred caller today only wires a STATIC inline
  `onclick="closeModal()"` already baked into the HTML string, never `addEventListener` after
  insertion — so callers needing post-insert wiring never combine with `defer`.

**Deliberately NOT absorbed into Modal.open()** (stays caller-side, same "pure core + caller-side
complexity" discipline the rest of this codebase already follows — e.g. RunStats blame
aggregation stays in runStats.js, not pushed into a generic aggregator):
- The achievement-notice queue/batch/poll loop (`showAchievementUnlockNotice`'s
  `pendingUnlocks`/`unlockWaiterId`) — a genuinely different concern (batching multiple pending
  unlocks into one modal) layered ON TOP of `open(html, {dedupeSelector})`, not a Modal feature.
- Any per-cluster listener wiring (pushback in-place refresh, Cheat Day rebuild, save-button
  validation) — stays exactly where it is, just reached through `Modal.open()`'s returned element
  instead of a fresh `querySelector`.

## Forks resolved

**Fork 1 — return value shape (element vs. callback vs. promise).** RESOLVED: return the element
synchronously for the non-deferred path. Every current call site already wires listeners
procedurally in the same function body immediately after insertion — a callback/promise would
add indirection with no caller actually needing it.

**Fork 2 — does the achievement queue belong inside Modal.open()?** RESOLVED: no, stays in
frozenNotice.js. Keeps `Modal.open()` a small, single-purpose primitive (ARCHITECTURE.md's
"max ~300 lines/file" convention) rather than growing bespoke queueing logic into a shared module
every other caller has to understand.

**Fork 3 — is forms.js's `setTimeout(50)` actually load-bearing?** INVESTIGATED: it wraps
`attachModalEventListeners` + `wireScheduleFieldsToggle`. `document.createElement`+`appendChild`
are synchronous (same as `insertAdjacentHTML`), and `css/modal.css`'s `modalSlideIn` animation is
pure CSS with no JS coordination requirement. No technical reason for the delay was found — it
reads as defensive/legacy. Given by ROADMAP.md itself as something Stage 2 should drop.
**Given its own dedicated sub-session (4)** specifically so a real timing bug, if one exists,
surfaces in isolation rather than tangled into a bigger migration.

**Fork 4 — migration order.** RESOLVED: simplest/lowest-risk first, stacked-overlay/highest-site-
count last — see Sub-sessions below.

## Sub-sessions (5, one system/cluster per session per CLAUDE.md's architecture guardrail)

1. **`Modal.open()` core + tests + checkIn.js pilot** — DONE 2026-07-20. Smallest cluster
   (1 site), already 100% synchronous wiring, validated the non-deferred + dedupeSelector path
   with the lowest possible blast radius. +7 tests (test/modal-behavior.test.js).
2. **frozenNotice.js (6 sites)** — DONE 2026-07-20. Validated the `defer` path for the first
   time against a REAL production trigger (live-reproduced the closeModal-same-tick hazard via
   the actual "I indulged" UI flow, not just a test). All six wire only a static `onclick`. The
   achievement-queue wrapper stays caller-side per Fork 2, now calling
   `Modal.open(html, { dedupeSelector: '.frozen-notice-overlay', defer: true })` (or a bare
   `Modal.open(html)` for its own already-deduped final insert) instead of hand-rolling either.
   No new tests (module has never had dedicated unit coverage); dedupe + achievement-batching
   verified live via console, the hazard scenario verified live via the real UI. See
   DECISIONS.md.
3. **popups.js (3 sites)** — medium risk: heaviest listener wiring, the pushback in-place-refresh
   pattern, and the Cheat Day `setTimeout(0)` rebuild-in-place dance all need re-verification
   against `Modal.open()`'s returned element before/after this migration.
4. **forms.js (1 site)** — where the ROADMAP's headline ask (drop the 50ms delay) actually
   happens. Deliberately AFTER 1-3 prove the pattern is solid, since dropping the delay is the one
   real behavior change in the whole plan (vs. every other sub-session being a pure refactor).
5. **routineViews.js (7 sites)** — largest cluster AND the only one with stacked overlays
   (`addItemModal`/`transferItemModal` over `routineManagementModal`), so it goes last, once
   `closeTopmost()` interaction has nothing left to surprise it.

Each sub-session: tests green before/after, live-verify in Chrome, commit. `js/TaskManager.js`'s
lone modal-overlay site is explicitly OUT of scope (dead/parallel path, not the live UI).

## Non-goals (stay exactly as-is)
- `Modal.closeModal()` (close-all) / `Modal.closeTopmost()` semantics — unchanged, callers keep
  choosing whichever they already use.
- The `MutationObserver`-driven focus/ARIA/dismiss layer (Stage 1) — `Modal.open()` is transparent
  to it; no changes needed or made.
- Full keyboard-nav pass — stays folded into the Milestone 4 accessibility item per ROADMAP.md.
