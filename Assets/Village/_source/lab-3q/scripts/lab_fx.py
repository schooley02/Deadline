import math
from PIL import Image
lum=lambda p: 0.3*p[0]+0.59*p[1]+0.11*p[2]
def level_roof(im):
    """Front roofline was stepping down to the right (38 -> 39 -> 40). Lift those columns so the whole front top edge is level at 38."""
    v=im.copy(); P=v.load(); S=im.load()
    for x in range(103,153):
        d=1 if x<=124 else 2
        for y in range(30,48): P[x,y]=S[x,min(47,y+d)]
    return v
def glow(im, keep, excl=True):
    """Faint green light from the fungus caps: caps brightened, nearby art tinted, see-through pixels in open air."""
    v=im.copy(); P=v.load(); S=im.load(); W,H=v.size
    def cap(x,y):
        p=S[x,y]
        if not p[3] or not (p[1]>=p[0] and p[1]>p[2]+6 and lum(p)>118): return False
        if excl and 70<=x<=122 and 96<=y<=140: return False
        if excl and 5<=x<=31 and 108<=y<=141: return False
        if excl and 5<=x<=44 and 88<=y<=108: return False
        return keep(x,y)
    caps=[(x,y) for x in range(W) for y in range(H) if cap(x,y)]; capset=set(caps)
    GLOW=(150,236,150); R=6.5; K0=0.27
    for (x,y) in caps:
        p=S[x,y]; l=lum(p)
        P[x,y]=(198,232,168,255) if l>175 else ((160,196,140,255) if l>150 else (int(p[0]*0.98),int(min(255,p[1]*1.10)),p[2],255))
    for (x,y) in caps:
        if all((x+dx,y+dy) in capset for dx in (-1,0,1) for dy in (-1,0,1)) and (x*7+y*13)%5==0: P[x,y]=(222,250,190,255)
    for x in range(W):
        for y in range(H):
            if (x,y) in capset: continue
            d=min((math.hypot(x-cx,y-cy) for (cx,cy) in caps if abs(x-cx)<=7 and abs(y-cy)<=7), default=99)
            if d>R: continue
            k=K0*(1-d/R)**1.5; p=S[x,y]
            if p[3]:
                if (p[0]>200 and p[1]>165 and p[2]<170) or (70<=x<=122 and 96<=y<=140): continue
                P[x,y]=(int(p[0]+(GLOW[0]-p[0])*k*0.8),int(p[1]+(GLOW[1]-p[1])*k),int(p[2]+(GLOW[2]-p[2])*k*0.8),255)
            else:
                al=int(255*k*0.9)
                if al>=7: P[x,y]=GLOW+(min(110,al),)
    return v
T3_KEEP=lambda x,y: (40<=x<=70 and y>=128) or (40<=x<=58 and 66<=y<=88)
ALL=lambda x,y: True

# ---------------- roof spotlight aimed at the door ----------------
SP_C=(80.0,26.0); SP_U=(0.51,0.86); SP_W=(0.86,-0.51)       # housing centre, aim direction (down-right, toward the door), across
def spotlight_art(im):
    """Replace the round forward-facing roof lamp with a hooded spotlight on a short post, tilted down toward the door."""
    from PIL import ImageDraw
    v=im.copy(); P=v.load()
    for x in range(70,93):                                   # remove the old lamp head + arm (everything above the roof cables)
        for y in range(18,36):
            if not (x<=71 and y>=28): P[x,y]=(0,0,0,0)
    d=ImageDraw.Draw(v); cx,cy=SP_C; ux,uy=SP_U; wx,wy=SP_W
    pt=lambda a,b: (cx+a*ux+b*wx, cy+a*uy+b*wy)
    d.line([(76,37),(76,29),(78,27)],fill=(26,26,30,255),width=2)                                   # post + yoke
    d.polygon([pt(-5,-3.4),pt(-5,3.4),pt(4.5,4.6),pt(4.5,-4.6)],fill=(60,62,68,255),outline=(14,14,18,255))   # housing, flared at the lens
    d.line([pt(-4,2.4),pt(3.5,3.4)],fill=(104,106,112,255))                                         # lit top edge
    d.line([pt(4.5,-3.6),pt(4.5,3.6)],fill=(255,238,176,255),width=2)                               # lens
    d.line([pt(3.2,-3.0),pt(3.2,3.0)],fill=(226,186,116,255))
    return v
def spotlight_beam(im, k0=0.34):
    """See-through light technique: the beam tints the wall it crosses and shows as partly transparent pixels in open air."""
    import math
    v=im.copy(); P=v.load(); S=im.load(); W,H=v.size
    cx,cy=SP_C; ux,uy=SP_U; wx,wy=SP_W; ox,oy=cx+5.2*ux, cy+5.2*uy; LC=(255,214,150)
    for x in range(W):
        for y in range(H):
            dx,dy=x-ox,y-oy; s=dx*ux+dy*uy; off=dx*wx+dy*wy
            k=0.0
            if 0<=s<=150:
                half=3.8+s*0.17
                if abs(off)<half: k=k0*(1-s/150.0)**1.3*(1-(off/half)**2)**1.2
            r=math.hypot(dx,dy)
            if r<6: k=max(k,0.42*(1-r/6.0)**1.4)             # small bloom at the lens
            if k<0.02: continue
            p=S[x,y]
            if p[3]==255:
                if 71<=x<=121 and 97<=y<=139: continue        # nothing changes behind the tank glass
                if p[0]>235 and p[1]>215: continue            # the lens itself
                P[x,y]=(int(p[0]+(LC[0]-p[0])*k*0.8),int(p[1]+(LC[1]-p[1])*k*0.8),int(p[2]+(LC[2]-p[2])*k*0.8),255)
            elif p[3]==0:
                al=int(255*k*0.9)
                if al>=7: P[x,y]=LC+(min(150,al),)
    return v

