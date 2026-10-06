"""Cắt một sprite sheet nền magenta (#FF00FF) thành các sprite PNG nền trong suốt.

Lưới sprite (quái / phép):
  python3 tools/slice_sheet.py sheet.png --grid 4x4 --ids troll,ogre,-,griffin,... --out public/sprites
  (dấu - để bỏ qua ô hỏng; ô thừa cũng bị bỏ qua)

Dải hiệu ứng 8 khung (lưới 4x2) thành 1 ảnh ngang 8 x 128px cho flipbook three.js:
  python3 tools/slice_sheet.py fire.png --anim fire --out public/fx

Cần: pip install pillow numpy scipy
"""
import argparse, os
import numpy as np
from PIL import Image
from scipy import ndimage

def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)

def is_mag(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 150) & (b > 140) & (g < 120) & (np.abs(r - b) < 110)

def key(cell, line_band=0.1):
    """Trả về ảnh RGBA đã xoá nền magenta và các đường kẻ lưới ở mép ô."""
    h, w, _ = cell.shape
    mag = is_mag(cell)
    bg = np.median(cell[mag], axis=0) if mag.sum() > 50 else np.array([255, 0, 255])
    dist = np.sqrt(((cell - bg) ** 2).sum(-1))
    near = dist < 95
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bgmask = np.isin(lab, edge[edge > 0]) | (dist < 50) | mag
    # xoá đường kẻ lưới: cột/hàng gần mép mà gần như toàn bộ không phải nền
    solid = ~bgmask
    bx, by = max(2, int(w * line_band)), max(2, int(h * line_band))
    for x in list(range(bx)) + list(range(w - bx, w)):
        if solid[:, x].mean() > .6: bgmask[:, x] = True
    for y in list(range(by)) + list(range(h - by, h)):
        if solid[y, :].mean() > .6: bgmask[y, :] = True
    # viền ám hồng sát nền: bỏ luôn
    grow = ndimage.binary_dilation(bgmask, iterations=1)
    fringe = grow & ~bgmask & (dist < 150)
    bgmask |= fringe
    # bỏ các đốm nhỏ lẻ tẻ còn sót
    lab2, n = ndimage.label(~bgmask)
    if n:
        sizes = ndimage.sum(np.ones_like(lab2), lab2, range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s < 25: bgmask[lab2 == i] = True
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = np.clip(cell, 0, 255)
    rgba[..., 3] = np.where(bgmask, 0, 255)
    # khử ám hồng ở pixel bán sát nền
    edgepx = ndimage.binary_dilation(bgmask, iterations=2) & ~bgmask
    c = rgba[..., :3].astype(np.int16)
    tint = edgepx & (c[..., 0] > c[..., 1] + 50) & (c[..., 2] > c[..., 1] + 50)
    m = np.minimum(c[..., 0], c[..., 2])
    c[..., 0] = np.where(tint, (c[..., 0] + c[..., 1]) // 2, c[..., 0])
    c[..., 2] = np.where(tint, (c[..., 2] + c[..., 1]) // 2, c[..., 2])
    rgba[..., :3] = np.clip(c, 0, 255)
    return Image.fromarray(rgba, 'RGBA')

def grid(a, cols, rows, inset=.012):
    H, W, _ = a.shape
    out = []
    for r in range(rows):
        for c in range(cols):
            x0, x1 = int(W * c / cols), int(W * (c + 1) / cols)
            y0, y1 = int(H * r / rows), int(H * (r + 1) / rows)
            ix, iy = int((x1 - x0) * inset), int((y1 - y0) * inset)
            out.append(a[y0 + iy:y1 - iy, x0 + ix:x1 - ix])
    return out

def trim(im, pad=4):
    bb = im.getbbox()
    if not bb: return None
    im = im.crop(bb)
    w, h = im.size
    can = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    can.paste(im, (pad, pad))
    return can

def fit(im, maxd):
    w, h = im.size
    s = maxd / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def main_only(im):
    """Chỉ giữ khối hình chính, bỏ mảnh lấn từ ô bên cạnh."""
    arr = np.asarray(im).copy(); al = arr[..., 3] > 0
    lab, n = ndimage.label(al, structure=np.ones((3, 3)))
    if n > 1:
        sz = ndimage.sum(al, lab, range(1, n + 1)); keep = [i + 1 for i, v in enumerate(sz) if v >= .08 * sz.max()]
        arr[..., 3] = np.where(np.isin(lab, keep), arr[..., 3], 0)
    return Image.fromarray(arr, 'RGBA')

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('image')
    ap.add_argument('--grid', default='4x4', help='CỘTxHÀNG, ví dụ 4x4')
    ap.add_argument('--ids', default='', help='danh sách id theo thứ tự đọc, cách nhau dấu phẩy')
    ap.add_argument('--anim', help='tên dải hiệu ứng (bật chế độ 8 khung 4x2)')
    ap.add_argument('--size', type=int, default=192, help='cạnh dài tối đa của sprite')
    ap.add_argument('--out', default='public/sprites')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    img = load(a.image)
    if a.anim:
        FS = 128
        cells = grid(img[14:-14, 12:-12], 4, 2, inset=.03)
        strip = Image.new('RGBA', (FS * 8, FS), (0, 0, 0, 0))
        for i, cell in enumerate(cells):
            im = key(cell, line_band=.06); w, h = im.size; s = min(w, h)
            im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((FS, FS), Image.LANCZOS)
            strip.paste(im, (i * FS, 0))
        strip.save(os.path.join(a.out, a.anim + '.png'), optimize=True)
        print('Đã lưu', os.path.join(a.out, a.anim + '.png'))
    else:
        cols, rows = map(int, a.grid.lower().split('x'))
        ids = [x.strip() for x in a.ids.split(',')] if a.ids else []
        for i, cell in enumerate(grid(img, cols, rows)):
            if i >= len(ids) or ids[i] in ('', '-'): continue
            im = trim(main_only(key(cell)))
            if im is None: print('Ô trống:', ids[i]); continue
            fit(im, a.size).save(os.path.join(a.out, ids[i] + '.png'), optimize=True)
            print('Đã lưu', ids[i])
