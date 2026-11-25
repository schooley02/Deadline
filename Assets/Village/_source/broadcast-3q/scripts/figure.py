from PIL import Image
def extract(path='out/SOL_7101_0.png',box=(77,45,89,70)):
    b=Image.open('t4_inpaint_base.png').convert('RGBA'); s=Image.open(path).convert('RGBA')
    fig=Image.new('RGBA',b.size,(0,0,0,0)); B=b.load(); S=s.load(); F=fig.load()
    for y in range(box[1],box[3]+1):
        for x in range(box[0],box[2]+1):
            r,g,bl,a=S[x,y]
            if a<128 or S[x,y]==B[x,y]: continue
            if bl-r>=8 and r+g+bl>170: continue                    # steel greys the inpaint redrew
            F[x,y]=(r,g,bl,255)
    # drop specks not connected to the main body
    seen=set(); best=[]
    for y in range(box[1],box[3]+1):
        for x in range(box[0],box[2]+1):
            if F[x,y][3] and (x,y) not in seen:
                st=[(x,y)]; comp=[]; seen.add((x,y))
                while st:
                    cx,cy=st.pop(); comp.append((cx,cy))
                    for dx in (-1,0,1):
                        for dy in (-1,0,1):
                            n=(cx+dx,cy+dy)
                            if n not in seen and box[0]<=n[0]<=box[2] and box[1]<=n[1]<=box[3] and F[n[0],n[1]][3]: seen.add(n); st.append(n)
                if len(comp)>len(best): best=comp
    keep=set(best)
    for y in range(fig.height):
        for x in range(fig.width):
            if F[x,y][3] and (x,y) not in keep: F[x,y]=(0,0,0,0)
    return fig
def cap(fig):
    """Helmet -> soft field cap (Jeremy: the soldier wears a cap, not a helmet): flat low crown + a short peak to the right."""
    F=fig.load(); T=(0,0,0,0)
    for x in range(77,90): F[x,45]=T                                  # the dome's top row goes
    F[85,47]=T; F[85,46]=T
    crown={80:(0x2e,0x2d,0x20),81:(0x4d,0x50,0x36),82:(0x64,0x67,0x49),83:(0x5a,0x5e,0x44),84:(0x3c,0x3e,0x2e)}
    for x,c in crown.items(): F[x,46]=c+(255,); F[x,47]=tuple(int(v*0.82) for v in c)+(255,)
    for x in range(80,87): F[x,48]=((0x1c,0x1b,0x14) if x<85 else (0x2c,0x2c,0x20))+(255,)   # band + peak
    return fig
if __name__=='__main__':
    f=cap(extract()); F=f.load()
    for y in range(f.height):
        for x in range(f.width):
            r,gg,b,a=F[x,y]
            if a and r+gg+b>60: F[x,y]=(min(255,int(r*1.22)),min(255,int(gg*1.22)),min(255,int(b*1.22)),255)
    f.save('fig_soldier.png'); print(f.getbbox())
