"""25% base strips (16 frames, 8 fps) -- checkpoint 2026-11-21: flames, cinders, firelight and bell done and approved
piece by piece by Jeremy. Smoke is NOT in these strips: it is planned as a separate layer behind the church.
Usage: python3 anim25.py <final/base_025_unlit_final_184x200.png> <d25/base_025_v3_unlit_flames.png> <out_prefix>
       env ATTACK=1 -> the "under attack" strip (bell rings, +-20 deg); without it the idle strip (bell hangs still)
Reads next to them: final/base_050_unlit_final_184x200.png (roof under the old roof flame), d25/cross_layer.png,
d0/statue_mask_exact.png.  Needs flamefx.py, firelight25.py, gifkit.py beside this file.
Writes <out>_flames2_16f.png (unlit) and <out>_lit_16f.png (with firelight). Previews: preview25.py.

What moves (each piece approved in the 2026-11-21 session):
  * ridge flames x3, right corner flame: flamefx.Flame (living outline, rising licks, low gaps closed, ragged low edges);
    corner flame got a left shoulder, a widened right side with tongues climbing it, and a flame "tear" that floats off
  * flag and its pole: removed (burned away).  Side-wall fire: one small tongue that licks up the wall (SideLick)
  * belfry: three small licking tongues over a low fire bed + one tiny one; cinders rise. The tilted drawn bell is
    removed (belfry rebuilt from the 50% art); the standard bell from bell.py hangs under the roof point, fire in front
    of it, firelit by a multiply on its own colours, brighter as it swings toward the flames
  * roof: the big flame is replaced by a rebuilt roof, a hole with a glowing inside, a charred frame with breathing
    coals, three small licking tongues and cinders
  * windows / door arch / step fire: tips flicker (first test, approved); doorway inside ripples + two licking tongues
  * frozen ember specks around the openings are lifted off; 22 float up as cinders (none on sandbags, bottom steps,
    cross or the lower far-left window); 4 dots right of the steps erased
  * firelight: the lit still's recipe driven by each frame's flames, pulse widened (PULSE), extra roof-hole light
    (ROOF_LIGHT), extra light on the statue, window boards kept darker with a lit edge and a short shadow
Everything loops in 16 frames: every time term is a whole number of cycles per loop."""
import math, sys, os, random
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, v3src, out = sys.argv[1], sys.argv[2], sys.argv[3]
N = int(os.environ.get("FRAMES", 16)); FPS = int(os.environ.get("FPS", 8))
U = np.array(Image.open(src).convert("RGBA")); V3 = np.array(Image.open(v3src).convert("RGBA"))
H, W = U.shape[:2]
TAU = math.tau

def isfire(p):
    r, g, b, a = [p[..., i].astype(int) for i in range(4)]
    return (a > 0) & (r > 150) & (r - b > 80) & (g > 40)
FIRE = isfire(U)
LUM = (.3 * U[..., 0] + .59 * U[..., 1] + .11 * U[..., 2])
yy, xx = np.mgrid[0:H, 0:W]

# ---------------------------------------------------------------- what is behind each flame pixel
V3CLEAN = FIRE & ~isfire(V3) & (U != V3).any(-1)            # v3 has the surface (or sky) without this flame
_, (iy, ix) = ndi.distance_transform_edt(FIRE, return_indices=True)
BG = U.copy()
BG[FIRE] = U[iy[FIRE], ix[FIRE]]                             # nearest non-fire pixel (roof / wall / doorway / sky)
BG[V3CLEAN] = V3[V3CLEAN]

# ---------------------------------------------------------------- flame groups
def box(x0, y0, x1, y1): return (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
DOOR_IN = box(122, 104, 134, 171)                            # doorway interior: handled as a rippling texture
FLAG = box(167, 52, 183, 80)
BELFRY = box(90, 24, 125, 48)                                # stage 1: left alone (rebuilt with the bell)
RIDGE = FIRE & ~isfire(V3) & box(0, 0, 92, 52)
ROOF = FIRE & box(44, 44, 82, 88) & ~RIDGE
CORNER = FIRE & box(144, 24, 166, 86) & ~FLAG
SIDE = FIRE & box(160, 84, 180, 132)
ARCH = FIRE & box(116, 90, 142, 128) & ~DOOR_IN
FLOOR = FIRE & box(112, 129, 162, 190) & ~DOOR_IN
WIN = FIRE & (box(0, 96, 115, 160) | box(143, 100, 160, 132)) & ~ARCH & ~FLOOR & ~SIDE & ~CORNER

def comps(mask, grow, min_px):
    lab, n = ndi.label(ndi.binary_dilation(mask, iterations=grow) if grow else mask, structure=np.ones((3, 3)))
    res = []
    for i in range(1, n + 1):
        m = (lab == i) & mask
        if m.sum() >= min_px: res.append(m)
    return res

class Cluster:
    def __init__(self, mask, mode, A, B, T=4, salt=0):
        self.m = mask; self.mode = mode; self.A = A; self.B = B; self.T = T
        ys, xs = np.where(mask)
        self.x0, self.x1, self.y0, self.y1 = xs.min(), xs.max(), ys.min(), ys.max()
        cols = np.arange(W); bot = np.full(W, -1.0); top = np.full(W, -1.0)
        for x in range(self.x0, self.x1 + 1):
            c = np.where(mask[:, x])[0]
            if len(c): bot[x] = c.max(); top[x] = c.min()
        have = bot >= 0
        bot = np.interp(cols, cols[have], bot[have]); top = np.interp(cols, cols[have], top[have])
        self.cb = ndi.median_filter(bot, 5, mode="nearest")          # base line (smooth)
        self.ct = ndi.median_filter(top, 3, mode="nearest")          # tongue tops (anchored mode)
        self.Hk = max(4.0, float(np.percentile((self.cb - top)[have], 90)))
        r = random.Random(1000 + salt)
        self.p = [r.uniform(0, TAU) for _ in range(8)]
        self.kx = [r.uniform(.35, .6), r.uniform(.7, 1.0), r.uniform(.2, .4)]
        # palette ranked by brightness (for "colours rise")
        cl = U[mask]; order = np.argsort(LUM[mask], kind="stable")
        self.pal = cl[order]
        rank = np.empty(len(order)); rank[order] = np.linspace(0, 1, len(order))
        self.rank = np.zeros((H, W)); self.rank[mask] = rank
        # the flame continues behind the building next to it: extend the sprite sideways into opaque non-fire pixels
        self.ext = mask.copy(); self.extc = U.copy(); self.extr = self.rank.copy()
        hidden = (U[..., 3] == 255) & ~FIRE
        if mode == "free":
            for _ in range(4):
                for dx in (1, -1):
                    nb = np.roll(self.ext, dx, 1) & hidden & ~self.ext
                    self.extc[nb] = np.roll(self.extc, dx, 1)[nb]; self.extr[nb] = np.roll(self.extr, dx, 1)[nb]
                    self.ext |= nb

    def stretch(self, x, ph):
        p, k = self.p, self.kx
        return .55 * math.sin(2 * ph + k[0] * x + p[0]) + .40 * math.sin(3 * ph - k[1] * x + p[1]) + .30 * math.sin(5 * ph + k[2] * x + p[2])
    def sway(self, a, ph):
        p = self.p
        return .62 * math.sin(2 * ph - 3.0 * a + p[3]) + .38 * math.sin(3 * ph - 5.5 * a + p[4]) + .22 * math.sin(5 * ph - 8.0 * a + p[5])

    def render(self, px, ph, taken):
        mx, mt = 4, 7
        for y in range(max(0, self.y0 - mt), self.y1 + 1):
            for x in range(max(0, self.x0 - mx), min(W, self.x1 + mx + 1)):
                own = self.m[y, x]
                if not own and (U[y, x, 3] == 255 or taken[y, x]): continue          # building / another flame in front
                d = self.cb[x] - y
                if d <= 0:
                    sx, sy = x, y
                elif self.mode == "free":
                    a = min(1.3, d / self.Hk)
                    s = 1 + self.B * self.stretch(x, ph) * min(1.0, a * 1.6)
                    d2 = d / s
                    sx = x - round(self.A * min(1.0, a) ** 1.3 * self.sway(min(1.0, d2 / self.Hk), ph))
                    sy = round(self.cb[x] - d2)
                else:                                                               # anchored: only the tongue tips move
                    hc = self.cb[x] - self.ct[x]; d0 = max(0.0, hc - self.T)
                    if d <= d0: sx, sy = x, y
                    else:
                        s = 1 + self.B * self.stretch(x, ph)
                        d2 = d0 + (d - d0) / s; a = min(1.0, (d2 - d0) / self.T)
                        sx = x - round(self.A * a * self.sway(a, ph)); sy = round(self.cb[x] - d2)
                if 0 <= sx < W and 0 <= sy < H and self.ext[sy, sx]:
                    r = self.extr[sy, sx]
                    r2 = min(1.0, max(0.0, r + RISE * (rise_noise(x, y, ph) - .5) * (0.35 + 0.65 * r)))
                    c = self.pal[int(round(r2 * (len(self.pal) - 1)))]
                    px[y, x] = c; taken[y, x] = True
                elif own:
                    px[y, x] = BG[y, x]

# rising colour noise: value noise that tiles in y and scrolls one full tile per loop (seamless), upward
CELL, TILE = 3.0, 6
RISE = float(os.environ.get("RISE", 0.34))
_g = {}
def _lat(i, j, salt):
    k = (i, j % TILE, salt)
    if k not in _g: _g[k] = random.Random(hash(k)).random()
    return _g[k]
def tnoise(x, y, salt=0, cell=CELL):
    gx, gy = x / cell, y / cell; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    a = _lat(x0, y0, salt) * (1 - fx) + _lat(x0 + 1, y0, salt) * fx
    c = _lat(x0, y0 + 1, salt) * (1 - fx) + _lat(x0 + 1, y0 + 1, salt) * fx
    return a * (1 - fy) + c * fy
def rise_noise(x, y, ph):
    s = ph / TAU * TILE * CELL                                # px scrolled so far (one tile per loop)
    return .65 * tnoise(x, y + s, 1) + .35 * tnoise(x * 1.7, y + 2 * s, 2)

# upper sky flames: the method Jeremy approved on the middle ridge flame (flamefx.py: living outline, rising licks,
# every tongue moves, low gaps closed, ragged low edges)
import importlib.util
def _load(name):
    sp = importlib.util.spec_from_file_location(name, os.path.join(os.path.dirname(os.path.abspath(__file__)), name + ".py"))
    m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m); return m
