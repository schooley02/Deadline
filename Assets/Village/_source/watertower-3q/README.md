# Water tower three-quarter art -- finals, pieces, script (2026-11-25)

The Water tower REPLACES the Windmill as a village building (kind id stays `bestdays`). Art only: nothing here is wired into the game yet.
Decisions: `docs/DECISIONS.md` 2026-11-25 "Water tower replaces the Windmill".

- `watertower_t1..t5_final_128x208.png`: the five stars, 128x208, feet on the bottom row. Canvas x 16-111 holds the tower; the 16 px
  on each side are open air for the star 4 / 5 spotlight beams (see-through) and the fence's side run.
- `watertower_ladder_t1_t5_3x.png`: the five side by side at 3x.
- `pieces/`: `tank_src_80x64.png` (the code tank sent to PixelLab), `tank_pixellab_pick_80x64.png` (stars 3-5, the cleanest of four
  `edit-images-v2 / edit_with_text` results, brightness x1.07), `tank_pixellab_t2_80x64.png` (star 2), `tank_pixellab_t1_80x64.png`
  (star 1, rustiest), `tank_pixellab_unused_heavy_80x64.png` (not used), `flag_small_14x11.png` (the shared survivor flag
  `clock-3q/pieces/flag_r1.png` shrunk from 21x16, cloth colours snapped back to the flag's palette, star redrawn).
- `scripts/watertower.py`: `python watertower.py` rebuilds all five finals exactly (checked pixel for pixel). `make(tier, tank_only)`.
  No PixelLab key here. Only the tank went through PixelLab; steel, lettering, figures, fence, lights and grime are code.

## Design, as built
- Village three-quarter camera (front flat, far side shifts LEFT, light front-right, never flip). Weathered light-BLUE paint (Jeremy;
  white was tried first). Scale about 7 px per metre: the lookouts are 13 px tall on purpose (Jeremy), so the tower reads tall and far.
  The Broadcast tower's figures are about 25 px; Jeremy saw both and kept 13.
- Far row, behind the Police station: everything a phone must show sits in the top ~65 px (tank, name, catwalk, lights, lookouts,
  the coil ring). The foot (fence, drums, barrel, hatch) is hidden in the scene and seen only in the building window.
- Name "DALTON" stencilled in navy, stepped down toward its ends so the line bows with the tank. From star 4 the survivors' word is
  hand-painted over it in rust red, 2 px strokes, 9 px tall, end letters 3 px lower, drips: "CAMP" at star 4, "FORT" at star 5.
- Ladder: T1 abandoned (torn hole in a caved-in tank, name nearly gone, two rail sections gone, long ladder gaps, loose bracing
  rods, far-left leg buckled near its foot, a drip leak at the tank's far edge, hatch plate off, weeds + rubble, no light, dull pass
  0.62 / 0.66) - T2 squatters (dent at the tank's top right, wrapped scrap patch over a leak, tarp windbreak, ONE lantern, rope across
  a missing rail section, bucket on a rope, hatch ajar, fire barrel + crate, dull pass 0.80 / 0.82) - T3 kept up (clean name, one
  lamp) - T4 "CAMP", one lookout behind scrap cover, one spotlight aimed 70 degrees down, security fence with razor coil all the way
  round, gate + tin sign, water drums on a pallet, yard lamp - T5 freshly painted (no grime), "FORT", small survivor flag on an
  outrigger pole, two lookouts, two spotlights, razor coil ring under the tank, gate guard, second pallet.
- Grime on the steel is tiered (worse on lower stars, none at star 5): low-frequency patches, never single-pixel specks. On stars 3-4
  the discoloration is faded grey-green paint, not dark patches (dark ones read as shadows on the frame, Jeremy).
- Footings are turned blocks (front, top, left side) drawn FIRST; legs and riser end in the middle of each top face (Jeremy).
- Fence: front run flat, left side run going back 26 px left / 5 px up, back and right runs drawn first (behind the legs), dimmer.

## PixelLab gallery (saved 2026-11-25 as "Deadline Water Tower T1..T5 DRAFT (128x208)")
T1 32758903-ccf7-4efc-9912-3472083bb273, T2 602cd20c-396b-4ee0-a900-56876f6c3e02, T3 529e9906-8807-4e11-a1fb-04970974fa2b,
T4 11a84789-bb09-4093-8f8a-8fc701355422, T5 48ba2492-6197-43aa-afb8-c0f668d49bd4.

## Not done
- Not wired (`Assets/Village/bestdays_t*.png` are still the Windmill). The phone mocks used: canvas left = Police station left + 38,
  top 0 on the 800x360 phone (sunk like the Broadcast tower), graveyard hidden, top-bar buttons collapsed.
- With today's top-bar buttons the tank is hidden behind them on a phone; the spot depends on the planned collapse button.
- Not checked on a real phone or in the building window.
