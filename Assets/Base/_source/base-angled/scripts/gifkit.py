"""Shared-palette GIF writer: one palette for every frame, no dithering, so still pixels never shift colour."""
from PIL import Image
def save_gif(frames_rgb, name, fps):
    W, H = frames_rgb[0].size
    mosaic = Image.new("RGB", (W, H * len(frames_rgb)))
    for i, f in enumerate(frames_rgb): mosaic.paste(f, (0, H * i))
    pal = mosaic.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames_rgb]
    q[0].save(name, save_all=True, append_images=q[1:], duration=1000 // fps, loop=0, optimize=False, disposal=1)
