"""Hospital T1 (abandoned) from the no-ambulance T3 base. Stages: rough | final."""
import sys, os, numpy as np, random, colorsys
from PIL import Image, ImageFilter
import fx, graffiti

STAGE = sys.argv[1]
OUT = np.array([28, 29, 32.]); IR = np.array([26, 26, 29.])
rnd = np.random.default_rng(31)
b = np.asarray(Image.open('t2_base.png').convert('RGBA')).astype(float)
g0 = np.asarray(Image.open('hospital_layout_guide_176x144.png').convert('RGBA'))
o = b.copy()

def P(x, y, c, a=255):
    if 0 <= x < 176 and 0 <= y < 144:
        o[y, x, :3] = c; o[y, x, 3] = a

FRg = (60, 47, 39)
def smash(x0, y0, x1, y1, seed):
    """Black hole with jagged shards left along the frame."""
    r = random.Random(seed)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if tuple(g0[y, x, :3]) in (FRg, (30, 31, 34)): continue
            P(x, y, np.array([14, 16, 20.]) + r.uniform(0, 4))
    W, H = x1 - x0 + 1, y1 - y0 + 1
    for _ in range(r.randint(4, 7)):        # shards: triangles from the edges
        side = r.choice('tblr'); L = r.randint(2, max(3, min(W, H) // 2))
        if side == 't': ax, ay, dx, dy = r.randint(x0, x1), y0, 0, 1
        elif side == 'b': ax, ay, dx, dy = r.randint(x0, x1), y1, 0, -1
        elif side == 'l': ax, ay, dx, dy = x0, r.randint(y0, y1), 1, 0
        else: ax, ay, dx, dy = x1, r.randint(y0, y1), -1, 0
        base = r.randint(2, 4)
        for k in range(L):
            half = max(0, round(base * (1 - k / L)))
            for s in range(-half, half + 1):
                x = ax + dx * k + (s if dy else 0); y = ay + dy * k + (s if dx else 0)
                if x0 <= x <= x1 and y0 <= y <= y1 and tuple(g0[y, x, :3]) not in (FRg, (30, 31, 34)):
                    P(x, y, (66, 78, 88) if k % 2 else (96, 110, 118))

# ---- every window, the transom, the entrance and the ER door smashed
for i, cx in enumerate((47, 70, 93)): smash(cx - 5, 54, cx + 4, 69, 10 + i)
for i, cx in enumerate((44, 96)): smash(cx - 5, 108, cx + 4, 123, 20 + i)
smash(63, 100, 80, 106, 30); smash(64, 110, 79, 139, 31)
for y in range(109, 140):
    for x in range(114, 126):
        if x in (119, 120): o[y, x, :3] = [30, 30, 33]
        else: P(x, y, np.array([14, 16, 20.]) + rnd.uniform(0, 4))
for (x0, x1) in ((114, 118), (121, 125)):
    for k in range(6):
        for x in range(x0, x0 + max(1, 4 - k)): P(x, 109 + k, (96, 110, 118) if k % 2 else (66, 78, 88))
        P(x1, 130 + k, (66, 78, 88)); P(x1 - 1, 133 + k // 2, (96, 110, 118))
# glass shards on the ground under the entrance
for _ in range(10): P(int(rnd.integers(60, 84)), int(rnd.integers(140, 144)), (96, 110, 118))

# ---- ER lamp off, ER sign: E faded, R mostly gone
for x in range(118, 122): P(x, 107, (50, 48, 46))
band = o[95, 150, :3].copy()
for y in range(94, 101):
    for x in range(136, 148):
        if tuple(g0[y, x, :3]) == (150, 52, 44):
            if x >= 143 and not (y >= 98 and x <= 144):           # R gone except a stub
                o[y, x, :3] = o[y, x - 7 if x - 7 >= 136 else x, :3] * 0 + band * 0.92 + rnd.normal(0, 3, 3)
            else:
                o[y, x, :3] = o[y, x, :3] * 0.4 + np.array([104, 78, 66.]) * 0.6

# ---- cross sign: dark, tilted ~8 deg, one leg snapped (drawn in code)
o[0:28, 54:90, 3] = 0
ang = np.radians(-8); ca, sn = np.cos(ang), np.sin(ang)
SCX, SCY = 70.5, 17.5
for y in range(2, 30):
    for x in range(54, 90):
        dx, dy = x - SCX, y - SCY
        u = dx * ca + dy * sn; v = -dx * sn + dy * ca
        if abs(u) <= 12 and abs(v) <= 9.6:
            if abs(u) > 11 or abs(v) > 8.6: c = (24, 26, 28)
            elif (abs(u) <= 2.6 and abs(v) <= 7) or (abs(u) <= 7.6 and abs(v) <= 2.6): c = (58, 82, 66) if (x + y) % 5 else (66, 90, 72)
            else: c = (20, 24, 23) if v > -7 else (32, 38, 35)
            P(x, y, np.array(c, float) + rnd.normal(0, 2, 3))
# legs: left one reaches the roof, right one snapped short and bent
for y in range(26, 28): P(61, y, IR); P(60, y, IR)
P(79, 26, IR); P(80, 27, IR); P(82, 27, IR)

# ---- crumbled cornice corner: jagged, chunky break (code)
cr = random.Random(11)
prof = {}
d = 0.0
for x in range(92, 115):
    tgt = 22 * ((x - 92) / 22) ** 1.3
    if cr.random() < 0.45: d = tgt + cr.choice([-4, -3, -2, 2, 3, 4])    # chunky steps
    else: d = max(0, d + cr.choice([-1, 0, 0, 1]) * 0.5 + (tgt - d) * 0.25)
    prof[x] = max(0, int(round(d)))
prof[93] = 0; prof[94] = 1
crm = np.zeros((144, 176), bool)
for x, dd in prof.items():
    for y in range(26, 28 + dd):
        if b[y, x, 3] > 0: o[y, x, 3] = 0; crm[y, x] = True
for x, dd in prof.items():
    yb = 28 + dd
    if dd == 0 or b[yb, x, 3] == 0: continue
    P(x, yb, (34, 32, 30))                                # broken edge outline
    for k in range(1, cr.randint(2, 4)): P(x, yb + k, (104, 98, 86) if k == 1 else (84, 78, 68))   # torn plaster
    if cr.random() < 0.5:                                  # exposed brick under the plaster
        for k in range(cr.randint(2, 5)):
            yy = yb + 2 + k
            P(x, yy, (96, 58, 42) if (x + yy) % 4 else (70, 62, 56))
# side faces of the chunks (vertical steps) get an outline so the break reads in 3D
for x in range(93, 114):
    a1, a2 = prof.get(x, 0), prof.get(x + 1, 0)
    if abs(a1 - a2) >= 2:
        xs = x if a1 > a2 else x + 1
        for y in range(28 + min(a1, a2), 28 + max(a1, a2)):
            if b[y, xs, 3] > 0 and o[y, xs, 3] > 0: P(xs, y, (40, 37, 34))
# cracks radiating down-left from the break
for (sx, sy, L) in [(100, 36, 9), (106, 42, 12), (110, 48, 8)]:
    x, y = sx, sy
    for k in range(L):
        if o[y, x, 3] > 0: P(x, y, (52, 50, 46))
        x -= cr.choice([0, 1, 1]); y += 1
# loose fragments in the air near the corner + one on the cornice

# rubble chunks on the ER wing roof
for (x, y, w) in [(114, 86, 3), (118, 86, 2), (121, 86, 2), (125, 86, 1)]:
    for dx in range(w): P(x + dx, y, (126, 118, 102)); P(x + dx, y - 1, (100, 94, 82)) if dx < w - 1 else None
mask_c = np.zeros((144, 176), np.uint8); mask_c[26:52, 94:116] = 255; mask_c[83:88, 112:128] = 255

# ---- dead shrubs: mask for an inpaint of bare twigs
mask_s = np.zeros((144, 176), np.uint8)
for (x0, x1, yt) in [(26, 41, 122), (83, 110, 121)]:
    mask_s[yt:144, x0:x1 + 1] = 255
    for y in range(yt, 141):
        for x in range(x0, x1 + 1):
            c = o[y, x, :3] / 255
            if c[1] > c[0] + 0.02 and c[1] > c[2]:           # shrub pixels -> dry grey-brown rough
                o[y, x, :3] = np.array([78, 66, 54.]) * (0.7 + 0.5 * c.mean())

# ---- bench: one slat broken
for x in range(48, 56): o[133, x, :3] = o[131, x, :3]; o[134, x, :3] = o[131, x, :3]
P(48, 134, (66, 50, 38)); P(49, 135, (66, 50, 38))


# ---- broken fire escape
IRON_G = {(26, 26, 29), (46, 46, 50)}
def wallc(x, y):
    return (np.array([58, 64, 60.]) + rnd.normal(0, 3, 3)) if x >= 10 else None
def clear(x, y):
    if x < 10: o[y, x, 3] = 0
    else: o[y, x, :3] = wallc(x, y)
fe = [(y, x) for y in range(66, 133) for x in range(0, 27) if tuple(g0[y, x, :3]) in IRON_G]
# lower landing: outer half (x <= 13) collapses
for (y, x) in fe:
    if 108 <= y <= 125 and x <= 13: clear(x, y)
for x in range(1, 15):          # sagging platform + rail
    t = (14 - x) / 13
    yp = 122 + round(7 * t ** 1.3); yr = 110 + round(9 * t ** 1.2)
    P(x, yp, IR); P(x, yp + 1, IR)
    P(x, yr, IR)
    if x % 3 == 2 and x not in (5, 8):
        for y in range(yr, yp): P(x, y, IR)
P(3, yp + 2, IR); P(2, yp + 3, IR)          # bent end
# stairs: a section has fallen out (rows 92..101), broken ends dangling
for (y, x) in fe:
    if 92 <= y <= 101 and 6 <= x <= 16: clear(x, y)
for k in range(4): P(10 + k // 2, 91 + k, IR)
P(12, 103, IR); P(11, 104, IR)
# upper landing: rail end snapped, one bar bent
for (y, x) in fe:
    if y == 68 and x <= 6: clear(x, y)
    if 69 <= y <= 79 and x == 5: clear(x, y)
for k in range(5): P(5 - k // 2, 69 + k, IR)
P(1, 69, IR); P(2, 70, IR)
# drop ladder hanging crooked from one side
for (y, x) in fe:
    if y >= 124 and 19 <= x <= 25: clear(x, y)
for k in range(10):
    P(20 + k // 3, 124 + k, IR); P(24 + k // 2, 124 + k, IR)
    if k % 2 == 1: 
        for xx in range(20 + k // 3, 25 + k // 2): P(xx, 124 + k, IR)

# ---- trash + debris at the foot of the ER wing (rough for an inpaint), all inside the canvas
mask_t = np.zeros((144, 176), np.uint8)
def lump(cx, rx, h, col, col2, seed):
    r = random.Random(seed)
    for x in range(int(cx - rx), int(cx + rx) + 1):
        t = abs(x - cx) / rx
        top = 142 - round(h * (1 - t * t) ** 0.6) + r.choice([0, 0, 1])
        for y in range(top, 143):
            P(x, y, OUT if y == top else (col if y < top + 2 else col2)); mask_t[y, x] = 255
        P(x, 142, (22, 22, 22)); mask_t[142, x] = 255
lump(133, 5, 7, (44, 48, 44), (30, 32, 30), 1)          # trash bags
lump(141, 4, 5, (36, 38, 36), (26, 28, 26), 2)
lump(161, 5, 6, (46, 50, 46), (32, 34, 32), 3)
for y in range(135, 143):                                # tipped metal bin, resting on the ground
    for x in range(147, 156):
        if y - 135 <= (x - 147) * 0.9 + 2:
            P(x, y, OUT if x == 147 or y == 142 else ((92, 94, 94) if (x + y) % 3 else (72, 74, 74))); mask_t[y, x] = 255
for x in range(165, 171):                                # flattened cardboard lying on the ground
    P(x, 140, OUT); P(x, 141, (122, 98, 66)); P(x, 142, (96, 76, 52)); mask_t[140:143, x] = 255
for (x, y) in [(128, 141), (144, 142), (157, 141), (172, 141), (138, 137)]:   # rubble + paper
    P(x, y, (150, 146, 136)); P(x + 1, y, (110, 106, 98)); P(x, y + 1, OUT); mask_t[y:y + 2, x:x + 2] = 255
o[143, 112:174, :3] = np.minimum(o[143, 112:174, :3], 40)        # ground contact shadow line

if STAGE == 'rough':
    Image.fromarray(o.astype('uint8')).save('t1_rough.png')
    Image.fromarray(mask_c).save('t1_mask_crumble.png')
    Image.fromarray(mask_s).save('t1_mask_shrubs.png')
    Image.fromarray(mask_t).filter(ImageFilter.MaxFilter(7)).save('t1_mask_trash.png')
    bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
    bg.resize((704, 576), Image.NEAREST).save('t1_rough_4x.png')
    sys.exit()

# ================= final =================
def take(fn, mfile):
    if not os.path.exists(fn): return
    ai = np.asarray(Image.open(fn).convert('RGBA')).astype(float)
    mk = np.asarray(Image.open(mfile).convert('L')) > 0
    white = ai[..., :3].min(2) > 226
    use = mk & ~white
    if 'crumble' in fn:
        ra = np.asarray(Image.open('t1_rough.png').convert('RGBA'))[..., 3] > 0
        use &= ra                                   # keep the broken silhouette (sky stays open)
    o[use, :3] = ai[use, :3]; o[use, 3] = 255
    if '_fe_' in fn:
        ra = np.asarray(Image.open('t1_rough.png').convert('RGBA'))[..., 3] > 0
        o[mk & white & ~ra, 3] = 0
take('t1_shrubs_inp.png', 't1_mask_shrubs.png')
take('t1_trash_inp.png', 't1_mask_trash.png')
take('t1_fe_inp.png', 't1_mask_fe.png')

# chain on the ER door kept from T2
for x in range(115, 125):
    y = 123 + (1 if (x - 115) in (4, 5) else 0)
    P(x, y, (86, 84, 82) if x % 2 else (58, 56, 54))
for y in range(125, 129):
    for x in range(119, 122): P(x, y, (96, 74, 46) if y > 125 else (80, 78, 76))

# grime: heaviest -- blotches, mold, drips, rising damp
for _ in range(110):
    x = rnd.integers(12, 172); y = rnd.integers(32, 142); r = rnd.integers(2, 6)
    mold = rnd.random() < 0.35
    for yy in range(y - r, y + r + 1):
        for xx in range(x - r, x + r + 1):
            if 0 <= xx < 176 and 0 <= yy < 144 and o[yy, xx, 3] > 0 and ((xx - x) ** 2 + (yy - y) ** 2) <= r * r and rnd.random() < 0.6:
                if 50 < o[yy, xx, :3].mean() < 210:
                    o[yy, xx, :3] = o[yy, xx, :3] * (np.array([0.78, 0.84, 0.76]) if mold else 0.86)
for sy in (40, 74, 92, 104, 126):
    for x in range(12, 172, 2):
        if rnd.random() < 0.5:
            for k in range(rnd.integers(2, 12)):
                y = sy + k
                if y < 144 and o[y, x, 3] > 0 and 50 < o[y, x, :3].mean() < 210: o[y, x, :3] *= 0.85
for y in range(124, 144):
    for x in range(10, 174):
        if o[y, x, 3] > 0 and 40 < o[y, x, :3].mean() < 210 and rnd.random() < (y - 124) / 24:
            o[y, x, :3] *= np.array([0.86, 0.9, 0.84])
# rust on the dumpster
for _ in range(30):
    x = int(rnd.integers(4, 26)); y = int(rnd.integers(124, 141))
    if o[y, x, 3] > 0: o[y, x, :3] = [86, 56, 38] if rnd.random() < 0.6 else [64, 44, 32]

# darkest pass (sat x0.78, value x0.84 on top of the T2-level dulling)
rgb = o[..., :3] / 255
mean = rgb.mean(2, keepdims=True)
rgb = mean + (rgb - mean) * 0.62
o[..., :3] = np.clip(rgb * 0.72 * 255, 0, 255)

# graffiti kept (older, faded): after the colour pass so it still reads
graffiti.hand_text(o, 'DEAD', 133, 111, 12, 7.5, 9.6, 1.9, (138, 46, 38), -8, seed=3, drips=0.55)
graffiti.hand_text(o, 'HELP US', 134, 128, 6.5, 4.0, 5.6, 1.15, (140, 136, 126), -6, seed=8, drips=0.2, jit=0.5)
# graffiti weathered: knock out a few pixels
for y in range(104, 140):
    for x in range(128, 174):
        c = o[y, x, :3]
        if (c[0] > 120 and c[0] > c[1] + 50) or (c.min() > 115 and c.max() - c.min() < 20):
            if rnd.random() < 0.18: o[y, x, :3] = c * 0.6

o = np.clip(o, 0, 255)
Image.fromarray(o.astype('uint8')).save('hospital_t1_draft_176x144.png')
a = o[o[..., 3] > 200][:, :3] / 255
print('V', a.max(1).mean() * 255)
bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
bg.resize((704, 576), Image.NEAREST).save('t1_4x.png')
