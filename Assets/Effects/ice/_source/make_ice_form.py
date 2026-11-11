exec(open('form.py').read().split("dist={}")[0])
B=120; xs=[x for x in range(128) if any(px[x,y][3] for y in range(128))]; X0,X1=min(xs),max(xs)
top={x:min(y for y in range(128) if px[x,y][3]) for x in xs}
def frame_img(t):
    can=Image.new('RGBA',(128,128),(0,0,0,0)); cp=can.load()
    for x in xs:
        delay=(x-X0)/(X1-X0)*0.45            # wave travels left -> right
        k=max(0,min(1,(t-delay)/0.55))        # this column's rise progress
        if k<=0: continue
        k=1-(1-k)**2                           # ease-out: shoots up, settles
        colh=B-top[x]+1; shown=int(round(colh*k)); off=colh-shown
        for y in range(top[x],B+1):
            if not px[x,y][3]: continue
            ny=y+off                            # column pushed up out of the ground
            if ny<=B: cp[x,ny]=px[x,y]
        if 0<k<1 and B-shown>=0: cp[x,max(top[x]+off,0)]=(214,243,255,255)
    return can
N=8; seq=[(i+1)/N for i in range(N)]
cv_frames=[]
for t in seq+[1]*6:
    cv=Image.new('RGBA',(s,s),BG); cv.alpha_composite(fr); cv.alpha_composite(frame_img(t),(s//2-64,fy-118))
    cv=cv.crop((10,10,s-10,s-10)).resize(((s-20)*3,(s-20)*3),Image.NEAREST)
    cv_frames.append(cv.convert('P',palette=Image.ADAPTIVE))
cv_frames[0].save('form_preview.gif',save_all=True,append_images=cv_frames[1:],duration=[60]*N+[200]*6,loop=0)
st=Image.new('RGBA',(128*N,128),BG); sheet=Image.new('RGBA',(128*N,128),(0,0,0,0))
for i,t in enumerate(seq): f=frame_img(t); st.alpha_composite(f,(i*128,0)); sheet.alpha_composite(f,(i*128,0))
st.resize((st.width*2,st.height*2),Image.NEAREST).save('form_strip.png'); sheet.save('ice_form_sheet.png')
