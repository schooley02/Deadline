exec(open('boost.py').read().split("def lum")[0])
import math
ice=Image.open('ice_hold_intact_v2.png')
z=zs[0]; name,fr,s,fy=z
# impact point: low-left of the base (blast came from the church side)
IX,IY=14,120
px=ice.load()
dist={}
for y in range(128):
    for x in range(128):
        if px[x,y][3]:
            # grow outward from the impact, faster along the up-right diagonal
            dx,dy=x-IX,IY-y
            dist[(x,y)]=math.hypot(dx*0.8,dy*1.25)
D=max(dist.values())
N=7
frames=[]
def frame_img(t):
    can=Image.new('RGBA',(128,128),(0,0,0,0)); cp=can.load()
    edge=t*D
    for (x,y),d in dist.items():
        if d<=edge: cp[x,y]=px[x,y]
        elif d<=edge+5 and t<1: cp[x,y]=(214,243,255,255)  # bright growing front
    return can
seq=[i/(N-1) for i in range(N)]
cv_frames=[]
for t in seq+[1,1,1,1,1,1]:
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr); cv.alpha_composite(frame_img(t),(s//2-64,fy-118))
    cv=cv.crop((10,10,s-10,s-10)).resize(((s-20)*3,(s-20)*3),Image.NEAREST)
    cv_frames.append(cv.convert('P',palette=Image.ADAPTIVE))
cv_frames[0].save('form_preview.gif',save_all=True,append_images=cv_frames[1:],duration=[70]*N+[200]*6,loop=0)
# strip of the 7 frames for the record
st=Image.new('RGBA',(128*N,128),BG)
for i,t in enumerate(seq): st.alpha_composite(frame_img(t),(i*128,0))
st.resize((st.width*2,st.height*2),Image.NEAREST).save('form_strip.png')
