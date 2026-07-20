# Mobile UX + Accessibility + PWA Plan

Planning session 2026-07-20 (Cowork). Sequences the ROADMAP Milestone 4 line "Mobile UX +
accessibility pass; PWA" into one-system-per-session steps, mirroring
`TIME_SLIDER_WEEK_PLAN.md` / `RUN_HISTORY_PLAN.md`. Sources of truth: `docs/UI_UX.md`
Accessibility section (tap targets ≥44px, keyboard operable, one-handed), `docs/ARCHITECTURE.md`
(module boundaries), `css/responsive.css` + `css/modal.css` (existing breakpoints).

---

## Recon findings (2026-07-20, live audit in Claude-in-Chrome at 390×844)

Window/zoom-resize automation didn't reach the real viewport in this session (reported success,
`innerWidth` stayed desktop-sized); worked around by injecting a same-origin `<iframe>` sized
390×844 into the live page and driving/screenshotting inside it. Note for future sessions if the
same tools are used again.

Concrete measurements taken against the real DOM at mobile width:

- **Edit-pencil icon: 32×32px.** Under the 44px floor `docs/UI_UX.md` already commits to.
- **Completion checkbox: 24×24px.** Same issue, worse.
- **Week-strip day cell: 47×42px.** Height already under 44px; width is borderline once real
  content (★N badge) is present.
- **FAB: 56×56px.** Fine as-is.
- **`css/responsive.css`'s two breakpoints look swapped in intent.** The `max-width: 768px`
  (mobile) query only touches `.game-canvas`/`.stats-overlay`/`.resource-panel`/`.stat-item`/
  `.attack-button`/`.form-row-group`. FAB sizing (`48px`) and management-window sizing (`95%`
  width, `85vh` max-height) sit inside the `min-width: 1024px` (desktop) query instead — backwards
  from what the names imply. Currently harmless because the *unscoped* base rules already look
  reasonable at 390px (56px FAB, full-bleed modals), but it means nobody has actually verified the
  "mobile" branch does anything useful, and it'll bite the next person who edits it expecting
  `max-width: 768px` to be the phone-tuned styles.
- **No PWA scaffolding at all.** No `manifest.json`, no service worker, no `theme-color` meta.
  `<meta name="viewport">` is present and correct. Clean slate — no undo work, just additive.
- **The foundation is decent.** Canvas height, forms, and the FAB menu already reflow reasonably
  at 390px without help. This is a set of targeted fixes, not a redesign.

---

## Jeremy's calls (resolved 2026-07-20)

1. **PWA scope: installable shell only.** `manifest.json` + icons + a basic service worker that
   caches the app shell for offline load + "Add to Home Screen." No background sync, no push, no
   offline-write reconciliation work beyond what already exists — the game is already
   localStorage-only client-side, so this is packaging, not architecture.
2. **Sequencing: layout bugs → accessibility → PWA.** Layout fixes are quick/low-risk and unblock
   a real on-device check. Accessibility touches more surface area (extends the session-61
   Modal.js focus/ARIA layer to more controls). PWA is last since it's independent and additive —
   nothing downstream depends on it.
3. **Accessibility depth: practical pass, not a full WCAG audit.** Fix the concrete issues found
   (tap targets, contrast, focus order) and extend the existing `Modal.js` focus/ARIA work
   (`docs/UI_UX.md`'s "Windows & Modals" section, session 61) to the remaining custom controls:
   day pager, week strip, agenda checkboxes. Full WCAG 2.1 AA audit is out of scope unless this
   app goes public.

---

## Sub-sessions (one per session, Sonnet unless noted)

1. **Layout fixes.** Fix `css/responsive.css`'s breakpoint mismatch (move FAB/management-window
   sizing into the `max-width: 768px` query where it belongs; re-verify the `min-width: 1024px`
   query still makes sense for actual desktop once separated). Bump edit-pencil to ≥44×44px hit
   area (icon can stay visually smaller — pad the clickable/tappable area, don't necessarily
   redraw the glyph) and completion checkbox likewise (larger native `<input>` or a padded label
   wrapper). Re-check week-strip cell height (42px → ≥44px) without breaking the 7-cell-per-row
   layout at 390px — may need smaller font or tighter internal padding instead of taller cells if
   width is the binding constraint. Live-verify each fix in Chrome at 390px width using the
   iframe-injection method above (or ask Jeremy to test on his real phone if the automation issue
   isn't resolved by then).
2. **Accessibility pass.** Audit + fix keyboard operability and ARIA for: day pager (`‹ ›` buttons
   need accessible names, not just glyphs), week strip cells (tappable divs need
   `role="button"`/`tabindex`/keyboard activation — mirror the session-69 expandable-run-card
   pattern, which already solved this exact "div that acts like a button" problem), agenda
   checkboxes (native `<input type="checkbox">` should already be keyboard-operable — verify, fix
   if it's actually a styled div). Contrast check on any text found borderline during the audit
   (category badges, greyed/locked achievement text). Extends `js/ui/modal.js`'s existing
   dismiss/focus-trap/ARIA layer (session 61) to the touched controls rather than building a new
   system.
3. **PWA — installable shell.** `manifest.json` (name, icons — reuse/generate from existing
   `Assets/` art at a couple of sizes, `display: standalone`, theme/background color), a minimal
   service worker (`sw.js`) caching `index.html` + `script.js` + `css/*` + `js/*` + `Assets/*` for
   offline load (cache-first for the app shell, no attempt to cache/sync game state — that's
   already localStorage's job), register it from `index.html`, add the `theme-color` meta tag.
   Live-verify: Chrome's Application panel shows the manifest + an activated service worker, a
   hard offline reload still loads the app shell (existing save still restores from localStorage
   as normal), and the install prompt/"Add to Home Screen" affordance appears.

Testing per established convention: pure helpers get Jest; DOM/UI/PWA paths get live Chrome
verification against the real server (`node server.js`). Every sub-session ends with the full
suite green + `node --check` on touched files.
