# Art Style — Sprites, Categories, Base States

## Style
Pixel art / cartoonish. Playful, slightly eerie (graveyard setting) but never grim. Suitable for a younger audience.

**LOCKED 2026-07-21** (DECISIONS.md): pixel art is confirmed as the permanent style — all future assets match the existing 64×64 zombies. Sprite visibility over the background is handled by contrast (dark, low-detail silhouette background layers; bright saturated sprites — see VISUAL_DESIGN_PLAN.md V1), not by changing sprite style.

## AI Asset Pipeline (decided 2026-07-21)
- **Base sprite generation:** Retro Diffusion (true grid-aligned pixel art; use existing assets/renders as style reference).
- **Animation / rotations:** PixelLab (text-prompted cycles, 4/8-direction rotations, Aseprite extension).
- **Format:** raster PNG only — the pipeline is PNG sprites positioned by DOM/CSS; no vector sprites. SVG is used only for scene silhouette props (V1).
- Background is layered with slider-coupled parallax; camera tilt rejected — never rotate pixel sprites. **Current rates (V1 live-tuning, 2026-07-21): ground −22% (fastest — the original "ground fixed" call was reversed), clouds −18%, silhouettes −7%.**

## Canvas & Sprite Dimensions (from base view notes)
- Game canvas reference: **720 × 368**
- Character sprite sizing reference: **1290 × 720** scene basis. Zombie sprites are **64×64** source pixels (sub-tasks render at 64×64; tasks/habits scale up). Scale only by CSS with `image-rendering: pixelated`.

