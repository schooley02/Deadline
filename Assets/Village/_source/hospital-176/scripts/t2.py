"""Hospital T2 (squatters) from the T3 base without the ambulance. Stages: rough | final."""
import sys, os, numpy as np, random, colorsys
from PIL import Image, ImageFilter
import fx

STAGE = sys.argv[1]
OUT = np.array([28, 29, 32.]); IR = np.array([26, 26, 29.])
rnd = np.random.default_rng(22)
b = np.asarray(Image.open('t2_base.png').convert('RGBA')).astype(float)
g0 = np.asarray(Image.open('hospital_layout_guide_176x144.png').convert('RGBA'))
o = b.copy()

def P(x, y, c, a=255):
    if 0 <= x < 176 and 0 <= y < 144:
        o[y, x, :3] = c; o[y, x, 3] = a

DG = np.array([34, 40, 48.]); DG2 = np.array([46, 54, 62.])
def dark_glass(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = o[y, x, :3]
            if c.mean() > 60 and not (abs(c[0] - c[1]) < 6 and c.mean() < 70):
                o[y, x, :3] = (DG2 if (x + 2 * y) % 9 == 0 else DG) + rnd.normal(0, 2, 3)

# lights off: every window glass, lobby, transom, ER door
for cx in (47, 70, 93): dark_glass(cx - 5, 54, cx + 4, 69)
for cx in (44, 96): dark_glass(cx - 5, 108, cx + 4, 123)
dark_glass(63, 100, 80, 106); dark_glass(64, 110, 79, 139); dark_glass(114, 109, 125, 139)
# cross sign off (dark green, no glow)
for y in range(7, 27):
    for x in range(59, 83):
        if tuple(g0[y, x, :3]) == (112, 196, 138): P(x, y, (44, 64, 52) if (x + y) % 6 else (52, 72, 58))
# ER lamp off
for x in range(118, 122): P(x, 107, (60, 58, 54))
# ER letters faded
for y in range(94, 101):
    for x in range(136, 148):
        if tuple(g0[y, x, :3]) == (150, 52, 44):
            o[y, x, :3] = o[y, x, :3] * 0.45 + o[y, x - 1 if x > 136 else x + 1, :3] * 0.0 + np.array([112, 80, 66.]) * 0.55

# ---- boards (code), each window different
W1, W2, W3 = np.array([112, 90, 64.]), np.array([92, 72, 52.]), np.array([74, 58, 42.])
NAIL = np.array([150, 146, 136.])
mask_b = np.zeros((144, 176), np.uint8)
def plank(x0, y0, x1, y1, col, tilt=0.0):
    """horizontal plank from x0..x1, rows y0..y1, tilted (rows per px)."""
    for x in range(x0, x1 + 1):
        dy = round(tilt * (x - x0))
        for y in range(y0 + dy, y1 + dy + 1):
            edge = y in (y0 + dy, y1 + dy)
            P(x, y, OUT if (edge and y == y1 + dy) else (col * (0.86 if edge else 1.0) + rnd.normal(0, 4, 3)))
            mask_b[y, x] = 255
        if x in (x0 + 1, x1 - 1): P(x, y0 + dy + 1, NAIL)

# upper-left: three uneven horizontal planks with gaps
plank(39, 54, 54, 57, W1, 0.05); plank(40, 60, 55, 63, W2, -0.07); plank(39, 66, 54, 68, W3, 0.04)
# upper-right: plywood sheet with a broken top-right corner
for y in range(53, 71):
    for x in range(86, 101):
        if x - 86 > 9 and y - 53 < (x - 95) * 1.2: continue        # broken corner
        P(x, y, np.array([120, 100, 70.]) + rnd.normal(0, 5, 3) - (8 if (x * 3 + y) % 11 == 0 else 0)); mask_b[y, x] = 255
for y in range(53, 71): P(86, y, OUT); P(100, y, OUT) if y > 64 else None
for x in range(86, 101): P(x, 70, OUT)
for (x, y) in [(88, 55), (98, 68), (88, 68)]: P(x, y, NAIL)
# lower-left: crossed planks over dark glass
for i in range(18):
    for (x, y) in [(37 + round(i * 14 / 17), 106 + i), (51 - round(i * 14 / 17), 106 + i)]:
        for d in (0, 1, 2):
            P(x + d, y, W2 if d < 2 else OUT); mask_b[y, x + d] = 255
# lower-right: rusty corrugated tin
for y in range(105, 127):
    for x in range(88, 104):
        rib = (x - 88) % 3
        c = np.array([112, 74, 50.]) if rib == 0 else (np.array([92, 62, 44.]) if rib == 1 else np.array([72, 50, 38.]))
        if rnd.random() < 0.18: c = c * np.array([1.1, 0.95, 0.85])
        P(x, y, c + rnd.normal(0, 4, 3)); mask_b[y, x] = 255
    P(88, y, OUT); P(103, y, OUT)
for x in range(88, 104): P(x, 105, OUT); P(x, 126, OUT)
# entrance: doors kept, crooked planks across + one hanging plank
ENT = []
def eplank(x0, y0, x1, y1, col, tilt):
    plank(x0, y0, x1, y1, col, tilt); ENT.append((x0, y0, x1, y1, tilt))
eplank(59, 112, 84, 117, W1, 0.06); eplank(60, 122, 83, 127, W2, -0.05); eplank(59, 132, 84, 137, W3, 0.03)
for i in range(18):
    x = 65 + round(i * 0.55); y = 117 + i
    for d in range(5): P(x + d, y, W2 * (0.9 if d == 0 else 1.0) if d < 4 else OUT); mask_b[y, x + d] = 255

# ---- ER doors: chain through the handles + padlock (code)
for x in range(115, 125):
    y = 123 + (1 if (x - 115) in (4, 5) else 0)
    P(x, y, (96, 96, 98) if x % 2 else (64, 64, 66))
for y in range(125, 129):
    for x in range(119, 122): P(x, y, (120, 100, 50) if y > 125 else (90, 90, 92))
P(120, 125, (40, 40, 40))

# ---- candle in the upstairs middle window (only light)


# ---- graffiti where the ambulance stood: DEAD (red) / HELP US (black)
F = {'D': ["###.", "#..#", "#..#", "#..#", "#..#", "#..#", "###."], 'E': ["####", "#...", "#...", "###.", "#...", "#...", "####"],
     'A': [".##.", "#..#", "#..#", "####", "#..#", "#..#", "#..#"], 'H': ["#..#", "#..#", "#..#", "####", "#..#", "#..#", "#..#"],
     'L': ["#...", "#...", "#...", "#...", "#...", "#...", "####"], 'P': ["###.", "#..#", "#..#", "###.", "#...", "#...", "#..."],
     'U': ["#..#", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."], 'S': [".###", "#...", "#...", ".##.", "...#", "...#", "###."], ' ': ["...."] * 7}
def spray(text, x, y, col, scale=1, seed=1, gap=1, skip=0.07):
    r = random.Random(seed)
    for ch in text:
        if ch == ' ':
            x += 3; continue
        g = F[ch]; jy = r.choice([0, 0, 1, -1]) if scale > 1 else r.choice([0, 0, 0, 1])
        for yy, row in enumerate(g):
            for xx, c in enumerate(row):
                if c == '#':
                    for sy in range(scale):
                        for sx in range(scale):
                            px_, py_ = x + xx * scale + sx, y + (yy + jy) * scale + sy
                            if r.random() > skip: P(px_, py_, np.array(col) + r.uniform(-8, 8))
                    if yy == 6 and r.random() < 0.45:                    # drips
                        for k in range(r.randint(1, 4)): P(x + xx * scale, y + (7 + jy) * scale + k, np.array(col) * 0.9)
        x += 4 * scale + gap

# ---- brown shrubs (dry)
for y in range(118, 144):
    for x in range(26, 112):
        r_, g_, bb = o[y, x, :3] / 255
        if g_ > r_ + 0.03 and g_ > bb and o[y, x, :3].mean() < 110 and (x < 40 or x > 84):
            h, l, s = colorsys.rgb_to_hls(r_, g_, bb)
            nr, ng, nb = colorsys.hls_to_rgb(0.075 + rnd.uniform(-0.01, 0.01), l * 0.95, min(s * 1.1, 0.45))
            o[y, x, :3] = [nr * 255, ng * 255, nb * 255]

if STAGE == 'rough':
    Image.fromarray(o.astype('uint8')).save('t2_rough.png')
    Image.fromarray(mask_b).filter(ImageFilter.MaxFilter(3)).save('t2_mask_boards.png')
    bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
    bg.resize((704, 576), Image.NEAREST).save('t2_rough_4x.png')
    sys.exit()

# ---- final: board inpaint (texture) keyed to the boards only
if os.path.exists('t2_boards_inp.png'):
    ai = np.asarray(Image.open('t2_boards_inp.png').convert('RGBA')).astype(float)
    mk = mask_b > 0
    white = ai[..., :3].min(2) > 226
    use = mk & ~white
    use[108:142, 57:88] = False
    o[use, :3] = ai[use, :3]
    # code grain on the entrance planks
    gr = np.random.default_rng(9)
    for (x0, y0, x1, y1, tilt) in ENT:
        for x in range(x0, x1 + 1):
            dy = round(tilt * (x - x0))
            for y in range(y0 + dy + 1, y1 + dy):
                if gr.random() < 0.22: o[y, x, :3] *= 0.85
                if (y - y0 - dy) == 2 and gr.random() < 0.5: o[y, x, :3] *= 0.9
        kx = gr.integers(x0 + 4, x1 - 4); o[y0 + 3 + round(tilt * (kx - x0)), kx, :3] *= 0.7
    # candle stays code
    for y in range(62, 70):
        for x in range(66, 74): pass

# grime: blotches, drips under sills / cornice, rising damp
for _ in range(70):
    x = rnd.integers(29, 172); y = rnd.integers(40, 140); r = rnd.integers(2, 5)
    for yy in range(y - r, y + r + 1):
        for xx in range(x - r, x + r + 1):
            if 0 <= xx < 176 and 0 <= yy < 144 and o[yy, xx, 3] > 0 and ((xx - x) ** 2 + (yy - y) ** 2) <= r * r and rnd.random() < 0.6:
                if 60 < o[yy, xx, :3].mean() < 200: o[yy, xx, :3] *= 0.9
for sy in (40, 74, 92, 128):        # drips
    for x in range(29, 172, 3):
        if rnd.random() < 0.45:
            for k in range(rnd.integers(2, 9)):
                y = sy + k
                if y < 144 and o[y, x, 3] > 0 and 60 < o[y, x, :3].mean() < 200: o[y, x, :3] *= 0.88
for y in range(128, 144):           # rising damp
    for x in range(10, 174):
        if o[y, x, 3] > 0 and 50 < o[y, x, :3].mean() < 200 and rnd.random() < (y - 128) / 22:
            o[y, x, :3] *= np.array([0.9, 0.92, 0.88])

# dull pass (sat x0.8, value x0.86)
rgb = o[..., :3] / 255
mx = rgb.max(2, keepdims=True); mn = rgb.min(2, keepdims=True); mean = rgb.mean(2, keepdims=True)
rgb = mean + (rgb - mean) * 0.8
o[..., :3] = np.clip(rgb * 0.86 * 255, 0, 255)

# graffiti (after the dull pass so it stays readable)
import graffiti
graffiti.hand_text(o, 'DEAD', 133, 111, 12, 7.5, 9.6, 1.9, (176, 50, 40), -8, seed=3, drips=0.55)
graffiti.hand_text(o, 'HELP US', 134, 128, 6.5, 4.0, 5.6, 1.15, (178, 172, 160), -6, seed=8, drips=0.2, jit=0.5)
# candle glow (the only light) -- pane only + a hint on the sill
# candle BEHIND the glass in the left pane of the upstairs middle window; light on the glass only
FRg = (60, 47, 39)
glass = [(x, y) for y in range(54, 70) for x in range(65, 75) if tuple(g0[y, x, :3]) != FRg and tuple(g0[y, x, :3]) != (30, 31, 34)]
CX, CY = 67, 63
for (x, y) in glass:
    d = ((x - CX) ** 2 + ((y - CY) * 1.1) ** 2) ** 0.5
    k = 0.85 * max(0, 1 - d / 11) ** 1.2
    o[y, x, :3] = o[y, x, :3] * (1 - k) + np.array([236, 150, 70.]) * k
for y in range(64, 69): o[y, 67, :3] = [196, 184, 156]; o[y, 66, :3] = [168, 156, 130]
o[69, 65:70, :3] = [62, 50, 40]                      # dish on the inner sill
o[63, 67, :3] = [255, 206, 120]; o[62, 67, :3] = [255, 232, 168]; o[62, 66, :3] = [250, 190, 100]
# window bars stay in front of the candle
for (x, y) in [(x, y) for y in range(54, 70) for x in range(65, 75) if tuple(g0[y, x, :3]) == FRg]:
    o[y, x, :3] = b[y, x, :3] * 0.7
o = np.clip(o, 0, 255)
Image.fromarray(o.astype('uint8')).save('hospital_t2_draft_176x144.png')
a = o[o[..., 3] > 200][:, :3] / 255
print('V', a.max(1).mean() * 255)
bg = Image.new('RGBA', (176, 144), (36, 40, 58, 255)); bg.alpha_composite(Image.fromarray(o.astype('uint8')))
bg.resize((704, 576), Image.NEAREST).save('t2_4x.png')
