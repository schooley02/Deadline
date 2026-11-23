"""PixelLab pass for the headstone set: the five code-drawn stones in a row on grass, with the church corner for style."""
import sys, concurrent.futures as cf
import numpy as np
from PIL import Image
import pl
ROOT, STONES = '/mnt/user-data/uploads/Deadline', '/home/claude/work/stones'
CW, CH = 256, 128
X0, PITCH, FEET = 106, 29, CH - 8            # first stone's left edge, spacing, the row the stones stand on
def load(p): return Image.open(p).convert('RGBA')
def build():
    ctx = Image.new('RGBA', (CW, CH), (43, 40, 70, 255))
    g = load('/home/claude/work/art/graveyard_ground_84x40.png').crop((50, 4, 84, 40))      # plain grass from the plot
    for x in range(96, CW, g.width): ctx.alpha_composite(g.crop((0, 0, min(g.width, CW - x), 36)), (x, CH - 36))
    lane = load(ROOT + '/Assets/scene/lane-2track.png'); ctx.alpha_composite(lane.crop((0, 0, 96, 36)), (0, CH - 36))
    yard = load(ROOT + '/Assets/scene/lane-yard.png'); ctx.alpha_composite(yard.crop((280 - 150, 0, 280, 36)).crop((0, 0, 96, 36)), (0, CH - 36))
    church = load(ROOT + '/Assets/Base/base_100.png').crop((60, 72, 184, 200)).crop((0, 0, 100, 128)); ctx.alpha_composite(church, (0, 0))
    cells = []
    for i in range(5):
        s = load(f'{STONES}/headstone-{i}_24x24.png'); x = X0 + i * PITCH
        ctx.alpha_composite(s, (x, FEET - 24)); cells.append((x, FEET - 24))
    return ctx, cells
DESC = ("Repaint only the five small grave markers standing in a row on the grass, as finished pixel art in exactly the same style as "
        "the church, keeping each one's exact size, position and shape. From left to right: a plain wooden cross of two bare planks; a "
        "rough mossy fieldstone marker lying flat on the ground; a small rough-hewn chipped grey stone; a polished blue-grey granite "
        "headstone with an engraved cross on a stone base and a small jar of flowers; a tall white marble headstone with a carved cross "
        "on top and gold lettering on a stepped grey base. Dark outlines, flat cel shading, moonlit from the upper right, muted, weathered, "
        "realistic. Keep the church and the grass unchanged. No glow, no extra objects, no text.")
if __name__ == '__main__':
    ctx, cells = build(); ctx.save('gen/hs_ctx.png'); ctx.resize((CW * 3, CH * 3), Image.NEAREST).save('gen/hs_ctx_3x.png')
    if len(sys.argv) > 1 and sys.argv[1] == 'run':
        b0 = pl.balance()['subscription']['generations']
        def go(seed):
            outs, j = pl.edit_text(ctx, DESC, seed)
            for k, o in enumerate(outs): o.save(f'gen/hs_edt_s{seed}_{k}.png')
            return seed, len(outs), j.get('status')
        with cf.ThreadPoolExecutor(2) as ex:
            for f in [ex.submit(go, s) for s in (611, 612)]:
                try: print(f.result(), flush=True)
                except Exception as e: print('ERR', repr(e)[:300], flush=True)
        b1 = pl.balance()['subscription']['generations']; print('used', b0 - b1, 'left', b1)
