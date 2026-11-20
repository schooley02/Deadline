import sys, json, concurrent.futures as cf
from PIL import Image
import pl

U = "/mnt/user-data/uploads/Deadline/Assets/"
guide = Image.open("guide_160x200.png").convert("RGBA")
church = Image.open(U + "Base/base_100.png").convert("RGBA")
police = Image.open(U + "Village/defense_t4.png").convert("RGBA")


def ref(im, note):
    return {"image": pl.img_obj(im), "size": {"width": im.width, "height": im.height}, "usage_description": note}


BASE = ("Pixel art, side-on three-quarter view of a small-town wooden country church converted into a fortified "
        "survivor base during a zombie apocalypse, night, moonlit. The front of the church with a tall pointed-arch "
        "double door faces RIGHT and is foreshortened; the long side wall runs back to the LEFT. A square bell tower "
        "rises over the door, its belfry turned into a lookout with a sandbag parapet and a small rust red flag with a "
        "white star. Stone steps lead down from the door to the right. Weathered grey-purple clapboard, dark slate roof, "
        "tall side windows boarded up with planks and gun slits, sandbag walls along the base, a corrugated tin lean-to "
        "with crates and water barrels against the left side wall, one warm lantern by the door. Muted, weathered, gritty, "
        "adult, not cartoonish. Transparent background, ground at the bottom.")
VARIANTS = {
    "A": "",
    "B": " Heavier fortification: extra planks nailed across the door frame edges, barbed wire coiled along the sandbags.",
    "C": " The bell tower keeps a short broken steeple stump; a rope ladder hangs from the lookout.",
    "D": " Lived-in: a faint warm glow inside the belfry lookout, a tarp patch on the roof, stacked firewood under the lean-to.",
}


def run(k, seed):
    body = {
        "description": BASE + VARIANTS[k],
        "image_size": {"width": 160, "height": 200},
        "seed": seed,
        "no_background": True,
        "reference_images": [
            ref(guide, "Layout guide: copy this exact composition, building angle, proportions and placement of the door, tower, steps, windows, sandbags and lean-to. Repaint it as detailed pixel art."),
            ref(police, "Example of a fortified survivor building in this game: copy how defenses, boards, sandbags and lighting are drawn, not its shape."),
        ],
        "style_image": ref(church, None),
        "style_options": {"color_palette": True, "outline": True, "detail": True, "shading": True},
    }
    del body["style_image"]["usage_description"]
    ims = pl.wait(pl.req("POST", "/generate-image-v2", body))
    for i, im in enumerate(ims):
        im.save(f"gen_{k}_{seed}_{i}.png")
    return k, seed, len(ims)


if __name__ == "__main__":
    b0 = pl.balance()
    jobs = [(k, s) for k in sys.argv[1] for s in (11, 22)]
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(lambda a: run(*a), jobs):
            print(r, flush=True)
    print("generations used", b0 - pl.balance())
