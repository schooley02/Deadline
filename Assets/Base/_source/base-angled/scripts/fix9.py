from PIL import Image, ImageDraw
import pl, concurrent.futures as cf
base = Image.open("fix8_comp.png").convert("RGBA")
m = Image.new("RGBA", base.size, (0, 0, 0, 255)); ImageDraw.Draw(m).rectangle([150, 158, 183, 195], fill=(255, 255, 255, 255)); m.save("fix9_mask.png")
D = ("Pixel art, night. A neat stack of tan burlap sandbags, two to three layers high, piled against the right front corner of a "
     "white clapboard church beside the right end of light grey stone steps, a black iron lantern post standing among them, "
     "warm lantern light on the top bags. Muted, weathered, realistic.")
def run(s):
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"fix9_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(run, (51, 52)))
print("used", b0 - pl.balance())
