"""Graveyard v3 art (2026-11-23): flat fenced plot at the right end of the lane. Draws the three layers at ART size
(shown 2x in the game, the church's pixel size):

  graveyard_ground_84x40.png      flat grass in the lane's own recipe (regrass.py: flat tones in soft clumps, separate tufts, blade fringe)
  graveyard_fence_back_84x52.png  left side run on the lane diagonal + the back run, fading with distance (drawn BEHIND stones + Memorial)
  graveyard_fence_front_84x24.png the continuous front run, black posts (drawn IN FRONT of the stones)

All three share one origin: art x 0 = 48 screen px left of the 120px zone, art row 0 (bottom) = the canvas bottom.
usage: python3 -I graveyard_art.py <outDir> [seed]
"""
import sys, math, random
import numpy as np
from PIL import Image

OUT = sys.argv[1]
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 7
rnd = random.Random(SEED)

W = 84                 # 168 screen px: 48 reach + the 120px zone
BAND = 36              # the lane band, 72 screen px
SLANT = 88 / 72.0      # lane diagonal: px right per px of depth
CORNER_X, BASE_Y = 4, 1            # front-left corner post (art px); fence feet sit 2 screen px above the canvas bottom
DEPTH = 35                         # plot depth in art px (70 screen px): the back run stands on the lane's top edge
BACK_X = int(round(CORNER_X + DEPTH * SLANT))   # back-left corner

# the lane strip's own greens (regrass.py)
D0, D1, M, L, T = (12, 26, 24), (21, 38, 34), (30, 50, 42), (41, 61, 53), (51, 73, 62)
IRON, TIP, FAR = (16, 17, 24), (96, 100, 122), (40, 42, 58)


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


class Layer:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)

    def put(self, x, y, c):
        """y counts UP from the bottom row."""
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[self.h - 1 - y, x] = (c[0], c[1], c[2], 255)

    def get(self, x, y):
        return self.a[self.h - 1 - y, x, 3] > 0 if (0 <= x < self.w and 0 <= y < self.h) else False

    def save(self, name):
        Image.fromarray(self.a, 'RGBA').save(f'{OUT}/{name}')


