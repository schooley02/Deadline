# Tree line v2 (2026-11-26, Claude app session)

Replaces `Assets/scene/treeline.png` (the 2026-11-07 PixelLab tree line, kept here as `treeline_v1_2026-11-07.png`).
Same size (404x168, 1 art px = 1 screen px) and the same placement, so no CSS or layout change: `.scene-treeline` in
`css/gameCanvas.css`, top edge at `--clm-hz` - 230 px, the low gap at tile column 130 still sits under the moon.

## What Jeremy picked
- Round 1 (`mocks/treeline_round1_*`): A mixed woods / B ragged pines / C late autumn. He leaned to A, or a B where the
  pines aren't all so ragged; wants a fuller wooded background but still gaps, depth and undergrowth.
- Round 2 (`mocks/treeline_round2_*`): A2 (mixed woods with stands and openings) vs B2 (fuller pines). Picked **B2**.
- Round 3 (`mocks/treeline_round3_*`): B2 code version vs three PixelLab redraws. Picked the **code version**: the
  redraws had too many highlights on them.

## The final (`treeline_B2_final_404x168.png` = the shipped file)
Code-drawn by `scripts/trees.py` (`build('B2', 22)`): three depth rows (far / mid / near, farther = lighter and bluer),
mostly full spruce / pine with layered drooping boughs; about 1 in 7 front trees ragged, a few dead snags, a few leafy
trees; trees bunch into stands with openings (`dens()` / `open_`) so the hazier rows show through; shrub-and-sapling
undergrowth along the foot of each row (`understory()` + `brush()`). Flat three-tone shading, light only on the
upper right (moon on the right). 15 colours, no semi-transparent pixels, tiles seamlessly (every tree is drawn with
x wrap-around).

## Scripts
- `trees.py`: the generator (options A, B, C, A2, B2). `python3 trees.py` writes `out/treeline_*.png`.
- `scene.py`, `mock.py`: scene mocks at laptop 1366x480 and phone 800x360 (expects a project copy at
  `/home/claude/jest/proj`; adapted from `../village-road/scripts/base.py`).
- `pltrees.py`, `fixpl.py`: the PixelLab edit-images-v2 pass (45 generations; key read from a local file, not stored)
  and the seam / bottom-row fix used for the redraws. `pixellab/` holds the canvas and the six redraws (not used).

## PixelLab
The final is in Jeremy's PixelLab gallery as "Deadline tree line v2 FINAL" (added with `save-to-asset`, `gallery:new`).
