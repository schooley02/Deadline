"""Village ground rework, round 2 (2026-11-26): option B's grass (two rises + underbrush) with a PAVED pad under the whole village
(front, back and far rows), stopping short of the lane so grass stays along it. usage: python3 ground2.py <outdir>"""
import sys, json, subprocess, random, math
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
from scipy import ndimage
import ground as G
from ground import mix, vnoise, wave, img, tile, D0, D1, M, L, T, HAZE, T1, T2, AW, AH, low_edge

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
MATERIALS = {
    # base, light patch, dark patch, crack, repair patch, contact shadow, shoulder (crumbled edge)
    'asphalt': dict(base=(46, 49, 56), light=(53, 56, 63), dark=(40, 43, 50), crack=(25, 27, 33), patch=(36, 38, 45), shadow=(22, 24, 30), shoulder=(58, 58, 56), cracks=1.0, pebbles=0),
    'gravel':  dict(base=(66, 68, 64), light=(72, 73, 69), dark=(59, 63, 61), crack=(46, 50, 49), patch=(59, 63, 61), shadow=(34, 37, 37), shoulder=(52, 54, 50), cracks=0.0, pebbles=1),
}

def crests():
    X = np.arange(AW)
    c2 = np.array([9.0 + wave(x, [(1.2, 2, 2.2), (0.7, 5, 0.3), (0.4, 13, 1.1)]) for x in X])
    c1 = np.array([18.5 + wave(x, [(1.8, 1, 0.9), (1.1, 3, 4.0), (0.5, 9, 2.5)]) for x in X])
    return np.round(c1).astype(int), np.round(c2).astype(int)

