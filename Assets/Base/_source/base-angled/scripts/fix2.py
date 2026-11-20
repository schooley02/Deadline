"""Step 2 (parallel inpaints on the widened base, non-overlapping masks):
side windows -> lit stained glass, front lancets beside the door, erase the old flag + pole."""
import concurrent.futures as cf
from PIL import Image, ImageDraw
import pl

b = Image.open("fix1_out_6_1.png").convert("RGBA")
base = Image.new("RGBA", (176, 200), (0, 0, 0, 0)); base.paste(b, (0, 0))
base.save("fix2_base.png")


def mask(rects):
    m = Image.new("RGBA", base.size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for r in rects: d.rectangle(r, fill=(255, 255, 255, 255))
    return m


GLASS = ("tall narrow pointed-arch church stained glass window with dark lead lines and a thin dark frame, muted jewel colours "
         "(deep blue, wine red, amber, green), lit warmly from inside so it looks like someone is in there; no glow halo outside "
         "the window; weathered white clapboard wall around it")
JOBS = {
    "side": ([(46, 98, 71, 155), (0, 80, 8, 122)],
             "Pixel art, night. Replace the boarded windows on the church side wall with " + GLASS + "."),
    "front": ([(96, 98, 112, 152), (140, 92, 158, 150)],
              "Pixel art, night. On the white clapboard church front, on each side of the red door, one " + GLASS +
              ". Keep the small iron lantern on the wall left of the door, below or beside the window."),
    "flag": ([(76, 70, 97, 110)],
             "Pixel art. Dark slate shingle roof eave and the white clapboard church corner with a dark corner outline, "
             "continuing the surrounding roof and wall. No flag, no pole."),
}


def run(name, seed):
    rects, desc = JOBS[name]
    m = mask(rects)
    m.save(f"fix2_mask_{name}.png")
    outs = pl.inpaint(base, m, desc, seed=seed, no_bg=True)
    for i, o in enumerate(outs): o.save(f"fix2_{name}_{seed}_{i}.png")
    return name, seed, len(outs)


if __name__ == "__main__":
    b0 = pl.balance()
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(lambda a: run(*a), [(n, s) for n in JOBS for s in (7, 8)]):
            print(r, flush=True)
    print("used", b0 - pl.balance())
