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
