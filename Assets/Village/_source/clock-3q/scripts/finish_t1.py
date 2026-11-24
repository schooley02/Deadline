from PIL import Image, ImageDraw, ImageEnhance
import random, sys
sys.path.insert(0,'/home/claude/pl')
from lamps import lamp
im=Image.open('t1/clock_t1_nolamp.png').convert('RGBA'); px=im.load(); W,H=im.size
ip=Image.open('out/T1foot_92_0.png').convert('RGBA').load()
O=(14,12,16,255); SHARD=(128,136,138,255)
def interp(pts,x):
    for (x0,h0),(x1,h1) in zip(pts,pts[1:]):
        if x0<=x<=x1: return h0+(h1-h0)*(x-x0)/max(1,x1-x0)
    return 0
L=[(22,1),(24,3),(27,6),(30,8),(34,9),(37,12),(44,12),(46,8),(50,9),(53,6),(55,3)]
R=[(79,8),(84,10),(86,14),(92,14),(94,10),(98,8),(101,5),(104,1)]
def weed(p): r,g,b=p[:3]; return p[3]>20 and r>g>b and r-b>24 and r+g+b>150
for pts,(x0,x1,y0) in ((L,(22,55,190)),(R,(79,104,192))):
    for x in range(x0,x1+1):
        top=207-int(round(interp(pts,x)))
        for y in range(y0,208):
            p=ip[x,y]
            if p[3]<=20: continue
            if 54<=x<=82 and y>=199: continue                     # the steps stay
            if y>=top or weed(p):
                px[x,y]=p
        if px[x,top][3]>20 and not weed(ip[x,top]) and (top==0 or px[x,top-1][3]<=20): px[x,top]=O      # dark edge where rubble meets the sky
# street lamps: the left one snapped off near the ground, the right one dark with broken glass
d=ImageDraw.Draw(im)
from lamps import bent_lamp
bent_lamp(im,37)
lamp(im,94,'broken'); px=im.load()
im.save('t1/clock_t1_code_precolour.png')
# grime, heavier than T2, then the darkest pass
def noise(seed,cell=6):
    random.seed(seed); g=[[random.random() for _ in range(W//cell+3)] for _ in range(H//cell+3)]
    def f(x,y):
        gx,gy=x/cell,y/cell; i,j=int(gx),int(gy); u,v=gx-i,gy-j
        a=g[j][i]*(1-u)+g[j][i+1]*u; b=g[j+1][i]*(1-u)+g[j+1][i+1]*u; return a*(1-v)+b*v
    return f
n1=noise(8)
for y in range(30,194):
    for x in range(W):
        p=px[x,y]
        if p[3]<=20: continue
        s=sum(p[:3])
        if not (250<s<560) or p[0]<p[2]+8: continue
        v=n1(x,y)
        if v>0.50:
            k=min(0.6,(v-0.50)*2.2); px[x,y]=(int(p[0]*(1-k)+44*k),int(p[1]*(1-k)+52*k),int(p[2]*(1-k)+38*k),255)
random.seed(9)
for x in random.sample(range(48,84),14):
    for (y0,Ln) in ((99,random.randint(6,16)),(57,random.randint(3,6)),(169,random.randint(4,10))):
        for i in range(Ln):
            p=px[x,y0+i]
            if p[3]>20 and sum(p[:3])>260: px[x,y0+i]=tuple(int(c*(0.66+0.02*i)) for c in p[:3])+(255,)
a=im.split()[3]; rgb=im.convert('RGB')
rgb=ImageEnhance.Color(rgb).enhance(0.62); rgb=ImageEnhance.Brightness(rgb).enhance(0.62)
out=rgb.convert('RGBA'); out.putalpha(a); out.save('t1/clock_t1_draft_112x208.png')
