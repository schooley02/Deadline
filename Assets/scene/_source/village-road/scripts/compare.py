import random
import numpy as np
from PIL import Image, ImageDraw
import base as B, strip as S
def pl_surface(path, seed=9):
    a=np.array(Image.open(path).convert('RGBA'))[6:6+S.SH,:,:3].copy()      # the strip's rows in the 320x32 canvas
    rnd=random.Random(seed); out=a.copy()
    for x in range(24):                                                    # seam: dithered mirror of the right end, so the tile wraps
        for y in range(S.SH):
            if rnd.random()>x/24: out[y,x]=a[y,319-x]
    return out
def cut_light(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(int); bg=a[2,2,:3]
    d=np.abs(a[:,:,:3]-bg).sum(2); m=d>26; m[:,:26]=False
    ys,xs=np.nonzero(m); o=np.zeros_like(a); o[m]=a[m]; o[:,:,3]=np.where(m,255,0)
    im=Image.fromarray(o.astype(np.uint8),'RGBA').crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    return im.resize((im.width*2,im.height*2),Image.NEAREST)
code,_,_=S.code_strip()
A,_,_=S.code_strip(surface=pl_surface('pl/road2_5201_0.png'),line=False)
Bv,_,_=S.code_strip(surface=pl_surface('pl/road2_5202_0.png'),line=False)
Image.fromarray(A,'RGBA').save('road_strip_plA_320x18.png'); Image.fromarray(Bv,'RGBA').save('road_strip_plB_320x18.png')
pl_light=cut_light('pl/signs_5301_0.png'); pl_light.save('light_pl.png'); print('light',pl_light.size, S.light().size)
rows=[('1: code-drawn road and signs',code,None),('2: PixelLab road A (lighter, clear cracks and patches) + PixelLab traffic light',A,pl_light),('3: PixelLab road B (darker, subtle cracks) + PixelLab traffic light',Bv,pl_light)]
full=[];zoom=[]
for i,(t,st,li) in enumerate(rows):
    c=S.build(1366,480,368,st,None,lightspr=li).convert('RGB')
    f=c.crop((0,230,1366,480)); d=ImageDraw.Draw(f); d.rectangle([6,6,14+6.2*len(t),22],fill=(0,0,0)); d.text((10,8),t,fill=(255,255,255)); full.append(f)
    a=c.crop((330,290,640,420)).resize((620,260),Image.NEAREST); b=c.crop((1120,290,1366,420)).resize((492,260),Image.NEAREST)
    z=Image.new('RGB',(620+492+8,260),(40,40,40)); z.paste(a,(0,0)); z.paste(b,(628,0)); d=ImageDraw.Draw(z); d.rectangle([6,6,14+6.2*len(t),22],fill=(0,0,0)); d.text((10,8),t,fill=(255,255,255)); zoom.append(z)
def stack(ims,out):
    w,h=ims[0].size; s=Image.new('RGB',(w,(h+6)*len(ims)-6),(40,40,40))
    for i,im in enumerate(ims): s.paste(im,(0,i*(h+6)))
    s.save(out)
stack(full,'/mnt/user-data/outputs/road-C_code-vs-pixellab_laptop.png'); stack(zoom,'/mnt/user-data/outputs/road-C_code-vs-pixellab_zoom2x.png')
