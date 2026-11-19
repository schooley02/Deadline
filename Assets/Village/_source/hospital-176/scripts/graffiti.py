import numpy as np, random
from PIL import Image, ImageDraw

G = {
 'D': [[(0,0),(0,1)], [(0,0),(0.5,0.04),(0.85,0.3),(0.88,0.68),(0.55,0.95),(0,1)]],
 'E': [[(0.8,0.02),(0,0),(0.02,1),(0.82,0.98)], [(0.02,0.5),(0.62,0.48)]],
 'A': [[(0,1),(0.42,0),(0.84,1)], [(0.18,0.62),(0.66,0.6)]],
 'H': [[(0,0),(0.02,1)], [(0.76,0),(0.74,1)], [(0.02,0.52),(0.75,0.48)]],
 'L': [[(0,0),(0.02,1),(0.72,0.98)]],
 'P': [[(0.02,1),(0,0),(0.62,0.02),(0.86,0.26),(0.64,0.54),(0.02,0.56)]],
 'U': [[(0,0),(0.0,0.82),(0.14,1),(0.64,1),(0.8,0.82),(0.8,0)]],
 'S': [[(0.76,0.1),(0.5,0),(0.15,0.05),(0.05,0.26),(0.4,0.5),(0.72,0.7),(0.66,0.94),(0.3,1),(0,0.88)]],
}

def hand_text(out, text, x0, y0, h, w, step, width, col, angle_deg, seed=1, drips=0.4, S=6, jit=1.0):
    """Draw text with wobbly strokes, slanted, onto out (H x W x 4 float)."""
    r = random.Random(seed)
    H_, W_ = out.shape[:2]
    big = Image.new('L', (W_ * S, H_ * S), 0); d = ImageDraw.Draw(big)
    ang = np.radians(angle_deg); ca, sa = np.cos(ang), np.sin(ang)
    bottoms = []
    x = 0.0
    for ch in text:
        if ch == ' ':
            x += step * 0.6; continue
        for stroke in G[ch]:
            pts = []
            for (u, v) in stroke:
                px_ = x + u * w + r.uniform(-0.09, 0.09) * w * jit
                py_ = v * h + r.uniform(-0.06, 0.06) * h * jit
                # rotate around the text origin, then place
                X = x0 + px_ * ca - py_ * sa
                Y = y0 + px_ * sa + py_ * ca
                pts.append((X * S, Y * S))
                if v > 0.9: bottoms.append((X, Y))
            # wobble: subdivide each segment with a slight bend
            for (a, b) in zip(pts[:-1], pts[1:]):
                mx = (a[0] + b[0]) / 2 + r.uniform(-0.35, 0.35) * S * jit; my = (a[1] + b[1]) / 2 + r.uniform(-0.35, 0.35) * S * jit
                wd = max(1, int(round(width * S * r.uniform(0.8, 1.15))))
                d.line([a, (mx, my), b], fill=255, width=wd, joint='curve')
        x += step
    small = np.asarray(big.resize((W_, H_), Image.BOX)).astype(float) / 255
    m = small > 0.38
    rr = np.random.default_rng(seed)
    col = np.array(col, float)
    for (yy, xx) in zip(*np.where(m)):
        out[yy, xx, :3] = col * rr.uniform(0.86, 1.06); out[yy, xx, 3] = 255
    for (X, Y) in bottoms:
        if r.random() < drips:
            xi, yi = int(round(X)), int(round(Y)) + 1
            for k in range(r.randint(2, 5)):
                if 0 <= yi + k < H_ and 0 <= xi < W_ and out[yi + k, xi, 3] > 0:
                    out[yi + k, xi, :3] = col * 0.82
