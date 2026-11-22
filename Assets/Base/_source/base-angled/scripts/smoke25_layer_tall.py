"""25% smoke LAYER behind the church, TALLER version. APPROVED by Jeremy 2026-11-22 ("i'm good with this").
This is the sheet to WIRE. It replaces final/base_025_smoke_layer_final_40f.png in the game (that file stays: it is the
approved lower part and this script rebuilds it on the way).

WHY  The game canvas is not always the church's height (400 px): it is 447-473 px at 1440x900 / 1536x864 / 2560x1440,
     526 px at 2560x1600, 711 px on a 4K screen at full size. Fixed to the church, the 304x136 layer ended there in a
     straight cut with sky above it. Jeremy chose to extend the plume UPWARD (layer still fixed to the church).

OUT  final/base_025_smoke_layer_tall_final_80f.png   80 frames in a GRID, 8 across x 10 down, each 448 x 306 art px,
                                                     8 fps (10 s loop). Frame rows = -170..135, where row 0 is the church
                                                     frame's top row; x 0 = the church frame's left edge. In the game: 896 x 612
                                                     px at 2x, left edge on the church's left edge, top edge 340 px ABOVE the
                                                     church frame's top. Covers canvases up to 738 px tall; on a taller one
                                                     (1440x2560 portrait = 843 px) lift the layer by the difference.
Only fully solid or fully empty pixels; 10 flat colours.

WHAT IS IN IT
  rows 0..135, x 0..303   the approved 304x136 layer, pixel for pixel (its 40 frames play twice), EXCEPT its top-right corner
                          (x >= 250, rows 0..17): there the approved frames rounded the smoke off with a fixed curve, which
                          showed as a piece that did not move (Jeremy: "one little piece that doesn't seem to move when it
                          starts to show, can you clean that area up?"); the outline there now follows the part above.
  rows -170..-1           new: PixelLab continued the placed Draft 2 drawing upward (inpaint-v3) and animated that drawing
                          (animate-pixminimax) in three windows of 170 x 170 art px, rows -170..0: u1 = x 0..170,
                          u2 = x 126..296, u3 = x 252..422 (d25/smoke_layer_tall_pl_u1/u2/u3_41f.png; 41 frames of 256x256,
                          frame 0 = the input). The calls are recorded in smoke25_layer_tall_pl.py.
  The plume is a band rising to the right with OPEN SKY on its upper left: the approved animation shows open sky at its
  top-left corner in 26 of its 40 frames, so the part above has to as well.

WHAT THIS SCRIPT DOES (code only moves / selects PixelLab's pixels, it never shades)
  - the three windows are brought to the art's pixel grid and cleaned exactly like the approved ones (smoke25_layer.py).
    PixelLab removed the background: in u2, which is completely full of smoke, that also took out the lit plum tone, which
    is put back; in u1 and u3 stray transparent gaps / squiggles inside the smoke take the nearest smoke pixel's tone
  - speed: the windows moved about twice as fast as the approved part, so u1's 40-frame cycle is played over 80 frames and
    u2's and u3's 20-frame cycles over 40 (twice). Resampled at equal amounts of change, like the approved windows
  - the windows are morphed into each other across their overlaps (x 130..166 and 256..292)
  - hand-over to the approved animation: tones across rows -20..-1 (the approved windows' own rows above the screen); the
    smoke OUTLINE across a band that is 48 rows tall at the left corner (so the open sky there continues upward) and reaches
    down to row 17 at the right corner. Both use outline distances, so the hand-over follows the smoke's shapes: a row-by-row
    cross-over gave straight horizontal edges
  - smoke thinner than 6 px near the hand-over is removed (no thin wisps)
  - firelight on the new rows: the approved formula (smoke25_layer.firelight) on the taller picture
Checks printed at the end: approved pixels outside the corner, edges that sit in the same place, loop wrap, speeds.

Usage (from scripts/):  python3 smoke25_layer_tall.py
"""
import math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here); sys.path.insert(0, here)
import smoke25_layer as L

W, TOP, LH, N, NF, COLS = 448, 170, 136, 40, 80, 8      # frame width; new rows above row 0; approved rows; approved frames; frames; grid columns
ZONES = ((130, 166), (256, 292)); JOIN = 20; SILB = 48   # window overlaps; tone hand-over rows; outline band height at the left corner
CX0, CX1, CB = 250, 282, 18                              # right corner: the outline band reaches down to row CB-1 for x >= CX1 (ramps in from CX0)
yy_, xx_ = np.mgrid[-3:4, -3:4]; DISK3 = (yy_ ** 2 + xx_ ** 2) <= 10
# per window: file, PixelLab frames in one cycle, in-betweens per step, output frames per cycle, the corner that is open sky (None = full of smoke)
WINDOWS = (('smoke_layer_tall_pl_u1_41f.png', 40, 6, 80, (0, 0)), ('smoke_layer_tall_pl_u2_41f.png', 20, 12, 40, None), ('smoke_layer_tall_pl_u3_41f.png', 20, 12, 40, (255, 255)))

