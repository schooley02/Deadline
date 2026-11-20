"""Damage state 75% from the approved full-health church: light damage, same composition.
Parallel inpaints in separate regions; only masked pixels are taken; original alpha kept."""
import concurrent.futures as cf
from PIL import Image, ImageDraw
import pl
base = Image.open("base_100_final.png").convert("RGBA")
STYLE = " Pixel art, night, muted and weathered, realistic, not cartoonish."
JOBS = {
 "winB": ([(48, 108, 72, 162)], "A pointed-arch stained glass church window on white clapboard: two rough wooden planks nailed "
          "diagonally across its lower half, one pane cracked, warm light from inside still showing through the gaps." + STYLE),
 "lancetL": ([(98, 114, 112, 160)], "A narrow pointed stained glass window on white clapboard with one pane cracked and a small "
          "broken hole near the bottom, warm light inside." + STYLE),
 "door": ([(119, 134, 140, 170)], "The lower half of a weathered white-painted wooden church double door with black iron hinges, "
          "now with dark claw scratches, scuffs and dirty handprint smudges." + STYLE),
 "bags": ([(58, 176, 84, 195)], "Tan burlap sandbags stacked against a church wall, one bag torn open and slumped with sand "
          "spilling onto the ground." + STYLE),
 "scuff": ([(74, 150, 96, 170)], "White horizontal clapboard church wall with a few dark scrape marks and mud splatter near "
          "the bottom." + STYLE),
}
def run(n, s):
    rects, D = JOBS[n]
    m = Image.new("RGBA", base.size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for r in rects: d.rectangle(r, fill=(255, 255, 255, 255))
    m.save(f"d75_mask_{n}.png")
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"d75_{n}_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(10) as ex:
    for f in [ex.submit(run, n, s) for n in JOBS for s in (101, 102)]:
        try: f.result()
        except Exception as e: print("ERR", e)
print("used", b0 - pl.balance())
