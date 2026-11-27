# Village ground v2 (2026-11-26, Claude app session, Fable 5.2; Jeremy picked each step)

ART DONE and WIRED 2026-11-26 night (sw v437; DECISIONS 2026-11-26 "village ground v2 WIRED"; docs/ART_STYLE.md "Village ground v2").
In the game: `Assets/scene/village-field.png` (= `village-field_640x78.png`) and `Assets/scene/village-pad.png` (= `village-pad.png` here, then WIDENED:
see the note at the end).

- `village-field_640x78.png`: the grass strip, "option B" (two gentle rises + underbrush at the tree line), in the lane-grass style
  (flat tones in soft clumps, separate tufts, chunky pixels). 640x78 art, to be shown at 2x (1280x156), tiles in x, top edge at
  horizon - 90px like the old `village-field.png` (so the far-row towers' `dropWide` 17 still puts their bases on the tree line).
  Code-drawn (`scripts/ground.py`, `field('rises')`).
- `village-pad.png`: the worn-asphalt pad under the WHOLE village (front, back and far rows). 336x46 art, shown at 2x (672x92).
  Shape, crumbled edge, shoulder gravel and weeds are code-drawn (`scripts/ground2.py`); the surface inside is PixelLab
  `edit-images-v2` redraw B (seed 4102, `pixellab/out_4102_0.png`) with one teal puddle-looking patch painted out.
  Jeremy: wanted pavement under the village (vehicles, people) with grass kept along the zombie lane; picked worn asphalt over
  packed gravel, then PixelLab redraw B over the code surface and redraw A.
- `anchor.json`: where the pad goes. Left edge = the Gym's art left edge - 21px; top = the front row's feet (the horizon) - 88px;
  bottom = horizon + 4px (it stops ~2px in front of the front row so the lane's grass verge stays).
- `mocks/`: the scene rebuilt from these two files at four screen sizes (clear night, star 3 buildings; contact shadows in the
  mocks are generated, the game has none yet).
- `pixellab/`: the 384x64 canvas sent to PixelLab and both redraws (A = seed 4101, not used).
- `scripts/`: `ground.py` (grass + round-1 mocks), `ground2.py` (pad), `plpass.py` (PixelLab call; reads the API key from the
  session workspace, never stored here), `plscene.py`, `finals.py` (builds the two finals + anchor), `slots.js`.

Weather: the old field has no storm version (weather is drawn as films over the scene), so these need none.

Pad widened after wiring (2026-11-26 night): the shipped `Assets/scene/village-pad.png` is 356x46 (shown 712x92), 20 art px wider on the right
than `village-pad.png` here (336x46). The extra columns repeat texture from inside the pad (12 px inserted at column 240, then 8 px at column 252),
so the edge shape is unchanged. Reason: the Lab's right corner overhung the ragged upper-right edge. `anchor.json` (left and top) still applies;
only the width changed. The game's numbers are `PAD` in `js/villageLayout.js`.
