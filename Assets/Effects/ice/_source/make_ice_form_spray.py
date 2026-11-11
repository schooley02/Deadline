src=open('form2.py').read().split("N=8; seq")[0]
exec(src)
import random
random.seed(7)
HI=(214,243,255,255); WH=(255,255,255,255)
# frost spray: specks thrown up-right from the impact (left of base), fading out by frame 6
parts=[(random.uniform(14,60),random.uniform(112,118),random.uniform(1.5,4.5),random.uniform(-6,-2.5)) for _ in range(14)]
N=8; seq=[(i+1)/N for i in range(N)]
def spray(can,i):
    cp=can.load()
    if i>5: return
    for (x0,y0,vx,vy) in parts:
        t=i+1; x=int(x0+vx*t*1.6); y=int(y0+vy*t*1.6+0.6*t*t)
        if 0<=x<127 and 0<=y<127:
            c=WH if i<3 else HI
            cp[x,y]=c
            if i<2: cp[x+1,y]=HI
def full(i,t):
    f=frame_img(t); spray(f,i); return f
cv_frames=[]
for i,t in enumerate(seq+[1]*6):
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr); cv.alpha_composite(full(i,t),(s//2-64,fy-118))
    cv=cv.crop((10,10,s-10,s-10)).resize(((s-20)*3,(s-20)*3),Image.NEAREST)
    cv_frames.append(cv.convert('P',palette=Image.ADAPTIVE))
cv_frames[0].save('form_preview_v2.gif',save_all=True,append_images=cv_frames[1:],duration=[60]*N+[200]*6,loop=0)
sheet=Image.new('RGBA',(128*N,128),(0,0,0,0)); st=Image.new('RGBA',(128*N,128),BG)
for i,t in enumerate(seq): f=full(i,t); sheet.alpha_composite(f,(i*128,0)); st.alpha_composite(f,(i*128,0))
sheet.save('ice_form_sheet_v2.png'); st.resize((st.width*2,st.height*2),Image.NEAREST).save('form_strip_v2.png')
