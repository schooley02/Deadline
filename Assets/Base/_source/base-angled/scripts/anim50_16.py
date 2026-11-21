"""50% idle / under-attack strips (16 frames, 8 fps). Fire method unchanged from the 8-frame version; adds the
window-beam pulse (same as 75 %), the blowing flag and the bell (still when idle, ringing under attack).
Usage: python3 anim50_16.py <unlit.png> <out_prefix>   env: ATTACK=1, BEAM_V6/BEAM_V7
50% idle strip: flickering fire (flames re-coloured each frame, rising) + firelight that varies in strength and
position, with the open door leaf blocking the light toward the wall on its right (a shadow wedge that moves)."""
import math, random, colorsys
from PIL import Image
import sys, os
src, out = sys.argv[1], sys.argv[2]
base = Image.open(src).convert("RGBA"); B0 = base.load(); W, H = base.size
N = int(os.environ.get("FRAMES", 16)); FPS = int(os.environ.get("FPS", 8))
B = B0
def lum(p): return .3 * p[0] + .59 * p[1] + .11 * p[2]
def hls(p): return colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)
G = {}
def noise(x, y, s, salt=0):
    gx, gy = x / s, y / s; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.Random(hash(k)).random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy
# flame pixels in the touched base (door gap + threshold + lantern glass)
def in_fire_zone(x, y):
    if 134 <= x <= 141 and y < 168: return False          # the open leaf's edge + the frame: never fire
    return (130 <= x <= 133 and 100 <= y <= 172) or (122 <= x <= 147 and 150 <= y <= 178)
flame = {(x, y) for y in range(98, 182) for x in range(116, 150) if in_fire_zone(x, y)
         and B[x, y][3] == 255 and B[x, y][0] > 170 and hls(B[x, y])[2] > 0.6 and B[x, y][0] > B[x, y][2] + 90}
GLASS_RECTS = [(97, 110, 115, 166), (143, 100, 163, 160), (0, 104, 22, 160), (44, 106, 78, 166)]
def is_glass(x, y, p):
    return any(r[0] <= x <= r[2] and r[1] <= y <= r[3] for r in GLASS_RECTS) and hls(p)[2] > 0.35 and not (p[0] > p[2] + 20 and hls(p)[1] < .55 and hls(p)[2] < .5)
FL = [(255, 240, 180), (255, 200, 96), (248, 140, 48), (196, 72, 30), (120, 40, 24)]
LEAF_X, LEAF_Y0, LEAF_Y1 = 136, 103, 171
BEAMS = {}
if os.environ.get("BEAM_V6"):
    v6 = Image.open(os.environ["BEAM_V6"]).convert("RGBA").load(); v7 = Image.open(os.environ["BEAM_V7"]).convert("RGBA").load()
    HOLES = [(8, 137), (6, 114), (63, 147), (54, 135), (107, 131), (151, 125)]
    for y in range(H):
        for x in range(W):
            if v6[x, y] != v7[x, y] and B0[x, y] == v7[x, y]:
                h = min(range(len(HOLES)), key=lambda i: (x - HOLES[i][0]) ** 2 + (y - HOLES[i][1]) ** 2)
                BEAMS[(x, y)] = (v6[x, y], v7[x, y], h)
# lit holes + glowing window glass + roof hole: pulse with the same fire inside (weighted by how warm/lit each pixel is)
import colorsys
GLOW_REGIONS = [((0, 104, 20, 160), None), ((46, 108, 76, 164), None), ((97, 112, 113, 164), 4), ((144, 102, 161, 158), 5),
                ((50, 70, 80, 84), "roof")]
def warmth(p):
    if p[3] < 255: return 0.0
    l = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)[1]
    return max(0.0, min(1.0, (p[0] - p[2] - 40) / 120)) * max(0.0, min(1.0, (l - 0.22) / 0.4))