def pad(slots, W, H, material, seed=21):
    """the paved ground under the village. Returns (RGBA image W x H, art-resolution mask)."""
    m = MATERIALS[material]; rnd = random.Random(seed)
    aw, ah = W // 2, H // 2
    hz = (H - 76) // 2
    rows = {r: [s for s in slots if s['row'] == r] for r in ('front', 'back', 'far')}
    ext = lambda ss, a, b: (min(s['artLeft'] for s in ss) // 2 - a, max(s['artRight'] for s in ss) // 2 + b)
    fL, fR = ext(rows['front'], 13, 12); ybot = hz + 1
    bL, bR = ext(rows['back'], 12, 10); ytb = min(s['feetY'] for s in rows['back']) // 2 - 3
    poly = [(fL, ybot), (fR, ybot), (bR, ytb)]
    far_base = min((s['top'] + s['height']) // 2 for s in rows['far']) if rows['far'] else 10 ** 6
    if far_base - 1 < ytb:
        tL, tR = ext(rows['far'], 5, 5); poly += [(tR, far_base - 1), (tL, far_base - 1)]
    poly += [(bL, ytb)]
    im = Image.new('L', (aw, ah), 0); ImageDraw.Draw(im).polygon(poly, fill=255)
    mask = np.array(im) > 0
    mask[ybot + 1:, :] = False
    # ragged, crumbling edge: bites taken out and small spills, driven by noise (never a straight line)
    nz = vnoise(6, 3, seed + 1, aw, ah); nb = vnoise(12, 4, seed + 2, aw, ah)
    for _ in range(2):
        inner = ndimage.binary_erosion(mask); edge = mask & ~inner
        mask[edge & (nz < 0.42)] = False
        outer = ndimage.binary_dilation(mask) & ~mask
        outer[ybot + 1:, :] = False
        mask[outer & (nz > 0.70)] = True
    mask = ndimage.binary_opening(mask, structure=np.ones((1, 3), bool)) | ndimage.binary_erosion(mask)
    # depth: the pad climbs the same two rises as the grass, so it takes the same haze steps and a lip on each crest
    c1, c2 = crests(); off = hz - G.HZ_ROW                       # field art row r is scene art row r + off
    yy, xx = np.mgrid[0:ah, 0:aw]
    C1 = c1[xx % AW] + off; C2 = c2[xx % AW] + off
    haze = np.where(yy < C2, T1 * 0.75, np.where(yy < C1, T2 * 0.75, np.where(yy < off + 31 + (nb - 0.5) * 8, 0.08, 0.0)))
    col = np.zeros((ah, aw, 3), float); col[:] = m['base']
    col[nb > 0.62] = m['light']; col[nb < 0.34] = m['dark']
    o = np.zeros((ah, aw, 4), np.uint8)
    def tone(c, y, x): return mix(c, float(haze[y, x]))
    lip = (yy == C1) | (yy == C2); dip = (yy == C1 - 1) | (yy == C2 - 1)
    col[lip] = m['light']; col[dip] = m['dark']
    # repaired patches (asphalt only): a few flat darker quads, flattened by the low view
    if m['cracks']:
        ys, xs = np.nonzero(mask)
        for _ in range(7):
            k = rnd.randrange(len(ys)); y, x = int(ys[k]), int(xs[k]); w = rnd.randint(7, 15); h = rnd.randint(2, 3)
            for dy in range(h):
                for dx in range(w):
                    if 0 <= y + dy < ah and 0 <= x + dx + dy < aw and mask[y + dy, x + dx + dy]: col[y + dy, x + dx + dy] = m['patch']
    for y, x in zip(*np.nonzero(mask)):
        o[y, x, :3] = tone(tuple(int(v) for v in col[y, x]), y, x); o[y, x, 3] = 255
    def put(y, x, c):
        if 0 <= y < ah and 0 <= x < aw: o[y, x, :3] = c; o[y, x, 3] = 255
    # cracks: a few long shallow wandering lines (never a grid), some with a weed in them
    ys, xs = np.nonzero(ndimage.binary_erosion(mask, iterations=2))
    if m['cracks'] and len(ys):
        for _ in range(int(11 * m['cracks'])):
            k = rnd.randrange(len(ys)); y, x = int(ys[k]), int(xs[k]); d = rnd.choice((-1, 1)); n = rnd.randint(7, 20)
            for i in range(n):
                if not (0 <= x < aw and mask[y, x]): break
                put(y, x, tone(m['crack'], y, x))
                if i == n // 2 and rnd.random() < 0.5 and y < off + 31: pass
                x += d
                if rnd.random() < 0.22: y += rnd.choice((-1, 1))
                y = max(0, min(ah - 1, y))
            if rnd.random() < 0.45 and 0 <= x < aw and mask[y, x]:
                t = float(haze[y, x]); put(y, x, mix(D1, t)); put(y - 1, x, mix(L, t))
                if t < 0.1: put(y - 2, x, mix(T, t))
    if m['pebbles'] and len(ys):
        for _ in range(len(ys) // 26):
            k = rnd.randrange(len(ys)); y, x = int(ys[k]), int(xs[k])
            if haze[y, x] > 0.2: continue
            put(y, x, tone((96, 97, 92), y, x)); put(y + 1, x, tone((48, 52, 51), y + 1, x))
    # shoulder: a broken line of loose gravel where the pad meets the grass along the front and the sides, and grass growing over the edge
    inner = ndimage.binary_erosion(mask); edge = mask & ~inner
    below_out = ~np.roll(mask, -1, axis=0)
    for y, x in zip(*np.nonzero(edge)):
        if below_out[y, x] and nz[y, x] > 0.38: put(y, x, tone(m['shoulder'], y, x))
        elif nz[y, x] > 0.6: put(y, x, tone(m['dark'], y, x))
    for y, x in zip(*np.nonzero(edge)):
        if rnd.random() < 0.20:
            t = float(haze[y, x]); h = rnd.randint(1, 2 if t > 0.1 else 3)
            put(y, x, mix(D1, t))
            for k in range(1, h + 1): put(y - k, x, mix(T if k == h and h > 1 else L, t))
    return Image.fromarray(o, 'RGBA').resize((aw * 2, ah * 2), Image.NEAREST), mask

def shadows(slots, sprites, W, H, mask, material):
    """contact shadows on the pad; on grass the round-1 footing (trampled grass + shadow) is kept"""
    m = MATERIALS[material]
    aw, ah = W // 2, H // 2
    o = np.zeros((ah, aw, 4), np.uint8)
    def put(y, x, c):
        if 0 <= y < ah and 0 <= x < aw: o[y, x, :3] = c; o[y, x, 3] = 255
    nz = vnoise(7, 3, 12, aw, ah)
    for s in slots:
        low = low_edge(sprites[s['kind']]); mb = low.max(); cols = {}
        for c in range(len(low)):
            if low[c] < mb - 30: continue
            ax = (s['left'] + c) // 2; ay = (s['top'] + low[c] + 2) // 2
            cols[ax] = max(cols.get(ax, -1), ay)
        t = {'far': T1 * 0.6, 'back': T2 * 0.5, 'front': 0.0}[s['row']]
        xs = sorted(cols)
        for ax in xs:
            ay = cols[ax]; on = 0 <= ay < ah and 0 <= ax < aw and mask[ay, ax]
            sh = mix(m['shadow'], t) if on else mix(G.SH, t)
            put(ay, ax, sh); put(ay, ax - 1, sh)
            if nz[ay % ah, ax % aw] > 0.45: put(ay + 1, ax - 1, mix(m['dark'] if on else D0, t))
        for k in range(1, 4): put(cols[xs[0]], xs[0] - k, mix(m['shadow'] if (0 <= cols[xs[0]] < ah and mask[cols[xs[0]], max(0, xs[0] - k)]) else D0, t))
    return Image.fromarray(o, 'RGBA').resize((aw * 2, ah * 2), Image.NEAREST)

def scene(W, H, baseW, field_img, material, bare=False):
    slots = json.loads(subprocess.check_output(['node', f'{OUT}/slots.js', G.CODE, json.dumps({"W": W, "H": H, "baseW": baseW})]))
    hz = H - 76
    c = Image.new('RGBA', (W, H), (11, 11, 36, 255)); dr = ImageDraw.Draw(c)
    for y in range(H):
        t = y / H; dr.line([(0, y), (W, y)], fill=(int(11 + 18 * t), int(11 + 20 * t), int(36 + 34 * t), 255))
    c.alpha_composite(img('scene/moon.png'), (W - 30 - 58, 12))
    tile(c, img('scene/mountains.png'), max(-44, hz - 280), 640 - ((W - (30 + 29 - 370)) % 640))
    tile(c, img('scene/treeline.png'), max(-8, hz - 230), 404 - ((W - (30 + 29 - 274)) % 404))
    tile(c, field_img, hz - 90, 0)
    sprites = {s['kind']: img(f"Village/{s['kind']}_t3.png") for s in slots}
    if material:
        p, mask = pad(slots, W, H, material); c.alpha_composite(p)
        c.alpha_composite(shadows(slots, sprites, W, H, mask, material))
    else:
        c.alpha_composite(G.footings(slots, sprites, W, H, False))
    for s in ([] if bare else slots):
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
    fb = Image.fromarray(G.field('rises'), 'RGBA').resize((AW * 2, AH * 2), Image.NEAREST)
    for tag, W, H, bw in (('laptop_1366x480', 1366, 480, 368), ('phone_800x306', 800, 306, 188)):
        for name, mat in (('B', None), ('B_asphalt', 'asphalt'), ('B_gravel', 'gravel')):
            scene(W, H, bw, fb, mat).convert('RGB').save(f'{OUT}/r2_{name}_{tag}.png')
    scene(1366, 480, 368, fb, 'asphalt', bare=True).convert('RGB').save(f'{OUT}/r2_bare_asphalt_laptop.png')
    print('done')
