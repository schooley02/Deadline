"""75% v7: thin fanned light beams out of every broken pane, pointing along the wall's outward normal.
Side wall (faces the viewer) -> beams go left and slightly down; front wall (faces right) -> right and slightly down.
Over the wall the beam is blended in (lighter, warm); past the building's edge it is see-through (alpha)."""
import math
from PIL import Image
im = Image.open("base_075_v6.png").convert("RGBA"); px = im.load(); W, H = im.size
YAW, ELEV = math.radians(35), math.radians(8)
def screen_dir(nx, nz):                     # outward wall normal (x right/front, z back) -> unit screen vector
    u = nx * math.cos(YAW) + nz * math.sin(YAW); v = -nx * math.sin(YAW) + nz * math.cos(YAW)
    dx, dy = u, -v * math.sin(ELEV)          # screen y grows downward
    L = math.hypot(dx, dy); return dx / L, dy / L
SIDE = screen_dir(0, -1)     # side wall faces -z (toward the camera)
FRONT = screen_dir(1, 0)     # front wall faces +x (toward the lanes)
print("side dir", SIDE, "front dir", FRONT)
holes = [((8, 137), SIDE), ((6, 114), SIDE), ((63, 147), SIDE), ((54, 135), SIDE), ((107, 131), FRONT), ((151, 125), FRONT)]
BEAM = (255, 214, 150)
def put(x, y, a):
    if not (0 <= x < W and 0 <= y < H) or a <= 0.01: return
    p = px[x, y]
    if p[3] == 255:          # on the wall: warm lighten, opaque
        k = min(0.85, a * 0.9)
        px[x, y] = (min(255, int(p[0] + (BEAM[0] - p[0]) * k)), min(255, int(p[1] + (BEAM[1] - p[1]) * k)),
                    min(255, int(p[2] + (BEAM[2] - p[2]) * k * .6)), 255)
    else:                    # past the edge of the building: see-through light
        na = min(255, p[3] + int(a * 170))
        px[x, y] = BEAM + (na,)
for (cx, cy), (dx, dy) in holes:
    base_ang = math.atan2(dy, dx)
    for spread, length, strength in ((-0.30, 11, .75), (0.0, 16, 1.0), (0.28, 12, .75)):
        ang = base_ang + spread
        for s in range(3, length):
            t = s / length
            a = strength * (1 - t) ** 1.3
            x = cx + math.cos(ang) * s; y = cy + math.sin(ang) * s
            put(round(x), round(y), a)
            put(round(x - math.sin(ang)), round(y + math.cos(ang)), a * 0.35)   # soft second pixel
im.save("base_075_v7.png")
bg = Image.new("RGBA", im.size, (24, 26, 40, 255)); bg.alpha_composite(im)
bg.resize((W * 4, H * 4), Image.NEAREST).save("/tmp/v7z.png")
bg.crop((0, 100, 176, 168)).resize((176 * 5, 68 * 5), Image.NEAREST).save("/tmp/beams.png")
