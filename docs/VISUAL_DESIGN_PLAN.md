# Visual Design Plan — audit + sequenced polish sessions

Created 2026-07-20 (Cowork session, Fable) from a live screenshot audit of the GitHub Pages
build (desktop 1372px + real 390px mobile render via same-origin iframe), seeded with test
data across categories: 4 tasks (one high-priority, one overdue camper), 2 positive habits,
1 negative-habit lurker, 1 sub-task. Audited against docs/ART_STYLE.md's stated direction:
**pixel art / cartoonish, playful, slightly eerie graveyard — never grim.**

Companion track to Jeremy's week of real daily play (Milestone 6 scoping input). Every
session below is CSS/asset-only or UI-rendering-only — none touches persistence, balance,
or architecture, so they can safely interleave with the play week.

## Audit — what the build looks like today

**The single biggest gap: there is no graveyard.** The battlefield is a flat teal→green CSS
gradient. No ground plane, no horizon, no tombstones, no fog, no night sky — zombies float
at arbitrary heights over what reads as a default-styled div. The base column is a
painterly/illustrated church (style clash with the pixel zombies) with a placeholder
"CHURCH" text overlay and raw brown backdrop strips above/below it that end in a hard edge.
The finished 64×64 pixel zombie sprites are genuinely good — they're the strongest visual
asset in the build and currently carry the entire game feel alone.

**Every game-state indicator is a colored rectangle.** High priority = yellow box + floating
star; overdue = red box glow; negative-habit lurker = solid orange box + 🚫 emoji;
habits = literal dashed border (css/enemyStatus.css:63, intentional per session-73 note —
revisited by this plan as a deliberate decision, V2 below); time-preview ghosts = dashed
yellow boxes; sub-tasks = thin blue box. Individually defensible, together they read as
debug wireframes drawn over the sprites rather than game art.

**Scale/placement inconsistencies:** sprites render at visibly different heights (guitar
zombie ≈ 1.5× the nurse) with no shared ground baseline; overdue campers pile onto the
HUD chip zone; the midnight boundary is a 1px red hairline with a tiny rotated label.

**Mobile (390px) findings — the priority platform is the roughest:**
- Agenda rows overflow and CLIP off the right viewport edge ("Mark as Complete (1 rem…",
  "+ SUB-" truncated). Functional bug territory, not just polish.
- The church column consumes ~40% of canvas width, leaving a sliver of walkable timeline;
  the lurk post lands mid-canvas; with two overdue clusters the canvas is a total sprite
  pileup. Desktop proportions were clearly the design target; mobile got the leftovers.
- Dev Reset button overlaps content bottom-left (ships to prod on Pages).
- FAB menu, management windows, and forms all render fine at 390px — app chrome scales;
  the game canvas doesn't.

**App chrome:** competent generic Material — white cards, system sans, mixed accent colors
(dark-green primary buttons vs teal Backup & Transfer buttons vs mint sub-task chips).
Nothing broken; zero game identity. Category chips already use ART_STYLE.md's palette
(good), though yellow/lime chips put white text on light fills (contrast).

**Side observations logged, deliberately NOT acted on here:**
- ~~Balance: a single overdue camper took the base 100→8 in ~2-3 minutes~~ **Reclassified
  same session: a real BUG, root-caused** (Jeremy confirmed intent is 1 HP/5min capped at
  12; observed −92). Editing a due date into the past parks the damage clock at the old
  due time and loop.js back-pays uncapped at game-tick speed — the last unguarded entry
  of the 2026-07-18 far-past-clock bug family. Full detail + design fork in ROADMAP.md
  Known bugs (2026-07-20 entry).
