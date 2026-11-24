from PIL import Image, ImageDraw
import math, sys
STRIP = '--strip' in sys.argv
OUTNAME = 't5/clock_t5_strip.png' if STRIP else 't5/clock_t5_draft_112x208.png'
D='/mnt/user-data/uploads/Deadline/Assets/Village/'
im=Image.open('t4/clock_t4_noglow.png').convert('RGBA'); px=im.load(); d=ImageDraw.Draw(im)
px[86,186]=(0,0,0,0)                                   # Jeremy's T4 touch-up
O=(14,12,16,255); W,H=im.size
# ---------- 1. standing-seam metal roof (same shape as the slate one)
AP=(59,5); CL=(48,28); CR=(85,28)
hip=lambda y: AP[0]+(CL[0]-AP[0])*(y-AP[1])/(CL[1]-AP[1])
side_out=lambda x: 29+int(round(0.66*(48-x)))
F1=(118,124,122,255); F2=(104,110,111,255); FS=(60,66,68,255); S1=(60,66,68,255); S2=(50,55,58,255); SS=(30,33,37,255)
front_ends=[48+i*37/7 for i in range(8)]
side_ends=[(x,28+0.66*(48-x)) for x in (30,34,38,42,46)]
roof=set()
for y in range(4,42):
    for x in range(24,90):
        if px[x,y][3]<=20: continue
        if y<=28 and x>=hip(y): roof.add((x,y,'f'))
        elif x<hip(min(y,28)) and x<48 and y<side_out(x): roof.add((x,y,'s'))
for (x,y,f) in roof:
    if f=='f':
        t=(y-AP[1])/(CR[1]-AP[1]); seam=False; panel=0
        for k,ex in enumerate(front_ends):
            sx=AP[0]+(ex-AP[0])*t
            if t>0.3 and int(round(sx))==x: seam=True
            if x>sx: panel=k
        c=FS if seam else (F1 if panel%2==0 else F2)
        if y>=27: c=tuple(int(v*0.85) for v in c[:3])+(255,)
    else:
        seam=False; panel=0
        for k,(ex,ey) in enumerate(side_ends):
            t=(y-AP[1])/(ey-AP[1])
            sx=AP[0]+(ex-AP[0])*t
            if 0.3<t<=1.05 and int(round(sx))==x: seam=True
            if x>sx: panel=k
        c=SS if seam else (S1 if panel%2==0 else S2)
    px[x,y]=c
for (x,y,f) in roof:                                    # keep a dark outline on the roof's outer edge
    if any(not(0<=x+dx<W) or px[x+dx,y+dy][3]<=20 for dx,dy in ((-1,0),(1,0),(0,-1))): px[x,y]=O
# ---------- 2. light strip under the eave (front run level, side run sloping), like Jeremy's reference photo
LIT=(255,228,164,255); eave=[]
if STRIP:
    for x in range(49,86): px[x,31]=LIT; eave.append((x,31))
    for x in range(30,48):
        y=side_out(x)+1
        if px[x,y][3]>20: px[x,y]=(232,200,138,255); eave.append((x,y))
# ---------- 3. bell in the RIGHT belfry opening: louvres out, lit inside, bronze bell on a wooden headstock
for y in range(37,50):
    for x in range(67,75):
        if px[x,y][:3]!=(25,23,27):
            k=max(0,1-((x-70.5)**2/30+(y-41)**2/60)); px[x,y]=(int(96+96*k),int(62+66*k),int(34+30*k),255)
for y in range(38,50): px[67,y]=(70,46,28,255)
for x in range(68,74): px[x,38]=(52,36,24,255); px[x,39]=(40,28,20,255)
BH=(206,160,78,255); BB=(128,92,40,255); BS=(84,58,26,255)
rows={40:(70,71),41:(69,72),42:(69,72),43:(68,73),44:(68,73),45:(68,73),46:(68,73),47:(67,74)}
for y,(a,b) in rows.items():
    for x in range(a,b+1): px[x,y]=BH if x==a+1 else (BS if x>=b-1 else BB)
    px[a,y]=BS
px[70,48]=(30,22,16,255); px[71,48]=(30,22,16,255)
for x in range(67,75): px[x,50]=(25,23,27,255)
# ---------- 4. survivor flag: the High school's T5 flag shrunk to 70% with PixelLab resize (the tower stands further back)
sch=Image.open(D+'heroes_t5.png').convert('RGBA')
fl=Image.open('flag/flag_r1.png').convert('RGBA'); fl=fl.crop(fl.getbbox()); fp=fl.load()
POLE_X=80; FY=2
for y in range(fl.height):
    for x in range(fl.width):
        p=fp[x,y]
        if p[3]>120: px[POLE_X+1+x,FY+y]=p[:3]+(255,)
for y in range(1,29):
    if px[POLE_X,y][3]<=20: px[POLE_X,y]=(96,98,102,255) if y>1 else (150,128,80,255)
