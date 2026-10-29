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

**PIXEL-SCALE RULE (REVISED 2026-10-28 late; supersedes BOTH the earlier "1x / 48x56" and the "2x / 64x80" rules):** zombies and heroes are
authored on a 128px character canvas (atlas cells 180px zombies / 164px heroes, `characterSize: 128` in `Assets/Zombies|Heroes/anim/*.json`) and are drawn
1:1 (1 art px = 1 screen px). The church is the exception (80x200 shown at 2x). The 64x64 zombie PNGs are only the static fallback (shown at 2x); the
earlier "2x" rule was judged against those, the wrong reference. **Village sprites are therefore authored on a 128px-wide canvas and shown at 1x in the
scene; close-up = 2x (whole numbers only).** Never rotate a pixel sprite, never author big and shrink, never use 1.5x (uneven pixels).
- **Canvas (Jeremy generated at 128x128 in PixelLab, 2026-10-28): 128 wide, height per building, bottom-centre anchored.** Clock tower: **128x256 for ALL
  five tiers (regenerated 2026-10-29, see "Building scale vs the Clock tower" below; the first 128x192 / 128x224 art is superseded)**, art 221-246 px tall,
  bottom-aligned. (First pass, kept for history: T3 128x192, tower ~52x192 px, clock ~26px across in the top third; T5 128x224 for the cupola/vane/flag because sprites are
  bottom-anchored.) Other buildings 128x128 unless they need height. Tested and REJECTED: the 128x128 carve of the tower alone (30x122 = a needle, clock
  only ~14px) and 2x/1.5x of it (chunky / uneven pixels, 244px tall, runs into the HUD chips).
- Detail target = the animated zombies. The tower must stand TALLER than the other buildings (landmark): the 128x192 tower vs a 128x128 courthouse
  (~95px tall) reads right on the scene mock.
- Scene-mock recipe: lane feet are `back = H - GROUND_FLOOR_HEIGHT(72) + GROUND_FLOOR_FEET_TOP_PAD(24)`, `front = H - GROUND_FLOOR_FEET_BOTTOM_PAD(8)`, middle
  halfway (286/306/326 at H=334); draw the real atlas idle frame (cell 180, feet row 152) at those feet, back lane first; keep same-lane zombies >= ~0.4 x 128
  px apart (`LANE_CONFLICT_FRAC` .6). Landscape/desktop ONLY (the portrait strip is 92px tall and has no village).

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
**Mapping status (2026-10-29):** CONFIRMED only Jailhouse = small-town / country county jail + sheriff's office (star badge on the parapet,
barred windows, off-centre door). Jeremy may change the others; they stay PROPOSED until he confirms them.

**AT-A-GLANCE DISTINCTNESS RULE (Jeremy 2026-10-29):** each building must be quickly told apart from every other building at a glance,
at 1x, with zombies in front. Red brick on every building makes the village blend into one mass once all 8 + the Memorial are on the
ridge, so **vary the MATERIAL as well as the silhouette**: red brick is reserved for a few buildings (the Clock tower already uses it), and
the others use different small-town materials, e.g. fieldstone / cut limestone (Jailhouse), white or weathered clapboard / board-and-batten
timber, painted barn-red wood, galvanized metal / riveted steel (water tower, windmill), pale granite (Memorial). Each kind also gets its own
top-half identifier (clock face, star badge, water tank, blades, dome, crenellations, hose tower, flag) and a distinct overall shape
(tall / squat / wide / lattice). The whole village still shares the night palette and value rules above (muted walls, pale off-white
trim, only the lit details are bright), so it reads as one town. **Check:** before locking any new building's T3, composite it on the
scene mock next to the buildings already chosen; if two read alike at 1x, change the material or silhouette, not just the colour.

**Clock tower tier ladder (each tier a new sprite; silhouette must change, not only colour):** T1 crumbling (missing bricks, boarded
window, stopped dull face, damaged roof, leaning drawn into the pixels) - T2 intact plain brick, small dull face, dim window - T3 pale
yellow lit face, white trim bands, white louvered belfry - T4 + cast-iron street lamps, painted trim, bigger belfry - T5 green copper
cupola, rooster weather vane, flag, gold detail (optional bunting), and an OPEN belfry with a VISIBLE BRONZE BELL above the clock
(Jeremy 2026-10-28; the bell appears at T5 only, T1-T4 keep closed louvers).
**Night-scene value rule (Jeremy 2026-10-28):** the buildings must recede so the zombies stand out. Wall brick is MUTED (dusty
warm brick, no bright red); the TOP HALF keeps a pale painted-off-white belfry/cornice (capped at #c9c4b8, never pure white; this
is the identity Jeremy likes from the first batch); the clock face and lit windows are the brightest things on the sprite.
The light budget grows by tier through lit details (windows, lamps, glow), not by brighter walls. A fully dark top half
(batch 3, all-dark slate/plum) was rejected: it lost the white belfry. **Working palette (supersedes the 2026-10-28 afternoon strip):** outline #14101e;
brick #4a3340 #6a4048 #845050; off-white trim #c9c4b8 / shade #8f8ba3; lower trim + stone #8a88a0; slate #34304a; door #3a2a32; clock face #f3e3a2;
lit window #d8a860; (T5 only) patina #4f8f86 #6fb5a5, gold trim #c8a860, bronze bell #b08a4c. Colour that comes back too bright is pulled down in code
(luminance remap, keep the clock/window pixels), not regenerated.

