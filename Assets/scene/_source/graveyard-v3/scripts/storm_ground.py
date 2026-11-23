"""Storm graveyard ground (2026-11-23): the dry graveyard ground (graveyard_ground_84x40.png) recoloured with the SAME dry -> storm pairs the lane
used (read off lane-2track.png vs storm-lane-2track.png, every grass shade maps to exactly one storm shade: darker and greyer). No puddles: the
lane's puddles stand only on road and yard dirt, never on grass (Jeremy, 2026-11-23: recolour only). Fences are not changed in a storm.
usage: python3 -I storm_ground.py <dry_ground.png> <out.png>
"""
import sys
from PIL import Image

PAIRS = {
    (12, 26, 24): (11, 24, 23),   # D0  edge / clump shadow
    (21, 38, 34): (18, 35, 33),   # D1  dark patches
    (30, 50, 42): (26, 46, 41),   # M   mid grass
    (41, 61, 53): (36, 56, 52),   # L   light patches / blades
    (51, 73, 62): (45, 67, 60),   # T   blade tips
}
im = Image.open(sys.argv[1]).convert('RGBA')
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        if (r, g, b) not in PAIRS:
            sys.exit(f'unmapped colour {(r, g, b)} at {(x, y)}')
        px[x, y] = PAIRS[(r, g, b)] + (a,)
im.save(sys.argv[2])
print('saved', sys.argv[2], im.size)
