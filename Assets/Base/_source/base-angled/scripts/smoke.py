"""Smoke for the burning base states (not steam): dark, sooty, dense at the opening and thinning as it rises, rolling
billows with moonlit tops and dark undersides, a dull firelit underside just above the opening, widening and lingering.
Drifts right with the wind (the way the flag blows). Seamless loop: puffs are staggered and each lives `loops` strip loops.
Pixel-art look: opacity and colour snap to a few steps (no airbrush gradient).
Over the sky the smoke is see-through (alpha); over the building it is blended into the pixel."""
import math, random

# charcoal, brown-tinted low down (soot) -> cooler, lighter grey high up; last tone = moonlit billow tops
LOW = [(52, 45, 41), (68, 60, 54), (86, 77, 70), (114, 106, 99)]
HIGH = [(60, 59, 63), (78, 76, 80), (96, 94, 97), (126, 123, 125)]
EMBER = (150, 82, 40)
ALPHA_STEPS = [0.0, 0.25, 0.45, 0.68]

def _noise(x, y, s, salt, G={}):
    gx, gy = x / s, y / s; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    def r(i, j):
        k = (i, j, s, salt)
        if k not in G: G[k] = random.Random(hash(k)).random()
        return G[k]
    a = r(x0, y0) * (1 - fx) + r(x0 + 1, y0) * fx; c = r(x0, y0 + 1) * (1 - fx) + r(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + c * fy

def add_smoke(frames, N, sources):
    """sources: dicts with x, y (mouth), rise, drift (px over a life), r0, r1 (start/end radius), puffs, strength,
    salt, loops (strip loops per puff life; puffs must be a multiple of loops), soot (extra dark, e.g. a doorway),
    phase (timing offset 0..1), wob / wfreq (sideways sway), grain (billow size): vary these so no two columns look alike"""
    W, H = frames[0].size
    for f, im in enumerate(frames):
        px = im.load()
        D = {}; T = {}; E = {}; S = {}
        for s in sources:
            L = s.get("loops", 1)
            for i in range(s["puffs"]):
                t = (f / (N * L) + i / s["puffs"] + s.get("phase", 0.0)) % 1.0   # 0 = at the opening, 1 = gone
                cx = s["x"] + s["drift"] * t ** 1.3 + s.get("wob", 1.6) * math.sin(t * s.get("wfreq", 4.5) + i * 2.1 + s["salt"])
                cy = s["y"] - s["rise"] * (1 - (1 - t) ** 1.25)          # slows as it rises and spreads
                r = s["r0"] + (s["r1"] - s["r0"]) * t ** 0.8
                dens = s["strength"] * (0.65 + 0.35 * min(1.0, t / 0.05)) * (1 - t) ** 1.6   # thick right at the mouth (stays attached), thins with height
                for y in range(int(cy - r - 2), int(cy + r + 3)):
                    for x in range(int(cx - r - 2), int(cx + r + 3)):
                        if not (0 <= x < W and 0 <= y < H): continue
                        d = math.hypot((x + .5 - cx) * 1.05, (y + .5 - cy) * 0.9) / r
                        if d >= 1.3: continue
                        g = s.get("grain", 2.4)
                        n = _noise(x, y + t * 10 + i * 13, g, s["salt"] + i) * .6 + _noise(x, y + t * 6, g * 1.9, s["salt"] + 50) * .4
                        a = min(1.0, 1.7 * dens * max(0.0, 1.12 - d - 0.8 * (n - 0.5)))   # lumpy billow edges
                        if a <= 0: continue
                        k = (x, y); old = D.get(k, 0.0); new = 1 - (1 - old) * (1 - a)
                        if new > 0: T[k] = (T.get(k, 0.0) * old + t * (new - old)) / new
                        D[k] = new
                        E[k] = max(E.get(k, 0.0), a * max(0.0, 1 - t / 0.3))
                        if s.get("soot"): S[k] = max(S.get(k, 0.0), a)
        for (x, y), a in D.items():
            step = max(i for i, v in enumerate(ALPHA_STEPS) if a >= v)
            if step == 0: continue
            A = ALPHA_STEPS[step]
            t = T[(x, y)]
            up = D.get((x, y - 1), 0.0); down = D.get((x, y + 1), 0.0)
            tone = 1 if a > 0.55 else 2                                # dense core darker
            if a - up > 0.18: tone = 3                                 # moonlit billow top
            elif a - down > 0.22: tone = 0                             # dark underside
            if S.get((x, y), 0) > 0.3: tone = max(0, tone - 1)         # doorway soot
            lo, hi = LOW[tone], HIGH[tone]; m = min(1.0, t / 0.55)
            c = tuple(lo[k] * (1 - m) + hi[k] * m for k in range(3))
            e = E.get((x, y), 0.0)
            if e > 0.2 and tone != 3 and S.get((x, y), 0) <= 0.3: c = tuple(c[k] * (1 - e * .65) + EMBER[k] * e * .65 for k in range(3))   # firelit underside
            c = tuple(round(v) for v in c)
            p = px[x, y]
            if p[3] == 255:
                px[x, y] = tuple(round(p[k] * (1 - A) + c[k] * A) for k in range(3)) + (255,)
            else:
                pa = p[3] / 255; na = A + pa * (1 - A)
                col = tuple(round((c[k] * A + p[k] * pa * (1 - A)) / na) for k in range(3)) if na > 0 else c
                px[x, y] = col + (round(na * 255),)
    return frames
