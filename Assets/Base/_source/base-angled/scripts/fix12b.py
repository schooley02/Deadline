"""v12b: (1) cross smaller, centred on the door middle / roof peak line; (2) bell yoke legs removed (see-through);
(3) white re-tone also on the wall around the statue (statue itself is warm grey stone and is skipped by colour)."""
import re, subprocess
s = open("clean12.py").read()
s = s.replace("cx, top, bot, arm_y = 127, 67, 99, 75", "cx, top, bot, arm_y = 129, 70, 93, 75")
s = s.replace("UW, AH, AL, AR = 4, 4, 7, 7", "UW, AH, AL, AR = 3, 3, 5, 5")
s = s.replace("for y in range(top, bot + 1):                  # upright: x cx-2 .. cx+1\n    for i, x in enumerate(range(cx - 2, cx + 2)):\n        cross[(x, y)] = [L1, M, D2, D1][i]",
              "for y in range(top, bot + 1):                  # upright: x cx-1 .. cx+1 (3 px, centred on cx)\n    for i, x in enumerate(range(cx - 1, cx + 2)):\n        cross[(x, y)] = [L1, M, D2][i]")
s = s.replace("for x in range(cx - 2 - AL, cx + 2 + AR):      # arm: AH rows, sloping with the wall\n    off = round(-SL * (x - cx))\n    for j in range(AH):\n        cross[(x, arm_y + off + j)] = [L1, M, M, D2][j]",
              "for x in range(cx - 1 - AL, cx + 2 + AR):      # arm: AH rows, sloping with the wall\n    off = round(-SL * (x - cx))\n    for j in range(AH):\n        cross[(x, arm_y + off + j)] = [L1, M, D2][j]")
s = s.replace('im.save("base_100_v12.png")', '''# bell: remove the iron yoke legs either side, keep the bell, its crown and the posts/rail
from PIL import Image as _I
bronze = [(x, y) for y in range(24, 44) for x in range(92, 126) if px[x, y][3] and px[x, y][0] > px[x, y][2] + 6 and sum(px[x, y][:3]) < 450]
core = [(x, y) for (x, y) in bronze if 26 <= y <= 41]
bx0 = min(x for x, _ in core); bx1 = max(x for x, _ in core); by0 = min(y for _, y in core); by1 = max(y for _, y in core)
bcx = (bx0 + bx1) // 2
def near_white(x, y):
    return any(px[x + dx, y + dy][3] and sum(px[x + dx, y + dy][:3]) > 450 for dx in (-1, 0, 1) for dy in (-1, 0, 1))
for y in range(26, 42):
    for x in range(94, 125):
        p = px[x, y]
        if not p[3] or sum(p[:3]) > 450: continue
        in_bell = bx0 - 1 <= x <= bx1 + 1 and by0 - 1 <= y <= by1 + 1
        crown = abs(x - bcx) <= 1 and y < by0
        if not in_bell and not crown and not near_white(x, y):
            px[x, y] = (0, 0, 0, 0)
print("bell box", bx0, by0, bx1, by1)
im.save("base_100_v12.png")''')
open("clean12b.py", "w").write(s)
