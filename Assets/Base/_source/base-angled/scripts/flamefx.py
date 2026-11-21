"""Moving flame built from one drawn (PixelLab) flame.  v2 after Jeremy's notes (2026-11-21):
  * loose flame pieces must DRIFT UP and die out, not hover: the drawn loose pieces are lifted off the body and become
    licks that are born at a tongue tip, rise ~2 px / frame, lean with the wind, cool (yellow -> red) and shrink away
  * every tongue moves, small side tongues too: motion is scaled by each tongue's OWN height, not the whole flame's
  * the body keeps the drawn shape as its average; its outline and colour bands are re-cut each frame by a pattern
    that travels up the flame (swell, thin, stretch at the tips)
Only the flame's own tones are used. Everything loops in N frames."""
import math, random
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

_rng = np.random.default_rng(7)
_LAT = _rng.random((8, 64, 64))
def noise(u, v, salt, tile):
    """smooth value noise; v tiles every `tile` cells (used as 'up the flame' or as time) -> seamless loop"""
    u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int); fu = u - u0; fv = v - v0
    fu = fu * fu * (3 - 2 * fu); fv = fv * fv * (3 - 2 * fv)
    g = lambda a, b: _LAT[salt, np.mod(b, tile), np.mod(a, 64)]
    return (g(u0, v0) * (1 - fu) + g(u0 + 1, v0) * fu) * (1 - fv) + (g(u0, v0 + 1) * (1 - fu) + g(u0 + 1, v0 + 1) * fu) * fv

