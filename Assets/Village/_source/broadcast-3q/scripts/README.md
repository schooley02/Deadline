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
