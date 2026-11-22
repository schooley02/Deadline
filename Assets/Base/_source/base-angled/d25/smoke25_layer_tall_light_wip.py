import sys, os, math
sys.path.insert(0, '/home/claude/work/ba/scripts')
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import smoke25_layer as L
UP = 214; TOPROWS = 170
def firelight_ext(layer, f, nloop, CH, up, reach=24.0):
    """smoke25_layer.firelight on a taller / wider picture: same formula, church frame at row `up`"""
    H, W = layer.shape[:2]; fr = CH[:, (f % 16) * 184:(f % 16) * 184 + 184]
    fm = np.zeros((H, W), bool); hh = min(200, H - up)
    fm[up:up + hh, :184] = ((fr[..., 3] > 0) & (fr[..., 0] > 150) & (fr[..., 0] - fr[..., 2] > 80) & (fr[..., 1] > 40))[:hh]; fm[up + 100:, :] = False
    d = ndi.distance_transform_edt(~fm)
    yy, xx = np.mgrid[0:H, 0:W]; yy = yy - up; t = 2 * math.pi * f / nloop
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
def sheet(src, out):
    a = np.array(Image.open(src).convert('RGBA')); idx = L.despeck(L.to_idx(a)); im = L.rgba(idx)            # 384 x 448, rows -214..169
    CH = np.array(Image.open('/mnt/user-data/uploads/Deadline/Assets/Base/_source/base-angled/final/base_025_anim_final_16f.png').convert('RGBA')).astype(int)
    full = firelight_ext(im, 0, 40, CH, UP)
    crop = full[UP - TOPROWS:UP + 136]                                                                        # rows -170..135
    Image.fromarray(crop, 'RGBA').save(out); return crop.shape
if __name__ == "__main__": print(sheet(sys.argv[1], sys.argv[2]))
