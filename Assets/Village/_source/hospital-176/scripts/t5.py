"""Hospital T5 (stronghold) from the T4 pre-glow. Stages: rough | final."""
import sys, os, numpy as np, random
from PIL import Image, ImageFilter
import fx

STAGE = sys.argv[1]
OUT = np.array([28, 29, 32.]); IR = np.array([26, 26, 29.])
rnd = np.random.default_rng(55)
b = np.asarray(Image.open('t4_preglow.png').convert('RGBA')).astype(float)
o = b.copy()

def P(x, y, c, a=255):
    if 0 <= x < 176 and 0 <= y < 144:
        o[y, x, :3] = c; o[y, x, 3] = a

def ellmask(shapes, dil):
    m = np.zeros((144, 176), np.uint8)
    for (x0, y0, w, h) in shapes:
        for y in range(y0, min(y0 + h, 144)):
            for x in range(x0, x0 + w):
                ex = ((x - (x0 + w / 2 - .5)) / (w / 2)) ** 2 + ((y - (y0 + h / 2 - .5)) / (h / 2)) ** 2
                if ex <= 1.15: m[y, x] = 255
    return m

# ---------- roughs ----------
# 1. helicopter on the ER roof (old T5 helicopter enlarged)
heli = Image.open('old_heli.png').convert('RGBA')
heli = heli.resize((56, 30), Image.NEAREST)
ha = np.asarray(heli).astype(float)
HX, HY = 116, 87 - 30
hm = ha[..., 3] > 0
reg = o[HY:HY + 30, HX:HX + 56]; reg[hm] = ha[hm]
mask_h = np.zeros((144, 176), np.uint8); mask_h[HY:HY + 30, HX:HX + 56][hm] = 255

# 2. ambulance rear doors open + medic at the ER door
DW = np.array([170, 170, 164.]); DW2 = np.array([132, 132, 128.])
for y in range(116, 139):
    for x in range(121, 127):
        P(x, y, DW if x < 125 else DW2)
for y in range(116, 139): P(120, y, OUT); P(127, y, (40, 44, 46))
for x in range(120, 128): P(x, 115, OUT); P(x, 139, OUT)
for x in range(121, 127): P(x, 130, (140, 44, 40)); P(x, 131, (140, 44, 40)); P(x, 132, (46, 70, 128))
for y in range(119, 126):
    for x in range(122, 125): P(x, y, (54, 64, 72))          # door window
mask_d = np.zeros((144, 176), np.uint8); mask_d[114:141, 119:129] = 255
# medic (rough figure ~28 px tall) in front of the ER door, x 112..120
SK = np.array([150, 108, 82.]); HR = np.array([34, 28, 26.]); TE = np.array([62, 116, 112.]); TE2 = np.array([46, 90, 88.])
cx = 116
for y in range(113, 119):
    for x in range(cx - 2, cx + 3):
        d = ((x - cx) / 2.6) ** 2 + ((y - 115.8) / 3.2) ** 2
        if d <= 1: P(x, y, HR if y < 115 else SK)
P(cx - 1, 116, (40, 30, 26)); P(cx + 1, 116, (40, 30, 26))
for y in range(119, 132):
    w = 3 if y < 121 else 4
    for x in range(cx - w, cx + w + 1): P(x, y, TE if x >= cx else TE2)
for y in range(121, 130): P(cx - 5, y, SK if y > 127 else TE2); P(cx + 5, y, SK if y > 127 else TE)
for y in range(132, 141):
    for x in (cx - 2, cx - 1, cx + 1, cx + 2): P(x, y, TE2 if x < cx else TE)
for x in (cx - 3, cx - 2, cx - 1, cx + 1, cx + 2, cx + 3): P(x, 141, (30, 30, 32))
mask_m = np.zeros((144, 176), np.uint8); mask_m[111:143, 109:122] = 255
mask_md = np.maximum(mask_m, mask_d)

# 3. second low sandbag wall in front of the right shrubs (x 84..110)
SB = np.array([150, 132, 98.]); SB2 = np.array([118, 102, 76.])
bags2 = [(x0, 138, 7, 6) for x0 in range(84, 110, 7)] + [(x0, 133, 6, 6) for x0 in range(87, 106, 6)]
for (x0, y0, w, h) in bags2:
    for y in range(y0, min(y0 + h, 144)):
        for x in range(x0, min(x0 + w, 111)):
            ex = ((x - (x0 + w / 2 - .5)) / (w / 2)) ** 2 + ((y - (y0 + h / 2 - .5)) / (h / 2)) ** 2
            if ex <= 1.15: P(x, y, SB if y < y0 + 3 else SB2)
            if 0.75 < ex <= 1.15: P(x, y, (70, 60, 46))
mask_s = ellmask(bags2, 0)

