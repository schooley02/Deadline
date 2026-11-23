import sys
sys.path.insert(0,'/home/claude/audit')
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import scene2_lib as S
# 1. remove the mirrored grass-tuft mark in the yard dirt (a tile-join artifact) by covering it with clean dirt from beside it
for n in ['base_yard_560x72','storm_base_yard_560x72']:
    a=np.array(Image.open(f'final/{n}.png').convert('RGBA'))
    src=a[36:72,120:192,:3][:, ::-1].copy(); a[36:72,220:292,:3]=src
    Image.fromarray(a,'RGBA').save(f'final/{n}.png')
def halve(p,out):
    a=np.array(Image.open(p).convert('RGBA')).astype(int); H,W=a.shape[:2]
    b=a.reshape(H//2,2,W//2,2,4).transpose(0,2,1,3,4).reshape(H//2,W//2,4,4)
    op=b[...,3]>127; n=op.sum(-1)
    mean=(b[...,:3]*op[...,None]).sum(2)/np.maximum(n,1)[...,None]
    d=((b[...,:3]-mean[:,:,None,:])**2).sum(-1)+(~op)*1e9
    idx=d.argmin(-1); pick=np.take_along_axis(b,idx[...,None,None],2)[:,:,0,:]
    pick[...,3]=np.where(n>=2,255,0); pick[n<2,:3]=0
    Image.fromarray(pick.astype('uint8'),'RGBA').save(out)
for s,d in [('lane_two_track_1280x72','lane_two_track_strip_640x36'),('storm_lane_two_track_1280x72','storm_lane_two_track_strip_640x36'),
            ('base_yard_560x72','base_yard_strip_280x36'),('storm_base_yard_560x72','storm_base_yard_strip_280x36')]: halve(f'final/{s}.png',f'final/{d}.png')
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
def band(W,bw,pre):
    strip=Image.open(f'final/{pre}lane_two_track_1280x72.png').convert('RGBA'); y=Image.open(f'final/{pre}base_yard_560x72.png').convert('RGBA')
    sx=int(.15*W); b=Image.new('RGBA',(W,72),(0,0,0,0)); x=-sx
    while x<W:
        b.alpha_composite(strip.crop((max(0,-x),0,1280,72)),(max(0,x),0)); x+=1280
    yx=bw+176-560; b.alpha_composite(y.crop((max(0,-yx),0,560,72)),(max(0,yx),0)); return b
def out(name,W,H,bw,pre,lab,sc,bare=False):
    b=band(W,bw,pre); im=S.scene(W,H,bw,b,88,False,shadows=True,sx=0)
    extra=(72*sc+40) if bare else 0
    sh=Image.new('RGB',(W*sc,H*sc+40+extra),(20,20,30)); d=ImageDraw.Draw(sh); d.text((10,8),lab,font=f,fill=(255,255,255))
    sh.paste(im.resize((W*sc,H*sc),Image.NEAREST).convert('RGB'),(0,40))
    if bare:
        lo=Image.new('RGBA',(W,72),(40,36,70,255)); lo.alpha_composite(b)
        d.text((10,H*sc+48),'The same ground with nothing standing on it',font=f,fill=(255,255,255)); sh.paste(lo.resize((W*sc,72*sc),Image.NEAREST).convert('RGB'),(0,H*sc+80))
    sh.save(f'out/{name}.png')
out('final_preview_phone_800x306',800,306,188,'','Dry ground, phone landscape (800 x 306)',2,bare=True)
out('final_preview_laptop_1366x400',1366,400,368,'','Dry ground, laptop (1366 x 400), whole church showing',1)
out('storm_preview_phone_800x306',800,306,188,'storm_','Storm ground, phone landscape (storm sky and rain not shown)',2,bare=True)
for n in sorted(__import__('os').listdir('final')):
    if n.endswith('.png'): print(n, Image.open('final/'+n).size)
