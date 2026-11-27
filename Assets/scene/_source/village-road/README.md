# Village road, option C (2026-11-26, Claude app session, Fable 5.2; Jeremy picked each step)

ART DONE and WIRED 2026-11-26 night (sw v442). In the game: `Assets/scene/village-road.png` (= `village-road_320x18.png`), `Assets/scene/village-pad.png`
(= `village-pad_lighter_356x46.png`), `Assets/scene/village-stop-sign.png` and `village-traffic-light.png` (= the two sign files here plus a baked
shadow / lamp glow, see the end).
DECISIONS 2026-11-26 "road into town"; docs/ART_STYLE.md "Village ground v2"; ROADMAP "Road into town".

What Jeremy picked:
1. Of three route mocks (A: curves up into the trees, plain; B: same with a faded centre line; C: level road running behind the
   church and the graveyard, faded centre line) he picked **C** (`mocks/round1_A-B-C_laptop.png`).
2. Of the code road and two PixelLab redraws he found the lighter redraw A easier to see, but did not like where it met the
   village asphalt (`mocks/round2_code-vs-pixellab_laptop.png`).
3. Of "lighten the pad all the way" (X) and "meet in the middle" (Y) he picked **Y**: the pad half lighter, the road half
   darker, so they are the same tone (`mocks/round3_asphalt-tone_laptop.png`).
4. The traffic light stands as close to the Lab's right edge as the stop sign stands to the Gym's left edge (19 px, measured
   to the hanging signal head).

Files:
- `village-road_320x18.png`: the road strip. 320x18 art, shown at 2x (640x36), tiles in x. 3 empty rows on top, 13 rows of road.
  Top edge 66 px above the front row's feet (road body from 60 to 34 px above the feet). Outline, edge lip, shoulder gravel and
  weeds are code-drawn (`scripts/strip.py` `code_strip`); the surface and its faded centre line are PixelLab `edit-images-v2`
  redraw A (seed 5201, `pixellab/road2_5201_0.png`), with its two outermost columns dropped and the left 24 columns dithered
  into a mirror of the right end so the tile wraps, then shifted half way toward the pad's tone.
- `village-pad_lighter_356x46.png`: the pad for the game once the road is wired. Same shape and size as the shipped
  `Assets/scene/village-pad.png`; only the asphalt pixels moved by about (+5, +11, +14) in RGB. Weeds and shoulder gravel untouched.
- `stop-sign_18x40.png`: code-drawn (9x20 art at 2x). Both PixelLab redraws lost the octagon and the white border.
- `traffic-light_42x72.png`: PixelLab redraw (seed 5301, `pixellab/signs_5301_0.png`), cut out and shown at 2x. Top lamp dim red.
- `mocks/final_laptop_1366x480.png`, `mocks/final_desktop_1920x640.png`: the scene with all of it, star 3 buildings, contact shadows.
- `pixellab/`: the canvases sent and the redraws used (B = seed 5202, not used). Not kept: seeds 5101 / 5102 on a 384x64 canvas
  (one erased the road, one blew it up to fill the frame: the road must fill a good part of the canvas, 13 of 32 rows worked).
- `scripts/`: `base.py` (scene compositor), `road.py` (round-1 routes, sign helpers), `strip.py` (the strip, the signs),
  `plroad.py` / `pl2.py` (PixelLab calls; the API key is read from the session workspace and is never stored here),
  `compare.py`, `lighten.py`, `finals.py`, `final2.py`. Paths inside are the session's; they are a record, not runnable as is.

Placement in the mocks (shown px, hz = the front row's feet): road strip top at hz - 66, tiled across the scene, drawn before the pad;
signs' feet at hz - 36; stop sign's right edge 19 px left of the Gym's art left edge; traffic light's left edge 19 px right of
the right-most front-row art edge (the Lab); each sign has a short shadow falling left.

Shipped sign PNGs: `village-stop-sign.png` is 18x42 (the sign plus 2 rows for its short left-falling shadow); `village-traffic-light.png`
is 46x74 (4 px left margin for the dim red lamp glow, 2 rows for the shadow). The game's numbers are `ROAD` in `js/villageLayout.js`.

Wired as shown, never answered by Jeremy: the arm points at the Lab (the pole is about 40 px further out than the 19 px gap), and
the lamp is dim red at every star. The four finals are in Jeremy's PixelLab gallery (added 2026-11-26).
