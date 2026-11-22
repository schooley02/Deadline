"""In-game MOCK for a smoke layer whose frames are laid out in a GRID (2026-11-22). Nothing in the game is changed.
Runs a COPY of the game in a headless browser, swaps a 25% base strip in at 2x (368x400) and puts the smoke layer just
behind #base (in front of the village and the scenery), then records frame by frame with gifkit.
Needs: a copy of the game (index.html, script.js, js/, css/, the Assets the page asks for) served at
http://127.0.0.1:8000 (python3 -m http.server 8000 inside the copy), with Assets/Base/mock/idle.png and attack.png
(16 x 184x200 strips) and the smoke sheet as Assets/Base/mock/<smoke_name>.png; Playwright + Chrome; gifkit.py beside this file.
The smoke sheet: frames in a grid (cols across), each smoke_w x smoke_h art px; the frame's TOP-LEFT is the church
frame's top-left.
Usage: python3 ingame_mock3.py <vw> <vh> <out_prefix> <idle|attack> <smoke_name> <smoke_w> <smoke_h> <frames> <cols> [clip_w] [frames_to_record] [bottom_px=8]
  e.g. python3 ingame_mock3.py 1280 720 mock idle smoke 304 136 40 8 700 80
       SMOKE_UP=340 python3 ingame_mock3.py 3840 2160 mock idle smoke_tall 448 306 80 8 1000 80
env: SMOKE_Z      stacking of the layer (default 1 = just behind the church). FINDING 2026-11-22: with z-index auto the layer
                  sits UNDER the game's scenery and looks washed out; the wiring must put it directly behind #base.
     LAYER_SCALE  screen px per sheet px (default 2 = the church's pixel size)
     BASE_SHIFT   px; moves church + smoke left to imitate the small-screen crop of the church
     SMOKE_UP     px; the smoke sheet's top edge sits this far ABOVE the church frame's top (340 for the taller sheet,
                  base_025_smoke_layer_tall_final_80f.png: 448 x 306 frames, 80 frames, 8 columns)
Limits: laptop layout only; the phone "glance strip" is not handled; the barricade is just pushed 208 px right."""
import sys, json, io, os
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gifkit
w, h, out, strip, sname, sw, sh, sn, cols = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5], int(sys.argv[6]), int(sys.argv[7]), int(sys.argv[8]), int(sys.argv[9])
clipw = int(sys.argv[10]) if len(sys.argv) > 10 else w
rec = int(sys.argv[11]) if len(sys.argv) > 11 else max(16, sn)
BOTTOM = int(sys.argv[12]) if len(sys.argv) > 12 else 8
rows = -(-sn // cols)
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.goto("http://127.0.0.1:8000/index.html", wait_until="load"); pg.wait_for_timeout(1500)
    for t in ("Male", "Good", "Done"):
        try: pg.get_by_text(t, exact=True).click(timeout=2500)
        except Exception as e: pass
        pg.wait_for_timeout(500)
    info = pg.evaluate("""(a) => {
      const base=document.getElementById('base'), c=document.getElementById('gameCanvas');
      const st=document.createElement('style');
      st.textContent=`#base{width:368px!important;--base-fw:368px;--base-fh:400px;background-image:url('Assets/Base/mock/${a.strip}.png')!important;background-size:5888px 400px!important;animation:none!important;background-repeat:no-repeat!important}
        #mockSmoke{z-index:${a.z};position:absolute;left:calc(0px - var(--base-bleed,0px));bottom:${a.bottom + 400 - a.sh*a.ls + a.up}px;width:${a.sw*a.ls}px;height:${a.sh*a.ls}px;background:url('Assets/Base/mock/${a.sname}.png') 0 0 / ${a.sw*a.ls*a.cols}px ${a.sh*a.ls*a.rows}px no-repeat;image-rendering:pixelated;pointer-events:none}
        *{animation-play-state:paused!important}`;
      document.head.appendChild(st);
      base.removeAttribute('data-base-anim'); base.style.setProperty('background-image', `url('Assets/Base/mock/${a.strip}.png')`, 'important'); const bar=document.getElementById('barricade'); if(bar) bar.style.translate='208px 0';
      const s=document.createElement('div'); s.id='mockSmoke'; c.insertBefore(s, base); if(a.shift){ base.style.translate=`${a.shift}px 0`; s.style.translate=`${a.shift}px 0`; }
      window.__mockFrame=(f)=>{ base.style.setProperty('background-position', `${-(f%16)*368}px bottom ${a.bottom}px`, 'important'); const g=f%a.sn; s.style.backgroundPosition=`${-(g%a.cols)*a.sw*a.ls}px ${-Math.floor(g/a.cols)*a.sh*a.ls}px`; };
      window.__mockFrame(0);
      const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};
    }""", {"strip": strip, "bottom": BOTTOM, "sname": sname, "sw": sw, "sh": sh, "sn": sn, "cols": cols, "rows": rows, "ls": int(os.environ.get("LAYER_SCALE", "2")), "z": os.environ.get("SMOKE_Z", "1"), "shift": int(os.environ.get("BASE_SHIFT", "0")), "up": int(os.environ.get("SMOKE_UP", "0"))})
    print(json.dumps(info)); pg.wait_for_timeout(1200)
    clip = {"x": 0, "y": max(0, info["y"]), "width": min(clipw, w), "height": min(info["h"], h)}
    frames = []
    for f in range(rec):
        pg.evaluate("f => window.__mockFrame(f)", f); pg.wait_for_timeout(60)
        frames.append(Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert("RGB"))
    frames[0].save(out + "_f1.png")
    if rec > 1: gifkit.save_gif(frames, out + ".gif", 8)
    b.close()
