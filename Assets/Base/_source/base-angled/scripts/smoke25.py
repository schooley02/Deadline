"""25% smoke LAYER (separate strip, drawn BEHIND the church in the game) -- code-only FALLBACK, 2026-11-21.
STATUS: Jeremy's favourite of this session's code-only attempts ("of all the ones you did in this session, this one was
my favorite as a fallback"). The plan is still a PixelLab-drawn plume animated in code; use this strip if that fails.
Rejected and NOT to be brought back: soft shaded balls, banded lumps lit orange, "popcorn" clumps of round bulges
("too many spheres", "looks like bubbles").
Jeremy's rules: the big dark billowing cloud of the in-game 25% still is the look; smoke must not be cut off by the
184x200 base frame -> its own, bigger canvas behind the church; smoke rises from parts of the building we cannot see
(behind the whole roof line), NEVER from each visible flame; the fire lights the smoke close to it; flat fills, hard edges.
His one addition to this version: smoke also rises from off the LEFT side of the screen (the church carries on past the
left edge), see LEFT_SOURCES. Those billows are meant to be cut by the left edge: that edge is the edge of the screen.

Canvas  W x H = 280 x 312; the church's 184x200 frame sits at (OX, OY) = (0, 112): 112 px of extra sky above, 96 px to
the right. 32 frames at 8 fps (4 s loop; the church strips loop twice inside it). Seamless: every billow "type" is
re-born every 32 frames and lives 96 frames.
Usage: python3 smoke25.py <out_prefix> [church_lit_strip.png for the preview]"""
import math, os, random, sys
import numpy as np
from PIL import Image

W, H, OX, OY, N = 280, 312, 0, 112, 32
RAMP = np.array([(27, 23, 24), (40, 33, 33), (56, 46, 44), (75, 63, 58), (97, 83, 76), (118, 104, 96)], float)   # dark underside -> moonlit top
GLOW = np.array((152, 78, 38), float)
LIGHT = (-0.50, -0.82)                                       # moonlight from the upper left

# where smoke leaves the building (church frame coordinates): behind the ridge, thickest over the three ridge fires,
# and behind the right corner.  weight = how many billow types, size = how big they get
# v3 (Jeremy 2026-11-21): the smoke must NOT come from each big flame. It rises from parts of the roof and building we
# cannot see (behind what we can see): one broad mass coming up from behind the whole roof line, gathering into one plume.
# Emitters are spread evenly behind the ridge and the gable, start hidden below the roof line, and ignore the flames.
SOURCES = [dict(x=x_, y=y_, n=2, r0=5.5, r1=r1_, rise=rise_, drift=drift_, life=3)
           for x_, y_, r1_, rise_, drift_ in ((2, 56, 21, 96, 96), (20, 54, 24, 104, 94), (38, 56, 26, 110, 92), (56, 58, 25, 108, 88), (74, 60, 24, 104, 84),
                                              (92, 60, 23, 100, 78), (110, 62, 22, 98, 70), (128, 66, 21, 96, 62), (146, 72, 19, 92, 54))]
# Jeremy 2026-11-21: "have some smoke rising from off of the left side of the screen". Appended AFTER the approved sources so
# the approved billows keep their random numbers (they come out pixel-for-pixel the same wherever these do not cover them).
LEFT_SOURCES = [dict(x=x_, y=y_, n=2, r0=5.5, r1=r1_, rise=rise_, drift=drift_, life=3)
                for x_, y_, r1_, rise_, drift_ in ((-16, 57, 22, 100, 96), (-36, 58, 24, 106, 94), (-58, 59, 23, 102, 92))]
if not os.environ.get("NO_LEFT"): SOURCES = SOURCES + LEFT_SOURCES
# the visible fires that light the smoke from below (church frame coordinates)
FIRES = [(15, 30), (40, 24), (67, 34), (156, 52), (101, 40)]

