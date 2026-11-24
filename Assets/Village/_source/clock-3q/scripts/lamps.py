# The Clock tower's two street lamps: same fixture, same spots (x=37 and x=94) on every tier.
import math
O=(14,12,16,255)
def lamp(im, x, state='lit'):
    from PIL import ImageDraw
    px=im.load(); d=ImageDraw.Draw(im)
    for y in range(176,207): px[x,y]=(26,26,30,255); px[x+1,y]=(44,44,50,255)
    d.rectangle([x-1,204,x+2,207],fill=(30,30,34,255))
    glass={'lit':(250,214,150,255),'off':(54,56,60,255),'broken':(18,18,22,255)}[state]
    d.rectangle([x-2,168,x+3,175],fill=glass); d.rectangle([x-2,168,x+3,175],outline=(24,24,28,255))
    d.line([x-1,172,x+2,172],fill=(24,24,28,255))
    d.polygon([(x-3,168),(x+4,168),(x+0,165),(x+1,165)],fill=(30,30,34,255)); px[x,164]=O; px[x+1,164]=O
    d.line([x-1,176,x+2,176],fill=(30,30,34,255))
    if state=='off':
        px[x-1,169]=(96,98,100,255); px[x-1,170]=(74,76,80,255)            # a dull reflection on dead glass
    if state=='broken':
        for (sx,sy) in ((x-1,169),(x+2,171),(x+2,174),(x-1,174),(x,173)): px[sx,sy]=(150,158,160,255)   # shards left in the frame
        px[x+3,170]=(0,0,0,0); px[x+3,171]=(0,0,0,0); px[x+3,169]=(24,24,28,255)                     # a pane's frame knocked out
        px[x+4,172]=(24,24,28,255)
def glow(im,cx,cy,R,col,k0,opaque_only=False,skip=()):
    px=im.load(); W,H=im.size
    for y in range(max(0,cy-R),min(H,cy+R+1)):
        for x in range(max(0,cx-R),min(W,cx+R+1)):
            dd=math.hypot(x-cx,y-cy)
            if dd>R: continue
            k=k0*(1-dd/R)**1.5; p=px[x,y]
            if p[:3] in skip: continue
            if opaque_only and p[3]<=20: continue
            if p[3]>20:
                a=min(0.6,k); px[x,y]=tuple(int(p[i]+(col[i]-p[i])*a) for i in range(3))+(255,)
            else:
                al=int(min(150,255*k*0.9))
                if al>=7: px[x,y]=col+(al,)
def lamp_light(im,x):
    glow(im,x+1,171,22,(255,214,150),0.55,opaque_only=True,skip={(250,214,150)}); glow(im,x+1,171,8,(255,214,150),0.55,skip={(250,214,150)})

def bent_lamp(im, x, angle=40, kink_y=197):
    """The same lamp, hit low by a vehicle: the foot still stands, the post is kinked at bumper height
    and the whole upper part leans over to the left with a dead, broken lantern."""
    from PIL import Image, ImageDraw
    W,H=im.size
    tmp=Image.new('RGBA',(W,H),(0,0,0,0)); lamp(tmp,x,'broken')
    up=tmp.copy(); ImageDraw.Draw(up).rectangle([0,kink_y+1,W,H],fill=(0,0,0,0))          # everything above the kink
    up=up.rotate(angle,resample=Image.NEAREST,center=(x+0.5,kink_y))
    upx=up.load()
    for yy in range(H):                                   # moonlight catches the top edge of the leaning post, so it reads against the wall
        for xx in range(W):
            if upx[xx,yy][:3]==(44,44,50) and yy>170: upx[xx,yy]=(124,128,136,255)
    lo=tmp.copy(); ImageDraw.Draw(lo).rectangle([0,0,W,kink_y],fill=(0,0,0,0))             # the foot, still upright
    im.alpha_composite(lo); im.alpha_composite(up)
    px=im.load()
    for (dx,dy,c) in ((-1,0,(20,20,24,255)),(2,0,(60,60,66,255)),(-1,1,(26,26,30,255)),(2,-1,(20,20,24,255)),(0,-1,(52,52,58,255))):
        px[x+dx,kink_y+dy]=c                                                                 # crumpled metal at the kink
