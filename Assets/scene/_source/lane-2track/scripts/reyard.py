"""Churchyard dirt, calmed to match the reworked lane (2026-11-22): the per-pixel speckle becomes flat tones in soft patches, the
scuff / footprint marks of the PixelLab dirt are kept as flat dark marks, plus a few separate small stones. Shape (alpha) unchanged.
usage: python3 reyard.py <dry_in 560x72> <storm_in 560x72> <outdir> [seed]"""
import sys, random
import numpy as np
from PIL import Image
from scipy import ndimage
dry_p, storm_p, out = sys.argv[1], sys.argv[2], sys.argv[3]
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
dry = np.array(Image.open(dry_p).convert('RGBA')).astype(float)
storm = np.array(Image.open(storm_p).convert('RGBA')).astype(float)
H, W = dry.shape[:2]
op = dry[..., 3] > 0
def lum(a): return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
def noise(cw, ch, seed):
    g = np.random.RandomState(seed).rand(H // ch + 2, W // cw + 2)
    return ndimage.zoom(g, (ch, cw), order=3)[:H, :W]
L = lum(dry); w = op.astype(float)
Lb = ndimage.gaussian_filter(L * w, (2.5, 7)) / np.maximum(ndimage.gaussian_filter(w, (2.5, 7)), 1e-6)
v = (Lb - np.median(Lb[op])) / 5.0 + (noise(26, 7, SEED + 1) * 0.6 + noise(12, 4, SEED + 2) * 0.4 - 0.5) * 2.4
BASE, LIGHT, DARK, MARK, STONE, SHADE = (54, 54, 50), (59, 58, 54), (48, 48, 45), (36, 37, 34), (84, 82, 78), (33, 34, 32)
col = np.zeros((H, W, 3), int); col[:] = BASE
col[v > 0.55] = LIGHT
col[v < -0.55] = DARK
# scuffs / footprints: connected darker strokes of the original (not single specks). Rows 56+ of the source are a mirrored
# extension (it shows as a symmetric row pattern), so that band gets marks copied from higher up instead.
Lb2 = ndimage.gaussian_filter(L * w, (1.5, 3)) / np.maximum(ndimage.gaussian_filter(w, (1.5, 3)), 1e-6)
dark = (L < Lb2 - 8) & op
lab, n = ndimage.label(dark, structure=np.ones((3, 3)))
sizes = ndimage.sum(dark, lab, range(1, n + 1))
marks = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if 6 <= s <= 70])
marks[56:] = False
low = np.roll(marks[22:38], 173, axis=1)
marks[56:72] |= low[:16]
marks &= op
col[marks] = MARK
r = random.Random(SEED + 3)
for gy in range(11, H - 1, 6):
    for gx in range(0, W - 1, 10):
        x = min(W - 2, gx + r.randint(0, 9) + ((gy // 6) % 2) * 5); y = gy + r.randint(0, 5)
        if y >= H - 1 or r.random() > 0.55: continue
        if not (op[y, x] and op[y + 1, x] and op[y, x + 1] and not marks[y, x]): continue
        if r.random() < 0.7: col[y, x] = STONE; col[y + 1, x] = SHADE
        else: col[y, x] = col[y, x + 1] = (72, 70, 67); col[y + 1, x] = col[y + 1, x + 1] = SHADE
d2 = dry.copy().astype(int); d2[op, :3] = col[op]
# storm: wet tone (median ratio), puddles kept
ratio = [float(np.median(storm[..., c][op] / np.maximum(dry[..., c][op], 1))) for c in range(3)]
resid = np.abs(storm[..., :3] - dry[..., :3] * np.array(ratio)).sum(-1)
pud = ndimage.binary_opening((resid > 25) & op, iterations=1)
lab, n = ndimage.label(pud)
for i, s in enumerate(ndimage.sum(pud, lab, range(1, n + 1)), 1):
    if s < 25: pud[lab == i] = False
pud = ndimage.binary_dilation(pud, iterations=2) & op
s2 = storm.copy().astype(int); s2[op, :3] = np.clip(np.round(col[op] * np.array(ratio)), 0, 255).astype(int); s2[pud] = storm[pud].astype(int)
def halve(a):
    b = a.reshape(H // 2, 2, W // 2, 2, 4).transpose(0, 2, 1, 3, 4).reshape(H // 2, W // 2, 4, 4)
    o = b[..., 3] > 127; n = o.sum(-1)
    mean = (b[..., :3] * o[..., None]).sum(2) / np.maximum(n, 1)[..., None]
    d = ((b[..., :3] - mean[:, :, None, :]) ** 2).sum(-1) + (~o) * 1e9
    pick = np.take_along_axis(b, d.argmin(-1)[..., None, None], 2)[:, :, 0, :]
    pick[..., 3] = np.where(n >= 2, 255, 0); pick[n < 2, :3] = 0
    return pick
for name, a in (('base_yard_560x72', d2), ('storm_base_yard_560x72', s2)):
    Image.fromarray(a.astype('uint8'), 'RGBA').save(f'{out}/{name}.png')
    Image.fromarray(halve(a).astype('uint8'), 'RGBA').save(f"{out}/{name.replace('560x72', 'strip_280x36')}.png")
print('marks px', int(marks.sum()), 'storm ratio', [round(x, 2) for x in ratio], 'puddle px', int(pud.sum()),
      'mean lum old %.1f new %.1f' % (L[op].mean(), lum(d2.astype(float))[op].mean()))
