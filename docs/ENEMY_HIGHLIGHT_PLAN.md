# Enemy highlight redesign -- at-a-glance states without icons or glows

**DESIGNED 2026-11-06 (Claude app session, Fable 5.1; Jeremy). BUILD A BUILT 2026-11-06 (Sonnet 5.5; sw v263; "Build A as built" at the end); Build B waits for the Nov 7 art.** Resolves the ROADMAP "V2 follow-up -- stronger at-a-glance differentiators" design task. DECISIONS 2026-11-06 (enemy highlight).

The V2 glow system (`css/enemyStatus.css`, 2026-10-12) uses one channel -- a coloured `drop-shadow` halo -- for every state, plus emoji badges floated over the sprite (category `::before`, priority star, Break Habit no-sign, the Started stopwatch). Jeremy: the icons over the zombies do not fit the aesthetic, and the halos do not let you tell the kinds of zombie apart at a glance. This plan spreads the states across channels the eye reads in parallel -- body, palette, size, ground, motion -- and spends the one hard outline on the one thing that earns it.

## The at-a-glance rule (keep front and centre)

A player scanning the road reads three or four things pre-attentively: shape, colour, size, motion. Everything else needs a second look. So the facts are sorted by WHEN the player needs them:

- **Scan-level (the road must answer these without a tap):** what kind of thing is this (task / Build Habit / Break Habit / sub-task), is it a priority, is it selected, is it started.
- **Inspect-level (a second look is fine):** which routine it belongs to, which goal it feeds, its streak.
- **Relationship-level (needs two sprites to read):** sub-task -> parent, routine member -> routine.

Three rules fall out of this:
1. **One outline, one ring, one motion state** on the board at any time.
2. **Nothing hovers above a zombie's head.** Every cue is part of the body or touches the ground.
3. **Links are revealed on tap, not displayed.** Start and due times scatter a parent, its sub-tasks and a routine's members along the road, so no persistent tether or shared accent colour survives interleaving (a rope across three other zombies is noise; a per-family colour blows the colour budget). The scan-level fact is only "this is a piece of something"; WHOSE piece is a tap away.

## Channel map (decided)

| Fact | Channel | Notes |
|---|---|---|
| Task vs Habit | **Body condition.** A task is a fresh zombie. A habit is the one that keeps coming back: the same category zombie, stitched / bandaged / patched. | Category stays where it lives today (costume and props). A PixelLab EDIT pass over the existing sheets ("same zombie, stitched wounds and bandages, same palette and pose"), not a new design per category. |
| Build vs Break Habit | **Palette swap** of the patched body (e.g. mossy green vs bruise purple). | Classic pixel-art trick; reads at tiny sizes; no new shape. |
| Sub-task | **Smaller body** (the existing 96px sub-task tier; see Open questions on the whole-number rule). | Zero art, every theme gets it free. Hit area stays full size; the sprite shrinks inside it. Plan B if small-but-identical does not read on a crowded road: a flat dark "shade" silhouette via CSS (`filter`), kept in reserve because it nudges toward the ghost-card look. |
| Priority | **The only hard outline on the board** -- gold, 1-2 art px, no blur. | Max three per day (priority slots), so it never gets noisy. Replaces the gold glow AND the star badge. |
| Selected | **Ground ring under the feet**, bright, pulsing. | RTS convention (ring under feet = selected). Shown while the zombie's card is open / on hover. |
| Started | **The same ground ring, breathing** (pale colour; motion is the cue). | Replaces the amber body glow and the canvas stopwatch badge. The agenda rows keep their "Started" group and badge. |
| Family (tap to reveal) | **The same ground ring, dim and still** on every relative. | Tap a sub-task -> its parent and siblings ring; tap a parent -> its sub-tasks; tap a routine member or the routine's hero chip -> every member. One idiom, learned once, zero art. A long-press to hold the family lit is a possible follow-up; ship tap first. |
| Goal-linked | **Feet-anchored trailing token**, CSS-tinted to the goal's badge colour. | First candidate: a ball and chain dragged behind the feet ("bound to something bigger"); if that reads too punitive for a goal you CHOSE, a trailing pennant on a short rope in the same slot. One grey PixelLab asset with a 2-frame drag loop; the tint is a CSS mask fill, so one asset serves every goal. Options to play with in PixelLab. |
| Streak | **Fire behind the feet, two tiers:** normal, and on fire once the streak clears a threshold. | The existing `high-streak` / `super-streak` classes already carry the thresholds (CONFIG, balance process). One 4-frame loop for every species. Works for Break Habits too ("resisted 10 days" is a streak). |
| Overdue (camped at the church) | Position is the cue. | The red glow stays through Build A; decide on the phone whether a red ring replaces it (Open questions). |
| Category | Costume and props (unchanged). | The category emoji `::before` goes with the other badges once the kinds read from the body. |

