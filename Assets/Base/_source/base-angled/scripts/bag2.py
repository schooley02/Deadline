from PIL import Image, ImageDraw
import pl, concurrent.futures as cf
base = Image.open("base_075_final.png").convert("RGBA")
m = Image.new("RGBA", base.size, (0, 0, 0, 255)); ImageDraw.Draw(m).rectangle([0, 168, 19, 199], fill=(255, 255, 255, 255)); m.save("bag2_mask.png")
D = ("Pixel art, night. A pile of tan burlap sandbags against a church wall; one bag near the front is burst open and sagging "
     "with sand pouring out onto the ground in a small heap. Muted, weathered, realistic.")
def run(s):
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"bag2_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(run, (131, 132)))
print("used", b0 - pl.balance())