def firelight_ext(layer, f, nloop, CH, up, reach=24.0):
    """smoke25_layer.firelight on a taller / wider picture: same formula, the church frame's top at row `up`"""
    H, Wd = layer.shape[:2]; fr = CH[:, (f % 16) * 184:(f % 16) * 184 + 184]
    fm = np.zeros((H, Wd), bool); hh = min(200, H - up)
    fm[up:up + hh, :184] = ((fr[..., 3] > 0) & (fr[..., 0] > 150) & (fr[..., 0] - fr[..., 2] > 80) & (fr[..., 1] > 40))[:hh]; fm[up + 100:, :] = False
    d = ndi.distance_transform_edt(~fm)
    yy, xx = np.mgrid[0:H, 0:Wd]; yy = yy - up; t = 2 * math.pi * f / nloop
    wave = 0.5 + 0.22 * np.sin(2 * math.pi * (xx * 0.8 - yy * 0.6) / 46.0 - 2 * t) + 0.18 * np.sin(2 * math.pi * (xx * 0.3 + yy) / 31.0 + t + 1.7) + 0.10 * np.sin(2 * math.pi * xx / 17.0 - 3 * t + 0.6)
    al = layer[..., 3] > 0; out = layer.copy()
    for c in {tuple(int(v) for v in c) for c in layer[al][:, :3]}:
        m = al & (layer[..., :3] == c).all(-1)
        want = m & (d < reach * L.REACH.get(c, 1.0) * (0.55 + 0.9 * wave))
        lab, n = ndi.label(m)
        if n:
            area = ndi.sum(m, lab, range(1, n + 1)); frac = ndi.sum(want, lab, range(1, n + 1)) / np.maximum(area, 1)
            small = area <= 420; whole = np.zeros(n + 1, bool); whole[1:] = small & (frac >= 0.5)
            keep_px = np.zeros(n + 1, bool); keep_px[1:] = ~small
            want = whole[lab] | (want & keep_px[lab])
        out[want, :3] = L.WARM.get(c, c)
    return out
def to_idx_rec(a, sky_corner):
    """transparent connected to sky_corner = sky. Other transparent pixels and non-smoke colours: in a window completely full
    of smoke (sky_corner None) they are the lit plum tone that the background removal took out (tone 5); in the other windows
    they are stray gaps / squiggles and take the nearest smoke pixel's tone."""
    rgb = a[..., :3].astype(int); d = ((rgb[..., None, :] - L.PAL[None, None]) ** 2).sum(-1); idx = d.argmin(-1) + 1
    tr = a[..., 3] < 128; odd = (~tr) & (d.min(-1) > 30 ** 2)
    if sky_corner is None:
        idx[tr | odd] = 5; return idx
    lab, n = ndi.label(tr); sky = (lab == lab[sky_corner]) if tr[sky_corner] else np.zeros(tr.shape, bool)
    bad = (tr & ~sky) | odd
    if bad.any():
        _, (iy, ix) = ndi.distance_transform_edt(bad | sky, return_indices=True); idx[bad] = idx[iy[bad], ix[bad]]
    idx[sky] = 0; return idx
def fill_holes(idx, max_px=60):
    """a small sky hole completely inside the smoke takes the tone around it"""
    out = idx.copy(); lab, n = ndi.label(out == 0)
    if n == 0: return out
    area = ndi.sum(out == 0, lab, range(1, n + 1)); border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    small = [i + 1 for i in range(n) if area[i] <= max_px and (i + 1) not in border]
    if not small: return out
    hole = np.isin(lab, small); _, (iy, ix) = ndi.distance_transform_edt(hole, return_indices=True); out[hole] = out[iy[hole], ix[hole]]
    return out
def window_frames(path, last, corner):
    return [L.despeck(fill_holes(L.down(to_idx_rec(a, corner)))) for a in L.strip_frames(path, 1, last)]
def join_h(wins):
    out = np.zeros((170, W), int)
    out[:, 0:170] = wins[0]; out[:, ZONES[0][1]:296] = wins[1][:, ZONES[0][1] - 126:]; out[:, ZONES[1][1]:422] = wins[2][:, ZONES[1][1] - 252:]
    for (z0, z1), a, b, xa, xb in ((ZONES[0], wins[0], wins[1], 0, 126), (ZONES[1], wins[1], wins[2], 126, 252)):
        lo, hi = xb, xa + 170                                        # the columns both windows have
        t = np.clip((np.arange(lo, hi) - z0 + 0.5) / (z1 - z0), 0, 1)[None, :]
        out[:, z0:z1] = L.morph(a[:, lo - xa:hi - xa], b[:, 0:hi - lo], t)[:, z0 - lo:z1 - lo]
    return out