## The Base
A country church overlooking a vast eerie graveyard. **V4 (2026-10-14): the art is the FRONT of the church only (80x200 source, door ~72px tall, stained-glass windows, finished gable with a small cross, no steeple), drawn at exactly 2x (160x400) in landscape/desktop and 1:1 in the portrait strip, standing on the front-lane feet line. All five states live in `Assets/Base/` (the only copies the game loads); All five states are real art (075 cracked/scratched, 050 boarded + smoking, 025 burning, 000 burned-out frame), same 80x200 canvas + bottom edge. Sources in `Assets/Base/_source/`.**
Damage states (`Assets/Base/`; the game currently loads the copies at the repo root — `js/damage.js` / `sw.js`):
| Asset | Base HP |
|---|---|
| `base_100.png` | 76–100% (pristine) |
| `base_075.png` | 51–75% |
| `base_050.png` | 26–50% (smoking) |
| `base_025.png` | 1–25% (flames) |
| `base_000.png` | 0% (destroyed) |
Hit feedback: brightness flash on every real hit + a 2px side shake at most once per 3 s (`CONFIG.BASE_SHAKE_COOLDOWN_MS`, 2026-10-20). **Under-attack pulse (restored 2026-10-21):** real damage lands only every 5 min per overdue item, so while ANY threatening (non-lurker) overdue item exists the church also flashes + shakes every 3 s (`Damage.pulseIfUnderAttack`, called from the loop's `afterTick`; visual only, shares the shake timer with real hits; skipped under fx-off and prefers-reduced-motion). Smoke → full flames right before destruction.
**Animated idle loops (2026-10-20):** a damage state can have a horizontal strip `Assets/Base/base_<state>_anim.png` (80x200 frames, any frame count, PixelLab exports are converted from the 3-wide grid; the grid is kept in `Assets/Base/_source/`). `Damage.BASE_ANIM_STATES` lists which states have one; `applyBaseArt` sets the static png (fallback) plus `data-base-anim`, and `css/gameCanvas.css` swaps in the strip and steps through it (`--base-fps`, default 6; 3 under reduced effects; frozen under off / prefers-reduced-motion). Done: `base_100` (8 frames, lantern sway + glow; only a 10x11 px patch changes, church fixed) and `base_075` (8 frames = 3-pose ping-pong A,B,C,B each held 2 frames; lantern patch x32-41 y136-147 only, church fixed). `base_050` (7 DISTINCT frames, not 8: thin smoke wisp from the roof hole, flickering window/lantern flames, glowing ember spot on the right wall; the church body, cross and steps are fixed; no clipping, topmost opaque row y=22). NOTE the 050 frames are a different take than the still `base_050.png` (thinner/shorter plume, fewer ground embers, a more prominent right-wall glow, ~500 visible px differ) so fx-off (holds frame 0 of the strip) and the static fallback/time-slider preview look slightly different. `base_025` (9 frames = poses 0-5 then back 4,3,2; roof/wall/window flames, round-window glow, door glow streaks; wall, cross and steps stable; highest opaque pixel y=14, no clipping). NOTE the 025 animation has NO smoke cloud: the still `base_025.png` has a thick billowing smoke mass over the roof, the strip shows flames + sparks only (~3,500 visible px differ from the still), so the loop reads as less smoky than the fallback/preview. `base_000` (burned-out) stays a still BY CHOICE (2026-10-21, Jeremy): PixelLab kept deleting the thin 1px smoke wisps after frame 1, so he skipped the animation and the still was swapped for a version with the two smoke wisps erased (original kept as `Assets/Base/_source/base_000_with_smoke.png`). The wisp pixels are the exact colours (108,105,110) / (171,171,172) / (83,83,84) in boxes x21-30,y3-30 and x63-73,y30-62 if a code-drawn smoke is ever added. All four living states are animated. To add a state: export strip, add its key to `BASE_ANIM_STATES`, add a `#base[data-base-anim="<key>"]` rule with `--base-frames`, add the file to `sw.js`; `test/baseAnim.test.js` checks all four agree. Portrait strip uses the same strip at 1:1 (`--base-x0: -24px` right-aligns frame 0 in the 56px window).

## Zombie Skins by Category (8 life domains)
| Category | Zombie look |
|---|---|
| Career | Business suit + briefcase |
| Creativity | Dressed as an artist |
| Financial | Rich-looking |
| Health | Dressed like a nurse |
| Lifestyle | Generic stylish zombie |
| Relationships | Dressed nice, holding a present |
| Spirituality | Nun |
| Other | Generic zombie |

## Enemy Visual Modifiers
- Closer to due: more menacing, faster animation.
- High priority: gold silhouette glow + ⭐ badge. Overdue: red glow (pulses). Negative-habit lurker: purple glow + 🚫 badge. Habit: cyan glow. High/super streak: orange flickering fire glow. All are `drop-shadow` glows that hug the sprite (V2, 2026-10-12) — no rectangles; see UI_UX.md "Enemy state glows".
- Parent task w/ sub-tasks: larger; shrinks as sub-tasks complete.
- Habit: same regular size as a task (cyan glow is the only visual distinction beyond category art; the dashed border was removed in V2); high streak = on fire. Sub-tasks are the only tier that renders visually smaller (64×64) — changed 2026-07-21, see DECISIONS.md.

## Category Colors (from prototype, for UI accents)
other #90ee90 · career #4a90e2 · creativity #f5a623 · financial #50e3c2 · health #e91e63 · lifestyle #bd10e0 · relationships #f8e71c · spirituality #7ed321

## Asset Sources
- **FINISHED sprites: `Assets/Zombies/<category>-zombie.png` + `-64.png` (64×64) for all 8 categories** — use these.
- Base damage states: `Assets/Base/base_000..100.png`.
- Sub-task sprite convention: `subtask-[category]-[variant].png`, 64×64, CSS class `.zombie-subtask`, falls back to parent-category asset (see README.md sprite section).
- Concept art / PSD / XD sources live in `OneDrive\Documents\Baseline - Old\Deadline\` — binary files, never open in Claude.

## Animated Sprites (P2-GAME-010 Stage 2) — assets IN, walk/idle/attack (2a) + death (2b) rendering BUILT 2026-10-12
Jeremy generated all 8 zombies + animations in PixelLab (2026-10-12).
- **Game files:** `Assets/Zombies/anim/<category>.png` + `<category>.json`, one atlas per category, category keys exactly as the game uses them (`spirituality`, not `spiritual`). Rows in every atlas, top to bottom: **walk, idle, attack, death**. The JSON gives `frameWidth`/`frameHeight` (156–180px square cells, varies by category), per-animation `row`/`frames`/`loop`, `feetY` (lowest walk/idle pixel in the cell — for ground-band alignment) and `bodyBox`.
- Frame counts: walk 9 (other, spirituality: 7); idle 7 (financial: 9, bank-robber re-export 2026-10-19); attack 9 (other: 7); death 9 (ends in a green splat — plays once on completion via `.enemy-dying`, 12fps = 750ms, holds the last frame; css/enemyAnim.css + `SpriteAnim.playDeath`).
- Characters are drawn at **128px** inside the cell, all facing left (toward the church). Display at integer scales only (e.g. 0.5× → 64px) with `image-rendering: pixelated`, or the pixels shimmer.
- **Originals:** PixelLab's raw exports (incl. the 8-direction rotation rows used only as AI reference, and alternate takes such as Career's two other walk cycles) are kept in `anim/_source/` — reference only, never shipped (exclude from `sw.js`).
- Rebuild an atlas from `_source/` if Jeremy swaps a take: crop the chosen animation rows, center-pad each to the category's largest cell, stack walk/idle/attack/death.
- **Rendering (built, Stage 2a):** `js/spriteAnim.js` + `css/enemyAnim.css` — see DECISIONS.md 2026-10-12. Display 1x (tasks/habits), 0.5x (sub-tasks), parents snapped to whole multiples; state (walk/idle/attack) and speed come from existing classes. Atlases are 9 cols x 4 rows; cell size and frame counts per category live in `enemyAnim.css` and are checked against the JSONs by `test/spriteAnim.test.js`. Swapping a take: rebuild the atlas, re-run the tests.

- **Feet calibration (2026-10-13):** the atlases do NOT all draw the planted foot at `cell - pad`; `css/enemyAnim.css` carries a measured `--dy-walk/--dy-idle/--dy-attack` per category (other 7/10/10, career 3/2/3, creativity 0/2/2, spirituality 2/2/2, health -2/0/-4, lifestyle -2/0/0, financial 6/6/4 since the 2026-10-19 bank-robber re-export, relationships 0). Whenever an atlas is re-exported, `npx jest test/spriteFeet.test.js` tells you the new numbers.
- **Portrait strip floor (2026-10-13):** tileable dirt/graveyard ground, dark and low-contrast so the white markers read, tiled 1:1 (`repeat-x`, pixelated). `Assets/scene/floor-tile.png` 127x72 = desktop/landscape ground (`css/gameCanvas.css`); `strip-floor.png` 64x36 (halved) = portrait strip floor (`css/glanceStrip.css`). Alternates kept in `Assets/scene/_source/`, unused: `strip-floor2.png`, `strip-floor3.png` (fence variants, 256x128), `strip-floor-original.png` (the source of the current tiles). Originals in `Assets/scene/_source/` (128x128 v1) and `Assets/scene/_source/strip-floor2.png` (256x128 v2, source of the current tiles). Desktop lane feet are measured from the tile (`CONFIG.GROUND_FLOOR_*`); portrait floor height must stay == (lanes-1) x pitch + pad (36px).
