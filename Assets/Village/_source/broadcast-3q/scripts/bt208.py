# Broadcast tower T3 (kind `nights`), 128x208, BACK-ROW detail scale, village three-quarter camera:
# front faces flat, LEFT side faces recede; side-face lines drop to the left above eye level and rise below it
# (same numbers as the Clock tower: ~0.0037 px/px per px of height above ~48 px, -0.2 at the ground).
from PIL import Image, ImageDraw
import random
W,H=144,208; G=H-1      # 144 wide since T4 (2026-11-24): 16px of open air on the right for the floodlight's 45-degree beam; the tower itself still ends at x 126
OUT=(20,18,28)
ST_L=(168,172,180); ST_M=(126,130,142); ST_D=(84,88,102); ST_DD=(56,58,72); RUST=(120,78,62)
CON=(128,126,120); COND=(88,88,86)
def Y(h): return G-h
def sl(h): return 0.0037*h if h>=48 else -0.2+0.0079*h
def sideY(h,dx): return Y(h)+dx*sl(h)
CX=90; PH=138; TOP=184
def make(soldier=False, steel_only=False, station_only=False, tier=3, figure=None, front_rail=True, bands=False):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im); P=im.load(); rnd=random.Random(11)
    L=lambda a,b,c,w=1: d.line([a,b],fill=c+(255,),width=w)
    # painted bands (T5): dull aviation red / off-white, alternating by section, counted from the TOP so the top band is red
    RED=((158,76,62),(124,58,52),(84,44,46),(58,34,42)); WHT=((192,190,182),(150,150,148),(100,102,112),(64,66,78)); GALV=(ST_L,ST_M,ST_D,ST_DD)
    def pal(i,n,off=0):
        if not bands: return GALV
        if off==9: return RED if (n-1-i)*3//n!=1 else WHT          # the slim upper mast: thirds, red / white / red from the top
        return RED if (n-1-i+off)%2==0 else WHT
    def lattice(h0,h1,wb,wt_,n,xb=True,legw=2,sideK=0.36,ease=1.12,off=0):
        half=lambda h: (wb+(wt_-wb)*(h-h0)/(h1-h0))/2
        fl=lambda h: CX-half(h); fr=lambda h: CX+half(h); sw=lambda h: 2*half(h)*sideK+0.6
        bl=lambda h: (fl(h)-sw(h), sideY(h,sw(h))); br=lambda h: (fr(h)-sw(h), sideY(h,sw(h)))
        hs=[h0+(h1-h0)*(1-(1-i/n)**ease) for i in range(n+1)]; secs=list(zip(hs,hs[1:]))
        for i,(a,b) in enumerate(secs):
            l_,m_,d_,dd_=pal(i,n,off); L(br(a),br(b),dd_); L(bl(a),br(a),dd_)
            if xb: L(bl(a),br(b),dd_)
        for i,(a,b) in enumerate(secs):
            l_,m_,d_,dd_=pal(i,n,off); L(bl(a),bl(b),d_,legw); L(bl(a),(fl(a),Y(a)),d_)
            if xb or i%2==0: L(bl(a),(fl(b),Y(b)),d_)
            if xb or i%2==1: L((fl(a),Y(a)),bl(b),d_)
        for i,(a,b) in enumerate(secs):
            l_,m_,d_,dd_=pal(i,n,off); L((fl(a),Y(a)),(fr(a),Y(a)),m_)
            if xb or i%2==0: L((fl(a),Y(a)),(fr(b),Y(b)),m_)
            if xb or i%2==1: L((fr(a),Y(a)),(fl(b),Y(b)),m_)
        return fl,fr,bl,br,secs
    def legs(fl,fr,secs,legw,off=0):
        n=len(secs)
        for i,(a,b) in enumerate(secs):
            l_,m_,d_,dd_=pal(i,n,off); L((fl(a),Y(a)),(fl(b),Y(b)),m_,legw); L((fr(a),Y(a)),(fr(b),Y(b)),l_,legw)
    if not station_only:
        # ---------- crew platform, part 1 (wraps the tower: the deck overhangs the tower top by the SAME 10px on its left and right (front edge = tower front CX-9..CX+9, plus 10 each side, shifted 3px right because it is 3px of depth nearer), and 3px of depth in front and behind) ----------
        # depth runs left 1px and down sl(PH) px per px going back, so the front edge sits 2px ABOVE the line where the tower's front legs
        # meet the deck, and the back edge 5px below it: the four legs run up into the middle of the underside.
        dl,dr=CX-16,CX+22; py=Y(PH); dep=13; pf=py-2; drop=round(dep*sl(PH)); RH=10
        d.line([dl-dep,pf-RH+drop,dr-dep,pf-RH+drop],fill=ST_D+(255,))                    # back rail
        d.line([dl-dep,pf-RH+5+drop,dr-dep,pf-RH+5+drop],fill=ST_DD+(255,))
        for x in (dl-dep,dl-dep+11,dl-dep+23,dr-dep): d.line([x,pf-RH+drop,x,pf+drop],fill=ST_DD+(255,))
        d.polygon([(dl,pf+2),(dr,pf+2),(dr-dep,pf+2+drop),(dl-dep,pf+2+drop)],fill=(44,46,58,255))   # underside
        for k in (3,6,9):                                                                 # joists seen from below
            kk=round(k*sl(PH)); d.line([dl-k,pf+2+kk,dr-k,pf+2+kk],fill=(58,60,74,255))
        d.line([(dr,pf+2),(dr-dep,pf+2+drop)],fill=(34,36,46,255))
        # ---------- base lattice ----------
        fl,fr,bl,br,secs=lattice(0,PH,44,18,8,off=1)
        # ladder up the front face to the platform hatch
        for hh in range(3,PH,3): d.line([CX-2,Y(hh),CX+1,Y(hh)],fill=ST_D+(255,))
        d.line([CX-2,Y(PH),CX-2,Y(2)],fill=(100,104,116,255)); d.line([CX+1,Y(PH),CX+1,Y(2)],fill=(140,144,154,255))
        legs(fl,fr,secs,2,off=1)
        for a,b in secs[1:]:                                    # gusset plates at the joints
            for x in (fl(a),fr(a)): d.rectangle([x-1,Y(a)-1,x+1,Y(a)+1],fill=ST_D+(255,))
        if tier>=5:
            for x in (fl(84),fr(84)):
                x=int(round(x)); d.rectangle([x-1,Y(84)-2,x+1,Y(84)],fill=(206,58,46,255)); d.point((x,Y(84)-1),fill=(255,150,116,255)); d.line([x-1,Y(84)+1,x+1,Y(84)+1],fill=ST_DD+(255,))
        for _ in range(60):
            x=rnd.randint(40,116); y=rnd.randint(Y(PH),G-6)
            if P[x,y][3] and sum(P[x,y][:3])>330: P[x,y]=RUST+(255,)
        if tier>=4:
            d.rectangle([CX-5,Y(34),CX+4,Y(6)],fill=OUT+(255,)); d.rectangle([CX-4,Y(33),CX+3,Y(7)],fill=(92,98,104,255)); d.line([CX-4,Y(33),CX-4,Y(7)],fill=(66,70,78,255))
            for hh in (30,20,10): d.point((CX-2,Y(hh)),fill=(150,154,160,255)); d.point((CX+1,Y(hh)),fill=(150,154,160,255))
            d.rectangle([CX-3,Y(27),CX+2,Y(23)],fill=(186,150,58,255)); d.line([CX-2,Y(25),CX+1,Y(25)],fill=(40,36,30,255))
            for hw in ((40,62) if tier>=5 else (40,)):                                          # coil across the front face and round the side
                x0_=int(fl(hw))-int((fr(hw)-fl(hw))*0.36)-1; x1_=int(fr(hw))+2
                for x in range(x0_,x1_,4):
                    yy=Y(hw)+ (round((int(fl(hw))-x)*sl(hw)) if x<fl(hw) else 0)
                    col=(150,150,172) if x>=fl(hw) else (104,104,126)
                    d.arc([x,yy-3,x+5,yy+3],0,360,fill=col+(255,))
                    d.point((x+2,yy-3),fill=(196,196,214,255))
        for (x,y) in ((fl(0),Y(0)),(fr(0),Y(0))):
            d.rectangle([x-3,y-3,x+4,y],fill=CON+(255,)); d.line([x-3,y,x+4,y],fill=COND+(255,)); d.line([x-3,y-3,x+4,y-3],fill=(150,148,140,255))
        for bx,by in (bl(0),br(0)): d.rectangle([bx-3,by-3,bx+3,by],fill=COND+(255,))
        # ---------- crew platform, part 2: left side fascia + side railing ----------
        d.polygon([(dl,pf),(dl,pf+2),(dl-dep,pf+2+drop),(dl-dep,pf+drop)],fill=(70,72,86,255))
        d.line([(dl,pf),(dl-dep,pf+drop)],fill=(92,96,110,255))
        d.line([(dl-dep,pf-RH+drop),(dl,pf-RH)],fill=ST_D+(255,)); d.line([(dl-dep,pf-RH+5+drop),(dl,pf-RH+5)],fill=ST_DD+(255,))
        mxp=dl-dep//2; myp=round((dep//2)*sl(PH)); d.line([mxp,pf-RH+myp,mxp,pf+myp],fill=ST_D+(255,))
        d.line([dl-dep,pf-RH+drop,dl-dep,pf+drop],fill=ST_D+(255,))
        # ---------- upper mast ----------
        ufl,ufr,ubl,ubr,usecs=lattice(PH+1,TOP,11,8,5,xb=False,legw=1,sideK=0.4,ease=1.0,off=9)
        d.line([CX-1,py,CX-1,Y(TOP)],fill=(60,62,74,255))
        legs(ufl,ufr,usecs,2,off=9)
        if soldier:
            sx0=dl+3; f=pf+1
            OL=(84,92,66); OLD=(60,66,50); SK=(184,140,108)
            d.rectangle([sx0+1,f-9,sx0+3,f],fill=(44,46,44,255)); d.rectangle([sx0+5,f-9,sx0+7,f],fill=(44,46,44,255))
            d.rectangle([sx0,f-18,sx0+8,f-10],fill=OL+(255,)); d.line([sx0,f-18,sx0,f-11],fill=OLD+(255,)); d.line([sx0,f-10,sx0+8,f-10],fill=(40,38,34,255))
            d.rectangle([sx0+2,f-22,sx0+6,f-19],fill=SK+(255,)); d.rectangle([sx0+1,f-24,sx0+6,f-23],fill=OLD+(255,)); d.line([sx0+6,f-23,sx0+8,f-23],fill=OLD+(255,))
            d.line([sx0-2,f-11,sx0+11,f-19],fill=(30,30,34,255),width=2)
        if figure is not None:
            im.alpha_composite(figure); d=ImageDraw.Draw(im); P=im.load()
        if front_rail:
            d.rectangle([dl,pf,dr,pf+2],fill=ST_D+(255,)); d.line([dl,pf,dr,pf],fill=ST_M+(255,)); d.line([dl,pf+2,dr,pf+2],fill=ST_DD+(255,))   # front fascia
            for x in (dl,dl+9,dl+19,dl+29,dr): d.line([x,pf-RH,x,pf-1],fill=ST_M+(255,))
            d.line([dl,pf-RH,dr,pf-RH],fill=ST_L+(255,)); d.line([dl,pf-RH+5,dr,pf-RH+5],fill=ST_M+(255,))
        if tier>=4 and front_rail:                                  # floodlight on the platform's right end, at railing height just under the big dish, tilted 45 degrees outward (Jeremy 2026-11-24)
            ux,uy=dr+4,pf-7                                         # top corner of the turned housing
            d.line([dr,pf-5,ux-2,pf-5],fill=ST_D+(255,)); d.line([dr,pf-4,ux-3,pf-4],fill=ST_DD+(255,))   # bracket off the end post
            d.polygon([(ux-4,uy+3),(ux,uy-1),(ux+5,uy+4),(ux+1,uy+8)],fill=OUT+(255,))
            d.polygon([(ux-3,uy+3),(ux,uy),(ux+4,uy+4),(ux+1,uy+7)],fill=(80,84,96,255)); d.line([(ux-3,uy+3),(ux,uy)],fill=(114,118,130,255))
            d.line([(ux+4,uy+4),(ux+1,uy+7)],fill=(236,244,255,255)); d.point((ux+3,uy+5),fill=(255,255,255,255)); d.point((ux+2,uy+6),fill=(255,255,255,255))
        # ---------- cap, spire, whips, beacon ----------
        ty=Y(TOP); d.rectangle([CX-8,ty-1,CX+7,ty],fill=ST_D+(255,)); d.line([CX-8,ty-1,CX+7,ty-1],fill=ST_M+(255,))
        for x in (CX-8,CX-3,CX+2,CX+7): d.line([x,ty-5,x,ty-2],fill=ST_M+(255,))
        d.line([CX-8,ty-5,CX+7,ty-5],fill=ST_L+(255,))
        d.rectangle([CX-1,Y(TOP+12),CX,ty-2],fill=ST_M+(255,)); d.line([CX,Y(TOP+12),CX,ty-2],fill=ST_L+(255,))
        d.line([CX+5,Y(TOP+15),CX+5,ty-5],fill=ST_D+(255,)); d.line([CX-6,Y(TOP+10),CX-6,ty-5],fill=ST_D+(255,))
        d.rectangle([CX-3,Y(TOP+13),CX+2,Y(TOP+13)],fill=ST_D+(255,))
        d.rectangle([CX-3,Y(TOP+19),CX+2,Y(TOP+14)],fill=(206,58,46,255)); d.rectangle([CX-2,Y(TOP+20),CX+1,Y(TOP+20)],fill=(206,58,46,255))
        d.rectangle([CX-3,Y(TOP+19),CX-3,Y(TOP+14)],fill=(146,38,36,255)); d.rectangle([CX,Y(TOP+18),CX+1,Y(TOP+16)],fill=(255,150,116,255)); d.point((CX+1,Y(TOP+18)),fill=(255,210,180,255))
        if tier>=5:                                                 # a pair of loudspeaker horns off the cap platform's left side, mouths facing left
            d.line([CX-13,ty-4,CX-8,ty-4],fill=ST_D+(255,)); d.line([CX-13,ty-10,CX-13,ty+4],fill=ST_DD+(255,))     # arm + yoke
            for cyh in (ty-8,ty+1):
                mx=CX-18
                d.polygon([(mx-1,cyh-4),(mx+3,cyh-4),(mx+7,cyh-2),(mx+7,cyh+2),(mx+3,cyh+4),(mx-1,cyh+4)],fill=OUT+(255,))
                d.polygon([(mx+2,cyh-3),(mx+6,cyh-1),(mx+6,cyh+1),(mx+2,cyh+3)],fill=(112,116,128,255)); d.line([mx+2,cyh-3,mx+6,cyh-1],fill=(150,154,164,255))
                d.rectangle([mx,cyh-3,mx+1,cyh+3],fill=(182,186,194,255)); d.rectangle([mx,cyh-2,mx,cyh+2],fill=(58,60,72,255)); d.point((mx,cyh),fill=(34,34,44,255))
        # ---------- panel antennas ----------
        PA=(202,196,176); PAD=(134,132,126); hp=TOP-14
        for x,c,cs in ((int(ufl(hp))-6,PAD,(100,100,98)),(CX-1,PA,PAD)):
            d.rectangle([x-1,Y(hp+13),x+3,Y(hp-1)],fill=OUT+(255,)); d.rectangle([x,Y(hp+12),x+2,Y(hp)],fill=c+(255,)); d.line([x,Y(hp+12),x,Y(hp)],fill=cs+(255,))
        # ---------- BIG dish (front-right) ----------
        dh=TOP-23; ax_=int(ufr(dh)); cxd=ax_+14; ry=15; rx=10
        d.line([ax_,Y(dh+5),cxd-2,Y(dh+5)],fill=ST_D+(255,),width=2); d.line([ax_,Y(dh-5),cxd-2,Y(dh-5)],fill=ST_D+(255,),width=2); d.line([ax_+3,Y(dh+5),ax_+3,Y(dh-5)],fill=ST_DD+(255,))
        d.ellipse([cxd-rx-1,Y(dh+ry+1),cxd+rx+1,Y(dh-ry-1)],fill=OUT+(255,))
        d.ellipse([cxd-rx,Y(dh+ry),cxd+rx,Y(dh-ry)],fill=(112,116,126,255))          # rim / back edge
        d.ellipse([cxd-rx+2,Y(dh+ry-1),cxd+rx,Y(dh-ry+1)],fill=(146,150,158,255))     # bowl, shade side
        d.ellipse([cxd-rx+4,Y(dh+ry-2),cxd+rx,Y(dh-ry+3)],fill=(168,172,178,255))
        d.ellipse([cxd-rx+7,Y(dh+ry-4),cxd+rx-1,Y(dh-ry+7)],fill=(192,194,198,255))   # lit part
        d.arc([cxd-rx+2,Y(dh+ry-1),cxd+rx,Y(dh-ry+1)],190,350,fill=(96,100,112,255))
        for (ex,ey) in ((cxd-2,Y(dh+ry-3)),(cxd-3,Y(dh-ry+3)),(cxd+rx-2,Y(dh-3))):
            d.line([ex,ey,cxd+rx+5,Y(dh+3)],fill=ST_DD+(255,))
        d.rectangle([cxd+rx+4,Y(dh+5),cxd+rx+7,Y(dh+2)],fill=ST_L+(255,)); d.rectangle([cxd+rx+4,Y(dh+2),cxd+rx+7,Y(dh+2)],fill=ST_D+(255,))
        for q in ((cxd-4,Y(dh-9)),(cxd-3,Y(dh-10)),(cxd-5,Y(dh-8)),(cxd+1,Y(dh-12)),(cxd-6,Y(dh+6))): d.point(q,fill=RUST+(255,))
        # ---------- drum dish (shaded left side) ----------
        d2=TOP-17; lx=int(ubl(d2)[0])-12
        d.line([lx+8,Y(d2),lx+13,Y(d2)],fill=ST_DD+(255,),width=2)
        d.ellipse([lx-1,Y(d2+8),lx+8,Y(d2-8)],fill=OUT+(255,)); d.ellipse([lx,Y(d2+7),lx+7,Y(d2-7)],fill=(96,100,112,255)); d.ellipse([lx,Y(d2+6),lx+5,Y(d2-6)],fill=(126,130,140,255)); d.ellipse([lx+1,Y(d2+4),lx+3,Y(d2-3)],fill=(148,152,160,255))
        # ---------- equipment cabinet at the tower foot + conduit ----------
        ex0,ex1,eh=97,115,20
        d.rectangle([ex0-1,Y(eh)-1,ex1+1,G],fill=OUT+(255,)); d.rectangle([ex0,Y(eh),ex1,G-1],fill=(104,110,108,255))
        d.polygon([(ex0,Y(eh)),(ex0-4,Y(eh)-1),(ex0-4,G-1),(ex0,G-1)],fill=(70,74,76,255)); d.line([ex0-5,Y(eh)-2,ex0-5,G-1],fill=OUT+(255,))
        d.rectangle([ex0-5,Y(eh)-3,ex1+1,Y(eh)-1],fill=(132,138,134,255)); d.line([ex0-5,Y(eh)-1,ex1+1,Y(eh)-1],fill=(74,78,80,255))
        d.line([ex0+9,Y(eh)+1,ex0+9,G-2],fill=(70,74,76,255))
        for yy in range(Y(eh)+4,Y(eh)+11,2): d.line([ex0+2,yy,ex0+6,yy],fill=(60,64,66,255)); d.line([ex0+12,yy,ex0+16,yy],fill=(60,64,66,255))
        d.rectangle([ex0+11,G-8,ex0+16,G-4],fill=(190,160,60,255)); d.point((ex0+13,G-7),fill=(40,36,30,255)); d.point((ex0+14,G-6),fill=(40,36,30,255)); d.point((ex0+13,G-5),fill=(40,36,30,255))
        d.line([ex0-6,G-1,ex1+2,G],fill=COND+(255,)); d.rectangle([ex0-6,G,ex1+2,G],fill=COND+(255,))
        d.line([ex0+4,Y(eh)-4,ex0+4,Y(eh+10)],fill=ST_DD+(255,)); d.line([ex0+4,Y(eh+10),int(fr(eh+14)),Y(eh+14)],fill=ST_DD+(255,))
    if steel_only: return im
    # ---------- station (in front, left) ----------
    x0,x1=15,63; sdw=12; wt=44; fnd=3; rh=11
    WF=(112,100,90); WFd=(82,72,66); WFl=(130,118,104); WS=(68,60,58); WSd=(52,46,46); FR=(162,154,138); FRd=(112,106,96)
    for i in range(sdw+1):
        x=x0-i; yb=round(sideY(0,i)); yt=round(sideY(wt,i))
        for y in range(yt,yb+1): P[x,y]=(WSd if i%4==0 else WS)+(255,)
        for y in range(yb-fnd+1,yb+1): P[x,y]=COND+(255,)
    for i in range(4,10):                                       # side window, dark
        for hh in range(17,31):
            edge=(i in (4,9)) or hh in (17,30)
            P[x0-i,round(sideY(hh,i))]=((104,98,90) if edge else ((36,40,52) if hh<24 else (30,32,42)))+(255,)
    for x in range(x0,x1):
        k=(x-x0)%5
        for y in range(Y(wt),Y(fnd)+1): P[x,y]=(WFd if k==0 else (WFl if k==1 else WF))+(255,)
    for _ in range(90):
        x=rnd.randint(x0,x1-1); y=rnd.randint(Y(wt),Y(fnd)); P[x,y]=tuple(int(v*0.88) for v in P[x,y][:3])+(255,)
    for x in range(x0,x1):
        for y in range(Y(8),Y(fnd)+1): P[x,y]=tuple(int(v*(0.80 if y>Y(5) else 0.9)) for v in P[x,y][:3])+(255,)
    d.rectangle([x0-1,Y(fnd)+1,x1,G],fill=CON+(255,)); d.line([x0-1,G,x1,G],fill=COND+(255,)); d.line([x0-1,Y(fnd)+1,x1,Y(fnd)+1],fill=(150,148,140,255))
    d.line([x0,Y(wt),x0,Y(fnd)],fill=WFl+(255,)); d.line([x1-1,Y(wt),x1-1,Y(fnd)],fill=WFd+(255,))
    # door (leaf 11x33) + frame + step + small pane
    ax=21; DR=(62,72,68); DRd=(46,54,52)
    d.rectangle([ax-2,Y(36)-1,ax+12,Y(fnd)],fill=FR+(255,)); d.line([ax-2,Y(36)-1,ax-2,Y(fnd)],fill=FRd+(255,))
    d.rectangle([ax,Y(35),ax+10,Y(fnd)],fill=DR+(255,))
    d.rectangle([ax+2,Y(32),ax+8,Y(23)],fill=(34,40,50,255)); d.line([ax+5,Y(32),ax+5,Y(23)],fill=DRd+(255,)); d.point((ax+3,Y(31)),fill=(70,80,96,255))
    d.rectangle([ax+2,Y(19),ax+8,Y(6)],fill=DRd+(255,)); d.rectangle([ax+3,Y(18),ax+7,Y(7)],fill=DR+(255,))
    d.rectangle([ax+9,Y(20),ax+9,Y(18)],fill=(196,176,112,255))
    d.rectangle([ax-4,Y(2),ax+14,G],fill=(156,154,146,255)); d.line([ax-4,G,ax+14,G],fill=COND+(255,)); d.line([ax-4,Y(2),ax+14,Y(2)],fill=(176,174,164,255))
    # lit window 9x13 with blinds
    wx=44; d.rectangle([wx-2,Y(31),wx+10,Y(15)],fill=FR+(255,)); d.line([wx-2,Y(31),wx-2,Y(15)],fill=FRd+(255,))
    d.rectangle([wx,Y(29),wx+8,Y(17)],fill=(230,178,98,255))
    for hh in (27,25,23): d.line([wx,Y(hh),wx+8,Y(hh)],fill=(196,146,80,255))
    d.line([wx+4,Y(29),wx+4,Y(17)],fill=(124,92,60,255)); d.line([wx,Y(21),wx+8,Y(21)],fill=(124,92,60,255))
    d.rectangle([wx+1,Y(20),wx+3,Y(18)],fill=(250,214,150,255)); d.line([wx-3,Y(14),wx+11,Y(14)],fill=(138,132,120,255))
    if tier>=4:
        for bxx in (wx+1,wx+4,wx+7): d.line([bxx,Y(30),bxx,Y(16)],fill=(40,42,50,255))
        d.line([wx-1,Y(26),wx+9,Y(26)],fill=(40,42,50,255)); d.line([wx-1,Y(20),wx+9,Y(20)],fill=(40,42,50,255))
        for i in range(3,11):
            for hh in (16,31):
                pass
        for i in range(3,11):
            for hh in range(16,32):
                edge=(i in (3,10)) or hh in (16,31)
                P[x0-i,round(sideY(hh,i))]=((60,64,72) if edge else (96,100,106))+(255,)
        for (i,hh) in ((4,18),(9,18),(4,29),(9,29)): P[x0-i,round(sideY(hh,i))]=(150,154,160,255)
    # ON AIR sign (lit box) over the door
    sx,sy=18,Y(44)+1; d.rectangle([sx,sy,sx+24,sy+6],fill=OUT+(255,)); d.rectangle([sx+1,sy+1,sx+23,sy+5],fill=(120,28,26,255))
    LET={'O':["111","101","101","101","111"],'N':["101","111","111","111","101"],'A':["111","101","111","101","101"],'I':["1","1","1","1","1"],'R':["110","101","110","101","101"]}
    LET={k:v[:3]+v[4:] if False else v for k,v in LET.items()}
    def text(x,y,s,col,gapw=2):
        for ch in s:
            if ch==' ': x+=gapw; continue
            g=LET[ch]
            for r,rowp in enumerate(g):
                for c,v in enumerate(rowp):
                    if v=='1': P[x+c,y+r]=col+(255,)
            x+=len(g[0])+1
        return x
    # 3x5 letters do not fit a 5px-tall panel with margins: use 3x3 caps on the 5px panel centre rows
    L3={'O':["111","101","111"],'N':["111","101","101"],'A':["010","111","101"],'I':["1","1","1"],'R':["110","110","101"]}
    x=sx+3
    for ch in "ON AIR":
        if ch==' ': x+=2; continue
        for r,rowp in enumerate(L3[ch]):
            for c,v in enumerate(rowp):
                if v=='1': P[x+c,sy+2+r]=(255,198,172,255)
        x+=len(L3[ch][0])+1
    # wall lamp between door and window
    lx_=37; d.rectangle([lx_,Y(36),lx_+2,Y(35)],fill=ST_DD+(255,)); d.rectangle([lx_,Y(34),lx_+2,Y(32)],fill=(250,214,150,255)); d.point((lx_+1,Y(33)),fill=(255,240,200,255))
    # roof: corrugated metal, side-gable; front slope + gable end
    RF=(78,82,94); RFd=(58,62,74); RFl=(98,102,114)
    ex0_,ex1_=x0-2,x1+1; back=7
    for r in range(rh+1):
        t=r/rh; xa=round(ex0_-back*t); xb_=round(ex1_-back*t); y=Y(wt)-1-r
        for x in range(xa,xb_+1): P[x,y]=((RFd if (x+r//2)%3==0 else RF) if r<rh else RFl)+(255,)
    d.line([ex0_,Y(wt),ex1_,Y(wt)],fill=OUT+(255,)); d.line([ex0_,Y(wt)-1,ex1_,Y(wt)-1],fill=RFd+(255,))
    for _ in range(18):
        r=rnd.randint(1,rh-1); x=rnd.randint(ex0_-4,ex1_-7); P[x,Y(wt)-1-r]=(118,80,62,255)
    for i in range(0,sdw+3):                                    # gable end over the side wall
        x=x0-i; yb=round(sideY(wt,i)); gh=rh*(1-abs(i-sdw/2)/(sdw/2+1.5))
        for y in range(int(yb-gh),yb):
            if P[x,y][3]==0 or i>2: P[x,y]=WSd+(255,)
    d.line([(x0-sdw-2,round(sideY(wt,sdw))-1),(ex0_-back,Y(wt)-1-rh)],fill=RFd+(255,))
    # roof vent + a small antenna + feed cable to the tower
    d.rectangle([52,Y(wt+rh+5),54,Y(wt+rh-3)],fill=ST_D+(255,)); d.rectangle([51,Y(wt+rh+6),55,Y(wt+rh+5)],fill=ST_M+(255,))
    d.line([24,Y(wt+rh+12),24,Y(wt+rh-1)],fill=ST_D+(255,)); d.line([21,Y(wt+rh+9),27,Y(wt+rh+9)],fill=ST_D+(255,)); d.line([22,Y(wt+rh+6),26,Y(wt+rh+6)],fill=ST_D+(255,))
    if not station_only:
        d.line([(57,Y(wt+rh-2)),(CX-20,Y(wt+rh+6)),(int(CX-22+0.094*(wt+rh+14)),Y(wt+rh+14))],fill=(40,40,50,255))
    return im
def outline(im,xmax=66,hmax=64):
    P=im.load(); o=im.copy(); Q=o.load()
    for y in range(H):
        for x in range(W):
            if P[x,y][3]==0:
                for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    xx,yy=x+dx,y+dy
                    if 0<=xx<W and 0<=yy<H and P[xx,yy][3]==255 and yy>Y(hmax) and xx<xmax: Q[x,y]=OUT+(255,); break
    return o
if __name__=='__main__':
    im=outline(make()); im.save('bt_t3_code.png'); print(im.getbbox())
    make(steel_only=True).save('bt_t3_steel.png'); outline(make(station_only=True)).save('bt_t3_station.png')
    outline(make(soldier=True)).save('bt_t3_code_soldier.png')
    bg=Image.new('RGBA',(W+16,H+16),(30,28,44,255)); bg.alpha_composite(im,(8,8)); bg.resize((bg.width*4,bg.height*4),Image.NEAREST).save('bt_t3_code_4x.png')