GLOW = {}
for (x0, y0, x1, y1), tag in GLOW_REGIONS:
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x, y) in BEAMS: continue
            w = warmth(B0[x, y])
            if tag in (4, 5):                                          # front windows: their frames are firelit orange -> hole light only
                p = B0[x, y]; l = colorsys.rgb_to_hls(p[0] / 255, p[1] / 255, p[2] / 255)[1]
                if not (p[0] >= 235 and p[1] >= 175 and l > 0.68): continue
            if w > 0.05:
                h = tag if tag is not None else min(range(4), key=lambda i: (x - HOLES[i][0]) ** 2 + (y - HOLES[i][1]) ** 2)
                GLOW[(x, y)] = (B0[x, y], w, h)
def glow_factor(ph0, h):
    if h == "roof":                                                    # right over the fire: a bit livelier
        return 1 + 0.26 * math.sin(3 * ph0 + 0.9) + 0.12 * math.sin(7 * ph0 + 2.3) + 0.06 * math.sin(11 * ph0)
    o = h * 0.55
    return 1 + 0.22 * math.sin(2 * ph0 + o) + 0.10 * math.sin(5 * ph0 + 1.7 + o) + 0.05 * math.sin(7 * ph0 + 0.4 + 2 * o)
frames = []
for f in range(N):
    fb = base.copy(); fpx = fb.load(); ph0 = f / N * math.tau
    for (x, y), (p0, p1, h) in BEAMS.items():
        o = h * 0.55
        Ib = 1 + 0.22 * math.sin(2 * ph0 + o) + 0.10 * math.sin(5 * ph0 + 1.7 + o) + 0.05 * math.sin(7 * ph0 + 0.4 + 2 * o)
        fpx[x, y] = tuple(max(0, min(255, round(p0[i] + (p1[i] - p0[i]) * Ib))) for i in range(4))
    for (x, y), (p0, w, h) in GLOW.items():
        k = 1 + (glow_factor(ph0, h) - 1) * w * 0.8
        fpx[x, y] = (max(0, min(255, round(p0[0] * k))), max(0, min(255, round(p0[1] * k))), max(0, min(255, round(p0[2] * (1 + (k - 1) * .6)))), 255)
    B = fpx
    im = fb.copy(); px = im.load()
    ph = f / N * math.tau
    I = 1.0 + 0.12 * math.sin(ph) + 0.05 * math.sin(ph * 3 + 1)      # flicker strength
    FX = 134 + round(math.sin(ph * 2 + .5)); FY = 167 + round(math.cos(ph * 2))
    R = 45 + 3 * math.sin(ph + 2)
    # 1. flames: same silhouette, colours re-rolled with a rising noise field
    for (x, y) in flame:
        h = (y - 100) / 75                                             # 0 top .. 1 floor
        v = h + 0.55 * (noise(x, y + f * 3, 2.3, 70) - .5) + 0.3 * (noise(x * 2, y + f * 5, 3.5, 71) - .5)
        v *= I
        c = FL[0] if v > .95 else FL[1] if v > .78 else FL[2] if v > .58 else FL[3] if v > .4 else FL[4]
        px[x, y] = c + (255,)
    # 2. firelight: a warm multiplicative tint (keeps every texture's own contrast -> no shimmer), warmer and stronger
    #    near the flames, soft-edged shadow from the open door leaf
    for y in range(90, H):
        for x in range(10, W):
            p = B[x, y]
            if p[3] < 255 or (x, y) in flame: continue
            dx, dy = x - FX, (y - FY) * (1.25 if y < FY else 0.9)
            d = math.hypot(dx, dy)
            k = max(0.0, 1 - d / R) ** 1.6 * I
            far = 0.16 * max(0.0, 1 - d / 120) ** 2 * I                 # faint warm spill that reaches further
            if x < 97: k *= 0.5 if x >= 38 else 0.3
            if 38 <= x <= 47 and 112 <= y <= 192: far *= 2.2             # the statue's right edge, facing the fire
            k = max(k, far)
            if y > FY + 2 and abs(dx) < 30: k *= 1.1
            if k <= 0.008: continue
            warm = min(1.0, k * 1.4)                                    # hue shifts warmer close to the fire
            L = (255 * min(1, .95 * k), 150 * min(1, .95 * k), 60 * min(1, .95 * k))   # light colour x strength
            r = 255 - (255 - p[0]) * (255 - L[0] * .85) / 255                       # screen blend: no flat clipping
            g = 255 - (255 - p[1]) * (255 - L[1] * .7) / 255
            b = p[2] * (1 - 0.35 * warm)
            px[x, y] = (min(255, round(r)), min(255, round(g)), max(0, round(b)), 255)
    frames.append(im)
