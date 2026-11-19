"""Hospital T4 (hardened) from the T3 base. Stage 'rough' builds code roughs + masks; stage 'final' composites inpaints + code details + glow."""
import sys, os, numpy as np, random
from PIL import Image, ImageFilter
import fx

STAGE = sys.argv[1]
OUT = np.array([28, 29, 32.])
IR = np.array([26, 26, 29.])
rnd = np.random.default_rng(14)
b = np.asarray(Image.open('t4_base.png').convert('RGBA')).astype(float)
o = b.copy()

def P(x, y, c, a=255):
    o[y, x, :3] = c; o[y, x, 3] = a

# --- upper-left window lit (copy the middle window's glass)
o[54:70, 42:52, :3] = b[54:70, 65:75, :3]

# --- nurse rough in the middle window (glass x 65..74, rows 54..69)
def nurse_rough():
    SK = np.array([186, 142, 112.]); HR = np.array([58, 40, 32.]); SC = np.array([72, 122, 118.]); SC2 = np.array([54, 96, 94.])
    for y in range(56, 63):
        for x in range(68, 73):
            d = ((x - 70) / 2.6) ** 2 + ((y - 59.5) / 3.6) ** 2
            if d <= 1: P(x, y, HR if (y < 58 or x in (68, 72)) else SK)
    P(69, 59, (60, 44, 38)); P(71, 59, (60, 44, 38))       # eyes (dark, no whites)
    P(70, 61, (150, 104, 84))
    for y in range(63, 70):
        for x in range(66, 75):
            if abs(x - 70) <= 2 + (y - 63) * 1.2:
                P(x, y, SC if x >= 70 else SC2)
    P(70, 63, SK); P(70, 64, (54, 96, 94))                  # v-neck
nurse_rough()
mask_n = np.zeros((144, 176), np.uint8); mask_n[55:70, 65:75] = 255

# --- generator: the old T4 generator enlarged (rough for an inpaint), x 1..27
for y in range(125, 144):
    for x in range(0, 10): o[y, x, 3] = 0
gen = np.asarray(Image.open('gen_up.png').convert('RGBA')).astype(float)
GX, GY = 1, 144 - gen.shape[0]
gm = gen[..., 3] > 0
reg = o[GY:GY + gen.shape[0], GX:GX + gen.shape[1]]; reg[gm] = gen[gm]
mask_g = np.zeros((144, 176), np.uint8); mask_g[GY:GY + gen.shape[0], GX:GX + gen.shape[1]][gm] = 255
FX1, TOP = 27, GY + 10

# --- sandbag rough where the bench was (x 39..58, rows 126..143)
SB = np.array([150, 132, 98.]); SB2 = np.array([118, 102, 76.])
bags = []
for (y0, xs, w) in [(138, range(39, 59, 7), 7), (132, range(42, 57, 6), 6), (127, range(44, 54, 5), 5)]:
    for x0 in xs: bags.append((x0, y0, min(w, 59 - x0)))
mask_s = np.zeros((144, 176), np.uint8)
for (x0, y0, w) in bags:
    h = 6
    for y in range(y0, min(y0 + h, 144)):
        for x in range(x0, x0 + w):
            ex = ((x - (x0 + w / 2 - .5)) / (w / 2)) ** 2 + ((y - (y0 + h / 2 - .5)) / (h / 2)) ** 2
            if ex <= 1.15:
                P(x, y, SB if y < y0 + 3 else SB2); mask_s[y, x] = 255
            if 0.75 < ex <= 1.15: P(x, y, (70, 60, 46))

if STAGE == 'rough':
    Image.fromarray(o.astype('uint8')).save('t4_rough.png')
    Image.fromarray(mask_n).save('t4_mask_nurse.png')
    m = Image.fromarray(mask_s).filter(ImageFilter.MaxFilter(9)); m.save('t4_mask_sand.png')
    Image.fromarray(mask_g).filter(ImageFilter.MaxFilter(5)).save('t4_mask_gen.png')
    bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
    bg.resize((704, 576), Image.NEAREST).save('t4_rough_4x.png')
    sys.exit()

# ================= final =================
def take(fn, mfile):
    ai = np.asarray(Image.open(fn).convert('RGBA')).astype(float)
    mk = np.asarray(Image.open(mfile).convert('L')) > 0
    white = ai[..., :3].min(2) > 228
    use = mk & ~white
    o[use, :3] = ai[use, :3]; o[use, 3] = 255

if os.path.exists('t4_nurse_inp.png'): take('t4_nurse_inp.png', 't4_mask_nurse.png')
if os.path.exists('t4_sand_inp.png'): take('t4_sand_inp.png', 't4_mask_sand.png')
if os.path.exists('t4_gen_inp.png'): take('t4_gen_inp.png', 't4_mask_gen.png')
# nurse: white uniform (teal -> white by brightness) + white cap
for y in range(60, 70):
    for x in range(65, 75):
        r_, g_, b_ = o[y, x, :3]
        if g_ > r_ + 12 and b_ > r_ + 8:
            L = (g_ + b_) / 2
            o[y, x, :3] = np.array([226, 222, 212.]) * (0.55 + 0.45 * min(L / 86, 1))
for x in range(67, 74): P(x, 55, (222, 218, 208))
for x in range(68, 73): P(x, 54, (236, 232, 222))
P(67, 54, (40, 34, 30)); P(73, 54, (40, 34, 30)); P(73, 55, (150, 146, 138))
P(70, 55, (170, 60, 54))   # small red cross on the cap
# cable: generator -> up the front-left corner -> into the wall under the roofline
gtop = next(y for y in range(110, 144) if o[y, 25, 3] > 0 and o[y, 25, :3].mean() > 40)


