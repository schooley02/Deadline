"""Village ground rework mocks (2026-11-26). Draws the village field in the lane-grass style (flat tones in soft clumps, separate
tufts, chunky 2x pixels) plus per-building footings and an optional dirt apron, and composites the scene at game size.
usage: python3 ground.py <outdir>"""
import sys, json, subprocess, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

P = '/mnt/user-data/uploads/Deadline'
CODE = '/mnt/user-data/outputs/Deadline'          # current js/config.js + js/villageLayout.js
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
def img(p): return Image.open(f'{P}/Assets/{p}').convert('RGBA')

# ---- palette: the lane grass greens (regrass.py) and the churchyard dirt (reyard.py) ----
D0, D1, M, L, T = (12, 26, 24), (21, 38, 34), (30, 50, 42), (41, 61, 53), (51, 73, 62)
SH = (7, 16, 17)                                   # contact shadow on grass
DIRT, DIRT_L, DIRT_D, MARK, STONE, SHADE = (54, 54, 50), (59, 58, 54), (48, 48, 45), (36, 37, 34), (84, 82, 78), (33, 34, 32)
HAZE = (54, 56, 88)                                # far ground drifts toward the tree line / mountain haze
BRUSH0, BRUSH1, BRUSH2 = (21, 25, 42), (27, 33, 49), (36, 45, 58)   # underbrush at the foot of the trees
def mix(c, t, to=HAZE): return tuple(int(round(c[i] * (1 - t) + to[i] * t)) for i in range(3))

T2, T1 = 0.24, 0.44                                # haze of the middle and far ground
AW, AH = 640, 78                                   # field art (shown 2x = 1280x156); top edge at horizon - 90px
HZ_ROW = 45                                        # art row of the front row's feet (90px / 2)

