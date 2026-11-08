"""Turn one PixelLab 32x32 variation tile into a headstone sprite: keep the marker, trim the mound to a
3-row lens, brighten the marker (mound untouched), optional warm tint; output 32x32 bottom-aligned."""
from PIL import Image
import colorsys
def process(sheet, col, row, bright=1.45, tint=None, lens=(9,10,9), mstart=None):
    t=Image.open(sheet).convert('RGBA').crop((col*32,row*32,col*32+32,row*32+32))
    widths=[sum(1 for x in range(32) if t.getpixel((x,y))[3]) for y in range(32)]
    top=next(y for y in range(32) if widths[y])
    if mstart is None: mstart=next(y for y in range(top,32) if widths[y]>=18)   # first mound row
    out=Image.new('RGBA',(32,32))
    rows=list(range(top,mstart+3)); shift=31-rows[-1]
    for y in rows:
        for x in range(32):
            p=t.getpixel((x,y))
            if not p[3]: continue
            if y>=mstart:
                if abs(x-16)>lens[y-mstart]: continue
            else:
                r,g,b=[min(255,int(v*bright)) for v in p[:3]]
                if tint:
                    h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
                    r,g,b=[int(v*255) for v in colorsys.hls_to_rgb(tint[0],l,max(s,tint[1]))]
                p=(r,g,b,255)
            out.putpixel((x,y+shift),p)
    for x in range(32):
        if out.getpixel((x,31))[3]: out.putpixel((x,31),(1,2,19,255))
    return out