def morph_c(A, B, t, cneg=5.0):
    """L.morph, but a tone that is far away (or missing) on one side counts as only cneg px away there: the hand-over then
    happens in the middle of the band and follows the shapes, instead of flipping along one straight row at the band's end"""
    best = None; score = None
    for c in range(7):
        ma, mb = A == c, B == c
        if not ma.any() and not mb.any(): continue
        s = (1 - t) * np.maximum(L.sdf(ma), -cneg) + t * np.maximum(L.sdf(mb), -cneg)
        if score is None: score = s; best = np.full(A.shape, c)
        else:
            upd = s > score; score[upd] = s[upd]; best[upd] = c
    return best
def join_v(up, low):
    """up: the new part, rows -170..-1 (170 x W). low: the approved build's frame, rows -20..149 (170 x 296)."""
    full = np.zeros((TOP + 150, W), int); full[:TOP] = up
    lowp = np.zeros((170, W), int); lowp[:, :296] = low
    full[TOP:] = lowp[JOIN:]
    t = ((np.arange(JOIN) + 0.5) / JOIN)[:, None]
    ctx = 12                                                                             # rows of context on each side so the outlines are measured properly
    A = np.zeros((JOIN + 2 * ctx, W), int); B = np.zeros_like(A)
    A[:ctx + JOIN] = up[TOP - JOIN - ctx:TOP]; A[ctx + JOIN:] = up[TOP - 1][None]        # up has nothing below row -1: repeat its last row
    B[ctx:] = lowp[:JOIN + ctx]; B[:ctx] = lowp[0][None]                                 # low has nothing above row -20: repeat its first row
    tt = np.concatenate([np.zeros(ctx), t[:, 0], np.ones(ctx)])[:, None]
    full[TOP - JOIN:TOP] = morph_c(A, B, tt)[ctx:ctx + JOIN]
    # the OUTLINE (smoke / sky): above its own top row (-20) the approved animation's outline is carried straight up, below
    # its last row the new part's outline is carried straight down, and the two are blended by true outline distances
    As = np.zeros((TOP + 40, W), bool); As[:TOP] = up == 0; As[TOP:] = (up[TOP - 1] == 0)[None]
    Bs = np.zeros((SILB - JOIN + 80, W), bool); Bs[:SILB - JOIN] = (lowp[0] == 0)[None]; Bs[SILB - JOIN:] = lowp[:80] == 0
    top = -np.interp(np.arange(W), [100, 170], [SILB, JOIN])[None, :]                    # band top: tall at the left (the open-sky corner), 20 rows elsewhere
    bot = np.interp(np.arange(W), [CX0, CX1], [0, CB])[None, :]                          # band bottom: row 0, CB rows lower at the right corner
    rows = (np.arange(-SILB, CB) + 0.5)[:, None]
    ts = np.clip((rows - top) / (bot - top), 0, 1)
    sky = (1 - ts) * L.sdf(As)[TOP - SILB:TOP + CB] + ts * L.sdf(Bs)[:SILB + CB] > 0
    band = full[TOP - SILB:TOP + CB]; zone = np.ones(band.shape, bool); zone[SILB:] = (np.arange(W) >= CX0)[None, :]   # below row 0 only the right corner may change
    need = ~sky & (band == 0) & zone
    if need.any():
        _, (iy, ix) = ndi.distance_transform_edt(full == 0, return_indices=True); sub = (iy[TOP - SILB:TOP + CB], ix[TOP - SILB:TOP + CB]); band[need] = full[sub[0][need], sub[1][need]]
    band[sky & zone] = 0
    return full
def build():
    F, lit, unlit, CH = L.build()                                                        # the approved layer (F: rows -20..149, x 0..295), 40 frames
    wins = []
    for name, cyc, k, loop, corner in WINDOWS:
        fr = L.even(window_frames(os.path.join(root, 'd25', name), cyc, corner), loop, k); wins.append([fr[i % loop] for i in range(NF)])
    frames = []; idxs = []
    for i in range(NF):
        j = i % N
        up = L.despeck(join_h([w[i] for w in wins]))
        full = join_v(up, F[j]); full[:TOP] = L.despeck(full[:TOP + 8])[:TOP]            # despeck the new rows only
        sm = full > 0; thin = sm & ~ndi.binary_opening(sm, structure=DISK3); thin[:TOP - JOIN - 12] = False; thin[TOP:] = False; full[thin] = 0   # no thin wisps where the two animations meet
        new = L.rgba(full)[:TOP + LH]; im = new.copy()
        im[TOP:, :304] = unlit[j]; im[TOP:, 304:] = 0                                    # the approved rows, unlit ...
        cz = np.zeros((TOP + LH, W), bool); cz[TOP:TOP + CB, CX0:] = True                # ... except the corner zone
        diff = cz & (im != new).any(-1); im[cz] = new[cz]
        litfull = firelight_ext(im, j, N, CH, TOP)
        out = litfull.copy(); keep = np.ones((LH, 304), bool); keep[:CB, CX0:] = ~diff[TOP:TOP + CB, CX0:304]   # approved pixels exactly as approved wherever the smoke tone did not change
        out[TOP:, :304][keep] = lit[j][keep]
        out[TOP + CB:, 304:] = 0; full[TOP + CB:, 304:] = 0; full[TOP + LH:] = 0
        frames.append(out); idxs.append(full)
    return frames, idxs, lit, CH
