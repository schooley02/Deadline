"""Base idle / under-attack strips (100 %, 75 %, ...): lantern swings on its pole bracket while it flickers; survivor flag blows in the wind.
Usage: python3 anim100.py <in.png> <out_prefix> [frames] [fps]"""
import sys, math
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 16
FPS = int(sys.argv[4]) if len(sys.argv) > 4 else 8
base = Image.open(src).convert("RGBA"); B = base.load(); W, H = base.size

# ---------- window beams (75 %): the light added between two working files, scaled per frame ----------
import os
BEAMS = {}
if os.environ.get("BEAM_V6"):
    v6 = Image.open(os.environ["BEAM_V6"]).convert("RGBA").load(); v7 = Image.open(os.environ["BEAM_V7"]).convert("RGBA").load()
    HOLES = [(8, 137), (6, 114), (63, 147), (54, 135), (107, 131), (151, 125)]   # broken panes the beams come from
    for y in range(H):
        for x in range(W):
            if v6[x, y] != v7[x, y] and B[x, y] == v7[x, y]:           # untouched beam pixel
                h = min(range(len(HOLES)), key=lambda i: (x - HOLES[i][0]) ** 2 + (y - HOLES[i][1]) ** 2)
                BEAMS[(x, y)] = (v6[x, y], v7[x, y], h)

def frame_beams(im, f):
    """one fire inside: every beam pulses together, each window a little out of step (different distance to the fire)"""
    if not BEAMS: return
    px = im.load(); ph = f / N * math.tau
    for (x, y), (p0, p1, h) in BEAMS.items():
        o = h * 0.55
        I = 1 + 0.22 * math.sin(2 * ph + o) + 0.10 * math.sin(5 * ph + 1.7 + o) + 0.05 * math.sin(7 * ph + 0.4 + 2 * o)
        px[x, y] = tuple(max(0, min(255, round(p0[i] + (p1[i] - p0[i]) * I))) for i in range(4))

# ---------- lantern ----------
LX0, LX1, LY0, LY1 = 163, 169, 134, 146          # lantern body + cap (left of the pole at x 170-171)
PIV = (167.5, 133.0)                              # hook under the new bracket
lantern = {}
for y in range(LY0, LY1 + 1):
    for x in range(LX0, LX1 + 1):
        p = B[x, y]
        if p[3] == 255 and x >= 164: lantern[(x, y)] = p
halo = {}                                         # see-through glow pixels around the lantern
for y in range(126, 160):
    for x in range(158, 184):
        p = B[x, y]
        if 0 < p[3] < 255 and (x, y) not in BEAMS: halo[(x, y)] = p
glass = {k for k, p in lantern.items() if p[0] > 200 and p[1] > 120}
BRACKET = [(168, 133), (169, 133), (167, 134)]   # short iron arm off the pole + hook link
IRON = (31, 13, 14, 255)

def lit_weight(x, y, p):
    """how much of this pixel's warmth comes from the lantern (warm, near it)"""
    d = math.hypot(x - 166.5, (y - 141) * 0.8)
    if d > 30 or p[3] < 255: return 0.0
    warm = max(0.0, (p[0] - p[2]) / 140)
    return min(1.0, warm) * max(0.0, 1 - d / 30) ** 1.2

