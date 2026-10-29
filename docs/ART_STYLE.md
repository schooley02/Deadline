# Art Style — Sprites, Categories, Base States

## Style
Pixel art / cartoonish. Playful, slightly eerie (graveyard setting) but never grim. Suitable for a younger audience.

**LOCKED 2026-07-21** (DECISIONS.md): pixel art is confirmed as the permanent style — all future assets match the existing 64×64 zombies. Sprite visibility over the background is handled by contrast (dark, low-detail silhouette background layers; bright saturated sprites — see VISUAL_DESIGN_PLAN.md V1), not by changing sprite style.

## AI Asset Pipeline (decided 2026-07-21)
- **Base sprite generation:** Retro Diffusion (true grid-aligned pixel art; use existing assets/renders as style reference).
- **Animation / rotations:** PixelLab (text-prompted cycles, 4/8-direction rotations, Aseprite extension).
- **Format:** raster PNG only — the pipeline is PNG sprites positioned by DOM/CSS; no vector sprites. SVG is used only for scene silhouette props (V1).
- Background is layered; camera tilt rejected — never rotate pixel sprites. **2026-10-27: the layers no longer move with the time slider (ground, hills and clouds locked; the cloud drift and sprite animations follow the drag instead, see UI_UX.md).** Old rates, for history: **(V1 live-tuning, 2026-07-21): ground −22% (fastest — the original "ground fixed" call was reversed), clouds −18%, silhouettes −7%.** **Clouds (2026-10-27):** PixelLab pixel art, 2x like the church: `Assets/scene/clouds-tile.png` (625x72; sources `Assets/scene/_source/cloud-a.png`, `cloud-d.png`), 3 muted lavender-grey colours (#8c89a8 / #5a5878 / #3d3a5c), dark underside (no light bottom row), no outline. Brief that worked: "pixel art night cloud, isolated, transparent background, puffy rounded top, flatter bottom, moonlit from the upper right, 4-5 colour palette, no anti-aliasing".

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

## Heroes (planned 2026-10-21; Other Hero built 2026-10-25)
**Built (Other):** `Assets/Heroes/anim/other.png` = 9 cols x 5 rows of 164px cells (character 128px, faces right, feet on row 140 in every idle frame): rows idle, attack, hurt, levelup, ko (9 frames each; PixelLab export with the rotation row dropped and rows reordered), `other.json` (same shape as the zombie atlases + `feetY`, `bodyBox`), `Assets/Heroes/other-head.png` (32x32 head crop for tray / tab / list chips). All 8 category heroes are built (2026-10-25). NORMALIZE every new sheet to this exact format (164px cells, rows idle/attack/hurt/levelup/ko, feet on row 140) before adding it, so CSS and tests need no per-hero numbers. Recipe for the remaining categories is in `docs/HERO_SPOTLIGHT_PLAN.md` sub-session 4. KO plays once at `CONFIG.HERO_KO_FPS`, holds the last frame `CONFIG.HERO_KO_HOLD_MS` (3 s), restarts; the KO row has one airborne mid-fall frame by design. Wired rows: `idle`, `ko`, `hurt` (one-shot on damage, `hurtloop` while its zombie attacks), `levelup`, and `attack` (one-shot when its item is completed, 2026-10-26; the work-timer hero still uses `idle`).
Healthy, non-zombie twins of the category zombies above (same outfit, alive palette, upright, facing right). Brief, file layout and sizing: `docs/HERO_SPOTLIGHT_PLAN.md`.

## Enemy Visual Modifiers
- Closer to due: more menacing, faster animation.
- High priority: gold silhouette glow + ⭐ badge. Overdue: red glow (pulses). Negative-habit lurker: purple glow + 🚫 badge. Habit: cyan glow. High/super streak: orange flickering fire glow. All are `drop-shadow` glows that hug the sprite (V2, 2026-10-12) — no rectangles; see UI_UX.md "Enemy state glows".
- Parent task w/ sub-tasks: larger; shrinks as sub-tasks complete.
- Habit: same regular size as a task (cyan glow is the only visual distinction beyond category art; the dashed border was removed in V2); high streak = on fire. Sub-tasks are the only tier that renders visually smaller (64×64) — changed 2026-07-21, see DECISIONS.md.

## Category Colors (from prototype, for UI accents)
other #90ee90 · career #4a90e2 · creativity #f5a623 · financial #50e3c2 · health #e91e63 · lifestyle #bd10e0 · relationships #f8e71c · spirituality #7ed321

## Graveyard zone art (V7, placeholders built 2026-10-28)
Hill, tree and each headstone are SEPARATE graphics (so they can be swapped one by one): hill (CSS now), tree
(inline SVG, trunk at the right edge, canopy overhanging), one headstone per achievement family (placeholder; the 2026-10-28 village decision turns the hill into the
MEMORIAL only, so these tier headstones are no longer planned: see "Achievement village art") and one low, dim past-run grave (shorter than a
zombie, ~26px, slight tilt). All at the moon/church pixel scale; every new shell asset goes in `sw.js`
`APP_SHELL` with a `CACHE_NAME` bump.

## Achievement village art (DECIDED 2026-10-28, revised the same evening; PixelLab; NOTHING BUILT IN-GAME YET)
Mockups: Design canvas "Deadline World Feedback Mockups", boards 8a-8e. The village replaces the W2 headstone-by-tier idea: 8 category
buildings stand on the horizon hill BEHIND the zombie lanes (a background-art change) as a seeded staggered cluster in 3 depth rows;
the Memorial (all-time best tiers) is the one monument on the right-hand graveyard hill. Tapping the band or the Memorial opens a
close-up village view. Buildings carry their own state (no floating markers by default).

**Kinds** (mockup ids; final code ids are a build-time call): `slain` Armory, `nights` Watchtower, `habits` Barn, `lurkers` Jailhouse,
`heroes` Hall, `defense` Gatehouse (Church Defense), `punctuality` Clock tower, `bestdays` Windmill, `memorial`. 5 tiers x 3 conditions.

**PIXEL-SCALE RULE (revised 2026-10-28 evening; supersedes the earlier "1x in the scene"):** the whole game is drawn at 2 screen px per
art px (church 80x200 shown 160x400, zombies 64x64 shown 128, heroes, floor). Village sprites follow it: **scene = 2x, close-up = 4x
(3x on a short screen)**. 1x looked finer than, and out of place beside, the church/zombies (Jeremy, confirmed on a mock of the real
scene). Whole-number scales only; never rotate a pixel sprite; never author big and shrink (a 256-canvas example tower was 60x239 true
1px art with no 2x2 grid, so it cannot be shrunk cleanly and is 239px tall: NOT used; it was only a quality example).
- **Native canvas: PROPOSED 64x80 (128x160 on screen), bottom-centre anchored, 56x64 (112x128) as the floor.** Detail target = a zombie
  sprite (64x64 = 4,096 art px); 64x80 = 5,120. Decide by generating Clock tower T3 at BOTH sizes and comparing on the scene mock
  (recipe below). Existing 48x56 / 56x64 violet art is NOT final.
- Close-up uses the SAME sprite at 4x (256x320 for 64x80: check it fits; 3x = 192x240 if not); no second art needed. Optional later
  "hero art" slot per building if one needs more detail, with a code fallback to the scaled-up scene sprite.

**Vertical budget (measured in the running game, cloud Chromium, 2026-10-28):** `#gameCanvas` is 334px tall at 844x390, 356 at 915x412,
298 at 1280x720; floor band 72px at the bottom; back-lane feet = floor top + 24 (y 286 at 844x390); zombie box 128 => top-lane zombie
heads reach y~158 (844x390), ~180 (915x412), ~122 (1280x720). HUD chips end ~y52 (top-left), the moon sits top-right (~y30-85), the
MIDNIGHT line runs full height at x~460 (the village must draw UNDER it). So ~100px of a building shows above the top-lane zombies at
844x390; feet go on the horizon hill (y~205-245); lowering feet is fine as long as the art above the head line stays tappable.
**Design rule: put the identifying detail (clock face, windmill blades, water tank) in the TOP HALF of the sprite.** Depth between rows =
y position + a darker tint on back rows (same sprite size; no 0.9x scaling).

**Style direction: AMERICANA, small-town USA (Jeremy 2026-10-28), replacing the violet/gothic look.** Red brick with white painted trim,
slate and green-patina copper roofs, cast-iron street lamps, backlit clock faces in PALE YELLOW (orange is not a believable lit-clock
colour). Whole village is one small town. PROPOSED kinds (confirm next session): Armory = brick National Guard armory, Watchtower =
water tower, Barn = red barn, Jailhouse = brick sheriff's office, Hall = town hall with white columns, Gatehouse = fire station,
Clock tower = courthouse clock tower, Windmill = farm water-pumping windmill, Memorial = obelisk / war memorial with a flag.

**Clock tower tier ladder (each tier a new sprite; silhouette must change, not only colour):** T1 crumbling (missing bricks, boarded
window, stopped dull face, damaged roof, leaning drawn into the pixels) - T2 intact plain brick, small dull face, dim window - T3 pale
yellow lit face, white trim bands, white louvered belfry - T4 + cast-iron street lamps, painted trim, bigger belfry - T5 green copper
cupola, rooster weather vane, flag, gold detail (optional bunting). Palette strip: `Assets/Village/_source/americana_palette.png`
(outline #1a1020; brick #5b2a2b #7a3a34 #9a4a3f; white trim #d9d4c6 / shade #a9a4b4; slate #3b3550; patina #4f8f86 #6fb5a5; door #563434;
window/lamp #ecba70; clock face #f3e3a2).

**Prompt, Clock tower T3 baseline** (canvas 64x80, then repeat at 56x64):
`pixel art, small-town American courthouse clock tower, front view, tall slim red brick tower, brick rows visible with light mortar
lines, white painted wooden trim and cornice bands, white window frames, large round clock face glowing pale yellow with black hands and
a white frame, white belfry section with louvered openings above the clock, steep dark slate roof with a small iron finial, one tall
arched window lit warm yellow, arched wooden door with a white frame and two stone steps, night lighting from the upper right, 1px dark
outline, palette: outline #1a1020, brick #5b2a2b #7a3a34 #9a4a3f, white trim #d9d4c6 and shade #a9a4b4, slate #3b3550, clock pale yellow
#f3e3a2, window #ecba70, door #563434, no anti-aliasing, no dithering, transparent background, no ground line, 2px empty space above the roof`

**Conditions are CODE, not art** (45 base sprites, not 135): tended = full colour + soft warm glow; slipping = CSS `saturate(.55)
brightness(.74)` + weeds overlay; neglected = `saturate(.15) brightness(.48)` + boards/vines overlay (give dark tiers a brightness FLOOR
~0.6: a neglected T1 nearly vanishes into the ridge); tier-up = twinkle + accent glow. The lamp glow must switch OFF when neglected.
Overlays are shared PNGs on the same canvas grid so they scale with the building.

**What worked in PixelLab (Clock tower session):** (1) get 16 variants, number them, rank on an upscaled grid beside the previous tier
(2) keep the reference strength LOW-MEDIUM when the silhouette must change, or every result is "last tier plus a dormer" (3) put the
palette hexes in the prompt (4) fix colour in code, not by regenerating: luminance remap onto a palette ramp for walls, a luminance
lerp for the clock face (orange -> pale yellow), region recolour for a roof, door remap; DON'T fill a ring around a face that nearly
fills its stage (it became a gold slab) (5) judge every candidate at 1x AND 2x on the real scene screenshot with real zombies in the
lanes (Playwright at 844x390), not on a flat sheet; (6) avoid two side-by-side windows over an arched door (reads as a face), curly lamp
arms (noise at small size), and gold/ornament fills that hide the clock hands.

**Files:** `Assets/Village/<kind>_t<1-5>.png` (shipped), PixelLab originals and test art in `Assets/Village/_source/`, overlays in
`Assets/Village/overlays/`. The violet/gothic Clock tower T1-T5 (yellow faces, T5 56x64 with teal roof + gold trim) is kept as an
ALTERNATIVE look in `Assets/Village/_source/gothic-violet/` (not final, not shipped). Every shipped asset goes in `sw.js` `APP_SHELL`
with a `CACHE_NAME` bump.

**Test building: Clock tower, all 5 tiers, tended.** Pass = tiers readable side by side at 2x on the scene, the clock face reads in the
top half with zombies in front, and 64x80 is visibly richer than 56x64 (else take 56x64).

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
