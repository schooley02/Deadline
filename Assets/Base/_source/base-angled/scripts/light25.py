from PIL import Image, ImageFilter
import numpy as np
out=np.array(Image.open("base_025_v3_unlit.png").convert("RGBA")).astype(float)
bel=np.array(Image.open("bel25_s5.png").convert("RGBA")).astype(float)
bm=np.array(Image.open("fire25_belfry_mask.png"))>127
out[bm]=bel[bm]
Image.fromarray(out.astype(np.uint8)).save("base_025_v3b_unlit.png")
r,g,b,a=[out[...,i] for i in range(4)]
fire=(a>0)&(r>170)&(r-b>90)&(g>50)
F=Image.fromarray((fire*255).astype(np.uint8))
def bl(rad): return np.array(F.filter(ImageFilter.GaussianBlur(rad))).astype(float)/255
L=np.clip(bl(30)*5.0+bl(12)*2.0+bl(4)*0.8,0,1)
H,W=fire.shape
lit=out.copy(); rgb=lit[...,:3]/255
# multiply-warm the surfaces then screen the glow on top
warm=np.array([1.25,1.0,.78])
k=L[...,None]*(~fire)[...,None]
rgb=np.clip(rgb*(1+(warm-1)*k),0,1)
c=np.array([255,128,50.])/255
rgb=1-(1-rgb)*(1-c*k*0.7)
# far side falls darker for drama
rgb=rgb*(0.82+0.18*np.clip(L*3,0,1))[...,None]
lit[...,:3]=rgb*255
Image.fromarray(lit.clip(0,255).astype(np.uint8)).save("base_025_v3_lit.png")
bg=Image.new("RGBA",(W,H),(24,26,40,255)); bg.alpha_composite(Image.open("base_025_v3_lit.png"))
bg.resize((W*4,H*4),Image.NEAREST).save("/tmp/v3.png")