def build_types(seed=2511):
    r = random.Random(seed); types = []
    for s in SOURCES:
        for i in range(s["n"]):
            types.append(dict(x=s["x"] + r.uniform(-3.5, 3.5), y=s["y"] + r.uniform(-2, 3), r0=s["r0"] * r.uniform(.85, 1.15), r1=s["r1"] * r.uniform(.8, 1.2),
                              rise=s["rise"] * r.uniform(.85, 1.12), drift=s["drift"] * r.uniform(.75, 1.25), life=s["life"],
                              phase=(i + r.uniform(0, .9)) * N / s["n"], wob=r.uniform(1.5, 4.0), wph=r.uniform(0, math.tau),
                              lumps=[(k_ * math.tau / 5 + r.uniform(-0.45, 0.45), r.uniform(.42, .66), r.uniform(.46, .68)) for k_ in range(5)],
                              spin=r.uniform(-0.9, 0.9), seed=r.random() * 100))
    return types

def instances(types, f):
    out = []
    for t in types:
        for k in range(t["life"]):
            age = (((f - t["phase"]) % N) + N * k) / (N * t["life"])          # 0 = just out, 1 = gone
            e = 1 - (1 - age) ** 1.6                                           # fast at first, slowing as it climbs
            cx = OX + t["x"] + t["drift"] * age ** 1.15 + t["wob"] * math.sin(t["wph"] + age * 5.0)
            cy = OY + t["y"] - t["rise"] * e
            rad = t["r0"] + (t["r1"] - t["r0"]) * age ** 0.62
            out.append((age, cx, cy, rad, t))
    out.sort(key=lambda q: -q[0])                                              # oldest (highest, faintest) first
    return out

# v4 (Jeremy 2026-11-21): v3's banded lumps looked "way worse". Back to the v2 look -- FLAT fills in the in-game still's
# smoke tones, hard edges, lumpy rolls with a flat shadow shape -- with MORE DETAIL, positioned as in v3 (one mass coming
# up from behind the whole roof line, not from the flames). Detail added: every side lump has its own shadow, each main
# roll has a thin light edge on its fire side and a small inner curl, and rolls close to the flames take the warm tones.
#            light edge       body           shadow
TONES = [((76, 63, 71), (59, 48, 55), (31, 27, 32)),       # away from the fire (the in-game still's smoke colours)
         ((88, 64, 62), (70, 51, 52), (38, 29, 32)),       # a little warmth
         ((104, 70, 58), (82, 54, 49), (46, 32, 33)),      # warm (the still's fire-lit smoke tone)
         ((134, 84, 54), (110, 66, 46), (62, 38, 32))]     # right behind the flames
HIGH_T = ((54, 48, 58), (46, 40, 49), (30, 28, 36))        # high, thinning smoke: cooler, nearer the night sky

