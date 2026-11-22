"""In-game MOCK of the angled church base (2026-11-21). Nothing in the game is changed.
Runs a COPY of the game in a headless browser, swaps a base strip in at 2x (368x400) and puts a smoke strip behind #base,
then records 32 frames (frame by frame, so the GIF is exact) with gifkit.
Needs: a copy of the game folder (index.html, script.js, js/, css/, Assets/) served at http://127.0.0.1:8000
(python3 -m http.server 8000 inside the copy), with Assets/Base/mock/idle.png, attack.png (16 x 184x200 strips) and
smoke.png (32 x 280x312 strip, church frame at 0,112) added to the copy; Playwright + Chrome; gifkit.py on sys.path.
Usage: python3 ingame_mock.py <viewport_w> <viewport_h> <out_prefix> <idle|attack> [clip_width] [bottom_px=2]
Limits: laptop layout only. The phone "glance strip" crops the base its own way and is NOT handled. The barricade is just
pushed 208 px right; real positions are the wiring task's job.
Finding 2026-11-21: the church frame fills the whole canvas height, so smoke above the frame is off the top of the screen."""
import sys, json, io
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
import gifkit
w, h, out, strip = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
clipw = int(sys.argv[5]) if len(sys.argv) > 5 else w
BOTTOM = int(sys.argv[6]) if len(sys.argv) > 6 else 8
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.goto("http://127.0.0.1:8000/index.html", wait_until="load"); pg.wait_for_timeout(1500)
    try: pg.get_by_text("Male", exact=True).click(timeout=3000)
    except Exception as e: print("no avatar prompt", str(e)[:80])
    pg.wait_for_timeout(800)
    try: pg.get_by_text("Good", exact=True).click(timeout=3000)
    except Exception as e: print("no mood prompt", str(e)[:80])
    try: pg.get_by_text("Done", exact=True).click(timeout=3000)
    except Exception as e: print("no Done", str(e)[:80])
    pg.wait_for_timeout(800)
    info = pg.evaluate("""(a) => {
      const base=document.getElementById('base'), c=document.getElementById('gameCanvas');
      const st=document.createElement('style');
      st.textContent=`#base{width:368px!important;--base-fw:368px;--base-fh:400px;background-image:url('Assets/Base/mock/${a.strip}.png')!important;background-size:5888px 400px!important;animation:none!important;background-repeat:no-repeat!important}
        #mockSmoke{position:absolute;left:calc(0px - var(--base-bleed,0px));bottom:${a.bottom}px;width:560px;height:624px;background:url('Assets/Base/mock/smoke.png') 0 0 / 17920px 624px no-repeat;image-rendering:pixelated;pointer-events:none}
        *{animation-play-state:paused!important}`;
      document.head.appendChild(st);
      base.removeAttribute('data-base-anim'); base.style.setProperty('background-image', `url('Assets/Base/mock/${a.strip}.png')`, 'important'); const bar=document.getElementById('barricade'); if(bar) bar.style.translate='208px 0';
      const s=document.createElement('div'); s.id='mockSmoke'; c.insertBefore(s, base);
      window.__mockFrame=(f)=>{ base.style.setProperty('background-position', `${-(f%16)*368}px bottom ${a.bottom}px`, 'important'); s.style.backgroundPosition=`${-(f%32)*560}px 0`; };
      window.__mockFrame(0);
      const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height, bar: !!document.getElementById('barricade'), open:[...document.querySelectorAll('dialog[open]')].map(e=>e.id)};
    }""", {"strip": strip, "bottom": BOTTOM})
    print(json.dumps(info))
    pg.wait_for_timeout(1200)
    frames = []
    clip = {"x": 0, "y": max(0, info["y"]), "width": min(clipw, w), "height": min(info["h"], h)}
    for f in range(32):
        pg.evaluate("f => window.__mockFrame(f)", f); pg.wait_for_timeout(60)
        frames.append(Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert("RGB"))
    frames[4].save(out + "_f5.png")
    gifkit.save_gif(frames, out + ".gif", 8)
    pg.screenshot(path=out + "_page.png")
    b.close()
