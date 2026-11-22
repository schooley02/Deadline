"""Taller 25% smoke layer: the approved 304x136 frames stay pixel for pixel; PixelLab's animation of the UPPER part is added above.
Frame = 448 x 306 art px: rows -170..135 (row 0 = the church frame's top), x 0..447."""
import sys, os, math
sys.path.insert(0, '/home/claude/work/ba/scripts'); sys.path.insert(0, '/home/claude/work/p3')
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import smoke25_layer as L
from still_sheet import firelight_ext
W, TOP, LH, N = 448, 170, 136, 40
X0 = (0, 126, 252); ZONES = ((130, 166), (256, 292)); JOIN = 20; SILB = 48; SILC = 12.0
# CORNER FIX (Jeremy 2026-11-22: "one little piece that doesn't seem to move when it starts to show"): the approved frames round off their
# top-right corner with a fixed curve (x > 281, rows 0..13). In the taller layer the plume continues there, so in the corner x >= CX0,
# rows 0..CB-1 the outline is handed over from the new part instead; these are the only approved pixels that change.
CX0, CX1, CB = 250, 282, 18
SKYC = np.array([104, 132, 168])
yy_, xx_ = np.mgrid[-3:4, -3:4]; DISK3 = (yy_ ** 2 + xx_ ** 2) <= 10
def to_idx_sky(a):
    """nearest smoke tone, or 0 where the pixel is nearer to the flat sky colour / transparent / clearly not a smoke colour"""
    rgb = a[..., :3].astype(int); d = ((rgb[..., None, :] - L.PAL[None, None]) ** 2).sum(-1); idx = d.argmin(-1) + 1
    dsky = ((rgb - SKYC) ** 2).sum(-1); idx[(dsky < d.min(-1)) | (a[..., 3] < 128)] = 0
    return idx
def fill_holes(idx, max_px=60):
    """a small sky hole completely inside the smoke takes the tone around it (PixelLab sometimes leaves squiggles of background)"""
    out = idx.copy(); lab, n = ndi.label(out == 0)
    if n == 0: return out
    area = ndi.sum(out == 0, lab, range(1, n + 1)); border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    small = [i + 1 for i in range(n) if area[i] <= max_px and (i + 1) not in border]
    if not small: return out
    hole = np.isin(lab, small); _, (iy, ix) = ndi.distance_transform_edt(hole, return_indices=True); out[hole] = out[iy[hole], ix[hole]]
    return out
def to_idx_rec(a, sky_corner):
    """first-run strips (PixelLab removed the background): transparent connected to sky_corner = sky. Other transparent pixels and
    non-smoke colours: in a window completely full of smoke (sky_corner None) they are the lit plum tone that the background
    removal took out (tone 5); in the other windows they are stray gaps / squiggles and take the nearest smoke pixel's tone."""
    rgb = a[..., :3].astype(int); d = ((rgb[..., None, :] - L.PAL[None, None]) ** 2).sum(-1); idx = d.argmin(-1) + 1
    tr = a[..., 3] < 128; odd = (~tr) & (d.min(-1) > 30 ** 2)
    if sky_corner is None:
        idx[tr | odd] = 5; return idx
    lab, n = ndi.label(tr); sky = (lab == lab[sky_corner]) if tr[sky_corner] else np.zeros(tr.shape, bool)
    bad = (tr & ~sky) | odd
    if bad.any():
        _, (iy, ix) = ndi.distance_transform_edt(bad | sky, return_indices=True); idx[bad] = idx[iy[bad], ix[bad]]
    idx[sky] = 0; return idx
