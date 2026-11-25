# Water tower (replaces the Windmill; kind id stays `bestdays`), 128x208 (16 px of open air on EACH side for the spotlight beams and the fence's side run),
# far row behind the Police station. Village three-quarter camera like the Broadcast tower: front flat, far side shifts LEFT,
# light front-right, never flip. All code-drawn. Everything a phone must show sits in the top ~60 px (tank, name, catwalk, lamp, lookout).
# v2 (2026-11-25, Jeremy): weathered light-BLUE paint; star 4 = security fence + razor coil instead of sandbags, a lookout on the catwalk,
# a spotlight aimed 70 degrees down, water drums on a pallet. Scale: about 7 px per metre (a person is 13 px), so the tower reads tall.
from PIL import Image, ImageDraw
import math
W,H=128,208; G=H-1
OUT=(20,18,28,255)
L_L=(160,190,206,255); L_M=(124,156,180,255); L_D=(88,118,148,255); L_DD=(56,78,108,255)                      # painted steel
T=[(50,72,106,255),(68,96,130,255),(90,122,154,255),(114,148,176,255),(136,170,192,255),(158,190,206,255),(180,206,218,255),(202,222,228,255)]  # tank paint dark -> light
INK=(30,42,72,255); CON=(128,126,120,255); COND=(88,88,86,255)
PAINT=(168,58,44,255); PAINT_D=(126,42,38,255); PAINT_L=(190,74,54,255)
F5={'D':["11110","10001","10001","10001","10001","10001","11110"],'A':["01110","10001","10001","11111","10001","10001","10001"],
    'L':["10000","10000","10000","10000","10000","10000","11111"],'T':["11111","00100","00100","00100","00100","00100","00100"],
    'O':["01110","10001","10001","10001","10001","10001","01110"],'N':["10001","11001","10101","10101","10011","10001","10001"],
    'C':['01111','10000','10000','10000','10000','10000','01111'],'M':['10001','11011','10101','10101','10001','10001','10001'],
    'P':['11110','10001','10001','11110','10000','10000','10000'],'F':['11111','10000','10000','11110','10000','10000','10000'],
    'R':['11110','10001','10001','11110','10100','10010','10001']}
