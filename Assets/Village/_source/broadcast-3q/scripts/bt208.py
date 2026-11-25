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
    def dirty(px,box,seed,tint=(0.80,0.75,0.68),nblob=4,nrun=3):
        # grime on one object (T2): a brown-grey tint, a few solid stains (dirt / rust, alternating) and short runs below them. No specks.
        rr=random.Random(seed); x0_,y0_,x1_,y1_=box; ok=lambda x,y: 0<=x<W and 0<=y<H and px[x,y][3]==255 and sum(px[x,y][:3])>110
        mix=lambda c,t,k: tuple(int(c[i]+(t[i]-c[i])*k) for i in range(3))+(255,)
        for y in range(y0_,y1_+1):
            for x in range(x0_,x1_+1):
                if ok(x,y): c=px[x,y]; px[x,y]=(int(c[0]*tint[0]),int(c[1]*tint[1]),int(c[2]*tint[2]),255)
        for i in range(nblob):
            bx_,by_=rr.randint(x0_+1,x1_-1),rr.randint(y0_+1,y1_-1); br_=rr.randint(1,3); tone=(74,64,58) if i%2==0 else (120,82,62)
            for y in range(by_-br_,by_+br_+1):
                for x in range(bx_-br_,bx_+br_+1):
                    if x0_<=x<=x1_ and y0_<=y<=y1_ and ok(x,y) and (x-bx_)**2+(y-by_)**2<=br_*br_: px[x,y]=mix(px[x,y],tone,0.55)
            if i<nrun:
                for k in range(br_+1,br_+rr.randint(3,6)):
                    if y0_<=by_+k<=y1_ and ok(bx_,by_+k): px[bx_,by_+k]=mix(px[bx_,by_+k],(64,56,54),0.5)
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
        LGAP=((46,64),(96,104)) if tier==1 else ()                  # T1: two stretches of the ladder have rotted away
        ingap=lambda hh: any(a_<=hh<=b_ for a_,b_ in LGAP)
        for hh in range(3,PH,3):
            if not ingap(hh): d.line([CX-2,Y(hh),CX+1,Y(hh)],fill=ST_D+(255,))
        segs=[]; top_=PH
        for a_,b_ in sorted(LGAP,reverse=True): segs.append((top_,b_+1)); top_=a_-1
        segs.append((top_,2))
        for h1_,h0_ in segs:
            d.line([CX-2,Y(h1_),CX-2,Y(h0_)],fill=(100,104,116,255)); d.line([CX+1,Y(h1_),CX+1,Y(h0_)],fill=(140,144,154,255))
        if tier==1: d.line([(CX+1,Y(64)),(CX+5,Y(58)),(CX+6,Y(50))],fill=(100,104,116,255))      # one rail bent out and hanging
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
            for x in ((dl,dl+9,dl+19,dl+29,dr) if tier>=2 else (dl,dl+19)): d.line([x,pf-RH,x,pf-1],fill=ST_M+(255,))
            if tier==1:
                d.line([dl,pf-RH,dl+19,pf-RH],fill=ST_L+(255,)); d.line([dl,pf-RH+5,dl+9,pf-RH+5],fill=ST_M+(255,))        # what is left of the rail
                for x in (dl+29,dr): d.line([x,pf-RH,x,pf-1],fill=ST_M+(255,))                                               # the right-end section still stands
                d.line([dl+29,pf-RH,dr,pf-RH],fill=ST_L+(255,)); d.line([dl+31,pf-RH+5,dr,pf-RH+5],fill=ST_M+(255,))
                d.line([(dl+19,pf-RH),(dl+24,pf-RH+3),(dl+26,pf+6),(dl+26,pf+13)],fill=ST_M+(255,))                          # top rail torn loose, hanging below the deck
            elif tier==2:
                for (xa,xb_) in ((dl,dl+19),(dl+29,dr)):
                    d.line([xa,pf-RH,xb_,pf-RH],fill=ST_L+(255,)); d.line([xa,pf-RH+5,xb_,pf-RH+5],fill=ST_M+(255,))
                d.line([(dl+19,pf-RH+1),(dl+22,pf-RH+3),(dl+26,pf-RH+3),(dl+29,pf-RH+1)],fill=(150,128,92,255))          # rope across the gap
                TP=(72,86,102); TPd=(52,64,80); TPl=(98,112,126)                                                          # tarp shelter, roped to the rail
                d.polygon([(dl-1,pf-RH-2),(dl+13,pf-RH-3),(dl+15,pf-RH+4),(dl+14,pf+1),(dl+1,pf+2),(dl-2,pf-3)],fill=OUT+(255,))
                d.polygon([(dl,pf-RH-1),(dl+12,pf-RH-2),(dl+14,pf-RH+4),(dl+13,pf),(dl+1,pf+1),(dl-1,pf-3)],fill=TP+(255,))
                d.line([(dl+3,pf-RH),(dl+2,pf)],fill=TPd+(255,)); d.line([(dl+8,pf-RH-1),(dl+9,pf)],fill=TPd+(255,)); d.line([(dl+5,pf-RH),(dl+6,pf-4)],fill=TPl+(255,)); d.line([(dl+11,pf-RH),(dl+12,pf-5)],fill=TPl+(255,))
                d.line([(dl,pf-RH+3),(dl+13,pf-RH+2)],fill=(150,128,92,255))
            else:
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
        if tier==1:
            d.line([CX+5,Y(TOP+6),CX+5,ty-5],fill=ST_D+(255,)); d.line([(CX+5,Y(TOP+6)),(CX+9,Y(TOP+9)),(CX+13,Y(TOP+7))],fill=ST_D+(255,))     # bent over
            d.line([CX-6,Y(TOP+4),CX-6,ty-5],fill=ST_D+(255,))                                                                                   # snapped short
        else:
            d.line([CX+5,Y(TOP+15),CX+5,ty-5],fill=ST_D+(255,)); d.line([CX-6,Y(TOP+10),CX-6,ty-5],fill=ST_D+(255,))
        d.rectangle([CX-3,Y(TOP+13),CX+2,Y(TOP+13)],fill=ST_D+(255,))
        d.rectangle([CX-3,Y(TOP+19),CX+2,Y(TOP+14)],fill=(206,58,46,255)); d.rectangle([CX-2,Y(TOP+20),CX+1,Y(TOP+20)],fill=(206,58,46,255))
        d.rectangle([CX-3,Y(TOP+19),CX-3,Y(TOP+14)],fill=(146,38,36,255)); d.rectangle([CX,Y(TOP+18),CX+1,Y(TOP+16)],fill=(255,150,116,255)); d.point((CX+1,Y(TOP+18)),fill=(255,210,180,255))
        if tier==1:                                                 # dead: a dark red lens, cracked, no hot spot
            d.rectangle([CX-3,Y(TOP+19),CX+2,Y(TOP+14)],fill=(112,38,38,255)); d.rectangle([CX-2,Y(TOP+20),CX+1,Y(TOP+20)],fill=(112,38,38,255))
            d.rectangle([CX-3,Y(TOP+19),CX-3,Y(TOP+14)],fill=(74,26,30,255)); d.line([(CX,Y(TOP+19)),(CX-1,Y(TOP+17)),(CX+1,Y(TOP+15))],fill=(46,18,24,255))
        if tier==2:                                                 # running weak: a dull lens with one faint hot spot (stays ON at T2: Jeremy, it is the tower's signature)
            d.rectangle([CX-3,Y(TOP+19),CX+2,Y(TOP+14)],fill=(150,46,42,255)); d.rectangle([CX-2,Y(TOP+20),CX+1,Y(TOP+20)],fill=(150,46,42,255))
            d.rectangle([CX-3,Y(TOP+19),CX-3,Y(TOP+14)],fill=(104,32,34,255)); d.rectangle([CX,Y(TOP+17),CX+1,Y(TOP+16)],fill=(214,96,76,255))
        if tier>=5:                                                 # a pair of loudspeaker horns off the cap platform's left side, mouths facing left
            d.line([CX-13,ty-4,CX-8,ty-4],fill=ST_D+(255,)); d.line([CX-13,ty-10,CX-13,ty+4],fill=ST_DD+(255,))     # arm + yoke
            for cyh in (ty-8,ty+1):
                mx=CX-18
                d.polygon([(mx-1,cyh-4),(mx+3,cyh-4),(mx+7,cyh-2),(mx+7,cyh+2),(mx+3,cyh+4),(mx-1,cyh+4)],fill=OUT+(255,))
                d.polygon([(mx+2,cyh-3),(mx+6,cyh-1),(mx+6,cyh+1),(mx+2,cyh+3)],fill=(112,116,128,255)); d.line([mx+2,cyh-3,mx+6,cyh-1],fill=(150,154,164,255))
                d.rectangle([mx,cyh-3,mx+1,cyh+3],fill=(182,186,194,255)); d.rectangle([mx,cyh-2,mx,cyh+2],fill=(58,60,72,255)); d.point((mx,cyh),fill=(34,34,44,255))
        # ---------- panel antennas ----------
        PA=(202,196,176); PAD=(134,132,126); hp=TOP-14
        if tier==1:
            px0,py0=CX-1,Y(hp+12)
            d.polygon([(px0-1,py0-1),(px0+3,py0),(px0-3,py0+13),(px0-7,py0+12)],fill=OUT+(255,))
            d.polygon([(px0,py0),(px0+2,py0+1),(px0-4,py0+12),(px0-6,py0+11)],fill=(150,144,130,255)); d.line([(px0,py0),(px0-6,py0+11)],fill=(104,102,98,255))
            dirty(P,(px0-7,py0,px0+3,py0+13),31,tint=(0.70,0.66,0.58),nblob=4,nrun=2)
        for x,c,cs in (() if tier==1 else ((int(ufl(hp))-6,PAD,(100,100,98)),(CX-1,PA,PAD)) if tier>=3 else ((CX-1,(168,162,146),(118,116,110)),)):
            d.rectangle([x-1,Y(hp+13),x+3,Y(hp-1)],fill=OUT+(255,)); d.rectangle([x,Y(hp+12),x+2,Y(hp)],fill=c+(255,)); d.line([x,Y(hp+12),x,Y(hp)],fill=cs+(255,))
            if tier==2: dirty(P,(x,Y(hp+12),x+2,Y(hp)),31,tint=(0.74,0.70,0.62),nblob=3,nrun=2)
        # ---------- BIG dish (front-right) ----------
        dh=TOP-23; ax_=int(ufr(dh)); cxd=ax_+14; ry=15; rx=10
        lay=Image.new('RGBA',(W,H),(0,0,0,0)); q=ImageDraw.Draw(lay)
        q.line([ax_,Y(dh+5),cxd-2,Y(dh+5)],fill=ST_D+(255,),width=2); q.line([ax_,Y(dh-5),cxd-2,Y(dh-5)],fill=ST_D+(255,),width=2); q.line([ax_+3,Y(dh+5),ax_+3,Y(dh-5)],fill=ST_DD+(255,))
        q.ellipse([cxd-rx-1,Y(dh+ry+1),cxd+rx+1,Y(dh-ry-1)],fill=OUT+(255,))
        q.ellipse([cxd-rx,Y(dh+ry),cxd+rx,Y(dh-ry)],fill=(112,116,126,255))          # rim / back edge
        q.ellipse([cxd-rx+2,Y(dh+ry-1),cxd+rx,Y(dh-ry+1)],fill=(146,150,158,255))     # bowl, shade side
        q.ellipse([cxd-rx+4,Y(dh+ry-2),cxd+rx,Y(dh-ry+3)],fill=(168,172,178,255))
        q.ellipse([cxd-rx+7,Y(dh+ry-4),cxd+rx-1,Y(dh-ry+7)],fill=(192,194,198,255))   # lit part
        q.arc([cxd-rx+2,Y(dh+ry-1),cxd+rx,Y(dh-ry+1)],190,350,fill=(96,100,112,255))
        for (ex,ey) in ((cxd-2,Y(dh+ry-3)),(cxd-3,Y(dh-ry+3)),(cxd+rx-2,Y(dh-3))):
            q.line([ex,ey,cxd+rx+5,Y(dh+3)],fill=ST_DD+(255,))
        q.rectangle([cxd+rx+4,Y(dh+5),cxd+rx+7,Y(dh+2)],fill=ST_L+(255,)); q.rectangle([cxd+rx+4,Y(dh+2),cxd+rx+7,Y(dh+2)],fill=ST_D+(255,))
        for pt0 in ((cxd-4,Y(dh-9)),(cxd-3,Y(dh-10)),(cxd-5,Y(dh-8)),(cxd+1,Y(dh-12)),(cxd-6,Y(dh+6))): q.point(pt0,fill=RUST+(255,))
        if tier==1:
            q.rectangle([cxd+rx+3,Y(dh+6),cxd+rx+8,Y(dh+1)],fill=(0,0,0,0))                                   # feed horn torn off
            q.polygon([(cxd+rx+2,Y(dh-4)),(cxd+4,Y(dh-9)),(cxd+6,Y(dh-ry-2)),(cxd+rx+2,Y(dh-ry-2))],fill=(0,0,0,0))   # a bite out of the lower rim
            q.line([(cxd+4,Y(dh-9)),(cxd+6,Y(dh-ry+1))],fill=OUT+(255,)); q.line([(cxd+4,Y(dh-9)),(cxd+rx,Y(dh-5))],fill=OUT+(255,))
            q.polygon([(cxd-5,Y(dh+8)),(cxd+1,Y(dh+5)),(cxd-1,Y(dh-1)),(cxd-6,Y(dh+1))],fill=(84,86,96,255)); q.line([(cxd-5,Y(dh+8)),(cxd-6,Y(dh+1))],fill=(56,58,70,255))   # dent
            dirty(lay.load(),(cxd-rx,Y(dh+ry),cxd+rx,Y(dh-ry)),37,tint=(0.70,0.66,0.60),nblob=13,nrun=9)
            # torn off its mount (Jeremy 2026-11-24): it hangs over the right side of the platform, in the air, from a thick black
            # cable that runs from the middle of the mast over the hand rail. Turned 65 degrees about its bracket, then moved to the hang point.
            HANG=(dr+4,pf+14)                                         # well below the deck (Jeremy: it may hang behind the school, players see it in the building window)
            lay=lay.rotate(-75,resample=Image.NEAREST,center=(ax_,Y(dh)),translate=(HANG[0]-ax_,HANG[1]-Y(dh)))
        if tier==2:                                                 # patched with a scrap sheet, rust runs, and hanging about 12 degrees off true
            q.polygon([(cxd-6,Y(dh+4)),(cxd+1,Y(dh+6)),(cxd+2,Y(dh-2)),(cxd-5,Y(dh-3))],fill=(120,112,104,255)); q.line([(cxd-6,Y(dh+4)),(cxd+1,Y(dh+6))],fill=(150,142,130,255))
            for pt in ((cxd-5,Y(dh+3)),(cxd+1,Y(dh+5)),(cxd+1,Y(dh-1)),(cxd-4,Y(dh-2))): q.point(pt,fill=(60,56,58,255))
            for (rx_,ry_,ln) in ((cxd-2,Y(dh+12),3),(cxd+5,Y(dh+1),2),(cxd-6,Y(dh-5),3)): q.line([rx_,ry_,rx_,ry_+ln],fill=(128,88,72,255))
            dirty(lay.load(),(cxd-rx,Y(dh+ry),cxd+rx,Y(dh-ry)),37,tint=(0.80,0.76,0.70),nblob=9,nrun=6)
            lay=lay.rotate(-12,resample=Image.NEAREST,center=(ax_+2,Y(dh)))
        im.alpha_composite(lay); d=ImageDraw.Draw(im); P=im.load()
        if tier==1:
            CAB=(74,74,84); CABL=(94,94,106)                         # charcoal (Jeremy's pick over pure black and near-black); about (47,47,54) / (60,60,68) after the T1 dull pass, a little darker than the steel
            run1=[(CX,Y(dh)),(CX+10,Y(dh)+6),(dr-3,pf-RH-1)]             # from the middle of the mast, taut, to the hand rail
            run2=[(dr-3,pf-RH-1),(dr+1,pf-RH),(dr+3,pf-RH+4),(HANG[0],HANG[1])]   # bent over the rail, then straight down to the dish's bracket
            d.line(run1,fill=CAB+(255,),width=2); d.line(run2,fill=CAB+(255,),width=2)
            d.line([(x_,y_-1) for (x_,y_) in run1],fill=CABL+(255,)); d.line([(x_+1,y_) for (x_,y_) in run2[2:]],fill=CABL+(255,))   # a lighter edge so it reads as a round cable
            d.rectangle([CX-1,Y(dh)-1,CX+1,Y(dh)+1],fill=CAB+(255,))                          # the knot round the mast
            for hh_ in (dh+5,dh-5): d.line([ax_,Y(hh_),ax_+2,Y(hh_)],fill=ST_DD+(255,))        # stubs of the old mount
        # ---------- drum dish (shaded left side) ----------
        d2=TOP-17; lx=int(ubl(d2)[0])-12
        if tier==1:
            d.line([lx+10,Y(d2),lx+13,Y(d2)],fill=ST_DD+(255,),width=2); d.point((lx+9,Y(d2)-1),fill=ST_DD+(255,))
        else:
            d.line([lx+8,Y(d2),lx+13,Y(d2)],fill=ST_DD+(255,),width=2)
            d.ellipse([lx-1,Y(d2+8),lx+8,Y(d2-8)],fill=OUT+(255,)); d.ellipse([lx,Y(d2+7),lx+7,Y(d2-7)],fill=(96,100,112,255)); d.ellipse([lx,Y(d2+6),lx+5,Y(d2-6)],fill=(126,130,140,255)); d.ellipse([lx+1,Y(d2+4),lx+3,Y(d2-3)],fill=(148,152,160,255))
        if tier==2: dirty(P,(lx,Y(d2+7),lx+7,Y(d2-7)),41,tint=(0.78,0.74,0.68),nblob=4,nrun=3)
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
        if tier==1:                                                 # gutted: both doors gone, wires hanging out
            d.rectangle([ex0+1,Y(eh)+1,ex1-1,G-2],fill=(18,18,24,255)); d.line([ex0+9,Y(eh)+1,ex0+9,G-2],fill=(52,54,58,255))
            d.line([(ex0+4,Y(eh)+2),(ex0+5,Y(eh)+8),(ex0+3,Y(eh)+14)],fill=(96,60,52,255)); d.line([(ex0+13,Y(eh)+2),(ex0+12,Y(eh)+9),(ex0+15,G-3)],fill=(70,70,84,255))
            d.polygon([(ex1+2,G-9),(ex1+8,G-7),(ex1+8,G),(ex1+2,G)],fill=OUT+(255,)); d.polygon([(ex1+3,G-8),(ex1+7,G-6),(ex1+7,G-1),(ex1+3,G-1)],fill=(88,92,92,255))      # a door lying against the side
            dirty(P,(ex0-5,Y(eh)-3,ex1+8,G-1),43,tint=(0.70,0.66,0.58),nblob=12,nrun=8)
        if tier==2:
            d.rectangle([ex0+10,Y(eh)+1,ex0+12,G-2],fill=(22,22,28,255)); d.line([ex0+13,Y(eh)+1,ex0+13,G-2],fill=(132,138,134,255))     # right door ajar
            d.rectangle([ex0+11,G-8,ex0+16,G-4],fill=(104,110,108,255))                                                                    # warning label gone
            dirty(P,(ex0-5,Y(eh)-3,ex1+1,G-1),43,tint=(0.78,0.74,0.66),nblob=10,nrun=7)
            rm=random.Random(47); hmud=3                                                                                                    # mud splashed up the bottom: a solid band with an uneven top
            for xx in range(ex0-4,ex1+1):
                hmud=max(2,min(6,hmud+rm.choice((-1,0,0,1))))
                for yy in range(G-hmud,G):
                    if P[xx,yy][3]==255 and sum(P[xx,yy][:3])>110: P[xx,yy]=tuple(int(v*0.70) for v in P[xx,yy][:3])+(255,)
            for (rx_,ry_,ln) in ((ex0+2,Y(eh)+2,7),(ex0+6,Y(eh)+11,6),(ex0+15,Y(eh)+3,9),(ex0+17,Y(eh)+12,5)): d.line([rx_,ry_,rx_,ry_+ln],fill=(110,74,60,255))
            # fire barrel beside the tower's left leg: the squatters' outside light
            bx0=71; d.rectangle([bx0-1,G-12,bx0+8,G],fill=OUT+(255,)); d.rectangle([bx0,G-11,bx0+7,G-1],fill=(70,56,52,255)); d.line([bx0,G-11,bx0,G-1],fill=(48,40,42,255)); d.line([bx0+6,G-10,bx0+6,G-1],fill=(92,72,62,255))
            d.line([bx0,G-8,bx0+7,G-8],fill=(44,38,40,255)); d.line([bx0,G-4,bx0+7,G-4],fill=(44,38,40,255))
            for pt in ((bx0+2,G-6),(bx0+5,G-6),(bx0+3,G-2)): d.point(pt,fill=(240,150,60,255))
            d.rectangle([bx0+1,G-12,bx0+6,G-12],fill=(226,120,48,255)); d.rectangle([bx0+2,G-14,bx0+4,G-13],fill=(244,170,70,255)); d.point((bx0+3,G-15),fill=(255,214,120,255)); d.point((bx0+5,G-13),fill=(226,120,48,255))
    if tier<=2 and not station_only:
        # dirty, rusty steel (Jeremy 2026-11-24): a brown-grey grime tint on all the steel, then rust in solid PATCHES
        # (joints first, heavier low down), then dark runs under the patches. No single-pixel specks.
        STEEL={ST_L:0,ST_M:1,ST_D:2,ST_DD:3,(140,144,154):0,(100,104,116):1}
        GRIME=[(142,140,134),(108,106,104),(74,74,80),(52,50,60)]
        RUSTS=[(150,100,74),(122,80,62),(88,58,52),(62,44,46)]
        r2=random.Random(23); P=im.load(); cls={}
        for y in range(H):
            for x in range(W):
                c=P[x,y][:3]
                if P[x,y][3]==255 and c in STEEL: cls[(x,y)]=STEEL[c]; P[x,y]=GRIME[STEEL[c]]+(255,)
        cents=[]
        for _ in range(64 if tier==2 else 90):
            y=r2.randint(Y(TOP)+2,G-4); bias=(y-Y(TOP))/(G-Y(TOP))              # more rust lower down
            if r2.random()>0.45+0.55*bias: continue
            x=r2.randint(40,118); cents.append((x,y,r2.randint(3,6)))
        rusted=set()
        for (cx_,cy_,rr) in cents:
            blobs=[(cx_,cy_,rr),(cx_+r2.randint(-3,3),cy_+r2.randint(1,5),max(2,rr-1))]
            for (bx_,by_,br_) in blobs:
                for y in range(by_-br_,by_+br_+1):
                    for x in range(bx_-br_,bx_+br_+1):
                        if (x,y) in cls and (x-bx_)**2+((y-by_)*0.8)**2<=br_*br_: rusted.add((x,y))
        for (x,y) in rusted: P[x,y]=RUSTS[cls[(x,y)]]+(255,)
        for (cx_,cy_,rr) in cents[::2]:                                          # runs: a few px straight down from a patch, darker
            x=cx_+r2.randint(-1,1)
            for k in range(rr,rr+r2.randint(3,7)):
                if (x,cy_+k) in cls and (x,cy_+k) not in rusted: P[x,cy_+k]=RUSTS[min(3,cls[(x,cy_+k)]+1)]+(255,)
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
    if tier==1:
        GL=(20,20,28)
        # front window smashed: black opening, shards left in the frame, the centre bar snapped
        d.rectangle([wx,Y(29),wx+8,Y(17)],fill=GL+(255,))
        for pt in ((wx,Y(28)),(wx+1,Y(29)),(wx+8,Y(27)),(wx+7,Y(29)),(wx,Y(18)),(wx+1,Y(17)),(wx+2,Y(17)),(wx+8,Y(18)),(wx+6,Y(17))): d.point(pt,fill=(92,104,116,255))
        d.line([(wx+4,Y(29)),(wx+4,Y(25))],fill=(74,66,60,255)); d.line([(wx+4,Y(19)),(wx+5,Y(17))],fill=(74,66,60,255))
        # side window smashed too
        for i in range(5,9):
            for hh in range(18,30): P[x0-i,round(sideY(hh,i))]=GL+(255,)
        P[x0-5,round(sideY(29,5))]=(80,92,104,255); P[x0-8,round(sideY(18,8))]=(80,92,104,255)
        # the door hangs open on one hinge: a black doorway, the leaf swung in at the left
        d.rectangle([ax,Y(35),ax+10,Y(fnd)],fill=(14,14,20,255))
        d.polygon([(ax,Y(35)),(ax+3,Y(33)),(ax+3,Y(fnd+2)),(ax,Y(fnd))],fill=(46,54,52,255)); d.line([(ax+3,Y(33)),(ax+3,Y(fnd+2))],fill=(30,36,36,255))
        # two boards gone from the wall, the gaps black
        d.rectangle([x1-6,Y(wt-2),x1-5,Y(14)],fill=(18,16,22,255)); d.rectangle([x0+2,Y(30),x0+3,Y(fnd+1)],fill=(18,16,22,255))
    if tier==2:
        # front window: dark glass, one candle on the sill, a plank nailed across the top
        d.rectangle([wx,Y(29),wx+8,Y(17)],fill=(34,32,40,255)); d.line([wx+4,Y(29),wx+4,Y(17)],fill=(70,62,56,255)); d.line([wx,Y(21),wx+8,Y(21)],fill=(70,62,56,255))
        d.rectangle([wx+5,Y(20),wx+8,Y(17)],fill=(112,78,46,255)); d.rectangle([wx+6,Y(19),wx+7,Y(17)],fill=(206,150,80,255)); d.point((wx+6,Y(20)),fill=(255,220,150,255)); d.point((wx+6,Y(18)),fill=(236,226,200,255))
        d.polygon([(wx-2,Y(28)),(wx+10,Y(26)),(wx+10,Y(24)),(wx-2,Y(26))],fill=(104,84,62,255)); d.line([(wx-2,Y(28)),(wx+10,Y(26))],fill=(132,108,80,255)); d.point((wx-1,Y(27)),fill=(40,36,34,255)); d.point((wx+9,Y(25)),fill=(40,36,34,255))
        # side window: three planks, each at its own angle
        for (h0,h1,cc) in ((29,27,(88,72,56)),(24,25,(98,80,60)),(19,21,(82,66,52))):
            for i in range(3,11):
                hh=round(h0+(h1-h0)*(i-3)/7)
                for k in (0,1): P[x0-i,round(sideY(hh-k,i))]=(cc if k==0 else tuple(int(v*0.78) for v in cc))+(255,)
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
    if tier==1:                                                     # sign broken: the box hangs by one corner, half its face gone
        for yy in range(sy,sy+7):
            for xx in range(sx,sx+25): P[xx,yy]=(WFd if (xx-x0)%5==0 else WF)+(255,)                # bare wall where it hung
        d.polygon([(sx,sy),(sx+13,sy+5),(sx+12,sy+11),(sx-1,sy+6)],fill=OUT+(255,)); d.polygon([(sx+1,sy+1),(sx+12,sy+6),(sx+11,sy+10),(sx,sy+5)],fill=(54,26,28,255))
        d.line([(sx+3,sy+4),(sx+5,sy+5)],fill=(104,78,74,255)); d.line([(sx+7,sy+6),(sx+9,sy+7)],fill=(104,78,74,255))
    if tier==2:                                                     # sign dead: a dull panel, letters barely readable
        for yy in range(sy+1,sy+6):
            for xx in range(sx+1,sx+24):
                lit=P[xx,yy][:3]==(255,198,172); P[xx,yy]=((112,84,80) if lit else (60,28,30))+(255,)
    # wall lamp between door and window
    lx_=37; d.rectangle([lx_,Y(36),lx_+2,Y(35)],fill=ST_DD+(255,)); d.rectangle([lx_,Y(34),lx_+2,Y(32)],fill=(250,214,150,255)); d.point((lx_+1,Y(33)),fill=(255,240,200,255))
    if tier<=2:                                                     # lamp dead
        d.rectangle([lx_,Y(34),lx_+2,Y(32)],fill=(52,50,56,255)); d.point((lx_+1,Y(33)),fill=(74,72,78,255))
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
    if tier==1:
        hole=[(34,Y(wt)-rh+1),(46,Y(wt)-rh),(50,Y(wt)-5),(47,Y(wt)-1),(38,Y(wt)-2),(35,Y(wt)-5)]
        d.polygon(hole,fill=(12,12,18,255))
        for xb_ in (40,46):                                          # rafters: same lean as the roof's own edges (7px back over 11 up)
            d.line([(xb_,Y(wt)-2),(xb_-5,Y(wt)-rh+1)],fill=(70,56,48,255))
        d.line([(36,Y(wt)-6),(49,Y(wt)-6)],fill=(54,44,40,255))      # batten
        for pt in ((34,Y(wt)-rh+2),(50,Y(wt)-4),(46,Y(wt)-1),(38,Y(wt)-1)): d.point(pt,fill=RFl+(255,))    # torn sheet edges
    if tier==2:
        # tarp roped over the right end of the roof
        TP=(72,86,102); TPd=(52,64,80); TPl=(98,112,126)
        d.polygon([(40,Y(wt)-rh),(56,Y(wt)-rh-1),(60,Y(wt)-2),(59,Y(wt)+2),(44,Y(wt)+1),(43,Y(wt)-3)],fill=TP+(255,))
        d.line([(46,Y(wt)-rh+1),(48,Y(wt))],fill=TPd+(255,)); d.line([(53,Y(wt)-rh),(55,Y(wt)+1)],fill=TPd+(255,)); d.line([(50,Y(wt)-rh+1),(51,Y(wt)-3)],fill=TPl+(255,))
        d.line([(40,Y(wt)-rh+3),(59,Y(wt)-5)],fill=(150,128,92,255)); d.line([(44,Y(wt)+1),(59,Y(wt)+2)],fill=TPd+(255,))
    # roof vent + a small antenna + feed cable to the tower
    if tier==1:
        d.rectangle([52,Y(wt+rh),54,Y(wt+rh-3)],fill=ST_D+(255,))
        d.line([(24,Y(wt+rh-1)),(24,Y(wt+rh+5)),(29,Y(wt+rh+9))],fill=ST_D+(255,)); d.line([(25,Y(wt+rh+7)),(28,Y(wt+rh+5))],fill=ST_D+(255,))
    else:
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
