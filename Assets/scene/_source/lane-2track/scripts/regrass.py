"""Lane grass rework (2026-11-22): replace the per-pixel speckled grass in the two-track lane strip with the style used elsewhere
(church statue, building bushes, village field): flat tones in soft clumps plus distinct blade tufts. Gravel is kept.
usage: python3 regrass.py <dry_in> <storm_in> <outdir> [seed]"""
import sys, random, math
import numpy as np
from PIL import Image
from scipy import ndimage
dry_p, storm_p, out = sys.argv[1], sys.argv[2], sys.argv[3]
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
rnd = random.Random(SEED)
W, H = 1280, 72
dry = np.array(Image.open(dry_p).convert('RGBA')).astype(int)
storm = np.array(Image.open(storm_p).convert('RGBA')).astype(int)
# palette (from the strip's own greens, so the tone Jeremy approved stays)
D0, D1, M, L, T = (12, 26, 24), (21, 38, 34), (30, 50, 42), (41, 61, 53), (51, 73, 62)

def grassness(a):
    return ((a[..., 1] - a[..., 0]) >= 9) & (a[..., 3] > 0)
g0 = grassness(dry).astype(float)
# rows 0..8: partly transparent sky cut; treat the whole verge as grass from its smoothed top line
blur = ndimage.gaussian_filter(g0, sigma=(1.3, 3.0), mode=('nearest', 'wrap'))
G = blur > 0.5
G[:9, :] = False
# drop tiny islands / fill tiny holes
lab, n = ndimage.label(G)
for i, s in enumerate(ndimage.sum(G, lab, range(1, n + 1)), 1):
    if s < 40: G[lab == i] = False
lab, n = ndimage.label(~G & (np.arange(H)[:, None] >= 9))
for i, s in enumerate(ndimage.sum(~G, lab, range(1, n + 1)), 1):
    if s < 40: G[lab == i] = True
# top verge: grass from a gently wavy line (y 5..7) down to where the first gravel track starts
top = np.array([6 + round(0.9 * math.sin(2 * math.pi * x / 160.0 + 1.0) + 0.6 * math.sin(2 * math.pi * x / 64.0)) for x in range(W)])
for x in range(W):
    G[top[x]:9, x] = True   # the verge above the first track is always grass

def vnoise(cw, ch, seed):
    r = np.random.RandomState(seed)
    gw, gh = W // cw, H // ch + 2
    g = r.rand(gh, gw)
    ys = np.arange(H) / ch; xs = np.arange(W) / cw
    y0 = ys.astype(int); x0 = xs.astype(int) % gw; x1 = (x0 + 1) % gw
    fy = (ys - y0)[:, None]; fx = (xs - xs.astype(int))[None, :]
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy

def paint(base):
    """returns the repainted strip (RGBA int) for one variant; base supplies the gravel"""
    a = base.copy()
    # 1. gravel side: grass-coloured specks become the nearest gravel colour in the row
    gr = grassness(base)
    stray = gr & ~G & (np.arange(H)[:, None] >= 9)
    ys, xs = np.nonzero(stray)
    for y, x in zip(ys, xs):
        for d in range(1, 12):
            for xx in ((x - d) % W, (x + d) % W):
                if not gr[y, xx] and not G[y, xx] and base[y, xx, 3] > 0:
                    a[y, x, :3] = base[y, xx, :3]; break
            else: continue
            break
    # 2. grass: flat mid tone, darker flat clumps, a shadow line along each lower edge
    n1 = vnoise(16, 6, SEED + 1) * 0.7 + vnoise(8, 4, SEED + 2) * 0.3
    n2 = vnoise(20, 5, SEED + 3)
    col = np.zeros((H, W, 3), int); col[:] = M
    col[n1 < 0.40] = D1
    col[n2 > 0.68] = L
    below_gravel = np.roll(~G, -1, axis=0); below_gravel[-1] = False          # grass pixel whose lower neighbour is gravel
    two_below = np.roll(~G, -2, axis=0); two_below[-2:] = False
    col[below_gravel & G] = D0
    col[two_below & G & (vnoise(10, 3, SEED + 4) > 0.35)] = D1
    a[G, :3] = col[G]; a[G, 3] = 255
    a[:9][~G[:9]] = 0
    return a

