"""25% smoke INSIDE the base strips, from the openings (2026-11-21; approved by Jeremy column by column).
Six short columns: doorway, front-left window, front-right window (front wall), roof hole, far-left window, side window.
A LAYER on top of the approved smoke-free 25% strips. Nothing under it changes.

INPUT = the SMOKE-FREE strips: d25/base_025_lit_wip_16f.png (idle) and d25/base_025_attack_lit_wip_16f.png (attack), as
built by anim25.py. NEVER run it on final/base_025_*_final_16f.png: those now have this smoke baked in (it would double).
  python3 smoke25_openings.py ../d25/base_025_lit_wip_16f.png ../d25/base_025_attack_lit_wip_16f.png <out_prefix>
  env ONLY=door,roof,...  build only these columns (review one opening at a time)
Writes <out>_layer_16f.png (smoke only), <out>_idle_16f.png, <out>_attack_16f.png and prints the pixel check.
Saved results: final/base_025_anim_final_16f.png, final/base_025_attack_final_16f.png, d25/base_025_smoke_openings_layer_16f.png.

Method = the 50% method (smoke.py: staggered puffs, lumpy edges from its _noise, opacity and colour snapped to a few
steps, lighter billow top / dark underside / firelit underside near the mouth). smoke.py is NOT changed, so the 50%
strips still rebuild exactly. Differences for 25% (Jeremy 2026-11-21):
  * heavier and darker than 50%: own tone ramps and opacity steps, built on the smoke colours of the in-game 25% still
  * every column leans the same way: one straight tilt, LEAN px to the right per px of rise (with the wind)
  * short columns: each fades out under the fire above it. The ridge, belfry and corner fires get NO smoke here (theirs
    is the smoke layer behind the church)
  * the mouth sits at / just above the flame tip of its opening, and smoke is NEVER drawn on a pixel that is flame or
    cinder in that frame (protect_masks), so flames and cinders stay exactly as approved and show through the smoke
  * roof hole: the smoke rises from the coals on the right of the hole (the tongues on the left have no room above)
  * over the dark roof / side wall darker smoke does not show: those columns are firelit at the base (glow) and use a
    darker billow-top tone (dark_top), so they never read as grey steam
  * front-right window: not sooty-black; starts behind the flame tip and its top is lit by the corner fire (lit)
  * strictly seamless: a puff's shape depends on (i mod puffs/loops), so frame 16 flows into frame 1. smoke.py keys the
    shape on i, which leaves a small jump where the 50% loop wraps (found 2026-11-21, 50% not changed)
The same smoke layer goes on the idle and the attack strip."""
import importlib.util, math, os, sys
import numpy as np
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("smoke", os.path.join(here, "smoke.py")); smoke = importlib.util.module_from_spec(spec); spec.loader.exec_module(smoke)
W, H, N = 184, 200, 16

# dark underside, dense core, body, moonlit billow top. LOW = at the mouth (sooty, warm), HIGH = higher up (cooler).
# Built around the smoke colours of the in-game 25% still (Assets/Base/base_025.png: dark 28,25,29 / mid 59,48,55).
TONES_LOW = [(26, 22, 24), (38, 31, 33), (54, 44, 47), (80, 69, 70)]
TONES_HIGH = [(31, 29, 34), (45, 41, 46), (62, 56, 62), (92, 86, 91)]
TOP_DARK = ((66, 55, 56), (74, 67, 71))                       # billow-top tone for columns over the dark roof / side wall (a grey top reads as steam there)
EMBER = (158, 84, 40)
ALPHA_STEPS = [0.0, 0.32, 0.58, 0.82]
TOP_T = float(os.environ.get("TOP_T", 0.15)); UNDER_T = float(os.environ.get("UNDER_T", 0.28))
LEAN = float(os.environ.get("LEAN", 0.20))                    # every column: this many px to the right per px of rise

def col(x, y, rise, **kw):
    d = dict(x=x, y=y, rise=rise); d.update(kw); return d