**CHOSEN T3 baseline (2026-10-28 late): `Assets/Village/_source/americana-t3/t3_128x192_tall_1.png`** (128x192, from the prompt below with `t3_128_carve_2.png` as a
low-medium reference). Not shipped, not in sw.js. Other kept candidates in that folder: 56x64 / 64x80 / 64x64 batches, the four 128x128 courthouse
originals (`t3_128_courthouse_1-4.png`; 1 = bell cupola, 2 = louvered belfry + portico) and the 128x128 carves.

**Prompt, Clock tower T3 baseline (128x192, 16 variants, reference = carve at low-medium strength):**
`pixel art, small-town American courthouse clock tower at night, front view, tall stately square tower about 76 pixels wide and 176 pixels tall, the whole tower fills the canvas height, muted dusty brick with a hint of warm red and visible mortar lines, pale cream-grey painted belfry section near the top with two arched louvered openings, very large round clock face about 26 pixels across glowing pale yellow with black hands set in a cream-grey clock stage with a white trim frame, steep dark slate pyramid roof with a small iron finial, tall brick shaft below the clock with two small arched windows, the upper one lit warm amber, cream-grey stone trim bands and cornice between the stages, stone pediment portico with columns over an arched dark wooden double door, stone steps, moonlit, medium-low contrast, only the clock and the one window are bright, 1px dark outline, palette: outline #14101e, brick #4a3340 #6a4048 #845050, trim #c9c4b8 and shade #8f8ba3, stone #8a88a0, slate #34304a, door #3a2a32, clock pale yellow #f3e3a2, window #d8a860, no anti-aliasing, no dithering, transparent background, no ground line, 4px empty space above the roof, nothing below the steps`
(The generated tower came out ~52 px wide and touches the canvas top; fine, it is bottom-anchored.)

**Tier prompts T1, T2, T4, T5:** same canvas (T5: 128x224), same palette and base prompt, reference = the T3 baseline at LOW-MEDIUM strength (silhouette must change),
then replace the tier sentence: **T1** `crumbling and leaning slightly, missing bricks, boarded arched window, cracked stopped clock face dull #a89a68 with no glow, broken slate roof with missing tiles, no lit windows, plain arched door without a portico` -
**T2** `intact plain brick, small dull clock face #c8b878, one dim window #8a6a40, simple closed louvered belfry, simple slate roof, plain arched door, little trim` -
**T4** `as the baseline plus two cast-iron street lamps with warm lit lanterns beside the door, painted trim bands, a taller belfry with taller arched openings, two or three lit amber windows, bright clock face` -
**T5** `as T4 but the slate roof is replaced by a green patina copper cupola #4f8f86 #6fb5a5, an OPEN arched belfry with a visible bronze bell #b08a4c hanging above the clock, a rooster weather vane on top, a small flag, gold trim accents #c8a860`.
Dark tiers need the brightness floor (see below); T1-T2 lit details stay dim so the light budget grows by tier.

