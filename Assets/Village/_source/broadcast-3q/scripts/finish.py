from PIL import Image
import compose as C, bt208 as B, math
W,H=B.W,B.H; Y=B.Y; BEAM_LEN=32; BEAM_HALF=9
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
def station_for(tier):
    st=station_pl()
    if tier!=3:                                                   # tier changes drawn in code, laid over the PixelLab station
        a=C.station_code(3).load(); bim=C.station_code(tier); b=bim.load(); P=st.load()
        for y in range(H):
            for x in range(W):
                if a[x,y]!=b[x,y] and b[x,y][3]: P[x,y]=b[x,y]
    return st
def paste_piece(im,path,x,ybottom,dim=1.0):
    p=clean(Image.open(path))
    if dim!=1.0:
        Q=p.load()
        for yy in range(p.height):
            for xx in range(p.width):
                r,g,b,a=Q[xx,yy]
                if a: Q[xx,yy]=(int(r*dim),int(g*dim),int(b*dim),255)
    im.alpha_composite(p,(x,ybottom-p.height+1))
def cone(im,x0,y0,ang,length,half0,half1,col,k0,cap=110):
    import math
    P=im.load(); ux,uy=math.cos(ang),math.sin(ang)
    for y in range(max(0,int(y0-length)),min(H,int(y0+length)+1)):
        for x in range(max(0,int(x0-length)),min(W,int(x0+length)+1)):
            dx,dy=x-x0,y-y0; t=dx*ux+dy*uy
            if t<=0 or t>length: continue
            off=abs(-dx*uy+dy*ux); half=half0+(half1-half0)*t/length
            if off>half: continue
            k=k0*(1-t/length)**1.3*(1-(off/half)**2)
            r,g,b,a=P[x,y]
            if a==255: P[x,y]=(int(r+(col[0]-r)*k),int(g+(col[1]-g)*k),int(b+(col[2]-b)*k),255)
            else:
                al=int(min(cap,255*k*0.9))
                if al>=7 and a<al: P[x,y]=col+(al,)
