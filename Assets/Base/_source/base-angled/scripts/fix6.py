"""Detail pass on low-camera option 1 (g4_txt_102_0): parallel inpaints, non-overlapping masks."""
import concurrent.futures as cf
from PIL import Image, ImageDraw
import pl

base = Image.open("g4_txt_102_0.png").convert("RGBA")
GLASS = ("tall pointed-arch church stained glass window with dark lead lines and a thin dark wooden frame, muted jewel colours "
         "(deep blue, wine red, amber, green) lit warmly from inside so someone seems to be in there, no glow halo outside the window")
JOBS = {
    "door": ([(118, 102, 140, 171)],
             "Pixel art, night. A tall pointed-arch dark red wooden double church door with black wrought iron strap hinges, "
             "iron ring handles and studs, a thin pale stone frame around the arch, inside a white clapboard wall. Muted, realistic."),
    "windows": ([(0, 106, 17, 157), (46, 110, 74, 164)],
                "Pixel art, night. On a white clapboard church side wall: " + GLASS + "."),
    "leanto": ([(17, 126, 45, 193)],
               "Pixel art, night. A small corrugated tin lean-to roof on wooden posts against a white clapboard church wall, "
               "with stacked wooden supply crates and a dark water barrel under it. Muted, weathered, realistic."),
    "bags": ([(46, 168, 118, 195), (0, 166, 16, 195)],
             "Pixel art, night. Two layers of tan burlap sandbags stacked along the foot of a white clapboard church wall on a "
             "grey stone foundation, ground below. Muted, weathered, realistic."),
}


def run(name, seed):
    rects, desc = JOBS[name]
    m = Image.new("RGBA", base.size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for r in rects: d.rectangle(r, fill=(255, 255, 255, 255))
    m.save(f"fix6_mask_{name}.png")
    for i, o in enumerate(pl.inpaint(base, m, desc, seed=seed, no_bg=True)): o.save(f"fix6_{name}_{seed}_{i}.png")
    return name, seed


if __name__ == "__main__":
    b0 = pl.balance()
    with cf.ThreadPoolExecutor(8) as ex:
        for f in [ex.submit(run, n, s) for n in JOBS for s in (21, 22)]:
            try: print(f.result(), flush=True)
            except Exception as e: print("ERR", e)
    print("used", b0 - pl.balance())
