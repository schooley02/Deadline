"""0% base idle strip (16 frames, 8 fps; no attack strip at 0%).
Usage: python3 anim0.py <final/base_000_final_184x200.png> <out_prefix>
Writes <out>_anim_16f.png (2944x200) and <out>_ember_mask.png (the ember pixels).
Previews: preview0.py (its GIF writer keeps the ember colours exact; see gifkit.save_gif(exact=...)).

What moves, and nothing else (rubble, bell, statue, sandbags and the cross itself are never touched):
  * EMBERS (the warm pixels in the rubble + the cracks in the charred cross) are repainted in eight flat hot-ember
    colours (RAMP: dull red -> red -> orange -> yellow-white). At REST they are dark: mostly the two dullest reds,
    the hottest drawn pixels a dark red. Rest never changes.
  * FLARES: a few small hot spots (a seed pixel + the ember pixels touching it) flare to orange / yellow for a few
    frames and die back, each at its own moment. No patch pulses as a whole and nothing travels across the art.
    Two of them are the ember cracks on the cross.
  * FLOATING EMBERS: single pixels that lift off an ember, rise with a slight wobble and cool from yellow to dark
    red (same ramp, never grey) before they go out.
Jeremy's rules (2026-11-22): warm hot-ember colours; the pulse must not flow through the artwork; far fewer embers
pulsing and more random; dark embers show most, with an occasional flicker from a few to the lighter colour; a few
floating embers; one or two embers on the cross flicker; no grey anywhere in the embers or the floating embers.
Every event wraps round the loop (frame index modulo 16), so the strip repeats without a jump."""
import math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
N = int(os.environ.get("FRAMES", 16))
SEED = int(os.environ.get("SEED", 11))
N_FLARES = int(os.environ.get("FLARES", 5))      # hot spots in the rubble (the two on the cross come on top)
N_SPARKS = int(os.environ.get("SPARKS", 8))
TAU = math.tau

U = np.array(Image.open(src).convert("RGBA")).astype(float)
H, W = U.shape[:2]
r, g, b, a = (U[..., i] for i in range(4))
yy, xx = np.mgrid[0:H, 0:W]

# the eight flat ember colours, coldest to hottest
RAMP = np.array([(58, 18, 14), (92, 24, 15), (128, 34, 17), (168, 50, 20),
                 (208, 84, 26), (240, 128, 38), (255, 176, 66), (255, 220, 130)], np.uint8)
TOP = len(RAMP) - 1

# ember pixels: clearly warm (red well above green and blue), opaque, not the right-hand sandbag
sat = (r - np.maximum(g, b)) / np.maximum(r, 1)
EMBER = (a == 255) & (r > 60) & (sat > 0.28)
EMBER &= ~((xx >= 152) & (xx <= 172) & (yy >= 155) & (yy <= 170))
CROSS = EMBER & (yy >= 170)
LAB, NPATCH = ndi.label(ndi.binary_dilation(EMBER, iterations=1)); LAB = LAB * EMBER

# rest level per pixel from how bright it was drawn (ranked among the embers): mostly dark
lum = (r + g + b) / 3
rank = np.zeros((H, W)); vals = np.sort(lum[EMBER])
rank[EMBER] = np.searchsorted(vals, lum[EMBER]) / max(1, len(vals) - 1)
REST = np.zeros((H, W), int)
REST[EMBER & (rank >= 0.45)] = 1
REST[EMBER & (rank >= 0.85)] = 2                  # nothing rests brighter than dark red: only flares reach orange
REST[CROSS] = 2                                   # the cross cracks: a steady dark red

rng = np.random.default_rng(SEED)

# ---- flares: seed pixels spread over the rubble (hotter drawn pixels more likely), at least MIN_D apart
MIN_D = 9
cand = [(int(y), int(x)) for y, x in zip(*np.nonzero(EMBER & ~CROSS))]
wts = np.array([0.15 + rank[y, x] ** 2 for y, x in cand]); wts /= wts.sum()
seeds = []
for idx in rng.choice(len(cand), size=len(cand), replace=False, p=wts):
    y, x = cand[idx]
    if all(max(abs(y - sy), abs(x - sx)) >= MIN_D for sy, sx in seeds): seeds.append((y, x))
    if len(seeds) == N_FLARES: break
cy, cx = np.nonzero(CROSS)
cross_seeds = []
for y, x in zip(cy, cx):                           # one seed per cross crack
    if all(LAB[y, x] != LAB[sy, sx] for sy, sx in cross_seeds): cross_seeds.append((int(y), int(x)))
seeds += cross_seeds[:2]

