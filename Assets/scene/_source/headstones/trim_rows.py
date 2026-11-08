from PIL import Image
def drop_rows(im, rows):
    """Delete the given rows and re-bottom-align (the PixelLab 'cut the shaft' trick, no resizing)."""
    keep=[y for y in range(im.height) if y not in set(rows)]
    out=Image.new('RGBA',im.size); off=im.height-len(keep)
    for i,y in enumerate(keep):
        for x in range(im.width): out.putpixel((x,i+off),im.getpixel((x,y)))
    return out
