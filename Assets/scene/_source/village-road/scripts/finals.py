"""Road C finals (Jeremy 2026-11-26: "i like c", lighter road A, then "I like Y": pad half lighter, road half darker so they meet)."""
import random, numpy as np
from PIL import Image, ImageDraw
import base as B, strip as S, compare as C
def surface(path, seed=9):
    a=np.array(Image.open(path).convert('RGBA'))[6:6+S.SH,:,:3].copy()
    a[:,318:]=a[:,317:318]; a[:,:2]=a[:,2:3]                 # PixelLab darkens its outermost columns: drop them
    rnd=random.Random(seed); out=a.copy()
    for x in range(24):
        for y in range(S.SH):
            if rnd.random()>x/24: out[y,x]=a[y,319-x]
    return out
code=C.code
A,_,_=S.code_strip(surface=surface('pl/road2_5201_0.png'),line=False)
m=(code[:,:,3]==255)&(A[:,:,3]==255); m[:S.TOPM+2]=False; m[S.TOPM+S.BODY-2:]=False
delta=A[:,:,:3][m].astype(float).mean(0)-code[:,:,:3][m].astype(float).mean(0)
def shift(arr,k):
    a=arr.astype(float).copy(); rgb=a[:,:,:3]
    grass=(rgb[:,:,1]>rgb[:,:,0]+3)&(rgb[:,:,1]>rgb[:,:,2]); gravel=(rgb[:,:,2]-rgb[:,:,0]<5)
    asph=(a[:,:,3]>0)&~grass&~gravel
    rgb[asph]=np.clip(np.round(rgb[asph]+delta*k),0,255); a[:,:,:3]=rgb
    return a.astype(np.uint8)
PAD0=np.array(B.img('scene/village-pad.png'))
pad=shift(PAD0,0.5); road=shift(A,-0.5)
Image.fromarray(pad,'RGBA').save('final_village-pad_356x46.png'); Image.fromarray(road,'RGBA').save('final_village-road_320x18.png')
print('delta',delta.round(1),'pad alpha same',bool((pad[:,:,3]==PAD0[:,:,3]).all()), 'pad changed px',int((pad[:,:,:3]!=PAD0[:,:,:3]).any(2).sum()), 'of', int((PAD0[:,:,3]>0).sum()))
padim=Image.fromarray(pad,'RGBA'); orig=B.img
B.img=lambda p: padim if p=='scene/village-pad.png' else orig(p)
outs=[]
for (W,H,bw,t) in [(1366,480,368,'laptop 1366x480'),(1920,640,368,'desktop 1920x640')]:
    c=S.build(W,H,bw,road,None,lightspr=C.pl_light).convert('RGB'); c.save(f'final_scene_{W}.png')
c=Image.open('final_scene_1366.png'); z=c.crop((330,280,1366,420)).resize((2072,280),Image.NEAREST)
z.crop((0,0,1036,280)).save('final_zoomL.png'); z.crop((1036,0,2072,280)).save('final_zoomR.png')
f1=Image.open('final_scene_1366.png').crop((0,200,1366,480)); f2=Image.open('final_scene_1920.png').crop((277,360,1643,640))
s=Image.new('RGB',(1366,280*2+6),(40,40,40)); s.paste(f1,(0,0)); s.paste(f2,(0,286))
d=ImageDraw.Draw(s)
for y,t in ((0,'Laptop 1366x480'),(286,'Desktop 1920x640 (middle 1366 px)')): d.rectangle([6,y+6,14+6.2*len(t),y+22],fill=(0,0,0)); d.text((10,y+8),t,fill=(255,255,255))
s.save('/mnt/user-data/outputs/road-C_final-Y.png')