# flag + bell, shared with the 100 % / 75 % strips
import importlib.util
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
here = os.path.dirname(os.path.abspath(__file__))
bell = load("bell", os.path.join(here, "bell.py"))
FX0, FY0, FX1, FY1 = 167, 60, 183, 78
cloth = {(x, y): B0[x, y] for y in range(FY0, FY1 + 1) for x in range(FX0, FX1 + 1) if B0[x, y][3] > 0}
def frame_flag(im, f):
    px = im.load(); ph = f / N * math.tau
    for k in cloth: px[k] = (0, 0, 0, 0)
    L = FX1 - FX0
    def dy(x):
        t = (x - FX0) / L; a = 0.3 + 1.45 * t
        return a * (math.sin(2 * ph - t * 4.4) * .8 + math.sin(3 * ph - t * 6.9 + 1.3) * .28)
    STAR = range(171, 178)
    for (x, y), p in cloth.items():
        d = dy(174) if x in STAR else dy(x); slope = dy(x + 1) - dy(x - 1); ny = y + round(d)
        sh = 1 - 0.14 * max(-1.0, min(1.0, slope))
        q = (min(255, round(p[0] * sh)), min(255, round(p[1] * sh)), min(255, round(p[2] * sh)), p[3])
        if 0 <= ny < H and (px[x, ny][3] == 0 or (x, ny) in cloth): px[x, ny] = q
for f, im in enumerate(frames): frame_flag(im, f)
if os.environ.get("ATTACK"):
    bell.ring(frames, base, N, 20.0, 1); out += "_attack"
else:
    bell.ring(frames, base, N, 0.0, 1)
# smoke: roof hole + out of the top of the doorway (drifts right with the wind, like the flag)
smoke = load("smoke", os.path.join(here, "smoke.py"))
if not os.environ.get("NO_SMOKE"):
    smoke.add_smoke(frames, N, [
        dict(x=62, y=78, rise=42, drift=18, r0=3.0, r1=10.0, puffs=8, strength=1.0, salt=11, loops=2),                # roof hole
        dict(x=7, y=107, rise=32, drift=13, r0=2.2, r1=8.0, puffs=8, strength=0.9, salt=37, loops=2),                 # top of the far-left window
        # front wall (sooty): slower than the roof
        dict(x=133, y=102, rise=46, drift=13, r0=3.0, r1=9.5, puffs=8, strength=1.35, salt=23, soot=True, loops=4),   # top of the doorway
        dict(x=105, y=120, rise=28, drift=8, r0=2.1, r1=5.5, puffs=6, strength=1.05, salt=41, soot=True, loops=3, phase=0.37, wob=0.9, wfreq=6.5, grain=1.8),   # tip of the front-left window: thin wisp
        dict(x=152, y=109, rise=36, drift=15, r0=2.2, r1=8.5, puffs=8, strength=1.1, salt=53, soot=True, loops=4, phase=0.71, wob=2.4, wfreq=3.2, grain=3.0),  # tip of the front-right window: fuller, bent by the wind at the corner
    ])



strip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
for i, fr in enumerate(frames): strip.paste(fr, (i * W, 0))
strip.save(out + f"_{N}f.png")
gk = load("gifkit", os.path.join(here, "gifkit.py"))
def bgc(fr, box=None, z=3):
    bg = Image.new("RGBA", (W, H), (24, 26, 40, 255)); bg.alpha_composite(fr); bg = bg.convert("RGB")
    if box: bg = bg.crop(box)
    return bg.resize((bg.width * z, bg.height * z), Image.NEAREST)
gk.save_gif([bgc(fr) for fr in frames], out + "_preview.gif", FPS)
gk.save_gif([bgc(fr, (60, 95, 184, 200), 4) for fr in frames], out + "_door.gif", FPS)
print("flame px", len(flame), "beam px", len(BEAMS), "glow px", len(GLOW), "cloth", len(cloth), "frames", N)
