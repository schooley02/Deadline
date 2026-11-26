import sys; sys.path.insert(0,'/home/claude/lib')
import math, colorsys
from PIL import Image, ImageDraw
from lab_fx import glow, glass_shine, lum, ALL
base=Image.open('lab_t3_final_v3_noglow_160x160.png').convert('RGBA')         # the final star 3 art (your touch-ups), before shine and light
heavy=Image.open('lab_t2_base_v21_noglow.png').convert('RGBA')                # the heavy-fungus version you approved for star 2
v=base.copy(); P=v.load(); H=heavy.load(); M=Image.open('mask_thin.png').convert('L').load()
fung=lambda p: p[3]>0 and p[1]>=p[0] and p[1]>p[2]+6 and lum(p)>95
warm=lambda p: p[3]==255 and p[0]>200 and p[1]>150 and p[2]<160
# 1) heavy fungus back: everything that was cleared for star 3, plus the big cluster at the foot of the corner
for x in range(160):
    for y in range(160):
        nearf=lambda: any(0<=x+dx<160 and 0<=y+dy<160 and fung(H[x+dx,y+dy]) for dx in (-1,0,1) for dy in (-1,0,1))
        if M[x,y] or (45<=x<=70 and 114<=y<=158) or (36<=x<=44 and 114<=y<=158 and nearf()): P[x,y]=H[x,y]
# 1b) the sign: same clean board and letters as star 3, but unlit; the fungus still grows over its right end
GL={'L':["X....","X....","X....","X....","X....","X....",".XXXX"],'A':[".XXX.","X...X","X...X","XXXXX","X...X","X...X","X...X"],'B':["XXXX.","X...X","X...X","XXXX.","X...X","X...X","XXXX."]}
for x in range(112,144):
    for y in range(48,65):
        P[x,y]=(8,8,10,255) if (x<114 or x>141 or y<50 or y>62) else (40,40,43,255)
for i,ch in enumerate("LAB"):
    for r,row in enumerate(GL[ch]):
        for c,k in enumerate(row):
            if k=='X': P[117+i*8+c,53+r]=(98,96,90,255)
for x in range(112,146):
    for y in range(46,67):
        if (fung(H[x,y]) and x>=139) or (H[x,y][3] and H[x,y][1]>=H[x,y][0] and H[x,y][1]>H[x,y][2]+4 and 55<lum(H[x,y])<96 and M[x,y] and x>=139): P[x,y]=H[x,y]