def render(f, types):
    out = np.zeros((H, W, 4), np.uint8)
    yy, xx = np.mgrid[0:H, 0:W]
    fires = [(OX + fx, OY + fy) for fx, fy in FIRES]
    def lob(xa, ya, ph_):
        th = np.arctan2(ya, xa)
        # Jeremy 2026-11-21: some shapes had straight edges or read as triangles. That came from the 2- and 3-lobe terms
        # here (a 3-lobe wobble IS a rounded triangle). Now only small, higher-count bumps: every lump stays round and its
        # edge is a row of soft scallops, never a flat side or a corner.
        return 1 + 0.065 * np.sin(4 * th + ph_) + 0.05 * np.sin(6 * th + 1.7 * ph_) + 0.035 * np.sin(9 * th + 0.6 * ph_)
    for age, cx, cy, rad, t in instances(types, f):
        grow = min(1.0, age / 0.06)
        shrink = 1.0 if age < 0.72 else max(0.0, 1 - ((age - 0.72) / 0.28) ** 1.4)
        r = rad * (0.55 + 0.45 * grow) * shrink
        if r < 1.2: continue
        a_step = 255 if age < 0.8 else 178 if age < 0.91 else 115
        blobs = [(cx + math.cos(a + t["spin"] * age * 2) * r * d, cy + math.sin(a + t["spin"] * age * 2) * r * d * 0.8, r * s_) for a, d, s_ in t["lumps"][:5]] + [(cx, cy, r)]
        main_i = len(blobs) - 1
        for bi, (bx, by, br) in enumerate(blobs):
            if br < 1.2: continue
            x0, x1 = max(0, int(bx - br * 1.4 - 2)), min(W, int(bx + br * 1.4 + 3)); y0, y1 = max(0, int(by - br * 1.4 - 2)), min(H, int(by + br * 1.4 + 3))
            if x0 >= x1 or y0 >= y1: continue
            X = xx[y0:y1, x0:x1] + .5 - bx; Y = yy[y0:y1, x0:x1] + .5 - by
            ph_ = t["seed"] + bi * 1.9 + t["spin"] * age * 2.5
            ins = np.hypot(X, Y) < br * lob(X, Y, ph_)
            if not ins.any(): continue
            # tone set for this lump: by how close its middle is to the nearest visible fire (whole lump alike)
            dfire = min(math.hypot(bx - fx, by - fy) for fx, fy in fires)
            warm = max(0.0, 1 - dfire / 58.0)
            ti = int(min(3, math.floor(warm * 4.2 + 0.3 * math.sin(t["seed"] * 7 + bi))))
            light, body, shade = TONES[max(0, ti)] if age < 0.62 else (TONES[1] if (ti >= 2 and age < 0.72) else HIGH_T)
            # flat shadow shape on the side away from the fire light (upper right); thinner on the side lumps
            k_ = 0.27 if bi == main_i else 0.20
            Xs, Ys = X + k_ * br, Y - (k_ - 0.04) * br
            shadow = ins & (np.hypot(Xs, Ys) > (0.93 if bi == main_i else 0.96) * br * lob(Xs, Ys, ph_))
            region = out[y0:y1, x0:x1]
            region[ins] = body + (a_step,)
            region[shadow] = shade + (a_step,)
            if bi == main_i and br >= 7:
                # thin light edge on the fire side (lower left) ...
                Xl, Yl = X - 0.16 * br, Y + 0.14 * br
                edge_l = ins & ~shadow & (np.hypot(Xl, Yl) > 0.97 * br * lob(Xl, Yl, ph_))
                region[edge_l] = light + (a_step,)
                # ... and a small inner curl: a short dark arc inside the roll, the fold where it turns over
                rc = 0.52 * br; Xc, Yc = X + 0.10 * br, Y + 0.06 * br
                ring = (np.abs(np.hypot(Xc, Yc) - rc) < 0.62) & ins & ~shadow
                thc = np.arctan2(Yc, Xc); a0 = t["seed"] * 3 + t["spin"] * age * 3
                arc = ring & (np.cos(thc - a0) > 0.25)
                region[arc] = shade + (a_step,)
    return out

if __name__ == "__main__":
    out = sys.argv[1]; types = build_types()
    frames = [render(f, types) for f in range(N)]
    strip = Image.new("RGBA", (W * N, H), (0, 0, 0, 0))
    for i, fr in enumerate(frames): strip.paste(Image.fromarray(fr), (i * W, 0))
    strip.save(out + f"_smoke_{N}f.png")
    edge = [int((fr[0, :, 3] > 0).sum() + (fr[:, W - 1, 3] > 0).sum()) for fr in frames]
    print("billow types", len(types), "| strip", strip.size, "| smoke px on the top row or right column, per frame:", edge)
    print("px changing per step (last = 32->1):", [int((frames[i] != frames[(i + 1) % N]).any(-1).sum()) for i in (0, 15, 30, 31)])
    if len(sys.argv) > 2:
        import importlib.util
        sp = importlib.util.spec_from_file_location("gifkit", os.path.join(os.path.dirname(os.path.abspath(__file__)), "gifkit.py")); gk = importlib.util.module_from_spec(sp); sp.loader.exec_module(gk)
        church = Image.open(sys.argv[2]).convert("RGBA"); nf = church.width // 184
        comps = []
        for f in range(N):
            bg = Image.new("RGBA", (W, H), (24, 26, 40, 255)); bg.alpha_composite(Image.fromarray(frames[f]))
            bg.alpha_composite(church.crop(((f % nf) * 184, 0, (f % nf + 1) * 184, 200)), (OX, OY))
            comps.append(bg.convert("RGB").resize((W * 2, H * 2), Image.NEAREST))
        gk.save_gif(comps, out + "_smoke_preview.gif", 8)
        comps[0].save(out + "_smoke_preview_f1.png"); comps[16].save(out + "_smoke_preview_f17.png")
