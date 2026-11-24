from PIL import Image, ImageDraw, ImageChops
import bt208 as B
W,H=B.W,B.H
def shift(im,dx,dy=0):
    o=Image.new('RGBA',im.size,(0,0,0,0)); o.alpha_composite(im,(dx,dy)) if dx>=0 and dy>=0 else None; return o
def base(soldier=False):
    st=B.make(steel_only=True,soldier=soldier)
    d=ImageDraw.Draw(st); Y=B.Y
    d.line([(59,Y(57)),(66,Y(56)),(73,Y(63))],fill=(40,40,50,255))       # feed cable, roof vent -> tower leg
    return st
def station_code():
    return shift(B.outline(B.make(station_only=True)),2)
def compose(station,soldier=False):
    o=base(soldier); o.alpha_composite(station); return o
if __name__=='__main__':
    s=station_code(); s.save('station_code_128.png'); print('station bbox',s.getbbox())
    c=compose(s); c.save('bt_t3_draft.png'); print(c.getbbox())
    bx=s.getbbox(); crop=s.crop((0,H-80,80,H)); crop.save('station_crop_80.png')
