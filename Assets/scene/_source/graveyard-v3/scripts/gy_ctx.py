"""Build the PixelLab context picture for the graveyard pass: church corner + lane + the code-drawn graveyard, all at ART size."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
ROOT, ART = sys.argv[1], sys.argv[2]
CW, CH = 256, 128
GX = CW - 84                                   # the graveyard art's left edge
def load(p): return Image.open(p).convert('RGBA')
def build():
    ctx = Image.new('RGBA', (CW, CH), (43, 40, 70, 255))            # the village field's flat tone behind everything
    lane = load(ROOT + '/Assets/scene/lane-2track.png')
    for x in range(-40, CW, lane.width): ctx.alpha_composite(lane.crop((max(0, -x), 0, min(lane.width, CW - x), 36)), (max(0, x), CH - 36))
    yard = load(ROOT + '/Assets/scene/lane-yard.png')
    ctx.alpha_composite(yard.crop((280 - 150, 0, 280, 36)), (0, CH - 36))
    church = load(ROOT + '/Assets/Base/base_100.png').crop((60, 72, 184, 200))
    ctx.alpha_composite(church, (0, CH - 128 + 1 if False else CH - church.height))
    base = ctx.copy()
    m = np.zeros((CH, CW), bool)
    for name in ('graveyard_ground_84x40.png', 'graveyard_fence_back_84x52.png', 'graveyard_fence_front_84x24.png'):
        lay = load(f'{ART}/{name}')
        ctx.alpha_composite(lay, (GX, CH - lay.height))
        a = np.array(lay)[..., 3] > 0
        m[CH - lay.height:CH, GX:GX + 84] |= a
    m = ndimage.binary_dilation(m, iterations=2)
    m[CH - 52:CH, GX + 30:] |= True                                  # the whole plot interior + fence box
    return base, ctx, m
if __name__ == '__main__':
    base, ctx, m = build()
    base.save('gen/gy_base.png'); ctx.save('gen/gy_ctx.png'); Image.fromarray((m * 255).astype('uint8')).save('gen/gy_mask.png')
    ctx.resize((CW * 3, CH * 3), Image.NEAREST).save('gen/gy_ctx_3x.png')
    Image.fromarray((m * 255).astype('uint8')).resize((CW * 3, CH * 3), Image.NEAREST).save('gen/gy_mask_3x.png')