CORNER = {0: (0, 0), 1: None, 2: (255, 255)}
def window_frames(path, first=1, last=40, win=0, rec=True):
    f = (lambda a: to_idx_rec(a, CORNER[win])) if rec else to_idx_sky
    return [L.despeck(fill_holes(L.down(f(a)))) for a in L.strip_frames(path, first, last)]
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
    """up: rows -170..-1 (170 x W). low: the approved build's frame, rows -20..149 (170 x 296). Rows -20..-1 are morphed from up into low."""
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
    # the OUTLINE (smoke / sky) is handed over across a taller band, rows -SILB..-1: above its own top row (-20) the approved
    # animation's outline is carried straight up, so open sky at its top-left corner continues into the new part instead of
    # being roofed over by a tongue of smoke
    As = np.zeros((TOP + 40, W), bool); As[:TOP] = up == 0; As[TOP:] = (up[TOP - 1] == 0)[None]             # true distances: the whole new part, carried straight down below it
    Bs = np.zeros((SILB - JOIN + 80, W), bool); Bs[:SILB - JOIN] = (lowp[0] == 0)[None]; Bs[SILB - JOIN:] = lowp[:80] == 0
    top = -np.interp(np.arange(W), [100, 170], [SILB, JOIN])[None, :]                       # band top: tall at the left (the open-sky corner), 20 rows elsewhere
    bot = np.interp(np.arange(W), [CX0, CX1], [0, CB])[None, :]                             # band bottom: row 0, but CB rows lower at the right corner (see CORNER FIX)
    rows = (np.arange(-SILB, CB) + 0.5)[:, None]
    ts = np.clip((rows - top) / (bot - top), 0, 1)
    sky = (1 - ts) * L.sdf(As)[TOP - SILB:TOP + CB] + ts * L.sdf(Bs)[:SILB + CB] > 0
    band = full[TOP - SILB:TOP + CB]; zone = np.ones(band.shape, bool); zone[SILB:] = (np.arange(W) >= CX0)[None, :]   # below row 0 only the right corner may change
    need = ~sky & (band == 0) & zone
    if need.any():
        _, (iy, ix) = ndi.distance_transform_edt(full == 0, return_indices=True); sub = (iy[TOP - SILB:TOP + CB], ix[TOP - SILB:TOP + CB]); band[need] = full[sub[0][need], sub[1][need]]
    band[sky & zone] = 0
    return full
