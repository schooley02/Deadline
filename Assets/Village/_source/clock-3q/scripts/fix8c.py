from PIL import Image, ImageDraw
src=Image.open('out/E_c8_raised_code_ashlar_52_0.png').convert('RGBA')
W,H=src.size
# ---------- 1. base: drop the middle stair-window band, give the 20 rows to the base so the whole door shows
rows=[y for y in range(H) if not (123<=y<=142)]          # 188 rows; old base 186..207 is now 166..187
rows+=list(range(188,208))                               # repeat the base band: grooves and door run on down
im=Image.new('RGBA',(W,H),(0,0,0,0))
for i,y in enumerate(rows): im.paste(src.crop((0,y,W,y+1)),(0,i))
px=im.load()
OUT=(22,20,24,255); L=(196,188,162,255); M=(150,143,122,255); D=(104,99,88,255)
d=ImageDraw.Draw(im)
# plinth course under the grooved base (side wall darker)
def a(x,y): return px[x,y][3]>20
xs=[x for x in range(W) if a(x,200)]; x0,x1=xs[0],xs[-1]; corner=46
for y,(cf,cs) in zip(range(0),[(OUT,OUT),(L,M),(M,D),(M,D),(D,(80,76,70,255))]):
    for x in range(x0-1,x1+2):
        px[x,y]=cs if x<corner else cf
    px[x0-1,y]=OUT; px[x1+1,y]=OUT
# two steps in front of the door
for (xa,xb,ya) in ((56,80,200),(54,82,204)):
    d.rectangle([xa,ya,xb,ya+3 if ya+3<H else H-1],fill=M); d.line([xa,ya,xb,ya],fill=OUT); d.line([xa+1,ya+1,xb-1,ya+1],fill=L)
    d.line([xa,ya,xa,min(ya+3,H-1)],fill=OUT); d.line([xb,ya,xb,min(ya+3,H-1)],fill=OUT)
im.save('c8c_fix_step1.png')
# ---------- 2. roof: straight edges, one clean eave
px=im.load()
SL=[px[x,y] for y in range(8,27) for x in range(50,75) if px[x,y][3]>20]
apexL,apexR=(55,4),(58,4); eL,eR=(30,28),(81,28); hip=(46,28)
def xl(y): return apexL[0]+(eL[0]-apexL[0])*(y-apexL[1])/(eL[1]-apexL[1])
def xr(y): return apexR[0]+(eR[0]-apexR[0])*(y-apexR[1])/(eR[1]-apexR[1])
def xh(y): return apexL[0]+1+(hip[0]-apexL[0]-1)*(y-apexL[1])/(hip[1]-apexL[1])
for y in range(4,29):
    a0,b0=round(xl(y)),round(xr(y))
    for x in range(W):
        if x<a0 or x>b0: px[x,y]=(0,0,0,0)
        elif not px[x,y][3]>20 or sum(px[x,y][:3])>330:      # hole or stray stone pixel inside the roof
            ref=px[x,y-1] if px[x,y-1][3]>20 and sum(px[x,y-1][:3])<=330 else ((40,44,60,255) if x<xh(y) else (58,62,84,255))
            px[x,y]=ref
    px[a0,y]=OUT; px[b0,y]=OUT
# eave: outline, fascia light, fascia shade, outline; the side run drops 2 px toward the left
for x in range(28,85):
    off=round((corner-x)*2/16) if x<corner else 0
    side=x<corner
    for k,c in enumerate([OUT,(138,133,118,255) if side else L,(104,100,92,255) if side else M,OUT]):
        px[x,29+off+k]=c
    for yy in range(26,29+off):                               # close any gap between slate and eave on the side run
        if side and x>=round(xl(28))+1 and px[x,yy][3]<=20: px[x,yy]=(40,44,60,255)
for k in range(4):
    for x in (27,85):
        off=2 if x<corner else 0; px[x,29+off+k]=OUT
# clear anything left hanging above the side eave outside the roof
for x in range(24,30):
    for y in range(24,31):
        if x<round(xl(min(y,28)))-0 and y<29+round((corner-x)*2/16): px[x,y]=(0,0,0,0)

for y in range(4,33):                                         # no half-transparent leftovers in the roof / eave
    for x in range(W):
        p=px[x,y]
        if 0<p[3]<255: px[x,y]=(0,0,0,0) if p[3]<128 else p[:3]+(255,)
# side wall just above the base cornice: remove the ragged dark spikes
for y in range(156,163):
    for x in range(29,53):
        if px[x,155][3]>20 and px[x,y][3]>20: px[x,y]=px[x,155]
# door: one clean double door, 12 x 30
WD=(56,42,34,255); WL=(74,57,44,255); WK=(30,24,22,255)
for y in range(170,200):
    for x in range(62,74): px[x,y]=WD
for y in range(170,200): px[67,y]=WK; px[68,y]=WK
for (xa,xb) in ((63,65),(70,72)):
    for (ya,yb) in ((172,184),(188,197)):
        for y in range(ya,yb+1):
            for x in range(xa,xb+1): px[x,y]=WL if (y in (ya,) or x==xa) else (64,49,39,255)
        for x in range(xa,xb+1): px[x,yb+1]=WK
px[66,186]=(190,160,88,255); px[69,186]=(190,160,88,255)
im.save('c8c_fixed.png')
def zoom(box,S,out):
    c=im.crop(box); bg=Image.new('RGBA',c.size,(28,32,44,255)); bg.alpha_composite(c); bg.resize((c.width*S,c.height*S),Image.NEAREST).convert('RGB').save(out)
zoom((16,0,100,70),7,'/tmp/fix_top.png'); zoom((16,130,100,208),7,'/tmp/fix_bot.png')
