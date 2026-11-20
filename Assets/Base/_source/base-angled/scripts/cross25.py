import pl, numpy as np
from PIL import Image, ImageFilter
from concurrent.futures import ThreadPoolExecutor
base=np.array(Image.open("base_025_v4_unlit.png"))
cl=np.array(Image.open("cross_layer.png")); cm=cl[...,3]>0
base[cm]=cl[cm]
Image.fromarray(base).save("base_025_v5_wip.png")
H,W=cm.shape
up=np.zeros_like(cm)
for d in range(1,8): up[:-d]|=cm[d:]              # band above the cross
up&=~cm
Image.fromarray((up*255).astype(np.uint8)).save("cross_fire_mask.png")
im=Image.fromarray(base)
desc=("a fallen wooden cross lying on stone church steps at night, small realistic orange flames licking along the top of the cross, "
      "the cross starting to catch fire, gritty muted pixel art")
def go(s): pl.inpaint(im,Image.fromarray((up*255).astype(np.uint8)).convert("RGB"),desc,seed=s,no_bg=True)[0].save(f"crossf_s{s}.png")
with ThreadPoolExecutor(3) as ex: list(ex.map(go,[3,9,17]))
sheet=Image.new("RGBA",(3*40,30),(0,0,0,255))
for k,s in enumerate([3,9,17]):
    r=Image.open(f"crossf_s{s}.png").convert("RGBA"); b=Image.new("RGBA",r.size,(24,26,40,255)); b.alpha_composite(r)
    sheet.paste(b.crop((126,166,166,196)),(k*40,0))
sheet.resize((sheet.width*7,210),Image.NEAREST).save("/tmp/crossf.png")
