from PIL import Image, ImageDraw
OL=(19,16,44,255); D=(84,85,111,255); M=(112,115,139,255); L=(131,131,166,255); HI=(187,182,219,255)
W1=(78,54,44,255); W2=(118,84,60,255); DIRT=(57,46,77,255); DIRT2=(33,28,51,255); CARVE=(64,62,85,255)
CW,CH=32,32; FOOT=29  # last row of stone; mound rows 29-31
sheet=Image.new('RGBA',(CW*5,CH),(0,0,0,0))
def cell(i):
    im=Image.new('RGBA',(CW,CH),(0,0,0,0)); return im, ImageDraw.Draw(im)
def mound(g,w):
    x0=16-w//2; g.rectangle([x0,FOOT,x0+w-1,31],fill=DIRT); g.line([x0+1,31,x0+w-2,31],fill=DIRT2)
def slab(g,x0,y0,x1,y1,r,fills):
    g.rounded_rectangle([x0,y0,x1,y1],radius=r,fill=OL)
    g.rounded_rectangle([x0+1,y0+1,x1-1,y1-1],radius=max(r-1,0),fill=fills[1])
    g.line([x0+1,y0+r,x0+1,y1-1],fill=fills[2]); g.line([x1-1,y0+r,x1-1,y1-1],fill=fills[0])
    g.line([x0+r,y0+1,x1-r,y0+1],fill=fills[2])
out=[]
# 0 wooden cross ~11x16
im,g=cell(0); mound(g,13)
g.rectangle([14,13,18,FOOT],fill=OL); g.rectangle([15,14,17,FOOT],fill=W2); g.line([17,14,17,FOOT],fill=W1)
g.rectangle([11,17,21,20],fill=OL); g.rectangle([12,18,20,19],fill=W2); g.line([12,19,20,19],fill=W1)
out.append(im)
# 1 Bronze: rough fieldstone ~12x12, lumpy
im,g=cell(1); mound(g,15)
g.polygon([(11,FOOT),(10,24),(11,20),(14,18),(18,18),(21,20),(22,25),(21,FOOT)],fill=OL)
g.polygon([(12,FOOT-1),(11,24),(12,21),(14,19),(18,19),(20,21),(21,25),(20,FOOT-1)],fill=D)
g.line([13,21,17,19],fill=M); g.point([(19,24),(14,25)],fill=DIRT2)
out.append(im)
# 2 Silver: cut flat-top slab ~12x17
im,g=cell(2); mound(g,16)
slab(g,10,13,21,FOOT,1,(D,M,L)); g.line([12,FOOT-2,19,FOOT-2],fill=D)
out.append(im)
# 3 Gold: rounded headstone with carved cross ~14x21
im,g=cell(3); mound(g,18)
slab(g,9,9,22,FOOT,6,(M,L,HI)); g.rectangle([15,13,16,21],fill=CARVE); g.rectangle([13,15,18,16],fill=CARVE)
out.append(im)
# 4 Platinum: ornate, base plinth + arched stone + cross finial ~16x25
im,g=cell(4); mound(g,20)
g.rectangle([8,FOOT-3,23,FOOT],fill=OL); g.rectangle([9,FOOT-2,22,FOOT-1],fill=M)
slab(g,10,10,21,FOOT-3,5,(L,HI,HI)); g.rectangle([12,13,19,FOOT-6],outline=CARVE)
g.rectangle([15,4,16,10],fill=OL); g.rectangle([13,6,18,7],fill=OL)
g.point([(15,5),(16,5),(15,8),(16,8)],fill=HI); g.point([(14,6),(17,6)],fill=HI)
out.append(im)
for i,im in enumerate(out):
    sheet.alpha_composite(im,(i*CW,0)); im.save(f'guide_stage{i}_32.png')
sheet.save('headstone_guide_160x32.png')
wb=Image.new('RGBA',sheet.size,(255,255,255,255)); wb.alpha_composite(sheet); wb.convert('RGB').save('headstone_guide_160x32_whitebg.png')
prev=Image.new('RGBA',sheet.size,(28,55,72,255)); prev.alpha_composite(sheet); prev.resize((160*6,32*6),Image.NEAREST).save('guide_preview_6x.png')
