import sys, json, subprocess, random
sys.path.insert(0,'/home/claude/audit')
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import mock, scene2_lib as S
P='/mnt/user-data/uploads/Deadline'; img=mock.img
def lum(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
def tone(band, k, cool=True):
    a=np.array(band).astype(float); L=lum(a)
    w=np.clip((L-70)/60.0,0,1)                      # only the pale gravel is pulled down
    f=1-k*w
    a[...,0]*=f*(0.96 if cool else 1); a[...,1]*=f; a[...,2]*=f*(1.04 if cool else 1)
    return Image.fromarray(np.clip(a,0,255).astype('uint8'),'RGBA')
def yard_band(W=1280):
    src=Image.open('pl_out/yard_s301_0.png').convert('RGBA')
    d=src.crop((0,78,256,128)); ext=d.crop((0,36,256,50)).transpose(Image.FLIP_TOP_BOTTOM)
    b=Image.new('RGBA',(256,72),(0,0,0,0)); b.alpha_composite(d,(0,8)); b.alpha_composite(ext,(0,58))
    t=Image.new('RGBA',(W,72),(0,0,0,0)); x=0; fl=False
    while x<W:
        t.alpha_composite(b.transpose(Image.FLIP_LEFT_RIGHT) if fl else b,(x,0)); x+=256; fl=not fl
    return t
def yard_tone(y, gain, rgb):
    a=np.array(y).astype(float); a[...,0]*=gain*rgb[0]; a[...,1]*=gain*rgb[1]; a[...,2]*=gain*rgb[2]
    return Image.fromarray(np.clip(a,0,255).astype('uint8'),'RGBA')
def merge(lane, yard, W, front_line, seed=5):
    random.seed(seed)
    out=lane.crop((0,0,W,72)).copy(); yp=yard.load(); op=out.load(); slope=88/40.0
    for y in range(9,72):
        e=(front_line-10)+(72-8-y)*slope
        for x in range(0,min(W,int(e)+30)):
            p=(e+22-x)/44.0                          # gravel and grass thin out into the dirt over ~44px
            if p>=1 or random.random()<p*p: op[x,y]=yp[x,y]
    return out
if __name__=='__main__':
    W,H,bw=800,306,188
    lane0=S.pl_band('twotrack_s701_0'); yard0=yard_band()
    zs=[np.array(img(f'Zombies/{c}-zombie.png')).astype(float) for c in mock.FEET]
    zl=np.concatenate([lum(z)[z[...,3]>40] for z in zs])
    def stat(b,box):
        a=np.array(b.crop(box)).astype(float); return round(float(lum(a).mean()))
    print('zombie luminance: mean %d, 25th %d, 75th %d'%(zl.mean(),np.percentile(zl,25),np.percentile(zl,75)))
    variants=[('as drafted',0.0,1.0),('gravel 20% darker, cooler',0.20,1.0),('gravel 35% darker, cooler',0.35,0.92)]
    rows=[]
    for name,k,yg in variants:
        lane=tone(lane0,k,cool=k>0); yard=yard_tone(yard0,yg,(0.97,1.0,1.06) if k>0 else (1,1,1))
        print(name,'| gravel track',stat(lane,(0,16,256,30)),'| grass strip',stat(lane,(0,36,256,46)),'| yard dirt',stat(yard,(0,20,256,60)))
        band=merge(lane,yard,W,bw+40)
        rows.append((S.scene(W,H,bw,band,88,False,shadows=(k>0)),name))
    f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
    labs=['1  As drafted: pale gravel, dirt yard at the church','2  Gravel 20% darker and cooler, ground shadows under the zombies','3  Gravel 35% darker and cooler, dirt slightly darker, ground shadows']
    sh=Image.new('RGB',(W*2,(H*2+40)*3),(20,20,30)); d=ImageDraw.Draw(sh)
    for i,(im,_) in enumerate(rows):
        y=i*(H*2+40); d.text((10,y+8),labs[i],font=f,fill=(255,255,255)); sh.paste(im.resize((W*2,H*2),Image.NEAREST).convert('RGB'),(0,y+40))
    sh.save('out/twotrack_with_yard_tones.png'); print(sh.size)
