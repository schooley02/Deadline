from PIL import Image, ImageFilter, ImageChops
import pl, concurrent.futures as cf
code = Image.open("tower2_code.png").convert("RGBA")
sil = Image.open("tower2_sil.png").convert("L")
patch = Image.open("tower2_patch.png").convert("L")
patch_only = ImageChops.subtract(patch, sil)          # gable patch outside the tower
def rgba(m): return Image.merge("RGBA", (m, m, m, Image.new("L", m.size, 255)))
tmask = sil.filter(ImageFilter.MaxFilter(5)).point(lambda v: 255 if v else 0)
pmask = patch_only.point(lambda v: 255 if v else 0)
rgba(tmask).save("t2_mask_tower.png"); rgba(pmask).save("t2_mask_gable.png")
JOBS = {
 "tower": (rgba(tmask), "Pixel art, night, almost eye level. A short square white-painted wooden church bell tower rising straight up "
          "from the front gable of a small white clapboard country church: weathered clapboard, an open pointed-arch belfry on the "
          "front showing a dark bronze bell, a louvered opening on the shaded left side, thin white cornice, short dark slate pyramid "
          "roof with a small iron finial. Left face in shade, front face lit. Muted, moonlit, realistic, not cartoonish."),
 "gable": (rgba(pmask), "Pixel art, night. Weathered white horizontal clapboard siding on a church front gable, with a large rustic "
          "dark brown wooden cross (two weathered beams) mounted flat on the wall. Muted, moonlit, realistic."),
}
def run(n, s):
    m, D = JOBS[n]
    for i, o in enumerate(pl.inpaint(code, m, D, seed=s, no_bg=True)): o.save(f"t2_{n}_{s}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(4) as ex:
    for f in [ex.submit(run, n, s) for n in JOBS for s in (71, 72)]: f.result()
print("used", b0 - pl.balance())
