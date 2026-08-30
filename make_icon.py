# make_icon.py - 生成应用图标 icon.png / icon.ico
import os
from PIL import Image, ImageDraw

os.makedirs("build", exist_ok=True)
SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 蓝色渐变圆角背景
bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d.bg = ImageDraw.Draw(bg)
for y in range(SIZE):
    t = y / SIZE
    r = int(47 + (31 - 47) * t)
    g = int(99 + (70 - 99) * t)
    b = int(255 + (200 - 255) * t)
    d.bg.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))
# 圆角遮罩
mask = Image.new("L", (SIZE, SIZE), 0)
dm = ImageDraw.Draw(mask)
dm.rounded_rectangle([0, 0, SIZE, SIZE], radius=112, fill=255)
img = Image.composite(bg, img, mask)

# 白色对话气泡
bub = (72, 150, 440, 360)
bub2 = (72 + 8, 150 + 8, 440 - 8, 360 - 8)
d.rounded_rectangle(bub, radius=70, fill=(255, 255, 255, 255))
# 气泡小尾巴
d.polygon([(150, 350), (170, 430), (230, 350)], fill=(255, 255, 255, 255))

# 学士帽（帽板 + 帽身 + 流苏）
cap_x = 96
cap_y = 178
# 帽板（菱形）
d.polygon([
    (cap_x, cap_y),
    (cap_x + 160, cap_y - 30),
    (cap_x + 240, cap_y + 40),
    (cap_x + 80, cap_y + 70),
], fill=(47, 99, 255, 255))
# 帽身
d.polygon([
    (cap_x + 60, cap_y + 36),
    (cap_x + 200, cap_y + 34),
    (cap_x + 240, cap_y + 150),
    (cap_x + 40, cap_y + 150),
], fill=(31, 70, 200, 255))
# 流苏
d.line([(cap_x + 230, cap_y + 42), (cap_x + 250, cap_y + 150)], fill=(255, 240, 90, 255), width=10)
d.ellipse([cap_x + 236, cap_y + 152, cap_x + 264, cap_y + 180], fill=(255, 240, 90, 255))

# 屏幕内文字像素感：几行"代码"色块
rows = [(200, 300, 380, 312), (200, 328, 350, 340), (200, 356, 400, 368)]
for x0, y0, x1, y1 in rows:
    d.rounded_rectangle([x0, y0, x1, y1], radius=8, fill=(140, 160, 220, 200))

img.save("build/icon.png")
try:
    img.save("build/icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("icon.ico + icon.png written")
except Exception as e:
    print("ico failed:", e)
