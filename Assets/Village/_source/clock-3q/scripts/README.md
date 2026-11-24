# Clock tower three-quarter redraw -- scripts (2026-11-23/24)

Working scripts from the Claude session that made `clock_t1..t5_final_112x208.png`. They were run from one
session folder with these sub-folders: `out/` (PixelLab results), `bags/`, `flag/`, `t1/`, `t2/`, `t4/`, `t5/`.
Paths inside them point at that layout, so treat them as a record of HOW each tier was built, not as a build
you can run as is. The PixelLab API key is NOT in them (`gen.py` reads it from a local `.key` file).

Order: `guide.py` (flat-colour layout guides) -> `gen.py` + `poll.py` (concepts) -> `raise8.py` (clock raised 20 px)
-> `edit.py` (`edit_with_text`: dressed stone, clean pass) -> `fix8c.py` (taller base, full door, eave)
-> `turn.py` (re-angle to the village camera) -> `fix_base.py`, `fix_ped.py`, `fix_side4.py` (first-floor fixes on
Jeremy's touch-up) = T3. Then `build_t4.py` + `compose_t4.py`, `build_t5.py`, `build_t2.py`,
`build_t1.py` + `finish_t1.py`; `lamps.py` holds the shared street lamp (lit / off / broken / bent) and the glow helper;
`inpaint.py` submits `inpaint-v3` jobs.

`../pieces/`: the Gym T5 sandbag stacks at 0.75 (`gymL_r2`, `gymR_r1`), the High school T5 flag at 0.70 (`flag_r1`),
the T1 foot inpaint, PixelLab's raw concept 8 and its layout guide.