- Possible bug: Day Pager on Tomorrow showed 3 scheduled habits in the agenda but NO ghost
  sprites on the canvas (expected per UI_UX.md's Day Pager entry). Worth a root-cause look
  in a normal session (ghost position math vs. visibility, maybe rendering off-screen).

## Direction (the design calls this plan bakes in)

1. **The graveyard IS the game's identity — build it in CSS/SVG first, assets later.**
   Layered night-sky→ground gradient, a defined ground band the zombies stand on, SVG
   silhouette props (tombstones, fence, bare tree, moon), optional slow fog drift gated by
   the existing fx-intensity setting + `prefers-reduced-motion`. No new binary assets
   required to get 80% of the mood; pixel-art props can replace silhouettes later.
   **Parallax (added 2026-07-21, decided):** the layers are slider-coupled — each layer's
   `translateX` driven off the time-slider value at a different rate (clouds fastest, far
   silhouettes slower, ground fixed) so scrub direction reads visually and the scene gains
   depth. Idle cloud drift fx-gated like the fog. Camera TILT on scrub was considered and
   REJECTED (rotation breaks the pixel grid; parallax alone delivers the feel — see
   DECISIONS.md 2026-07-21); don't add rotate transforms to the scene.
2. **State indicators move onto the sprites.** The zombie PNGs have transparent backgrounds,
   so CSS `filter: drop-shadow()` produces silhouette-hugging glows for free. Rectangles
   retire: priority = gold silhouette glow + corner badge; overdue = red glow + existing
   shake; habit = soft spectral tint (replaces the dashed border — supersedes the
   session-73 "intentional" note, log in DECISIONS.md); lurker = purple/orange glow +
   lurk-post prop (a signpost/grave it waits at); preview ghost = opacity + desaturate
   (replaces dashed yellow).
3. **Pixel-art church replaces the painterly one; text label dies.** All 5 damage states
   exist as assets but in the wrong style. One art task (commission, AI-gen, or a
   pixelation pass over the current renders) regenerates the set; CSS work integrates the
   base into the scene (no backdrop strips, church sits on the same ground band).
4. **Mobile portrait is a GLANCE STRIP, not a shrunken battlefield (Jeremy's design,
   2026-07-20, this session — supersedes the original "cap the proportions" scope).**
   Portrait: the canvas collapses to a thin (~64-80px) threat strip — church icon at the
   left edge (reuse `Assets/icons/icon-192.png`, already a church crop), category-colored
   dot/icon markers positioned by the SAME `Clock.calculateTimelinePosition` math, cluster
   count badges instead of overlap, midnight line when on-screen, base-edge deadline
   marker — and anything OVERDUE renders as the actual small zombie sprite, pulsing at the
   base edge (the threat materializes exactly when it matters). Below the strip: week
   strip + day pager stay prominent, hour slider slims to a thin scrubber track; the list
   owns the rest of the screen. Landscape: the full desktop scene (V1's graveyard), canvas
   down to the slider, list scrollable beneath — plus tap-to-interact: hero chip opens
   that routine's management window, enemy tap opens the existing popup (complete/edit/
   pushback from the game view). Both tap behaviors ship on desktop too. Implementation
   rule: the strip is a CSS/render VARIANT of the same DOM and state (media query swaps
   sprite classes for marker classes), never a second component — one source of truth.
5. **App chrome unifies on the EXISTING token system, then gets a light theming pass.**
   base.css already defines the palette + Inter; the gap is enforcement (hardcoded colors
   and two competing primary greens in live use). Add one display font for headers/HUD
   (pixel-adjacent, e.g. a chunky rounded face — NOT body text), consistent button
   hierarchy. Theming stays light: this is a productivity
   app you live in daily; parchment-and-bones kitsch would wear thin fast.

## Execution sessions (all Sonnet unless noted; one per session, commit each)

- [ ] **V1 — Graveyard atmosphere** (`css/gameCanvas.css`, `index.html` for prop SVGs or a
  new `Assets/scene/` SVG file): sky/ground layers, ground band, silhouette props, midnight
  line restyled as a gate/fence break in the scenery. Zombies bottom-aligned to the ground
  band (CSS only — verify `getItemTopPosition`'s lane offsets still separate clusters;
  if the lane math itself must change, STOP and split a follow-up, that's movement.js).
  Fog/animation gated fx-intensity + reduced-motion. Biggest identity win, do first.
- [ ] **V2 — State-indicator redesign** (`css/enemyStatus.css`, `css/enemySprites.css`):
  drop-shadow glows replace all rectangle borders (priority/overdue/lurker/habit/sub-task/
  preview-ghost). Requires a DECISIONS.md entry superseding the intentional-dashed-border
  note. Check `.time-preview-ghost` styling on base/HUD/hero-chips still reads once enemy
  dashes are gone. Verify glow perf with 10+ sprites on a phone (drop-shadow is per-frame;
  fall back to outline-style box-shadow under `fx-reduced` if Jeremy sees jank).
- [ ] **V3a — Mobile agenda overflow + dev chrome** (`css/responsive.css`,
  `css/agendaList.css`): agenda row flex fixes (rows currently CLIP off the right edge at
  390px — ship this early, it's a functional bug), hide dev Reset behind a `?dev` query or
  localhost check. Small session; can batch with another V item per the revised guardrail.
- [ ] **V3b — Portrait glance strip** (Direction #4; `css/responsive.css`,
  `css/gameCanvas.css`, likely a small marker-rendering hook in the sprite/DOM path —
  if it grows beyond CSS + a render branch, split it): strip layout, marker variant
  classes, cluster badges, overdue-sprite exception, slim slider, week strip/pager kept.
  Live-verify portrait at 390px (iframe trick, HANDOFF 2026-07-20) AND on Jeremy's phone.
- [ ] **V3c — Landscape scene + tap-to-interact** (after V1 so landscape inherits the
  graveyard): orientation media query routes phone-landscape to the desktop layout;
  hero-chip click → that routine's management window; enemy tap already opens the popup
  (verify touch targets ≥44px on sprites). Hero/enemy tap behaviors enabled on desktop in
  the same session. Check `manifest.json` does NOT lock orientation, and that rotating
  mid-scrub/mid-pager-preview cleanly releases or preserves the non-mutating preview state.
- [ ] **V4 — Pixel church + base integration** (art task + `css/gameCanvas.css`): regenerate
  `Assets/Base/base_000..100.png` in pixel style (5 damage states, same filenames — zero
  code churn), remove the CHURCH label, blend base into the V1 ground band. **UNBLOCKED
  2026-07-21: art source = AI-generate** (Retro Diffusion, current renders as style
  reference; PixelLab for any animation frames). See DECISIONS.md 2026-07-21.
- [ ] **V5 — Design tokens + app chrome** (`css/base.css` already defines a full `:root`
  palette + Inter — this session ENFORCES it, not builds it): decide one primary action
  color (`--color-primary-dark-green` vs `--color-accent-teal` are both in live use as
  button fills — pick one, demote the other), sweep hardcoded colors in the other 20 css
  files onto the variables, fix light-chip contrast (dark text on yellow/lime), display
  font for headers + HUD chips, HUD chips restyled (consistent, slightly game-y, legible).
- [ ] **V6 — Juice pass** (last, after Jeremy's play week — his playtest notes should pick
  the moments): defeat explosion, spawn, hit feedback, XP/points popups, all fx-gated.
  Coordinate with whatever Milestone 6 scoping decides; don't pre-build.

Suggested order: V3a (functional bug) can go first or batch with V1; then V1 → V2 → V3b →
V3c (V3c wants V1's scene done); V4 anytime (art call made 2026-07-21: AI-generate pixel);
V5 anytime; V6 waits for play data. V1's graveyard primarily serves desktop/landscape — the portrait strip
gets at most a minimal sky/ground backdrop, no props.

## Hazards (audit-discovered, for the executing sessions)

- Habit dashed border is currently INTENTIONAL (enemyStatus.css:63) — V2 must log the
  supersession, not silently restyle. Ghost-vs-habit dashes are separate rules; kill both.
- `.time-preview-ghost` applies opacity-dim to base/HUD/hero chips too — V2's enemy changes
  must not orphan those.
- Hero chips render over the base's leftmost 120px (heroes.js) — V1/V3/V4 layout changes
  must keep that zone (test with an active routine; the audit save has none).
- sw.js CACHE_NAME must bump any session that adds/removes a shell file (new font, SVG
  scene file, css) or returning installs serve stale shells (UI_UX.md PWA note).
- Google-font additions affect offline PWA: self-host the font file into Assets/ and add
  it to the SW file list instead of a `<link>` to fonts.googleapis.com.
- The Cowork Chrome profile's Pages-origin localStorage now holds this audit's seeded dev
  save (7 items, base at ~9HP) — fine to keep for V1-V3 live-verification, reset freely.
  Jeremy's phone save is untouched (localStorage is per-device).
