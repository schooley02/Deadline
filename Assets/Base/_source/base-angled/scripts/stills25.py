"""25% stills from frame 1 of the strips (2026-11-22; Jeremy: the stills show the opening smoke).
Usage: python3 stills25.py <final/base_025_anim_final_16f.png> <flames2_16f.png> <d25/base_025_smoke_openings_layer_16f.png> <out_dir>
  flames2_16f.png = the UNLIT 25% strip written by anim25.py (<out>_flames2_16f.png); run anim25.py first:
    python3 anim25.py final/base_025_unlit_final_184x200.png d25/base_025_v3_unlit_flames.png <tmp>/b25
  (its _lit_16f.png must equal d25/base_025_lit_wip_16f.png pixel for pixel; it did on 2026-11-22).
Writes base_025_lit_final_184x200.png = frame 1 of the idle strip (firelight + opening smoke), and
       base_025_unlit_final_184x200.png = frame 1 of the unlit strip with the same opening smoke composited the way
       smoke25_openings.py does it."""
import sys, os
import numpy as np
from PIL import Image
anim_p, flames_p, smoke_p, out = sys.argv[1:5]
W = 184
def f0(p): return np.array(Image.open(p).convert("RGBA"))[:, :W].copy()
lay = f0(smoke_p); A = lay[..., 3] / 255.0
def comp(base):
    o = base.copy(); on = A > 0; opq = on & (base[..., 3] == 255); sky = on & (base[..., 3] == 0)
    assert not (on & (base[..., 3] > 0) & (base[..., 3] < 255)).any()
    for j in range(3):
        o[..., j][opq] = np.round(base[..., j][opq] * (1 - A[opq]) + lay[..., j][opq] * A[opq]).astype(np.uint8)
        o[..., j][sky] = lay[..., j][sky]
    o[..., 3][sky] = lay[..., 3][sky]
    return o
Image.fromarray(f0(anim_p)).save(os.path.join(out, "base_025_lit_final_184x200.png"))
Image.fromarray(comp(f0(flames_p))).save(os.path.join(out, "base_025_unlit_final_184x200.png"))
print("written to", out)