**Conditions are CODE, not art** (45 base sprites, not 135; QUEUED LATER 2026-10-29: Jeremy wants baked overgrown/vine versions of each tier for the neglected state, see ROADMAP V7): tended = full colour + soft warm glow; slipping = CSS `saturate(.55)
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

**CLOCK TOWER T1-T5 REGENERATED AND SHIPPED (DONE 2026-10-29, Claude app session):** all five tiers are 128x256 canvases, bottom-aligned (feet on row 255), drawn 1:1; `CONFIG.VILLAGE_CLOCK_SCALE` is now 1 (the 1.3x stretch stopgap is gone), `VILLAGE_SPRITE_H_PX` 256, `VILLAGE_CLOCK_ART_H_PX` 246, sw v137. Shipped as `Assets/Village/punctuality_t1..t5.png`; finals + PixelLab candidates in `Assets/Village/_source/americana-t3/rescale/` (`t1_final`, `t2_128x256_rescale_trim`, `t3_final`, `t4_final`, `t5_final`; the older 128x192/224 art stays in `americana-t3/ladder/`). Art height: T1 245 (leaning ruin, the PixelLab take with the lean baked in), T2 221, T3 239, T4 224 (wider body, corner pinnacles, two lamps), T5 246 (copper dome, bell, rooster vane, survivor flag, two lamps). Doors ~16x28 like the Jailhouse. The T5 cap of 246 is what fits a 298px desktop canvas with the feet lowered the full 24px (tested in `villageLayout.test.js`). **How it was made (reuse for the other 7 kinds):** (1) canvas 128x256, 16 variants, prompt = the T3 baseline with `about 84 pixels wide and ~200 pixels tall` (PixelLab comes out narrower than asked) and `a LARGE arched dark wooden double door about 16 pixels wide and 28 pixels tall`; (2) DELETE the phrase "the whole tower fills the canvas height" and ask for explicit empty space above and below (`10px empty space above the roof finial, 4px empty space below the steps`) -- that phrase made every result touch both canvas edges and cut off the steps; (3) a reference at MEDIUM strength is copied almost exactly (T4 first came out as "T3 plus lamps"), LOW-MEDIUM lets the silhouette change; build each tier up from the tier below, not down from the top; (4) PixelLab ignores some details (tall arched belfry openings, a taller belfry): ask once, then inpaint or draw it in code; (5) code fixes that worked: delete rows of PLAIN BRICK between features to shorten a tower (no stretching, seamless; used on T2, T3, T5), a dentil band under the clock ledge drawn in the sprite's own trim colours (T3), thicker clock hands edited by Jeremy (T4); (6) a lean can't be faked by shifting rows (jagged), let PixelLab draw it with the leaned sprite as the reference. Verified on mock scenes at canvas 334 / 356 / 298 (landscape). **DONE with this:** the Clock tower T5 now carries the same rust-red survivor flag as the Jailhouse T5 (the earlier TODO below). **TODO:** live-check in the real game and on a phone (not done: only mock scenes with placeholder zombies were checked); T5's clock hands are thinner than the T4 ones Jeremy thickened (optional).

*(Superseded 2026-10-29, kept for history)* **Building scale vs the Clock tower (measured 2026-10-29; was a STOPGAP in code: the sprite stretched 1.3x via `CONFIG.VILLAGE_CLOCK_SCALE`, a known break of the whole-number rule, removed with the regenerated art above):** the tower's door opening (~12x20 px) is smaller than the Jailhouse's (~16x26 px) and its shaft is only ~30 px wide, so the tower looks undersized beside the other buildings. Rule for every building: **doors should be a similar size across the village** (target ~16x26 px). Pixel art cannot be stretched by 1.3x, so the fix is regenerated art: tower shaft ~50 px wide, art <= ~232 px tall (canvas 128x240; T5 the same height), a LARGE arched double door ~16x28 px in the portico. T3 prompt = the baseline above with `about 84 pixels wide and 232 pixels tall` (PixelLab comes out ~1/3 narrower than asked), clock face ~30 px, and `a LARGE arched dark wooden double door about 16 pixels wide and 28 pixels tall`; reference = the current T3 at low-medium strength. Height budget: phone 844x390 and 915x412 fit; desktop 1280x720 (canvas 298) needs the feet lowered ~16 px into the floor band. Queued in ROADMAP V7.

**Jailhouse (`lurkers`) T1-T5, DONE 2026-10-29:** fieldstone county jail (red brick is avoided on purpose, see the AT-A-GLANCE DISTINCTNESS RULE), 128x128, star badge on the parapet, barred windows, off-centre door. Ladder: T1 collapsed corner + boarded windows + no light; T2 rough rubble, dim window; T3 cut stone + cornice, one lit window; T4 cream-grey parapet + hanging sign, two lit windows; T5 gold badge, two glowing lanterns, three lit windows and a TATTERED SURVIVOR FLAG (rust-red cloth, cream painted star, crooked rope-lashed wooden pole; chosen over a national flag, Jeremy 2026-10-29). Shipped as `Assets/Village/lurkers_t1-5.png`; PixelLab originals + candidates (#13 = vines, for the overgrown variants) in `Assets/Village/_source/americana-jail/`. TODO when the others are built: give the Clock tower T5 the same kind of survivor flag instead of its orange pennant, so every T5 building shares one look.

**Files:** `Assets/Village/<kind>_t<1-5>.png` (shipped), PixelLab originals and test art in `Assets/Village/_source/`, overlays in
`Assets/Village/overlays/`. The violet/gothic Clock tower T1-T5 (yellow faces, T5 56x64 with teal roof + gold trim) is kept as an
ALTERNATIVE look in `Assets/Village/_source/gothic-violet/` (not final, not shipped). Every shipped asset goes in `sw.js` `APP_SHELL`
with a `CACHE_NAME` bump.

**Test building: Clock tower, all 5 tiers, tended, 128-wide canvases at 1x.** Pass = tiers readable side by side on the scene mock (real lanes + animated zombies),
the clock face reads in the top third with zombies in front, silhouettes differ per tier, and the tower stands taller than the other buildings. (T3: PASSED 2026-10-28.)

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
