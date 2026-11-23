"""Block-out compositor for the Deadline graveyard rework.
usage: python3 -I scene.py <projectRoot> <outDir>
Builds the phone-landscape scene from the real art at 1 CSS px = 1 px, then swaps the graveyard for sketched options.
"""
import json, math, random, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont

ROOT, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
A = lambda p: Image.open(os.path.join(ROOT, 'Assets', p)).convert('RGBA')

FLOOR = 72
BASE_W = 188
BLEED = 4


def slots(cw, ch, hill_w):
    out = subprocess.check_output(['node', os.path.join(HERE, 'slots.js'), ROOT, str(cw), str(ch), str(BASE_W), str(hill_w)])
    return json.loads(out)


def up2(im):
    return im.resize((im.width * 2, im.height * 2), Image.NEAREST)


def dim(im, k):
    r, g, b, a = im.split()
    f = lambda c: c.point(lambda v: int(v * k))
    return Image.merge('RGBA', (f(r), f(g), f(b), a))


def tile_x(dst, tile, x0, y):
    x = x0
    while x > 0:
        x -= tile.width
    while x < dst.width:
        dst.alpha_composite(tile, (x, y)) if y >= 0 and x >= 0 else paste_clip(dst, tile, x, y)
        x += tile.width


def paste_clip(dst, src, x, y):
    """alpha-composite src at (x, y), clipping to dst."""
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(src.width, dst.width - x), min(src.height, dst.height - y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    dst.alpha_composite(src.crop((sx0, sy0, sx1, sy1)), (max(0, x), max(0, y)))


def sky(cw, ch):
    im = Image.new('RGBA', (cw, ch))
    d = ImageDraw.Draw(im)
    top, bot = (12, 14, 34), (38, 42, 78)
    for y in range(ch):
        t = min(1, y / max(1, ch - FLOOR))
        d.line([(0, y), (cw, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
    return im


def backdrop(cw, ch, sl):
    im = sky(cw, ch)
    front = [s for s in sl if s['row'] == 'front']
    hz = front[0]['feetY'] if front else ch - FLOOR - 4
    moon = A('scene/moon.png').resize((58, 58), Image.NEAREST)
    paste_clip(im, moon, cw - 32 - 58, int(ch * 0.08))
    mt = A('scene/mountains.png')
    tile_x(im, mt, cw + 311 - 640, max(-44, hz - 280))
    tl = A('scene/treeline.png')
    tile_x(im, tl, cw + 215 - 404, max(-8, hz - 230))
    fd = A('scene/village-field.png')
    tile_x(im, fd, 0, hz - 90)
    return im, hz


def village(im, sl):
    for s in sl:
        sp = A('Village/%s_t%d.png' % (s['kind'], s['tier']))
        if (sp.width, sp.height) != (s['width'], s['height']):
            sp = sp.resize((s['width'], s['height']), Image.NEAREST)
        if s.get('flip'):
            sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        if s.get('brightness'):
            sp = dim(sp, s['brightness'])
        paste_clip(im, sp, s['left'], s['top'])


def ground(im, cw, ch):
    lane = up2(A('scene/lane-2track.png'))
    yard = up2(A('scene/lane-yard.png'))
    tile_x(im, lane, BASE_W - 235, ch - FLOOR)
    paste_clip(im, yard, BASE_W - 384, ch - FLOOR)


def church(im, cw, ch):
    art = up2(A('Base/base_100.png'))  # 368x400
    box = Image.new('RGBA', (BASE_W, ch))
    paste_clip(box, art, BASE_W - 368, ch + 2 - 400)
    paste_clip(im, box, -BLEED, 0)
    bar = up2(A('Barricade/barricade_solid.png')).crop((0, 0, 238, 150))
    paste_clip(im, bar, BASE_W - 48, ch - 150)


# ---------------------------------------------------------------- today's graveyard
MARKER_SLOTS = [(10, 48), (94, 44), (118, 62), (46, 38), (70, 24), (118, 22), (22, 18)]
STAGES = [2, 0, 3, 1, 4, 2, 0]


STONE_DIR = None


def stones(layer, zone_left, ch, placed, size=48):
    """placed: [(x_centre_from_zone_left, feet_above_bottom, stage)], drawn back (high feet) to front."""
    for x, feet, st in sorted(placed, key=lambda p: -p[1]):
        hs = (Image.open(os.path.join(STONE_DIR, 'headstone-%d_24x24.png' % st)).convert('RGBA') if STONE_DIR else A('scene/headstone-%d.png' % st)).resize((size, size), Image.NEAREST)
        paste_clip(layer, hs, zone_left + x - size // 2, ch - feet - size)


def graveyard_today(im, cw, ch):
    zl = cw - 140
    # tree (clipped at the canvas's right edge by paste_clip), giant stage
    tree = A('scene/graveyard-tree-3.png')
    paste_clip(im, tree, zl + 110 - 146, ch - (101 - 5) - 128)
    paste_clip(im, A('scene/graveyard-hill.png'), cw - 192, ch - 128)
    mem = A('Village/memorial_t3.png')
    paste_clip(im, mem, zl + 60 - 64, ch - (74 - 10) - 192)
    stones(im, zl, ch, [(x, f, STAGES[i]) for i, (x, f) in enumerate(MARKER_SLOTS)])
    return zl, cw - 192


# ---------------------------------------------------------------- sketched options (art px = 2 screen px)
GRASS_DEEP, GRASS_SH, GRASS_MID, GRASS_LT, GRASS_HI = (18, 32, 30), (38, 60, 51), (52, 77, 63), (68, 95, 75), (98, 122, 98)
STONE = [(74, 79, 76), (88, 89, 84), (64, 68, 68), (100, 102, 96)]
MORTAR = (28, 31, 33)
CAP = (128, 130, 124)
BARK = (44, 38, 50)
BARK_D = (28, 24, 34)
BARK_RIM = (124, 120, 140)
TWIG = (84, 78, 100)


def bank_art(zone_w, crest, wall_h=24, ret=8, seed=3):
    """Walled hillside. Returns an RGBA image (screen px): right edge = the canvas edge, bottom = the canvas bottom.
    zone_w: reserved zone width. crest: crest height above the canvas bottom. ret: width of the left return wall."""
    rnd = random.Random(seed)
    W, H = (zone_w + ret) // 2, (crest + 10) // 2
    wh, r, ct = wall_h // 2, ret // 2, crest // 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            px[x, H - 1 - y] = c + (255,)

    def top(x):  # grass silhouette (art px above the bottom) at art column x
        if x < r:
            return wh
        t = (x - r) / max(1, W - 1 - r)
        rise = 1 - math.exp(-10.0 * t)
        return int(round(wh + 5 + (ct - wh - 5) * rise + 0.7 * math.sin(x * 0.6)))

    for x in range(r, W):
        t = top(x)
        for y in range(wh, t):
            f = (y - wh) / max(1, ct - wh)            # 0 at the wall, 1 at the crest
            c = GRASS_SH if f < 0.30 else GRASS_MID if f < 0.72 else GRASS_LT
            if t - y <= 1:
                c = GRASS_HI                          # moonlit crest line
            put(x, y, c)
        put(x, t - 1, GRASS_HI)
    # the shoulder's shaded edge (left = away from the moon)
    for x in range(r, r + 3):
        for y in range(wh, top(x)):
            put(x, y, GRASS_DEEP if x <= r + 1 else GRASS_SH)
    # soft flat clumps + separate tufts, like the lane grass
    for _ in range(W // 2):
        cx, cy = rnd.randrange(r + 3, W - 1), rnd.randrange(wh + 1, ct - 2)
        f = (cy - wh) / max(1, ct - wh)
        c = rnd.choice([GRASS_SH, GRASS_DEEP]) if f < 0.5 else rnd.choice([GRASS_MID, GRASS_SH])
        for dx in range(-2, 3):
            for dy in (0, 1):
                if abs(dx) + dy * 2 < 3 and cy + dy < top(cx + dx) - 1 and cx + dx >= r + 1:
                    put(cx + dx, cy + dy, c)
    for _ in range(W // 2):
        cx, cy = rnd.randrange(r + 3, W - 1), rnd.randrange(wh + 2, ct - 1)
        if cy < top(cx) - 2:
            put(cx, cy, GRASS_HI if rnd.random() < 0.4 else GRASS_LT)
            put(cx, cy - 1, GRASS_DEEP)
    for x in range(r + 1, W):                         # blade fringe along the crest
        if rnd.random() < 0.45:
            t = top(x)
            put(x, t, GRASS_LT)
            if rnd.random() < 0.35:
                put(x, t + 1, GRASS_MID)
    # retaining wall, front face: irregular fieldstones
    for x in range(r, W):
        for y in range(0, wh):
            put(x, y, MORTAR)
    y = 0
    while y < wh - 2:
        sh = min(rnd.choice([3, 3, 4]), wh - 2 - y)
        x = r - rnd.randrange(0, 3)
        while x < W:
            sw = rnd.choice([4, 5, 5, 6, 7])
            c = rnd.choice(STONE)
            for xx in range(x, x + sw - 1):
                for yy in range(y + 1, y + sh):
                    corner = (xx in (x, x + sw - 2)) and (yy in (y + 1, y + sh - 1)) and sh > 2 and rnd.random() < 0.6
                    if xx >= r and not corner:
                        lit = (yy == y + sh - 1)
                        put(xx, yy, tuple(min(255, v + 12) for v in c) if lit else c)
            x += sw
        y += sh
    for x in range(r, W):                             # cap course, moonlit, with joints
        put(x, wh - 1, CAP if x % 6 else MORTAR)
        put(x, wh - 2, STONE[3] if x % 6 else MORTAR)
    # left return (the three-quarter side face, in shadow, receding)
    for x in range(0, r):
        hh = wh - (r - x)
        for yy in range(0, hh):
            put(x, yy, MORTAR if (yy % 3 == 0 or (x + (yy // 3)) % 4 == 0) else (52, 56, 58))
        put(x, hh - 1, STONE[0])
    return up2(im)


def bare_tree(h_px=150, w_px=200, base_x=110, lean=-0.05, seed=11):
    """Bare gnarled tree, art px = 2 screen px. Returns (image, trunk_base_x) in screen px; the bottom row is the trunk's foot."""
    rnd = random.Random(seed)
    W, H = w_px // 2, h_px // 2
    thick = Image.new('L', (W, H), 0)   # limbs
    thin = Image.new('L', (W, H), 0)    # twigs
    tp, wp = thick.load(), thin.load()
    bx = base_x // 2

    def dot(buf, x, y, rad):
        r = max(0.5, rad)
        k = int(r) + 1
        for dx in range(-k, k + 1):
            for dy in range(-k, k + 1):
                if dx * dx + dy * dy <= r * r:
                    X, Y = int(round(x + dx)), int(round(y + dy))
                    if 0 <= X < W and 0 <= Y < H:
                        buf[X, Y] = 255

    def branch(x, y, ang, length, th, depth):
        steps = max(3, int(length))
        bend = rnd.uniform(-0.035, 0.035)
        for i in range(steps):
            ang += bend + rnd.uniform(-0.04, 0.04)
            x += math.sin(ang)
            y -= math.cos(ang)
            t = th * (1 - 0.3 * i / steps)
            dot(tp if t >= 1.6 else wp, x, y, t / 2)
        if depth <= 0:
            return
        n = 3 if depth >= 3 else 2
        for k in range(n):
            if n == 3 and k == 2:
                spread = rnd.uniform(-0.2, 0.2)
            else:
                spread = rnd.uniform(0.32, 0.7) * (1 if k == 0 else -1)
            branch(x, y, ang + spread, length * rnd.uniform(0.58, 0.74), th * rnd.uniform(0.55, 0.68), depth - 1)

    for i in range(-5, 6):                               # root flare
        dot(tp, bx + i, H - 1, 1.6 if abs(i) < 4 else 0.8)
    branch(bx, H - 1, lean, H * 0.34, 9.0, 5)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    for x in range(W):
        for y in range(H):
            if tp[x, y]:
                right_open = x + 1 >= W or not tp[x + 1, y]
                right2_open = x + 2 >= W or not tp[x + 2, y]
                left_open = x == 0 or not tp[x - 1, y]
                c = BARK_RIM if right_open else (96, 92, 112) if right2_open and not left_open else BARK_D if left_open else BARK
                px[x, y] = c + (255,)
            elif wp[x, y]:
                px[x, y] = TWIG + (255,)
    return up2(im), bx * 2


IRON, IRON_RIM, IRON_FAR = (16, 17, 24), (96, 100, 122), (40, 42, 58)


def rise_art(zone_w, crest, reach=16, seed=5):
    """Low grassy rise with no wall (screen px): right edge = the canvas edge, bottom = the canvas bottom.
    reach: how far the short left slope runs past the zone."""
    rnd = random.Random(seed)
    W, H = (zone_w + reach) // 2, (crest + 10) // 2
    r, ct = reach // 2, crest // 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            px[x, H - 1 - y] = c + (255,)

    def top(x):
        t = x / max(1, W - 1)
        return int(round(ct * (1 - math.exp(-7.0 * t)) + 0.7 * math.sin(x * 0.6)))

    for x in range(W):
        t = top(x)
        for y in range(0, t):
            f = y / max(1, ct)
            c = GRASS_SH if f < 0.28 else GRASS_MID if f < 0.70 else GRASS_LT
            put(x, y, c)
        if t > 0:
            put(x, t - 1, GRASS_HI)
            put(x, t - 2, GRASS_LT)
    for x in range(0, r):                             # shaded left slope
        for y in range(0, top(x) - 1):
            put(x, y, GRASS_DEEP if y < top(x) - 3 else GRASS_SH)
    for _ in range(W):
        cx, cy = rnd.randrange(r, W - 1), rnd.randrange(1, ct - 2)
        if cy < top(cx) - 2:
            c = rnd.choice([GRASS_SH, GRASS_DEEP]) if cy < ct * 0.5 else rnd.choice([GRASS_MID, GRASS_SH])
            for dx in range(-2, 3):
                if cy < top(cx + dx) - 2 and cx + dx >= r:
                    put(cx + dx, cy, c)
    for _ in range(W // 2):
        cx, cy = rnd.randrange(r, W - 1), rnd.randrange(2, ct - 1)
        if cy < top(cx) - 2:
            put(cx, cy, GRASS_HI if rnd.random() < 0.4 else GRASS_LT)
            put(cx, cy - 1, GRASS_DEEP)
    for x in range(1, W):
        if rnd.random() < 0.45:
            put(x, top(x), GRASS_LT)
    return up2(im), top, r


def iron_fence(w_px, h_px=30, pitch=4, post_every=5, far=False):
    """Wrought-iron run (screen px), bars 1 art px wide with spear tips, two rails, taller posts with a ball finial."""
    W, H = w_px // 2, h_px // 2 + 3
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    body, rim = (IRON_FAR, IRON_FAR) if far else (IRON, IRON_RIM)
    bh = h_px // 2

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            px[x, H - 1 - y] = c + (255,)

    for x in range(W):
        put(x, 2, body)
        put(x, bh - 4, body)
        if not far:
            put(x, bh - 3, rim) if x % 2 == 0 else None
    n = 0
    for x in range(0, W, pitch):
        post = (n % post_every == 0)
        top = bh + (2 if post else 0)
        for y in range(0, top):
            put(x, y, body)
            if post:
                put(x + 1, y, rim if (y > 2 and not far) else body)
        if post:
            put(x, top, body); put(x + 1, top, body); put(x, top + 1, rim); put(x + 1, top + 1, body)
        else:
            put(x, top, rim)                      # spear tip catches the moon
        n += 1
    return up2(im)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(c1[i], c2[i], t))) for i in range(3))


def rise2_art(zone_w, crest, reach, run, seed=5):
    """Low grassy rise whose left shoulder is a clean ramp (so a fence can climb it). Screen px; right edge = canvas edge.
    reach: px the foot of the ramp starts left of the zone. run: horizontal length of the ramp."""
    rnd = random.Random(seed)
    W, H = (zone_w + reach) // 2, (crest + 10) // 2
    ct, rn = crest // 2, run // 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            px[x, H - 1 - y] = c + (255,)

    def top(x):
        if x <= rn:
            return int(round(ct * (x / rn) ** 0.85))
        return int(round(ct + 0.7 * math.sin(x * 0.6)))

    for x in range(W):
        t = top(x)
        for y in range(0, t):
            f = y / max(1, ct)
            put(x, y, GRASS_SH if f < 0.28 else GRASS_MID if f < 0.70 else GRASS_LT)
        if t > 1:
            put(x, t - 1, GRASS_HI if x > rn else GRASS_SH)
            put(x, t - 2, GRASS_LT if x > rn else GRASS_DEEP)
    for _ in range(W):
        cx, cy = rnd.randrange(2, W - 1), rnd.randrange(1, ct - 2)
        if cy < top(cx) - 3:
            c = rnd.choice([GRASS_SH, GRASS_DEEP]) if cy < ct * 0.5 else rnd.choice([GRASS_MID, GRASS_SH])
            for dx in range(-2, 3):
                if 0 <= cx + dx < W and cy < top(cx + dx) - 3:
                    put(cx + dx, cy, c)
    for _ in range(W // 2):
        cx, cy = rnd.randrange(2, W - 1), rnd.randrange(2, ct - 1)
        if cy < top(cx) - 3:
            put(cx, cy, GRASS_HI if rnd.random() < 0.4 else GRASS_LT)
            put(cx, cy - 1, GRASS_DEEP)
    for x in range(rn + 1, W):
        if rnd.random() < 0.45:
            put(x, top(x), GRASS_LT)
    return up2(im)


def side_run(cw, ch, p0, p1, h0, h1, step=4):
    """Fence run climbing from p0 to p1 (screen px, y up from the canvas bottom): upright bars, rails that follow the slope,
    bars shorter and dimmer toward the far end. Returns a canvas-size overlay."""
    W, H = cw // 2, ch // 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H:
            px[x, H - 1 - y] = c + (255,)

    x0, y0, x1, y1 = p0[0] / 2, p0[1] / 2, p1[0] / 2, p1[1] / 2
    n = max(2, int(round((p1[0] - p0[0]) / step)))
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):                      # the two rails
        t = i / steps
        c = mix(IRON, IRON_FAR, t)
        hh = lerp(h0, h1, t) / 2
        put(lerp(x0, x1, t), lerp(y0, y1, t) + 2, c)
        put(lerp(x0, x1, t), lerp(y0, y1, t) + hh - 4, c)
    for k in range(n + 1):                          # upright bars with a moonlit tip
        t = k / n
        c = mix(IRON, IRON_FAR, t)
        bx, by, hh = lerp(x0, x1, t), lerp(y0, y1, t), lerp(h0, h1, t) / 2
        for j in range(int(round(hh))):
            put(bx, by + j, c)
        put(bx, by + int(round(hh)), mix(IRON_RIM, IRON_FAR, t * 0.7))
    return up2(im)


def corner_post(h_px=36):
    W, H = 3, h_px // 2 + 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    for y in range(h_px // 2):
        px[0, H - 1 - y] = IRON + (255,)
        px[1, H - 1 - y] = IRON + (255,)
        if y > 1:
            px[2, H - 1 - y] = IRON_RIM + (255,)
    for x, y, c in [(0, h_px // 2, IRON), (1, h_px // 2, IRON), (2, h_px // 2, IRON_RIM), (1, h_px // 2 + 1, IRON_RIM)]:
        px[x, H - 1 - y] = c + (255,)
    return up2(im)


def graveyard_fenced(im, cw, ch, zone_w, crest, rows, mem_x, mem_feet, reach=12, run=40, stone_px=48):
    zl = cw - zone_w
    rise = rise2_art(zone_w, crest, reach, run)
    paste_clip(im, rise, cw - rise.width, ch - rise.height)
    p0 = (zl - reach + 2, 2)                         # front-left corner, at the foot of the ramp
    p1 = (zl - reach + run, crest - 4)               # back-left corner, where the ramp meets the crest
    back = iron_fence(cw - p1[0], h_px=20, pitch=3, post_every=6, far=True)
    paste_clip(im, back, p1[0], ch - p1[1] - back.height)
    im.alpha_composite(side_run(cw, ch, p0, p1, 30, 20))
    placed, i = [], 0
    for feet, xs in rows:
        for x in xs:
            placed.append((x, feet, STAGES[i % len(STAGES)]))
            i += 1
    stones(im, zl, ch, [p for p in placed if p[1] >= mem_feet - 4], stone_px)
    mem = A('Village/memorial_t3.png')
    paste_clip(im, mem, zl + mem_x - 64, ch - (mem_feet - 10) - 192)
    stones(im, zl, ch, [p for p in placed if p[1] < mem_feet - 4], stone_px)
    front = iron_fence(cw - p0[0], h_px=30)
    paste_clip(im, front, p0[0], ch - front.height - p0[1])
    post = corner_post(36)
    paste_clip(im, post, p0[0] - 2, ch - post.height - p0[1])
    return zl, cw - rise.width


class Ink:
    """Half-res drawing layer over the whole canvas; coordinates are screen px with y measured UP from the canvas bottom."""
    def __init__(self, cw, ch):
        self.W, self.H = cw // 2, ch // 2
        self.im = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        self.px = self.im.load()

    def put(self, x, y, c):
        x, y = int(round(x / 2)), int(round(y / 2))
        if 0 <= x < self.W and 0 <= y < self.H:
            self.px[x, self.H - 1 - y] = tuple(c) + (255,)

    def line(self, p, q, c):
        n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1]))) + 1
        for i in range(n + 1):
            t = i / n
            self.put(lerp(p[0], q[0], t), lerp(p[1], q[1], t), c)

    def bar(self, x, y, h, c, tip=None, wide=False):
        for j in range(0, int(h), 2):
            self.put(x, y + j, c)
            if wide:
                self.put(x + 2, y + j, c)
        if tip:
            self.put(x, y + h, tip)

    def out(self):
        return up2(self.im)


def run(ink, p0, p1, h0, h1, step=8, far0=0.0, far1=0.0, post_every=5):
    """Fence run from p0 to p1: upright bars, two rails that follow the ground line, a taller post every few bars."""
    n = max(1, int(round(math.hypot(p1[0] - p0[0], (p1[1] - p0[1])) / step)))
    c0, c1 = mix(IRON, IRON_FAR, far0), mix(IRON, IRON_FAR, far1)
    ink.line((p0[0], p0[1] + 4), (p1[0], p1[1] + 4), c0 if far1 < 0.5 else c1)
    ink.line((p0[0], p0[1] + h0 - 8), (p1[0], p1[1] + h1 - 8), c0 if far1 < 0.5 else c1)
    for k in range(n + 1):
        t = k / n
        c = mix(c0, c1, t)
        x, y, h = lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t), lerp(h0, h1, t)
        post = post_every and k % post_every == 0
        ink.bar(x, y, h + (4 if post else 0), c, tip=(c if post else mix(IRON_RIM, IRON_FAR, lerp(far0, far1, t) * 0.7)), wide=bool(post))


def gate(ink, p0, p1, post_h=46, leaf_dir=(9, 8), leaf_h=30):
    """Open wrought-iron gate between two posts at p0 and p1: arch overhead, both leaves swung open along leaf_dir."""
    for p in (p0, p1):
        for dx in (0, 2):
            for j in range(0, post_h, 2):
                ink.put(p[0] + dx, p[1] + j, IRON_RIM if (dx == 2 and j > 4) else IRON)
        ink.put(p[0], p[1] + post_h, IRON); ink.put(p[0] + 2, p[1] + post_h, IRON_RIM); ink.put(p[0] + 1, p[1] + post_h + 2, IRON_RIM)
    n = 24
    prev = None
    for i in range(n + 1):                          # arch: two curved rails with short pickets between
        t = i / n
        x = lerp(p0[0] + 1, p1[0] + 1, t)
        yb = lerp(p0[1], p1[1], t) + post_h - 4
        lift = 12 * math.sin(math.pi * t)
        ink.put(x, yb + lift, mix(IRON, IRON_RIM, 0.55))
        ink.put(x, yb + lift * 0.45 - 4, IRON)
        if i % 3 == 0:
            for j in range(int(yb + lift * 0.45 - 4), int(yb + lift), 2):
                ink.put(x, j, IRON)
        if i == n // 2:
            ink.put(x, yb + lift + 2, IRON); ink.put(x, yb + lift + 4, IRON_RIM)
    for p in (p0, p1):                              # the two leaves, standing open
        q = (p[0] + leaf_dir[0], p[1] + leaf_dir[1])
        ink.line((p[0], p[1] + 4), (q[0], q[1] + 4), IRON)
        ink.line((p[0], p[1] + leaf_h), (q[0], q[1] + leaf_h - 2), IRON)
        m = max(2, int(max(abs(leaf_dir[0]), abs(leaf_dir[1])) / 3))
        for k in range(1, m + 1):
            t = k / m
            ink.bar(lerp(p[0], q[0], t), lerp(p[1], q[1], t), leaf_h, IRON, tip=IRON_RIM if k == m else None)


def hill_art(zone_w, crest, foot, reach=0, seed=5):
    """Rounded grassy hill (screen px; right edge = canvas edge, bottom = canvas bottom). foot: px in from the zone's left edge
    where its left flank meets the ground; the flank bulges up from there to the crest. Moonlit from the upper right."""
    rnd = random.Random(seed)
    W, H = (zone_w + reach) // 2, (crest + 10) // 2
    ct, f0 = crest // 2, (foot + reach) // 2
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            px[x, H - 1 - y] = c + (255,)

    def top(x):
        if x < f0:
            return 0
        d = (x - f0)
        return int(round(ct * (1 - math.exp(-d / 7.5)) ** 0.8 + (0.6 * math.sin(x * 0.6) if d > 24 else 0)))

    for x in range(f0, W):
        t = top(x)
        for y in range(0, t):
            f = y / max(1, ct)
            c = GRASS_SH if f < 0.28 else GRASS_MID if f < 0.70 else GRASS_LT
            edge = 0                                   # distance to the left silhouette on this row
            while edge < 12 and x - edge - 1 >= f0 and top(x - edge - 1) > y:
                edge += 1
            if edge < 3:
                c = GRASS_DEEP
            elif edge < 7:
                c = GRASS_SH
            elif edge < 11 and c == GRASS_LT:
                c = GRASS_MID
            put(x, y, c)
        if t > 1 and x - f0 > 14:
            put(x, t - 1, GRASS_HI)
    for _ in range(W):
        cx, cy = rnd.randrange(f0 + 6, W - 1), rnd.randrange(1, ct - 2)
        if cy < top(cx - 5) - 3:
            c = rnd.choice([GRASS_SH, GRASS_DEEP]) if cy < ct * 0.5 else rnd.choice([GRASS_MID, GRASS_SH])
            for dx in range(-2, 3):
                if cx + dx < W and cy < top(cx + dx - 5) - 3:
                    put(cx + dx, cy, c)
    for _ in range(W // 2):
        cx, cy = rnd.randrange(f0 + 8, W - 1), rnd.randrange(2, ct - 1)
        if cy < top(cx - 6) - 3:
            put(cx, cy, GRASS_HI if rnd.random() < 0.4 else GRASS_LT)
            put(cx, cy - 1, GRASS_DEEP)
    for x in range(f0 + 16, W):
        if rnd.random() < 0.45:
            put(x, top(x), GRASS_LT)
    return up2(im)


SLANT = 88 / 72.0   # the lane / barricade diagonal: px to the right per px of depth (up)


def graveyard_gated(im, cw, ch, zone_w, crest, rows, mem_x, mem_feet, style, reach=28, foot=8, depth=30, front_gate=None, stone_px=48):
    """style 'side': an open gate IS the left side, standing on the lane diagonal. style 'front': a plain fence runs back along the
    hill's foot on that diagonal and disappears behind the hill; the open gate is in the front run (front_gate = (x0, x1) from the zone)."""
    zl = cw - zone_w
    c0 = (zl - reach, 2)                                  # front-left corner post
    c1 = (c0[0] + depth * SLANT, c0[1] + depth)           # where the left side reaches, further back
    behind = Ink(cw, ch)
    if style == 'side':
        gate(behind, c0, c1, post_h=46, leaf_dir=(-12, 0), leaf_h=30)
    else:
        far = (c0[0] + (depth + 26) * SLANT, c0[1] + depth + 26)
        run(behind, c0, far, 30, 22, step=7, far0=0.0, far1=0.8, post_every=4)
    im.alpha_composite(behind.out())
    hill = hill_art(zone_w, crest, foot)
    paste_clip(im, hill, cw - hill.width, ch - hill.height)
    placed, i = [], 0
    for feet, xs in rows:
        for x in xs:
            placed.append((x, feet, STAGES[i % len(STAGES)]))
            i += 1
    stones(im, zl, ch, [p for p in placed if p[1] >= mem_feet - 4], stone_px)
    mem = A('Village/memorial_t3.png')
    paste_clip(im, mem, zl + mem_x - 64, ch - (mem_feet - 10) - 192)
    stones(im, zl, ch, [p for p in placed if p[1] < mem_feet - 4], stone_px)
    front = Ink(cw, ch)
    if style == 'front' and front_gate:
        g0, g1 = (zl + front_gate[0], 2), (zl + front_gate[1], 2)
        run(front, (g1[0] + 8, 2), (cw + 8, 2), 30, 30, post_every=5)
        gate(front, g0, g1, post_h=46, leaf_dir=(8 * SLANT, 8), leaf_h=30)
    else:
        run(front, c0, (cw + 8, 2), 30, 30, post_every=5)
    for j in range(0, 36, 2):                             # corner post
        front.put(c0[0], 2 + j, IRON); front.put(c0[0] + 2, 2 + j, IRON_RIM if j > 4 else IRON)
    front.put(c0[0] + 1, 40, IRON_RIM)
    im.alpha_composite(front.out())
    return zl, zl - reach


LANE_GRASS = [(21, 38, 34), (30, 50, 42), (41, 61, 53), (51, 73, 62), (12, 26, 24)]


def flat_ground(cw, ch, x_left, top_h, seed=9):
    """Flat grass at the lane's own level and colours (canvas-size overlay). Its left edge follows the lane diagonal from
    (x_left, 0) up to the band top, with a ragged tufted edge; it covers the lane band to the right of that line."""
    rnd = random.Random(seed)
    ink = Ink(cw, ch)
    base, mid, lt, hi, deep = LANE_GRASS
    for y in range(0, top_h, 2):
        x0 = x_left + y * SLANT + rnd.choice([-2, 0, 0, 2])
        for x in range(int(x0), cw + 2, 2):
            ink.put(x, y, base)
        ink.put(x0, y, deep)
    for _ in range(int((cw - x_left) * top_h / 150)):         # soft flat clumps
        cy = rnd.randrange(2, top_h - 2)
        cx = rnd.uniform(x_left + cy * SLANT + 8, cw)
        c = rnd.choice([mid, mid, deep])
        for dx in range(-4, 6, 2):
            ink.put(cx + dx, cy, c)
        if rnd.random() < 0.5:
            ink.put(cx, cy + 2, c); ink.put(cx + 2, cy + 2, c)
    for _ in range(int((cw - x_left) * top_h / 260)):         # separate tufts
        cy = rnd.randrange(2, top_h - 2)
        cx = rnd.uniform(x_left + cy * SLANT + 6, cw)
        ink.put(cx, cy, lt); ink.put(cx, cy + 2, hi if rnd.random() < 0.4 else lt)
    for x in range(int(x_left + top_h * SLANT), cw, 2):        # blade fringe along the back edge
        if rnd.random() < 0.5:
            ink.put(x, top_h, mid)
    return ink.out()


def simple_gate(ink, x0, x1, y, post_h=44, leaf_h=28, swing=(10, 8)):
    """Plain open gate in a front run: two posts with ball tops, no arch, both leaves swung back into the yard."""
    for x in (x0, x1):
        for j in range(0, post_h, 2):
            ink.put(x - 2, y + j, IRON); ink.put(x, y + j, IRON); ink.put(x + 2, y + j, IRON)
        for dx in (-2, 0, 2):
            ink.put(x + dx, y + post_h, IRON)
        ink.put(x, y + post_h + 2, IRON); ink.put(x + 2, y + post_h + 2, IRON); ink.put(x, y + post_h + 4, IRON)
        q = (x + swing[0], y + swing[1])
        ink.line((x + 2, y + 4), (q[0], q[1] + 4), IRON)
        ink.line((x + 2, y + leaf_h - 2), (q[0], q[1] + leaf_h - 4), IRON)
        for k in (0.5, 1.0):
            ink.bar(lerp(x + 2, q[0], k), lerp(y, q[1], k), leaf_h - 2, IRON, tip=IRON_RIM)


def graveyard_flat(im, cw, ch, zone_w, rows, mem_x, mem_feet, depth=44, reach=36, gate_x=(-14, 26), band=72, stone_px=48):
    zl = cw - zone_w
    c0 = (zl - reach, 2)                                   # front-left corner
    c1 = (c0[0] + depth * SLANT, c0[1] + depth)            # back-left corner, on the lane diagonal
    im.alpha_composite(flat_ground(cw, ch, c0[0] - 6, band))
    behind = Ink(cw, ch)
    run(behind, c1, (cw + 8, c1[1]), 24, 24, step=6, far0=0.75, far1=0.75, post_every=6)   # back run
    run(behind, c0, c1, 30, 24, step=7, far0=0.0, far1=0.75, post_every=0)                  # left side, receding
    im.alpha_composite(behind.out())
    placed, i = [], 0
    for feet, xs in rows:
        for x in xs:
            placed.append((x, feet, STAGES[i % len(STAGES)]))
            i += 1
    mem = A('Village/memorial_t3.png')
    paste_clip(im, mem, zl + mem_x - 64, ch - (mem_feet - 10) - 192)
    stones(im, zl, ch, placed, stone_px)
    front = Ink(cw, ch)
    run(front, c0, (cw + 8, 2), 30, 30, post_every=5)   # one continuous front run, no gate
    for j in range(0, 36, 2):                              # corner post
        front.put(c0[0], 2 + j, IRON); front.put(c0[0] + 2, 2 + j, IRON)
    front.put(c0[0] + 1, 40, IRON)
    im.alpha_composite(front.out())
    return zl, zl - reach


def graveyard_compact(im, cw, ch, zone_w=64, depth=70, reach=24, band=72):
    """Stand-in for a small-screen graveyard picture: one small fenced plot, a half-size Memorial and three small stones.
    The whole thing would be ONE tap target that opens the full graveyard in a window."""
    zl = cw - zone_w
    c0 = (zl - reach, 2)
    c1 = (c0[0] + depth * SLANT, c0[1] + depth)
    im.alpha_composite(flat_ground(cw, ch, c0[0] - 6, band))
    behind = Ink(cw, ch)
    run(behind, c1, (cw + 8, c1[1]), 20, 20, step=6, far0=0.75, far1=0.75, post_every=0)
    run(behind, c0, c1, 26, 20, step=7, far0=0.0, far1=0.75, post_every=0)
    im.alpha_composite(behind.out())
    mem = A('Village/memorial_t3.png').resize((64, 96), Image.NEAREST)
    paste_clip(im, mem, zl + 38 - 32, ch - (44 - 5) - 96)
    for x, feet, st in [(40, 30, 3), (16, 22, 1), (50, 8, 2), (6, 6, 0)]:
        hs = A('scene/headstone-%d.png' % st)
        paste_clip(im, hs, zl + x - 16, ch - feet - 32)
    front = Ink(cw, ch)
    run(front, c0, (cw + 8, 2), 26, 26, post_every=5)
    im.alpha_composite(front.out())
    return zl, zl - reach


def graveyard_monument(im, cw, ch, zone_w=96, band=72, feet=30):
    """Small screens: the Memorial alone at full size on flat grass; one tap target that opens the full graveyard window."""
    zl = cw - zone_w
    im.alpha_composite(flat_ground(cw, ch, zl - 16, band))
    mem = A('Village/memorial_t3.png')
    paste_clip(im, mem, zl + zone_w // 2 - 64, ch - (feet - 10) - 192)
    return zl, zl - 16


ART_DIR = os.path.join(HERE, 'art')
FINAL_STONES = [(6, 8), (52, 8), (98, 8), (29, 26), (75, 26), (52, 44), (98, 44)]


def graveyard_final(im, cw, ch, zone_w=120, mem_x=75, mem_feet=54, art_dir=None):
    """The real layers from graveyard_art.py, shown 2x. Art x 0 = 48px left of the zone; art bottom row = canvas bottom."""
    zl = cw - zone_w
    L = lambda n: up2(Image.open(os.path.join(art_dir or ART_DIR, n)).convert('RGBA'))
    for name in ('graveyard_ground_84x40.png', 'graveyard_fence_back_84x52.png'):
        lay = L(name)
        paste_clip(im, lay, zl - 48, ch - lay.height)
    mem = A('Village/memorial_t3.png')
    paste_clip(im, mem, zl + mem_x - 64, ch - (mem_feet - 10) - 192)
    stones(im, zl, ch, [(x, f, STAGES[i]) for i, (x, f) in enumerate(FINAL_STONES)])
    lay = L('graveyard_fence_front_84x24.png')
    paste_clip(im, lay, zl - 48, ch - lay.height)
    return zl, zl - 48


OPTIONS = {
    'A': dict(zone_w=104, crest=90, rows=[(26, [30, 58, 86]), (52, [22, 48, 74, 100])], mem_x=58, mem_feet=70, tree_x=92, tree_h=160, tree_seed=17),
    'C': dict(zone_w=120, crest=90, rows=[(12, [24, 64, 104]), (36, [44, 86]), (60, [62, 106])], mem_x=74, mem_feet=78),
    'D': dict(zone_w=104, crest=90, rows=[(12, [28, 76]), (36, [12, 52, 92]), (60, [30, 74])], mem_x=52, mem_feet=78),
    'G1': dict(zone_w=120, crest=90, rows=[(12, [34, 72, 108]), (36, [52, 92]), (60, [60, 106])], mem_x=74, mem_feet=78, style='side'),
    'G2': dict(zone_w=120, crest=90, rows=[(12, [34, 72, 108]), (36, [52, 92]), (60, [60, 106])], mem_x=74, mem_feet=78, style='front', front_gate=(-22, 10)),
    'F': dict(zone_w=120, rows=[(8, [6, 52, 98]), (26, [29, 75]), (44, [52, 98])], mem_x=75, mem_feet=54, depth=70, reach=40),
    'B': dict(zone_w=88, crest=82, rows=[(27, [16, 44, 72]), (47, [12, 33, 55, 77])], mem_x=44, mem_feet=62, tree_x=76, tree_h=160, tree_seed=17, stone_px=32),
}


def build(cw, ch, mode):
    hill_w = 140 if mode == 'today' else 64 if mode == 'S' else 96 if mode == 'M' else 120 if mode in ('R', 'RB') else OPTIONS[mode]['zone_w']
    sl = slots(cw, ch, hill_w)
    im, hz = backdrop(cw, ch, sl)
    village(im, sl)
    ground(im, cw, ch)
    church(im, cw, ch)
    if mode == 'today':
        zl, art_left = graveyard_today(im, cw, ch)
    elif mode == 'R':
        zl, art_left = graveyard_final(im, cw, ch)
    elif mode == 'RB':
        zl, art_left = graveyard_final(im, cw, ch, art_dir=os.path.join(HERE, 'art_b'))
    elif mode == 'M':
        zl, art_left = graveyard_monument(im, cw, ch)
    elif mode == 'S':
        zl, art_left = graveyard_compact(im, cw, ch)
    elif mode == 'F':
        zl, art_left = graveyard_flat(im, cw, ch, **OPTIONS[mode])
    elif mode in ('G1', 'G2'):
        zl, art_left = graveyard_gated(im, cw, ch, **OPTIONS[mode])
    elif mode in ('C', 'D'):
        zl, art_left = graveyard_fenced(im, cw, ch, **OPTIONS[mode])
    else:
        zl, art_left = graveyard_option(im, cw, ch, **OPTIONS[mode])
    return im, dict(zone_left=zl, art_left=art_left, field=cw - BASE_W - hill_w, slots=sl)


def font(sz):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def sheet(cw, ch, modes, labels, path):
    bar = 26
    out = Image.new('RGBA', (cw, (ch + bar) * len(modes)), (18, 18, 24, 255))
    d = ImageDraw.Draw(out)
    f = font(13)
    info = {}
    for i, m in enumerate(modes):
        im, meta = build(cw, ch, m)
        y = i * (ch + bar)
        d.text((8, y + 5), labels[m] % meta, fill=(232, 232, 240, 255), font=f)
        out.alpha_composite(im, (0, y + bar))
        info[m] = meta
    out.convert('RGB').save(path)
    return info


if __name__ == '__main__':
    labels = {
        'today': 'TODAY  -  hill zone 140px + 52px slope, top 101px  -  village room %(field)dpx',
        'A': 'OPTION A  -  walled bank 104px, stones at today\'s size, top 90px  -  village room %(field)dpx',
        'C': 'LAST VERSION  -  straight side fence climbing the rise  -  village room %(field)dpx',
        'D': 'NO TREE + IRON FENCE, TIGHTER  -  zone 104px, 48px stones, top 90px  -  village room %(field)dpx',
        'G1': 'GATE AS THE LEFT SIDE  -  open gate on the lane diagonal, rounded hill behind  -  village room %(field)dpx',
        'G2': 'FENCE AT THE HILL FOOT + GATE IN FRONT  -  side fence runs behind the hill  -  village room %(field)dpx',
        'F': 'FULL GRAVEYARD (approved layout)  -  120px  -  village room %(field)dpx',
        'S': 'SMALL SCREENS  -  compact 64px picture, tap opens a window  -  village room %(field)dpx',
        'M': 'SMALL SCREENS  -  Memorial only, 96px, tap opens a window  -  village room %(field)dpx',
        'R': 'NEW GRAVEYARD ART (code version)  -  120px  -  village room %(field)dpx',
        'B': 'OPTION B  -  walled bank 88px, smaller stones, top 82px  -  village room %(field)dpx',
    }
    w, h, k = 200, 170, 4
    a, _ = build(817, 320, 'R')
    STONE_DIR = os.path.join(HERE, 'stones')
    b, _ = build(817, 320, 'R')
    out = Image.new('RGB', (w * k * 2 + 12, h * k + 34), (18, 18, 24))
    d = ImageDraw.Draw(out)
    for i, (im, name) in enumerate(((a, 'CURRENT headstones'), (b, 'NEW headstones (code version)'))):
        c = im.crop((817 - w, 320 - h, 817, 320)).resize((w * k, h * k), Image.NEAREST).convert('RGB')
        out.paste(c, (i * (w * k + 12), 34))
        d.text((i * (w * k + 12) + 10, 6), name, fill=(232, 232, 240), font=font(20))
    out.save(os.path.join(OUT, 'headstones_old_vs_new.png'))
    b.convert('RGB').save(os.path.join(OUT, 'headstones_new_phone_817.png'))
