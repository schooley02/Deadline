# Lab (ninth village building) - source art

Art for the Lab, all five stars. Made 2026-11-26 in a Claude app session (Fable 5.2) with Jeremy.
Not wired into the game yet. Rules and lessons: `docs/ART_STYLE.md` "LAB". Decisions: `docs/DECISIONS.md` 2026-11-26 "Lab art".

## Use these

`ship/lab_t1.png` ... `ship/lab_t5.png` are the finals: the five files Jeremy touched up in PixelLab and handed back
("here are all 5 that I want you to use when we wire them into the game"). They are pixel-identical to his uploads.
160x160, transparent background, light effects baked in (fungus glow, spotlight beam, glass shine).

`ship/lab_tN_art_only.png` is the same art before the fungus glow pass (no see-through pixels). Use it only as a starting
point for edits; it is NOT the shipped look.

Everything else in this folder is a superseded draft kept for history. `lab_ladder_final_4x.png` shows the five finals side by side.

| Star | Solid art x | With light x | Top row | Feet row | See-through px |
|---|---|---|---|---|---|
| 1 | 4-155 | 4-158 | 10 | 149 | 792 |
| 2 | 4-152 | 4-154 | 10 | 149 | 385 |
| 3 | 4-152 | 4-152 | 10 | 149 | 139 |
| 4 | 2-155 | 2-155 | 10 | 151 | 138 |
| 5 | 2-155 | 2-155 | 2 (flag) | 151 | 56 |

Columns and rows are inclusive, on the 160x160 canvas. Stars 4 and 5 stand 2 rows lower because of the sandbags and barriers.

## Geometry (160x160)

- Front wall x 56-152, roofline y 38, footing y 141-146.
- Left end wall x 5-56: top edge y = 38 + (56 - x) / 4, bottom edge y = 146 - (56 - x) / 4; 0.44 of the front's brightness.
- Glass frame at x 71 / 95 / 119 and y 95 / 138; panes x 72-94 and 96-118, y 96-137.
- Tanks: liquid x 77-90 (left) and x 99-112 (right), y 101-131.
- Sign frame x 112-143, y 48-64; 5x7 letters from x 117, y 53.
- Upstairs window glass x 69-80, y 50-63 and x 94-105, y 51-64.
- Door about x 124-146, y 100-146; beacon about x 128-134, y 88-95.
- Cage: barred face x 5-34, side panel x 35-44; lock 3x4 at x 33-35, y 125-128.
- Roof: stacks x 108-134, y 10-38; A/C unit x 40-72, y 24-38; spotlight housing centred (80, 26).

## How each star was made

- **Star 3** came first: PixelLab concepts (`/generate-image-v2`), front squared and end wall re-sloped in code, cage and tank
  figures by masked `/inpaint-v3`, lamp lighting, sign, fungus glow, spotlight and glass shine in code, then Jeremy's touch-ups.
- **Star 4** and **star 5** were built up from star 3 with masked inpaints (airlock, camera, perch and guard, scientist, barriers)
  plus code (rust removal, flag, barbed wire, conduit), then Jeremy's touch-ups.
- **Star 2** is star 3 with the heavy fungus version, lights off, one lit tank, a candle and boards; the end wall above the
  cage is Jeremy's own repaint (`scripts/build_t2.py` holds my version, which he did not use).
- **Star 1** starts from star 2: `scripts/build_t1_base.py` (repairs removed, windows and glass, dark room with fungus inside),
  `scripts/gen_t1.py` and `gen_t1b.py` (PixelLab: broken cage, extra growth, open door), `scripts/build_t1.py` (assembly + glow).

`scripts/lab_fx.py` holds the reusable light passes: `glow`, `spotlight_art`, `spotlight_beam`, `glass_shine`, `level_roof`.
The scripts read intermediate tiles and masks that existed only in the session workspace, so they document the method
rather than rebuild from scratch. `scripts/pl.py` is the PixelLab API helper; it reads the key from a file outside the repo.

## PixelLab gallery (the current five)

| Star | Gallery name | Id |
|---|---|---|
| 1 | Deadline Lab T1 DRAFT v10 (game version, with glow) | 75ff2847-56ec-458b-9c20-9540be55437d |
| 2 | Deadline Lab T2 DRAFT v3 (game version, with glow), repainted by Jeremy | d943c044-bc81-4573-9654-55d93c39a89d |
| 3 | Deadline Lab T3 FINAL v6 (full-height glass shine) | 531b72e6-13f3-497c-a6d5-9e559b53c901 |
| 4 | Deadline Lab T4 FINAL v6 (rail + wires touched up) | ff40e0ca-cb10-4ead-aa11-822d3d9a9865 |
| 5 | Deadline Lab T5 FINAL v2 (rail + wires touched up) | 90f29eae-a010-4a0b-865e-f327cadd6f65 |

Every other "Deadline Lab ..." gallery image is superseded. Images could only be added from the session, not replaced,
so the old ones were never removed.
