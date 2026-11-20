"""Short square belfry tower on the ridge, set back from the front gable. Drawn from the same 3D projection
as guide4 (matches the final art's ridge), then refined by a PixelLab inpaint limited to the tower silhouette."""
import math, sys
from PIL import Image, ImageDraw
YAW, ELEV, SC, X0, Y0 = math.radians(35), math.radians(8), 9.6, 96, 193
EAVE, RISE, WID = 9.6, 4.4, 12.0
def P(x, y, z):
    u = x * math.cos(YAW) + z * math.sin(YAW); v = -x * math.sin(YAW) + z * math.cos(YAW)
    return (X0 + SC * u, Y0 - SC * (y * math.cos(ELEV) + v * math.sin(ELEV)))
def roof_h(z): return EAVE + RISE * (1 - abs(z - WID / 2) / (WID / 2))

XF, XB = -3.0, -7.5          # front / back face planes (feet behind the gable)
Z0, Z1 = 3.75, 8.25          # tower width across the ridge
TOP, CORN, APEX = 15.2, 15.6, 17.6

base = Image.open("base_100_v8.png").convert("RGBA")
src = base.load()
# sample the church's own colours: side wall (shaded) and front wall (lit), roof, trim
SIDE = (122, 130, 150, 255); SIDE2 = (100, 108, 128, 255)
FRONT = (178, 184, 198, 255); FRONT2 = (150, 156, 172, 255)
ROOF = (52, 58, 72, 255); ROOF2 = (40, 44, 56, 255); ROOFL = (78, 86, 104, 255)
TRIM = (206, 210, 220, 255); OUT = (26, 26, 36, 255); LOUV = (30, 30, 40, 255); SLAT = (70, 74, 88, 255)

im = base.copy(); d = ImageDraw.Draw(im)
sil = Image.new("L", im.size, 0); ds = ImageDraw.Draw(sil)
def face(pts, fill):
    q = [P(*p) for p in pts]; d.polygon(q, fill=fill, outline=OUT); ds.polygon(q, fill=255, outline=255)

# side face (z = Z0 plane, faces the viewer), from the roof line up
face([(XF, roof_h(Z0), Z0), (XF, TOP, Z0), (XB, TOP, Z0), (XB, roof_h(Z0), Z0)], SIDE)
# front face (x = XF plane, faces right like the gable), bottom follows the roof slopes
face([(XF, roof_h(Z0), Z0), (XF, roof_h(Z0), Z1), (XF, TOP, Z1), (XF, TOP, Z0)], FRONT)
# clapboard lines
y = roof_h(Z0) + 0.5
while y < TOP - 0.3:
    d.line([P(XF, y, Z0), P(XB, y, Z0)], fill=SIDE2)
    d.line([P(XF, y, Z0), P(XF, y, Z1)], fill=FRONT2)
    y += 0.55
# louvered openings (one per visible face), pointed tops
def louver(plane, a0, a1, y0, y1):
    mid = (a0 + a1) / 2
    if plane == "side":
        pts = [(a1, y0, Z0), (a1, y1, Z0), (mid, y1 + .7, Z0), (a0, y1, Z0), (a0, y0, Z0)]
    else:
        pts = [(XF, y0, a0), (XF, y1, a0), (XF, y1 + .7, mid), (XF, y1, a1), (XF, y0, a1)]
    q = [P(*p) for p in pts]; d.polygon(q, fill=LOUV, outline=TRIM)
    for k in range(4):
        yy = y0 + .35 + k * (y1 - y0) / 4
        if plane == "side": d.line([P(a1 - .15, yy, Z0), P(a0 + .15, yy, Z0)], fill=SLAT)
        else: d.line([P(XF, yy, a0 + .15), P(XF, yy, a1 - .15)], fill=SLAT)
louver("side", XB + 1.3, XF - 1.3, 13.4, 14.5)
louver("front", Z0 + 1.1, Z1 - 1.1, 13.4, 14.5)
# cornice (trim band)
face([(XF + .25, TOP, Z0 - .25), (XF + .25, CORN, Z0 - .25), (XB - .25, CORN, Z0 - .25), (XB - .25, TOP, Z0 - .25)], TRIM)
face([(XF + .25, TOP, Z0 - .25), (XF + .25, CORN, Z0 - .25), (XF + .25, CORN, Z1 + .25), (XF + .25, TOP, Z1 + .25)], TRIM)
# pyramid roof: side triangle + front triangle
cx, cz = (XF + XB) / 2, (Z0 + Z1) / 2
face([(XF + .35, CORN, Z0 - .35), (cx, APEX, cz), (XB - .35, CORN, Z0 - .35)], ROOF)
face([(XF + .35, CORN, Z0 - .35), (cx, APEX, cz), (XF + .35, CORN, Z1 + .35)], ROOFL)
# finial
ax, ay = P(cx, APEX, cz); d.line([(ax, ay), (ax, ay - 4)], fill=OUT); im.putpixel((round(ax), round(ay - 5)), TRIM)
ds.line([(ax, ay), (ax, ay - 5)], fill=255)

im.save("tower_code.png"); sil.save("tower_sil.png")
print("tower bbox", sil.getbbox(), "apex", (round(ax), round(ay)))
