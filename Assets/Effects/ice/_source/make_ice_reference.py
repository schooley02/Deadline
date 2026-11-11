from PIL import Image, ImageDraw
import random
W=H=128; FEET=118; CX=64
OUT=(22,48,82,255); DARK=(46,96,150,170); MID=(86,156,210,140); LIGHT=(150,214,245,150)
HI=(214,243,255,235); WHITE=(255,255,255,255); FROST=(196,232,250,200); FROST2=(140,196,230,170)

def overlay(cracked=False):
    im=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(im)
    # ground frost patch
    d.ellipse((CX-40,FEET-5,CX+40,FEET+7),fill=FROST2)
    d.ellipse((CX-30,FEET-3,CX+30,FEET+4),fill=FROST)
    # crystals: (base_x, base_w, top_y, lean)
    crystals=[(-34,9,96,-9),(-22,13,80,-5),(-8,18,92,-2),(24,16,60,4),(12,11,76,1),(35,10,82,10),(2,9,100,0)]
    # main block behind crystals: chunky faceted shin block
    blk=[(CX-30,FEET),(CX-32,FEET-18),(CX-26,FEET-30),(CX-12,FEET-34),(CX+6,FEET-32),(CX+22,FEET-30),(CX+31,FEET-20),(CX+30,FEET)]
    d.polygon(blk,fill=MID,outline=OUT)
    # inner facet lines
    d.line([(CX-26,FEET-30),(CX-14,FEET-12),(CX-30,FEET)],fill=DARK)
    d.line([(CX+6,FEET-32),(CX+2,FEET-14),(CX+22,FEET-30)],fill=DARK)
    d.line([(CX-14,FEET-12),(CX+2,FEET-14),(CX+30,FEET)],fill=DARK)
    for bx,bw,ty,lean in crystals:
        x0=CX+bx-bw//2; x1=CX+bx+bw//2; tx=CX+bx+lean
        poly=[(x0,FEET),(x0+1,FEET-(FEET-ty)*0.75),(tx,ty),(x1-1,FEET-(FEET-ty)*0.7),(x1,FEET)]
        d.polygon(poly,fill=LIGHT,outline=OUT)
        # left highlight edge
        d.line([(x0+2,FEET-3),(x0+2,int(FEET-(FEET-ty)*0.72)),(tx,ty+2)],fill=HI)
        # dark right shade
        d.line([(tx+1,ty+4),(x1-2,int(FEET-(FEET-ty)*0.66)),(x1-2,FEET-2)],fill=DARK)
        d.point((tx,ty+1),fill=WHITE)
    # sparkles
    for p in [(CX-24,84),(CX+26,66),(CX-6,98),(CX+14,90)]:
        x,y=p; d.point(p,fill=WHITE); d.point((x-1,y),fill=HI); d.point((x+1,y),fill=HI); d.point((x,y-1),fill=HI); d.point((x,y+1),fill=HI)
    if cracked:
        C=(10,24,44,255)
        for path in [[(CX-22,82),(CX-19,92),(CX-23,100),(CX-17,110)],
                     [(CX+26,62),(CX+23,74),(CX+28,88),(CX+22,104)],
                     [(CX-4,86),(CX+1,96),(CX-3,104),(CX+3,114)],
                     [(CX+10,92),(CX+15,100),(CX+11,110)],
                     [(CX-34,96),(CX-29,104),(CX-33,112)]]:
            d.line(path,fill=C)
            for (x,y) in path[1:-1]: d.point((x+1,y),fill=HI)
        # chipped tips: erase top of two crystals
        for (x,y,w,h) in [(CX-28,78,6,4),(CX+38,80,6,5)]:
            d.rectangle((x,y,x+w,y+h),fill=(0,0,0,0))
        # falling chips
        for p in [(CX-30,74),(CX+42,76),(CX+30,56)]:
            d.rectangle((p[0],p[1],p[0]+1,p[1]+1),fill=HI)
    return im
a=overlay(False); b=overlay(True)
a.save('ice_overlay_f1.png'); b.save('ice_overlay_f2.png')
sheet=Image.new('RGBA',(256,128)); sheet.paste(a,(0,0)); sheet.paste(b,(128,0)); sheet.save('ice_overlay_sheet.png')

# composite previews on zombies (attack frame), tint zombie like CSS roughly
import json, colorsys
def tint(fr):
    px=fr.load(); out=fr.copy(); po=out.load()
    for y in range(fr.height):
        for x in range(fr.width):
            r,g,b,a=px[x,y]
            if a==0: continue
            h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
            h=(h+160/360)%1; s*=0.45; l=min(1,l*1.12)
            rr,gg,bb=colorsys.hls_to_rgb(h,l,s); po[x,y]=(int(rr*255),int(gg*255),int(bb*255),a)
    return out
BG=(28,30,40,255)
tiles=[]
for c in ['career','spirituality','other']:
    j=json.load(open(f'/mnt/user-data/uploads/Deadline/Assets/Zombies/anim/{c}.json')); s=j['frameWidth']; fy=j['feetY']
    for f in (0,4):
        for ov in (a,b):
            fr=Image.open(f'{c}_atk{f}.png'); fr=tint(fr)
            canvas=Image.new('RGBA',(180,180),BG)
            ox=(180-s)//2; oy=(180-s)//2
            canvas.alpha_composite(fr,(ox,oy))
            canvas.alpha_composite(ov,(ox+s//2-64, oy+fy-FEET))
            tiles.append(canvas)
cols=4; rows=3
grid=Image.new('RGBA',(cols*180,rows*180),BG)
for i,t in enumerate(tiles): grid.paste(t,((i%cols)*180,(i//cols)*180))
grid=grid.resize((grid.width*2,grid.height*2),Image.NEAREST); grid.save('preview_on_zombies.png')
big=sheet.resize((256*4,128*4),Image.NEAREST)
bg=Image.new('RGBA',big.size,(40,44,56,255)); bg.alpha_composite(big); bg.save('reference_overlay_4x.png')
