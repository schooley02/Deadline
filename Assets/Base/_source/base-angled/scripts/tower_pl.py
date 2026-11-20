from PIL import Image, ImageFilter
import pl, concurrent.futures as cf
code = Image.open("tower_code.png").convert("RGBA")
sil = Image.open("tower_sil.png").convert("L")
m = sil.filter(ImageFilter.MaxFilter(5)).point(lambda v: 255 if v else 0)
mask = Image.merge("RGBA", (m, m, m, Image.new("L", m.size, 255))); mask.save("tower_mask.png")
D = ("Pixel art, night, seen from almost eye level. A short square white-painted wooden bell tower standing on the roof ridge of a "
     "small white clapboard country church: weathered clapboard walls, a louvered pointed-arch belfry opening on each visible "
     "side, a thin white cornice, a short dark slate pyramid roof with a small iron finial. The left face is in shade, the right "
     "face is lit. Muted, moonlit, realistic, not cartoonish.")
def run(s):
    for i, o in enumerate(pl.inpaint(code, mask, D, seed=s, no_bg=True)): o.save(f"tower_pl_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(run, (61, 62)))
print("used", b0 - pl.balance())