def vnoise(cw, ch, seed, W=AW, H=AH):
    r = np.random.RandomState(seed)
    gw, gh = max(1, W // cw), H // ch + 2
    g = r.rand(gh, gw)
    ys = np.arange(H) / ch; xs = np.arange(W) * gw / W
    y0 = ys.astype(int); x0 = xs.astype(int) % gw; x1 = (x0 + 1) % gw
    fy = (ys - y0)[:, None]; fx = (xs - xs.astype(int))[None, :]
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

def wave(x, parts, W=AW):
    """sum of sines with whole periods over W so the tile wraps"""
    return sum(a * math.sin(2 * math.pi * k * x / W + ph) for a, k, ph in parts)

def field(option, seed=5):
    """option 'flat' = one open meadow; 'rises' = two gentle rises + underbrush at the trees. Returns RGBA uint8 (AH, AW, 4)."""
    rnd = random.Random(seed)
    a = np.zeros((AH, AW, 4), np.uint8)
    X = np.arange(AW)
    rises = option == 'rises'
    # --- depth bands: row where each band starts (far -> near), per column ---
    if rises:
        brush_top = np.array([2.6 + wave(x, [(1.3, 3, 0.4), (0.9, 11, 2.0), (0.6, 23, 4.1)]) for x in X])      # ragged underbrush silhouette
        far_top = np.array([5.6 + wave(x, [(0.7, 2, 1.0), (0.5, 7, 3.0)]) for x in X])                           # ground behind the 2nd rise
        c2 = np.array([9.0 + wave(x, [(1.2, 2, 2.2), (0.7, 5, 0.3), (0.4, 13, 1.1)]) for x in X])                # crest of the far rise (towers stand just beyond it)
        c1 = np.array([18.5 + wave(x, [(1.8, 1, 0.9), (1.1, 3, 4.0), (0.5, 9, 2.5)]) for x in X])                # crest of the near rise (back row stands just beyond it)
    else:
        brush_top = np.array([4.2 + wave(x, [(0.9, 4, 0.4), (0.6, 13, 2.0)]) for x in X])
        far_top = brush_top + 0.0
        c2 = np.array([11.0 + wave(x, [(2.0, 2, 2.2), (1.5, 5, 0.3), (1.0, 11, 1.1)]) for x in X])               # no crest: soft tone steps only
        c1 = np.array([24.0 + wave(x, [(3.0, 1, 0.9), (2.2, 3, 4.0), (1.4, 7, 2.5)]) for x in X])
    n1 = vnoise(16, 6, seed + 1) * 0.7 + vnoise(8, 4, seed + 2) * 0.3
    n2 = vnoise(20, 5, seed + 3)
    n3 = vnoise(32, 8, seed + 4)
    Y = np.arange(AH)[:, None]
    band = np.full((AH, AW), 3, int)                 # 3 near, 2 middle, 1 far, 0 brush, -1 sky
    if rises:
        band[Y < np.round(c1)[None, :]] = 2
        band[Y < np.round(c2)[None, :]] = 1
    else:                                            # flat: the steps follow the clump noise, so no line reads as a ridge
        band[Y < (c1[None, :] + (n3 - 0.5) * 9)] = 2
        band[Y < (c2[None, :] + (n3 - 0.5) * 6)] = 1
    band[Y < np.round(far_top)[None, :]] = 0
    band[Y < np.round(brush_top)[None, :]] = -1
    HAZ = {3: 0.0, 2: T2, 1: T1}
    col = np.zeros((AH, AW, 3), int)
    for b, t in HAZ.items():
        m = band == b
        base = np.zeros((AH, AW, 3), int); base[:] = mix(M, t)
        base[n1 < (0.40 if b == 3 else 0.36)] = mix(D1, t)
        base[n2 > (0.68 if b == 3 else 0.72)] = mix(L, t)
        col[m] = base[m]
    # the near band is tall: its upper part (further away) sits one step toward the haze, split along the clumps
    if True:
        up = (band == 3) & (Y < (31 + (n3 - 0.5) * 10))
        t = 0.10
        base = np.zeros((AH, AW, 3), int); base[:] = mix(M, t); base[n1 < 0.40] = mix(D1, t); base[n2 > 0.70] = mix(L, t)
        col[up] = base[up]
    if rises:
        # underbrush: dark, irregular, a few lighter leaf clumps catching the moon from the right
        m = band == 0
        nb = vnoise(6, 3, seed + 7)
        base = np.zeros((AH, AW, 3), int); base[:] = BRUSH0; base[nb > 0.55] = BRUSH1; base[nb > 0.80] = BRUSH2
        col[m] = base[m]
        # moonlit lip on each crest + a soft shade a few rows down its face
        nl = vnoise(9, 3, seed + 8); nk = vnoise(14, 3, seed + 9)
        for crest, t_here, t_behind in ((c1, 0.10, T2), (c2, T2, T1)):
            for x in range(AW):
                y = int(round(crest[x]))
                col[y, x] = mix(T if nk[y, x] > 0.55 else L, t_here)              # the lip catches the moon
                col[y + 1, x] = mix(L if nk[y, x] > 0.35 else M, t_here)
                if nl[min(y + 3, AH - 1), x] > 0.45: col[min(y + 4, AH - 1), x] = mix(D1, t_here)
                # the dip just behind the crest lies in its shadow, fading up into the ground beyond
                if band[y - 1, x] > 0: col[y - 1, x] = mix(D0, t_behind)
                if band[y - 2, x] > 0 and nl[y - 2, x] > 0.30: col[y - 2, x] = mix(D1, t_behind)
    else:
        m = band == 0
        col[m] = mix(D1, T1)
    a[..., :3] = np.clip(col, 0, 255); a[..., 3] = np.where(band >= 0, 255, 0)

    def put(y, x, c):
        if 0 <= y < AH: a[y, x % AW, :3] = c; a[y, x % AW, 3] = 255
    def blades(n, lo, hi):
        b = []; d = 0
        for _ in range(n):
            b.append((d, rnd.randint(lo, hi), rnd.choice((-1, 0, 0, 0, 1)))); d += rnd.choice((1, 2, 2))
        return b
    # --- fringe of blades standing up on each crest (rises) / on the top edge (both) ---
    edges = [(brush_top if not rises else None, 0.32)]
    if rises: edges += [(c1, 0.10), (c2, T2)]
    for crest, t in edges:
        if crest is None: continue
        x = 0
        while x < AW:
            r = rnd.random(); y = int(round(crest[x]))
            if r < 0.45:
                for d, h, lean in blades(rnd.randint(2, 3), 1, 2 if t > 0 else 3):
                    for k in range(1, h + 1): put(y - k, x + d + (lean if k > 1 else 0), mix(T if k == h else L, t))
                x += rnd.randint(5, 10)
            elif r < 0.75:
                put(y - 1, x, mix(L, t)); x += rnd.randint(3, 6)
            else: x += rnd.randint(6, 14)
    # --- tufts inside the grass: bigger and more of them toward the front, none on the far band ---
    for gy in range(8, AH, 5):
        for gx in range(0, AW, 11):
            x = (gx + rnd.randint(0, 7) + ((gy // 5) % 2) * 5) % AW; y = gy + rnd.randint(0, 3)
            if y >= AH - 1: continue
            b = band[y, x]
            if b not in (2, 3) or band[max(y - 3, 0), x] != b: continue
            near = y > 31
            if rnd.random() < (0.30 if near else (0.50 if b == 3 else 0.72)): continue
            t = 0.0 if near else (0.10 if b == 3 else T2)
            bl = blades(rnd.randint(2, 4), 2, 3) if near else (blades(rnd.randint(1, 3), 1, 2) if b == 3 else blades(1, 1, 1))
            cw = max(d for d, _, _ in bl) + 2
            if b == 3:
                for d in range(-1, cw):
                    put(y, x + d, mix(D0, t))
                    if 0 <= d < cw - 1: put(y - 1, x + d, mix(D1, t))
            for d, h, lean in bl:
                for k in range(1, h + 1):
                    put(y - k, x + d + (lean if k > (h + 1) // 2 else 0), mix(T if k == h else L, t))
    if rises:
        # underbrush top: ragged twigs, never round
        for x in range(AW):
            if rnd.random() < 0.22:
                y = int(round(brush_top[x]))
                for k in range(1, rnd.randint(1, 3) + 1): put(y - k, x + (rnd.choice((-1, 0, 0, 1)) if k > 1 else 0), BRUSH0 if k < 3 else BRUSH1)
    return a

def low_edge(im):
    al = np.array(im)[:, :, 3] > 0
    low = np.array([np.where(al[:, c])[0].max() if al[:, c].any() else -1 for c in range(im.width)])
    return low

PATH_LEAN = {'punctuality': -13}                    # art px the walked path drifts sideways on its way down (the Clock tower's runs into the Gym / Police gap)
DOORS = {  # sprite x ranges (1x) of the doors people walk through
    'lurkers': [(74, 150)], 'defense': [(100, 132)], 'slain': [(76, 104)], 'goals': [(118, 142)],
    'habits': [(60, 84)], 'punctuality': [(56, 76)], 'heroes': [(86, 116)], 'nights': [(18, 36)], 'bestdays': [],
}

def footings(slots, sprites, W, H, apron, seed=11):
    """per-building pieces (in the game: one small sprite per building, placed by the layout code). Returns an RGBA image W x H."""
    rnd = random.Random(seed)
    aw, ah = W // 2, H // 2
    o = np.zeros((ah, aw, 4), np.uint8)
    nz = vnoise(7, 3, seed + 1, aw, ah) ; nd = vnoise(10, 4, seed + 2, aw, ah)
    hz = (H - 76) // 2; floor = (H - 72) // 2
    def put(y, x, c, al=255):
        if 0 <= y < ah and 0 <= x < aw: o[y, x, :3] = c; o[y, x, 3] = al
    def dirt(y, x):
        v = nd[y % ah, x % aw]
        return DIRT_L if v > 0.62 else (DIRT_D if v < 0.36 else DIRT)
    order = {'far': 0, 'back': 1, 'front': 2}
    base_rows = {}
    for s in sorted(slots, key=lambda s: order[s['row']]):
        low = low_edge(sprites[s['kind']])
        mb = low.max()
        t = {'far': T1 * 0.8, 'back': T2 * 0.7, 'front': 0.0}[s['row']]
        cols = {}
        for c in range(len(low)):
            if low[c] < mb - 30: continue                      # only what stands on the ground (the base + the receding side wall)
            ax = (s['left'] + c) // 2; ay = (s['top'] + low[c] + 1 + 1) // 2
            cols[ax] = max(cols.get(ax, -1), ay)
        base_rows[s['kind']] = cols
        # trampled grass around the base, then the contact shadow under it (moon is top right: shadow falls a little left)
        for ax, ay in cols.items():
            for dy in range(0, 3):
                if nz[(ay + dy) % ah, ax % aw] > 0.30 + dy * 0.16: put(ay + dy, ax, mix(D1, t))
        for ax, ay in cols.items():
            put(ay, ax, mix(SH, t * 0.6)); put(ay, ax - 1, mix(SH, t * 0.6))
            if nz[ay % ah, ax % aw] > 0.42: put(ay + 1, ax - 1, mix(D0, t))
        xs = sorted(cols)
        for k in range(1, 4): put(cols[xs[0]] + (0 if k < 3 else 0), xs[0] - k, mix(D0 if k > 1 else SH, t))
        # worn dirt at the doors
        for (d0, d1) in DOORS.get(s['kind'], []):
            a0 = (s['left'] + d0) // 2 - 1; a1 = (s['left'] + d1) // 2 + 1
            depth = 4 if s['row'] == 'front' else 3
            for ax in range(a0, a1 + 1):
                ay = cols.get(ax, max(cols.values()))
                edge = min(ax - a0, a1 - ax)
                dd = depth - (1 if edge < 2 else 0) - (1 if nz[ay % ah, ax % aw] < 0.35 else 0)
                for dy in range(0, max(1, dd)): put(ay + dy, ax, mix(dirt(ay + dy, ax), t))
                put(ay, ax, mix(SHADE, t))
    if apron:
        front = [s for s in slots if s['row'] == 'front']
        x0 = min(s['artLeft'] for s in front) // 2 - 6; x1 = max(s['artRight'] for s in front) // 2 + 8
        top = {}
        for ax in range(x0, x1 + 1):
            e = min(ax - x0, x1 - ax)
            ytop = hz - 3 - int(round(2.2 * nz[hz % ah, ax % aw])) + (max(0, 6 - e) // 2)
            # the yard reaches up to any front building that stands a little further back (Police station, Lab)
            for s in front:
                cols = base_rows[s['kind']]
                if ax in cols: ytop = min(ytop, cols[ax])
            top[ax] = ytop
            for y in range(ytop, floor + 6):
                if e < 6 and nz[y % ah, ax % aw] < 0.5 - e * 0.07: continue      # ragged ends
                put(y, ax, dirt(y, ax))
        # walked paths up to the back-row doors (narrower further back)
        for s in slots:
            if s['row'] != 'back': continue
            for (d0, d1) in DOORS.get(s['kind'], []):
                cx = (s['left'] + (d0 + d1) // 2) // 2; cols = base_rows[s['kind']]
                y0 = cols.get(cx, max(cols.values()))
                for y in range(y0, hz):
                    f = (y - y0) / max(1, hz - y0)
                    half = 2 + int(round(2 * f)); wob = int(round(1.5 * math.sin(y * 0.45 + cx) + PATH_LEAN.get(s['kind'], 0) * f))
                    for ax in range(cx - half + wob, cx + half + wob + 1):
                        if abs(ax - cx - wob) == half and nz[y % ah, ax % aw] < 0.45: continue
                        put(y, ax, mix(dirt(y, ax), T2 * 0.5 * (1 - f)))
        # scuffs, stones, and grass creeping in along the yard's top edge
        for ax in range(x0 + 3, x1 - 3):
            if rnd.random() < 0.10:
                y = rnd.randint(top[ax] + 1, floor + 3)
                if o[y, ax, 3] and tuple(o[y, ax, :3]) in (DIRT, DIRT_L, DIRT_D):
                    if rnd.random() < 0.5: put(y, ax, STONE); put(y + 1, ax, SHADE)
                    else: put(y, ax, MARK); put(y, ax + 1, MARK)
            if rnd.random() < 0.30:
                y = top[ax]
                for k in range(0, rnd.randint(1, 3)): put(y - k + 1, ax, T if k == 2 else L if k == 1 else D1)
    return Image.fromarray(o, 'RGBA').resize((aw * 2, ah * 2), Image.NEAREST)

def tile(dst, src, y0, sx=0):
    sw, sh = src.size; x = -(sx % sw)
    while x < dst.width:
        box = (max(0, -x), max(0, -y0), min(sw, dst.width - x), min(sh, dst.height - y0))
        if box[2] > box[0] and box[3] > box[1]: dst.alpha_composite(src.crop(box), (max(0, x), max(0, y0)))
        x += sw

def scene(W, H, baseW, field_img, option, apron):
    slots = json.loads(subprocess.check_output(['node', f'{OUT}/slots.js', CODE, json.dumps({"W": W, "H": H, "baseW": baseW})]))
    hz = H - 76
    c = Image.new('RGBA', (W, H), (11, 11, 36, 255)); dr = ImageDraw.Draw(c)
    for y in range(H):
        t = y / H; dr.line([(0, y), (W, y)], fill=(int(11 + 18 * t), int(11 + 20 * t), int(36 + 34 * t), 255))
    moon = img('scene/moon.png'); c.alpha_composite(moon, (W - 30 - 58, 12))
    tile(c, img('scene/mountains.png'), max(-44, hz - 280), 640 - ((W - (30 + 29 - 370)) % 640))
    tile(c, img('scene/treeline.png'), max(-8, hz - 230), 404 - ((W - (30 + 29 - 274)) % 404))
    if field_img is None: tile(c, img('scene/village-field.png'), hz - 90, 0)
    else: tile(c, field_img, hz - 90, 0)
    sprites = {s['kind']: img(f"Village/{s['kind']}_t3.png") for s in slots}
    if option != 'current': c.alpha_composite(footings(slots, sprites, W, H, apron))
    for s in slots:
        im = sprites[s['kind']]
        if s.get('brightness'):
            al = im.split()[3]; im = ImageEnhance.Brightness(im.convert('RGB')).enhance(s['brightness']).convert('RGBA'); im.putalpha(al)
        x, y = s['left'], s['top']
        c.alpha_composite(im.crop((max(0, -x), max(0, -y), im.size[0], im.size[1])), (max(0, x), max(0, y)))
    lane = img('scene/lane-2track.png').resize((1280, 72), Image.NEAREST); tile(c, lane, H - 72, -(baseW - 235))
    yard = img('scene/lane-yard.png').resize((560, 72), Image.NEAREST); yx = baseW - 384
    c.alpha_composite(yard.crop((max(0, -yx), 0, 560, 72)), (max(0, yx), H - 72))
    gx = W - 120 - 48
    for f, h in (('graveyard-ground', 80), ('graveyard-fence-back', 104), ('graveyard-fence-front', 48)):
        c.alpha_composite(img(f'scene/{f}.png').resize((168, h), Image.NEAREST), (gx, H - h))
    b = img('Base/base_100.png').resize((368, 400), Image.NEAREST); bx = baseW - 372; by = H - 398
    c.alpha_composite(b.crop((max(0, -bx), max(0, -by), min(368, baseW - bx), 400)), (max(0, bx), max(0, by)))
    return c

if __name__ == '__main__':
    fields = {'current': None,
              'A': Image.fromarray(field('flat'), 'RGBA').resize((AW * 2, AH * 2), Image.NEAREST),
              'B': Image.fromarray(field('rises'), 'RGBA').resize((AW * 2, AH * 2), Image.NEAREST)}
    fields['C'] = fields['B']
    for name in ('A', 'B'): fields[name].save(f'{OUT}/field_{name}_1280x156.png')
    for tag, W, H, bw in (('laptop_1366x480', 1366, 480, 368), ('phone_800x306', 800, 306, 188)):
        for name in ('current', 'A', 'B', 'C'):
            scene(W, H, bw, fields[name], name, apron=(name == 'C')).convert('RGB').save(f'{OUT}/scene_{name}_{tag}.png')
    print('done')
