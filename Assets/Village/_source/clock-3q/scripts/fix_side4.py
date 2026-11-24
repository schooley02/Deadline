from PIL import Image, ImageDraw, ImageFont
j=Image.open('jeremy_t3_v2.png').convert('RGBA')
C=46; OUT=(12,10,15,255); SW=18
HI=(81,77,66,255); BODY=(66,64,60,255); SH=(42,39,38,255); GR=(26,24,28,255)
GROOVES=[172,177,182,187,192,197,202]          # the front wall's groove rows, at the corner
def build(top_drop=2, bot_rise=4):
    im=j.copy(); px=im.load()
    for x in range(24,C):
        t=(C-x)/SW; y_top=164+top_drop*t; y_bot=207-bot_rise*t
        Y=lambda g: int(round(y_top+(g-164)*(y_bot-y_top)/43))
        yt=Y(164); yb=Y(207); gl=[Y(g) for g in GROOVES]
        for y in range(160,208):
            if y<yt:
                if y>=164: px[x,y]=(0,0,0,0) if x<=28 else (OUT if x==29 else BODY)
                continue
            if y>yb or x<=26: px[x,y]=(0,0,0,0); continue
            if y<=yt+3:                                   # the ledge on top of the first floor
                c=[OUT,(88,84,74,255),BODY,(30,27,31,255)][y-yt]
                px[x,y]=(OUT if (x==27 and True) else c) if x<=27 else c
                continue
            if x==27: px[x,y]=(0,0,0,0); continue
            if x==28 or y==yb: px[x,y]=OUT; continue
            if y in gl: c=GR
            elif (y+1) in gl or y+1==yb: c=SH
            elif (y-1) in gl or y==yt+4: c=HI if y!=yt+4 else SH
            else: c=BODY
            px[x,y]=c
    return im
im=build(); im.save('clock_t3_fixed_v7.png')
box=(18,140,98,208); S=8
o=Image.new('RGBA',(80*2+8,68+5),(28,32,44,255)); o.alpha_composite(j.crop(box),(0,0)); o.alpha_composite(im.crop(box),(88,0))
o=o.resize((o.width*S,o.height*S),Image.NEAREST); d=ImageDraw.Draw(o); f=ImageFont.load_default(size=18)
d.text((8,69*S-4),'your touch-up',fill=(235,235,235,255),font=f); d.text((88*S+8,69*S-4),'side of the first floor angled away',fill=(235,235,235,255),font=f)
o.convert('RGB').save('clock_tower_t3_first_floor_side_angled.png')
