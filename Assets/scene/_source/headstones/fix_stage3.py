from PIL import Image
src=Image.open('/mnt/user-data/attachments/0d042a2f-1986-5e96-a1b6-0c1d52ab2145/f433bf8c-image.png').convert('RGBA')
t=src.crop((32,0,64,32))
def build(bright):
    out=Image.new('RGBA',(32,32))
    # stone rows 5..19 kept, mound trimmed to rows 20..22 within a lens shape
    for y in range(5,23):
        for x in range(32):
            p=t.getpixel((x,y))
            if not p[3]: continue
            if y>=20:
                half={20:9,21:10,22:9}[y]
                if abs(x-16)>half: continue
            if y<20 and bright!=1:
                p=tuple(min(255,int(v*bright)) for v in p[:3])+(255,)
            out.putpixel((x,y+9),p)
    # bottom row of the mound = darkest outline
    for x in range(8,25):
        if out.getpixel((x,31))[3]: out.putpixel((x,31),(1,2,19,255))
    return out
build(1).save('gold_trim_32.png'); build(1.45).save('gold_trim_bright_32.png')