# ---------- 5. razor wire ring under the clock, sitting on the clock stage's lower ledge (the High school's wire)
wire=sch.crop((122,46,159,52)); wp=wire.load(); ww=wire.width
def wpx(i,j):
    p=wp[i%ww,j]; return p if (p[3]>200 and abs(p[0]-p[2])<30 and sum(p[:3])>150) else None
for x in range(28,88):
    off=int(round(0.43*(48-x))) if x<48 else 0
    for j in range(6):
        p=wpx(x,j); y=87+j+off
        if p and px[x,y][3]>20: px[x,y]=p
# ---------- 6. floodlight on the front-left corner, tucked under the clock stage's lower ledge, aimed down the walls
FX,FY0=46,100
d.rectangle([FX-3,FY0,FX+3,FY0+3],fill=(58,62,70,255)); d.rectangle([FX-4,FY0-1,FX+4,FY0+4],outline=O)
d.line([FX-3,FY0,FX+3,FY0],fill=(92,96,104,255))
d.rectangle([FX-2,FY0+4,FX+2,FY0+5],fill=(250,248,232,255)); px[FX-3,FY0+5]=O; px[FX+3,FY0+5]=O
d.line([FX,FY0-3,FX,FY0-2],fill=O); d.line([FX+1,FY0-3,FX+1,FY0-2],fill=O)        # bracket up to the ledge
im.save('t5/clock_t5_noglow.png')
# ---------- glow pass (fixtures only)
def glow(cx,cy,R,col,k0,cone=None,opaque_only=False,skip=()):
    for y in range(max(0,cy-R),min(H,cy+R+1)):
        for x in range(max(0,cx-R),min(W,cx+R+1)):
            dx,dy=x-cx,y-cy; dd=math.hypot(dx,dy)
            if dd>R: continue
            k=k0*(1-dd/R)**1.5
            if cone:
                al_=(dx+dy)/math.sqrt(2); pe=(dy-dx)/math.sqrt(2)
                if al_<1: continue
                half=1+al_*cone
                if abs(pe)>half: continue
                k*=(1-(abs(pe)/half)**2)
            p=px[x,y]
            if p[:3] in skip: continue
            if opaque_only and p[3]<=20: continue
            if p[3]>20:
                a=min(0.6,k); px[x,y]=tuple(int(p[i]+(col[i]-p[i])*a) for i in range(3))+(255,)
            else:
                al=int(min(150,255*k*0.9))
                if al>=7: px[x,y]=col+(al,)
for x in (37,94):
    glow(x+1,171,22,(255,214,150),0.55,opaque_only=True); glow(x+1,171,8,(255,214,150),0.55)
glow(85,53,26,(240,246,255),0.7,cone=0.35)
# floodlight: cool wash down the corner (walls only), small bloom at the lens
cy0=FY0+6
for y in range(cy0,cy0+62):
    half=3+(y-cy0)*0.34; fall=(1-(y-cy0)/62)**1.3
    for x in range(int(FX-half)-1,int(FX+half)+2):
        if not (0<=x<W): continue
        dxn=abs(x-FX)/half
        if dxn>1: continue
        p=px[x,y]
        if p[3]<=20: continue
        k=0.46*fall*(1-dxn**2)
        px[x,y]=tuple(int(p[i]+((240,246,255)[i]-p[i])*k) for i in range(3))+(255,)
glow(FX,FY0+5,5,(240,246,255),0.5)
FACE={(252,245,161):(255,253,224),(222,212,140):(250,243,186),(217,210,144):(248,241,190),(196,186,122):(236,226,162)}
for y in range(60,94):
    for x in range(30,82):
        if px[x,y][:3] in FACE: px[x,y]=FACE[px[x,y][:3]]+(255,)
glow(66,76,20,(255,244,190),0.30,opaque_only=True,skip=set(FACE.values()))
glow(39,79,12,(255,244,190),0.20,opaque_only=True,skip=set(FACE.values()))
# eave strip: warm wash on the belfry wall below and the roof edge above, small halo past the eave ends
base=im.copy(); bp=base.load(); lit={}
for (ex,ey) in eave:
    for dy in range(-3,7):
        for dx in (-1,0,1):
            x,y=ex+dx,ey+dy
            if (x,y) in eave or not(0<=x<W and 0<=y<H): continue
            k=(0.34 if dy>0 else 0.22)*(1-abs(dy)/7)*(1 if dx==0 else 0.5)
            lit[(x,y)]=max(lit.get((x,y),0),k)
for (x,y),k in lit.items():
    p=bp[x,y]
    if p[3]>20 and p[:3]!=LIT[:3]: px[x,y]=tuple(int(p[i]+((255,214,150)[i]-p[i])*k) for i in range(3))+(255,)
if STRIP:
    glow(86,31,5,(255,214,150),0.5); glow(29,side_out(30)+1,4,(255,214,150),0.35)
im.save(OUTNAME)
