"""25% smoke LAYER behind the church (the big plume). APPROVED by Jeremy 2026-11-22 ("i'm good with this").
A separate strip drawn BEHIND #base and IN FRONT of the village (never behind the buildings: Jeremy). Not in the base strips.

OUT  final/base_025_smoke_layer_final_40f.png   40 frames in a GRID, 8 across x 5 down, each 304 x 136 art px, 8 fps
                                                (5 s loop). The frame's top-left corner = the church frame's top-left
                                                corner (church frame 184x200), so in the game it is 608 x 272 px at 2x,
                                                left edge on the church's left edge, top on the church frame's top.
     d25/base_025_smoke_layer_unlit_40f.png     the same without the firelight (plum tones only), same grid
Only fully solid or fully empty pixels; 9 flat colours (5 smoke tones + 4 fire-lit ones).

HOW IT WAS MADE (who drew what)
  1. PixelLab drew the plume as a still ("Draft 2": d25/smoke_layer_draft2_pixellab.png, generate-image-v2 from Jeremy's
     reference picture). Code placed that same drawing behind the roof line twice (front at -74,-84; a darker copy behind
     at -170,-120), in the smoke tones of the in-game still, so that it leaves through the TOP edge of the screen and ends
     before the buildings (Jeremy: keep it in front of the buildings and shorten it).
  2. PixelLab ANIMATED that still (animate-pixminimax, 40 frames, guided back to its first frame) at 1.5x size, in two
     windows of 170 x 170 art px (rows -20..150: the top 20 rows stay above the screen, because PixelLab's smoke runs along
     the window's top edge to its right border there): LEFT = canvas x 0..170, RIGHT = x 126..296. The raw results are
     d25/smoke_layer_pl_left_41f.png and d25/smoke_layer_pl_right_41f.png (41 frames of 256x256, frame 0 = the input).
     See smoke25_layer_pl.py for the calls. Sliding the drawing in code was REJECTED ("doesn't look natural at all and it
     doesn't really billow and roll"); code-drawn ends on the plume were rejected ("fingers"); animating at 1x gave big flat
     lobes ("chunky").
  3. This script (code only moves / selects PixelLab's pixels, it never shades):
     - back to the art's pixel grid: every block takes its most common tone (no blending)
     - no tiny specks: a patch of one tone smaller than 7 px takes the tone around it (Jeremy: "all the tiny specks don't
       look natural")
     - LEFT repeats after 20 frames and moved 1.8x faster than RIGHT, so ONE left cycle is played over the whole loop
       (Jeremy: "slow the left part to match the speed of the right")
     - even speed: each window's loop is resampled at equal amounts of change. An in-between frame is a morph of two
       neighbouring PixelLab frames: every tone's outline is moved part-way between its two positions (distance fields)
     - the two windows are morphed into each other across their overlap (x 130..166), outline by outline, so there is no
       vertical line (Jeremy noticed a fixed line where an earlier animated window started)
     - firelight: a flat colour swap on the smoke near the upper fires (ridge, belfry, corner). It follows each frame's
       own flames, lighter billow faces catch it further out than dark creases, its wavy edge travels with the smoke, and a
       small billow face is lit as a whole, so the edge follows the billows (Jeremy: no fixed line where the lighting
       changes). It was lit with church frame (f mod 16) of the idle strip; the 40-frame loop therefore drifts against the
       16-frame church loop, which is how Jeremy saw and approved it in the game mock.
Checks printed at the end: no edge that sits in the same place in every frame, loop wrap, speeds of the two halves.

Usage (from scripts/):  python3 smoke25_layer.py            -> writes the two files above
"""
import math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
PAL = np.array([(22, 20, 24), (28, 25, 29), (37, 28, 35), (50, 45, 51), (59, 48, 55), (67, 49, 53)])        # smoke tones, dark -> light (index 1..6; 0 = empty)
WARM = {(22, 20, 24): (43, 28, 29), (28, 25, 29): (50, 34, 33), (37, 28, 35): (62, 38, 33), (44, 38, 44): (74, 46, 40),
        (50, 45, 51): (82, 54, 49), (59, 48, 55): (91, 64, 58), (67, 49, 53): (91, 64, 58)}                 # the same tones lit by the fire
