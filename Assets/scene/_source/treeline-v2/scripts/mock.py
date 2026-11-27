import sys
from PIL import Image, ImageDraw
import scene as S
def label(d,x,y,t):
    d.rectangle([x,y,x+8+6.2*len(t),y+16],fill=(0,0,0)); d.text((x+4,y+2),t,fill=(255,255,255))
def board(names, out, W=1366,H=480,bw=368,crop=(0,120,1366,420)):
    rows=[]
    for n,t in names:
        tl=None if n is None else Image.open(n).convert('RGBA')
        c=S.scene(W,H,bw,tl).convert('RGB').crop(crop); rows.append((c,t))
    h=crop[3]-crop[1]; w=crop[2]-crop[0]
    s=Image.new('RGB',(w,(h+6)*len(rows)-6),(40,40,40)); d=ImageDraw.Draw(s)
    for i,(c,t) in enumerate(rows): s.paste(c,(0,i*(h+6))); label(d,6,i*(h+6)+6,t)
    s.save(out)
if __name__=='__main__':
    tag=sys.argv[1] if len(sys.argv)>1 else 'r1'
    names=[(None,'Current'),('out/treeline_A.png','A: mixed woods'),('out/treeline_B.png','B: ragged pines'),('out/treeline_C.png','C: late autumn, mostly bare')]
    board(names[:2]+names[2:3],f'out/{tag}_laptop_cur_A_B.png')
    board(names[3:],f'out/{tag}_laptop_C.png')
    board(names,f'out/{tag}_phone.png',800,360,188,(0,60,800,300))