def build(soldier=False,station=None,tier=3,figure=None,front_rail=True,lights=True,bands=False,guard=None,flag=True):
    import math
    im=C.compose(station or station_for(tier),soldier,tier,figure,front_rail,bands)
    if tier>=4:
        PC='/home/claude/deadline-repo/Assets/Village/_source/clock-3q/pieces/'
        paste_piece(im,PC+'gymL_r2.png',61,H-1); paste_piece(im,PC+'gymR_r1.png',108,H-1)
    if tier>=5:
        paste_piece(im,PC+'gymR_r1.png',3,H-1,dim=0.86)                     # third stack at the station's shaded left corner
        paste_piece(im,PC+'gymR_r1.png',76,H-1)                             # and one more beside the first, a low wall up to the ladder plate
        if guard is not None: im.alpha_composite(guard)
        if flag:                                                           # the shared survivor flag, on the right whip antenna beside the beacon
            fx0,fy0=B.CX+5,Y(B.TOP+15)
            P=im.load()
            for yy in range(fy0-3,fy0+1): P[fx0,yy]=(84,88,102,255)         # the whip runs 3px higher to carry it
            fl_=clean(Image.open(PC+'flag_r1.png')); im.alpha_composite(fl_,(fx0+1,fy0-3))
    if tier==1:                                                    # dead weeds and rubble along the foot (in front of everything)
        import random
        rw=random.Random(5); P=im.load()
        for (xc,n) in ((6,3),(15,2),(36,3),(58,4),(66,3),(84,4),(92,2),(119,4),(124,2)):
            for k in range(n):
                x=xc+k*2+rw.randint(-1,1); hgt=rw.randint(3,8); lean=rw.choice((-1,0,0,1)); col=rw.choice(((92,88,56),(74,76,50),(110,98,66)))
                for t in range(hgt):
                    xx=x+(lean*t)//3
                    if 0<=xx<W: P[xx,H-1-t]=(col if t<hgt-1 else tuple(min(255,v+24) for v in col))+(255,)
        for (xr,wr) in ((44,5),(74,6),(100,4)):                                                             # low rubble heaps
            for i in range(wr):
                hh=1+(1 if 0<i<wr-1 else 0)+(1 if i==wr//2 else 0)
                for t in range(hh): P[xr+i,H-1-t]=((96,92,88) if t==hh-1 else (64,62,64))+(255,)
    if tier<=2:                                                    # dull pass (before any light): colour and brightness pulled down, light sources left alone
        sat,br={2:(0.80,0.80),1:(0.62,0.64)}[tier]
        keepers=[(B.CX-3,Y(B.TOP+20),B.CX+2,Y(B.TOP+13)),(70,H-17,80,H-1),(51,Y(21),56,Y(16))]   # beacon lens, fire barrel, candle
        P=im.load()
        for y in range(H):
            for x in range(W):
                r,g,b_,a_=P[x,y]
                if not a_ or any(x0<=x<=x1 and y0<=y<=y1 for (x0,y0,x1,y1) in keepers): continue
                gr=0.299*r+0.587*g+0.114*b_
                P[x,y]=(int((gr+(r-gr)*sat)*br),int((gr+(g-gr)*sat)*br),int((gr+(b_-gr)*sat)*br),255)
    if not lights: return im
    if tier==2:
        glow(im,B.CX-0.5,Y(B.TOP+17),4,(214,80,62),0.30,cap=70)                       # the weak beacon
        glow(im,74.5,H-13,9,(244,160,70),0.34,cap=90,shape=0.9)                        # fire barrel
        glow(im,74.5,H-8,13,(244,160,70),0.20,opaque_only=True)
        glow(im,53.5,Y(18),5,(255,214,150),0.22,opaque_only=True)                      # the candle on the sill
        return im
    if tier==1: return im
    keep=im.copy()
    glow(im,B.CX-0.5,Y(B.TOP+17),7,(240,84,60),0.55,cap=120)
    bx=keep.load(); P=im.load()
    for y in range(Y(B.TOP+20),Y(B.TOP+13)+1):
        for x in range(B.CX-3,B.CX+3): P[x,y]=bx[x,y]
    glow(im,40.5,Y(31),10,(255,214,150),0.30,opaque_only=True,shape=0.8)
    glow(im,32,Y(39),9,(230,70,56),0.16,opaque_only=True,shape=1.6)
    if tier>=4:                                                    # deck work lamp on the mast, over the lookout
        lxp,lyp=B.CX-8,Y(B.PH+27)
        P=im.load(); P[lxp,lyp]=(255,236,190,255); P[lxp+1,lyp]=(250,214,150,255); P[lxp,lyp-1]=(60,62,74,255); P[lxp+1,lyp-1]=(60,62,74,255)
        glow(im,lxp-1,lyp+6,11,(255,214,150),0.34,opaque_only=True,shape=0.75)
        glow(im,lxp+0.5,lyp+0.5,3,(255,214,150),0.5,cap=110)
    if tier>=4 and front_rail:                                     # platform floodlight: beam 45 degrees down and out to the right
        ux=(B.CX+22)+4; uy=(Y(B.PH)-2)-7
        keep=im.copy()
        cone(im,ux+3,uy+6,math.radians(45),BEAM_LEN,2,BEAM_HALF,(232,242,255),0.55,cap=135)
        glow(im,ux+3,uy+6,5,(232,242,255),0.55,cap=130)
        kp=keep.load(); P=im.load()
        for yy in range(uy-1,uy+9):                                 # keep the housing and lens crisp
            for xx in range(ux-4,ux+6):
                if kp[xx,yy][3]==255: P[xx,yy]=kp[xx,yy]
    if tier>=5:
        for hx in (-1,1):                                           # blooms on the mid-level obstruction lights
            half=(44+(18-44)*84/B.PH)/2; x=round(B.CX+hx*half)
            glow(im,x,Y(84)-1,4,(240,84,60),0.5,cap=110)
        P=im.load()                                               # yard light on the station roof's right end, washing the sandbags and the tower foot
        for (xx,yy,cc) in ((64,Y(47),(60,62,74)),(65,Y(47),(60,62,74)),(64,Y(46),(255,236,190)),(65,Y(46),(250,214,150))): P[xx,yy]=cc+(255,)
        glow(im,66,Y(36),17,(255,220,160),0.30,opaque_only=True,shape=0.9)
        glow(im,64.5,Y(46)+0.5,3,(255,220,160),0.5,cap=100)
        glow(im,32,Y(39),11,(230,70,56),0.14,opaque_only=True,shape=1.6)           # the sign burns a little brighter
    return im
if __name__=='__main__':
    t3=build(); t3.save('bt_t3_v1_128x208.png'); print(t3.getbbox())
    build(soldier=True).save('bt_t3_v1_soldier.png')
    bg=Image.new('RGBA',(W+16,H+16),(30,28,44,255)); bg.alpha_composite(t3,(8,8)); bg.resize((bg.width*4,bg.height*4),Image.NEAREST).save('bt_t3_v1_4x.png')