def vnoise(w, h, cw, ch, seed):
    r = np.random.RandomState(seed)
    gw, gh = w // cw + 2, h // ch + 2
    g = r.rand(gh, gw)
    ys, xs = np.arange(h) / ch, np.arange(w) / cw
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b, c, d = g[y0][:, x0], g[y0][:, x0 + 1], g[y0 + 1][:, x0], g[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def ground():
    H = BAND + 4                                   # 4 rows of room for the fringe that stands up over the band's top edge
    lay = Layer(W, H)
    # where the grass is: right of the lane diagonal, with a ragged edge (the churchyard's edge at the other end is ragged too)
    left = []
    wob = 0
    for y in range(BAND):
        wob = max(-1, min(1, wob + rnd.choice((-1, 0, 0, 1))))
        left.append(int(round(CORNER_X - 3 + y * SLANT)) + wob)
    n1 = vnoise(W, H, 8, 3, SEED + 1) * 0.7 + vnoise(W, H, 4, 2, SEED + 2) * 0.3
    n2 = vnoise(W, H, 10, 3, SEED + 3)
    G = np.zeros((BAND, W), bool)
    for y in range(BAND):
        for x in range(max(0, left[y]), W):
            G[y, x] = True
            c = M
            if n1[y, x] < 0.40:
                c = D1
            if n2[y, x] > 0.68:
                c = L
            lay.put(x, y, c)
        if 0 <= left[y] < W:
            lay.put(left[y], y, D0)                # the edge's shaded side (away from the moon)
            if left[y] + 1 < W:
                lay.put(left[y] + 1, y, D1)

    def blades(n, lo, hi):
        b, d = [], 0
        for _ in range(n):
            b.append((d, rnd.randint(lo, hi), rnd.choice((-1, 0, 0, 0, 1))))
            d += rnd.choice((1, 2, 2, 3))
        return b

    def draw(x, y, bl, clump):
        if clump:
            cw = max(d for d, _, _ in bl) + 2
            for d in range(-1, cw):
                if 0 <= x + d < W and y < BAND and G[y, x + d]:
                    lay.put(x + d, y, D0)
                    if 0 <= d < cw - 1 and y + 1 < BAND:
                        lay.put(x + d, y + 1, D1)
        for d, h, lean in bl:
            for k in range(1, h + 1):
                xx = x + d + (lean if k > (h + 1) // 2 else 0)
                lay.put(xx, y + k, T if k >= h else L)

    # separate tufts on a jittered grid (never per-pixel speckle)
    for gy in range(2, BAND - 4, 3):
        for gx in range(0, W, 7):
            x, y = gx + rnd.randint(0, 4) + ((gy // 3) % 2) * 3, gy + rnd.randint(0, 2)
            if rnd.random() < 0.30 or x >= W - 1 or not (y < BAND and G[y, min(W - 1, x)] and x - 3 > left[y]):
                continue
            draw(x, y, blades(rnd.randint(2, 4), 2, 4), True)
    # fringe along the back (top) edge, standing up over the village field
    x = BACK_X - 2
    while x < W:
        r = rnd.random()
        if r < 0.5:
            draw(x, BAND - 1, blades(rnd.randint(2, 4), 2, 4), False); x += rnd.randint(4, 8)
        elif r < 0.8:
            draw(x, BAND - 1, blades(rnd.randint(1, 2), 1, 2), False); x += rnd.randint(2, 5)
        else:
            x += rnd.randint(5, 11)
    # a few blades leaning out over the lane along the ragged left edge
    for y in range(1, BAND - 2, 3):
        if rnd.random() < 0.6:
            draw(left[y] - 1, y, blades(rnd.randint(1, 2), 1, 3), False)
    lay.save('graveyard_ground_84x40.png')
    return lay


def picket(lay, x, y, h, c, tip):
    for k in range(h):
        lay.put(x, y + k, c)
    lay.put(x, y + h, tip)


def post(lay, x, y, h, c):
    """two art px wide, flat cap one px wider, small ball on top; solid colour (Jeremy 2026-11-23: black posts, no grey)."""
    for k in range(h):
        lay.put(x, y + k, c); lay.put(x + 1, y + k, c)
    for dx in (-1, 0, 1, 2):
        lay.put(x + dx, y + h, c)
    lay.put(x, y + h + 1, c); lay.put(x + 1, y + h + 1, c)


def fence_front():
    lay = Layer(W, 24)
    h = 14                                                    # 28 + tip = 30 screen px
    for x in range(CORNER_X, W):
        lay.put(x, BASE_Y + 2, IRON)
        lay.put(x, BASE_Y + 11, IRON)
    i = 0
    for x in range(CORNER_X, W, 4):                           # a picket every 8 screen px, a post every fifth
        if i % 5 == 0:
            post(lay, x, BASE_Y, h + 3, IRON)
        else:
            picket(lay, x, BASE_Y, h, IRON, TIP)
        i += 1
    lay.save('graveyard_fence_front_84x24.png')
    return lay


def fence_back():
    lay = Layer(W, 52)
    far = mix(IRON, FAR, 0.75)
    # back run on the band's top edge
    hb = 11
    for x in range(BACK_X, W):
        lay.put(x, BAND + 2, far)
        lay.put(x, BAND + 8, far)
    i = 0
    for x in range(BACK_X, W, 3):
        if i % 6 == 0:
            post(lay, x, BAND, hb + 2, far)
        else:
            picket(lay, x, BAND, hb, far, mix(TIP, FAR, 0.6))
        i += 1
    # left side run: from the front corner back along the lane diagonal; upright pickets, rails follow the ground line
    n = 15
    for step in range(0, DEPTH * 4 + 1):                       # rails, drawn densely so the stair-steps stay connected
        t = step / (DEPTH * 4)
        c = mix(IRON, FAR, 0.75 * t)
        x, y = CORNER_X + t * (BACK_X - CORNER_X), BASE_Y + t * (BAND - BASE_Y)
        hh = 14 + (hb - 14) * t
        lay.put(round(x), round(y + 2), c)
        lay.put(round(x), round(y + hh - 3), c)
    for k in range(1, n):
        t = k / n
        c = mix(IRON, FAR, 0.75 * t)
        x, y = CORNER_X + t * (BACK_X - CORNER_X), BASE_Y + t * (BAND - BASE_Y)
        picket(lay, round(x), round(y), round(14 + (hb - 14) * t), c, mix(TIP, FAR, 0.6 * t))
    lay.save('graveyard_fence_back_84x52.png')
    return lay


if __name__ == '__main__':
    ground(); fence_back(); fence_front()
    print('corner', CORNER_X, BASE_Y, 'back-left', BACK_X, BAND)
