from PIL import Image
import compose as C, bt208 as B, math
W,H=B.W,B.H; Y=B.Y
def clean(im):
    im=im.convert('RGBA'); P=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=P[x,y]
            if a<128: P[x,y]=(0,0,0,0)
            else: P[x,y]=(r,g,b,255)
    return im
def station_pl(path='out/ST_6102_0.png',gain=1.12):
    s=clean(Image.open(path)); P=s.load()
    for y in range(s.height):
        for x in range(s.width):
            r,g,b,a=P[x,y]
            if a and (r+g+b)>90 and not (r>180 and g>120):       # lift the mid tones a little, leave outlines and lit glass alone
                P[x,y]=(min(255,int(r*gain)),min(255,int(g*gain)),min(255,int(b*gain)),255)
    o=Image.new('RGBA',(W,H),(0,0,0,0)); o.alpha_composite(s,(0,H-80)); return o
def glow(im,cx,cy,R,col,k0,cap=150,shape=None,opaque_only=False):
    P=im.load()
    for y in range(max(0,int(cy-R)),min(H,int(cy+R)+1)):
        for x in range(max(0,int(cx-R)),min(W,int(cx+R)+1)):
            dd=math.hypot(x-cx,(y-cy)*(shape or 1.0))
            if dd>=R: continue
            k=k0*(1-dd/R)**1.5
            r,g,b,a=P[x,y]
            if a==255: P[x,y]=(int(r+(col[0]-r)*k),int(g+(col[1]-g)*k),int(b+(col[2]-b)*k),255)
            elif not opaque_only:
                al=int(min(cap,255*k*0.9))
                if al>=7 and a<al: P[x,y]=col+(al,)
    return im
def build(soldier=False,station=None):
    im=C.compose(station or station_pl(),soldier)
    # light pass (fixtures only): beacon bloom, wall lamp wash, sign wash
    keep=im.copy()
    glow(im,B.CX-0.5,Y(B.TOP+17),7,(240,84,60),0.55,cap=120)
    bx=keep.load(); P=im.load()
    for y in range(Y(B.TOP+20),Y(B.TOP+13)+1):                   # keep the lamp body itself crisp
        for x in range(B.CX-3,B.CX+3): P[x,y]=bx[x,y]
    glow(im,40.5,Y(31),10,(255,214,150),0.30,opaque_only=True,shape=0.8)
    glow(im,32,Y(39),9,(230,70,56),0.16,opaque_only=True,shape=1.6)
    return im
if __name__=='__main__':
    t3=build(); t3.save('bt_t3_v1_128x208.png'); print(t3.getbbox())
    build(soldier=True).save('bt_t3_v1_soldier.png')
    bg=Image.new('RGBA',(W+16,H+16),(30,28,44,255)); bg.alpha_composite(t3,(8,8)); bg.resize((bg.width*4,bg.height*4),Image.NEAREST).save('bt_t3_v1_4x.png')
