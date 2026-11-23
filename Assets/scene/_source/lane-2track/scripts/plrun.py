import sys, concurrent.futures as cf
sys.path.insert(0,'/home/claude/audit')
from PIL import Image
import pl
ROAD=("Repaint this rough layout as finished, detailed pixel art, keeping the exact layout, proportions and flat side-on framing: "
      "plain dark night sky above, a thin dark grass verge with small tufts, and below it an old two-lane rural county road running "
      "straight from the left edge to the right edge, seen from a slightly raised angle. Top of the road: a narrow grey gravel shoulder "
      "with loose stones. Then weathered dark asphalt: cracks, tar-sealed crack lines, patched repairs in slightly different greys, "
      "a few shallow potholes, worn tyre tracks, a faded broken yellow centre line that is mostly worn away, faint worn white edge lines. "
      "A thin strip of gravel at the very bottom edge. Moonlit night, muted desaturated blue-grey colours, dark, gritty, weathered, "
      "realistic, not cartoonish. No vehicles, no people, no buildings, no fence, no puddles, no glow, no rim light.")
YARD=("Repaint this rough layout as finished, detailed pixel art, keeping the exact layout, proportions and flat side-on framing: "
      "plain dark night sky above, a thin dark grass verge with small tufts, and below it the bare ground of a country churchyard "
      "forecourt seen from a slightly raised angle: hard-packed dirt with scattered gravel and small stones, trampled footprints and "
      "scuffs, a few sparse tufts of dry grass. Moonlit night, muted grey-brown colours, dark, gritty, weathered, realistic, not cartoonish. "
      "No objects, no buildings, no people, no fence, no puddles, no glow, no rim light.")
def run(args):
    name, desc, seed = args
    im = Image.open(f'pl_out/guide_{name}_256x128.png').convert('RGBA')
    outs = pl.edit_text(im, desc, seed=seed)
    for i,o in enumerate(outs): o.save(f'pl_out/{name}_s{seed}_{i}.png')
    return name, seed, [o.size for o in outs]
b0 = pl.balance()
jobs = [('road',ROAD,201),('road',ROAD,202),('yard',YARD,301),('yard',YARD,302)]
with cf.ThreadPoolExecutor(4) as ex:
    for f in [ex.submit(run,j) for j in jobs]:
        try: print(f.result(), flush=True)
        except Exception as e: print('ERR', e, flush=True)
print('used', b0 - pl.balance(), 'left', pl.balance())
