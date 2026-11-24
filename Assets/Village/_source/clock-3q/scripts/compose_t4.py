from PIL import Image
import math
t3=Image.open('clock_t3_final_112x208.png').convert('RGBA'); code=Image.open('t4/clock_t4_code.png').convert('RGBA')
sn=Image.open('out/T4snip_71_0.png').convert('RGBA'); ft=Image.open('out/T4foot_71_0.png').convert('RGBA')
im=code.copy(); px=im.load(); t=t3.load(); s=sn.load(); f=ft.load()
im.save('t4/clock_t4_noglow.png')
# see-through glow (fixtures only): two warm lamps, one cool searchlight beam to the right
def glow(cx,cy,R,col,k0,cone=None,opaque_only=False,skip=()):
    for y in range(max(0,cy-R),min(208,cy+R+1)):
        for x in range(max(0,cx-R),min(112,cx+R+1)):
            dx,dy=x-cx,y-cy; dd=math.hypot(dx,dy)
            if dd>R: continue
            k=k0*(1-dd/R)**1.5
            if cone:
                al_=(dx+dy)/math.sqrt(2); pe=(dy-dx)/math.sqrt(2)
                if al_<1: continue
                half=1+al_*cone
                if abs(pe)>half: continue
                k*= (1-(abs(pe)/half)**2)
            p=px[x,y]
            if p[:3] in skip: continue
            if opaque_only and p[3]<=20: continue
            if p[3]>20:
                a=min(0.6,k); px[x,y]=tuple(int(p[i]+(col[i]-p[i])*a) for i in range(3))+(255,)
            else:
                al=int(min(150,255*k*0.9))
                if al>=7: px[x,y]=col+(al,)
for x in (37,94):
    glow(x+1,171,22,(255,214,150),0.55,opaque_only=True)   # warm wash on the wall and ground
    glow(x+1,171,8,(255,214,150),0.55)                     # small halo in the air
# T4 clock faces brighter: lit glass pushed toward warm white, plus a soft wash on the stone around them
FACE={(252,245,161):(255,252,214),(222,212,140):(248,240,178),(217,210,144):(246,238,182),(196,186,122):(232,222,156)}
for y in range(60,94):
    for x in range(30,82):
        p=px[x,y]
        if p[:3] in FACE: px[x,y]=FACE[p[:3]]+(255,)
glow(66,76,20,(255,244,190),0.28,opaque_only=True,skip=set(FACE.values()))
glow(39,79,12,(255,244,190),0.18,opaque_only=True,skip=set(FACE.values()))
glow(85,53,26,(240,246,255),0.7,cone=0.35)
im.save('t4/clock_t4_draft_112x208.png')