SOURCES = {
    # front wall: slower than the roof / side wall (doorway and front-left are sooty: one tone darker)
    "door": col(128.5, 95.5, 40, r0=3.5, r1=12.5, puffs=8, loops=4, strength=1.0, salt=23, soot=True, wob=1.0, wfreq=4.0, grain=4.2, lump=1.4),
    "frontleft": col(106.0, 110.5, 36, r0=2.8, r1=8.0, puffs=12, loops=3, strength=1.2, salt=41, soot=True, phase=0.37, wob=1.3, wfreq=6.0, grain=3.2, lump=1.5),
    "frontright": col(153.0, 112.5, 38.5, r0=3.0, r1=6.5, puffs=12, loops=4, strength=1.0, salt=53, phase=0.71, wob=0.9, wfreq=3.2, grain=2.6, lump=1.4,
                      glow=0.4, glow_amt=0.35, top_t=0.25, dark_top=True, lit=(159.0, 79.0, 18.0, 0.5)),   # short: starts BEHIND the flame tip (a base that ended on the siding line above the flame looked cut off), stops under the corner fire, which lights its top (not sooty-black) -- Jeremy 2026-11-21
    # roof / side wall: faster. Roof hole: from the smouldering frame (coals) on the right of the hole, not from the tongues on the left
    "roof": col(70.0, 73.0, 28, r0=4.5, r1=10.5, puffs=8, loops=2, strength=1.8, salt=11, wob=1.3, wfreq=5.0, grain=3.4, lump=1.3, glow=0.6, top_t=0.25, dark_top=True),
    "farleft": col(6.0, 100.5, 40, r0=3.4, r1=11.0, puffs=12, loops=2, strength=1.3, salt=37, phase=0.21, wob=2.0, wfreq=3.6, grain=3.8, lump=1.6, glow=0.45, glow_amt=0.30, top_t=0.25, dark_top=True),
    "side": col(58.0, 114.5, 30, r0=2.6, r1=7.5, puffs=10, loops=2, strength=1.6, salt=67, phase=0.55, wob=1.2, wfreq=5.4, grain=2.4, lump=1.4, glow=0.4, glow_amt=0.30, top_t=0.25, dark_top=True),   # short: stops under the roof hole
}

def build_layer(names):
    """-> list of N arrays (H, W, 4) float: smoke colour (0..255) + opacity step (0..1). Same maths as smoke.add_smoke."""
    out = []
    srcs = [SOURCES[n] for n in names]
    for f in range(N):
        D = {}; T = {}; E = {}; S = {}; TOPT = {}; DT = {}; GA = {}; LIT = {}
        for s in srcs:
            L = s.get("loops", 1); P = s["puffs"]; K = P // L
            assert P % L == 0
            for i in range(P):
                k = i % K                                          # shape identity: repeats every strip loop -> seamless
                t = (f / (N * L) + i / P + s.get("phase", 0.0)) % 1.0
                cy = s["y"] - s["rise"] * (1 - (1 - t) ** 1.25)
                # one straight, tilted line for every column (uniform lean), plus a small sway that is zero at the mouth
                cx = s["x"] + LEAN * (s["y"] - cy) + s.get("wob", 1.6) * math.sin(t * s.get("wfreq", 4.5) + k * 2.1 + s["salt"]) * min(1.0, t / 0.15)
                r = s["r0"] + (s["r1"] - s["r0"]) * t ** 0.8
                dens = s["strength"] * (0.65 + 0.35 * min(1.0, t / 0.05)) * (1 - t) ** 1.6
                g = s.get("grain", 2.4)
                for y in range(int(cy - r - 2), int(cy + r + 3)):
                    for x in range(int(cx - r - 2), int(cx + r + 3)):
                        if not (0 <= x < W and 0 <= y < H): continue
                        d = math.hypot((x + .5 - cx) * 1.05, (y + .5 - cy) * 0.9) / r
                        if d >= 1.3: continue
                        n = smoke._noise(x, y + t * 10 + k * 13, g, s["salt"] + k) * .6 + smoke._noise(x, y + t * 6, g * 1.9, s["salt"] + 50) * .4
                        a = min(1.0, 1.7 * dens * max(0.0, 1.12 - d - s.get("lump", 0.8) * (n - 0.5)))
                        if a <= 0: continue
                        key = (x, y); old = D.get(key, 0.0); new = 1 - (1 - old) * (1 - a)
                        if new > 0: T[key] = (T.get(key, 0.0) * old + t * (new - old)) / new
                        D[key] = new
                        E[key] = max(E.get(key, 0.0), a * max(0.0, 1 - t / s.get("glow", 0.3)))   # firelit from below, near the mouth
                        if s.get("soot"): S[key] = max(S.get(key, 0.0), a)
                        if "top_t" in s: TOPT[key] = s["top_t"]
                        if s.get("dark_top"): DT[key] = True
                        if "glow_amt" in s: GA[key] = s["glow_amt"]
                        if "lit" in s: LIT[key] = s["lit"]
        lay = np.zeros((H, W, 4), float)
        for (x, y), a in D.items():
            step = max(i for i, v in enumerate(ALPHA_STEPS) if a >= v)
            if step == 0: continue
            t = T[(x, y)]
            # wider billows than 50% -> softer edges, so the top / underside test looks 2 px away (a 1 px step never trips)
            up = D.get((x, y - 2), 0.0); down = D.get((x, y + 2), 0.0)
            tone = 1 if a > 0.55 else 2
            if a - up > TOPT.get((x, y), TOP_T): tone = 3                                # moonlit billow top
            elif a - down > UNDER_T: tone = 0                          # dark underside
            if S.get((x, y), 0) > 0.3: tone = max(0, tone - 1)         # front-wall soot: one tone darker all through
            lo, hi = TONES_LOW[tone], TONES_HIGH[tone]; m = min(1.0, t / 0.55)
            if tone == 3 and DT.get((x, y)): lo, hi = TOP_DARK
            c = [lo[j] * (1 - m) + hi[j] * m for j in range(3)]
            e = E.get((x, y), 0.0)
            ga = GA.get((x, y), .65)
            if e > 0.2 and tone != 3 and S.get((x, y), 0) <= 0.3: c = [c[j] * (1 - e * ga) + EMBER[j] * e * ga for j in range(3)]
            if (x, y) in LIT:                                          # a fire close by lights the smoke (Jeremy 2026-11-21: "too dark ... closer to the flame")
                lx, ly, lr, la = LIT[(x, y)]; w = max(0.0, 1 - math.hypot(x - lx, y - ly) / lr) * la
                c = [c[j] * (1 - w) + EMBER[j] * w for j in range(3)]
            lay[y, x] = [round(v) for v in c] + [ALPHA_STEPS[step]]
        out.append(lay)
    return out

