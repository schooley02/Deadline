"""Statue instead of the lean-to, trim around the bell opening, white-painted door (parallel inpaints)."""
import concurrent.futures as cf
from PIL import Image, ImageDraw
import pl

base = Image.open("base_100_low_final.png").convert("RGBA")
JOBS = {
    "statue": ([(17, 118, 46, 194)],
               "Pixel art, night. A weathered grey stone statue of a robed figure standing with head bowed and hands folded in "
               "prayer, on a small square stone pedestal, in front of a white clapboard church side wall, a few tan sandbags at "
               "its base. Muted, realistic, moonlit, not cartoonish."),
    "trim": ([(116, 70, 141, 101)],
             "Pixel art, night. An arched opening in the white clapboard church gable with a small dark bronze bell hanging "
             "inside, framed by thick decorative white-painted wooden trim: a pointed arch molding with a small keystone, side "
             "casings and a sill shelf under the opening. Muted, weathered, realistic."),
    "door": ([(116, 101, 143, 171)],
             "Pixel art, night. A tall pointed-arch wooden double church door painted WHITE (weathered, slightly dirty paint, "
             "grey shading between the planks), black wrought iron strap hinges and ring handles, a pale stone arch frame, in a "
             "white clapboard wall. Muted, moonlit, realistic."),
}


def run(name, seed):
    rects, desc = JOBS[name]
    m = Image.new("RGBA", base.size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for r in rects: d.rectangle(r, fill=(255, 255, 255, 255))
    m.save(f"fix8_mask_{name}.png")
    for i, o in enumerate(pl.inpaint(base, m, desc, seed=seed, no_bg=True)): o.save(f"fix8_{name}_{seed}_{i}.png")
    return name, seed


if __name__ == "__main__":
    b0 = pl.balance()
    with cf.ThreadPoolExecutor(8) as ex:
        for f in [ex.submit(run, n, s) for n in JOBS for s in (41, 42)]:
            try: print(f.result(), flush=True)
            except Exception as e: print("ERR", e)
    print("used", b0 - pl.balance())
