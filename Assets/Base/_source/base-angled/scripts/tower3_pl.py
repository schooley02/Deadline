from PIL import Image, ImageFilter
import pl, json, concurrent.futures as cf
code = Image.open("tower3_code.png").convert("RGBA")
sil = Image.open("tower3_sil.png").convert("L")
holes = Image.open("tower3_holes.png").convert("L")
m = sil.filter(ImageFilter.MaxFilter(5)).point(lambda v: 255 if v else 0)
mask = Image.merge("RGBA", (m, m, m, Image.new("L", m.size, 255)))
D = ("Pixel art, night, almost eye level. A short square white-painted wooden church bell tower rising just behind the front "
     "gable peak: a short weathered clapboard base, a thin white belt trim, then an OPEN belfry with four slim white corner posts "
     "and a low white railing, empty dark sky visible through it, a dark bronze bell hanging in the middle, white cornice and a "
     "short dark slate pyramid roof with a small iron finial. Left side shaded, front lit. Muted, moonlit, realistic.")
def run(s):
    for i, o in enumerate(pl.inpaint(code, mask, D, seed=s, no_bg=True)): o.save(f"t3_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(run, (91, 92)))
print("used", b0 - pl.balance())
# composite: tower silhouette from PixelLab, then re-cut the see-through openings and re-place the bell
import glob
bell = json.load(open("tower3_bell.json"))
outs = []
for f in sorted(glob.glob("t3_9*_*.png")):
    o = Image.open(f).convert("RGBA")
    c = Image.composite(o, code, sil.filter(ImageFilter.MaxFilter(3)))
    cp = c.load(); hp = holes.load()
    for y in range(c.height):
        for x in range(c.width):
            if hp[x, y]: cp[x, y] = (0, 0, 0, 0)
    for x, y, p in bell: cp[x, y] = tuple(p)
    n = f.replace("t3_", "t3c_"); c.save(n); outs.append(n)
print(outs)
