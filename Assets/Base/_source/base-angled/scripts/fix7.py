from PIL import Image, ImageDraw
import pl, concurrent.futures as cf
b = Image.open("low_detail.png").convert("RGBA")
base = Image.new("RGBA", (184, 200), (0, 0, 0, 0)); base.paste(b, (0, 0)); base.save("fix7_base.png")
m = Image.new("RGBA", base.size, (0, 0, 0, 255)); ImageDraw.Draw(m).rectangle([164, 56, 183, 82], fill=(255, 255, 255, 255)); m.save("fix7_mask.png")
D = ("Pixel art, night. A small weathered rust red cloth flag with a white five-pointed star, flying to the right from the top "
     "of a thin dark iron pole, slightly rippled, not perfectly even. Muted, realistic.")
def run(s):
    for i, o in enumerate(pl.inpaint(base, m, D, seed=s, no_bg=True)): o.save(f"fix7_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(run, (31, 32)))
print("used", b0 - pl.balance())
