"""75% v2: boards on every window, more scratches (door + lower siding), roof patch, a few missing shingles.
Parallel inpaints on base_075_v1 in separate regions; grime is a code pass afterwards."""
import concurrent.futures as cf
from PIL import Image, ImageDraw
import pl
base = Image.open("base_075_v1.png").convert("RGBA")
STYLE = " Pixel art, night, muted and weathered, realistic, not cartoonish."
BOARDS = ("rough weathered wooden planks nailed across it (two or three, slightly crooked, nail heads visible), "
          "warm light from inside still showing through the gaps between the planks.")
JOBS = {
 "winA": ([(0, 104, 18, 160)], "A pointed-arch stained glass church window on white clapboard with " + BOARDS + STYLE),
 "lanL": ([(97, 112, 113, 162)], "A narrow pointed stained glass window on white clapboard with " + BOARDS + STYLE),
 "lanR": ([(145, 104, 160, 156)], "A narrow pointed stained glass window on white clapboard with " + BOARDS + STYLE),
 "door": ([(119, 112, 140, 171)], "A weathered white-painted wooden church double door with black iron hinges, covered in many "
          "dark claw scratches, gouges, scuffs and grimy handprints, dirtiest near the bottom." + STYLE),
 "sidF": ([(97, 160, 117, 172), (141, 154, 150, 172)], "The bottom of a white clapboard church wall with dark claw scratches, "
          "gouges and mud splatter." + STYLE),
 "sidS": ([(48, 160, 96, 172), (0, 158, 18, 170)], "The bottom of a white clapboard church side wall with dark claw "
          "scratches, scrapes and mud splatter." + STYLE),
 "roofP": ([(40, 62, 72, 84)], "Dark slate shingle church roof with a rough repair patch: a few mismatched lighter grey "
          "replacement shingles and a weathered board nailed over a hole." + STYLE),
 "shing": ([(84, 56, 100, 68), (8, 74, 24, 86)], "Dark slate shingle church roof with a few shingles missing, showing dark "
          "gaps and bare wooden battens underneath." + STYLE),
}
def run(n, s):
    rects, D = JOBS[n]
    m = Image.new("RGBA", base.size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for r in rects: d.rectangle(r, fill=(255, 255, 255, 255))
    m.save(f"d75b_mask_{n}.png")
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"d75b_{n}_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(16) as ex:
    for f in [ex.submit(run, n, s) for n in JOBS for s in (111, 112)]:
        try: f.result()
        except Exception as e: print("ERR", e)
print("used", b0 - pl.balance())
