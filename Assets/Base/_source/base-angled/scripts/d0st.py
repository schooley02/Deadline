import pl, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from concurrent.futures import ThreadPoolExecutor
base=Image.open("base_000_v1.png").convert("RGBA"); W,H=base.size
def poly(pts): m=Image.new("L",(W,H),0); ImageDraw.Draw(m).polygon(pts,255); return np.array(m)>0
loose=poly([(30,116),(38,116),(41,123),(42,134),(44,148),(44,162),(47,164),(47,191),(21,191),(21,164),(25,162),(26,148),(27,134),(28,123)])
tight=poly([(30,116),(37,116),(39,119),(40,124),(41,127),(42,140),(42,162),(45,164),(45,184),(46,186),(46,192),
            (22,192),(22,186),(24,184),(24,165),(29,163),(27,150),(27,127),(29,124),(29,119)])
m=ndimage.binary_dilation(loose,iterations=3)&~tight
m[185:,:]=False                                        # keep the foundation at the statue's feet
Image.fromarray((m*255).astype(np.uint8)).save("d0st_mask.png")
Image.fromarray((tight*255).astype(np.uint8)).save("statue_tight.png")
desc=("charred black rubble of a burned church behind a stone statue at night, burnt timbers, broken shingles and ash heaped low, "
      "dark night sky above the pile, no wall standing, gritty muted pixel art")
def go(s): pl.inpaint(base,Image.fromarray((m*255).astype(np.uint8)).convert("RGB"),desc,seed=s,no_bg=True)[0].save(f"d0st_s{s}.png")
with ThreadPoolExecutor(3) as ex: list(ex.map(go,[12,24,36]))
sheet=Image.new("RGBA",(4*50,90),(0,0,0,255))
for k,f in enumerate(["base_000_v1.png"]+[f"d0st_s{s}.png" for s in (12,24,36)]):
    r=Image.open(f).convert("RGBA"); b=Image.new("RGBA",r.size,(24,26,40,255)); b.alpha_composite(r)
    sheet.paste(b.crop((10,106,60,196)),(k*50,0))
sheet.resize((sheet.width*4,360),Image.NEAREST).save("/tmp/d0st.png")
