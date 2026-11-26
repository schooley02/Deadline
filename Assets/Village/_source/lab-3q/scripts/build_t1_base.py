import sys; sys.path.insert(0,'/home/claude/lib')
import colorsys, math
from PIL import Image, ImageDraw
from lab_fx import lum
A=Image.open('lab_t2_final_noglow_160x160.png').convert('RGBA')              # star 2 final (Jeremy's touch-up), art only
B=Image.open('lab_t3_final_v3_noglow_160x160.png').convert('RGBA').load()     # star 3 art before shine: source for what is under the star 2 repairs
H=Image.open('lab_t2_base_v21_noglow.png').convert('RGBA').load()
v=A.copy(); P=v.load()
fung=lambda p: p[3]>0 and p[1]>=p[0] and p[1]>p[2]+6 and lum(p)>95
warm=lambda p: p[3]==255 and p[0]>200 and p[1]>150 and p[2]<170
def dull(p,s=0.86,k=0.88):
    h,sa,va=colorsys.rgb_to_hsv(p[0]/255,p[1]/255,p[2]/255); r,g,b=colorsys.hsv_to_rgb(h,sa*s,va*k); return (int(r*255),int(g*255),int(b*255),255)
hh=lambda x,y,k=0: ((x*73856093)^(y*19349663)^(k*83492791))%100
# 1) no repairs: boards off the left upstairs window, scrap plate off the corner (what was underneath comes back, in star 2's duller tone)
for x in range(62,90):
    for y in range(46,70):
        if B[x,y][3]==255 and not fung(A.getpixel((x,y))): P[x,y]=B[x,y] if warm(B[x,y]) else dull(B[x,y])
for x in range(59,70):
    for y in range(107,124):
        if H[x,y][3]==255: P[x,y]=H[x,y] if fung(H[x,y]) else dull(H[x,y])
# 2) upstairs windows: no light, glass smashed, a few shards left in the frames
wins=[]
for (x0,x1) in ((62,90),(88,112)):
    g=[(x,y) for x in range(x0,x1) for y in range(46,70) if warm(B[x,y])]
    xs=[q[0] for q in g]; ys=[q[1] for q in g]; wins.append((min(xs),min(ys),max(xs),max(ys))); print('window glass',wins[-1],len(g))
for (gx0,gy0,gx1,gy1) in wins:
    for x in range(gx0,gx1+1):
        for y in range(gy0,gy1+1):
            if P[x,y][3]==255 and not fung(P[x,y]) and lum(P[x,y])>20: P[x,y]=(13,15,21,255)   # glass and the wooden cross both gone
# what glass is left upstairs, a different break in each window: left is almost empty (one tall shard and two corner pieces),
# right has lost its upper right half along one diagonal break
UP=([[(77,63),(80,63),(80,55),(78,59)],[(69,50),(73,50),(69,54)],[(69,63),(72,63),(69,61)]],
    [[(94,51),(99,51),(97,55),(100,58),(99,61),(105,62),(105,64),(94,64)]])
um=Image.new('L',(160,160),0); ud=ImageDraw.Draw(um)
for polys in UP:
    for pg in polys: ud.polygon(pg,fill=255)
