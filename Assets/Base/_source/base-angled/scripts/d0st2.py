import pl, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from concurrent.futures import ThreadPoolExecutor
base=Image.open("base_000_v2.png").convert("RGBA"); W,H=base.size
def poly(pts): m=Image.new("L",(W,H),0); ImageDraw.Draw(m).polygon(pts,255); return np.array(m)>0
old=np.array(Image.open("statue_tight.png"))>0
new=poly([(31,116),(36,116),(38,119),(38,124),(40,127),(41,134),(41,162),(43,165),(44,184),(45,186),(45,192),
          (23,192),(23,186),(25,184),(26,165),(29,163),(28,150),(28,128),(30,124),(30,119)])
m=ndimage.binary_dilation(old,iterations=2)&~new; m[186:,:]=False
Image.fromarray((m*255).astype(np.uint8)).save("d0st2_mask.png"); Image.fromarray((new*255).astype(np.uint8)).save("statue_tight2.png")
desc=("a lone stone statue standing in front of a low heap of charred burnt timber and ash at night, open dark night sky directly behind "
      "the statue's head and shoulders, nothing flat behind it, no wall, no slab, gritty muted pixel art")
def go(s): pl.inpaint(base,Image.fromarray((m*255).astype(np.uint8)).convert("RGB"),desc,seed=s,no_bg=True)[0].save(f"d0st2_s{s}.png")
with ThreadPoolExecutor(3) as ex: list(ex.map(go,[45,56,67]))
sheet=Image.new("RGBA",(4*50,90),(0,0,0,255))
for k,f in enumerate(["base_000_v2.png"]+[f"d0st2_s{s}.png" for s in (45,56,67)]):
    r=Image.open(f).convert("RGBA"); b=Image.new("RGBA",r.size,(24,26,40,255)); b.alpha_composite(r)
    sheet.paste(b.crop((10,106,60,196)),(k*50,0))
sheet.resize((sheet.width*4,360),Image.NEAREST).save("/tmp/d0st2.png")