ENV = [(0.45, 1.0, 0.75, 0.45, 0.2), (0.6, 1.0, 0.6, 0.3), (0.3, 0.7, 1.0, 0.8, 0.5, 0.25), (0.5, 1.0, 0.8, 0.55, 0.3, 0.12)]
starts = list(rng.choice(N, size=len(seeds), replace=False))          # every flare starts on a different frame
FLARES = []
for (sy, sx), f0 in zip(seeds, starts):
    on_cross = bool(CROSS[sy, sx])
    FLARES.append(dict(y=sy, x=sx, f0=int(f0), env=ENV[int(rng.integers(len(ENV)))],
                       peak=int(5 if on_cross else rng.choice([5, 6, 6, 7])), cross=on_cross))

def flare_levels(f):
    """level per pixel in frame f: rest, lifted near each flare's seed while that flare is alight"""
    L = REST.copy()
    for fl in FLARES:
        k = (f - fl["f0"]) % N
        if k >= len(fl["env"]): continue
        e = fl["env"][k]
        d = np.maximum(np.abs(yy - fl["y"]), np.abs(xx - fl["x"]))
        same = EMBER & (LAB == LAB[fl["y"], fl["x"]])
        core = same & (d == 0); ring = same & (d == 1)
        L[core] = np.maximum(L[core], np.round(REST[core] + e * (fl["peak"] - REST[core])).astype(int))
        L[ring] = np.maximum(L[ring], np.round(REST[ring] + e * (fl["peak"] - 2 - REST[ring])).astype(int))
    return np.clip(L, 0, TOP)

# ---- floating embers: lift off an ember pixel (never the cross), rise, wobble, cool down the ramp
SPARK_LEVELS = (7, 6, 6, 5, 4, 4, 3, 2, 2)
ey, ex = np.nonzero(EMBER & ~CROSS)
SPARKS = []
for j in range(N_SPARKS):
    q = int(rng.integers(len(ex)))
    SPARKS.append(dict(f0=int(round(j * N / N_SPARKS + rng.integers(0, 2))) % N, life=int(rng.integers(6, 10)),
                       x0=int(ex[q]), y0=int(ey[q]), rise=float(rng.uniform(10, 18)), dx=float(rng.uniform(-3, 3)),
                       wob=float(rng.uniform(0.5, 1.2)), wph=float(rng.random() * TAU)))

def spark_px(f):
    res = []
    for sp in SPARKS:
        k = (f - sp["f0"]) % N
        if k >= sp["life"]: continue
        u = k / (sp["life"] - 1)
        x = int(round(sp["x0"] + sp["dx"] * u + sp["wob"] * math.sin(sp["wph"] + u * 5)))
        y = int(round(sp["y0"] - 2 - sp["rise"] * u))
        res.append((y, x, SPARK_LEVELS[min(len(SPARK_LEVELS) - 1, int(u * len(SPARK_LEVELS)))]))
    return res

def frame(f):
    o = U.astype(np.uint8).copy()
    L = flare_levels(f)
    o[..., :3][EMBER] = RAMP[L[EMBER]]
    for y, x, lv in spark_px(f):
        o[y, x, :3] = RAMP[lv]; o[y, x, 3] = 255
    return o

if __name__ == "__main__":
    frames = [frame(f) for f in range(N)]
    strip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
    for i, fr in enumerate(frames): strip.paste(Image.fromarray(fr, "RGBA"), (i * W, 0))
    strip.save(out + f"_anim_{N}f.png")
    Image.fromarray((EMBER * 255).astype(np.uint8)).save(out + "_ember_mask.png")
    base = U.astype(np.uint8)
    ramp_set = {tuple(int(v) for v in c) for c in RAMP}
    outside = 0; off_ramp = 0; bright = []
    for f, fr in enumerate(frames):
        sp = np.zeros((H, W), bool)
        for y, x, _ in spark_px(f): sp[y, x] = True
        diff = (fr != base).any(axis=2)
        outside += int((diff & ~EMBER & ~sp).sum())
        for y, x in zip(*np.nonzero(EMBER | sp)):
            if tuple(int(v) for v in fr[y, x, :3]) not in ramp_set: off_ramp += 1
        bright.append(int((flare_levels(f)[EMBER] >= 4).sum()))
    print("ember px", int(EMBER.sum()), "| rest levels 0/1/2:", [int((REST[EMBER] == k).sum()) for k in range(3)])
    print("flares:", [(fl["x"], fl["y"], "f%d" % fl["f0"], "peak%d" % fl["peak"], "cross" if fl["cross"] else "") for fl in FLARES])
    print("bright (orange or hotter) ember px per frame:", bright)
    print("px changed outside embers + floating embers (must be 0):", outside, "| ember / floating px not in the 8 flat colours (must be 0):", off_ramp)