Colour budget on the board: green / purple (habit palettes), gold (priority outline, thin line), orange-red (fire, a mass), pale (ring). Fire and outline differ in hue AND in form, so they never read as the same thing.

## The universal-overlay rule (art contract)

Anything added "to any sprite" is **feet-anchored**: every overlay is drawn on a fixed canvas with the feet baseline on the same row, and every sprite shares that baseline (already the convention: `css/enemyAnim.css` anchors the character's feet on the enemy box's bottom edge at every scale). Species height and shape then never matter -- nothing is ever fitted to a torso. The ground has three sub-slots that do not collide:

- **Under the feet, flat:** the ring (selected / started / family).
- **Behind the feet, rising:** streak fire.
- **Trailing behind:** the goal token.

## Theme contract (Baseline)

A theme ships, per category, two bodies (fresh, patched) and three feet-anchored universal overlays (goal token, streak fire, and optionally a ring sprite if it does not want the CSS one). Everything else is engine CSS and logic, theme-free by construction: the Build / Break palette treatment, the priority outline, the selected / started / family ring, the sub-task scale, and family-on-tap. New CSS classes and CONFIG keys speak Baseline (enemy, item, ring, outline, kin / family, overlay), per CLAUDE.md "Baseline vs Deadline".

## How the outline works (CSS, measured against the real setup)

