"""Review GIFs + frame sheets for a 16-frame base strip. GIFs go through gifkit (one shared palette, no dither).
Usage: python3 preview25.py <strip.png> <out_prefix> [name:x0,y0,x1,y1,zoom ...]"""
import sys, os, importlib.util
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gifkit", os.path.join(here, "gifkit.py")); gk = importlib.util.module_from_spec(spec); spec.loader.exec_module(gk)
strip = Image.open(sys.argv[1]).convert("RGBA"); out = sys.argv[2]
W, H = 184, 200; N = strip.width // W; FPS = int(os.environ.get("FPS", 8))
frames = [strip.crop((i * W, 0, (i + 1) * W, H)) for i in range(N)]
def bgc(fr, box=None, z=3):
    bg = Image.new("RGBA", (W, H), (24, 26, 40, 255)); bg.alpha_composite(fr); bg = bg.convert("RGB")
    if box: bg = bg.crop(box)
    return bg.resize((bg.width * z, bg.height * z), Image.NEAREST)
crops = [("full", None, 3)]
for a in sys.argv[3:]:
    name, rest = a.split(":"); v = [int(t) for t in rest.split(",")]; crops.append((name, tuple(v[:4]), v[4]))
for name, bx, z in crops:
    gk.save_gif([bgc(fr, bx, z) for fr in frames], f"{out}_{name}.gif", FPS)
    tiles = [bgc(fr, bx, max(1, z // 2) if bx else 2) for fr in frames]
    tw, th = tiles[0].size; cols = 8 if bx else 4; rows = (N + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 4) + 4, rows * (th + 16) + 4), (10, 10, 14)); d = ImageDraw.Draw(sheet)
    for i, t in enumerate(tiles):
        x = 4 + (i % cols) * (tw + 4); y = 4 + (i // cols) * (th + 16)
        sheet.paste(t, (x, y + 12)); d.text((x + 2, y), f"frame {i + 1}", fill=(200, 200, 200))
    sheet.save(f"{out}_{name}_sheet.png")
print("wrote", [c[0] for c in crops])