class Flame:
    def __init__(self, U, mask, build, N=16, salt=0, K=7, vy=2.0, sway=1.5, stretch=0.22, edge=0.32, wind=1.0, licks=True, max_licks=6, ragged=True, extra=None, rag_rows=(), no_slits=False, barb_rows=(), calm=0.05, plume=34.0, tears=(), max_template_px=None):
        self.tears = list(tears); self.max_template_px = max_template_px
        self.plume = plume                                         # how far (px) a tongue can stretch above its drawn tip; small flames need less
        self.calm = calm                                           # how much the colour bands move near the base (0.05 = nearly still)
        self.no_slits = no_slits; self.barb_rows = list(barb_rows)   # (y0, y1, side, amp): a tall side edge that should lick upward
        self.max_licks = max_licks; self.ragged = ragged; self.rag_rows = list(rag_rows)   # rag_rows: (y0, y1, side 0=left/1=right) edges that were cut straight
        self.U, self.N, self.build, self.vy, self.A, self.B, self.edge, self.wind = U, N, build, vy, sway, stretch, edge, wind
        H, W = mask.shape; self.H, self.W = H, W
        self.yy, self.xx = np.mgrid[0:H, 0:W]
        self.salt = salt; r = random.Random(500 + salt); self.r = r
        lum = .3 * U[..., 0] + .59 * U[..., 1] + .11 * U[..., 2]
        rank = np.zeros((H, W)); o = np.argsort(lum[mask], kind="stable"); rk = np.empty(len(o)); rk[o] = np.linspace(0, 1, len(o)); rank[mask] = rk
        # base line from the whole drawn flame
        # `extra`: pixels added to the drawn flame (e.g. where the drawing was cut off straight by its paint mask)
        drawn = mask
        if extra is not None and extra.any():
            # colour the added pixels the way the drawn flame is coloured at the same depth in from its edge (dark rim,
            # brighter inside); drawn pixels that used to be the rim and are now inside are lifted to match
            dd = ndi.distance_transform_edt(drawn | build); nd = ndi.distance_transform_edt(drawn | extra | build)
            prof = [float(np.median(rank[drawn & (np.rint(dd) == k)])) if (drawn & (np.rint(dd) == k)).any() else None for k in range(1, 9)]
            for k in range(1, 8):
                if prof[k] is None: prof[k] = prof[k - 1]
            want = np.array(prof)[np.clip(np.rint(nd).astype(int), 1, 8) - 1]
            rank = rank.copy(); rank[extra] = want[extra]
            nearx = drawn & ndi.binary_dilation(extra, iterations=7)
            rank[nearx] = np.maximum(rank[nearx], want[nearx])
            mask = mask | extra
        lab0, n0 = ndi.label(mask, structure=np.ones((3, 3)))
        main = lab0 == (1 + int(np.argmax(ndi.sum(mask, lab0, range(1, n0 + 1)))))
        cols = np.arange(W); bot = np.full(W, -1.0)
        for x in range(W):
            c = np.where(main[:, x])[0]
            if len(c): bot[x] = c.max()
        have = bot >= 0
        self.cb = ndi.median_filter(np.interp(cols, cols[have], bot[have]), 7, mode="nearest")
        # body = pieces that reach the base line; the rest are loose pieces (become rising licks)
        lab, n = ndi.label(mask, structure=np.ones((3, 3)))
        body = np.zeros_like(mask); loose = []
        for i in range(1, n + 1):
            m = lab == i; ys, xs = np.where(m)
            if ((ys.max() >= self.cb[xs[ys.argmax()]] - 2) and have[xs[ys.argmax()]]) or m.sum() >= 0.4 * mask.sum(): body |= m
            else: loose.append(m)
        # close the narrow slots / pin-holes the drawing has low down between a side tongue and the main flame: frozen
        # there (the base hardly moves) they read as an odd static gap. Filled with a slightly darker seam tone; higher
        # up the split between tongues still opens and closes with the motion.
        dh = self.cb[self.xx] - self.yy
        hk0 = float(np.percentile((self.cb - np.array([np.where(body[:, x])[0].min() if body[:, x].any() else self.cb[x] for x in range(W)]))[body.any(0)], 90))
        closed = ndi.binary_closing(np.pad(body, 4), np.ones((3, 3)), iterations=2)[4:-4, 4:-4]
        fill = closed & ~body & ~build & (dh >= 0) & (dh <= max(6.0, 0.45 * hk0))
        hl, hn = ndi.label(ndi.binary_fill_holes(body) & ~body & ~build)
        for i in range(1, hn + 1):
            if (hl == i).sum() <= 8: fill |= hl == i
        if fill.any():
            bf0 = body.astype(float)
            near = ndi.gaussian_filter(rank * bf0, 1.2) / np.maximum(ndi.gaussian_filter(bf0, 1.2), 1e-6)
            rank = rank.copy(); rank[fill] = 0.88 * near[fill]
            body = body | fill
        self.fill = fill
        self.body = body; self.full = mask | fill
        top = np.full(W, -1.0)
        for x in range(W):
            c = np.where(body[:, x])[0]
            if len(c): top[x] = c.min()
        hb = top >= 0; self.x0, self.x1 = np.where(hb)[0].min(), np.where(hb)[0].max()
        self.top = np.interp(cols, cols[hb], top[hb])
        self.hcol = np.maximum(3.0, ndi.median_filter(self.cb - self.top + 1, 3, mode="nearest"))   # each tongue's own height
        self.Hk = float(np.percentile((self.cb - top)[hb], 90))
        # tones (brightest last) with the drawn proportions
        px = U[drawn][:, :3]
        q = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8)).quantize(K, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = np.array(q.getpalette()[:K * 3]).reshape(K, 3); idx = np.array(q).ravel()
        order = np.argsort(.3 * pal[:, 0] + .59 * pal[:, 1] + .11 * pal[:, 2]); self.tones = pal[order]; self.K = K
        counts = np.bincount(idx, minlength=K)[order]; self.bounds = np.cumsum(counts) / counts.sum()
        self.rank = rank
        hid = ndi.binary_dilation(body, iterations=4) & build & (dh > 0)   # the flame carries on behind a wall BESIDE it (not the roof under it)
        ext = body | hid
        if hid.any():
            _, (jy, jx) = ndi.distance_transform_edt(~body, return_indices=True)
            rank = rank.copy(); rank[hid] = rank[jy[hid], jx[hid]]; self.rank = rank
        bf = ext.astype(float)
        rs = ndi.gaussian_filter(rank * bf, .8) / np.maximum(ndi.gaussian_filter(bf, .8), 1e-6)
        self.dout = ndi.distance_transform_edt(~ext)
        up = np.where((self.xx >= self.x0) & (self.xx <= self.x1) & (self.yy < self.top[self.xx]), self.top[self.xx] - self.yy, 1e9)
        # low side edges (near the roof) must not stand as straight walls: pixels just inside the edge sit close to the
        # cut-off and pixels just outside are within reach, so the rising pattern nibbles and bulges them by a pixel
        dh = self.cb[self.xx] - self.yy
        din = ndi.distance_transform_edt(body); low = np.clip(1 - dh / 8.0, 0, 1) * (dh > 0)
        self.E = np.where(ext, .42 + .58 * rs, np.maximum(.42 - self.dout / 2.4, .41 - up / self.plume))
        self.low = low
        self.licks = self._make_licks(loose) if licks else []

    def tone(self, r): return self.tones[np.minimum(self.K - 1, np.searchsorted(self.bounds, np.clip(r, 0, 1), side="left"))]

    # ------------------------------------------------------------ licks
    def _tips(self):
        """tongue tips of the body: pixels with nothing above them (also catches side tongues tucked under a taller one)"""
        b = self.body; cand = []
        ys, xs = np.where(b)
        for y, x in zip(ys, xs):
            if y > 0 and not b[y - 1, max(0, x - 1):x + 2].any() and self.cb[x] - y >= 3: cand.append((x, y))
        cand.sort(key=lambda t: t[1]); tips = []
        for x, y in cand:
            if not any(abs(x - a) <= 2 for a, _ in tips): tips.append((int(x), int(y)))
        return tips
    def _make_licks(self, loose):
        tips = self._tips(); r = self.r; out = []; used = set()
        templates = []
        if self.max_template_px: loose = [m for m in loose if m.sum() <= self.max_template_px]   # big drawn pieces are replaced by tears
        loose = loose[:self.max_licks]
        for m in loose:
            ys, xs = np.where(m); cx, cy = xs.mean(), ys.mean()
            templates.append(dict(pts=[(int(x - round(cx)), int(y - round(cy)), float(self.rank[y, x])) for y, x in zip(ys, xs)], cx=cx, cy=cy))
        if not templates:                                         # no drawn loose pieces: cut small ones from the tips
            for x, y in tips[:2]:
                templates.append(dict(pts=[(0, 0, .45), (0, 1, .6)], cx=x, cy=y - 5))
        def add(tpl, tip, period, offset, reach=None):
            h = max(3.0, tip[1] - tpl["cy"]) if reach is None else reach
            travel = 2 * h + 3
            life = int(max(4, min(period, round(travel / self.vy))))
            out.append(dict(tpl=tpl, tip=tip, period=period, offset=offset, life=life, travel=life * self.vy,
                            side=(tpl["cx"] - tip[0]) if reach is None else r.uniform(-1.5, 1.5), wob=r.uniform(0, math.tau)))
        slots = [round(i * 8 / max(1, len(templates))) % 8 for i in range(len(templates))]; r.shuffle(slots)   # spread over the loop: never all at once
        for tpl, off in zip(templates, slots):                    # each drawn loose piece rises from the tip under it
            tip = min(tips, key=lambda t: abs(t[0] - tpl["cx"]) + 0.15 * abs(t[1] - tpl["cy"]))
            add(tpl, tip, 8, off); used.add(tip)
        for tip in tips:                                          # every other tongue sheds a small lick too
            if tip in used: continue
            small = min(templates, key=lambda t: len(t["pts"]))
            add(dict(pts=small["pts"][:max(2, min(4, len(small["pts"])))], cx=tip[0], cy=tip[1]), tip, 16 if self.hcol[tip[0]] < 0.5 * self.Hk else 8,
                r.randrange(16), reach=max(3.0, 0.35 * self.hcol[tip[0]]))
        return out
    def _draw_licks(self, fr, f, tipshift):
        for L in self.licks:
            k = (f + L["offset"]) % L["period"]
            if k >= L["life"]: continue
            t = (k + 0.5) / L["life"]                              # 0 = leaving the tip, 1 = gone
            spawn = (f + L["offset"]) // L["period"]
            tx, ty = L["tip"]
            y = ty + 1 - tipshift.get(tx, 0) - L["travel"] * t
            x = tx + L["side"] * min(1.0, 1.6 * t) + self.wind * 2.2 * t ** 1.5 + 0.7 * math.sin(L["wob"] + 5 * t + spawn)
            pts = L["tpl"]["pts"]; n = len(pts)
            grow = min(1.0, 0.35 + 2.2 * t) if t < .3 else max(0.0, 1 - ((t - .45) / .55) ** 1.4) if t > .45 else 1.0
            keep = max(1, round(n * grow)) if grow > 0.08 else 0
            # shrink from the bottom / outside in: keep the pixels nearest the top-centre
            order = sorted(range(n), key=lambda i: (pts[i][1] * 1.0 + abs(pts[i][0]) * 0.6))
            for i in order[:keep]:
                dx, dy, rk = pts[i]
                px_, py_ = int(round(x)) + dx, int(round(y)) + dy
                if 0 <= px_ < self.W and 0 <= py_ < self.H and not self.build[py_, px_]:
                    fr[py_, px_, :3] = self.tone(np.array(rk * (1 - 0.75 * t ** 1.2))); fr[py_, px_, 3] = 255

    def _side_barbs(self, on, heat, f):
        """a tall side edge of a flame: tongues run UP it. Each is an upward-pointing barb (edge leans out toward its tip,
        then cuts back in), 8 rows long, climbing 2 px a frame; barbs differ in size. Replaces the row-by-row stepping,
        which jittered like a zipper on a long edge."""
        LAM = 8.0
        for (y0, y1, side, amp) in self.barb_rows:
            step = 1 if side else -1
            for y in range(y0, y1 + 1):
                xs = np.where(on[y])[0]
                if len(xs) < 4: continue
                xe = xs.max() if side else xs.min()
                u = (y + self.vy * f) / LAM + 0.37 * self.salt
                k = int(math.floor(u)) % 4; frac = u - math.floor(u)
                size = (0.55, 1.0, 0.7, 0.9)[k]
                taper = min(1.0, (y - y0 + 1) / 3.0, (y1 - y + 1) / 6.0)
                soft = float(noise(np.array([side * 5.1 + self.salt]), np.array([(y + self.vy * f) / 4.0]), 6, 8)[0]) - 0.5
                w = int(round(amp * taper * (size * (1 - frac) ** 0.85 + 0.5 * soft)))
                w = min(w, max(0, (len(xs) - 2) // 2))                # thin rows (a tip) never grow sideways whiskers
                if w > 0:
                    for i in range(1, w + 1):
                        xo = xe + step * i
                        if 0 <= xo < self.W and not self.build[y, xo]:
                            on[y, xo] = True; heat[y, xo] = max(.44, float(heat[y, xe]) - 0.06 * i - 0.04)
                elif w < 0 and len(xs) > 8:
                    on[y, xe] = False

    def _ragged_low_edges(self, on, heat, f):
        """near the roof the drawn sides are straight walls and hardly move: step the outer edge in or out by one pixel,
        row by row, with a pattern that climbs the edge (never a bite deeper than 1 px, the bottom row stays put)"""
        PY = self.vy * self.N; y1 = int(self.cb[self.x0:self.x1 + 1].max())
        rows = set(range(y1 - 9, y1 + 1)) if self.ragged else set()
        for (a0, a1, _sd) in self.rag_rows: rows |= set(range(a0, a1 + 1))
        for y in sorted(rows):
            xs = np.where(on[y])[0]
            if len(xs) < 5: continue
            for side, xe, step in ((0, xs.min(), -1), (1, xs.max(), 1)):
                dh = self.cb[xe] - y
                forced = any(a0 <= y <= a1 and sd == side for (a0, a1, sd) in self.rag_rows)
                if not forced and (not self.ragged or dh < 1 or dh > 8): continue
                if forced: dh = 2.0
                if any(0 <= xe + step * k < self.W and self.build[y, xe + step * k] for k in (1, 2)): continue   # edge is the building
                v = np.array([(y + self.vy * f) / (PY / 16.0)]); u = np.array([side * 9.3 + self.salt * 1.7])
                n = float(noise(u, v, 6, 16)[0]) * .6 + float(noise(u + 3.1, v / 2, 7, 8)[0]) * .4
                reach = 1.0 - 0.35 * (dh / 8.0)                      # a little calmer higher up, where the flame already moves
                m = 1 if n > 0.5 + 0.12 / reach else -1 if n < 0.5 - 0.10 / reach else 0      # moving part (climbs the edge)
                ns = random.Random(hash((y, side, self.salt, 77))).random()
                st = 1 if ns > 0.72 else -1 if ns < 0.36 else 0                             # fixed part: the wall is never plumb
                tot = max(-2, min(1, m + st))
                if tot > 0:                                           # lick outwards
                    xo = xe + step
                    if 0 <= xo < self.W and not self.build[y, xo]: on[y, xo] = True; heat[y, xo] = .45
                elif tot < 0 and len(xs) > 7:                         # edge pulls in
                    for k in range(-tot): on[y, xe - step * k] = False

    def _draw_tears(self, fr, f, on):
        """A piece of flame that leaves a tongue and floats away (Jeremy 2026-11-21: likes a floating flame that shrinks
        until it disappears; the stretched drawn strip looked odd). Drawn as a small flame of its own: pointed top, fuller
        low down. It swells out of the tongue's tip on a thin neck, the neck snaps, then it rises ~2 px a frame, leaning
        with the wind and swaying, keeps its shape while it shrinks evenly to a single pixel, and cools yellow -> dark red."""
        for T in self.tears:
            tx0, ty0 = T["tip"]
            cols = [x for x in range(tx0 - 1, tx0 + 2) if on[:, x].any()]
            if not cols: continue
            tx = min(cols, key=lambda x: np.where(on[:, x])[0].min()); ty = int(np.where(on[:, tx])[0].min())
            for off, size, side in T["emit"]:
                k = (f + off) % T.get("period", self.N); life = T.get("life", 10)
                if k >= life: continue
                t = (k + 0.5) / life
                sc = size * (1.0 if t < 0.3 else max(0.0, 1 - ((t - 0.3) / 0.7) ** 1.15))
                hgt = 1.8 + 8.2 * sc; wid = 0.5 + 1.9 * sc
                grow = min(1.0, t / 0.22)                              # swelling out of the tip
                bottom = ty + 1 - (T.get("travel", 18.0) * max(0.0, t - 0.12) ** 1.08) - (hgt * grow if t < 0.22 else hgt) + hgt
                cx = tx + .5 + side * min(1.0, 1.5 * t) + self.wind * 2.4 * t ** 1.5 + 0.8 * math.sin(self.salt + 5.5 * t + off)
                if t < 0.3:                                            # the neck that still ties it to the tongue
                    for y in range(int(math.floor(bottom)), ty + 1):
                        x = int(math.floor(tx + .5 + (cx - tx - .5) * (ty - y) / max(1.0, ty - bottom)))
                        if 0 <= y < self.H and 0 <= x < self.W and not self.build[y, x]: fr[y, x, :3] = self.tone(np.array(0.5)); fr[y, x, 3] = 255
                top = bottom - hgt * (grow if t < 0.22 else 1.0)
                for y in range(int(math.floor(top)), int(math.ceil(bottom)) + 1):
                    fy = (y + .5 - top) / max(1e-3, bottom - top)        # 0 = pointed top, 1 = bottom
                    if fy < 0 or fy > 1: continue
                    hw = wid * (fy ** 0.75) * (1 - 0.55 * max(0.0, (fy - 0.72) / 0.28) ** 2)
                    bend = 0.7 * sc * math.sin(2.2 * fy + 6.0 * t + off)
                    for x in range(int(math.floor(cx + bend - hw - 1)), int(math.ceil(cx + bend + hw + 1))):
                        q = abs(x + .5 - (cx + bend)) / max(hw, 0.5)
                        if q <= 1.0 and 0 <= y < self.H and 0 <= x < self.W and not self.build[y, x]:
                            rank = (0.28 + 0.62 * (1 - q) ** 0.8 * (0.5 + 0.5 * fy)) * (1 - 0.72 * t ** 1.2)
                            fr[y, x, :3] = self.tone(np.array(rank)); fr[y, x, 3] = 255

    # ------------------------------------------------------------ body
    def render(self, fr, f):
        """draws this flame into frame array `fr` (the drawn flame must already be cleared to what is behind it)"""
        N, xx, yy = self.N, self.xx, self.yy
        ys = yy + self.vy * f; PY = self.vy * N; s0 = self.salt % 2
        sway = 2 * (noise(xx / 14.0 + self.salt, ys / (PY / 4), 0, 4) * .7 + noise(xx / 9.0, ys / (PY / 8), 1, 8) * .3) - 1
        bump = 2 * (noise(xx / 3.2 + self.salt, ys / (PY / 8), 2, 8) * .6 + noise(xx / 5.5, ys / (PY / 4), 3, 4) * .4) - 1
        edge_n = np.clip(bump * 2.1, -1, 1)                        # same pattern, full swing: drives the outline
        tt = np.full(xx.shape, f / N, dtype=float)
        tip = 2 * (noise(xx / 4.0 + self.salt, tt * 4, 4, 4) * .6 + noise(xx / 7.0, tt * 8, 5, 8) * .4) - 1
        d = self.cb[xx] - yy
        al = np.clip(d / self.hcol[xx], 0, 1.5)                    # height within THIS tongue
        s = 1 + self.B * tip * np.minimum(1, 1.5 * al)
        d2 = np.where(d > 0, d / s, d)
        al2 = np.clip(d2 / self.hcol[xx], 0, 1)
        dx = np.rint(self.A * (self.hcol[xx] / self.Hk) ** 0.5 * al2 ** 1.2 * sway * 1.8).astype(int)
        sx = np.clip(xx - dx, 0, self.W - 1); sy = np.clip(np.rint(self.cb[xx] - d2).astype(int), 0, self.H - 1)
        amp = self.calm + (self.edge + 0.05 - self.calm) * np.minimum(al, 1.0)
        heat = self.E[sy, sx] + amp * bump                         # colour bands: calm near the base
        shape = heat
        heat = np.where(d <= 0, self.E, heat); shape = np.where(d <= 0, self.E, shape)
        on = (shape > .42) & ~self.build & (self.dout < 7)
        heat = np.where(on, np.maximum(heat, .43), heat)
        lab, n = ndi.label(on, structure=np.ones((3, 3)))          # the body stays one piece: loose bits come only from licks
        if n > 1:
            keepl = set(np.unique(lab[self.body & on])) - {0}
            sizes = ndi.sum(on, lab, range(1, n + 1))
            big = {i + 1 for i, sz in enumerate(sizes) if sz >= 0.25 * self.body.sum()}
            on &= np.isin(lab, list(keepl & big) or list(keepl))
        hl, hn = ndi.label(ndi.binary_fill_holes(on) & ~on & ~self.build)   # no pin-holes inside the flame
        if hn:
            hs = ndi.sum(np.ones_like(hl), hl, range(1, hn + 1))
            small = np.isin(hl, [i + 1 for i, v in enumerate(hs) if v <= (12 if self.no_slits else 4)])
            heat = np.where(small, np.maximum(heat, ndi.maximum_filter(np.where(on, heat, 0), 3) * .8), heat); on |= small
        if self.ragged or self.rag_rows: self._ragged_low_edges(on, heat, f)
        if self.barb_rows: self._side_barbs(on, heat, f)
        if self.no_slits:                                          # no 1-px sky lines inside the flame (below the tips)
            for _ in range(3):
                lr = (np.roll(on, 1, 1) & (np.roll(on, -1, 1) | np.roll(on, -2, 1))) | (np.roll(on, -1, 1) & np.roll(on, 2, 1)); ud = np.roll(on, 1, 0) & np.roll(on, -1, 0)
                one = np.roll(on, 1, 1) & np.roll(on, -1, 1)          # 1-px slit: closed at any height
                slit = ~on & ~self.build & (d > 0) & (((lr | ud) & (al < 0.8)) | one)
                if not slit.any(): break
                nb = ndi.maximum_filter(np.where(on, heat, 0), 3)
                heat = np.where(slit, np.maximum(.45, nb * .85), heat); on = on | slit
        fr[on, :3] = self.tone((heat[on] - .42) / .58); fr[on, 3] = 255
        tipshift = {}
        for L in self.licks:
            tx = L["tip"][0]; c = np.where(on[:, tx])[0]
            tipshift[tx] = (L["tip"][1] - c.min()) if len(c) else 0
        self._draw_licks(fr, f, tipshift)
        if self.tears: self._draw_tears(fr, f, on)
        return fr