if STAGE == 'rough':
    Image.fromarray(o.astype('uint8')).save('t5_rough.png')
    Image.fromarray(mask_h).filter(ImageFilter.MaxFilter(5)).save('t5_mask_heli.png')
    Image.fromarray(mask_md).save('t5_mask_medic.png')
    Image.fromarray(mask_s).filter(ImageFilter.MaxFilter(9)).save('t5_mask_sand.png')
    bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
    bg.resize((704, 576), Image.NEAREST).save('t5_rough_4x.png')
    sys.exit()

# ---------- final ----------
o = b.copy()
def take(fn, mfile, keep_sky=True):
    ai = np.asarray(Image.open(fn).convert('RGBA')).astype(float)
    mk = np.asarray(Image.open(mfile).convert('L')) > 0
    white = ai[..., :3].min(2) > 226
    if 'heli' in fn or '_amb' in fn:   # background = near-white connected to outside the mask
        from collections import deque
        nw = ai[..., :3].min(2) > 214
        bgm = np.zeros_like(nw); q = deque()
        for y in range(144):
            for x in range(176):
                if nw[y, x] and not mk[y, x]: bgm[y, x] = True; q.append((y, x))
        while q:
            y, x = q.popleft()
            for yy, xx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
                if 0 <= yy < 144 and 0 <= xx < 176 and nw[yy, xx] and not bgm[yy, xx]:
                    bgm[yy, xx] = True; q.append((yy, xx))
        white = bgm
        tone = mk & ~white & (ai[..., :3].min(2) > 150)
        ai[tone, :3] *= (0.8 if 'heli' in fn else 0.88)
    use = mk & ~white
    if 'soldier' in fn:
        use &= np.abs(ai[..., :3] - b[..., :3]).sum(2) > 36
    o[use, :3] = ai[use, :3]; o[use, 3] = 255
    return use
rough = np.asarray(Image.open('t5_rough.png').convert('RGBA')).astype(float)
o[114:141, 119:129] = rough[114:141, 119:129]
USE = {}
for fn, mf in [('t5_heli2_inp.png' if os.path.exists('t5_heli2_inp.png') else 't5_heli_inp.png', 't5_mask_heli.png'), ('t5_medic_inp.png', 't5_mask_medic.png'), ('t5_sand_inp.png', 't5_mask_sand.png'), ('t5_soldier3_inp.png' if os.path.exists('t5_soldier3_inp.png') else 't5_soldier2_inp.png', 't5_mask_soldier.png'), ('t5_amb_inp.png', 'amb2_mask.png')]:
    if os.path.exists(fn): USE[fn] = take(fn, mf)
# soldier uniform: plain olive (3 tones by brightness), his pixels only
sk = [k for k in USE if 'soldier' in k]
if sk:
    mk = USE[sk[0]]
    OL = [np.array(c, float) for c in [(52, 55, 36), (70, 74, 47), (88, 92, 60)]]
    for y in range(62, 81):
        for x in range(1, 23):
            if not mk[y, x]: continue
            r_, g_, b_ = o[y, x, :3]; L = (r_ + g_ + b_) / 3
            if L < 34: continue
            if r_ > g_ + 12 and (y < 63 or (x < 10 and y < 67)): continue   # face + front hand
            legs = y >= 72
            lit = x >= 15
            c = (OL[1] if lit else OL[0]) if legs else (OL[2] if lit else OL[1])
            if L < 46: c = c * 0.8                      # keep folds/creases
            o[y, x, :3] = c
# railing back in front of the soldier
g0 = np.asarray(Image.open('hospital_layout_guide_176x144.png').convert('RGBA'))
for y in range(66, 83):
    for x in range(0, 27):
        if tuple(g0[y, x, :3]) == (26, 26, 29) or tuple(g0[y, x, :3]) == (46, 46, 50):
            o[y, x] = b[y, x]

