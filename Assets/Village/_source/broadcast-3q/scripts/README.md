# Broadcast tower three-quarter redraw -- scripts (started 2026-11-24)

Working scripts from the Claude session that made `broadcast_t3_draft_128x208.png` (kind `nights`, was the Radio tower).
A record of HOW the art was built, not a build you can run as is. The PixelLab key is NOT here (`pl.py` reads a local `.key`).

- `bt208.py`: the code drawing (128x208, back-row detail, village camera): lattice base, ladder, crew platform, upper mast,
  cap + beacon, panel antennas, big dish, drum dish, equipment cabinet, and the station (`station_only=True`).
- `pl.py`: PixelLab helpers (`edit_with_text`, polling). The station alone (80x80 crop) went through `edit_with_text`;
  `../pieces/station_pixellab_80x80.png` is the result used. A pass over the whole tower speckles the lattice with white
  pixels, so the steelwork stays code-drawn.
- `compose.py`: steel layer + station layer. `finish.py`: cleans the PixelLab alpha, lifts its mid tones, then the light pass
  (see-through beacon bloom; wall-lamp and sign washes on opaque pixels only).

Everything that must show on a phone sits in the top 67 px of the art (beacon, dish, antennas, crew platform).

## 2026-11-24 evening: T3 final, T4 final, canvas 144x208
- `broadcast_t3_final_144x208.png`, `broadcast_t4_final_144x208.png` (Jeremy approved both). `broadcast_t3_draft_128x208.png` is the superseded first draft.
- The crew platform WRAPS the tower: the deck overhangs the tower top 10px each side and 3px of depth in front and behind; the legs run up into the middle of the underside.
- Small dish raised (TOP-17) on every tier so the lookout fits under it.
- T4 (`make(tier=4, figure=...)`, `finish.build(tier=4, figure=...)`): the lookout (`figure.py`: PixelLab inpaint `../pieces/lookout_pixellab_raw.png`, lifted off the redrawn steel, helmet redrawn as a soft cap, brightened), a deck work lamp on the mast, the floodlight on the platform's front-right corner under the big dish at 45 degrees (the reason the canvas grew 128 -> 144: open air for the beam), barred + plated station windows, the Gym's sandbag stacks (`clock-3q/pieces/gym*`), a wire coil round the legs, an anti-climb plate over the ladder foot.
- `bands=True` paints the whole tower in dull red / off-white bands (planned for T5, Jeremy: the whole mast).

## 2026-11-24 late: T5 final
- `broadcast_t5_final_144x208.png` (Jeremy approved). `finish.build(tier=5, figure=lookout, bands=True, guard=guard)`.
- Whole tower in dull red / off-white bands (base: one band per bracing section, counted from the top; slim upper mast: thirds, red / white / red).
- The shared survivor flag (`clock-3q/pieces/flag_r1.png`) on the right whip antenna beside the beacon; a pair of loudspeaker horns off the cap platform's left side.
- Two red obstruction lights halfway up the front legs, a second wire coil round the legs, two more Gym sandbag stacks, a yard light on the station roof's right end.
- The guard under the door lamp: PixelLab `generate-image-v2` at 32x48 (`../pieces/guard_pixellab_32x48.png`, pick 12 of 36), `resize` to 21x32.
- No barbed wire on the station roof (Jeremy had it removed).

## 2026-11-24 late: T2 final (all code, no PixelLab)
- `broadcast_t2_final_144x208.png` (Jeremy approved). `finish.build(tier=2)`.
- Top: beacon weak (dull lens, small bloom); big dish patched with a scrap sheet and turned 12 degrees (drawn on its own layer, then rotated about its mount); one panel antenna; a tarp shelter roped to the rail's left end; one rail section gone with a rope across.
- Steel: a brown-grey grime tint, rust in solid PATCHES (heavier low down) with dark runs under them. Jeremy asked for dirtier / rustier; single-pixel specks avoided.
- The two dishes, the panel antenna and the electrical box each got `dirty()`: tint + a few solid stains + short runs; the box also has a mud band along its bottom.
- Foot: sign and door lamp dead, candle on the front sill under one plank, side window under three planks at different angles, a tarp roped over the roof's right end, a fire barrel, the box's right door ajar.
- Dull pass in `finish.py` (colour 0.80, brightness 0.80), light sources left out, lights last.

## 2026-11-24 late: T1 final (all code, no PixelLab)
- `broadcast_t1_final_144x208.png` (Jeremy approved). `finish.build(tier=1)`.
- The big dish is torn off its mount and hangs in the air below the platform's right side, from a charcoal cable tied round the middle of the mast, bent over the hand rail (the right-end rail section is left standing for it). Jeremy: it may hang behind the school, players see it in the building window; he tried pure black (too dark) and near-black, and chose CHARCOAL. Dented, a bite out of the rim, feed horn gone, turned 75 degrees about its bracket then moved to the hang point.
- Beacon dead (dark cracked lens, no glow). The beacon stays ON (weak) at T2: Jeremy, it is the tower's signature.
- Small dish gone (bracket stub), last panel antenna hanging by one bolt, one whip bent over, the middle of the front rail torn out and hanging, two stretches of the ladder missing, the heaviest grime + rust patches.
- Station: both windows smashed, the door hanging open on a black doorway, the sign box hanging by one corner, a roof hole with rafters that follow the roof's lean, two wall boards gone. Electrical box gutted, a door lying against it. Dead weeds + rubble (drawn in `finish.py`, in front of everything).
- Dull pass colour 0.62, brightness 0.64 (about the Clock tower T1's); no light pass at all.

## 2026-11-24 night: Jeremy's PixelLab touch-ups
- All five finals were saved to his PixelLab gallery as "Deadline Broadcast Tower T1..T5 FINAL (144x208)" (T1 50855893, T2 ec01cd80, T3 e1a40854, T4 f7cc7eaa, T5 ded0dbe7).
- He exported all five back. Pixel diff against the code finals: T3 and T4 unchanged; T1 13 px (the bright footing + rust pixels at the tower's left foot toned down); T2 24 px (the same footing beside the fire barrel, the barrel's edge); T5 55 px (the same footing, a few pixels of the beacon bloom, the obstruction lights and the floodlight beam).
- `broadcast_t1 / t2 / t5_final_144x208.png` are now HIS versions; the scripts' own output is kept as `broadcast_t1 / t2 / t5_code_144x208.png`. Re-running the scripts does not reproduce his edits.