Sprites are drawn 1:1 (1 art px = 1 screen px, ART_STYLE "PIXEL-SCALE RULE"), so an outline offset of 1px is one art pixel and 2px is two; both sit on the grid (never 1.5px). The animated sheet is `.enemy-sprite`, moved by a stepped `translateX` inside a clipping window, and the V2 `filter` chain already lives on that element -- so the lowest-risk outline is a **drop-in glow fragment**: four zero-blur `drop-shadow`s (right, left, down, up), e.g. `--g-priority: drop-shadow(2px 0 0 #f2c14e) drop-shadow(-2px 0 0 #f2c14e) drop-shadow(0 2px 0 #f2c14e) drop-shadow(0 -2px 0 #f2c14e)`, with `--an-pr` set to `none` (a static outline needs no pulse). It follows the alpha silhouette, needs no markup change, and the four-entry animation lists in `enemyStatus.css` lose a member instead of gaining one. Cost: four filter passes on at most three sprites. Alternatives considered: a masked `::before` filled with the outline colour (crisp, but the mask would have to step with the sheet's frame transform) and an SVG `feMorphology` dilate filter (most pixel-accurate; colour baked per filter def; least predictable on Safari) -- both kept as fallbacks, not the plan.

Chosen: the chained-`drop-shadow` fragment. Built at 2px first, then changed to 1px at Jeremy's request (2026-11-06, sw v264); go back to 2px if 1px vanishes on the phone. **Grown parents (2026-11-11, sw v321):** the 1px line looked thin and uneven on a parent enlarged by open sub-tasks (art pixels 1.075x-1.3x wide), so the on-screen width now rounds UP to a whole pixel: `--outline-step: calc(round(up, var(--sprite-scale, 1), 1) * 1px / var(--sprite-scale, 1))` inside `@supports (width: round(up, 1.5px, 1px))` (Chrome 125+; older browsers keep the 1px rule). Scale <= 1 (normal zombies, sub-tasks) = 1px, any grown parent = 2px.

## Build order

**Build A -- CSS + logic, before the art (Sonnet, medium). Phone-checkable before the Nov 7 PixelLab reset.**
1. Priority: gold zero-blur outline fragment replaces the gold glow; the star `::after` is removed. `--an-pr` dropped from the pulse lists.
2. Ring: a ground ellipse under the feet (a new child element or the freed `::after`), three intensities: `selected` (bright, pulsing; set while the card is open / on hover), `started` (pale, breathing; replaces the amber glow in `css/startedMarker.css` and the canvas stopwatch badge; list rows unchanged), `kin` (dim, still).
3. Family on tap: tapping an enemy marks its relatives `kin` (sub-task <-> parent + siblings; routine member <-> all members; hero chip tap -> that routine's members); the mark clears when the card closes / another tap lands. Pure helper for "relatives of item X" with tests.
4. Sub-task tier: measure how the 96px tier actually renders with the animated sprites (`--sprite-scale`) and settle the Open question below; make the scale a CONFIG value.
5. Keep until Build B: the cyan / purple habit glows and the no-sign badge (the only Break cue until the palettes exist), the streak fire glow, the red overdue glow, the category `::before`.
6. fx gating as today (`.fx-reduced` / `.fx-off` / `prefers-reduced-motion` hold the ring still). sw bump; UI_UX "Enemy state glows" rewritten; tests.

**Build B -- art swap, after the Nov 7 reset (Sonnet, low-medium, once the assets exist).**
1. Patched habit bodies (PixelLab edit pass over the 8 category sheets) + Build / Break palettes; the cyan / purple glows and the no-sign badge are removed.
2. Goal token overlay (one grey asset + CSS tint mask) replaces nothing on the canvas today (goal links only show as list badges now).
3. Streak fire overlay replaces the orange flame glow (two tiers map to `high-streak` / `super-streak`).
4. Category `::before` removed; `enemyStatus.css` ends up holding the ring, the outline, the ghost desaturation and the hover state only.

**Art jobs for the Nov 7 reset (Jeremy + PixelLab; prompts to be written at the start of Build B):** (1) patched edit pass x 8 categories; (2) Build / Break palette swaps of the patched bodies; (3) goal token: ball-and-chain and pennant candidates, grey, 2-frame drag loop, feet-anchored; (4) streak fire: 4-frame loop, feet-anchored, two intensities or one asset shown at two sizes (whole numbers only).

## Open questions (settle in Build A, on the phone)

- **Sub-task size vs the whole-number pixel rule.** The sub-task tier is a 96px box (0.75x of 128) while the animated sprites draw 1:1; ART_STYLE forbids 1.5x-style uneven scales. Measure first. If the animated sub-task sprite is really shrunk, the clean options are 0.5x (64px character -- maybe too small on a phone) or sub-task bodies authored at a smaller canvas in PixelLab (per-category work Jeremy wants to avoid for now). If the tier already renders at an even scale, nothing changes.
- **Overdue:** keep the red glow (position already says it) or move it to a red ring? Decide after seeing the ring on the phone.
- **Selected on touch:** there is no hover on a phone; "selected" = the zombie whose card is open. Confirm the ring is visible under the popup.
- **Shade fallback for sub-tasks** only if the smaller body does not read on a crowded road.

## Build A as built (2026-11-06, Claude app session, Sonnet 5.5; Jeremy: "we can try 2 pixel first")

- **Priority outline:** `.enemy.high-priority` sets `--g-priority` to four zero-blur drop-shadows, offset `calc(1px / var(--sprite-scale, 1))` (the filter runs before the transform, so a grown parent would otherwise get a fatter line). The star `::after`, `--an-pr` wiring, `glow-priority` keyframes and `@property --pr-blur` are removed. The glow chain and the four-entry animation lists are UNCHANGED in shape (`--an-pr` / `--an-st` are simply never set) so `test/startedMarker.test.js` and the super-streak duration override stay valid; a later cleanup can shorten the lists and those pins together.
- **Ground ring:** `.enemy-ring` child from `SpriteAnim.attach`; CSS at the bottom of `css/enemyStatus.css`; intensities selected / started / kin; motion gated like the other glows; hidden in the portrait strip, on previews and on dying zombies. The amber started glow and the canvas head badge are gone on the big canvas; the strip keeps the badge (20px dot markers have no room for a ring).
- **Family on tap:** new `js/enemyRing.js` (pure `kinOf`, DOM `show` / `clear`, `watch`), wired in script.js `showEnemyRing` from `handleEnemyClick`. Hero-chip tap is NOT wired (follow-up).
- **Sub-task tier, measured:** `CONFIG.SUBTASK_ENEMY_WIDTH` is already CONFIG and is 96 (changed from 64 on 2026-10-13: "too small on phone landscape"); the sprite scale is box / 128 = **0.75x**, which breaks the whole-number pixel rule. NOT changed in Build A: 0.5x was Jeremy's rejected "too small", and 1x erases the size cue. Decision for Jeremy: keep 0.75x (uneven pixels, as shipped) or give sub-tasks smaller-canvas art in the PixelLab reset.
- **Checked:** headless Chromium 844x390 (computed filter = the four shadows, no `::after`, ring display block, tap -> `ring-selected` + opacity 1, closes -> cleared) and 390x844 (strip mode, ring `display: none`, no overflow, no console errors); screenshots showed a thin gold line and a white ring under the feet. NOT phone-checked.
- **Tests:** new `test/enemyRing.test.js` (15). Full Jest 189 suites: 4,284 pass, 1 fails: `prioritySlots.test.js` "pulling a priority sub-task onto its parent's earlier day..." (`deps.getSubTaskClusterOffset is not a function`), which fails identically with Build A stashed, so it predates this build (see HANDOFF).
