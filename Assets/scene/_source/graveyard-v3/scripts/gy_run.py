import sys, concurrent.futures as cf
from PIL import Image
import pl
ctx = Image.open('gen/gy_ctx.png').convert('RGBA'); mask = Image.open('gen/gy_mask.png')
INP = ("A small country cemetery plot on flat ground at the end of the gravel lane, in exactly the same pixel art style as the church: "
       "short dark green grass with a few small tufts, enclosed by a black wrought-iron picket fence. The fence has thin upright bars with "
       "small spear tips, two thin horizontal rails and thicker square black posts with flat caps. It runs straight along the front, "
       "back along the left side at an angle, and across the back, where it looks a little fainter with distance. The plot is EMPTY. "
       "Moonlit night, muted, weathered, gritty, realistic, same dark navy outlines and flat cel shading as the church. "
       "No headstones, no gate, no arch, no trees, no people, no glow, no white.")
EDT = ("Repaint only the fenced grass plot at the right as finished pixel art in exactly the same style as the church, keeping its exact "
       "layout, size and angle: flat short dark green grass with a few small tufts, enclosed by a black wrought-iron picket fence with "
       "thin spear-tipped bars, two thin rails and thicker square black posts with flat caps; the back and side runs a little fainter "
       "with distance. Keep the church, lane and sky unchanged. Moonlit night, muted, weathered, gritty, realistic. "
       "No headstones, no gate, no arch, no trees, no people, no glow.")
def inp(seed):
    outs, j = pl.inpaint(ctx, mask, INP, seed)
    for i, o in enumerate(outs): o.save(f'gen/gy_inp_s{seed}_{i}.png')
    return 'inpaint', seed, [o.size for o in outs], j.get('status')
def edt(seed):
    outs, j = pl.edit_text(ctx, EDT, seed)
    for i, o in enumerate(outs): o.save(f'gen/gy_edt_s{seed}_{i}.png')
    return 'edit', seed, [o.size for o in outs], j.get('status')
b0 = pl.balance()['subscription']['generations']
with cf.ThreadPoolExecutor(3) as ex:
    fs = [ex.submit(inp, 511), ex.submit(inp, 512), ex.submit(edt, 521)]
    for f in fs:
        try: print(f.result(), flush=True)
        except Exception as e: print('ERR', repr(e)[:400], flush=True)
b1 = pl.balance()['subscription']['generations']
print('used', b0 - b1, 'left', b1)
