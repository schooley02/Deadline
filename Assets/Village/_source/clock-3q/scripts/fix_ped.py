from PIL import Image
v1=Image.open('jeremy_t3_v1.png').convert('RGBA'); im=Image.open('clock_t3_fixed_v2.png').convert('RGBA')
im.paste(v1.crop((47,146,87,170)),(47,146))            # the old pediment and door head back, exactly as Jeremy had them
px=im.load()
AX=66
# right half of the pediment = mirror of the left half (the left raking edge is the clean one)
for y in range(150,163):
    for d in range(1,14): px[AX+d,y]=px[AX-d,y]
# pilaster right of the pediment: carry its columns straight down
for y in range(156,163):
    for x in range(80,86): px[x,y]=px[x,155]
# base ledge right of the door: same profile as the piece left of the door
for x in range(79,86):
    for y in range(163,169): px[x,y]=px[50,y]
for y in range(163,169): px[86,y]=(0,0,0,0)
for y in range(164,168): px[86,y]=(12,10,15,255)
im.save('clock_t3_fixed_v3.png')
def ch(p):
    if p[3]<=20: return ' '
    s=sum(p[:3]); return '#' if s<110 else ('+' if s<260 else ('-' if s<400 else '.'))
print('    '+''.join(str(x%10) for x in range(44,90)))
for y in range(148,170): print(y,''.join(ch(px[x,y]) for x in range(44,90)))
box=(40,138,96,176); S=10
o=Image.new('RGBA',(56*2+6,38),(28,32,44,255)); o.alpha_composite(v1.crop(box),(0,0)); o.alpha_composite(im.crop(box),(62,0))
o.resize((o.width*S,o.height*S),Image.NEAREST).convert('RGB').save('/tmp/ped.png')
