import concurrent.futures as cf
from PIL import Image
import pl

U = "/mnt/user-data/uploads/Deadline/Assets/"
guide = Image.open("guide2_160x200.png").convert("RGBA")
police = Image.open(U + "Village/defense_t4.png").convert("RGBA")
hosp = Image.open(U + "Village/habits_t4.png").convert("RGBA")

DESC = ("Detailed pixel art of a small-town American country church painted WHITE (weathered, dirty, some peeling paint), "
        "horizontal clapboard siding, at night under cool moonlight, converted into a fortified survivor base in a zombie "
        "apocalypse. Three-quarter view: the front gable wall with a tall pointed-arch red double door faces RIGHT and recedes "
        "at a strong angle; the long side wall runs back to the left. A square white bell tower on the front, with an open "
        "belfry just above the roof line showing a dark bronze bell behind a few sandbags, a short dark spire and a simple "
        "white cross on top. Small rust red flag with a white star on a pole lashed to the belfry. Stone steps lead down "
        "from the door to the right. Tall side windows boarded with planks and gun slits, sandbags along the base, corrugated "
        "tin lean-to with crates and water barrels against the left side. One small lantern by the door. Dark slate roof. "
        "Muted, weathered, gritty, realistic, adult tone, not cartoonish, not bright saturated colours. Lit windows and the "
        "door have no glow halo.")


def ref(im, note):
    r = {"image": pl.img_obj(im), "size": {"width": im.width, "height": im.height}}
    if note: r["usage_description"] = note
    return r


def gen(seed):
    body = {"description": DESC, "image_size": {"width": 160, "height": 200}, "seed": seed, "no_background": True,
            "reference_images": [
                ref(guide, "Layout guide: copy this exact building angle (front wall receding steeply to the right), outline, proportions and the placement of door, bell tower, bell, spire, cross, steps, windows, sandbags and lean-to. Repaint it as detailed pixel art."),
                ref(police, "Same game's newer building art: match its level of detail, outline weight, realistic weathered materials and how boards, sandbags and lights are drawn. Do not copy its shape."),
            ],
            "style_image": ref(hosp, None),
            "style_options": {"color_palette": False, "outline": True, "detail": True, "shading": True}}
    ims = pl.wait(pl.req("POST", "/generate-image-v2", body))
    for i, im in enumerate(ims): im.save(f"g2_gen_{seed}_{i}.png")
    return "gen", seed


def edit(seed):
    body = {"method": "edit_with_text", "edit_images": [{"image": pl.img_obj(guide), "width": 160, "height": 200}],
            "image_size": {"width": 160, "height": 200},
            "description": "Repaint this rough layout as finished detailed pixel art, keeping the exact shapes, angle and placement. " + DESC,
            "no_background": True, "seed": seed}
    ims = pl.wait(pl.req("POST", "/edit-images-v2", body))
    for i, im in enumerate(ims): im.save(f"g2_edit_{seed}_{i}.png")
    return "edit", seed


if __name__ == "__main__":
    b0 = pl.balance()
    tasks = [(gen, s) for s in (31, 42, 53, 64)] + [(edit, s) for s in (31, 42, 53)]
    with cf.ThreadPoolExecutor(8) as ex:
        futs = [ex.submit(f, s) for f, s in tasks]
        for fu in futs:
            try: print(fu.result(), flush=True)
            except Exception as e: print("ERR", e, flush=True)
    print("generations used", b0 - pl.balance())
