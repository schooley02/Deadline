import numpy as np
from PIL import Image, ImageDraw
import base as B, strip as S, compare as C
from road import glow, ground_shadow
road=np.array(Image.open('final_village-road_320x18.png')); padim=Image.open('final_village-pad_356x46.png').convert('RGBA'); orig=B.img
B.img=lambda p: padim if p=='scene/village-pad.png' else orig(p)
GAP=19
def build(W,H,bw):
    st=Image.fromarray(road,'RGBA').resize((S.SW*2,S.SH*2),Image.NEAREST); li=C.pl_light; stop=S.STOP
    def ground(c,d,hz): B.tile(c,st,hz+S.TOP_FROM_FEET,0)
    def props(c,d,hz):
        gym=[s for s in d['s'] if s['kind']=='lurkers'][0]; right=max(s['artRight'] for s in d['s'] if s['row']=='front')
        sx=gym['artLeft']-GAP-stop.width; lx=right+GAP; y=hz-36
        ground_shadow(c,sx+10,y-2); B.paste(c,stop,sx,y-stop.height)
        ground_shadow(c,lx+li.width-5,y-2,8); B.paste(c,li,lx,y-li.height); glow(c,lx+5,y-li.height+12,9,(214,72,52),110)
        print(W,'stop right',sx+stop.width,'gym',gym['artLeft'],'| lab right',right,'light left',lx)
    c,d=B.scene(W,H,bw,ground,props); return c.convert('RGB')
c=build(1366,480,368); c.save('final2_1366.png'); d2=build(1920,640,368); d2.save('final2_1920.png')
z=c.crop((440,280,1300,420)).resize((1720,280),Image.NEAREST)
f=c.crop((0,200,1366,480)); s=Image.new('RGB',(1720,280+6+int(280*1720/1366)),(40,40,40)); s.paste(z,(0,0)); s.paste(f.resize((1720,int(280*1720/1366)),Image.NEAREST),(0,286)); s.save('/mnt/user-data/outputs/road-C_traffic-light-moved.png')
