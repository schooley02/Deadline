"""Final headstone sprites: take each cleaned candidate, drop its 3 PixelLab mound rows, put the SAME dirt lip
under every stage, and save 32x32 bottom-aligned (lip = bottom 3 rows; the marker stands on row 28)."""
from PIL import Image
SRC={0:'cross_straight_wood_short.png',1:'bronze_pick_1.45.png',2:'silver_00.png',3:'g00.png',4:'p72.png'}
TOP,MID,DARK=(74,60,92,255),(57,46,77,255),(33,28,51,255)
for st,f in SRC.items():
    im=Image.open(f).convert('RGBA')
    out=Image.new('RGBA',(32,32))
    for y in range(29):
        for x in range(32):
            p=im.getpixel((x,y))
            if p[3]: out.putpixel((x,y),p)
    xs=[x for x in range(32) if out.getpixel((x,28))[3]]
    x0,x1=min(xs),max(xs)
    for x in range(x0-2,x1+3): out.putpixel((x,29),TOP if x0<=x<=x1 else MID)
    for x in range(x0-1,x1+2): out.putpixel((x,30),MID)
    for x in range(x0+1,x1): out.putpixel((x,31),DARK)
    out.save(f'headstone-{st}.png'); print(st,out.getbbox())