def tufts(G):
    """blade tufts: (x, foot_y, [(dx, height, lean)], on_edge, clump_w)"""
    out = []
    def blades(n, lo, hi):
        b = []; d = 0
        for _ in range(n):
            b.append((d, rnd.randint(lo, hi), rnd.choice((-1, 0, 0, 0, 1)))); d += rnd.choice((1, 2, 2, 3))
        return b
    # along every top edge of a grass area: an irregular fringe (groups, single blades, gaps), standing up over the gravel or the sky
    edge = G & ~np.roll(G, 1, axis=0); edge[0] = False
    for y in range(H):
        xs = np.nonzero(edge[y])[0]
        nxt = -1
        for x in xs:
            if x < nxt: continue
            r = rnd.random()
            if r < 0.50: out.append((x, y + 1, blades(rnd.randint(3, 5), 3, 6), True, 0)); nxt = x + rnd.randint(8, 15)
            elif r < 0.80: out.append((x, y + 1, blades(rnd.randint(1, 2), 2, 4), True, 0)); nxt = x + rnd.randint(4, 9)
            else: nxt = x + rnd.randint(10, 22)
    # inside the grass: clear separate tufts (dark clump at the foot, lighter blades, pale tips), on a jittered grid so they never turn into noise
    for gy in range(12, H, 6):
        for gx in range(0, W, 13):
            x = (gx + rnd.randint(0, 8) + ((gy // 6) % 2) * 6) % W; y = gy + rnd.randint(0, 4)
            if y >= H - 1 or rnd.random() < 0.28: continue
            if not (G[y, x] and G[y - 4, x] and G[y, (x + 6) % W] and G[min(y + 1, H - 1), x]): continue
            b = blades(rnd.randint(3, 5), 3, 6)
            out.append((x, y, b, False, max(d for d, _, _ in b) + 2))
    return out
TUFTS = tufts(G)

def draw_tufts(a, tone):
    """tone: maps an RGB tuple to this variant's tone"""
    for x, y, blades, on_edge, cw in sorted(TUFTS, key=lambda t: t[1]):
        if not on_edge:                                      # dark clump the blades grow out of
            for d in range(-1, cw):
                for yy, c in ((y, D0), (y - 1, D1)):
                    xx = (x + d) % W
                    if (yy == y or 0 <= d < cw - 1) and G[yy, xx]: a[yy, xx, :3] = tone(c)
        for d, h, lean in blades:
            for k in range(1, h + 1):
                yy = y - k
                if yy < 0: break
                xx = (x + d + (lean if k > (h + 1) // 2 else 0)) % W
                c = T if k >= h - (1 if h >= 5 else 0) else L
                if on_edge and k == 1: c = M
                a[yy, xx, :3] = tone(c); a[yy, xx, 3] = 255
    return a

# storm tone for the grass: least-squares gain per channel on pixels that are grass in both and not puddle
both = grassness(dry) & grassness(storm) & (np.abs(dry[..., :3] - storm[..., :3]).sum(-1) < 60)
gain = [float((storm[..., c][both] * dry[..., c][both]).sum()) / float((dry[..., c][both] ** 2).sum()) for c in range(3)]
puddle = ndimage.binary_dilation((np.abs(dry[..., :3] - storm[..., :3]).sum(-1) > 90) & ~grassness(dry), iterations=1)
puddle = ndimage.binary_opening(puddle, iterations=1)
def storm_tone(c): return tuple(int(round(min(255, c[i] * gain[i]))) for i in range(3))

d2 = draw_tufts(paint(dry), lambda c: c)
s_base = paint(storm)
gm = G.copy()
s_base[gm, :3] = np.clip(np.round(paint(dry)[gm, :3] * np.array(gain)), 0, 255).astype(int)
s2 = draw_tufts(s_base, storm_tone)
keep = puddle & (storm[..., 3] > 0)                          # never paint over a puddle
s2[keep] = storm[keep]

def halve(a):
    b = a.reshape(H // 2, 2, W // 2, 2, 4).transpose(0, 2, 1, 3, 4).reshape(H // 2, W // 2, 4, 4)
    op = b[..., 3] > 127; n = op.sum(-1)
    mean = (b[..., :3] * op[..., None]).sum(2) / np.maximum(n, 1)[..., None]
    d = ((b[..., :3] - mean[:, :, None, :]) ** 2).sum(-1) + (~op) * 1e9
    idx = d.argmin(-1); pick = np.take_along_axis(b, idx[..., None, None], 2)[:, :, 0, :]
    pick[..., 3] = np.where(n >= 2, 255, 0); pick[n < 2, :3] = 0
    return pick
for name, a in (('lane_two_track_1280x72', d2), ('storm_lane_two_track_1280x72', s2)):
    Image.fromarray(a.astype('uint8'), 'RGBA').save(f'{out}/{name}.png')
    Image.fromarray(halve(a).astype('uint8'), 'RGBA').save(f"{out}/{name.replace('1280x72', 'strip_640x36')}.png")
Image.fromarray((G*255).astype('uint8')).save(f'{out}/grass_mask.png')
print('grass share %.2f' % G.mean(), 'tufts', len(TUFTS), 'storm gain', [round(g, 2) for g in gain], 'puddle px kept', int(keep.sum()))
