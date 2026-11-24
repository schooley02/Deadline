# Flat-colour layout guides for the back-row Clock tower T3 (112x208, feet on the last row).
# Three-quarter camera like the other buildings: front wall flat, LEFT side wall receding
# (its horizontals drop to the left, more the higher they are; level at the ground).
from PIL import Image, ImageDraw
W,H=112,208
MAT={'brick':dict(f=(104,70,62),s=(70,48,48),tr=(178,170,150),trs=(122,116,104)),
     'stone':dict(f=(150,144,128),s=(104,100,92),tr=(186,180,162),trs=(128,124,112))}
SL=(60,64,84); SLS=(42,45,62); LIT=(236,222,150); WL=(230,170,80); DK=(30,28,34); WOOD=(70,46,32); WH=(196,192,180); WHS=(136,134,128)
def make(variant,mat):
    m=MAT[mat]; im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    Y=lambda a:H-a
    sl=lambda a:0.42*a/208.0
    def F(x1,x2,a_top,a_bot,c): d.rectangle([x1,Y(a_top),x2-1,Y(a_bot)-1],fill=c+(255,))
    def Sd(x1,x2,a_top,a_bot,c):   # side-wall piece, x2 = the corner it shares with the front wall
        w=x2-x1
        d.polygon([(x1,Y(a_top)+w*sl(a_top)),(x2,Y(a_top)),(x2,Y(a_bot)),(x1,Y(a_bot)+w*sl(a_bot))],fill=c+(255,))
    def block(xs,xc,xr,a_top,a_bot,cf,cs): Sd(xs,xc,a_top,a_bot,cs); F(xc,xr,a_top,a_bot,cf)
    def win(x,a,w=7,h=11,c=WL): F(x-1,x+w+1,a+h+1,a-1,m['tr']); F(x,x+w,a+h,a,c)
    # base + door
    block(24,42,88,38,0,m['f'],m['s']); block(22,42,90,42,38,m['tr'],m['trs'])
    F(57,73,36,0,m['tr']); F(59,71,33,0,WOOD); d.polygon([(55,Y(36)),(75,Y(36)),(65,Y(42))],fill=m['tr']+(255,))
    # shaft
    top=142 if variant=='B' else 144
    block(30,44,82,top,42,m['f'],m['s'])
    block(28,44,84,96,93,m['tr'],m['trs'])
    win(59,60); win(59,104)
    Sd(34,40,82,70,WL)
    if variant=='A':
        block(28,44,84,122,119,m['tr'],m['trs'])
        F(55,71,141,124,WH)
        for a in range(126,140,3): F(57,69,a+1,a,DK)
    # ledge under the clock stage
    block(25,43,87,top+4,top,m['tr'],m['trs'])
    c0=top+4; c1=c0+34
    block(28,43,84,c1,c0,m['f'],m['s'])
    cy=(c0+c1)//2
    d.ellipse([49,Y(cy+15),79,Y(cy-15)],fill=m['tr']+(255,)); d.ellipse([51,Y(cy+13),77,Y(cy-13)],fill=LIT+(255,))
    d.line([64,Y(cy),64,Y(cy+10)],fill=DK+(255,),width=2); d.line([64,Y(cy),71,Y(cy-4)],fill=DK+(255,),width=2)
    off=7*sl(cy)
    d.ellipse([31,Y(cy+14)+off,40,Y(cy-14)+off],fill=m['trs']+(255,)); d.ellipse([32,Y(cy+12)+off,39,Y(cy-12)+off],fill=(170,160,110,255))
    block(26,43,86,c1+3,c1,m['tr'],m['trs'])
    r0=c1+3
    if variant=='B':
        block(33,46,80,r0+13,r0,WH,WHS)
        for x in (50,62):
            F(x,x+10,r0+11,r0+2,DK)
            for a in range(r0+3,r0+10,3): F(x+1,x+9,a+1,a,(120,118,112))
        block(31,46,82,r0+15,r0+13,m['tr'],m['trs']); r0=r0+15; xl,xc,xr=31,46,82
    else:
        xl,xc,xr=26,43,86
    apex=(56,Y(208))
    d.polygon([(xl,Y(r0)+(xc-xl)*sl(r0)),(xc,Y(r0)),apex],fill=SLS+(255,))
    d.polygon([(xc,Y(r0)),(xr,Y(r0)),apex],fill=SL+(255,))
    return im
if __name__=='__main__':
    sheet=Image.new('RGBA',(4*122+10,220),(28,32,44,255)); i=0
    for v in 'AB':
        for mat in ('brick','stone'):
            g=make(v,mat); g.save(f'guide_{v}_{mat}.png'); sheet.alpha_composite(g,(10+i*122,6)); i+=1
    sheet.resize((sheet.width*3,sheet.height*3),Image.NEAREST).convert('RGB').save('guides_3x.png')