# --- bars on both ground windows (glass x 37..50 / 89..102, rows 106..125)
for cx in (44, 96):
    x0, x1 = cx - 7, cx + 6
    for x in range(x0 + 1, x1, 3):
        for y in range(106, 126):
            P(x, y, IR if (y + x) % 9 else (70, 50, 36))
    for x in range(x0, x1 + 1):
        P(x, 107, IR); P(x, 124, IR)

# --- razor wire along the main roof (two twisting strands + barbs), skipping the sign legs
def coils(xa, xb, ybase, ry=3.1, rx=2.5, step=4.2, seed=1, slope=0.0):
    r = random.Random(seed)
    x = xa + rx
    while x <= xb - rx + 0.5:
        cx = x + r.uniform(-0.4, 0.4); yb = ybase + slope * (cx - xa)
        cy = yb - ry + r.uniform(-0.3, 0.3); rxx = rx + r.uniform(-0.3, 0.4); ryy = ry + r.uniform(-0.3, 0.5)
        for k in range(48):
            t = k / 48 * 2 * np.pi
            px_, py_ = int(round(cx + rxx * np.cos(t))), int(round(cy + ryy * np.sin(t)))
            if not (0 <= px_ < 176 and 0 <= py_ < 144): continue
            s_ = np.sin(t)
            if s_ > 0.35 and r.random() < 0.6: continue
            c = (156, 156, 152) if s_ < -0.6 else ((86, 86, 88) if s_ > 0.35 else (120, 120, 118))
            if r.random() < 0.08: continue
            P(px_, py_, c)
        x += step + r.uniform(-0.6, 0.6)
coils(27, 57, 27, seed=3)
coils(84, 113, 27, seed=9)
# side wall top edge (recedes: drops ~5 px over 18)
coils(11, 27, 32, ry=2.7, rx=2.2, step=3.8, seed=5, slope=-5/17)

# --- ER doors warmer inside
for y in range(110, 140):
    for x in range(115, 125):
        if o[y, x, :3].mean() > 120: o[y, x, :3] = np.minimum(o[y, x, :3] * np.array([1.06, 1.04, 0.98]), 255)

# --- ambulance lights ON
amb = np.asarray(Image.open('amb2_mask.png').convert('L')) > 0
for y in range(111, 120):
    for x in range(126, 176):
        if not amb[y, x]: continue
        r, g, bl = o[y, x, :3]
        if r > 110 and r > g * 1.6 and r > bl * 1.6: o[y, x, :3] = [236, 64, 52]
        elif bl > 90 and bl > r * 1.35 and bl > g * 1.15: o[y, x, :3] = [80, 120, 236]
# find light pixel centres for glow
reds = np.argwhere((o[..., 0] == 236) & (o[..., 1] == 64))
blues = np.argwhere((o[..., 2] == 236) & (o[..., 0] == 80))

# ER sign: letters lit, band warmed around them
ER = [(x, y) for y in range(94, 101) for x in range(136, 148) if o[y, x, 0] > o[y, x, 1] + 25]
for (x, y) in ER: o[y, x, :3] = [196, 66, 52]
for y in range(92, 103):
    for x in range(114, 172):
        o[y, x, :3] = np.minimum(o[y, x, :3] * 1.04, 255)
# colour pass (brighter than T3), before glow
rgb = o[..., :3]
o[..., :3] = np.clip(rgb * 1.03 + 1, 0, 255)

import props as _pp
if o[126, 137, 3] > 0 and o[120:132, 128:152, :3].min(2).mean() > 100: pass
Image.fromarray(np.clip(o,0,255).astype('uint8')).save('t4_preglow.png')
# --- glow (fixtures only)
G = (59, 7, 82, 26)
fx.glow_round(o, 0, 0, 10, (150, 230, 170), k0=0.5, cap=120, box=G, skip_inside=True)
fx.glow_cone(o, 120, 108, 30, 0.65, (255, 214, 150), k0=0.95)
for (y, x) in reds[::2]: fx.glow_round(o, x, y, 7, (255, 80, 64), k0=0.22, cap=90)
for (y, x) in blues[::2]: fx.glow_round(o, x, y, 7, (90, 130, 255), k0=0.22, cap=90)
for (x, y) in ER: fx.glow_round(o, x, y, 6, (255, 128, 100), k0=0.07, cap=60)
for (x, y) in ER: o[y, x, :3] = [200, 70, 56]
fx.glow_round(o, 0, 0, 5, (255, 110, 90), k0=0.16, cap=70, box=(113, 91, 172, 103), skip_inside=True)
fx.glow_round(o, 20, 128, 3, (120, 255, 140), k0=0.35, cap=70)
o = np.clip(o, 0, 255)
# keep glow 2 px inside the right edge
pre = np.asarray(Image.open('t4_preglow.png').convert('RGBA'))
for x in range(172, 176):
    for y in range(144):
        if pre[y, x, 3] == 0: o[y, x, 3] = 0
Image.fromarray(o.astype('uint8')).save('hospital_t4_draft_176x144.png')
a = o[o[..., 3] > 200][:, :3] / 255
print('V', a.max(1).mean() * 255)
bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
bg.resize((704, 576), Image.NEAREST).save('t4_4x.png')