# ---- v2 of the spotlight (overrides the first attempt above): lighter housing, stronger beam that reaches the door ----
def spotlight_art(im):
    from PIL import ImageDraw
    v=im.copy(); P=v.load()
    for x in range(70,93):
        for y in range(18,36):
            if not (x<=71 and y>=28): P[x,y]=(0,0,0,0)
    d=ImageDraw.Draw(v); cx,cy=SP_C; ux,uy=SP_U; wx,wy=SP_W
    pt=lambda a,b: (round(cx+a*ux+b*wx), round(cy+a*uy+b*wy))
    d.line([(76,37),(76,30)],fill=(22,22,26,255),width=2); d.line([(76,30),(79,27)],fill=(22,22,26,255),width=2)       # post + yoke
    d.polygon([pt(-5,-3.2),pt(-5,3.2),pt(4.6,4.8),pt(4.6,-4.8)],fill=(88,90,98,255),outline=(14,14,18,255))               # housing
    d.polygon([pt(-4,0.6),pt(-4,2.4),pt(3.6,3.6),pt(3.6,1.0)],fill=(128,130,138,255))                                    # lit upper side
    d.polygon([pt(-4,-2.4),pt(-4,-0.8),pt(3.6,-1.2),pt(3.6,-3.6)],fill=(58,60,66,255))                                   # shaded under side
    d.line([pt(-5,-3.2),pt(-5,3.2)],fill=(14,14,18,255))
    d.line([pt(4.6,-3.8),pt(4.6,3.8)],fill=(255,240,184,255),width=2)                                                    # lens
    d.line([pt(5.8,-2.8),pt(5.8,2.8)],fill=(255,226,150,255))
    return v
def spotlight_beam(im, k0=0.50):
    import math
    v=im.copy(); P=v.load(); S=im.load(); W,H=v.size
    cx,cy=SP_C; ux,uy=SP_U; wx,wy=SP_W; ox,oy=cx+5.4*ux, cy+5.4*uy; LC=(255,214,150)
    for x in range(W):
        for y in range(H):
            dx,dy=x-ox,y-oy; s=dx*ux+dy*uy; off=dx*wx+dy*wy; k=0.0
            if 0<=s<=175:
                half=3.6+s*0.165
                if abs(off)<half: k=k0*(1-s/190.0)**0.9*(1-(off/half)**2)**1.3
            r=math.hypot(dx,dy)
            if r<7: k=max(k,0.55*(1-r/7.0)**1.3)
            e=((x-135)/18.0)**2+((y-122)/30.0)**2                    # where the beam lands: the door and the wall round it
            if e<1: k=max(k,0.20*(1-e)**1.2)
            if k<0.02: continue
            p=S[x,y]
            if p[3]==255:
                if 71<=x<=121 and 97<=y<=139: continue
                if p[0]>200 and p[1]>165 and p[2]<190: continue        # lens and lit windows keep their own colour
                P[x,y]=(int(p[0]+(LC[0]-p[0])*k*0.75),int(p[1]+(LC[1]-p[1])*k*0.75),int(p[2]+(LC[2]-p[2])*k*0.75),255)
            elif p[3]==0 and y<46:                                 # open air: only the start of the beam above the roof, never past the walls or under the building
                al=int(255*k*0.9)
                if al>=7: P[x,y]=LC+(min(150,al),)
    return v

# ---------------- shine across the lab's glass panes (diagonal streaks, like the Police station's entrance) ----------------
def glass_shine(im, panes=((72,96,94,137),(96,96,118,137)), strength=1.0):   # exact inner edges: frame at x 71 / 95 / 119, y 95 / 138
    v=im.copy(); P=v.load(); S=im.load(); HL=(255,246,226)
    for (x0,y0,x1,y1) in panes:
        c1=x0+y0+10                                  # wide streak, starting on the pane's very top row across the upper-left corner of the pane (clear of the figures' heads)
        c2=c1+4                                      # thin companion streak
        c3=x1+y1-9                                   # thin streak near the lower-right corner
        for x in range(x0,x1+1):
            for y in range(y0,y1+1):
                p=S[x,y]
                if p[3]!=255 or (p[0]<26 and p[1]<26 and p[2]<30): continue      # leave the dark mullions and outlines
                s=x+y; k=0.0
                if c1-2<=s<=c1+1: k=0.34
                elif s==c2: k=0.44
                elif s==c3 or s==c3+1: k=0.28
                if k:
                    k*=strength; P[x,y]=(int(p[0]+(HL[0]-p[0])*k),int(p[1]+(HL[1]-p[1])*k),int(p[2]+(HL[2]-p[2])*k),255)
    return v
