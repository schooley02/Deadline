from PIL import Image
im=Image.open('out/B_stone_42_0.png').convert('RGBA')
rows=[]
for y in range(208):
    if y<40 and y%4==3: continue            # roof 40 -> 30 rows
    if 52<=y<62: continue                    # belfry 36 -> 26 rows (middle of the louvres)
    rows.append(y)
    if y==141: rows+=list(range(121,141))+[141]  # shaft +20 rows: a third stair window
rows=rows[:208] if len(rows)>=208 else rows
print(len(rows))
out=Image.new('RGBA',(112,len(rows)),(0,0,0,0))
for i,y in enumerate(rows): out.paste(im.crop((0,y,112,y+1)),(0,i))
out.save('c8_raised_code.png')
out.resize((336,len(rows)*3),Image.NEAREST).save('/tmp/c8_raised.png')
