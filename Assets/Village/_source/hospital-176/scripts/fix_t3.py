from PIL import Image
import numpy as np, random

g = np.asarray(Image.open("hospital_layout_guide_176x144.png").convert("RGBA")).astype(float)
s = np.asarray(Image.open("style_s11_0.png").convert("RGBA")).astype(float)
out = s.copy()
out[..., 3] = g[..., 3]
rnd = np.random.default_rng(5)

def put_guide(x0, y0, x1, y1, darken=0.9, noise=6):
    blk = g[y0:y1 + 1, x0:x1 + 1, :3] * darken + rnd.normal(0, noise, (y1 - y0 + 1, x1 - x0 + 1, 1))
    out[y0:y1 + 1, x0:x1 + 1, :3] = blk

# 1. lower-right window: lit again (glass only, frame from the style pass)
put_guide(91, 108, 100, 123, 0.86)

# 2. main entrance: glass double doors with the lit lobby inside (code)
FR = np.array([44, 36, 32.])
x0, x1, y0, y1 = 64, 79, 110, 139
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        t = (y - y0) / (y1 - y0)
        c = np.array([196, 168, 120.]) * (1 - 0.18 * t)           # back wall warm
        if y >= 129: c = np.array([150, 132, 100.])                  # floor
        out[y, x, :3] = c + rnd.normal(0, 4, 3)