def build(specs, n_out=80):
    """specs: per window (path, cycle length in PixelLab frames, K, loop length in output frames, 'rec' | 'sky')"""
    F, lit, unlit, CH = L.build()                                                        # the approved layer (F: rows -20..149, x 0..295), 40 frames
    wins = []
    for w, (p, cyc, k, loop, mode) in enumerate(specs):
        fr = L.even(window_frames(p, 1, cyc, w, mode == 'rec'), loop, k); wins.append([fr[i % loop] for i in range(n_out)])
    frames = []; idxs = []
    for i in range(n_out):
        j = i % N
        up = L.despeck(join_h([w[i] for w in wins]))
        full = join_v(up, F[j]); full[:TOP] = L.despeck(full[:TOP + 8])[:TOP]            # despeck the new rows only
        sm = full > 0; thin = sm & ~ndi.binary_opening(sm, structure=DISK3); thin[:TOP - JOIN - 12] = False; thin[TOP:] = False; full[thin] = 0   # no thin wisps where the two animations meet (smoke thinner than 6 px, new rows near the join only)
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
def grid(frames, cols=8):
    g = Image.new('RGBA', (cols * W, math.ceil(len(frames) / cols) * (TOP + LH)), (0, 0, 0, 0))
    for i, fr in enumerate(frames): g.paste(Image.fromarray(fr, 'RGBA'), ((i % cols) * W, (i // cols) * (TOP + LH)))
    return g
def checks(frames, idxs, lit, CH):
    NF = len(frames); A = np.stack(frames); al = A[..., 3] > 0; H = TOP + LH
    chg = [(frames[i][TOP:, :304] != lit[i % N]).any(-1) for i in range(NF)]
    print('approved pixels changed OUTSIDE the corner zone (all frames):', int(sum(c[CB:].sum() + c[:CB, :CX0].sum() for c in chg)), '| inside the corner zone (x >= %d, rows 0-%d): max %d, median %d px per frame' % (CX0, CB - 1, max(int(c.sum()) for c in chg), int(np.median([c.sum() for c in chg]))), '| smoke right of x=303 below row %d: %d' % (CB, int(al[:, TOP + CB:, 304:].sum())))
    st = np.stack([CH[:, i * 184:(i + 1) * 184] for i in range(16)])
    fire = ((st[..., 3] > 0) & (st[..., 0] > 150) & (st[..., 0] - st[..., 2] > 80) & (st[..., 1] > 40)).any(0)
    solid = np.zeros((H, W), bool); solid[TOP:, :184] = ((st[..., 3] > 0).all(0) & ~fire)[:LH]
    key = (A[..., 0].astype(int) << 16) | (A[..., 1].astype(int) << 8) | A[..., 2].astype(int); key[~al] = -1
    def runs(mask, minlen):
        out = []
        for x in range(mask.shape[1]):
            col = mask[:, x]; y = 0
            while y < len(col):
                if col[y]:
                    s = y
                    while y < len(col) and col[y]: y += 1
                    if y - s >= minlen: out.append((x, s - TOP, y - 1 - TOP))
                else: y += 1
        return out
    v = key[:, :, 1:] != key[:, :, :-1]; h = key[:, 1:, :] != key[:, :-1, :]
    print('fixed vertical edges, every frame 4+ px (x, row from, row to):', runs(v.all(0) & ~solid[:, 1:] & ~solid[:, :-1], 4), '| 85%+ of frames, 6+ px:', runs((v.mean(0) >= 0.85) & ~solid[:, 1:] & ~solid[:, :-1], 6))
    hr = runs((h.all(0) & ~solid[1:] & ~solid[:-1]).T, 4); print('fixed horizontal edges, every frame 4+ px (row, x from, x to):', [(r, a + TOP, b + TOP) for r, a, b in hr][:12])
    hr2 = runs(((h.mean(0) >= 0.7) & ~solid[1:] & ~solid[:-1]).T, 8); print('horizontal edges in 70%+ of frames, 8+ px:', [(r, a + TOP, b + TOP) for r, a, b in hr2][:12])
    # lighting step along row -1 / 0: same smoke tone above and below, lit on one side only
    seam = []
    for i in range(NF):
        a, b = idxs[i][TOP - 1, :304], idxs[i][TOP, :304]; la = (frames[i][TOP - 1, :304, :3] != L.rgba(idxs[i][TOP - 1:TOP])[0, :304, :3]).any(-1); lb = (frames[i][TOP, :304, :3] != L.rgba(idxs[i][TOP:TOP + 1])[0, :304, :3]).any(-1)
        seam.append(int(((a == b) & (a > 0) & (la != lb)).sum()))
    print('lighting steps on the join row (px per frame): max', max(seam), 'median', int(np.median(seam)))
    d = [int((idxs[(i + 1) % NF][:TOP] != idxs[i][:TOP]).sum()) for i in range(NF)]
    print('upper part, shape change per step: median %d, max %d, at the loop wrap %d (max/median %.2f)' % (np.median(d), max(d), d[-1], max(d) / np.median(d)))
    def sil(idx):
        m = idx > 0; e = np.zeros(m.shape, bool); e[:, 1:] |= m[:, 1:] != m[:, :-1]; e[1:] |= m[1:] != m[:-1]; return e
    for name, cols in (('upper left (x 0-126)', slice(0, 126)), ('upper middle (x 166-252)', slice(166, 252)), ('upper right (x 292-448)', slice(292, 448))):
        s = []
        for i in range(NF):
            ea, eb = sil(idxs[i][:TOP - JOIN, cols]), sil(idxs[(i + 1) % NF][:TOP - JOIN, cols])
            s.append(float(ndi.distance_transform_edt(~eb)[ea].mean()) if ea.any() and eb.any() else 0.0)
        print('outline speed %s: median %.2f px per frame' % (name, np.median(s)))
    print('smoke on the top row: %d-%d of %d px | on the right edge: %d frames | colours %d | alpha %s' % (int(al[:, 0].sum(1).min()), int(al[:, 0].sum(1).max()), W, int(al[:, :, -1].any(1).sum()), len({tuple(c) for c in A[al][:, :3]}), np.unique(A[..., 3]).tolist()))
if __name__ == "__main__":
    out = sys.argv[1]; n_out = int(sys.argv[2]); specs = []
    for a in sys.argv[3:]:
        p, cyc, k, loop, mode = a.split(','); specs.append((p, int(cyc), int(k), int(loop), mode))
    frames, idxs, lit, CH = build(specs, n_out); grid(frames).save(out); np.save(out[:-4] + '_idx.npy', np.stack(idxs)); print('sheet', grid(frames).size, 'frames', len(frames))
    checks(frames, idxs, lit, CH)
