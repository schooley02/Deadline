import numpy as np
from PIL import Image, ImageDraw
import base as B, strip as S, compare as C   # compare builds code / A / Bv strips on import
code,A=C.code,C.A
m=(code[:,:,3]==255)&(A[:,:,3]==255)
inner=m.copy(); inner[:S.TOPM+2]=False; inner[S.TOPM+S.BODY-2:]=False
delta=A[:,:,:3][inner].astype(float).mean(0)-code[:,:,:3][inner].astype(float).mean(0)
print('delta',delta.round(1), 'pad mean',code[:,:,:3][inner].mean(0).round(1),'A mean',A[:,:,:3][inner].mean(0).round(1))
PAD0=B.img('scene/village-pad.png')
def shift(im_arr,k):
    a=im_arr.astype(float).copy(); rgb=a[:,:,:3]
    grass=(rgb[:,:,1]>rgb[:,:,0]+3)&(rgb[:,:,1]>rgb[:,:,2])            # leave the weeds and grass tufts alone
    asph=(a[:,:,3]>0)&~grass
    rgb[asph]=np.clip(rgb[asph]+delta*k,0,255); a[:,:,:3]=rgb
    return a.astype(np.uint8)
orig_img=B.img
def run(k_pad,k_road,label):
    pad=Image.fromarray(shift(np.array(PAD0),k_pad),'RGBA')
    B.img=lambda p: pad if p=='scene/village-pad.png' else orig_img(p)
    st=shift(A,-k_road) if k_road else A
    c=S.build(1366,480,368,st,None,lightspr=C.pl_light).convert('RGB'); B.img=orig_img
    return c,pad,st
rows=[(0,0,'Now: lighter road (option 2), village asphalt as it is today'),(1,0,'X: village asphalt lightened all the way to match the road'),(0.5,0.5,'Y: meet in the middle (asphalt half lighter, road half darker)')]
full=[];zoom=[]
for kp,kr,t in rows:
    c,pad,st=run(kp,kr,t)
    if kp==1: pad.save('pad_light_full.png')
    if kp==0.5: pad.save('pad_light_half.png'); Image.fromarray(st,'RGBA').save('road_strip_plA_half.png')
    f=c.crop((0,230,1366,480)); d=ImageDraw.Draw(f); d.rectangle([6,6,14+6.2*len(t),22],fill=(0,0,0)); d.text((10,8),t,fill=(255,255,255)); full.append(f)
    z=c.crop((440,280,1300,420)).resize((1720,280),Image.NEAREST); d=ImageDraw.Draw(z); d.rectangle([6,6,14+6.2*len(t),22],fill=(0,0,0)); d.text((10,8),t,fill=(255,255,255)); zoom.append(z)
C.stack(full,'/mnt/user-data/outputs/road-C_lighter-asphalt_laptop.png'); C.stack(zoom,'/mnt/user-data/outputs/road-C_lighter-asphalt_zoom2x.png')