REACH = {(22, 20, 24): 0.80, (28, 25, 29): 0.85, (37, 28, 35): 0.95, (44, 38, 44): 1.05, (50, 45, 51): 1.15, (59, 48, 55): 1.25, (67, 49, 53): 1.3}
HIDE, S = 20, 170                # rows of each window kept above the screen; window size in art px
XR = 126                         # RIGHT window starts here (the tower's right edge); LEFT starts at 0
Z0, Z1 = 130, 166                # overlap columns where LEFT is morphed into RIGHT
CW = XR + S                      # 296
LW, LH, N, COLS = 304, 136, 40, 8
LEFT_LAST = 20                   # LEFT's cycle length in PixelLab frames

def strip_frames(path, first, last, size=256):
    st = np.array(Image.open(path).convert('RGBA')); return [st[:, i * size:(i + 1) * size] for i in range(first, last + 1)]
def to_idx(a):
    idx = (((a[..., None, :3].astype(int) - PAL[None, None]) ** 2).sum(-1)).argmin(-1) + 1; idx[a[..., 3] < 128] = 0; return idx
def down(idx256):
    """256 -> 170 (1.5x smaller): blow up 2x, then every 3x3 block takes its most common tone"""
    big = np.repeat(np.repeat(idx256, 2, 0), 2, 1)[:510, :510]; b = big.reshape(170, 3, 170, 3).transpose(0, 2, 1, 3).reshape(170, 170, 9)
    out = np.zeros((170, 170), int); best = (b == 0).sum(-1)
    for c in range(1, 7):
        cnt = (b == c).sum(-1); u = cnt > best; out[u] = c; best[u] = cnt[u]
    return out
def _nb_counts(out, c):
    pad = np.pad(out, 1, mode='edge'); nb = np.stack([pad[1 + dy:1 + dy + out.shape[0], 1 + dx:1 + dx + out.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy, dx) != (0, 0)])
    return np.stack([((nb == k) & (nb != c)).sum(0) for k in range(7)])
def despeck(idx, min_px=7, rounds=2):
    """no tiny specks: a patch of one smoke tone smaller than min_px takes the tone that surrounds it most (sky gaps are left alone)"""
    out = idx.copy()
    for _ in range(rounds):
        for c in range(1, 7):
            m = out == c
            if not m.any(): continue
            lab, n = ndi.label(m)
            area = ndi.sum(m, lab, range(1, n + 1)); small = np.where(area < min_px)[0] + 1
            if len(small) == 0: continue
            sm = np.isin(lab, small); counts = _nb_counts(out, c); rep = counts.argmax(0)
            for _i in range(4):
                ch = sm & (counts.max(0) > 0); out[ch] = rep[ch]; sm &= out == c
                if not sm.any(): break
                counts = _nb_counts(out, c); rep = counts.argmax(0)
    return out
def sdf(m):
    if not m.any(): return np.full(m.shape, -1e3)
    if m.all(): return np.full(m.shape, 1e3)
    return ndi.distance_transform_edt(m) - ndi.distance_transform_edt(~m)
def morph(A, B, t):
    """in-between of two frames: every tone's outline part-way between its two positions; t may be a number or one value per column"""
    best = None; score = None
    for c in range(7):
        ma, mb = A == c, B == c
        if not ma.any() and not mb.any(): continue
        s = (1 - t) * sdf(ma) + t * sdf(mb)
        if score is None: score = s; best = np.full(A.shape, c)
        else:
            upd = s > score; score[upd] = s[upd]; best[upd] = c
    return best
def even(Fr, n_out, K):
    """resample a frame loop to n_out frames at equal amounts of change (K in-betweens per step to choose from)"""
    n = len(Fr); dense = []
    for i in range(n):
        for j in range(K): dense.append(Fr[i] if j == 0 else morph(Fr[i], Fr[(i + 1) % n], j / K))
    M = len(dense); dd = np.array([float((dense[(i + 1) % M] != dense[i]).sum()) for i in range(M)]); dc = np.concatenate([[0], np.cumsum(dd)])
    return [dense[int(np.argmin(np.abs(dc[:-1] - k * dc[-1] / n_out)))] for k in range(n_out)]