UM=um.load()
for (gx0,gy0,gx1,gy1) in wins:
    for x in range(gx0,gx1+1):
        for y in range(gy0,gy1+1):
            if not UM[x,y] or fung(P[x,y]): continue
            edge=any(gx0<=x+dx<=gx1 and gy0<=y+dy<=gy1 and not UM[x+dx,y+dy] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
            n=(hh(x,5,5)%5)-2
            P[x,y]=((98,114,114,255) if hh(x,y,7)<60 else (66,80,82,255)) if edge else (42+n,50+n,52+n,255)
for (a,b) in (((97,55),(94,57)),((99,61),(96,64))):                               # two short cracks in the glass that is left on the right
    for t in range(3):
        x=a[0]+(b[0]-a[0])*t//2; y=a[1]+(b[1]-a[1])*t//2
        if UM[x,y]: P[x,y]=(88,104,104,255)
# 3) the ground-floor glass. Inside: an unlit room with both tanks drained (rebuilt from the star 3 room before any shine was painted on it).
#    The glass itself is so dirty you cannot see through it; you only see in where it has broken away.
BI=Image.open('lab_t3_final_v3_noglow_160x160.png').convert('RGBA'); R=BI.load()
liq=lambda p: p[1]>p[0]+12 and p[1]>p[2]+10
for (tx0,tx1) in ((77,90),(99,112)):                                              # no zombie, no patient: each tank is just its glass and stale liquid
    for x in range(tx0,tx1+1):
        top=R[x,101]
        for y in range(101,132):
            t=(y-101)/30; R[x,y]=(int(top[0]+(147-top[0])*t),int(top[1]+(196-top[1])*t),int(top[2]+(159-top[2])*t),255)
INT={}
for x in range(72,119):
    for y in range(96,138):
        p=R[x,y]; f=0.13
        INT[x,y]=dull(dull((int(p[0]*f*0.86),int(p[1]*f*0.96),int(p[2]*f*1.08),255)),0.88,0.90)
for tx in (79,101):                                                               # a faint edge of light down each tank so its shape reads in the dark
    for y in range(102,131):
        c=INT[tx,y]; INT[tx,y]=(c[0]+9,c[1]+13,c[2]+12,255)
# fungus has got inside too: a few caps at the back of the room, the only light in there. They sit where the breaks let you see them
# and are dimmer than the growth outside (further away, and under the glow pass's threshold so they do not light the wall outside).
ICAPS=((74,111,2.4),(73,116,1.6),(115,127,2.6),(112,131,1.6))            # only caps big enough to read as round; the tiny ones drew as plus signs
for (x,y),c in list(INT.items()):
    k=0.0
    for (cx,cy,r) in ICAPS:
        d=math.hypot(x-cx,y-cy); k+=max(0.0,1-d/13.0)**2*0.30
    k=min(0.42,k); m=1+3.2*k; INT[x,y]=(min(255,int(c[0]*m+26*k)),min(255,int(c[1]*m+86*k)),min(255,int(c[2]*m+40*k)),255)   # the light picks out what is there (tanks, wall) instead of washing over it
for (cx,cy,r) in ICAPS:
    for x in range(int(cx-r-1),int(cx+r+2)):
        for y in range(int(cy-r-1),int(cy+r+2)):
            if (x,y) not in INT: continue
            d=math.hypot(x-cx,y-cy)
            if d<=r: INT[x,y]=(98,130,94,255) if (x-cx)+(y-cy)<0 else (78,108,78,255)
            elif d<=r+0.9 and (x-cx)+(y-cy)>0: INT[x,y]=(16,26,18,255)
PANES=((72,96,94,137),(96,96,118,137))
HOLES=([(74,96),(91,96),(88,103),(93,109),(87,114),(90,122),(83,119),(80,128),(75,121),(72,125),(72,103)],      # left pane: the top two thirds gone, down from the top-left corner
       [(104,112),(109,106),(112,113),(118,110),(118,131),(113,127),(110,137),(105,130),(99,134),(101,124),(96,120),(102,117)])  # right pane: punched through low on the right, cracked above
hm=Image.new('L',(160,160),0); hd=ImageDraw.Draw(hm)
for h in HOLES: hd.polygon(h,fill=255)
HM=hm.load()
inpane=lambda x,y: any(x0<=x<=x1 and y0<=y<=y1 for (x0,y0,x1,y1) in PANES)
for (x0,y0,x1,y1) in PANES:
    for x in range(x0,x1+1):
        for y in range(y0,y1+1):
            i_=INT[x,y]
            if HM[x,y]:
                P[x,y]=i_      # open: the dark room and its tanks
            else:
                n=((hh(x,3,5)%7)-3)+(2 if hh(x,y,6)<12 else 0)+int((y-y0)/14)                                  # grime: streaks down the glass, heavier low
                g=(40+n,47+n,46+n)
                P[x,y]=(int(g[0]*0.90+i_[0]*0.10),int(g[1]*0.90+i_[1]*0.10),int(g[2]*0.90+i_[2]*0.10),255)
# broken edges catch a little light; cracks run on from the holes across the glass that is left
for (x0,y0,x1,y1) in PANES:
    for x in range(x0,x1+1):
        for y in range(y0,y1+1):
            if not HM[x,y] and any(inpane(x+dx,y+dy) and HM[x+dx,y+dy] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                P[x,y]=(104,120,116,255) if hh(x,y,7)<62 else (70,82,80,255)
def line(pts,c,k):
    im=Image.new('L',(160,160),0); d=ImageDraw.Draw(im); d.line(pts,fill=255); L=im.load()
    for x in range(160):
        for y in range(160):
            if L[x,y] and inpane(x,y) and not HM[x,y] and lum(P[x,y])<70:
                p=P[x,y]; P[x,y]=tuple(int(p[i]+(c[i]-p[i])*k) for i in range(3))+(255,)
CR=(120,138,134)
for pts in ([(93,109),(94,111)],[(90,122),(93,127),(94,133)],[(80,128),(79,133),(81,137)],[(72,125),(73,131)],[(87,114),(91,116),(94,116)],
            [(109,106),(107,100),(108,96)],[(104,112),(99,105),(96,101)],[(109,106),(113,101),(118,99)],[(112,113),(115,108)],[(99,134),(97,137)],[(96,120),(96,120)],[(107,100),(103,98),(101,96)]):
    line(pts,CR,0.34)
# 4) roof spotlight gone, only its post left
for x in range(73,94):
    for y in range(14,35):
        p=P[x,y]
        if p[3] and not fung(p) and not (p[1]>p[0]+2 and p[1]>p[2]+2) and not (x<=77 and y>=29): P[x,y]=(0,0,0,0)
# 5) door beacon dead, sign letters fading
for x in range(120,142):
    for y in range(82,100):
        p=P[x,y]
        if p[3]==255 and p[0]>p[1]+14 and p[0]>p[2]+14: l=lum(p)*0.8; P[x,y]=(int(l*1.08),int(l*0.96),int(l*0.92),255)
for x in range(114,142):
    for y in range(50,63):
        p=P[x,y]
        if p[3]==255 and 60<lum(p)<130 and not fung(p):
            P[x,y]=(40,40,43,255) if hh(x,y,2)<22 else tuple(int(c*0.82) for c in p[:3])+(255,)
# 6) everything duller and darker than star 2 (fungus excepted)
for x in range(160):
    for y in range(160):
        p=P[x,y]
        if p[3]==255 and not fung(p): P[x,y]=dull(p,0.88,0.90)
v.save('lab_t1_base_v1.png')
bg=Image.new('RGBA',(1600,1600),(20,24,38,255)); bg.alpha_composite(v.resize((1600,1600),Image.NEAREST)); bg.save('lab_t1_base_v1_10x.png')
