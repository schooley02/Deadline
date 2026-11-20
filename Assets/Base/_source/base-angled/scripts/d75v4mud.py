import concurrent.futures as cf
from PIL import Image, ImageDraw
import pl
base = Image.open("d75v4_stageA.png").convert("RGBA")
MUD = ("Pixel art, night. The bottom of a dirty white clapboard church wall: thick dark brown mud caked along the base and "
       "splashed up the boards in uneven spatters, with a few groups of dark claw scratches. Muted, gritty, realistic.")
JOBS = {
 "s1": ([(0, 148, 20, 172)], MUD),
 "s2": ([(18, 150, 50, 194)], "Pixel art, night. The stone pedestal of a weathered statue and the dirty white clapboard wall "
        "behind it, both with dark brown mud caked around the bottom and splashed upward in uneven spatters. Muted, gritty."),
 "s3": ([(48, 154, 97, 172)], MUD),
 "s4": ([(97, 150, 118, 174)], MUD),
 "s5": ([(140, 146, 162, 174)], MUD),
}
def run(n, s):
    rects, D = JOBS[n]
    m = Image.new("RGBA", base.size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for r in rects: d.rectangle(r, fill=(255, 255, 255, 255))
    m.save(f"d75v4_mask_{n}.png")
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"d75v4_{n}_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(10) as ex:
    for f in [ex.submit(run, n, s) for n in JOBS for s in (121, 122)]:
        try: f.result()
        except Exception as e: print("ERR", e)
print("used", b0 - pl.balance())
