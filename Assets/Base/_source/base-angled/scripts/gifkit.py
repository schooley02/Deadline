"""Shared-palette GIF writer: one palette for every frame, no dithering, so still pixels never shift colour.
exact = RGB colours that must survive untouched (2026-11-22: at 0% the few bright ember / floating-ember pixels are so
rare that the 256-colour reduction dropped them and showed them GREY in the preview; the strip itself was right).
Pass every colour of small animated details there; they get their own palette slots."""
from PIL import Image
def save_gif(frames_rgb, name, fps, exact=None):
    W, H = frames_rgb[0].size
    mosaic = Image.new("RGB", (W, H * len(frames_rgb)))
    for i, f in enumerate(frames_rgb): mosaic.paste(f, (0, H * i))
    exact = [tuple(int(v) for v in c) for c in (exact or [])]
    pal = mosaic.quantize(colors=256 - len(exact), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    if exact:
        p = pal.getpalette()[:3 * (256 - len(exact))]
        p += [0] * (3 * (256 - len(exact)) - len(p))
        for c in exact: p += list(c)
        pal = Image.new("P", (1, 1)); pal.putpalette(p)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames_rgb]
    q[0].save(name, save_all=True, append_images=q[1:], duration=1000 // fps, loop=0, optimize=False, disposal=1)
