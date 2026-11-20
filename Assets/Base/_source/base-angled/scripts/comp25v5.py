from PIL import Image, ImageFilter
import numpy as np
L_=lambda f:np.array(Image.open(f).convert("RGBA")).astype(float)
out=L_("base_025_v4_wip.png")
H,W=out.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
farm=np.array(Image.open("fire25_far_mask.png"))>127
doorm=np.array(Image.open("fire25_door_mask.png"))>127
def isfire(p): r,g,b,a=[p[...,i] for i in range(4)]; return (a>0)&(r>150)&(r-b>80)&(g>40)
s63,s52,d28=L_("f25far_s63.png"),L_("f25far_s52.png"),L_("f25door_s28.png")
far_src=np.where((xx<100)[...,None],s63,s52)
fsel=farm&isfire(far_src)
out[fsel]=far_src[fsel]
out[doorm]=d28[doorm]
cl=L_("cross_layer.png"); cm=cl[...,3]>0; out[cm]=cl[cm]                  # the cross, intact, on top
cf=L_("crossf_s17.png"); cfm=(np.array(Image.open("cross_fire_mask.png"))>127)&isfire(cf)&~cm
out[cfm]=cf[cfm]                                                          # small flames licking along it
ring=np.zeros_like(cm)
for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)): ring|=np.roll(np.roll(cm,dy,0),dx,1)
ring&=~cm&~cfm
out[ring,:3]=out[ring,:3]*.35+np.array([22,16,14])*.65                     # charred edge so the shape reads
CROSS=cm|ring
Image.fromarray(out.astype(np.uint8)).save("base_025_v5_unlit.png")
fire=isfire(out)
farfire=fire&farm; front=fire&~farm
def blur(m,r): return np.array(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(float)/255
L=blur(front,30)*5+blur(front,12)*2+blur(front,4)*.8
L+=blur(farfire,3)*1.2+blur(farfire,7)*0.5          # far-side fire: rim light on the roof edge and right wall only
doorfire=front&doorm|(front&(xx>=117)&(xx<=146)&(yy>=100)&(yy<=182))
L+=blur(doorfire,20)*2.2+blur(doorfire,7)*1.0         # strong warm pool around the doorway, like 50%
L=np.clip(L,0,1)
lit=out.copy(); rgb=lit[...,:3]/255
lum=out[...,:3].mean(-1)
interior=(xx>=125)&(xx<=138)&(yy>=100)&(yy<=170)&(lum<70)&~fire       # only the dark depths of the doorway
fac=1-0.75*blur(interior,1.2)
k=(L*(~fire)*fac*np.where(CROSS,0.45,1.0))[...,None]
warm=np.array([1.25,1.0,.78]); rgb=np.clip(rgb*(1+(warm-1)*k),0,1)
c=np.array([255,128,50.])/255; rgb=1-(1-rgb)*(1-c*k*0.6)
rgb=rgb*(0.78+0.22*np.clip(L*3,0,1))[...,None]
lit[...,:3]=rgb*255
Image.fromarray(lit.clip(0,255).astype(np.uint8)).save("base_025_v5_lit.png")
bg=Image.new("RGBA",(W,H),(24,26,40,255)); bg.alpha_composite(Image.open("base_025_v5_lit.png"))
bg.resize((W*4,H*4),Image.NEAREST).save("/tmp/v4.png")