def frame_lantern(im, f):
    px = im.load(); ph = f / N * math.tau
    ang = math.radians(7.0) * math.sin(ph)                          # one slow swing per loop
    I = 1.0 + 0.09 * math.sin(ph * 3 + 0.7) + 0.05 * math.sin(ph * 7 + 2.1) + 0.03 * math.sin(ph * 5)
    # 1. clear old lantern + halo
    for (x, y) in list(lantern) + list(halo):
        px[x, y] = (0, 0, 0, 0) if x >= 163 or B[x, y][3] < 255 else B[x, y]
    for (x, y), p in halo.items():
        if x < 163: px[x, y] = (0, 0, 0, 0)
    # 2. (removed) no flicker on the surfaces it lights: per-pixel brightening shimmered on the sandbags
    # 3. halo, shifted with the lantern's centre and scaled by I
    cx, cy = 166.5 - PIV[0], 140 - PIV[1]
    sx = cx * math.cos(ang) - cy * math.sin(ang) + PIV[0] - 166.5
    hs = round(1.2 * math.sin(ph))
    for (x, y), p in halo.items():
        nx = x + hs
        if 0 <= nx < W and px[nx, y][3] == 0:
            px[nx, y] = p[:3] + (max(0, min(255, round(p[3] * I))),)
    # 4. lantern swing: hook + cap fixed, body shifts a whole pixel (rotation breaks a sprite this small)
    o = round(1.2 * math.sin(ph))
    for (x, y), p in lantern.items():
        nx = x + (o if y >= 138 else 0)
        if (x, y) in glass:
            p = (min(255, round(p[0] * (1 + .4 * (I - 1)))), min(255, round(p[1] * I)), min(255, round(p[2] * I)), 255)
        if nx in (170, 171) and B[nx, y][3] == 255: continue            # pole stays in front
        px[nx, y] = p
    if o:                                                               # side bars lean to join cap and body
        for (x, y), p in lantern.items():
            if y == 137 and (x + o, y) not in lantern and px[x + o, y][3] == 0: px[x + o, y] = p
    for (x, y) in BRACKET: px[x, y] = IRON

# ---------- flag ----------
FX0, FY0, FX1, FY1 = 167, 60, 183, 76           # cloth (pole at x 166)
cloth = {(x, y): B[x, y] for y in range(FY0, FY1 + 1) for x in range(FX0, FX1 + 1) if B[x, y][3] > 0}

def frame_flag(im, f):
    px = im.load(); ph = f / N * math.tau
    for k in cloth: px[k] = (0, 0, 0, 0)
    L = FX1 - FX0
    def dy(x):
        t = (x - FX0) / L
        a = 0.3 + 1.45 * t                                          # free end moves most
        return a * (math.sin(2 * ph - t * 4.4) * .8 + math.sin(3 * ph - t * 6.9 + 1.3) * .28)
    STAR = range(171, 178)                                          # star moves as one piece (no tearing)
    for (x, y), p in cloth.items():
        d = dy(174) if x in STAR else dy(x); slope = dy(x + 1) - dy(x - 1)
        ny = y + round(d)
        shade = 1 - 0.14 * max(-1.0, min(1.0, slope))              # folds catch / lose light
        q = (min(255, round(p[0] * shade)), min(255, round(p[1] * shade)), min(255, round(p[2] * shade)), p[3])
        if 0 <= ny < H and (px[x, ny][3] == 0 or (x, ny) in cloth): px[x, ny] = q
    # fill 1-px gaps a stretched column can open
    for x in range(FX0, FX1 + 1):
        col = [y for y in range(FY0 - 4, FY1 + 5) if (x, y) not in cloth and px[x, y][3] == 0
               and px[x, y - 1][3] > 0 and px[x, y + 1][3] > 0 and px[x, y - 1][0] > px[x, y - 1][2]
               and px[x, y + 1][0] > px[x, y + 1][2]]
        for y in col: px[x, y] = px[x, y - 1]

frames = []
for f in range(N):
    im = base.copy(); frame_beams(im, f); frame_flag(im, f); frame_lantern(im, f); frames.append(im)
from bell import ring
if os.environ.get("ATTACK"):
    ring(frames, base, N, float(os.environ.get("BELL_AMP", 20)), int(os.environ.get("BELL_SWINGS", 1)))
    out += "_attack"
else:
    ring(frames, base, N, 0.0, 1)        # idle: the same bell hanging still under the roof point
strip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
for i, fr in enumerate(frames): strip.paste(fr, (i * W, 0))
strip.save(out + f"_{N}f.png")
def gif(frs, name, box, z):
    g = []
    for fr in frs:
        bg = Image.new("RGBA", (W, H), (24, 26, 40, 255)); bg.alpha_composite(fr)
        c = bg.crop(box); g.append(c.convert("RGB").resize((c.width * z, c.height * z), Image.NEAREST))
    from gifkit import save_gif; save_gif(g, name, FPS)
gif(frames, out + "_preview.gif", (0, 0, W, H), 3)
gif(frames, out + "_closeup.gif", (130, 50, 184, 175), 6)
if os.environ.get("ATTACK"): gif(frames, out + "_bell.gif", (84, 2, 138, 58), 8)
print("frames", N, "lantern px", len(lantern), "halo", len(halo), "cloth", len(cloth))
