# Re-angle the 8c tower to the village camera: front wall flat (every horizontal level),
# left side wall receding (horizontals drop to the left in proportion to their height; level at the ground).
from PIL import Image, ImageDraw
import sys
W,H=112,208; C=46                      # C = the corner column shared by the front and side walls
A=0.00033                              # the front's unwanted drop to the right (per px of height, per px of x), measured
B=0.0014                               # the side wall's present drop to the left, measured
OUT=(22,20,24,255); L=(196,188,162,255); M=(150,143,122,255)
def build(k):
    before=Image.open('out/E_c8_raised_code_ashlar_52_0.png').convert('RGBA')
    fixed=Image.open('c8c_fixed.png').convert('RGBA')
    src=fixed.copy(); src.paste(before.crop((0,0,W,34)),(0,0))      # base/door fixes + the untouched roof
    sp=src.load(); im=Image.new('RGBA',(W,H),(0,0,0,0)); px=im.load()
    for x in range(W):
        f=(1-A*(x-C)) if x>=C else (1-B*(C-x))/(1-k*(C-x))
        for y in range(H):
            h=(H-1-y)*f; ys=H-1-int(round(h))
            if 0<=ys<H: px[x,y]=sp[x,ys]
    # ---- roof + eave redrawn on the new geometry
    heave=H-1-29                                                    # eave height at the corner
    def drop(x,h): return int(round(k*h*(C-x))) if x<C else 0
    xL,xR=28,84                                                     # eave ends (side / front)
    apex=(56.5,4); eL=(xL+2,28+drop(xL+2,heave)); eR=(xR-3,28)
    slate_s=(40,44,60,255); slate_f=(58,62,84,255)
    def lerp(p,q,y): return p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1])
    for y in range(4,eL[1]+1):
        a0=int(round(lerp(apex,eL,y))) if y<=eL[1] else None
        b0=int(round(lerp(apex,eR,y))) if y<=eR[1] else None
        for x in range(W):
            eave_y=28+drop(x,heave)
            inside=(a0 is not None and x>=a0) and ((b0 is not None and x<=b0) if y<=eR[1] else x<C) and y<=eave_y
            if not inside:
                if y<=eave_y-0 and (x<C or y<=28): 
                    if y<29+drop(x,heave): px[x,y]=(0,0,0,0)
                continue
            p=px[x,y]
            if p[3]<=20 or sum(p[:3])>330:
                up=px[x,y-1]
                px[x,y]=up if (up[3]>20 and sum(up[:3])<=330 and up!=OUT) else (slate_s if x<lerp(apex,(C,28),y) else slate_f)
            else: px[x,y]=p[:3]+(255,)
        if a0 is not None and 0<=a0<W: px[a0,y]=OUT
        if b0 is not None and y<=eR[1]: px[b0,y]=OUT
    for x in range(xL,xR+1):
        off=drop(x,heave); side=x<C
        for kk,c in enumerate([OUT,(138,133,118,255) if side else L,(104,100,92,255) if side else M,OUT]): px[x,29+off+kk]=c
        for yy in range(0,29+off):                                   # nothing may float above the eave outside the roof
            pass
    for x in (xL-1,xR+1):
        off=drop(x,heave)
        for kk in range(4): px[x,29+off+kk]=OUT
    return im
if __name__=='__main__':
    for name,k in (('A',0.0037),('B',0.0025)):
        im=build(k); im.save(f'c8c_turned_{name}.png')
