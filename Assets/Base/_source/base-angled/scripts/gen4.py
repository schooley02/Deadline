import concurrent.futures as cf
from PIL import Image
import pl
guide = Image.open("guide4_160x200.png" if False else "guide4_160x200.png").convert("RGBA")
ref = Image.open("cand_B_dim10.png").convert("RGBA")
DESC = ("Pixel art at night of a small white-painted wooden country church (weathered clapboard, toned down by moonlight), "
        "seen from almost eye level, from the side: the long side wall faces the viewer, the front gable faces right with a "
        "pointed-arch dark red double door raised on three light grey stone steps, a narrow lit stained glass window on each "
        "side of the door, a small bronze bell in an arched opening in the gable and a white cross on the peak. Tall pointed "
        "stained glass windows along the side wall, lit warmly from inside. Small rust red flag with a white star on a pole at "
        "the right front corner. A black iron lantern post right of the steps with a lit lantern; tan sandbags along the base "
        "and peeking out behind the top step. Dark slate shingle roof. Muted, weathered, realistic, not cartoonish.")
def r(im, note=None):
    o = {"image": pl.img_obj(im), "size": {"width": im.width, "height": im.height}}
    if note: o["usage_description"] = note
    return o
def ewr(seed):
    body = {"method": "edit_with_reference", "edit_images": [{"image": pl.img_obj(guide), "width": 176, "height": 200}],
            "image_size": {"width": 176, "height": 200}, "reference_image": {"image": pl.img_obj(ref), "width": 176, "height": 200},
            "no_background": True, "seed": seed}
    for i, o in enumerate(pl.wait(pl.req("POST", "/edit-images-v2", body))): o.save(f"g4_ref_{seed}_{i}.png")
def ewt(seed):
    body = {"method": "edit_with_text", "edit_images": [{"image": pl.img_obj(guide), "width": 176, "height": 200}],
            "image_size": {"width": 176, "height": 200}, "no_background": True, "seed": seed,
            "description": "Repaint this rough layout as finished detailed pixel art, keeping the exact shapes, camera angle and placement. " + DESC}
    for i, o in enumerate(pl.wait(pl.req("POST", "/edit-images-v2", body))): o.save(f"g4_txt_{seed}_{i}.png")
def gen(seed):
    body = {"description": DESC, "image_size": {"width": 176, "height": 200}, "seed": seed, "no_background": True,
            "reference_images": [r(guide, "Layout guide: copy this exact low, side-on camera angle (very little roof seen from above), the outline, proportions and placement of every part."),
                                 r(ref, "The approved look: copy its materials, colours, door, windows, bell, cross, flag, lantern, steps and sandbags, but NOT its high camera angle.")]}
    for i, o in enumerate(pl.wait(pl.req("POST", "/generate-image-v2", body))): o.save(f"g4_gen_{seed}_{i}.png")
b0 = pl.balance()
with cf.ThreadPoolExecutor(8) as ex:
    fs = [ex.submit(f, s) for f in (ewr, ewt, gen) for s in (101, 102)]
    for f in fs:
        try: f.result()
        except Exception as e: print("ERR", e)
print("used", b0 - pl.balance())