CX=66; TCY=30; RX=31; RY=24
FIG=None   # optional: a PIL image used for the lookouts instead of the 13 px code figure (scale tests)
TANK_TEX=None   # optional 80x64 RGBA: a PixelLab-painted tank (canvas x CX-40.., y 0..), used inside the code tank's silhouette
def make(tier=3,name='DALTON',tank_only=False):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im); P=im.load()
    def Ln(a,b,c,w=1): d.line([a,b],fill=c,width=w)
    FH=15; xA,xB=CX-36,CX+54; ft=G-FH; SX,SR=26,5
    sy_=lambda i: round(SR*i/SX)                                                   # a side run: i px to the left of its front corner -> this many px up
    if tier>=4:
        # the fence's BACK run and RIGHT side run: further from the camera than the tower, so drawn first (behind the legs), dimmer
        FAR=(96,104,122,130); FARP=(92,100,118,255); FARC=(140,148,162,255)
        far=Image.new('RGBA',(W,H),(0,0,0,0)); fq=far.load()
        for y in range(ft-SR+1,G-SR+1):
            for x in range(xA-SX,xB-SX+1):
                if (x+y)%4==0 or (x-y)%4==0: fq[x,y]=FAR
        for i in range(0,SX+1):
            x=xB-i; yb=G-sy_(i)
            for y in range(yb-FH+1,yb+1):
                if (x+y)%4==0 or (x-y)%4==0: fq[x,y]=FAR
        im.alpha_composite(far); P=im.load(); d=ImageDraw.Draw(im)
        d.line([xA-SX,ft-SR,xB-SX,ft-SR],fill=FARP); d.line([xA-SX,G-SR,xB-SX,G-SR],fill=(70,76,92,255))
        d.line([xB,ft,xB-SX,ft-SR],fill=FARP); d.line([xB,G,xB-SX,G-SR],fill=(70,76,92,255))
        for x in list(range(xA-SX,xB-SX,13))+[xB-SX]: d.line([x,ft-SR-1,x,G-SR],fill=FARP)
        for i in (9,18): d.line([xB-i,ft-sy_(i)-1,xB-i,G-sy_(i)],fill=FARP)
        x=xA-SX
        while x<xB-SX-4:
            d.arc([x,ft-SR-6,x+5,ft-SR],180,360,fill=FARC); x+=4
        i=SX
        while i>2:
            x=xB-i; yy=ft-sy_(i); d.arc([x,yy-6,x+5,yy],180,360,fill=FARC); i-=3
    yt_out=43; yt_in=52
    # each leg ends ON its footing: in the middle of the footing's top face, 3 px above the footing's foot
    legs={ 'OL':((CX-27,yt_out),(CX-41,G-5)), 'OR':((CX+27,yt_out),(CX+40,G-3)),
           'FL':((CX-13,yt_in),(CX-20,G-3)),  'FR':((CX+14,yt_in),(CX+21,G-3)),
           'BL':((CX-18,yt_in-2),(CX-28,G-9)),'BR':((CX+9,yt_in-2),(CX+13,G-9)) }
    def at(k,y):
        (x0,y0),(x1,y1)=legs[k]; f=(y-y0)/(y1-y0); return (x0+(x1-x0)*f, y)
    tiers=[70,102,134,166,198]
    # concrete footings, drawn FIRST so the legs and riser come down INTO the middle of each top face.
    # In the village three-quarter view like every building's base: a lit front face, a lighter top going back
    # (each row back sits one px further left), and a darker LEFT side face whose foot rises as it goes back
    def footing(x0,x1,y,back=False):
        FR_=COND if back else CON; TP_=CON if back else (152,150,142,255); SD_=(64,64,64,255) if back else (84,84,82,255)
        d.rectangle([x0,y-1,x1,y],fill=FR_)                                   # front face
        d.line([x0-1,y-2,x1-1,y-2],fill=TP_); d.line([x0-2,y-3,x1-2,y-3],fill=TP_)   # top face, two rows deep
        P[x0-1,y-1]=SD_; P[x0-1,y]=SD_; P[x0-2,y-2]=SD_; P[x0-2,y-1]=SD_      # left side face
        d.line([x0,y,x1,y],fill=tuple(int(v*0.82) for v in FR_[:3])+(255,))   # darker where it meets the ground
    for k in ('BL','BR','OL','FL','FR','OR'):
        x,y=legs[k][1]; x=round(x); footing(x-2,x+5,y+2,back=(k[0]=='B'))     # top face centred on the leg's end
    footing(CX-7,CX+9,G)                                                      # the riser's pad, its top face centred under the riser
    def panel(a,b,rod,strut,top0=None,x=True):
        ys=[top0 or 56]+tiers
        for i in range(len(ys)-1 if x else 0):
            ya,yb=ys[i],ys[i+1]; Ln(at(a,ya),at(b,yb),rod); Ln(at(b,ya),at(a,yb),rod)
        for y in tiers: Ln(at(a,y),at(b,y),strut)
    panel('BL','BR',L_DD,L_DD,x=False); panel('OL','BL',L_DD,L_DD,top0=58,x=False); panel('BR','OR',L_DD,L_DD,top0=58,x=False)
    for k in ('BL','BR'):
        (x0,y0),(x1,y1)=legs[k]; Ln((x0,y0),(x1,y1),L_DD,2)
    d.rectangle([CX-5,54,CX+4,G-2],fill=OUT); d.rectangle([CX-4,54,CX+3,G-2],fill=L_M)
    d.rectangle([CX+1,54,CX+2,G-2],fill=L_L); d.line([CX-4,54,CX-4,G-2],fill=L_D); d.line([CX-3,54,CX-3,G-2],fill=L_D)
    for y in tiers: d.line([CX-5,y,CX+4,y],fill=L_DD)
    panel('OL','FL',L_D,L_D,top0=58); panel('FR','OR',L_M,L_M,top0=58); panel('FL','FR',L_M,L_M,top0=60)
    ys_=[60]+tiers
    for i in range(len(ys_)-1):
        ym=(ys_[i]+ys_[i+1])/2; xa_,_=at('FL',ym); xb_,_=at('FR',ym); P[round((xa_+xb_)/2),round(ym)]=L_L
    for k,c1,c2 in (('OL',L_M,L_D),('FL',L_M,L_D),('FR',L_L,L_M),('OR',L_L,L_M)):
        (x0,y0),(x1,y1)=legs[k]
        if tier==1 and k=='OL':
            # star 1: the far-left leg has buckled near its foot: straight down to the kink, pushed in 5 px, then back out to its footing
            ka=at('OL',G-44); kb=(at('OL',G-26)[0]+5,G-26)
            for (pa,pb) in (((x0,y0),ka),(ka,kb),(kb,(x1,y1))):
                Ln(pa,pb,c2,3); Ln((pa[0]+1,pa[1]),(pb[0]+1,pb[1]),c1,1)
            d.rectangle([round(kb[0])-1,G-28,round(kb[0])+2,G-25],fill=L_DD); P[round(kb[0])+1,G-27]=(132,84,60,255)   # the crease, rusting
            continue
        Ln((x0,y0),(x1,y1),c2,3); Ln((x0+1,y0),(x1+1,y1),c1,1)
    for k in ('OL','FL','FR','OR'):
        for y in tiers:
            x,_=at(k,y); d.rectangle([round(x)-1,y-1,round(x)+1,y+1],fill=L_DD); P[round(x),y-1]=L_M if k in ('FR','OR') else L_D
    for y in range(50,G-4,3):
        x,_=at('OR',y); Ln((x-6,y),(x-2,y),L_D)
    (x0,y0),(x1,y1)=legs['OR']; Ln((x0-6,50),(x1-6,G-4),L_M)
    # the tank shades the top of the tower: everything painted above y 64 drops one tone (two right under the bowl)
    ramp=[L_L,L_M,L_D,L_DD]
    for y in range(40,65):
        for x in range(W):
            if P[x,y] in ramp: P[x,y]=ramp[min(3,ramp.index(P[x,y])+(2 if y<56 else 1))]
    # grime and discoloured paint on the legs, bracing and riser (Jeremy 2026-11-25: worse the further down the stars go).
    # Soft PATCHES from low-frequency noise (no single-pixel specks): chalky faded paint, grey-brown dirt that thickens toward the
    # ground, and rust at the joints with dark runs below.
    import random
    LEVEL={5:0.0,4:0.7,3:1.7,2:3.0,1:4.0}[tier]      # star 5 is freshly painted: no grime at all
    rr=random.Random(7); GRID=6
    lat=[[rr.random() for _ in range(W//GRID+3)] for _ in range(H//GRID+3)]
    def noise(x,y):
        gx,gy=x/GRID,y/GRID; x0_,y0_=int(gx),int(gy); fx,fy=gx-x0_,gy-y0_
        a_=lat[y0_][x0_]*(1-fx)+lat[y0_][x0_+1]*fx; b_=lat[y0_+1][x0_]*(1-fx)+lat[y0_+1][x0_+1]*fx
        return a_*(1-fy)+b_*fy
    mix=lambda c,t,k: (int(c[0]+(t[0]-c[0])*k),int(c[1]+(t[1]-c[1])*k),int(c[2]+(t[2]-c[2])*k),255)
    DIRT=(86,80,74); CHALK=(168,190,200); RUSTC=(132,84,60); RUN=(84,62,54)
    STAIN=(118,130,128) if tier>=3 else (58,70,84)      # kept-up stars: faded grey-green paint, not dark patches (dark ones read as shadows on the frame)
    steel=set(ramp)
    for y in (range(40,H) if LEVEL>0 else ()):
        hb=max(0.0,(y-70)/(G-70))
        for x in range(W):
            c=P[x,y]
            if c not in steel: continue
            n=noise(x,y); k=0.0
            if n>0.62-0.07*LEVEL: c=mix(c,STAIN,min(0.68,0.22*LEVEL*(n-0.45)/0.3)); k=1
            elif n<0.30+0.03*LEVEL: c=mix(c,CHALK,min(0.45,0.16*LEVEL))
            c=mix(c,DIRT,min(0.7,LEVEL*(0.03+0.20*hb*hb)+ (0.10*LEVEL if (hb>0.8 and n>0.4) else 0)))
            P[x,y]=c
    # long water stains down the riser (it sweats), more and longer on the lower stars
    rr3=random.Random(31)
    for i in range(int(2+2.2*LEVEL) if LEVEL>0 else 0):
        xx=CX-4+rr3.randint(0,7); ya=rr3.choice((56,70,86,102,118,134,150))+rr3.randint(0,6); ln=rr3.randint(8,10+int(6*LEVEL))
        for yy in range(ya,min(G-2,ya+ln)):
            if P[xx,yy][3]==255 and P[xx,yy]!=OUT: P[xx,yy]=mix(P[xx,yy],STAIN,0.38 if i%3 else 0.5)
    # rust at the joints: irregular patches (never a neat square) with a dark run below each
    joints=[(k_,y_) for k_ in ('OL','FL','FR','OR') for y_ in tiers]+[('R',y_) for y_ in (86,118,150,182)]
    rr2=random.Random(19); rr2.shuffle(joints)
    for (k_,y_) in (joints[:int(round(2.6*LEVEL))+1] if LEVEL>0 else []):
        x_=CX-1 if k_=='R' else round(at(k_,y_)[0]); rad=rr2.choice((1,2)) if LEVEL<2.5 else rr2.choice((2,2,3))
        ox_,oy_=rr2.randint(-1,1),rr2.randint(0,2)
        for yy in range(y_-rad+oy_,y_+rad+2+oy_):
            for xx in range(x_-rad-1+ox_,x_+rad+2+ox_):
                if 0<=xx<W and 0<=yy<H and P[xx,yy][3]==255 and P[xx,yy]!=OUT and (xx-x_-ox_)**2+((yy-y_-oy_)*1.3)**2<=(rad+rr2.random()*0.9)**2:
                    P[xx,yy]=mix(P[xx,yy],RUSTC,0.45+0.25*rr2.random())
        for yy in range(y_+rad+1,y_+rad+2+rr2.randint(3,5+int(2*LEVEL))):
            xx=round(at(k_,yy)[0]) if k_!='R' else x_
            if yy<H and P[xx,yy][3]==255 and P[xx,yy]!=OUT: P[xx,yy]=mix(P[xx,yy],RUN,0.42)
    # riser: bolted bands, a valve wheel and an access hatch at its foot
    for y in (86,118,150,182): d.line([CX-4,y,CX+3,y],fill=L_D); d.line([CX-4,y+1,CX+3,y+1],fill=L_L)
    # access hatch at the riser's foot: a steel plate set into the pipe, painted like it (no black box, no bright knob): a thin dark
    # seam with rounded corners, the plate one tone deeper than the pipe and shaded the same way, two hinge pins, a small pull handle
    SEAM=(40,54,78,255); PD=(72,98,128,255); PM=(96,126,152,255); PL=(120,148,170,255); PIN=(28,38,58,255)
    hx0,hx1,hy0,hy1=CX-3,CX+2,G-14,G-4
    for yy in range(hy0,hy1+1):
        for xx in range(hx0,hx1+1):
            if (xx in (hx0,hx1)) and (yy in (hy0,hy1)): continue
            edge=xx in (hx0,hx1) or yy in (hy0,hy1)
            P[xx,yy]=SEAM if edge else (PD if (xx==hx0+1 or yy==hy0+1) else (PL if xx==hx1-1 else PM))
    P[hx0,hy0+3]=PIN; P[hx0,hy1-3]=PIN; P[hx1-1,hy0+5]=PIN; P[hx1-1,hy0+6]=PIN
    if tier==2:
        # ajar: a dark gap down the right, the plate swung a little toward us on its hinges (narrower, its free edge lit)
        for yy in range(hy0+1,hy1):
            for xx in range(hx0+1,hx1): P[xx,yy]=(18,20,28,255)
        for yy in range(hy0+1,hy1):
            P[hx0+1,yy]=PD; P[hx0+2,yy]=PM
        for yy in range(hy0+2,hy1-1): P[hx0+3,yy]=PL
    d.ellipse([CX+5,G-24,CX+9,G-20],outline=(116,92,76,255)); P[CX+7,G-22]=(70,58,54,255); d.line([CX+4,G-22,CX+5,G-22],fill=L_DD)
    # safety cage round the top of the ladder
    for y in range(52,96,5):
        x,_=at('OR',y); d.arc([round(x)-9,y-2,round(x)+1,y+3],300,90,fill=L_D)
    x0_,_=at('OR',52); x1_,_=at('OR',95); Ln((x0_+1,52),(x1_+1,95),L_D)
    # ---- tank
    def inside(x,y): return ((x-CX)/RX)**2+((y-TCY)/RY)**2<=1.0
    for y in range(TCY-RY-1,TCY+RY+2):
        for x in range(CX-RX-1,CX+RX+2):
            if inside(x,y):
                u=(x-(CX-RX))/(2*RX); v=(y-(TCY-RY))/(2*RY)
                dd=math.hypot((u-0.66)*1.0,(v-0.30)*1.25)
                i=7 if dd<0.10 else 6 if dd<0.21 else 5 if dd<0.33 else 4 if dd<0.45 else 3 if dd<0.57 else 2 if dd<0.69 else 1 if dd<0.83 else 0
                if v>0.76: i=max(0,i-1)
                if v>0.93 and 0.3<u<0.8: i=min(7,i+1)                      # light bounced up from the ground onto the very bottom of the bowl
                P[x,y]=T[i]
    def tone(x,y,k):
        if 0<=x<W and 0<=y<H and P[x,y] in T: P[x,y]=T[max(0,min(7,T.index(P[x,y])+k))]
    # plate seams: weld rings (front arcs bow up, the tank is above the eye) and meridian seams; none through the lettering band
    for (yc,bow) in ((8,1.0),(45,2.0),(50,1.4)):
        hw=RX*math.sqrt(max(0,1-((yc-TCY)/RY)**2))
        for x in range(int(CX-hw)+1,int(CX+hw)):
            tone(x,yc+round(bow*((x-CX)/max(hw,1))**2),-1)
    for deg in (-66,-42,-18,8,32,56,78):
        sn=math.sin(math.radians(deg))
        for y in list(range(TCY-RY+1,9))+list(range(41,TCY+RY)):
            x=round(CX+RX*sn*math.sqrt(max(0,1-((y-TCY)/RY)**2)))
            if inside(x,y): tone(x,y,-1)
    # a highlight line just above each lower weld ring (the plate edge catches the light) on the lit side
    for x in range(CX+2,CX+22): tone(x,44+round(2.0*((x-CX)/27)**2),+1)
    # light weathering: a few short run-off streaks under the catwalk line (more on the lower stars)
    for (x,y0,ln) in ((CX-19,41,5),(CX-6,42,4),(CX+11,41,6),(CX+22,41,4))[:(4 if tier<=3 else 3)]:
        for y in range(y0,y0+ln): tone(x,y,-1)
    for y in range(TCY-RY-2,TCY+RY+3):
        for x in range(CX-RX-2,CX+RX+3):
            if 0<=x<W and 0<=y<H and not inside(x,y) and any(inside(x+a,y+b) for a,b in ((1,0),(-1,0),(0,1),(0,-1))): P[x,y]=OUT
    d.polygon([(CX-9,TCY+RY-2),(CX+8,TCY+RY-2),(CX+4,TCY+RY+3),(CX-5,TCY+RY+3)],fill=T[2],outline=OUT); d.line([CX+1,TCY+RY-1,CX+5,TCY+RY-1],fill=T[4]); d.line([CX-7,TCY+RY-1,CX-4,TCY+RY+2],fill=T[1])
    d.rectangle([CX-3,1,CX+2,6],fill=OUT); d.rectangle([CX-2,2,CX+1,5],fill=T[4]); d.line([CX-2,2,CX+1,2],fill=T[7]); d.line([CX-2,3,CX-2,5],fill=T[2]); d.rectangle([CX+6,4,CX+10,6],fill=OUT); d.line([CX+7,5,CX+9,5],fill=T[5])
    if tank_only:
        t=Image.new('RGBA',(W,H),(0,0,0,0)); tp=t.load()
        for y in range(0,64):
            for x in range(CX-40,CX+40):
                if inside(x,y) or (P[x,y][3] and (y<8 or y>TCY+RY-3) and abs(x-CX)<12) or (P[x,y]==OUT and y<60 and abs(x-CX)<34 and not (y>TCY+RY+3)): tp[x,y]=P[x,y]
        return t.crop((CX-40,0,CX+40,64))
    if TANK_TEX is not None:
        for y in range(0,64):
            for x in range(CX-40,CX+40):
                if inside(x,y):
                    c=TANK_TEX.getpixel((x-(CX-40),y))
                    if c[3]>200: P[x,y]=c[:3]+(255,)
    if tier<=2:
        bxc,byc,br=CX+28,5,(12.0 if tier==2 else 14.0)
        dist=lambda x,y: math.hypot(x-bxc,y-byc)
        for y in range(0,34):
            for x in range(CX+2,CX+36):
                if P[x,y][3] and dist(x,y)<br and not (abs(x-CX)<12 and y<8): P[x,y]=(0,0,0,0)
        for y in range(1,34):
            for x in range(CX+2,CX+35):
                if P[x,y][3]==0 and inside(x,y) and any(P[x+a,y+b][3] and P[x+a,y+b]!=OUT and inside(x+a,y+b) for a,b in ((1,0),(-1,0),(0,1),(0,-1))): P[x,y]=OUT
        for y in range(2,34):
            for x in range(CX+2,CX+34):
                c=P[x,y]
                if c[3]==0 or c==OUT or not inside(x,y): continue
                dd_=dist(x,y)
                if dd_<br+7:
                    k_=0.60+0.40*((dd_-br)/7.0)                      # the sunk skin falls into shadow toward the bite
                    P[x,y]=(int(c[0]*k_),int(c[1]*k_),int(c[2]*k_),255)
                elif dd_<br+8.2:
                    P[x,y]=(min(255,int(c[0]*1.16+6)),min(255,int(c[1]*1.16+6)),min(255,int(c[2]*1.14+6)),255)   # the lip of the dent catches the light
        for (ang,ln) in ((200,7),(160,6),(120,6)):                    # creases running out from the dent
            for t_ in range(int(br)+2,int(br)+2+ln):
                x=int(round(bxc+t_*math.cos(math.radians(ang)))); y=int(round(byc+t_*math.sin(math.radians(ang))))
                if inside(x,y) and P[x,y]!=OUT and P[x,y][3]: c=P[x,y]; P[x,y]=(int(c[0]*0.72),int(c[1]*0.72),int(c[2]*0.74),255)
    if tier==1:
        # abandoned: the caved-in skin has torn open (a ragged black hole with a bright torn lip), and rust has run down from it,
        # from the catwalk line and from the weld rings
        hcx,hcy=CX+11,16; HB=(10,10,14,255)
        rad=lambda th: 5.0+1.6*math.sin(3*th+0.9)+0.8*math.sin(5*th)
        ring=[]
        for y in range(hcy-9,hcy+10):
            for x in range(hcx-9,hcx+10):
                dx,dy=x-hcx,(y-hcy)*1.15; r_=math.hypot(dx,dy); th=math.atan2(dy,dx)
                if not inside(x,y) or P[x,y][3]==0: continue
                if r_<rad(th): P[x,y]=HB
                elif r_<rad(th)+1.1: ring.append((x,y,th))
        for (x,y,th) in ring:                                              # the torn lip: lit where it faces the light, dark where it curls away
            c=P[x,y]
            if c==HB or c==OUT: continue
            lit=math.cos(th-math.radians(135))>0.2                          # lower-left lip faces up-right toward the light
            P[x,y]=(min(255,c[0]+52),min(255,c[1]+50),min(255,c[2]+46),255) if lit else (int(c[0]*0.62),int(c[1]*0.62),int(c[2]*0.64),255)
        for (x,y) in ((hcx-6,hcy+3),(hcx-7,hcy+4),(hcx+5,hcy-5),(hcx+6,hcy-6)):   # two curled flaps of plate
            if inside(x,y) and P[x,y][3] and P[x,y]!=OUT: P[x,y]=(150,156,160,255)
        RS=(134,86,60)
        for (x,y0_,ln) in ((CX+10,22,9),(CX+13,21,6),(CX+7,21,5),(CX-20,12,8),(CX-8,9,6),(CX+4,8,5),(CX-24,41,8),(CX-12,42,10),(CX+2,42,7),(CX+15,42,9),(CX+24,41,6)):
            for y in range(y0_,y0_+ln):
                for dx in ((0,) if ln<8 else (0,1)):
                    if inside(x+dx,y) and P[x+dx,y]!=HB and P[x+dx,y]!=OUT:
                        c=P[x+dx,y]; k_=0.55 if y<y0_+ln-2 else 0.3; P[x+dx,y]=(int(c[0]+(RS[0]-c[0])*k_),int(c[1]+(RS[1]-c[1])*k_),int(c[2]+(RS[2]-c[2])*k_),255)
    # ---- town name (same place on every star) and, from star 4, the survivors' word hand-painted above it
    TANK_BASE={(x,y):P[x,y] for y in range(0,64) for x in range(CX-40,CX+40)}      # the bare paint, for peeled letters and a missing rail
    def put(s_,cx,y,drops):
        # the town name: crisp stencilled letters, each one stepped down toward the ends so the line bows with the tank
        wd=sum(len(F5[c][0])+1 for c in s_)-1; x=cx-wd//2
        for n,c in enumerate(s_):
            for r,row in enumerate(F5[c]):
                for k,b_ in enumerate(row):
                    if b_=='1': P[x+k,y+r+drops[n]]=INK
            x+=len(F5[c][0])+1
    put(name,CX+1,19,[2,1,0,0,1,2])
    if tier<=2:
        # the stencilled name has faded and peeled: whole flakes gone (low-frequency noise, not specks), the rest washed out
        import random as _r
        q=_r.Random(5); g6=[[q.random() for _ in range(W//4+3)] for _ in range(H//4+3)]
        def n4(x,y):
            gx,gy=x/4,y/4; a_,b_=int(gx),int(gy); fx,fy=gx-a_,gy-b_
            return (g6[b_][a_]*(1-fx)+g6[b_][a_+1]*fx)*(1-fy)+(g6[b_+1][a_]*(1-fx)+g6[b_+1][a_+1]*fx)*fy
        for y in range(17,30):
            for x in range(CX-22,CX+24):
                if P[x,y]==INK:
                    under=TANK_BASE[(x,y)]
                    if n4(x,y)>(0.74 if tier==2 else 0.52): P[x,y]=under
                    else:
                        k_=0.8 if tier==2 else 0.6; P[x,y]=(int(INK[0]*k_+under[0]*(1-k_)),int(INK[1]*k_+under[1]*(1-k_)),int(INK[2]*k_+under[2]*(1-k_)),255)
    if tier>=4:
        # the survivors' word, hand-painted in rust red over the top of the town name: thick 2 px strokes, 9 px tall, and it wraps
        # round the tank: the line bows up in the middle (stepped every 3 columns so the strokes stay whole), the two end letters are
        # squeezed a column narrower and sit lowest, the shaded left end is darker. It runs onto the tops of the blue letters. Drips.
        B9={'C':["011110","111111","110000","110000","110000","110000","110000","111111","011110"],
            'A':["011110","111111","110011","110011","111111","111111","110011","110011","110011"],
            'M':["1100011","1110111","1111111","1101011","1100011","1100011","1100011","1100011","1100011"],
            'P':["111110","111111","110011","110011","111111","111110","110000","110000","110000"],
            'F':["111111","111111","110000","110000","111100","111100","110000","110000","110000"],
            'O':["011110","111111","110011","110011","110011","110011","110011","111111","011110"],
            'R':["111110","111111","110011","110011","111110","111100","110110","110011","110011"],
            'T':["111111","111111","001100","001100","001100","001100","001100","001100","001100"]}
        word='CAMP' if tier==4 else 'FORT'
        glyphs=[]
        for n,c in enumerate(word):
            g=B9[c]
            glyphs.append(g)
        wd=sum(len(g[0]) for g in glyphs)+len(glyphs)-1; x=CX+1-wd//2; y0=8; half=wd/2.0
        for n,g in enumerate(glyphs):
            for k in range(len(g[0])):
                last=len(glyphs)-1
                dy=0 if 0<n<last else 3                                     # whole letters: the two end letters sit 3 px lower, so the line bows with the tank
                for r in range(9):
                    if g[r][k]=='1' and inside(x+k,y0+r+dy):
                        P[x+k,y0+r+dy]=PAINT_D if (n==0 and k<3) or (r+k+n)%6==0 else (PAINT_L if (n==len(glyphs)-1 or (n==len(glyphs)-2 and k>2)) and r<5 else PAINT)
            x+=len(g[0])+1
        starts=[]; xx=CX+1-wd//2
        for g in glyphs: starts.append(xx); xx+=len(g[0])+1
        for (li,col_,ln) in (((1,0,3),(2,6,2),(3,1,3)) if word=='CAMP' else ((1,4,2),(2,5,3),(3,3,3))):   # paint drips under a few strokes
            xx=starts[li]+col_
            ys=[y for y in range(y0,y0+18) if P[xx,y] in (PAINT,PAINT_D,PAINT_L)]
            if ys:
                for y in range(max(ys)+1,max(ys)+1+ln):
                    if inside(xx,y): P[xx,y]=PAINT_D
    if tier>=5:
        # two sign lights on the rail wash the name: tank paint one tone lighter around the lettering (opaque paint pixels only)
        for y in range(6,32):
            for x in range(CX-28,CX+30):
                if ((x-(CX+1))/27)**2+((y-19)/12)**2<=1 and inside(x,y) and P[x,y] not in (INK,PAINT,PAINT_D,PAINT_L,OUT):
                    c=P[x,y]; P[x,y]=(min(255,int(c[0]*1.10+8)),min(255,int(c[1]*1.10+8)),min(255,int(c[2]*1.08+6)),255)
    # ---- catwalk (a ring seen from below: its front arc bows UP in the middle)
    RC=35
    def arc(x): return 37+round(2.2*((x-CX)/RC)**2)
    def soldier(sx):
        # the lookout, about 13 px tall (7 px per metre), standing on the deck BEHIND the hand rail, facing right
        if FIG is not None:
            im.alpha_composite(FIG,(sx+2-FIG.width//2,arc(sx+2)-FIG.height)); return
        fy=arc(sx+2)-1
        col={'h':(58,68,50,255),'H':(84,96,70,255),'s':(206,160,126,255),'S':(160,118,96,255),'o':(86,100,66,255),'O':(62,74,52,255),'L':(110,124,84,255),
             'v':(70,72,62,255),'d':(46,52,60,255),'D':(34,38,46,255),'b':(22,22,26,255),'g':(30,30,34,255),'G':(92,74,56,255)}
        rows=[" hHH  ","hhHHh "," sSs  "," Sss  ","oOLLo ","oOvLLo","OovvLo"," OvvL "," dDdd "," dD d "," d  d "," d  D ","bb  bb"]
        for r,row in enumerate(rows):
            for k,ch in enumerate(row):
                if ch!=' ': P[sx+k,fy-12+r]=col[ch]
        for (dx,dy,c) in ((-1,-5,'G'),(0,-6,'G'),(1,-6,'g'),(2,-7,'g'),(3,-7,'g'),(4,-8,'g'),(5,-8,'g'),(6,-9,'g')): P[sx+dx,fy+dy]=col[c]   # rifle: wooden stock, dark barrel
    if tier>=4: soldier(CX+21)
    if tier>=5: soldier(CX-21)
    for x in range(CX-RC,CX+RC+1):
        y=arc(x)
        P[x,y+2]=OUT; P[x,y+1]=(40,54,80,255); P[x,y]=L_L if x>CX-6 else L_M
        P[x,y-7]=L_M if x>CX-6 else L_D
        if (x-(CX-RC))%7==0 or x==CX+RC:
            for yy in range(y-6,y): P[x,yy]=L_D
        if (x-(CX-RC))%7!=0: P[x,y-4]=L_D if (x<CX-6) else L_M
    for x in (CX-30,CX-16,CX+17,CX+31):
        y=arc(x); Ln((x,y+2),(x+(3 if x<CX else -3),y+6),L_DD)
    lampset=set()
    if tier==1:
        # two rail sections gone, one of them hanging down by its last bolt; nothing lit
        for (xa,xb) in ((CX-27,CX-15),(CX+9,CX+25)):
            for x in range(xa,xb):
                y=arc(x)
                for yy in range(y-7,y):
                    if P[x,yy] in (L_M,L_D): P[x,yy]=TANK_BASE[(x,yy)] if inside(x,yy) else (0,0,0,0)
        hx,hy=CX+25,arc(CX+25)-7
        Ln((hx,hy),(hx-9,hy+15),L_D); Ln((hx-3,hy+5),(hx-7,hy+3),L_D); Ln((hx-6,hy+10),(hx-10,hy+8),L_D)                 # the hanging rail piece and two of its posts
        # a bracing rod has let go at its lower end and hangs straight down from its joint
        jx,_=at('FR',102); Ln((jx,103),(jx-1,126),L_D)
        jx2,_=at('OL',134); Ln((jx2+1,135),(jx2+3,152),L_DD)
    if tier==2:
        # squatters: a rail section gone with a rope across, a tarp lean-to tied from the rail up onto the tank, a scrap patch
        # riveted over a leak, a bucket on a rope for hauling water
        for x in range(CX-27,CX-15):
            y=arc(x)
            for yy in range(y-7,y):
                if P[x,yy] in (L_M,L_D): P[x,yy]=TANK_BASE[(x,yy)] if inside(x,yy) else (0,0,0,0)
        for x in range(CX-28,CX-13): P[x,arc(x)-5+round(1.5*math.sin((x-(CX-28))/15*math.pi))]=(150,132,100,255)       # sagging rope
        TP=(104,100,80,255); TPD=(78,76,64,255); TPL=(126,120,96,255)
        for x in range(CX+7,CX+27):                                                                                      # a tarp windbreak roped along the rail (below the name)
            y=arc(x); top=y-9+(1 if (x-CX)%7 in (3,4) else 0)
            for yy in range(top,y+1): P[x,yy]=TPD if (x-(CX+7))%6==5 else (TPL if yy==top else TP)
        for x in (CX+6,CX+27):
            for yy in range(arc(x)-10,arc(x)+2): P[x,yy]=OUT
        for x in (CX+7,CX+16,CX+26): P[x,arc(x)-10]=(150,132,100,255); P[x,arc(x)-11]=(150,132,100,255)                    # rope ties
        # scrap patch riveted over a leak, WRAPPED on the bowl: its side edges follow the tank's meridians (they lean in toward the
        # bottom), its top and bottom follow the weld rings (they dip toward the side), and it takes the tank's own shading
        cells={}
        for r_ in range(0,8):
            yc=42+r_; hw=RX*math.sqrt(max(0.0,1-((yc-TCY)/RY)**2))
            n_=14
            for c_ in range(n_+1):
                ph=math.radians(-44+30*c_/n_); xx=CX+hw*math.sin(ph); yy=yc+2.0*((xx-CX)/max(hw,1))**2
                key=(int(round(xx)),int(round(yy)))
                edge=(r_ in (0,7)) or (c_ in (0,n_))
                if key not in cells or edge: cells[key]=(r_,c_,edge)
        for (xx,yy),(r_,c_,edge) in cells.items():
            if not inside(xx,yy): continue
            u_=TANK_BASE[(xx,yy)]; k_=max(0.86,min(1.25,(0.3*u_[0]+0.59*u_[1]+0.11*u_[2])/112.0))
            base=(62,48,44) if edge else ((150,120,96) if r_==1 else (120,96,78) if c_%5 else (102,82,70))
            P[xx,yy]=(int(base[0]*k_),int(base[1]*k_),int(base[2]*k_),255)
        for (r_,c_) in ((1,1),(1,13),(6,1),(6,13)):                                                                       # rivets at the corners
            yc=42+r_; hw=RX*math.sqrt(max(0.0,1-((yc-TCY)/RY)**2)); ph=math.radians(-44+30*c_/14); xx=CX+hw*math.sin(ph); yy=yc+2.0*((xx-CX)/max(hw,1))**2
            P[int(round(xx)),int(round(yy))]=(40,34,34,255)
        lx_=int(round(CX+RX*math.sqrt(1-((50-TCY)/RY)**2)*math.sin(math.radians(-30))))
        for yy in range(51,57):
            if inside(lx_,yy): P[lx_,yy]=(70,84,104,255)                                                                  # the leak still weeps below the patch
        rx_=CX+33
        for yy in range(arc(rx_),arc(rx_)+26): P[rx_,yy]=(150,132,100,255)
        by_=arc(rx_)+26; d.rectangle([rx_-2,by_,rx_+2,by_+4],fill=(92,96,104,255),outline=OUT); d.line([rx_-1,by_+1,rx_+1,by_+1],fill=(150,156,164,255))
    # ---- lights
    glow=Image.new('RGBA',(W,H),(0,0,0,0)); gp=glow.load()
    def lamp(lx,ly,r0=8,a0=70):
        d.rectangle([lx,ly,lx+2,ly+2],fill=(255,226,150,255)); d.line([lx+1,ly+3,lx+1,ly+4],fill=L_DD); lampset.update((lx+i,ly+j) for i in range(3) for j in range(3))
        for y in range(ly-r0,ly+r0+3):
            for x in range(lx-r0,lx+r0+3):
                if 0<=x<W and 0<=y<H:
                    r=math.hypot(x-(lx+1),y-(ly+1))
                    if r<r0: gp[x,y]=(255,214,130,max(gp[x,y][3],int(a0*(1-r/r0)**1.3)))
    if tier==3: lamp(CX+20,arc(CX+20)-10)
    if tier==2:
        lamp(CX+1,arc(CX+1)-10,r0=7,a0=60)                                    # one lantern on the rail, beside the windbreak
        # the foot: a fire barrel and a crate; a stretch of the ladder is missing
        for y in range(118,140):
            x,_=at('OR',y)
            for xx in range(round(x)-7,round(x)-1): P[xx,y]=(0,0,0,0)
        # fire barrel: an old oil drum, soot-black rim, two ribs, rust, punched air holes that glow, low flames (no flat orange bar)
        bx=CX-24; DR=(98,88,84,255); DRD=(68,62,62,255); DRL=(128,114,104,255); SOOT=(34,32,34,255)
        for yy in range(G-10,G+1):
            for xx in range(bx,bx+7):
                if yy==G-10 and xx in (bx,bx+6): continue
                P[xx,yy]=DRD if xx<=bx+1 else (DRL if xx==bx+5 else DR)
        for yy in (G-7,G-3): d.line([bx,yy,bx+6,yy],fill=DRL); d.line([bx,yy+1,bx+6,yy+1],fill=DRD)
        d.line([bx+1,G-10,bx+5,G-10],fill=SOOT); d.line([bx,G-9,bx+6,G-9],fill=SOOT)
        for (xx,yy) in ((bx+2,G-5),(bx+3,G-5),(bx+3,G-1),(bx+4,G-2)): P[xx,yy]=(104,70,54,255)                              # rust
        P[bx+6,G-6]=DRD; P[bx+6,G-5]=DRD                                                                                  # a dent in the side
        fl=[(bx+2,G-11,(196,96,52,255)),(bx+3,G-11,(238,156,74,255)),(bx+4,G-11,(214,120,58,255)),(bx+3,G-12,(244,196,110,255)),(bx+4,G-12,(206,104,54,255)),(bx+2,G-12,(170,80,48,255)),(bx+3,G-13,(214,120,58,255)),
            (bx+2,G-8,(226,130,62,255)),(bx+4,G-8,(226,130,62,255))]
        for (xx,yy,c_) in fl: P[xx,yy]=c_; lampset.add((xx,yy))
        P[bx+5,G-15]=(214,120,58,255); lampset.add((bx+5,G-15))                                                           # one spark
        for y in range(G-22,G-4):
            for x in range(bx-8,bx+15):
                r_=math.hypot(x-(bx+3),y-(G-11))
                if r_<10: gp[x,y]=(255,164,88,max(gp[x,y][3],int(58*(1-r_/10)**1.3)))
        # a wooden crate in the village three-quarter view: lit front, darker left side going back, a sliver of top; planks, no black box
        cx0=CX+22; WF=(112,90,66,255); WFD=(90,72,54,255); WS=(70,56,44,255); WT=(134,110,82,255); WE=(44,34,30,255)
        for yy in range(G-7,G+1):
            for xx in range(cx0,cx0+9): P[xx,yy]=WF
        for yy in (G-5,G-2): d.line([cx0,yy,cx0+8,yy],fill=WFD)                                                           # plank gaps
        d.line([cx0,G-7,cx0,G],fill=WFD); d.line([cx0+8,G-7,cx0+8,G],fill=WFD); d.line([cx0+1,G-1,cx0+7,G-6],fill=WFD)    # corner posts + a brace
        for k_ in (1,2,3):                                                                                                # left side face going back: its foot rises 1 px
            up=0 if k_==1 else 1
            for yy in range(G-7-up,G+1-up): P[cx0-k_,yy]=WS
        for k_ in range(0,9): P[cx0+k_-1,G-8]=WT; P[cx0+k_-2,G-9-0]=WT                                                    # top, two rows deep
        P[cx0-3,G-9]=WT; P[cx0-3,G-8]=WS
        d.line([cx0,G,cx0+8,G],fill=WE); P[cx0-1,G]=WE; P[cx0-2,G-1]=WE; P[cx0-3,G-1]=WE                                  # where it meets the ground
    if tier>=4:
        # scrap-metal cover bolted to the rail beside the lookout
        for (xa,xb,hh,c1,c2) in (((CX+7,CX+17,9,(112,104,100,255),(88,82,84,255)),)+(((CX-14,CX-6,8,(120,96,84,255),(94,76,72,255)),) if tier>=5 else ())):
            for x in range(xa,xb+1):
                y=arc(x)
                for yy in range(y-hh,y): P[x,yy]=c1 if (x-xa)%3 else c2
                P[x,y-hh]=(160,150,140,255)
            for yy in range(arc(xa)-hh,arc(xa)): P[xa,yy]=OUT
            for yy in range(arc(xb)-hh,arc(xb)): P[xb,yy]=OUT
        lamp(CX-27,arc(CX-27)-10)
        if tier>=5:
            lamp(CX+24,arc(CX+24)+3,r0=7,a0=70)                 # (the lamp in the middle of the rail was removed, Jeremy 2026-11-25)
            # razor coil ring round the legs just under the tank (anti-climb guard): front arc, bows up like the catwalk
            x=CX-29
            while x<CX+25:
                yy=61+round(1.6*((x+3-CX)/29)**2)
                d.arc([x,yy-4,x+6,yy+3],180,360,fill=(214,218,224,255)); d.arc([x,yy-4,x+6,yy+3],0,180,fill=(92,98,114,255)); P[x+3,yy-4]=(244,246,248,255)
                x+=4
            # the shared survivor flag on a pole at the catwalk's left end
            pxl=CX-44; ya=arc(CX-35); d.line([pxl,1,pxl,ya+1],fill=(52,54,64,255)); d.line([pxl-1,2,pxl-1,ya+1],fill=(120,124,132,255)); d.line([pxl,ya,CX-35,ya],fill=(52,54,64,255)); d.line([pxl,ya-7,CX-35,ya-7],fill=(52,54,64,255))
            fl=Image.open('../pieces/flag_small_14x11.png').convert('RGBA'); im.alpha_composite(fl,(CX-43,2)); P=im.load(); d=ImageDraw.Draw(im)
        # spotlights on the rail ends, aimed 70 degrees below the horizon, outward; see-through beams (right from star 4, left at star 5)
        def spot(side):
            sx=CX+side*33; sy=arc(sx)-9; ang=math.radians(70); ux,uy=side*math.cos(ang),math.sin(ang); LEN=50
            ox,oy=sx+side*2,sy+3
            for y in range(sy,min(H,sy+LEN+8)):
                for x in range(0,W):
                    rx,ry=x-ox,y-oy; t=rx*ux+ry*uy; q=abs(-rx*uy+ry*ux)
                    if 2<t<LEN:
                        half=1.5+t*0.17
                        if q<half:
                            a_=int(120*(1-t/LEN)**1.1*(1-(q/half)**2*0.6))
                            gp[x,y]=(255,240,196,max(gp[x,y][3],a_))
            m=lambda dx: sx+side*dx
            d.polygon([(m(-1),sy),(m(3),sy-1),(m(6),sy+3),(m(2),sy+5)],fill=(54,58,70,255),outline=OUT)
            d.line([(m(2),sy+5),(m(6),sy+3)],fill=(255,244,206,255)); P[m(4),sy+5]=(255,244,206,255)
            d.line([(m(0),sy-1),(m(-2),sy+6)],fill=L_DD)
        spot(1)
        if tier>=5: spot(-1)
        # ---- the foot: security fence with a razor coil along its top, a gate, an anti-climb plate, water drums on a pallet, a yard lamp
        for y in range(G-34,G-4):
            x,_=at('OR',y)
            for xx in range(round(x)-8,round(x)-1): P[xx,y]=(96,92,98,255) if (y//2)%2 else (84,80,88,255)
        lamp(CX-9,G-44,r0=9,a0=80)
        def drum(bx,by):
            # a blue water barrel as a round drum, not a boxed rectangle: no black outline, a lit lid seen slightly from above with its
            # bung cap, the body shaded round (dark edges, a highlight right of centre), two raised ribs, grime toward the bottom
            body=[(26,52,86),(36,70,108),(46,90,132),(50,96,138),(80,128,164),(52,96,136),(30,60,96)]
            for k in range(1,6): P[bx+k,by]=(104,146,176,255) if k!=1 else (78,120,154,255)             # lid
            P[bx+4,by]=(34,52,76,255)                                                                   # bung cap
            for k in range(7): P[bx+k,by+1]=tuple(min(255,int(v*1.12)) for v in body[k])+(255,)         # top rim
            for r in range(2,10):
                for k in range(7):
                    c=body[k]
                    if r in (4,7): c=tuple(min(255,int(v*1.22+6)) for v in c)                           # rib catches the light
                    elif r in (5,8): c=tuple(int(v*0.84) for v in c)                                    # shadow under the rib
                    if r==9: c=(int(c[0]*0.7+28),int(c[1]*0.7+24),int(c[2]*0.7+20))                     # dirt at the foot
                    P[bx+k,by+r]=c+(255,)
        def pallet(px0):
            d.rectangle([px0-1,G-3,px0+21,G-1],fill=(112,88,60,255)); d.line([px0-1,G-3,px0+21,G-3],fill=(150,120,84,255))
            for k in range(3): drum(px0+k*7,G-13)
            for k in range(2): drum(px0+3+k*7,G-22)
        pallet(CX+22)
        if tier>=5: pallet(CX-33)
        MESH=(150,158,170,150); MESHD=(112,120,136,150); POST=(176,182,190,255); POSTD=(104,110,124,255)
        fence=Image.new('RGBA',(W,H),(0,0,0,0)); fp=fence.load()
        for y in range(ft+1,G+1):
            for x in range(xA,xB+1):
                if (x+y)%4==0 or (x-y)%4==0: fp[x,y]=MESH
        for i in range(1,SX+1):
            x=xA-i; yb=G-sy_(i)
            for y in range(yb-FH+1,yb+1):
                if (x+y)%4==0 or (x-y)%4==0: fp[x,y]=MESHD
        im.alpha_composite(fence); P=im.load(); d=ImageDraw.Draw(im)
        d.line([xA,ft,xB,ft],fill=POST); d.line([xA,G,xB,G],fill=POSTD)
        d.line([xA,ft,xA-SX,ft-SR],fill=POSTD); d.line([xA,G,xA-SX,G-SR],fill=(78,84,98,255))
        for x in list(range(xA,xB,13))+[xB]:
            d.line([x,ft-1,x,G],fill=POST)
            if x+1<=xB: d.line([x+1,ft,x+1,G],fill=POSTD)
        for i in (9,18,SX):
            x=xA-i; d.line([x,ft-sy_(i)-1,x,G-sy_(i)],fill=POSTD)
        gx0,gx1=CX-10,CX+16                                                        # two-leaf gate
        d.rectangle([gx0,ft,gx1,G],outline=POST); d.line([(gx0+gx1)//2,ft,(gx0+gx1)//2,G],fill=POST)
        d.line([gx0,G,(gx0+gx1)//2,ft],fill=POSTD); d.line([(gx0+gx1)//2,ft,gx1,G],fill=POSTD)
        # warning sign wired to the gate: a weathered tin plate (no black box): faded cream, a dull red band, two lines of worn lettering,
        # a rusted corner, a darker lower / right edge for its thickness, two wire ties
        sx0,sy0=gx0+3,ft+3
        for yy in range(5):
            for xx in range(8):
                c=(182,174,148) if yy>0 else (204,196,168)
                if yy==1: c=(138,60,48)
                if yy in (2,3) and 1<=xx<=6 and (xx+yy)%4!=0: c=(74,66,60) if yy==2 or xx<5 else c
                if yy==4 or xx==7: c=(128,120,102)
                if (xx,yy) in ((0,4),(1,4),(0,3)): c=(120,84,62)
                P[sx0+xx,sy0+yy]=c+(255,)
        P[sx0+1,sy0-1]=POSTD; P[sx0+6,sy0-1]=POSTD
        i=SX                                                                       # razor coil along the top: side run first (dimmer), then the front
        while i>2:
            x=xA-i; yy=ft-sy_(i)
            d.arc([x,yy-7,x+5,yy],180,360,fill=(170,176,186,255)); d.arc([x,yy-7,x+5,yy],0,180,fill=(84,90,104,255))
            i-=3
        x=xA
        while x<xB-4:
            d.arc([x,ft-7,x+6,ft],180,360,fill=(214,218,224,255)); d.arc([x,ft-7,x+6,ft],0,180,fill=(96,100,114,255)); P[x+3,ft-7]=(244,246,248,255)
            x+=4
        if tier>=5:
            lamp(gx1+1,ft-6,r0=9,a0=84)
            gsx=gx0-8; fy=G; rows=[" ccc ","cccc ", " ss  "," ss  ","ooooo","ooOoo","ooOoo"," ooo "," ddd "," d d "," d d "," d d ","bb bb"]
            col={'c':(52,60,46,255),'s':(204,158,124,255),'o':(78,92,62,255),'O':(56,66,48,255),'d':(38,42,48,255),'b':(24,24,28,255)}
            for r,row in enumerate(rows):
                for k,ch in enumerate(row):
                    if ch!=' ': P[gsx+k,fy-12+r]=col[ch]
            Ln((gsx-1,fy-5),(gsx+6,fy-9),(26,26,30,255))
    if tier<=2:
        sat,bri=(0.80,0.82) if tier==2 else (0.62,0.66)
        P=im.load()
        for y in range(H):
            for x in range(W):
                c=P[x,y]
                if c[3]==0 or (x,y) in lampset: continue
                gr=0.3*c[0]+0.59*c[1]+0.11*c[2]
                P[x,y]=(int((gr+(c[0]-gr)*sat)*bri),int((gr+(c[1]-gr)*sat)*bri),int((gr+(c[2]-gr)*sat)*bri),c[3])
    if tier==1:
        P=im.load(); d=ImageDraw.Draw(im)
        # long stretches of the ladder are gone
        for (ya,yb) in ((66,92),(112,150),(168,186)):
            for y in range(ya,yb):
                x,_=at('OR',y)
                for xx in range(round(x)-8,round(x)-1): P[xx,y]=(0,0,0,0)
        # the hatch plate has come off and lies on the ground; the opening is black
        for yy in range(G-13,G-4):
            for xx in range(CX-2,CX+2): P[xx,yy]=(8,8,12,255)
        d.polygon([(CX+12,G-2),(CX+19,G-3),(CX+20,G-1),(CX+13,G)],fill=(52,64,74,255)); d.line([(CX+12,G-2),(CX+19,G-3)],fill=(78,92,100,255))
        # a slow leak at the tank's far (left) edge: a wet streak down the bowl, then separate drops falling, further apart as they
        # speed up (separate marks, so it does not read as a rope), and a small wet patch on the ground
        WET=(40,52,70,255); DROP=(150,176,198,255)
        for (x,y) in ((CX-21,38),(CX-21,39),(CX-22,40),(CX-22,41),(CX-22,42),(CX-23,43),(CX-23,44),(CX-23,45),(CX-23,46)):
            if P[x,y][3] and P[x,y]!=OUT: P[x,y]=WET
        dxp=CX-24
        for (ya,ln) in ((49,2),(54,2),(61,2),(71,2),(84,2),(101,2),(122,2),(148,1)):
            for yy in range(ya,ya+ln): P[dxp,yy]=DROP
        d.line([dxp-3,G,dxp+4,G],fill=(34,40,52,255)); P[dxp,G]=(96,116,136,255); P[dxp+1,G]=(70,86,104,255)
        # rubble and dead weeds round the footings (in front of everything)
        import random as _r2
        q=_r2.Random(23)
        for i in range(9):
            x=q.randint(CX-46,CX+44); w_=q.choice((2,3,3,4))
            d.rectangle([x,G-q.choice((0,1,1)),x+w_,G],fill=q.choice(((70,68,66,255),(54,54,54,255),(84,80,74,255))))
        WD=((92,84,58,255),(70,66,48,255),(108,98,66,255))
        for i in range(13):
            x=q.randint(CX-48,CX+46); hgt=q.randint(4,9); lean=q.choice((-1,0,0,1))
            for k_ in range(3):
                x0_=x+k_*2-2; top=G-hgt+abs(k_-1)*2+q.randint(0,1)
                Ln((x0_,G),(x0_+lean*(1 if k_!=1 else 2),top),WD[(i+k_)%3])
    im=Image.alpha_composite(im,glow)
    return im
if __name__=='__main__':
    # Rebuilds the five finals next to this script's parent folder. Each star uses its own PixelLab-painted tank (../pieces/).
    import os
    here=os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
    TEX={1:'tank_pixellab_t1_80x64.png',2:'tank_pixellab_t2_80x64.png',3:'tank_pixellab_pick_80x64.png',4:'tank_pixellab_pick_80x64.png',5:'tank_pixellab_pick_80x64.png'}
    for t in (1,2,3,4,5):
        TANK_TEX=Image.open(os.path.join('..','pieces',TEX[t])).convert('RGBA')
        make(tier=t).save(os.path.join('..',f'watertower_t{t}_final_128x208.png'))