fx = _load("flamefx")
# the flag has burned away (Jeremy 2026-11-21): cloth, its flames and its sparks are removed; the bare pole stays
FLAG_GONE = (U[..., 3] > 0) & (xx >= 167) & (yy >= 44) & (yy <= 76) & ~((xx == 167) & (yy == 62))
BUILD = (U[..., 3] == 255) & ~FIRE & ~FLAG_GONE
POLE = (U[..., 3] == 255) & (((xx == 166) & (yy >= 62) & (yy <= 88)) | ((xx == 167) & (yy == 62)))   # bare flag pole
BUILD_F = BUILD & ~POLE                                       # the pole is removed too (it read as an empty line in the flame)
SALTS = {"ridge": [5, 3, 8], "corner": [11, 12], "side": [21, 22]}
sky_flames = []
def split_flames(region, big_px=20, reach=9):
    """separate flames that only sit near each other (the two side-wall tongues); loose bits join the nearest flame"""
    lab, n = ndi.label(region, structure=np.ones((3, 3)))
    parts = [lab == i for i in range(1, n + 1)]
    big = [m.copy() for m in parts if m.sum() >= big_px]
    for m in parts:
        if m.sum() >= big_px: continue
        d = [ndi.distance_transform_edt(~b)[m].min() for b in big]
        if d and min(d) <= reach: big[int(np.argmin(d))] |= m
    return big
def corner_skirt():
    """the drawn corner flame stops in a straight vertical cut (its paint mask ended at x=147), leaving a wedge of sky
    between it and the gable's roof edge. Give it a sloping, uneven shoulder that comes down onto the roof edge."""
    ex = np.zeros((H, W), bool); r = random.Random(4711)
    for y in range(56, 69):
        fl = np.where(CORNER[y, 140:152])[0]
        if not len(fl): continue
        flame_left = 140 + fl.min()
        roof = np.where(BUILD_F[y, 130:flame_left])[0]
        roof_x = 130 + roof.max() if len(roof) else flame_left - 1
        want = roof_x + 1 if y >= 61 else max(roof_x + 1, round(147 - (y - 56) * 5 / 7) + r.choice((-1, 0, 0, 1)))
        for x in range(want, flame_left):
            if U[y, x, 3] == 0: ex[y, x] = True
    return ex
SKIRT = corner_skirt()
BG[FLAG_GONE | POLE] = 0

def widen_corner_right():
    """right side of the corner flame: the drawn edge is a straight dent where the flag pole stood (rows 62-70). The
    drawn rows are stretched sideways (nearest pixel, so only drawn colours and the drawn core-to-rim shading) out to a
    gently curved edge where the flag was, easing back to the drawn edge lower down."""
    U2 = U.copy(); U2[FLAG_GONE | POLE] = 0; add = np.zeros((H, W), bool); SPAN = 10
    for y in range(59, 82):
        row = CORNER[y]
        xs = np.where(row[150:167])[0]
        if not len(xs): continue
        x = 150 + xs.min()
        while x + 1 < W and row[x + 1]: x += 1                 # right end of the main run (ignores loose pixels)
        x_old = x
        t = min(1.0, max(0.0, (y - 70) / 11.0)); t0 = min(1.0, (y - 58) / 3.0)
        x_new = round((166.4 + 1.2 * math.sin(y * 0.45 + 0.6)) * (1 - t) + x_old * t)
        x_new = round(x_old + (x_new - x_old) * t0)
        if x_new <= x_old: continue
        xc = x_old - SPAN
        for xo in range(xc, x_new + 1):
            src = int(round(xc + (xo - xc) * (x_old - xc) / (x_new - xc)))
            if row[src] and (U[y, xo, 3] == 0 or FIRE[y, xo] or FLAG_GONE[y, xo] or POLE[y, xo]):
                U2[y, xo] = U[y, src]; add[y, xo] = True
    return U2, add
U_CORNER, CORNER_ADD = widen_corner_right()
SIDE_GONE = SIDE.copy()                                       # every drawn side-wall flame pixel is cleared; the redrawn tongue replaces them
for name, region, grow, minpx in (("ridge", RIDGE, 3, 12), ("corner", CORNER, 3, 6)):
    cs = split_flames(region) if grow is None else comps(region, grow, minpx)
    cs = sorted(cs, key=lambda m: (np.where(m)[1].min(), np.where(m)[0].min()))
    for i, m in enumerate(cs):
        extra = SKIRT if (name == "corner" and (m & ndi.binary_dilation(SKIRT, iterations=2)).any()) else None
        src_img = U
        if extra is not None: m = m | CORNER_ADD; src_img = U_CORNER
        sky_flames.append((name, m, fx.Flame(src_img, m, BUILD_F, N, salt=SALTS[name][i % len(SALTS[name])], ragged=(name == "ridge"), extra=extra,
                                                rag_rows=[(47, 60, 0)] if extra is not None else (), no_slits=(name == "corner"),
                                                barb_rows=[(57, 82, 1, 3.2)] if extra is not None else (),
                                                calm=0.11 if extra is not None else 0.05,
                                                # corner flame: the tall drawn strip above the middle tongue is replaced by a flame
                                                # "tear" that leaves that tongue, floats up, shrinks and dies (two per loop, unequal)
                                                max_template_px=8 if extra is not None else None,
                                                tears=[dict(tip=(158, 48), period=16, life=10, travel=19.0, emit=[(0, 1.0, 0.6), (9, 0.62, -0.5)])] if extra is not None else ())))
