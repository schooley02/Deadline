import pl, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from concurrent.futures import ThreadPoolExecutor
base=Image.open("base_000_v4.png").convert("RGBA"); W,H=base.size
S=np.array(Image.open("statue_exact2.png"))>0
S=ndimage.binary_closing(S,structure=ndimage.generate_binary_structure(2,1))
Image.fromarray((S*255).astype(np.uint8)).save("statue_exact3.png")
m=Image.new("L",(W,H),0); ImageDraw.Draw(m).rectangle((16,104,51,185),255)
desc=("a low heap of charred black burnt timbers, broken roof shingles and grey ash from a church burned to the ground at night, "
      "dark night sky above the pile, no wall, no slab, no statue, gritty muted pixel art")
src=np.array(Image.open("base025_noflame_st.png").convert("RGBA")).astype(float)
# statue sprite: sooted stone, lifted to cool moonlit grey (brightest at head)
spr=src.copy(); rgb=spr[...,:3]; lum=rgb.mean(-1,keepdims=True)
yy=np.mgrid[0:H,0:W][0]; top=np.clip((yy-116)/75,0,1)[...,None]
new=np.clip(rgb*1.55+(lum/255)*np.array([150,156,172.])*0.35+6,0,255)
spr[...,:3]=rgb+(new-rgb)*(1-0.45*top)
def go(s):
    r=np.array(pl.inpaint(base,m.convert("RGB"),desc,seed=s,no_bg=True)[0].convert("RGBA")).astype(float)
    np.save(f"d0bg_s{s}.npy",r)
    r[S]=spr[S]; Image.fromarray(r.clip(0,255).astype(np.uint8)).save(f"d0v5_s{s}.png")
seeds=[14,27,39]
with ThreadPoolExecutor(3) as ex: list(ex.map(go,seeds))
sheet=Image.new("RGBA",(6*56,96),(0,0,0,255))
for k,s in enumerate(seeds):
    bgim=Image.fromarray(np.load(f"d0bg_s{s}.npy").astype(np.uint8))
    for j,r in enumerate((bgim,Image.open(f"d0v5_s{s}.png"))):
        b=Image.new("RGBA",r.size,(24,26,40,255)); b.alpha_composite(r); sheet.paste(b.crop((6,102,62,198)),((k*2+j)*56,0))
sheet.resize((sheet.width*4,384),Image.NEAREST).save("/tmp/v5.png")
