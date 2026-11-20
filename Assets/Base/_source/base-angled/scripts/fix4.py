from PIL import Image, ImageDraw
import pl, concurrent.futures as cf
base = Image.open("fix3_out.png").convert("RGBA")
m = Image.new("RGBA", base.size, (0, 0, 0, 255)); ImageDraw.Draw(m).rectangle([112, 136, 175, 187], fill=(255, 255, 255, 255)); m.save("fix4_mask.png")
D = ("Pixel art, night. Three light grey weathered stone church steps leading down to the right from a red door, a few tan "
     "sandbags beside them, and a tall black iron lantern post at the right of the steps with a lit lantern hanging from "
     "its hook, warm candle light falling on the steps and sandbags. Muted, realistic, not cartoonish.")
def run(s):
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"fix4_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(run, (9, 10)))
print("used", b0 - pl.balance())
