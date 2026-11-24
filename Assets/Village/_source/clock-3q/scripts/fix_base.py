from PIL import Image, ImageDraw, ImageFont
import sys
src=sys.argv[1] if len(sys.argv)>1 else 'jeremy_t3_v1.png'
im=Image.open(src).convert('RGBA'); px=im.load(); W,H=im.size
C=46; K=0.0037; OUT=(12,10,15,255); WALL=(142,135,111,255)
# ---------- 1. side wall of the first floor: same courses as the front, meeting it at the corner,
#               dropping to the left by the village camera rule (level at the ground)
prof={y:px[48,y][:3] for y in range(164,208)}
def side_col(c,yc):
    if yc==164: return OUT
    if yc==165: return (88,84,74,255)
    if yc==166: return (66,64,60,255)
    if yc==167: return (30,27,31,255)
    s=sum(c)
    return (81,77,66,255) if s>=430 else (66,64,60,255) if s>=340 else (42,39,38,255) if s>=250 else (26,24,28,255)
for x in range(26,C):
    f=1-K*(C-x)
    for y in range(160,208):
        yc=207-int(round((207-y)/f))
        if yc<164:
            if y>=164 or px[x,y][3]>20 and x<=28:        # where the old cornice was, now above the new one
                if y>=164: px[x,y]=(0,0,0,0) if x<=28 else (OUT if x==29 else (66,64,60,255))
            continue
        cornice=yc<=167
        if x<=26: px[x,y]=(0,0,0,0)
        elif x==27: px[x,y]=OUT if cornice else (0,0,0,0)
        elif x==28: px[x,y]=(side_col(prof[yc],yc) if cornice else OUT)
        else: px[x,y]=side_col(prof[yc],yc)
# anything left of the shaft above the dropped cornice
for x in range(24,29):
    f=1-K*(C-x)
    for y in range(156,170):
        yc=207-int(round((207-y)/f))
        if yc<164: px[x,y]=(0,0,0,0)
# ---------- 2. pediment over the door: one clean symmetric triangle centred on the door (1:1 slope)
cx=67; base=162; hw=12; top=base-hw
Lc=(157,148,132,255); Mc=(138,132,112,255); Tc=(103,99,83,255); Sh=(74,70,62,255)
for y in range(147,base+1):                       # clear the old pediment back to plain wall
    for x in range(52,80):
        if abs(x-cx)>(y-top) or y<top:
            p=px[x,y]; sm=sum(p[:3])
            if sm<260 or sm>=400: px[x,y]=WALL
for y in range(top,base+1):
    w=y-top
    for x in range(cx-w,cx+w+1):
        dx=abs(x-cx)
        if dx==w: c=OUT
        elif dx>=w-2: c=Lc if x<cx else Mc        # raking cornice, lit side / shade side
        elif dx==w-3: c=Sh
        else: c=Tc
        px[x,y]=c
for x in range(cx-hw+3,cx+hw-2): px[x,base]=Sh    # shadow line at the foot of the tympanum
for x in range(cx-hw-1,cx+hw+2): px[x,163]=Lc; px[x,164]=Mc
for yy in (163,164): px[cx-hw-2,yy]=OUT; px[cx+hw+2,yy]=OUT
px[cx-hw-1,162]=OUT; px[cx+hw+1,162]=OUT
im.save('clock_t3_fixed_v2.png')
a=Image.open(src).convert('RGBA'); box=(18,140,98,208); S=8
o=Image.new('RGBA',(80*2+8,68),(28,32,44,255)); o.alpha_composite(a.crop(box),(0,0)); o.alpha_composite(im.crop(box),(88,0))
o.resize((o.width*S,o.height*S),Image.NEAREST).convert('RGB').save('/tmp/fixbase.png')
