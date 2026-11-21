"""Firelight for the 25% strips: the still's own recipe (comp25v5.py), driven by the flame pixels of each frame.
light = blurred mask of the frame's actual fire pixels (wide blurs -> it swells and fades smoothly, never pixel by pixel);
surfaces get a warm multiply + a SCREEN blend (never additive), far side falls slightly darker; the far-side fires
(ridge, corner, side wall: behind the building) only rim-light; the doorway's dark depths are held back by a soft mask;
the fallen cross takes less. Fire pixels themselves are never lit (they are the sources)."""
import numpy as np
from PIL import Image, ImageFilter

def isfire(p):
    r, g, b, a = [p[..., i].astype(int) for i in range(4)]; return (a > 0) & (r > 150) & (r - b > 80) & (g > 40)
def blur(m, r): return np.array(Image.fromarray((np.asarray(m, float) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float) / 255

def light_field(fire, far_zone, extra=None):
    """extra: optional float map of weaker light sources that are not flame-coloured (e.g. the red glow inside a hole)"""
    H, W = fire.shape; yy, xx = np.mgrid[0:H, 0:W]
    farfire = fire & far_zone; front = (fire & ~far_zone).astype(float)
    if extra is not None: front = np.clip(front + extra, 0, 1)
    L = blur(front, 30) * 5 + blur(front, 12) * 2 + blur(front, 4) * .8
    L += blur(farfire, 3) * 1.2 + blur(farfire, 7) * 0.5
    doorfire = (fire & ~far_zone) & (xx >= 117) & (xx <= 146) & (yy >= 100) & (yy <= 182)
    L += blur(doorfire, 20) * 2.2 + blur(doorfire, 7) * 1.0
    return L

def apply(img, L, fire, hold, cross, gain=1.0, sources=None, weight=None):
    """img RGBA uint8 (unlit frame), L light field (unclipped), hold = soft 0..1 mask keeping light off (doorway depths)"""
    out = img.astype(float); rgb = out[..., :3] / 255
    Lc = np.clip(L * gain, 0, 1)
    src = fire if sources is None else (fire | sources)
    k = Lc * (~src) * (1 - 0.75 * hold) * np.where(cross, 0.45, 1.0)
    if weight is not None: k = k * weight                    # places that take only part of the light
    k = k[..., None]
    warm = np.array([1.25, 1.0, .78]); rgb = np.clip(rgb * (1 + (warm - 1) * k), 0, 1)
    c = np.array([255, 128, 50.]) / 255; rgb = 1 - (1 - rgb) * (1 - c * k * 0.6)
    dark = (0.78 + 0.22 * np.clip(Lc * 3, 0, 1))[..., None]
    rgb = np.where(src[..., None], rgb, rgb * dark)
    out[..., :3] = rgb * 255
    res = out.clip(0, 255).astype(np.uint8); res[img[..., 3] == 0] = img[img[..., 3] == 0]
    return res
