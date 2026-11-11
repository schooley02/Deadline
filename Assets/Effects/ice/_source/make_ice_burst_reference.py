import math, json
from PIL import Image, ImageDraw
import colorsys
exec('def tint'+open('mock2.py').read().split('def tint')[1].split('BG=')[0])
W=H=128; FEET=118; CX=64
OUT=(7,19,49,255); FILL=(165,222,230,255); MID=(104,151,183,255); HI=(214,243,255,255); WH=(255,255,255,255); FR=(196,232,250,255); FR2=(116,167,194,255)
def shard(d, bx, by, ang, length, w):
    a=math.radians(ang); ux,uy=math.cos(a),-math.sin(a); px,py=-uy,ux
    tip=(bx+ux*length, by+uy*length)
    l=(bx+px*w/2, by+py*w/2); r=(bx-px*w/2, by-py*w/2)
    sl=(bx+px*w*0.45+ux*length*0.7, by+py*w*0.45+uy*length*0.7)
    sr=(bx-px*w*0.4+ux*length*0.65, by-py*w*0.4+uy*length*0.65)
    poly=[l,sl,tip,sr,r]
    d.polygon(poly,fill=FILL,outline=OUT)
    # shaded lower/right face: triangle from midline to right edge
    mid=(bx+ux*length*0.05, by+uy*length*0.05)
    d.polygon([mid,tip,sr,r],fill=MID,outline=OUT)
    d.line([l,sl,tip],fill=HI)  # lit upper-left edge (moonlight / blast flash from the left)
    d.point((round(tip[0]),round(tip[1])),fill=WH)
def burst(cracked=False):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    # frost splash on ground, heavier on the left (impact side)
    d.ellipse((CX-44,FEET-5,CX+30,FEET+6),fill=FR2); d.ellipse((CX-36,FEET-3,CX+18,FEET+3),fill=FR)
    # shards rooted along the ground, angled up-right; back ones longer, impact point low-left
    S=[(-30,FEET,58,34,9),(-18,FEET,52,50,12),(-4,FEET-2,48,62,15),(12,FEET,44,52,13),(26,FEET,38,36,10),
       (-38,FEET,30,18,7),(-24,FEET-4,70,26,8),(4,FEET,62,28,9),(34,FEET,28,22,7),(-10,FEET,40,30,10)]
    for bx,by,ang,L,w in S: shard(d,CX+bx,by,ang,L,w)
    # flying chips up-right
    for (x,y) in [(CX+38,60),(CX+46,70),(CX+30,48),(CX+50,82),(CX+22,40)]:
        d.rectangle((x,y,x+1,y+1),fill=HI); d.point((x-1,y+2),fill=FILL)
    return im
b=burst(); b.save('burst_ref.png')
c=b.crop(b.getbbox()); print('bbox',b.getbbox())
# preview on 3 zombies, solid
zs=[]
for z in ['career','spirituality','other']:
    j=json.load(open(f'/mnt/user-data/uploads/Deadline/Assets/Zombies/anim/{z}.json'))
    zs.append((z,tint(Image.open(f'{z}_atk0.png')),j['frameWidth'],j['feetY']))
    zs.append((z,tint(Image.open(f'{z}_atk4.png')),j['frameWidth'],j['feetY']))
T=172; BG=(28,30,40,255)
def tile(ov,z):
    name,fr,s,fy=z
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr); cv.alpha_composite(ov,(s//2-64,fy-FEET))
    out=Image.new('RGBA',(T,T),BG)
    if s>=T: out.alpha_composite(cv.crop(((s-T)//2,(s-T)//2,(s-T)//2+T,(s-T)//2+T)))
    else: out.alpha_composite(cv,((T-s)//2,(T-s)//2))
    return out
g=Image.new('RGBA',(3*T,2*T),BG)
for i,z in enumerate(zs): g.paste(tile(b,z),((i//2)*T,(i%2)*T))
g.resize((g.width*2,g.height*2),Image.NEAREST).save('burst_preview.png')
bg=Image.new('RGBA',(128,128),(40,44,56,255)); bg.alpha_composite(b); bg.resize((512,512),Image.NEAREST).save('burst_ref_4x.png')