# reception counter + a chair + a framed notice
out[124:129, 65:73, :3] = [118, 92, 70]; out[124, 65:73, :3] = [150, 122, 92]
out[129, 65:73, :3] = [80, 62, 50]
out[116:120, 75:78, :3] = [160, 168, 160]; out[116, 75:78, :3] = [96, 90, 80]
out[126:131, 76:78, :3] = [90, 78, 70]
# ceiling light inside (just a bright strip, no glow outside)
out[111, 67:76, :3] = [250, 232, 190]
# glass reflections (diagonals)
for k in range(10):
    for (x, y) in [(66 + k // 3, 133 - k), (74 + k // 3, 134 - k)]:
        if x0 <= x <= x1: out[y, x, :3] = np.minimum(out[y, x, :3] * 1.08 + 10, 255)
# door frames: outer, middle stiles, push bars
out[110:140, 71:73, :3] = FR
out[110:140, 63, :3] = FR; out[110:140, 80, :3] = FR
out[124, 68:71, :3] = [70, 62, 56]; out[124, 73:76, :3] = [70, 62, 56]

# 3. grade: brighten mids, keep darks/outlines dark
rgb = out[..., :3] / 255.0
v = rgb.max(2, keepdims=True)
gain = 1.0 + 0.30 * np.clip((v - 0.12) / 0.25, 0, 1)
rgb = np.clip(rgb * gain, 0, 1)
out[..., :3] = rgb * 255
# side wall plaster only (not the iron): deep shade but readable
GS = [(74, 82, 76), (64, 71, 66), (104, 99, 86), (38, 46, 56), (58, 60, 60)]
for x in range(10, 28):
    for y in range(30, 141):
        gc = tuple(int(c) for c in g[y, x, :3])
        if g[y, x, 3] > 0 and gc in GS:
            out[y, x, :3] = out[y, x, :3] * 1.5 + np.array([10, 13, 11])
# slight warm shift on the cool plaster
lum = out[..., :3].max(2)
cool = (out[..., 2] >= out[..., 0] - 4) & (lum > 40) & (g[..., 3] > 0)
out[cool, 0] *= 1.035; out[cool, 2] *= 0.95
# stray white rim pixels -> iron
m = (out[..., :3].min(2) > 225) & (g[..., 3] > 0)
m[100:142, 60:84] = False
out[m, :3] = [30, 30, 33]
import fx
# shrubs (ragged, muted)
import props, os
# --- wall behind the old ambulance (tile clean wing wall rows 105..114 downward)
src = out[105:115, 127:174, :3].copy()
for y in range(115, 144):
    k = 1 - 0.18 * max(0, (y - 128) / 15)
    out[y, 127:174, :3] = src[(y - 115) % 10] * k
# --- ER door narrowed to 113..126 (still 33 tall)
FRm = np.array([30, 30, 33.])
for y in range(106, 140):
    for x in range(112, 129):
        out[y, x, :3] = out[106, 140, :3] if False else out[y, x, :3]
out[106:108, 112:128, :3] = [118, 112, 98]
for y in range(108, 140):
    for x in range(113, 127):
        t = (y - 108) / 31
        if x in (113, 126) or y == 108 or x in (119, 120):
            out[y, x, :3] = FRm
        elif x in (114, 125) or y == 109:
            out[y, x, :3] = [52, 50, 50]
        else:
            out[y, x, :3] = np.array([206, 176, 124.]) * (1 - 0.2 * t) + rnd.normal(0, 3, 3)
    for x in (127, 128):
        out[y, x, :3] = out[y, 131, :3]
out[124, 115:119, :3] = [70, 64, 58]; out[124, 121:125, :3] = [70, 64, 58]
for y in range(140, 144):
    for x in range(111, 128):
        out[y, x, :3] = [86, 86, 84] if y > 140 else [104, 104, 100]
# --- bigger ambulance (bus scale), lights off at T3
import os
noamb = out.copy()
if os.environ.get('AMB', '1') == '1':
    ai = np.asarray(Image.open('amb2_inp_0.png').convert('RGBA')).astype(float)
    mk = np.asarray(Image.open('amb2_mask.png').convert('L')) > 0
    white = ai[..., :3].min(2) > 228
    use = mk & ~white
    out[use, :3] = ai[use, :3]
    br = use & (out[..., :3].min(2) > 130)
    out[br, :3] *= 0.9
# ER lamp (re-drawn over the narrowed door)
out[104:106, 120, :3] = [26, 26, 29]
out[105:107, 117:123, :3] = [26, 26, 29]
out[107, 118:122, :3] = [250, 226, 170]
# --- turned dumpster
if os.environ.get('DUMP','1')=='1': props.dumpster(out)
else:
    for y in range(125,144):
        for x in range(0,10): out[y,x,3]=0
# --- shrubs raised onto soil beds
for (x0, x1) in [(28, 39), (85, 108)]:
    props.bed(out, x0, x1, seed=x0)
fx.shrub(out, 28, 39, 126, 11, ybot=141)
fx.shrub(out, 85, 96, 125, 23, ybot=141)
fx.shrub(out, 97, 108, 128, 37, ybot=141)
# shrub feet: a few stems into the mound + contact shadow
for (x0, x1) in [(28, 39), (85, 108)]:
    for x in range(x0 + 2, x1 - 1, 3): out[141, x, :3] = (40, 34, 26); out[142, x, :3] = (34, 30, 24)
# bench moved right of the shrub: patch wall, then draw it
wsrc = out[97:105, 34:56, :3].copy()
for y in range(130, 144):
    k = 1 - 0.15 * max(0, (y - 132) / 11)
    out[y, 34:56, :3] = wsrc[(y - 130) % 8] * k
for y in range(127, 130):
    for x in range(34, 56):
        if not (36 <= x <= 52):
            out[y, x, :3] = wsrc[y - 127, x - 34]
WD, WD2, IR = np.array([88, 66, 48.]), np.array([66, 50, 38.]), np.array([26, 26, 29.])
BX0b, BX1b = 41, 55
for x in (range(BX0b, BX1b + 1) if os.environ.get('BENCH','1')=='1' else []):
    out[127, x, :3] = IR; out[128, x, :3] = WD; out[129, x, :3] = WD2
    out[132, x, :3] = IR; out[133, x, :3] = WD; out[134, x, :3] = WD2
for x in ((BX0b + 1, BX1b - 1) if os.environ.get('BENCH','1')=='1' else ()):
    for y in range(129, 132): out[y, x, :3] = IR
    for y in range(135, 144): out[y, x, :3] = IR
if os.environ.get('BENCH','1')=='1': out[143, BX0b:BX1b + 1, :3] = np.minimum(out[143, BX0b:BX1b + 1, :3], 40)
# cross sign lit
for y in range(8, 26):
    for x in range(60, 82):
        c = g[y, x, :3]
        if tuple(int(v) for v in c) == (112, 196, 138):
            out[y, x, :3] = [140, 222, 160]
out = np.clip(out, 0, 255)
import props as _pp
if os.environ.get('AMB', '1') == '1': _pp.ambulance_cross(out, dirt=float(os.environ.get('DIRT', '0.5')))
Image.fromarray(out.astype('uint8')).save(os.environ.get('PRE','t3_preglow.png'))
fx.glow_round(out, 0, 0, 10, (150, 230, 170), k0=0.45, cap=110, box=(59, 7, 82, 26), skip_inside=True)
fx.glow_cone(out, 120, 108, 26, 0.6, (255, 214, 150), k0=0.75)
out = np.clip(out, 0, 255)
Image.fromarray(out.astype("uint8")).save(os.environ.get("OUTF","t3_wip1.png"))
a = out[out[..., 3] > 200][:, :3] / 255
print("V", a.max(1).mean() * 255)