def frames_of(path):
    s = np.array(Image.open(path).convert("RGBA"))
    assert s.shape[1] == W * N and s.shape[0] == H, s.shape
    return [s[:, i * W:(i + 1) * W].copy() for i in range(N)]

def protect_masks(frames):
    """flame + cinder pixels per frame: bright fire colours, or warm and clearly brighter than that pixel's usual colour"""
    F = np.stack(frames).astype(int); r, g, b, a = F[..., 0], F[..., 1], F[..., 2], F[..., 3]
    med = np.median(r, axis=0)
    fire = (a > 0) & (((r > 150) & (r - b > 80) & (g > 40)) | ((r > 185) & (r - b > 55)) | ((r - med > 40) & (r - b > 38) & (r > 105)))
    return [fire[i] for i in range(N)]

def composite(base, lay, prot):
    out = base.copy(); A = lay[..., 3]; on = (A > 0) & ~prot
    opq = on & (base[..., 3] == 255); sky = on & (base[..., 3] == 0)
    assert not (on & (base[..., 3] > 0) & (base[..., 3] < 255)).any()
    for j in range(3):
        out[..., j][opq] = np.round(base[..., j][opq] * (1 - A[opq]) + lay[..., j][opq] * A[opq]).astype(np.uint8)
        out[..., j][sky] = lay[..., j][sky].astype(np.uint8)
    out[..., 3][sky] = np.round(A[sky] * 255).astype(np.uint8)
    return out, on

def strip(frames):
    im = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
    for i, fr in enumerate(frames): im.paste(Image.fromarray(fr, "RGBA"), (i * W, 0))
    return im

if __name__ == "__main__":
    idle_p, att_p, out = sys.argv[1:4]
    names = [n for n in os.environ.get("ONLY", ",".join(SOURCES)).split(",") if n]
    idle, att = frames_of(idle_p), frames_of(att_p)
    pi, pa = protect_masks(idle), protect_masks(att)
    prot = [pi[i] | pa[i] for i in range(N)]
    layer = build_layer(names)
    res = {}
    lay_frames = []
    for i in range(N):
        L = layer[i].copy(); L[..., 3][prot[i]] = 0; L[..., :3][L[..., 3] == 0] = 0
        lay_frames.append(np.dstack([L[..., :3], np.round(L[..., 3] * 255)]).astype(np.uint8))
    strip(lay_frames).save(out + "_layer_16f.png")
    for tag, base in (("idle", idle), ("attack", att)):
        outf = []; changed_outside = 0; prot_changed = 0; smoke_px = 0; sky_px = 0; belfry = 0
        for i in range(N):
            o, on = composite(base[i], layer[i], prot[i])
            diff = (o != base[i]).any(axis=2)
            changed_outside += int((diff & ~on).sum()); prot_changed += int((diff & prot[i]).sum())
            smoke_px += int(on.sum()); sky_px += int((on & (base[i][..., 3] == 0)).sum()); belfry += int(diff[20:50, 90:127].sum())
            outf.append(o)
        strip(outf).save(f"{out}_{tag}_16f.png")
        res[tag] = dict(smoke_px=smoke_px, changed_outside_smoke=changed_outside, flame_or_cinder_px_changed=prot_changed, sky_px=sky_px, belfry_px_changed=belfry)
    print("columns", names); print(res)