# helicopter: no roof deck from above -- keep only pixels above the ER roof line
# banner: survivor flag hung from the middle upper window's sill (x 62..77, rows 75..92)
RU = np.array([174, 71, 41.]); RU2 = np.array([135, 53, 32.]); WS = np.array([200, 200, 196.])
for y in range(76, 93):
    for x in range(63, 78):
        bot = 92 - (3 - abs(x - 70) * 3 // 7 if abs(x - 70) <= 7 else 0)   # V notch at the bottom
        if y > bot: continue
        c = RU if (x - 63) % 5 not in (0, 1) else RU2
        if y > 88 and (x + y) % 4 == 0: c = RU2
        P(x, y, c + rnd.normal(0, 3, 3))
    P(63, y, OUT) if y < 92 else None; P(77, y, OUT) if y < 92 else None
for x in range(63, 78): P(x, 75, (90, 70, 50))
# star (5 points, 7x7) centred at (70, 82)
star = ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", "##...##"]
for yy, row in enumerate(star):
    for xx, ch in enumerate(row):
        if ch == '#': P(67 + xx, 79 + yy, WS)
# ropes to the sill
P(63, 74, (70, 60, 50)); P(77, 74, (70, 60, 50))

# side-wall windows lit (behind the fire escape), dimmer; the one behind the soldier stays dark
for (wy, wx) in [(55, 22), (101, 15), (101, 22)]:
    t = (28 - wx) / 18; off = round(4 * t)
    for x in range(wx + 1, wx + 4):
        for y in range(wy + off + 1, wy + off + 15):
            if o[y, x, :3].mean() < 70 and not (o[y, x, :3].max() < 34):
                o[y, x, :3] = [168, 122, 66] if (y - wy) % 7 else [120, 84, 44]

# string lights under the main cornice (swags between anchors)
bulbs = []
anchors = []
for a0, a1 in zip(anchors[:-1], anchors[1:]):
    for x in range(a0, a1 + 1):
        t = (x - a0) / (a1 - a0)
        y = 41 + round(3 * 4 * t * (1 - t))
        P(x, y, (40, 40, 42))
        if (x - a0) % 4 == 2:
            P(x, y + 1, (255, 214, 150)); bulbs.append((x, y + 1))

# spotlight on the main roof's front-left corner: can lamp tilted along its beam (down-left) on a post + yoke
BK = np.array([36.5, 11.5]); FR_ = np.array([31.0, 20.0])
ax = FR_ - BK; L_ = np.linalg.norm(ax); u_ = ax / L_; nrm = np.array([u_[1], -u_[0]])   # nrm points up-right
for y in range(6, 26):
    for x in range(25, 42):
        v = np.array([x, y]) - BK
        t = (v @ u_) / L_; dist = abs(v @ nrm); side = v @ nrm
        if -0.08 <= t <= 1.0 and dist <= 3.4:
            if dist > 2.5: P(x, y, OUT)
            elif t > 0.86: P(x, y, (255, 246, 222) if dist < 1.8 else (214, 208, 190))
            else: P(x, y, (84, 86, 88) if side > 0.8 else ((60, 62, 64) if side > -0.8 else (44, 46, 48)))
for y in range(17, 28): P(37, y, IR)            # post
P(36, 17, IR); P(36, 16, IR)                     # yoke arm to the pivot
for x in range(34, 41): P(x, 28, IR)
SPX, SPY = 30, 21

# colour pass (brightest), then glow
o[..., :3] = np.clip(o[..., :3] * 1.04 + 1, 0, 255)
import props as _pp
if o[126, 137, 3] > 0 and o[120:132, 128:152, :3].min(2).mean() > 100: _pp.ambulance_cross(o)
Image.fromarray(np.clip(o, 0, 255).astype('uint8')).save('t5_preglow.png')

g0 = np.asarray(Image.open('hospital_layout_guide_176x144.png').convert('RGBA'))
ER = [(x, y) for y in range(94, 101) for x in range(136, 148) if tuple(g0[y, x, :3]) == (150, 52, 44)]
reds = np.argwhere((np.abs(o[..., 0] - 245) < 12) & (o[..., 1] < 80) & (o[..., 2] < 70))
blues = np.argwhere((o[..., 2] > 230) & (o[..., 0] < 100))
fx.glow_round(o, 0, 0, 10, (150, 230, 170), k0=0.5, cap=120, box=(59, 7, 82, 26), skip_inside=True)
keep = [USE[k] for k in USE if 'medic' in k or 'soldier' in k]
prot = np.zeros((144, 176), bool)
for k in keep: prot |= k
saved = o[prot].copy()
fx.glow_cone(o, 120, 108, 30, 0.65, (255, 214, 150), k0=0.95)
for (x, y) in ER: fx.glow_round(o, x, y, 6, (255, 128, 100), k0=0.07, cap=60)
fx.glow_round(o, 20, 128, 3, (120, 255, 140), k0=0.35, cap=70)
for (x, y) in bulbs: fx.glow_round(o, x, y, 3, (255, 214, 150), k0=0.28, cap=70)
fx.glow_round(o, SPX, SPY, 6, (255, 244, 214), k0=0.55, cap=140)
fx.glow_beam(o, SPX, SPY, -0.53, 0.85, 31, 0.27, (255, 244, 214), k0=0.55, cap=135, protect=prot)
o[prot] = saved
# ambulance lights wash the ER wall behind the truck (wall pixels only: not the truck, medic, sky or door)
ambm = np.asarray(Image.open('amb2_mask.png').convert('L')) > 0
wash = o.copy()
for (y, x) in reds[::2]: fx.glow_round(wash, x, y, 15, (255, 70, 60), k0=0.45, cap=0)
for (y, x) in blues[::2]: fx.glow_round(wash, x, y, 15, (80, 120, 255), k0=0.45, cap=0)
wallm = (o[..., 3] > 200) & ~ambm & ~prot
wallm[:, :127] = False; wallm[104:, 113:127] = False
o[wallm] = wash[wallm]
for (x, y) in ER: o[y, x, :3] = [204, 72, 58]
o = np.clip(o, 0, 255)
Image.fromarray(o.astype('uint8')).save('hospital_t5_draft_176x144.png')
a = o[o[..., 3] > 200][:, :3] / 255
print('V', a.max(1).mean() * 255)
bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
bg.resize((704, 576), Image.NEAREST).save('t5_4x.png')