def combine(L, Rr):
    out = np.zeros((S, CW), int); out[:, :S] = L; out[:, Z1:] = Rr[:, Z1 - XR:]
    t = np.clip((np.arange(XR, S) - Z0 + 0.5) / (Z1 - Z0), 0, 1)[None, :]
    out[:, Z0:Z1] = morph(L[:, XR:S], Rr[:, 0:S - XR], t)[:, Z0 - XR:Z1 - XR]
    return out
def rgba(idx):
    o = np.zeros(idx.shape + (4,), np.uint8); m = idx > 0; o[m, :3] = PAL[idx[m] - 1]; o[m, 3] = 255; return o
def firelight(layer, f, nloop, CH, reach=24.0):
    fr = CH[:, (f % 16) * 184:(f % 16) * 184 + 184]
    fm = np.zeros((200, 360), bool); fm[:, :184] = (fr[..., 3] > 0) & (fr[..., 0] > 150) & (fr[..., 0] - fr[..., 2] > 80) & (fr[..., 1] > 40); fm[100:, :] = False   # the upper fires only
    d = ndi.distance_transform_edt(~fm)
    yy, xx = np.mgrid[0:200, 0:360]; t = 2 * math.pi * f / nloop
    wave = 0.5 + 0.22 * np.sin(2 * math.pi * (xx * 0.8 - yy * 0.6) / 46.0 - 2 * t) + 0.18 * np.sin(2 * math.pi * (xx * 0.3 + yy) / 31.0 + t + 1.7) + 0.10 * np.sin(2 * math.pi * xx / 17.0 - 3 * t + 0.6)
    al = layer[..., 3] > 0; out = layer.copy()
    for c in {tuple(int(v) for v in c) for c in layer[al][:, :3]}:
        m = al & (layer[..., :3] == c).all(-1)
        want = m & (d < reach * REACH.get(c, 1.0) * (0.55 + 0.9 * wave))
        lab, n = ndi.label(m)
        if n:
            area = ndi.sum(m, lab, range(1, n + 1)); frac = ndi.sum(want, lab, range(1, n + 1)) / np.maximum(area, 1)
            small = area <= 420                                   # a small billow face is lit as a whole or not at all
            whole = np.zeros(n + 1, bool); whole[1:] = small & (frac >= 0.5)
            keep_px = np.zeros(n + 1, bool); keep_px[1:] = ~small
            want = whole[lab] | (want & keep_px[lab])
        out[want, :3] = WARM.get(c, c)
    return out
def to_layer(idx, f, CH):
    fr = rgba(idx)[HIDE:]                                          # rows 0.. = screen rows
    yy, xx = np.mgrid[0:fr.shape[0], 0:CW]; cut = ((xx - (CW - 15)) / 14.0) ** 2 + ((14 - yy) / 14.0) ** 2 > 1; cut &= (xx > CW - 15) & (yy < 14); fr[cut] = 0   # round off the few px that reach the window's right edge at the very top
    lay = np.zeros((200, 360, 4), np.uint8); h = min(fr.shape[0], 200); lay[:h, :CW] = fr[:h]
    return firelight(lay, f, N, CH)[:LH, :LW], lay[:LH, :LW]
