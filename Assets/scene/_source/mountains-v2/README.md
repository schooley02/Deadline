# Mountains v2 + cooler sky horizon (2026-11-26, Claude app session)

Replaces `Assets/scene/mountains.png` (the 2026-11-07 PixelLab range, kept here as `mountains_v1_2026-11-07.png`).
Same size (640x240, 1:1), same placement and CSS (`.scene-mountains`, top at `--clm-hz` - 280 px, the low valley at tile
column 270 still sits under the moon). Code-drawn, not PixelLab.

## What Jeremy picked
- Round 1 (`mocks/mountains_round1_*`): A rugged range / B low rolling ridges / C distant massif + foothills.
- Colour: grey options felt "too black and white" (`mocks/mountains_C_colours_laptop.png`); colour-rich options next
  (`mountains_C_colours2_laptop.png`). Leaned to B with one taller peak on the left because the towers read better in the
  sky (`mountainsB2_colours_*`; needs a 1920 tile anchored to the church), then looked at A again
  (`mountainsA_colours_*`) and was "fine with the height".
- Sky: `mocks/sky_x_mountains_laptop.png` (real game sky vs a cooler horizon, x 3 mountain colours). Picked **B2** =
  cooler horizon + **A in blue-violet**.

## The final
`mountains_A_bluviolet_final_640x240.png` = the shipped file: `scripts/mountains.py` `build('A', 3)` (two ranges built peak
by peak: lit face right of each crest (moon on the right), shadow face left, spur ribs, muted snow only high on the lit
faces of the tallest peaks, haze toward the foot), recoloured to hue 236 with saturation x1.15 (between the sky, ~237-240,
and the tree line, ~233). 23 colours, no semi-transparent pixels, tiles.

## Sky (CSS, not art)
`css/gameCanvas.css` `.scene-sky` fallbacks (= Clear): s1 #171735 -> #171936, s2 #2b2a4a -> #292d4c, s3 #3d3a5c -> #373c5c
(purple-grey horizon -> blue-grey, same lightness; s0 unchanged). `css/climate.css`: hazy / overcast / fog s1-s3 moved by the
same hue step (-4 / -8 / -13 deg, lightness and saturation kept); storm unchanged. `test/climateWiring.test.js` updated.

## Scripts
`mountains.py` (options A / B / C), `ridges.py` (B2 ridges + tall peak, 1920 wide, NOT used), `scene.py` (mock renderer, now
with the game's real sky gradient; earlier mocks before `sky_x_mountains` used a simplified bluer sky).