def grid(frames):
    g = Image.new('RGBA', (COLS * W, math.ceil(len(frames) / COLS) * (TOP + LH)), (0, 0, 0, 0))
    for i, fr in enumerate(frames): g.paste(Image.fromarray(fr, 'RGBA'), ((i % COLS) * W, (i // COLS) * (TOP + LH)))
    return g
def checks(frames, idxs, lit, CH):
    A = np.stack(frames); al = A[..., 3] > 0; H = TOP + LH
    chg = [(frames[i][TOP:, :304] != lit[i % N]).any(-1) for i in range(NF)]
    print('approved pixels changed OUTSIDE the corner zone (all frames):', int(sum(c[CB:].sum() + c[:CB, :CX0].sum() for c in chg)),
          '| inside it (x >= %d, rows 0-%d): max %d, median %d px per frame' % (CX0, CB - 1, max(int(c.sum()) for c in chg), int(np.median([c.sum() for c in chg]))),
          '| smoke right of x=303 below row %d: %d' % (CB, int(al[:, TOP + CB:, 304:].sum())))
    st = np.stack([CH[:, i * 184:(i + 1) * 184] for i in range(16)])
    fire = ((st[..., 3] > 0) & (st[..., 0] > 150) & (st[..., 0] - st[..., 2] > 80) & (st[..., 1] > 40)).any(0)
    solid = np.zeros((H, W), bool); solid[TOP:, :184] = ((st[..., 3] > 0).all(0) & ~fire)[:LH]
    key = (A[..., 0].astype(int) << 16) | (A[..., 1].astype(int) << 8) | A[..., 2].astype(int); key[~al] = -1
    v = (key[:, :, 1:] != key[:, :, :-1]).mean(0); h = (key[:, 1:, :] != key[:, :-1, :]).mean(0)
    p = np.zeros((H, W)); p[:, 1:] = np.maximum(p[:, 1:], np.where(solid[:, 1:] | solid[:, :-1], 0, v)); p[1:] = np.maximum(p[1:], np.where(solid[1:] | solid[:-1], 0, h))
    print('edge pixels that sit in the same place in every frame: %d | in 85%%+ of frames: %d | in 60%%+: %d' % (int((p >= 0.999).sum()), int((p >= 0.85).sum()), int((p >= 0.6).sum())))
    d = [int((idxs[(i + 1) % NF][:TOP] != idxs[i][:TOP]).sum()) for i in range(NF)]
    print('new part, shape change per step: median %d, max %d, at the loop wrap %d (max/median %.2f)' % (np.median(d), max(d), d[-1], max(d) / np.median(d)))
    def sil(idx):
        m = idx > 0; e = np.zeros(m.shape, bool); e[:, 1:] |= m[:, 1:] != m[:, :-1]; e[1:] |= m[1:] != m[:-1]; return e
    for name, cols in (('upper left (x 0-126)', slice(0, 126)), ('upper right (x 292-448)', slice(292, 448))):
        s = []
        for i in range(NF):
            ea, eb = sil(idxs[i][:TOP - JOIN, cols]), sil(idxs[(i + 1) % NF][:TOP - JOIN, cols])
            s.append(float(ndi.distance_transform_edt(~eb)[ea].mean()) if ea.any() and eb.any() else 0.0)
        print('outline speed %s: median %.2f px per frame' % (name, np.median(s)))
    print('smoke on the top row: %d-%d of %d px | on the right edge: %d frames | colours %d | alpha %s'
          % (int(al[:, 0].sum(1).min()), int(al[:, 0].sum(1).max()), W, int(al[:, :, -1].any(1).sum()), len({tuple(c) for c in A[al][:, :3]}), np.unique(A[..., 3]).tolist()))
if __name__ == "__main__":
    frames, idxs, lit, CH = build()
    out = os.path.join(root, 'final', 'base_025_smoke_layer_tall_final_80f.png'); grid(frames).save(out)
    print('frames', NF, '| frame', W, 'x', TOP + LH, '| grid', grid(frames).size)
    checks(frames, idxs, lit, CH)