def grid(frames):
    g = Image.new('RGBA', (COLS * LW, math.ceil(len(frames) / COLS) * LH), (0, 0, 0, 0))
    for i, fr in enumerate(frames): g.paste(Image.fromarray(fr, 'RGBA'), ((i % COLS) * LW, (i // COLS) * LH))
    return g
def build():
    CH = np.array(Image.open(os.path.join(root, 'final', 'base_025_anim_final_16f.png')).convert('RGBA')).astype(int)
    Lf = [despeck(down(to_idx(a))) for a in strip_frames(os.path.join(root, 'd25', 'smoke_layer_pl_left_41f.png'), 1, LEFT_LAST)]
    Rf = [despeck(down(to_idx(a))) for a in strip_frames(os.path.join(root, 'd25', 'smoke_layer_pl_right_41f.png'), 1, 40)]
    Le = even(Lf, N, 12); Re = even(Rf, N, 6)
    F = [despeck(combine(Le[i], Re[i])) for i in range(N)]
    lit = []; unlit = []
    for i, f in enumerate(F):
        a, b = to_layer(f, i, CH); lit.append(a); unlit.append(b)
    return F, lit, unlit, CH
def checks(F, lit, CH):
    A = np.stack(lit); al = A[..., 3] > 0
    solid = np.zeros((LH, LW), bool); st = np.stack([CH[:, i * 184:(i + 1) * 184] for i in range(16)])
    fire = ((st[..., 3] > 0) & (st[..., 0] > 150) & (st[..., 0] - st[..., 2] > 80) & (st[..., 1] > 40)).any(0)
    solid[:, :184] = ((st[..., 3] > 0).all(0) & ~fire)[:LH]
    key = (A[..., 0].astype(int) << 16) | (A[..., 1].astype(int) << 8) | A[..., 2].astype(int); key[~al] = -1
    def runs(mask, minlen):
        out = []
        for x in range(mask.shape[1]):
            col = mask[:, x]; y = 0
            while y < len(col):
                if col[y]:
                    s = y
                    while y < len(col) and col[y]: y += 1
                    if y - s >= minlen: out.append((x, s, y - 1))
                else: y += 1
        return out
    v = (key[:, :, 1:] != key[:, :, :-1]); h = (key[:, 1:, :] != key[:, :-1, :])
    print('fixed vertical edges (in every frame, 4+ px):', runs(v.all(0) & ~solid[:, 1:] & ~solid[:, :-1], 4), '| in 85%+ of frames (6+ px):', runs((v.mean(0) >= 0.85) & ~solid[:, 1:] & ~solid[:, :-1], 6))
    print('fixed horizontal edges (in every frame, 4+ px):', runs((h.all(0) & ~solid[1:] & ~solid[:-1]).T, 4))
    d = [int((F[(i + 1) % N] != F[i]).sum()) for i in range(N)]
    print('shape change per step: median %d, max %d, at the loop wrap %d (max/median %.2f)' % (np.median(d), max(d), d[-1], max(d) / np.median(d)))
    def sil(idx):
        m = idx > 0; e = np.zeros(m.shape, bool); e[:, 1:] |= m[:, 1:] != m[:, :-1]; e[1:] |= m[1:] != m[:-1]; return e
    for name, cols in (('left  (x 0-126)', slice(0, 126)), ('right (x 166-296)', slice(166, 296))):
        s = []
        for i in range(N):
            ea, eb = sil(F[i][:, cols])[20:110], sil(F[(i + 1) % N][:, cols])[20:110]
            s.append(float(ndi.distance_transform_edt(~eb)[ea].mean()) if ea.any() and eb.any() else 0.0)
        print('outline speed %s: median %.2f px per frame' % (name, np.median(s)))
    print('smoke on the layer right edge: %d frames | on the bottom row right of the church: %d frames | furthest right at y>=20: x=%d | lowest right of the church: y=%d'
          % (int(al[:, :, LW - 9:].any((1, 2)).sum()), int(al[:, -1, 162:].any(1).sum()), int(np.where(al[:, 20:].any((0, 1)))[0].max()), int(np.where(al[:, :, 190:].any((0, 2)))[0].max())))
    print('colours:', len({tuple(c) for c in A[al][:, :3]}), '| alpha levels:', np.unique(A[..., 3]).tolist())
if __name__ == "__main__":
    F, lit, unlit, CH = build()
    grid(lit).save(os.path.join(root, 'final', 'base_025_smoke_layer_final_40f.png'))
    grid(unlit).save(os.path.join(root, 'd25', 'base_025_smoke_layer_unlit_40f.png'))
    print('frames', N, '| frame', LW, 'x', LH, '| grid', grid(lit).size)
    checks(F, lit, CH)
