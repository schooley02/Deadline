from PIL import Image
import numpy as np
from scipy import ndimage
im=np.array(Image.open("base_000_v2_wip.png").convert("RGBA")).astype(float)
H,W=im.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
rng=np.random.default_rng(7)
r,g,b,a=[im[...,i] for i in range(4)]; lum=im[...,:3].mean(-1)
statue=np.array(Image.open("statue_tight.png"))>0
# --- the cross: charred wood
box=(xx>=128)&(xx<=164)&(yy>=172)&(yy<=196)&(a>0)
cross=box&(r>b+12)&(lum>35)&(lum<140)&~((r>170)&(g>70))           # brownish wood, not the ember dots
cross=ndimage.binary_opening(cross,iterations=0) if False else cross
c=im[...,:3][cross]; L=c.mean(-1,keepdims=True)
n=rng.random(len(c))[:,None]
char=np.array([50,41,37.])*(0.8+0.5*(L/120))+ (n>0.8)*np.array([22,20,20.])        # black char, some grey ash flecks
im[...,:3][cross]=char
edge=cross&~ndimage.binary_erosion(cross)
topedge=cross&~np.roll(cross,1,0)                                                       # upper edges catch ash/moonlight
im[topedge,:3]=[92,82,76]
ring=ndimage.binary_dilation(cross)&~cross&box
im[ring,:3]=im[ring,:3]*.45                                                             # dark outline so the shape reads
cracks=cross&~edge&(rng.random((H,W))<0.07)
im[cracks,:3]=[150,52,22]                                                               # a few dying ember cracks
# --- sandbags: dirty the light tops
bags=(yy>=158)&(a>0)&~statue&~box&(lum>62)&~((r>170)&(g<110)&(lum>110))
k=np.clip((lum-55)/60,0,1)*(0.6+0.25*rng.random((H,W)))
mud=np.array([62,52,42.])
im[...,:3][bags]=im[...,:3][bags]*(1-k[bags,None])+mud*k[bags,None]
Image.fromarray(im.clip(0,255).astype(np.uint8)).save("base_000_v2.png")
for f,o in [("base_000_v2_wip.png","/tmp/a.png"),("base_000_v2.png","/tmp/b.png")]:
    x=Image.open(f); bb=Image.new("RGBA",x.size,(24,26,40,255)); bb.alpha_composite(x); bb.save(o)
s=Image.new("RGBA",(184,2*50+4),(0,0,0,255))
s.paste(Image.open("/tmp/a.png").crop((0,150,184,200)),(0,0)); s.paste(Image.open("/tmp/b.png").crop((0,150,184,200)),(0,54))
s.resize((184*4,104*4),Image.NEAREST).save("/tmp/fin.png")
print(cross.sum(),bags.sum())
