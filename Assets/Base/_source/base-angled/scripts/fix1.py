"""Step 1: widen gen_82 to 168 px and inpaint the clipped right edge (facade corner, eave, foundation, sandbags)."""
from PIL import Image, ImageDraw
import pl, sys

src = Image.open("g3_gen_82_0.png").convert("RGBA")
im = Image.new("RGBA", (168, 200), (0, 0, 0, 0))
im.paste(src, (0, 0))
mask = Image.new("RGBA", (168, 200), (0, 0, 0, 255))
ImageDraw.Draw(mask).rectangle([154, 60, 167, 185], fill=(255, 255, 255, 255))
im.save("fix1_in.png"); mask.save("fix1_mask.png")
desc = ("Pixel art. Finish the right edge of a white clapboard country church front: the gable wall ends with a white corner "
        "board and dark outline, the dark slate roof eave overhangs slightly at the top right, grey stone foundation and a few "
        "tan sandbags at the bottom right. Nothing else, transparent background beyond the building.")
b0 = pl.balance()
for seed in (5, 6):
    outs = pl.inpaint(im, mask, desc, seed=seed, no_bg=True)
    for i, o in enumerate(outs):
        o.save(f"fix1_out_{seed}_{i}.png")
print("used", b0 - pl.balance())