# 2) cage: empty. Every column behind the zombie is refilled from the clear row above its head, so bars and back bars stay exactly where they were
for x in range(8,33):
    src=P[x,111]
    for y in range(112,136+(x-4)//4):
        P[x,y]=src
# a scrap sheet wired over a bent section of bars, sloping with the cage face
def ptile(x,y): return (118,80,56) if (x*5+y*3)%7>2 else ((98,64,46) if (x+y)%3 else (134,96,66))
for x in range(13,24):
    t=121+(x-13)//4
    for y in range(t,t+9):
        e=(x in (13,23)) or y in (t,t+8)
        P[x,y]=((50,36,30) if e else ptile(x,y))+(255,)
for (x,y) in ((14,122),(22,124),(14,128),(22,130)): P[x,y]=(160,134,108,255)       # wire ties
for x in range(15,22): P[x,125+(x-13)//4]=(84,56,42,255)                             # a crease
# 3) work lamp off; that wall falls back into shade
import statistics
def colref(x):                                   # the same end wall one storey up, where no lamp ever shone: this column's unlit colour
    c=sorted((P[x,y] for y in range(76,85) if P[x,y][3]==255), key=lum); return c[len(c)//2]
REF={x:colref(x) for x in range(5,49)}; hood=set()
for x in range(5,50):
    for y in range(90,152):
        p=P[x,y]
        if p[3]!=255 or fung(p): continue
        if 13<=x<=30 and 92<=y<=108 and (warm(p) or (p[0]>p[2]+24 and lum(p)>60)):       # the lamp itself: same hood, cold bulb
            l=lum(p); k=0.42 if l<190 else 0.30; P[x,y]=(int(l*k*1.02),int(l*k),int(l*k*0.98),255); hood.add((x,y)); continue
        l=lum(p); f=0.80 if l>34 else 1.0; g=l*f
        P[x,y]=(int((p[0]*0.45+l*0.55)*f*0.96),int((p[1]*0.45+l*0.55)*f),int(min(255,(p[2]*0.45+l*0.55)*f*1.06)),255)
# 3b) no lamp at star 2 (Jeremy painted it out). The strip of end wall above the cage is redrawn as plain container doors,
#     column for column the same as the doors one storey up: posts, panels, locking bars, with slats and bar keepers added
HIS=Image.open('/home/claude/in_touch6/t2.png').convert('RGBA').load()
def colc(x):
    if x<=41: return REF[x]
    if x<=44: return REF[40]
    if x==45: return REF[37]
    if x==46: return REF[38]
    return None
panel=lambda c: 26<=lum(c)<=50
# below eye level the wall's lines climb toward the far (left) end, the mirror of the storey above and the same lean as the cage floor
sA=lambda x: 97-(1 if x<26 else 0)
sB=lambda x: 103-max(0,(46-x)//14)
mul=lambda c,k: (min(255,int(c[0]*k)),min(255,int(c[1]*k)),min(255,int(c[2]*k)),255)
for x in range(5,49):
    c=colc(x)
    if c is None: continue
    for y in range(93,107):
        if P[x,y][3]!=255 or (fung(P[x,y]) and x>42): continue
        k=0.72 if y==93 else 1.0
        if panel(c) and y in (sA(x),sB(x)) and 8<=x<=44: k=1.34                         # corrugation slats, as on the doors above
        if panel(c) and y in (sA(x)+1,sB(x)+1) and 8<=x<=44: k=0.80
        P[x,y]=mul(c,k)
for bx in (16,22,30,37,45):                                                         # keepers where each locking bar meets the top of the door
    for dx in (-1,1):
        if P[bx+dx,95][3]==255: P[bx+dx,95]=mul(REF[37],1.0)
    P[bx,94]=mul(REF[37],1.15)
for x in range(5,47):
    if P[x,107][3]==255: P[x,107]=(9,9,11,255)                                      # shadow line where the cage roof meets the wall
for (x,y) in [(48,90)]+[(46,y) for y in range(108,114)]: P[x,y]=HIS[x,y]            # his other small edits beside the strip
for x in range(4,46):                                                               # the cage's top rail was catching the lamp too
    for y in (108,109):
        p=P[x,y]
        if p[3]==255 and lum(p)>52: k=52/lum(p); P[x,y]=(int(p[0]*k),int(p[1]*k),int(p[2]*k),255)
# 3c) star 2 is not maintained: rust and grime on the redrawn doors and on the cage (lighter on the doors above, so the end wall reads as one surface)
def hh(x,y,k=0): return ((x*73856093)^(y*19349663)^(k*83492791))%100
def rust(p,d=1.0):
    l=lum(p)*d; return (min(255,int(l*1.50+6)),int(l*0.86+2),int(l*0.56),255)
plate_px=lambda x,y: 13<=x<=23 and 121+(x-13)//4<=y<=129+(x-13)//4
for x in range(5,47):                                                               # the door strip above the cage
    for y in range(93,107):
        p=P[x,y]
        if p[3]!=255 or fung(p) or lum(p)<16: continue
        blot=hh(x//3,(y+x//5)//3,1)<24 and hh(x,y,2)<74                              # ragged rust patches
        slat=y in (sA(x),sB(x)) and lum(p)>44
        if slat and hh(x//2,y,3)<34: P[x,y]=rust(p,0.62); continue                   # slats eaten through in places
        if blot: P[x,y]=rust(p,0.92 if hh(x,y,4)<60 else 0.70); continue
        k=1+((hh(x,y,5)%13)-6)*0.016-(0.10 if y>=104 else 0)                         # mottle, grime gathering at the bottom
        P[x,y]=mul(p,k)
for x in range(8,45):                                                               # rust running down from the slats
    for y0 in (sA(x)+1,sB(x)+1):
        if hh(x,y0,6)<20:
            for y in range(y0,min(107,y0+2+hh(x,y0,7)%3)):
                if P[x,y][3]==255 and 16<=lum(P[x,y])<70 and not fung(P[x,y]): P[x,y]=rust(P[x,y],0.80)
for x in range(4,47):                                                               # the cage: bars, rails and side panel
    for y in range(108,148):
        p=P[x,y]
        if p[3]!=255 or fung(p) or lum(p)<34 or plate_px(x,y) or (33<=x<=35 and 125<=y<=128): continue
        pr=34+(22 if y>=134 else 0)+(14 if y<=110 else 0)
        if hh(x,(y+x)//4,8)<pr: P[x,y]=rust(p,1.0 if hh(x,y,9)<55 else 0.70)
        elif hh(x,y,10)<14: P[x,y]=mul(p,0.72)                                      # pitting
for x in range(5,45):                                                               # a lighter pass on the doors one storey up
    for y in range(47,88):
        p=P[x,y]
        if p[3]!=255 or fung(p) or not (22<=lum(p)<=80) or (p[1]>p[0]+3 and p[1]>p[2]): continue
        if hh(x//3,(y+x//4)//3,11)<13 and hh(x,y,12)<70: P[x,y]=rust(p,0.90 if hh(x,y,13)<60 else 0.72)
# 4) the lab inside: dark room, the right tank empty and unlit, only the left tank (with the zombie) glowing
liq=lambda p: p[1]>p[0]+12 and p[1]>p[2]+10
for x in range(100,112):                                                           # no patient yet at star 2
    ref=[P[x,y] for y in (131,130,102,103) if liq(P[x,y])]; fill=ref[0] if ref else (150,205,168,255)
    for y in range(102,132):
        if not liq(P[x,y]): P[x,y]=fill
for (x0,x1) in ((72,94),(96,118)):
    for x in range(x0,x1+1):
        for y in range(96,138):
            p=P[x,y]
            if p[3]!=255: continue
            if 77<=x<=90 and 98<=y<=136: continue                                   # the lit tank and its caps
            f=0.34 if not (98<=x<=113) else 0.30
            P[x,y]=(int(p[0]*f*0.86),int(p[1]*f*0.96),int(p[2]*f*1.10),255)
for x in range(66,100):                                                             # green light from the lit tank on the dark room beside it
    for y in range(96,138):
        if 77<=x<=90 or not (72<=x<=118) or x==95: continue
        dd=(77-x) if x<77 else (x-90)
        if 0<dd<=6:
            k=0.26*(1-dd/6.5); p=P[x,y]; P[x,y]=(int(p[0]+(110-p[0])*k),int(p[1]+(190-p[1])*k),int(p[2]+(140-p[2])*k),255)
# 5) upstairs: left window dark and boarded, right window lit by one candle
for x in range(64,88):
    for y in range(46,70):
        if warm(P[x,y]): P[x,y]=(24,28,36,255)
for (x0,y0,x1,y1) in ((66,53,85,56),(67,61,84,59)):
    n=x1-x0
    for i in range(n+1):
        x=x0+i; yc=y0+(y1-y0)*i/n
        for k,c in ((-1,(134,100,66)),(0,(112,82,54)),(1,(84,60,42))):
            y=int(round(yc))+k
            if P[x,y][3]: P[x,y]=c+(255,)
    for x in (x0+1,x1-1): P[x,int(round(y0+(y1-y0)*(x-x0)/n))]=(40,40,44,255)        # nails
cx,cy=100,62
for x in range(90,110):
    for y in range(46,70):
        if warm(P[x,y]):
            dd=math.hypot(x-cx,(y-cy)*1.1); k=max(0.0,1-dd/8.0)
            P[x,y]=(int(86+150*k),int(58+112*k),int(34+60*k),255)
for (x,y,c) in ((cx,cy-1,(255,236,170)),(cx,cy,(255,214,140)),(cx,cy+1,(214,204,184)),(cx,cy+2,(180,170,152))): 
    if P[x,y][3]: P[x,y]=c+(255,)
# 6) door window dark, 7) spotlight off, 8) door beacon off
for x in range(122,148):
    for y in range(100,122):
        if warm(P[x,y]): P[x,y]=(26,30,38,255)
for x in range(68,94):
    for y in range(16,40):
        p=P[x,y]
        if p[3]==255 and p[0]>215 and p[1]>190: P[x,y]=(92,88,80,255)
for x in range(120,142):
    for y in range(82,100):
        p=P[x,y]
        if p[3]!=255: continue
        if p[0]>190 and p[1]<150: P[x,y]=(92,34,24,255)
        elif p[0]>p[1]+22 and p[0]>p[2]+26: l=lum(p); P[x,y]=(int(p[0]*0.4+l*0.6),int(p[1]*0.4+l*0.6),int(p[2]*0.4+l*0.6),255)
# 9) temporary repairs: two riveted scrap plates on the front wall
def plate(x0,y0,x1,y1):
    for x in range(x0,x1+1):
        for y in range(y0,y1+1):
            edge=x in (x0,x1) or y in (y0,y1)
            n=(x*x*3+y*y*5+x*y)%11
            c=(50,36,30) if edge else ((134,96,66) if y==y0+1 else ((92,60,44) if (y==y1-1 or x==x0+1) else ((122,84,58) if n>3 else ((104,68,48) if n>1 else (140,104,74)))))
            P[x,y]=c+(255,)
    for (x,y) in ((x0+1,y0+1),(x1-1,y0+1),(x0+1,y1-1),(x1-1,y1-1)): P[x,y]=(166,140,112,255)
    for i in range(min(x1-x0,y1-y0)-4): P[x0+3+i,y1-3-i]=(150,112,80,255)              # a scratch
    for x in range(x0+2,x1-1,3):
        for y in range(y1+1,y1+2+(x%3)*2):
            if P[x,y][3] and lum(P[x,y])>60: P[x,y]=(104,74,56,255)
plate(60,108,68,119)
# 10) duller pass (everything but the fungus and the lights)
for x in range(160):
    for y in range(160):
        p=P[x,y]
        if p[3]==255 and not fung(p) and not (77<=x<=90 and 98<=y<=136) and not (p[0]>230 and p[1]>200):
            h,s,val=colorsys.rgb_to_hsv(p[0]/255,p[1]/255,p[2]/255); r,g,b=colorsys.hsv_to_rgb(h,s*0.86,val*0.88); P[x,y]=(int(r*255),int(g*255),int(b*255),255)
v=glass_shine(v,strength=0.5)
v.save('lab_t2_draft_v8_noglow.png')
f=glow(v,ALL); f.save('lab_t2_draft_v8.png'); print(f.getbbox())
bg=Image.new('RGBA',(1600,1600),(20,24,38,255)); bg.alpha_composite(f.resize((1600,1600),Image.NEAREST)); bg.save('lab_t2_draft_v8_10x.png')
