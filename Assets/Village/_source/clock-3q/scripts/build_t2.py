from PIL import Image, ImageDraw, ImageEnhance
import random, math
random.seed(11)
D='/mnt/user-data/uploads/Deadline/Assets/Village/'
im=Image.open('clock_t3_final_112x208.png').convert('RGBA'); px=im.load(); d=ImageDraw.Draw(im); W,H=im.size
O=(14,12,16,255)
solid=lambda x,y: 0<=x<W and 0<=y<H and px[x,y][3]>20
# ---- 1. clock faces unlit: dull glass, hands and numerals kept (stopped clock)
DULL={(252,245,161):(150,146,126),(217,210,144):(132,128,110),(222,212,140):(118,114,98),(196,186,122):(100,97,84)}
for y in range(58,96):
    for x in range(28,84):
        if px[x,y][:3] in DULL: px[x,y]=DULL[px[x,y][:3]]+(255,)
# ---- 2. windows: one candle (front upper); the others dark or covered, each differently
GL=(24,22,28,255)
def dark(x0,x1,y0,y1):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): px[x,y]=GL
dark(65,66,107,116); dark(65,66,134,143)
for y in range(104,148):                                   # every lit pane on the side wall goes dark
    for x in range(34,45):
        r,g,b,a_=px[x,y]
        if a_>20 and r>90 and r>g+25 and g>b: px[x,y]=GL
for (x,y,c) in [(65,116,(120,70,30)),(66,116,(150,90,36)),(65,115,(196,128,50)),(66,115,(255,206,120)),(66,114,(255,236,170)),(65,114,(110,64,28)),(65,113,(60,38,24)),(66,113,(84,52,26))]: px[x,y]=c+(255,)
WD=[(104,78,50),(92,68,44),(118,90,58)]
def plank(x0,y0,x1,y1,w=2):
    col=random.choice(WD)
    d.line([x0,y0,x1,y1],fill=col+(255,),width=w)
    d.line([x0,y0+w-1,x1,y1+w-1],fill=tuple(int(c*0.62) for c in col)+(255,),width=1)
    px[x0,y0]=(40,30,22,255); px[x1,y1]=(40,30,22,255)          # nail heads
plank(62,136,70,134); plank(62,141,70,142); plank(63,138,69,139,1)      # front lower: three crooked planks
for y in range(134,145):                                               # side lower: a rusty tin sheet
    for x in range(37,42):
        px[x,y]=random.choice([(96,62,44),(84,56,42),(110,72,48),(72,52,44)])+(255,)
    px[37,y]=(40,30,26,255)
for y in (136,139,142): px[39,y]=(60,42,34,255)
# ---- 3. belfry louvres: slats missing and one hanging loose in the right opening
for (x0,x1,y) in ((67,74,41),(67,74,43),(68,73,45)):
    for x in range(x0,x1+1):
        if px[x,y][:3]!=(25,23,27): px[x,y]=(26,24,28,255)
d.line([68,44,73,47],fill=(120,116,104,255))
for x in (56,57,58): px[x,45]=(26,24,28,255)
# ---- 4. roof: a few slates gone, and a tarp roped over a hole (the High school's T2 tarp)
AP=(59,5); CL=(48,28); CR=(85,28)
def in_front(x,y):
    if not (5<=y<=27): return False
    t=(y-AP[1])/(CR[1]-AP[1]); return AP[0]+(CL[0]-AP[0])*t+1 <= x <= AP[0]+(CR[0]-AP[0])*t-1
for (x,y,w) in ((55,14,3),(52,22,2),(61,10,2)):
    for i in range(w):
        if in_front(x+i,y): px[x+i,y]=(18,18,22,255); px[x+i,y+1]=(30,30,36,255)
sch=Image.open(D+'heroes_t2.png').convert('RGBA'); sp=sch.load()
ox,oy=18,-39                                   # school (41..73, 51..75) -> tower roof, lower right of the front face
for y in range(51,76):
    for x in range(41,74):
        p=sp[x,y]
        if p[3]>200 and p[2]>p[0]+6 and p[2]>70:
            tx,ty=x+ox,y+oy
            if in_front(tx,ty) and ty>=13: px[tx,ty]=tuple(min(255,int(c*1.12)) for c in p[:3])+(255,)
for (a,b) in (((62,15),(58,12)),((80,27),(84,30))):       # two ropes
    d.line([a,b],fill=(70,58,40,255))
plank(60,186,76,181)                                        # a plank propped across the door
plank(59,174,77,177); plank(58,195,75,192); plank(62,167,74,171,1)   # more boards across the entrance, each at its own angle
import sys; sys.path.insert(0,'/home/claude/pl')
from lamps import lamp, glow
lamp(im,37,'off'); lamp(im,94,'broken'); px=im.load(); d=ImageDraw.Draw(im)
im.save('t2/clock_t2_code_precolour.png')
# ---- 5. grime: mould blotches and rain streaks on the stone (walls only), then the dull pass
def noise(seed):
    random.seed(seed); g=[[random.random() for _ in range(W//6+3)] for _ in range(H//6+3)]
    def f(x,y):
        gx,gy=x/6,y/6; i,j=int(gx),int(gy); u,v=gx-i,gy-j
        a=g[j][i]*(1-u)+g[j][i+1]*u; b=g[j+1][i]*(1-u)+g[j+1][i+1]*u; return a*(1-v)+b*v
    return f
n1=noise(3)
for y in range(30,208):
    for x in range(W):
        p=px[x,y]
        if p[3]<=20: continue
        s=sum(p[:3])
        if not (250<s<560) or p[0]<p[2]+8: continue           # stone only: not glass, wood, outlines or tarp
        v=n1(x,y)
        if v>0.56:
            k=min(0.5,(v-0.56)*1.9)
            px[x,y]=(int(p[0]*(1-k)+52*k),int(p[1]*(1-k)+58*k),int(p[2]*(1-k)+44*k),255)
random.seed(5)
for x in random.sample(range(48,84),9):                        # dark runs under the ledges
    for (y0,L) in ((99,random.randint(4,11)),(57,random.randint(2,5))):
        for i in range(L):
            p=px[x,y0+i]
            if p[3]>20 and sum(p[:3])>260: px[x,y0+i]=tuple(int(c*(0.72+0.02*i)) for c in p[:3])+(255,)
a=im.split()[3]; rgb=im.convert('RGB')
rgb=ImageEnhance.Color(rgb).enhance(0.80); rgb=ImageEnhance.Brightness(rgb).enhance(0.78)
out=rgb.convert('RGBA'); out.putalpha(a); op=out.load()
# the candle: brighter flame, warm light filling the lower panes, and a little warm light on the stone around the window
for (x,y,c) in [(65,116,(170,100,40)),(66,116,(214,140,56)),(65,115,(240,170,70)),(66,115,(255,226,150)),(65,114,(255,206,110)),(66,114,(255,244,196)),
                (65,113,(214,140,60)),(66,113,(240,176,84)),(65,112,(150,90,40)),(66,112,(176,108,46)),(65,111,(104,62,30)),(66,111,(124,74,34)),(65,110,(70,44,26)),(66,110,(84,52,28))]:
    op[x,y]=c+(255,)
CAND={op[x,y][:3] for x in (65,66) for y in range(110,117)}
glow(out,66,114,8,(255,196,110),0.34,opaque_only=True,skip=CAND)
out.save('t2/clock_t2_draft_112x208.png')