class SideLick:
    """Small side-wall flame (Jeremy 2026-11-21: smaller, close to the wall, and it must LICK UPWARD).
    Drawn fresh every frame from a centre line + width, in the drawn side flames' own colours. One lick = 8 frames:
    a bright bulge starts at the foot and travels up the tongue, the tongue stretches up the wall after it, the tip
    breaks off, keeps rising a few px and dies under the eave, and the tongue drops back. Two licks per loop, the
    second a little weaker and leaning differently so the loop does not read as a strict repeat."""
    FOOT = (162.6, 116.0); REST = 13.0
    def __init__(self):
        self.cols = U[SIDE][:, :4][np.argsort(LUM[SIDE], kind="stable")]
    def _col(self, rank): return self.cols[int(round(min(1.0, max(0.0, rank)) * (len(self.cols) - 1)))]
    def _blob(self, px, cx, cy, hw, hh, rank):
        for y in range(int(cy - hh - 1), int(cy + hh + 2)):
            for x in range(int(cx - hw - 1), int(cx + hw + 2)):
                if 0 <= x < W and 0 <= y < H and not BUILD_F[y, x] and ((x + .5 - cx) / max(hw, .5)) ** 2 + ((y + .5 - cy) / max(hh, .5)) ** 2 <= 1.0:
                    px[y, x] = self._col(rank)
    def render(self, px, f):
        c = (f // 8) % 2; t = (f % 8) / 8.0; power = (1.0, 0.8)[c]; lean = (0.0, 0.5)[c]
        grow = min(1.0, t / 0.62); grow = grow * grow * (3 - 2 * grow)
        fall = max(0.0, (t - 0.62) / 0.38)
        L = self.REST * (0.78 + 0.52 * power * (grow - fall ** 0.8 * grow))      # stretches up, then drops back
        sb = -0.15 + 1.5 * t                                                     # bulge position along the tongue (foot -> past the tip)
        fx0, fy0 = self.FOOT
        for y in range(int(fy0 - L - 3), int(fy0 + 2)):
            for x in range(160, 172):
                if not (0 <= y < H) or BUILD_F[y, x]: continue
                s_ = (fy0 - (y + .5)) / L
                if s_ < -0.05 or s_ > 1.05: continue
                sc = min(1.0, max(0.0, s_))
                cx = fx0 + (2.6 + lean) * sc ** 1.4 + 0.9 * sc ** 1.5 * math.sin(math.tau * (t - 0.6 * sc) + c * 1.3)
                bulge = math.exp(-((sc - sb) / 0.2) ** 2)
                hw = (0.45 + 1.75 * math.sin(math.pi * sc ** 0.72) ** 0.9) * (1 + 0.5 * bulge) * (1.0 if s_ <= 1 else 0.0)
                q = abs(x + .5 - cx) / max(hw, 1e-3)
                if q <= 1.0:
                    px[y, x] = self._col((0.2 + 0.68 * (1 - q) ** 0.8) * (1 - 0.45 * sc ** 1.5) + 0.3 * bulge)
        if t >= 0.62:                                                            # the tip that broke off: rises, shrinks, cools
            k = (t - 0.62) / 0.38; Lmax = self.REST * (0.78 + 0.52 * power)
            tx = fx0 + (2.6 + lean) + 0.6 * k; ty = fy0 - Lmax - 1.0 - 4.5 * k
            self._blob(px, tx, ty, 1.1 * (1 - 0.6 * k), 1.6 * (1 - 0.55 * k), 0.62 - 0.3 * k)
SIDE_LICK = SideLick()

# ---------------------------------------------------------------- belfry: flames + cinders (the drawn bell stays as drawn for now)
BELL_WARM = BUILD_F & box(103, 27, 112, 46) & (U[..., 0].astype(int) > U[..., 2].astype(int) + 22)   # firelit bell: flames may pass in front
BUILD_BELFRY = BUILD_F & ~BELL_WARM
# what is what in the belfry: flames = the two real fires; the thin bright line down the bell's left side and the
# orange pixels on its rim are the firelit BELL (left alone); lone pale dots are the still's frozen cinders (replaced)
_lab, _n = ndi.label(FIRE & BELFRY, structure=np.ones((3, 3)))
_parts = [_lab == k for k in range(1, _n + 1)]
def _is_bell_rim(m):
    ys, xs = np.where(m); return xs.min() >= 104 and xs.max() <= 108 and ys.min() >= 33 and ys.max() <= 41
_big = [m.copy() for m in _parts if m.sum() >= 6 and not _is_bell_rim(m)]
for m in _parts:                                               # 1-2 px bits touching a fire belong to it
    if m.sum() < 6:
        d = [ndi.distance_transform_edt(~b_)[m].min() for b_ in _big]
        if min(d) <= 1.5: _big[int(np.argmin(d))] |= m
belfry_flames = [(m, None) for m in sorted(_big, key=lambda m: np.where(m)[1].min())]
BELFRY_FLAME = np.zeros((H, W), bool)
for m, _f in belfry_flames: BELFRY_FLAME |= m
_brt = (U[..., 3] > 0) & BELFRY & ~BELFRY_FLAME & (FIRE | (LUM > 170))
_lab, _n = ndi.label(_brt, structure=np.ones((3, 3)))
BELFRY_DOTS = np.zeros((H, W), bool)                           # the still's frozen cinder dots: replaced by moving ones
for k in range(1, _n + 1):
    m = _lab == k
    if m.sum() > 2: continue
    ring = ndi.binary_dilation(m, structure=np.ones((3, 3))) & ~m
    if (U[..., 3][ring] == 0).sum() >= 6 or U[..., 1][m].min() > 190: BELFRY_DOTS |= m
for _y, _x in zip(*np.where(BELFRY_DOTS)):                     # what is behind each frozen dot: sky, or the darkest thing next to it
    nb = [U[_y + dy, _x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and not BELFRY_DOTS[_y + dy, _x + dx]]
    BG[_y, _x] = 0 if sum(int(p_[3] == 0) for p_ in nb) >= 4 else min([p_ for p_ in nb if p_[3] > 0], key=lambda p_: int(p_[0]) + int(p_[1]) + int(p_[2]))
BUILD_BELFRY &= ~BELFRY_DOTS

# plate behind the drawn belfry fire (it is replaced by smaller licking tongues): open sky through the left opening
# above the far rail, the dark far rail / floor below it, and the bell where the fire stood in front of the bell
for _y, _x in zip(*np.where(BELFRY_FLAME)):
    if _x <= 103 and _y <= 42: BG[_y, _x] = 0
    elif _x <= 103 or _x >= 118:
        row = [U[_y, k] for k in (list(range(_x, 87, -1)) if _x <= 103 else list(range(_x, 128))) if U[_y, k, 3] == 255 and not FIRE[_y, k]]
        BG[_y, _x] = row[0] if row else 0
BUILD_BELFRY &= ~BELFRY_FLAME

class Tongue:
    """One small licking flame (same idea as the side-wall flame Jeremy approved): drawn fresh each frame from a centre
    line and a width. One lick = 8 frames: a bright bulge leaves the foot and travels up, the tongue stretches after it,
    the tip breaks off, rises a few px and dies, the tongue drops back. Wide at the foot, pointed at the tip."""
    def __init__(self, foot, rest, cols, build, off=0, wmax=1.5, lean=0.0, powers=(1.0, 0.8), sway=0.8, reach=4.5):
        self.foot, self.rest, self.cols, self.build, self.off, self.wmax, self.lean, self.powers, self.sway, self.reach = foot, rest, cols, build, off, wmax, lean, powers, sway, reach
    def _col(self, rank): return tuple(int(v) for v in self.cols[int(round(min(1.0, max(0.0, rank)) * (len(self.cols) - 1)))])
    def render(self, px, f):
        g = f + self.off; c = (g // 8) % 2; t = (g % 8) / 8.0; power = self.powers[c]
        grow = min(1.0, t / 0.62); grow = grow * grow * (3 - 2 * grow); fall = max(0.0, (t - 0.62) / 0.38)
        L = self.rest * (0.72 + 0.6 * power * (grow - fall ** 0.8 * grow))
        sb = -0.15 + 1.5 * t; fx0, fy0 = self.foot; lean = self.lean * (1.0 if c == 0 else -0.6)
        for y in range(int(fy0 - L - 2), int(fy0 + 1)):
            for x in range(int(fx0 - 6), int(fx0 + 7)):
                if not (0 <= y < H and 0 <= x < W) or self.build[y, x]: continue
                s_ = (fy0 - (y + .5)) / L
                if s_ < 0 or s_ > 1.0: continue
                cx = fx0 + lean * s_ ** 1.4 + self.sway * s_ ** 1.5 * math.sin(math.tau * (t - 0.6 * s_) + c * 1.3 + self.off)
                bulge = math.exp(-((s_ - sb) / 0.2) ** 2)
                hw = (0.4 + self.wmax * (1 - s_ ** 1.05)) * (1 + 0.45 * bulge)      # wide foot, steadily narrowing to a point
                q = abs(x + .5 - cx) / hw
                if q <= 1.0: px[y, x] = self._col((0.22 + 0.66 * (1 - q) ** 0.8) * (1 - 0.5 * s_ ** 1.4) + 0.28 * bulge) + ()
        if t >= 0.62:
            k = (t - 0.62) / 0.38; Lmax = self.rest * (0.72 + 0.6 * power)
            tx = fx0 + lean + 0.5 * k; ty = fy0 - Lmax - 0.8 - self.reach * k
            hw, hh = 1.0 * (1 - 0.6 * k), 1.5 * (1 - 0.55 * k)
            for y in range(int(ty - hh - 1), int(ty + hh + 2)):
                for x in range(int(tx - hw - 1), int(tx + hw + 2)):
                    if 0 <= x < W and 0 <= y < H and not self.build[y, x] and ((x + .5 - tx) / max(hw, .5)) ** 2 + ((y + .5 - ty) / max(hh, .5)) ** 2 <= 1.0:
                        px[y, x] = self._col(0.6 - 0.32 * k)

class FireBed:
    """low bed of fire along the belfry floor that joins the tongues: 1-3 px high, its top edge ripples sideways"""
    def __init__(self, x0, x1, y, cols, build, salt=3): self.x0, self.x1, self.y, self.cols, self.build, self.salt = x0, x1, y, cols, build, salt
    def render(self, px, f):
        for x in range(self.x0, self.x1 + 1):
            e = min(1.0, (x - self.x0 + 1) / 2.5, (self.x1 - x + 1) / 2.5)                 # tapers to nothing at both ends
            n = float(fx.noise(np.array([x / 2.6 + self.salt + f / 16.0 * 4.0]), np.array([f / 16.0 * 8.0]), 2, 8)[0])
            h = int(round((1.0 + 2.2 * n) * e))
            for k in range(h):
                y = self.y - k
                if not self.build[y, x]:
                    rank = (0.9 - 0.3 * k) * (0.75 + 0.25 * e)
                    px[y, x] = tuple(int(v) for v in self.cols[int(round(max(0.0, min(1.0, rank)) * (len(self.cols) - 1)))])
_bcols = U[BELFRY_FLAME][:, :4][np.argsort(LUM[BELFRY_FLAME], kind="stable")]
BELFRY_FIRE = [FireBed(95, 108, 46, _bcols, BUILD_BELFRY),
               Tongue((97.5, 46.5), 6.5, _bcols, BUILD_BELFRY, off=5, wmax=1.6, lean=-0.8, powers=(0.9, 0.7)),
               Tongue((101.5, 46.5), 8.5, _bcols, BUILD_BELFRY, off=0, wmax=1.9, lean=0.7, powers=(1.0, 0.8)),
               Tongue((105.5, 46.5), 6.0, _bcols, BUILD_BELFRY, off=3, wmax=1.5, lean=-0.6, powers=(0.75, 0.95)),
               Tongue((121.5, 46.5), 3.6, _bcols, BUILD_BELFRY, off=6, wmax=0.9, lean=0.3, powers=(0.9, 0.6), reach=3.0)]

# ---------------------------------------------------------------- roof hole (Jeremy 2026-11-21: the big roof flame is replaced)
# The drawn flame hid the roof and there was no clean layer, so the roof under it is rebuilt from the 50% roof (same
# shingle layout), re-toned to the 25% roof's darker colours with a fit taken from the roof right around it.
H50 = np.array(Image.open(os.environ.get("BASE50", os.path.join(os.path.dirname(src), "base_050_unlit_final_184x200.png"))).convert("RGBA"))
ROOF_PLATE = ndi.binary_dilation(ndi.binary_fill_holes(ndi.binary_closing(np.pad(ROOF, 4), np.ones((3, 3)), iterations=2)[4:-4, 4:-4]), iterations=1) & (U[..., 3] == 255) & (yy >= 44) & ~RIDGE
ROOF_PLATE &= ~((np.roll(U[..., 3], 1, 1) == 0) & (np.roll(U[..., 3], -1, 1) == 0))   # a lone dot standing in the sky is not roof
_near = box(34, 46, 92, 92) & ~FIRE & (U[..., 3] == 255) & (H50[..., 3] == 255) & ~ROOF_PLATE & ~ndi.binary_dilation(FIRE, iterations=2) \
        & (H50[..., 0].astype(int) - H50[..., 2].astype(int) < 20) & ~box(50, 70, 76, 84) & (xx < 84)
_plate = np.zeros((H, W, 4), np.uint8)
for ch in range(3):
    k_, c_ = np.polyfit(H50[..., ch][_near].astype(float), U[..., ch][_near].astype(float), 1)
    _plate[..., ch] = np.clip(np.rint(k_ * H50[..., ch].astype(float) + c_), 0, 255)
_plate[..., 3] = 255
_cool50 = H50[..., 0].astype(int) - H50[..., 2].astype(int) < 20        # the 50% hole's own warm pixels are not roof: fill from the row
for _y, _x in zip(*np.where(ROOF_PLATE & ~_cool50)):
    for d_ in range(1, 30):
        for xs_ in (_x - d_, _x + d_):
            if 0 <= xs_ < W and _cool50[_y, xs_] and H50[_y, xs_, 3] == 255: _plate[_y, _x] = _plate[_y, xs_]; break
        else: continue
        break

# the hole: ragged, wider than tall (we look across the roof), dark inside
_r = random.Random(2511); _HC = (62.5, 77.2); _HR = (14.0, 6.2)
_edge = [1 + 0.16 * math.sin(3 * a_ + 1.0) + 0.10 * math.sin(7 * a_ + 2.0) + 0.07 * math.sin(13 * a_) for a_ in np.linspace(0, math.tau, 720, endpoint=False)]
def _in_hole(x, y, grow=0.0):
    a_ = math.atan2((y + .5 - _HC[1]) / _HR[1], (x + .5 - _HC[0]) / _HR[0]) % math.tau
    return math.hypot((x + .5 - _HC[0]) / (_HR[0] + grow), (y + .5 - _HC[1]) / (_HR[1] + grow)) <= _edge[int(a_ / math.tau * 720) % 720]
HOLE = np.zeros((H, W), bool); HOLE_RIM = np.zeros((H, W), bool)
for _y in range(66, 90):
    for _x in range(44, 82):
        if _in_hole(_x, _y): HOLE[_y, _x] = True
        elif _in_hole(_x, _y, 1.3): HOLE_RIM[_y, _x] = True
_hb = np.array([np.where(HOLE[:, x])[0].max() if HOLE[:, x].any() else -1 for x in range(W)])     # hole's lower edge per column
BELOW_HOLE = (yy > _hb[xx]) & (_hb[xx] >= 0)                    # roof in front of the fire's feet: flames never draw here
ROOF_STILL = _plate.copy(); ROOF_MASK = ROOF_PLATE | HOLE | HOLE_RIM
for _y, _x in zip(*np.where(HOLE_RIM)):                        # charred edge of the shingles around the hole
    base_ = ROOF_STILL[_y, _x] if ROOF_PLATE[_y, _x] else U[_y, _x]
    ROOF_STILL[_y, _x] = (int(base_[0] * .45 + 6), int(base_[1] * .42 + 4), int(base_[2] * .42 + 4), 255)
for _y, _x in zip(*np.where(HOLE)):                            # inside: near black, a little firelit on the flame (left) side
    lit = max(0.0, 1 - abs(_x - 56) / 11.0) * max(0.0, (_y - 70) / 13.0)
    inner_wall = (not HOLE[_y - 1, _x]) or (not HOLE[_y - 2, _x])             # thickness of the roof deck along the far edge
    c_ = (84, 42, 24) if inner_wall else (13 + int(44 * lit), 9 + int(11 * lit), 10 + int(4 * lit))
    ROOF_STILL[_y, _x] = c_ + (255,)
# the inside of the hole glows from the fire below (the "hole light"): deepest red low in the middle, darker toward the
# edges; the charred frame stands dark against it. Stored as a strength per pixel and pulsed slowly in draw_coals.
HOLE_GLOW = {}
for _y, _x in zip(*np.where(HOLE)):
    if (not HOLE[_y - 1, _x]) or (not HOLE[_y - 2, _x]): continue
    q_ = math.hypot((_x + .5 - _HC[0]) / _HR[0], (_y + .5 - (_HC[1] + 1.5)) / _HR[1])
    HOLE_GLOW[(_x, _y)] = max(0.0, 1 - q_ ** 1.6) * (0.75 + 0.25 * min(1.0, (_y - 70) / 8.0))
# charred roof frame showing in the right-hand part of the hole (the left part has burned through, that is where the
# flames come out): two purlins and two rafters, clipped to the hole
BEAMS = [((60.0, 74.6), (77.5, 73.4), 1.3), ((63.5, 80.0), (75.5, 79.2), 1.0), ((67.0, 70.5), (69.2, 84.0), 1.2), ((73.5, 70.5), (75.3, 83.0), 1.0)]
BEAM = np.zeros((H, W), bool); COALS = []
def _seg_d(x, y, a_, b_):
    (x0, y0), (x1, y1) = a_, b_; L2 = (x1 - x0) ** 2 + (y1 - y0) ** 2
    t = max(0.0, min(1.0, ((x + .5 - x0) * (x1 - x0) + (y + .5 - y0) * (y1 - y0)) / L2))
    return math.hypot(x + .5 - (x0 + t * (x1 - x0)), y + .5 - (y0 + t * (y1 - y0))), t
for bi, (a_, b_, th) in enumerate(BEAMS):
    for _y in range(66, 90):
        for _x in range(44, 82):
            if not HOLE[_y, _x]: continue
            d_, t_ = _seg_d(_x, _y, a_, b_)
            if d_ <= th:
                BEAM[_y, _x] = True
                edge_ = d_ > th - 0.75
                ROOF_STILL[_y, _x] = ((20, 14, 13) if edge_ else (30, 21, 18)) + (255,)
                HOLE_GLOW.pop((_x, _y), None)
                burnt_end = (bi < 2 and t_ < 0.25)                            # the ends nearest the flames glow most
                if _r.random() < (0.85 if burnt_end else 0.5 if edge_ else 0.14):
                    COALS.append(dict(x=_x, y=_y, heat=_r.uniform(0.7, 1.0) if burnt_end else _r.uniform(0.4, 0.95), p=_r.uniform(0, math.tau), q=_r.uniform(0, math.tau),
                                      k=_r.choice((1, 1, 2)), wave=t_ * 5.0 + bi))
COAL_RAMP = [(74, 24, 18), (122, 36, 22), (176, 58, 26), (222, 98, 36), (246, 150, 58), (255, 200, 104)]
def draw_coals(px, f):
    """glowing coals on the charred frame: each breathes slowly on its own timing, with a slow glow that runs along the
    beam. They are light sources, so they are allowed to pulse; nothing they light changes."""
    ph = f / N * TAU
    for (x_, y_), g_ in HOLE_GLOW.items():                     # hole light: slow, soft pulse (two whole cycles per loop at most)
        k_ = g_ * (0.84 + 0.11 * math.sin(ph + x_ * 0.21) + 0.05 * math.sin(2 * ph - y_ * 0.5 + 1.0))
        px[y_, x_] = (int(14 + 96 * k_), int(9 + 26 * k_ ** 1.3), int(10 + 4 * k_), 255)
    for c_ in COALS:
        b_ = c_["heat"] * (0.62 + 0.26 * math.sin(c_["k"] * ph + c_["p"]) + 0.12 * math.sin(2 * ph - c_["wave"] + c_["q"]))
        px[c_["y"], c_["x"]] = COAL_RAMP[max(0, min(5, int(b_ * 6.2)))] + (255,)
_rcols = U[ROOF][:, :4][np.argsort(LUM[ROOF], kind="stable")]
ROOF_BUILD = BELOW_HOLE | (BUILD_F & (yy < 44)) | (xx >= 84)
ROOF_FIRE = [None,   # (the fire bed is created below, after FireBed is defined)
             None, None, None]

# ---------------------------------------------------------------- belfry rebuilt for the bell (Jeremy 2026-11-21)
# The 25% art has the bell drawn tilted mid-swing and firelit, half hidden by fire. bell.py needs the standard bell, so:
#   1. the belfry is emptied: the tilted bell, its lit rim and the old fire are removed; what was behind them (open sky,
#      the far rail and the corner post) comes from the 50% belfry, darkened with a fit taken from the belfry around it
#   2. the standard bell (the 50% art's drawn bell, posed by bell.py: hung under the roof point x=110, symmetric,
#      lightened as in the other states) is drawn in the 25% tones; firelight25 then lights it like any other surface
#   3. the belfry tongues and cinders are drawn after it, so the fire stays in front of the bell
bell = _load("bell")
_H50im = Image.fromarray(H50); _B5 = _H50im.load()
BELL50 = bell.bell_mask(_B5); BELL_FRONT = bell.front_mask(_B5, BELL50)
_M50 = np.zeros((H, W), bool)
for (_x, _y) in BELL50: _M50[_y, _x] = True
_u = U.astype(int); _warmB = (_u[..., 3] > 0) & (_u[..., 0] - _u[..., 2] > 10)
_zone = box(84, 18, 132, 52)
_common = _zone & (U[..., 3] == 255) & (H50[..., 3] == 255) & ~FIRE & ~_warmB & ~_M50 & (LUM < 170) & ~ndi.binary_dilation(FIRE | _warmB, iterations=1)
_tc = [np.polyfit(H50[..., c][_common].astype(float), U[..., c][_common].astype(float), 1) for c in range(3)]
def tone25(c): return tuple(int(max(0, min(255, round(_tc[i][0] * c[i] + _tc[i][1])))) for i in range(3)) + (255,)
BELFRY_ZONE = box(93, 24, 124, 46)
_S50 = (H50[..., 3] == 255) & ~_M50                           # belfry structure in the 50% art (posts, rails, far rail, beam)
BELFRY_PLATE = U.copy()
for _y, _x in zip(*np.where(BELFRY_ZONE)):
    bellish = bool(FIRE[_y, _x] or _warmB[_y, _x] or LUM[_y, _x] > 170 or U[_y, _x, 3] < 255)
    opening = (93 <= _x <= 113 or 117 <= _x <= 124) and 27 <= _y <= 40
    if _S50[_y, _x]:
        if bellish or opening: BELFRY_PLATE[_y, _x] = tone25(H50[_y, _x])
    elif opening or bellish: BELFRY_PLATE[_y, _x] = 0
# the belfry fire may draw over the open sky, the bell and the far rail low in the openings; never over posts, beams, roof
BUILD_BELFRY[:] = (BELFRY_PLATE[..., 3] == 255) & ~(BELFRY_ZONE & (yy >= 40) & ((xx <= 113) | (xx >= 117)))
ATTACK = bool(os.environ.get("ATTACK"))
_pose_cache = {}
def draw_bell(px, f):
    ang = round(bell.angle_at(f, N, 20.0, 1), 2) if ATTACK else 0.0          # idle: hangs still; under attack: swings evenly +-20 deg
    if ang not in _pose_cache: _pose_cache[ang] = {(k[0] + bell.SHIFT, k[1]): v for k, v in bell.pose(BELL50, ang).items()}
    bm = np.zeros((H, W), bool); col = np.zeros((H, W, 4), np.uint8)
    for (x, y), c in _pose_cache[ang].items():
        if (x, y) not in BELL_FRONT and 0 <= x < W and 0 <= y < H:                   # the corner post stays in front
            c2 = c if tuple(c) == tuple(bell.OUTLINE) else (int(c[0] * BELL_TONE), int(c[1] * BELL_TONE), int(c[2] * BELL_TONE), 255)
            px[y, x] = c2; bm[y, x] = True; col[y, x] = c2
    BELL_COL[f] = col; BELL_OUTLINE[f] = bm & (col[..., :3] == np.array(bell.OUTLINE[:3])).all(-1); BELL_ANG[f] = ang
    for (x, y) in bell.HANGER:
        if (x, y) not in BELL_FRONT: px[y, x] = tone25((24, 21, 19))                 # same as bell.py: the beam stays in front of the hanger
    BELL_PX[f] = bm
BELL_PX = {}; BELL_COL = {}; BELL_OUTLINE = {}; BELL_ANG = {}
SWING_LIGHT = float(os.environ.get("SWING_LIGHT", 0.28))      # how much brighter / darker the bell gets at the two ends of its swing
BELL_TONE = float(os.environ.get("BELL_TONE", 0.82))          # the standard bell's own colours, slightly darker for the darker 25% scene
def bell_firelit(o_, u, f):
    """Jeremy 2026-11-21: the bell must keep its curved look (dark outline, rounded shading, the curled lip) like the
    other states, and be firelit as in the still. So the general firelight (which lifts darks and flattened it) is NOT
    used on the bell. Its own drawn colours are warmed and brightened by a multiply -- more toward its underside and its
    left flank, which face the fire -- so every shade it has stays in step; the outline stays dark; the pixels just inside
    the outline on the fire side catch a little extra. Follows the bell as it swings; does not flicker."""
    bm = BELL_PX.get(f)
    if bm is None: return o_
    col = BELL_COL[f]; ol = BELL_OUTLINE[f]
    vis = bm & (u == col).all(-1)                               # bell pixels not covered by a flame or a cinder in this frame
    ys, xs = np.where(bm)
    if not len(ys): return o_
    ty = (yy - ys.min()) / max(1, ys.max() - ys.min()); tx = 1 - (xx - xs.min()) / max(1, xs.max() - xs.min())
    side = np.clip(0.55 * ty + 0.45 * tx, 0, 1)
    inner = bm & ~ol & (np.roll(ol, -1, 0) | np.roll(ol, 1, 1))        # just inside the outline, at the bottom / on the left
    # Jeremy 2026-11-21: the big belfry flames are on the bell's left. As it swings toward them (bell.py: + angle = the
    # mouth swings left) it is nearer the fire and catches more light; swinging away it falls darker. Smooth with the swing.
    near = 1.0 + SWING_LIGHT * (BELL_ANG.get(f, 0.0) / 20.0)
    gain = ((1.02 + 0.50 * side + 0.22 * inner) * near)[..., None] * np.array([1.30, 0.97, 0.66])
    lit = np.clip(col[..., :3].astype(float) * gain, 0, 255)
    lit = np.where(ol[..., None], np.array([20.0, 13.0, 10.0]) + np.array([34.0, 14.0, 3.0]) * (side * (np.roll(bm, 1, 0) & ~np.roll(bm, -1, 0) | ~np.roll(bm, 1, 1)))[..., None], lit)
    o_ = o_.copy(); o_[..., :3] = np.where(vis[..., None], lit, o_[..., :3]).astype(np.uint8)
    return o_

class Cinders:
    """Cinders inside the belfry: 1-px embers that leave the flame tops, rise ~1 px a frame with a slight wander and the
    wind, and cool from pale yellow through orange to dark red before they reach the belfry ceiling. Staggered so a few
    are always in the air; each has its own path, life and timing. They pass in front of the bell, never over the posts."""
    COOL = [(244, 226, 160), (255, 204, 104), (248, 150, 56), (206, 84, 34), (132, 46, 26)]
    def __init__(self, sources, n, seed, ceiling, build=None, rise=(8, 14)):
        r = random.Random(seed); self.c = []; self.build = BUILD_BELFRY if build is None else build
        for i in range(n):
            sx, sy = r.choice(sources)
            period = r.choice((16, 16, 8)); life = r.randint(7, 11) if period == 16 else r.randint(5, 7)
            self.c.append(dict(x=sx + r.uniform(-1, 1), y=sy - r.uniform(0, 2), rise=min(sy - ceiling - 1.5, r.uniform(*rise)), drift=r.uniform(-1.5, 3.0),
                               wob=r.uniform(0.5, 1.4), ph=r.uniform(0, math.tau), period=period, life=life, off=round(i * 16 / n) + r.randrange(2), hot=r.uniform(0.0, 0.25)))
    def render(self, px, f):
        for c in self.c:
            k = (f + c["off"]) % c["period"]
            if k >= c["life"]: continue
            t = (k + 0.5) / c["life"]
            x = int(round(c["x"] + c["drift"] * t + c["wob"] * math.sin(c["ph"] + 4.2 * t)))
            y = int(round(c["y"] - c["rise"] * (1 - (1 - t) ** 1.25)))
            if not (0 <= x < W and 0 <= y < H) or self.build[y, x]: continue
            px[y, x] = self.COOL[min(4, int((t + c["hot"]) * 4.6))] + (255,)
def _tops(m):
    ys, xs = np.where(m); out = []
    for x in sorted(set(xs)): out.append((int(x), int(ys[xs == x].min())))
    return out
_bt = [p for m, _f in belfry_flames for p in _tops(m)]
# roof-hole fire: a low bed in the burned-through left part and three tongues licking out of it (drawn roof-flame colours)
ROOF_FIRE = [FireBed(50, 63, 82, _rcols, ROOF_BUILD | ~HOLE, salt=9),
             Tongue((52.8, 81.0), 6.0, _rcols, ROOF_BUILD, off=6, wmax=1.7, lean=-0.9, powers=(0.8, 1.0), sway=0.9),
             Tongue((57.0, 82.5), 10.5, _rcols, ROOF_BUILD, off=2, wmax=2.5, lean=-0.8, powers=(1.0, 0.75), sway=1.2, reach=6.0),
             Tongue((61.5, 82.0), 8.0, _rcols, ROOF_BUILD, off=5, wmax=2.1, lean=1.0, powers=(0.7, 1.0), sway=1.0, reach=5.0)]
ROOF_CINDERS = Cinders([(53, 75), (57, 70), (61, 72), (66, 76), (71, 75)], 8, 903, 34, build=np.zeros((H, W), bool), rise=(12, 26))
BELFRY_CINDERS = [Cinders([p for p in _bt if p[0] < 112], 9, 901, 26), Cinders([p for p in _bt if p[0] >= 112] or _bt, 2, 902, 28)]
clusters = []
for i, m in enumerate(comps(FLOOR, 1, 8)): clusters.append(Cluster(m, "free", 1.0, 0.16, salt=40 + i))
for i, m in enumerate(comps(ARCH, 2, 8)): clusters.append(Cluster(m, "tip", 1.0, 0.45, T=3, salt=60 + i))
for i, m in enumerate(comps(WIN, 2, 6)): clusters.append(Cluster(m, "tip", 1.0, 0.45, T=3, salt=70 + i))
ANIM = np.zeros((H, W), bool)
for c in clusters: ANIM |= c.m
for _, m, _f in sky_flames: ANIM |= m
# loose spark dots the still has frozen against the sky: removed (Jeremy 2026-11-21); rising sparks replace them later
LOOSE_SKY = FIRE & ~ANIM & ~FLAG & ~BELFRY & ~DOOR_IN & (BG[..., 3] == 0)
alone = FIRE & ~ANIM & ~FLAG & ~BELFRY & (ndi.convolve(FIRE.astype(int), np.ones((3, 3), int), mode="constant") == 1)
sky_next = np.zeros_like(alone)
for _dy, _dx in ((0, 1), (0, -1), (-1, 0)): sky_next |= np.roll(np.roll(U[..., 3] == 0, _dy, 0), _dx, 1)
STRAY = alone & sky_next & (yy < 100)                         # single dots standing against the sky (roof line, gable edge)
LOOSE_SKY |= STRAY

# doorway interior: warm pixels inside the arch ripple upward
r_, g_, b_ = [U[..., i].astype(int) for i in range(3)]
DOOR_FIRE = DOOR_IN & (U[..., 3] == 255) & (r_ - b_ > 28) & (r_ > 70) & (r_ > g_ + 12)
door_ys, door_xs = np.where(DOOR_FIRE)

# ---------------------------------------------------------------- ember specks around the windows, doorway and entrance
# (Jeremy 2026-11-21: they must float up and disappear, not sit frozen). A speck = a warm or pale pixel (or 2-3 px bit)
# that stands out from what is around it. Each is lifted off the picture and becomes a cinder that starts where it was
# drawn, in its own drawn colour, rises a few px, cools and vanishes; staggered so about half are in the air at once.
_r4, _g4, _b4 = [U[..., i].astype(int) for i in range(3)]
_sp = (U[..., 3] > 0) & (((_r4 - _b4 > 48) & (_r4 > 100) & (_r4 > _g4 + 22)) | (LUM > 175)) & (LUM > ndi.median_filter(LUM, 5) + 28)
# dim red embers (too dark for the rule above) count too, right around the burning openings (Jeremy: three by the
# far-left window were still frozen): warm, and clearly redder than what surrounds them
_zones = box(0, 88, 20, 148) | box(44, 100, 72, 154) | box(94, 100, 116, 142) | box(142, 96, 162, 136) | box(112, 86, 146, 172) | box(106, 160, 166, 196)
_sp |= _zones & (U[..., 3] > 0) & (_r4 - _b4 > 35) & (_r4 > 85) & (_r4 > _g4 + 15) & (_r4 > ndi.median_filter(_r4, 5) + 26)
_sp &= ~ANIM                                                  # the moving flames themselves are not specks (but a lone ember beside one is)
_lab, _n = ndi.label(_sp, structure=np.ones((3, 3)))
SPECKS = np.zeros((H, W), bool)
for k in range(1, _n + 1):
    m_ = _lab == k
    if m_.sum() <= 3: SPECKS |= m_
SPECKS &= (yy >= 86) & ~ANIM & ~SIDE_GONE & ~FLAG_GONE & ~box(160, 84, 183, 132)
# Jeremy 2026-11-21: no floating cinders on the sandbags, on the bottom two steps and the fallen cross, or at the lower
# part of the far-left window. Embers drawn there stay as drawn (still).
NO_FLOAT = box(147, 152, 183, 199) | box(84, 173, 183, 199) | box(0, 118, 22, 150)
SPECKS_ALL = int(SPECKS.sum()); SPECKS_FULL = SPECKS.copy(); SPECKS &= ~NO_FLOAT
# Jeremy 2026-11-21: the 4 drawn dots hanging in the air right of the steps (beside the entrance fire) are erased
ERASED = np.zeros((H, W), bool)
for _x, _y in ((147, 158), (149, 165), (150, 170), (151, 175)): ERASED[_y, _x] = True
SPECK_BG = U.copy()
for _y, _x in zip(*np.where(SPECKS_FULL)):                     # what is behind a speck: the typical colour around it
    nb = np.array([U[_y + dy, _x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if 0 <= _y + dy < H and 0 <= _x + dx < W and not SPECKS_FULL[_y + dy, _x + dx] and not FIRE[_y + dy, _x + dx]])
    if len(nb): SPECK_BG[_y, _x] = nb[np.argsort(nb[:, :3].sum(1))[len(nb) // 2]]
    else: SPECK_BG[_y, _x] = BG[_y, _x]
class SpeckCinders:
    def __init__(self, seed=77):
        r = random.Random(seed); self.c = []
        # Jeremy 2026-11-21: far fewer -- about the roof hole's amount (8) per fire, not one per drawn speck. Every drawn
        # speck is still lifted off the picture (none stays frozen); only a few per opening become floating cinders.
        quota = [("far-left window", (0, 88, 20, 117), 4), ("side window", (44, 100, 72, 154), 4), ("front-left window", (94, 100, 116, 142), 3),
                 ("front-right window", (142, 96, 162, 136), 3), ("doorway + entrance", (112, 86, 146, 172), 8)]
        pts = [(int(_x), int(_y)) for _y, _x in zip(*np.where(SPECKS))]; chosen = []; self.per_zone = {}
        for name, (x0, y0, x1, y1), k in quota:
            z = [p_ for p_ in pts if x0 <= p_[0] <= x1 and y0 <= p_[1] <= y1 and p_ not in chosen]
            r.shuffle(z); chosen += z[:k]; self.per_zone[name] = len(z[:k])
        for _x, _y in chosen:
            period = 16 if r.random() < 0.8 else 8
            # variety like the roof-hole cinders (Jeremy 2026-11-21): some leave pale-yellow hot, some orange, most a dull
            # red; each cools down the same ramp, and a few twinkle one step brighter for a frame on the way up
            u_ = r.random(); hot = r.uniform(0.0, 0.12) if u_ < 0.22 else r.uniform(0.25, 0.45) if u_ < 0.58 else r.uniform(0.55, 0.78)
            self.c.append(dict(x=float(_x), y=float(_y), hot=hot, twinkle=r.randrange(2, 7) if r.random() < 0.35 else -1, rise=r.uniform(5, 12) * (1.25 - 0.4 * hot),
                               drift=r.uniform(-0.6, 2.2), wob=r.uniform(0.3, 1.0),
                               ph=r.uniform(0, math.tau), period=period, life=r.randint(8, 12) if period == 16 else r.randint(5, 7), off=r.randrange(16)))
    def render(self, px, f):
        for c in self.c:
            k = (f + c["off"]) % c["period"]
            if k >= c["life"]: continue
            t = (k + 0.5) / c["life"]
            x = int(round(c["x"] + c["drift"] * t + c["wob"] * math.sin(c["ph"] + 4.0 * t)))
            y = int(round(c["y"] - c["rise"] * (1 - (1 - t) ** 1.3)))
            if not (0 <= x < W and 0 <= y < H) or NO_FLOAT[y, x] or (px[y, x, 3] == 0 and y > 150): continue
            i = min(4, int((c["hot"] + t * (1 - 0.55 * c["hot"])) * 4.6))       # same cooling ramp as the roof-hole cinders
            if k == c["twinkle"]: i = max(0, i - 1)
            px[y, x] = Cinders.COOL[i] + (255,)
SPECK_CINDERS = SpeckCinders()
U_RIPPLE = U.copy(); U_RIPPLE[SPECKS] = SPECK_BG[SPECKS]

# doorway: the fire inside licks more (Jeremy 2026-11-21). The rippling fire texture stays; two tongues now rise out of
# the bright fire low in the doorway into the dark above it. Only inside the door opening, never over frame or leaf.
DOOR_OPEN = box(125, 104, 134, 170) & (U[..., 3] == 255) & (DOOR_FIRE | FIRE | (LUM < 45))
_dsel = DOOR_OPEN & (DOOR_FIRE | FIRE)
_dcols = U[_dsel][:, :4][np.argsort(LUM[_dsel], kind="stable")]; _dcols = _dcols[int(len(_dcols) * 0.35):int(len(_dcols) * 0.9)]
DOOR_TONGUES = [Tongue((127.3, 152.0), 12.0, _dcols, ~DOOR_OPEN, off=1, wmax=1.6, lean=0.7, powers=(1.0, 0.75), sway=1.0, reach=6.0),
                Tongue((131.2, 154.0), 9.0, _dcols, ~DOOR_OPEN, off=5, wmax=1.3, lean=-0.6, powers=(0.75, 1.0), sway=0.8, reach=5.0)]

def frame(f):
    ph = f / N * TAU
    px = U.copy()
    px[SPECKS] = SPECK_BG[SPECKS]
    px[ERASED] = SPECK_BG[ERASED]
    px[LOOSE_SKY] = 0
    px[FLAG_GONE] = 0
    px[POLE] = 0
    px[SIDE_GONE] = 0
    taken = np.zeros((H, W), bool)
    for c in clusters:                                       # clear, then draw each warped flame
        px[c.m] = BG[c.m]
    for c in clusters: c.render(px, ph, taken)
    for _, m, _f in sky_flames: px[m] = BG[m]
    for _, m, fl in sky_flames: fl.render(px, f)
    SIDE_LICK.render(px, f)
    px[ROOF_MASK] = ROOF_STILL[ROOF_MASK]
    draw_coals(px, f)
    for t_ in ROOF_FIRE: t_.render(px, f)
    if not os.environ.get("NO_ROOF_CINDERS"): ROOF_CINDERS.render(px, f)
    px[BELFRY_DOTS] = BG[BELFRY_DOTS]
    for m, _f in belfry_flames: px[m] = BG[m]
    px[BELFRY_ZONE] = BELFRY_PLATE[BELFRY_ZONE]
    draw_bell(px, f)
    for t_ in BELFRY_FIRE: t_.render(px, f)
    for cd in BELFRY_CINDERS: cd.render(px, f)
    s = f / N * TILE * 2.5
    for y, x in zip(door_ys, door_xs):
        depth = min(1.0, max(0.0, (y - 108) / 50))           # stronger low down where the flames are
        n = .6 * tnoise(x, y + s * 2, 5, 2.5) + .4 * tnoise(x * 1.5, y + s, 6, 2.5)
        dy = round((1.2 + 2.3 * depth) * (n - .5) * 2)
        sy = y + dy
        if 0 <= sy < H and DOOR_FIRE[sy, x]: px[y, x] = U_RIPPLE[sy, x]
    for t_ in DOOR_TONGUES: t_.render(px, f)
    SPECK_CINDERS.render(px, f)
    return px

# ---------------------------------------------------------------- firelight (firelight25.py = the lit still's own recipe)
lt = _load("firelight25")
_cl = os.environ.get("CROSS_LAYER", os.path.join(os.path.dirname(os.path.dirname(src)), "d25", "cross_layer.png"))
_cm = np.array(Image.open(_cl).convert("RGBA"))[..., 3] > 0
CROSS = _cm.copy()
for _dy, _dx in ((1, 0), (-1, 0), (0, 1), (0, -1)): CROSS |= np.roll(np.roll(_cm, _dy, 0), _dx, 1)
# fires behind the building (ridge, corner, side wall) only rim-light it; everything else is a "front" fire
FAR_ZONE = (V3[..., 3] == 0) | FLAG_GONE | POLE | ndi.binary_dilation(RIDGE, iterations=2) | CORNER | CORNER_ADD | SKIRT | SIDE
# Jeremy 2026-11-21: the open door leaf on the right (x 135+) is wood in front of the fire, so its dark places take
# the light too; only the doorway opening itself (x 125-134) is held back
_interior = box(125, 100, 134, 170) & (U[..., :3].astype(float).mean(-1) < 70) & ~FIRE
HOLD = lt.blur(_interior, 1.2)                               # soft mask: keeps light off the doorway's dark depths
PULSE = float(os.environ.get("PULSE", 3.6))                   # 1 = exactly what the moving flames give; 2.2 was the first try, Jeremy asked for stronger
ROOF_LIGHT = float(os.environ.get("ROOF_LIGHT", 0.7))         # 0 = only what the small roof-hole fire gives by itself
# Jeremy 2026-11-21: the dark places in and around the roof hole are lit by its flames like any other surface (the
# charred frame, the hole's edge, the dim parts of the inside). Only the strongly glowing middle counts as a source.
LIGHT_WEIGHT = np.where(HOLE, float(os.environ.get("HOLE_LIGHT", 0.5)), 1.0)   # inside the hole takes half the light: lit, but still a hole
# Jeremy 2026-11-21: under the firelight the boards nailed over the two front windows went flat against the wall.
# Depth cues, all fixed (nothing here flickers): the boards (dark wood, at least 2 px thick, in the two window areas)
# take less of the light so they stay darker than the siding, as they are in the unlit art; their edge that faces the
# doorway fire catches a little more; and each board throws a short shadow on the siding on the side away from that fire.
_lumU = U[..., :3].astype(float) @ np.array([.3, .59, .11])
_wz = [(box(94, 100, 118, 146), (131.0, 158.0)), (box(140, 94, 164, 140), (131.0, 158.0))]
BOARD = np.zeros((H, W), bool); BOARD_EDGE = np.zeros((H, W), bool); BOARD_SHADOW = np.ones((H, W))
for _zone, (_fx, _fy) in _wz:
    dark_ = _zone & (U[..., 3] == 255) & ~FIRE & (_lumU < 40) & ~SPECKS_FULL
    brown_ = dark_ & (U[..., 0].astype(int) - U[..., 2].astype(int) >= 5)   # boards are dark BROWN wood; the soot marks above the windows are neutral black and are not boards
    bd = ndi.binary_closing(brown_, np.ones((3, 3))) & dark_
    bd = ndi.binary_opening(bd, np.ones((2, 2))) & _zone                    # drops the 1-px lines between the siding boards
    BOARD |= bd
    ys_, xs_ = np.where(_zone); cx_, cy_ = xs_.mean(), ys_.mean()
    dx_, dy_ = cx_ - _fx, cy_ - _fy; n_ = math.hypot(dx_, dy_); ux_, uy_ = dx_ / n_, dy_ / n_      # direction light travels (away from the fire)
    sx1, sy1 = int(round(ux_)), int(round(uy_))
    lit_side = bd & ~np.roll(np.roll(bd, sy1, 0), sx1, 1)                     # board pixel with no board between it and the fire
    BOARD_EDGE |= lit_side
    for dist_, strength in ((1, 0.30), (2, 0.16)):
        sh_ = np.roll(np.roll(bd, int(round(uy_ * dist_)), 0), int(round(ux_ * dist_)), 1) & ~bd & (U[..., 3] == 255) & ~FIRE & ndi.binary_dilation(_zone, iterations=3)
        BOARD_SHADOW = np.where(sh_, np.minimum(BOARD_SHADOW, 1 - strength), BOARD_SHADOW)
LIGHT_WEIGHT = LIGHT_WEIGHT * np.where(BOARD_EDGE, 1.0, np.where(BOARD, 0.55, 1.0))
LIGHT_SOURCES = np.zeros((H, W), bool)
for (x_, y_), g_ in HOLE_GLOW.items():
    if g_ > 0.6: LIGHT_SOURCES[y_, x_] = True
# Jeremy 2026-11-21: the statue was nearly lost in the dark. It gets a little extra firelight of its own, strongest on
# the side facing the burning side window and the doorway (its right), fading across to its left. Fixed amount: the
# statue is a lit surface, so it only follows the general pulse, it does not flicker.
_sm = os.environ.get("STATUE_MASK", os.path.join(os.path.dirname(os.path.dirname(src)), "d0", "statue_mask_exact.png"))
STATUE = np.array(Image.open(_sm).convert("L")) > 127
STATUE_LIGHT = float(os.environ.get("STATUE_LIGHT", 0.26))
STATUE_K = np.zeros((H, W))
for _y in range(H):
    xs_ = np.where(STATUE[_y])[0]
    if len(xs_): STATUE_K[_y, xs_] = STATUE_LIGHT * (0.4 + 0.6 * ((xs_ - xs_.min()) / max(1, xs_.max() - xs_.min())) ** 1.3)
def light_frames(unlit):
    """unlit: list of RGBA arrays. The light field of each frame comes from that frame's own fire pixels; it is then
    averaged with its two neighbours in time (wrapping round the loop) so the light swells and fades without stepping."""
    fires = [lt.isfire(u) for u in unlit]
    glow = np.zeros((H, W)); ph = [f / N * TAU for f in range(len(unlit))]
    for (x_, y_), g_ in HOLE_GLOW.items(): glow[y_, x_] = 0.55 * g_          # the hole's red glow is a (weaker) light source too
    Ls = [lt.light_field(fi, FAR_ZONE, extra=glow * (0.9 + 0.1 * math.sin(p_))) for fi, p_ in zip(fires, ph)]
    # Jeremy 2026-11-21: the roof-hole fire throws a little more light across the roof than its size alone gives
    zone = box(44, 56, 84, 90)
    for i, (fi, p_) in enumerate(zip(fires, ph)):
        src_ = np.clip((fi & zone).astype(float) + glow * (0.9 + 0.1 * math.sin(p_)), 0, 1)
        Ls[i] = Ls[i] + ROOF_LIGHT * (lt.blur(src_, 16) * 2.6 + lt.blur(src_, 6) * 0.6)
    n = len(Ls); Lsm = [0.25 * Ls[(i - 1) % n] + 0.5 * Ls[i] + 0.25 * Ls[(i + 1) % n] for i in range(n)]
    mean = sum(Lsm) / n                                        # the pulse around the average light is widened so it can be seen
    Lsm = [np.maximum(0.0, mean + PULSE * (L_ - mean)) for L_ in Lsm]
    res = []
    for i_, (u, L, fi) in enumerate(zip(unlit, Lsm, fires)):
        KX = STATUE_K                                          # the statue: a surface with a fixed extra light of its own
        u2 = u.copy(); st = (KX > 0) & (u[..., 3] == 255) & ~fi
        u2[..., :3] = np.where(st[..., None], np.clip(u[..., :3] * (1 + 1.1 * KX[..., None]), 0, 255), u[..., :3]).astype(np.uint8)   # lifts its own shading
        o_ = lt.apply(u2, L + 0.55 * KX * st, fi, HOLD, CROSS, sources=LIGHT_SOURCES, weight=LIGHT_WEIGHT)
        shd = (BOARD_SHADOW < 1) & ~fi & (o_[..., 3] == 255) & ~lt.isfire(o_)
        o_[..., :3] = np.where(shd[..., None], o_[..., :3] * BOARD_SHADOW[..., None], o_[..., :3]).astype(np.uint8)
        res.append(bell_firelit(o_, u, i_))
    return res, Lsm

if __name__ == "__main__":
    unlit = [frame(f) for f in range(N)]
    lit, LS = light_frames(unlit)
    lstrip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
    for i, fr in enumerate(lit): lstrip.paste(Image.fromarray(fr), (i * W, 0))
    lstrip.save(out + f"_lit_{N}f.png")
    np.save(out + "_light.npy", np.array(LS).astype(np.float32))
    frames = [Image.fromarray(u) for u in unlit]
    strip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
    for i, fr in enumerate(frames): strip.paste(fr, (i * W, 0))
    strip.save(out + f"_flames2_{N}f.png")
    print("bell:", "RINGING (attack strip)" if ATTACK else "hanging still (idle strip)", "| poses used:", sorted(_pose_cache))
    print("clusters", len(clusters), "animated flame px", int(ANIM.sum()), "of", int(FIRE.sum()), "loose sky dots removed", int(LOOSE_SKY.sum()),
          "door ripple px", len(door_ys))
    for c in clusters: print(" ", c.mode, "x", c.x0, c.x1, "y", c.y0, c.y1, "px", int(c.m.sum()), "H", round(c.Hk, 1))
    for name, m, fl in sky_flames:
        ys, xs = np.where(m); print("  sky", name, "x", xs.min(), xs.max(), "y", ys.min(), ys.max(), "px", int(m.sum()), "body", int(fl.body.sum()), "filled", int(fl.fill.sum()),
                                    "tips", fl._tips(), "licks", len(fl.licks))
    print("corner: left shoulder px added:", int(SKIRT.sum()), "| right side widened by px:", int((CORNER_ADD & ~FIRE).sum()))
    print("flag pixels removed:", int(FLAG_GONE.sum()), "| drawn side-wall flame px replaced:", int(SIDE_GONE.sum()), "by the small licking tongue")
    print("belfry: frozen cinder dots replaced:", int(BELFRY_DOTS.sum()), [(int(x), int(y)) for y, x in zip(*np.where(BELFRY_DOTS))], "| moving cinders:", sum(len(c.c) for c in BELFRY_CINDERS))
    print("roof: plate px", int(ROOF_PLATE.sum()), "hole px", int(HOLE.sum()), "beam px", int(BEAM.sum()), "coals", len(COALS))
    print("erased dots right of the steps:", [(int(x), int(y), U[y, x][:3].tolist()) for y, x in zip(*np.where(ERASED))])
    print("drawn specks lifted off:", int(SPECKS.sum()), "| floating cinders:", len(SPECK_CINDERS.c), SPECK_CINDERS.per_zone, "| left still (sandbags, bottom steps + cross, lower far-left window):", SPECKS_ALL - int(SPECKS.sum()))
    print("stray dots removed:", [(int(x), int(y)) for y, x in zip(*np.where(STRAY))])
