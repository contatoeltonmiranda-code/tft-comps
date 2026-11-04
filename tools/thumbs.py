"""Gera miniaturas 40x40 dos campeoes e o icone do app Overwolf. Uso: python tools/thumbs.py (precisa de Pillow)."""
import math
import os
from PIL import Image, ImageDraw

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(RAIZ, 'assets', 'champs')
DST = os.path.join(RAIZ, 'overwolf-app', 'assets', 'champs')
os.makedirs(DST, exist_ok=True)

import re
with open(os.path.join(RAIZ, 'data', 'catalog.js'), encoding='utf8') as f:
    usados = set(re.findall(r'assets/champs/([\w.-]+\.png)', f.read()))
n = 0
for nome in sorted(usados):
    im = Image.open(os.path.join(SRC, nome)).convert('RGB').resize((40, 40), Image.LANCZOS)
    im.quantize(96).save(os.path.join(DST, nome), optimize=True)
    n += 1
print('miniaturas:', n)

# Icone 256x256: hexagono dourado em fundo azul-marinho (mesma paleta do app).
S = 256
ic = Image.new('RGBA', (S, S), (10, 14, 22, 255))
d = ImageDraw.Draw(ic)
def hexa(cx, cy, r):
    return [(cx + r * math.cos(math.radians(60 * k - 30)), cy + r * math.sin(math.radians(60 * k - 30))) for k in range(6)]
d.polygon(hexa(128, 128, 104), fill=(23, 32, 51, 255), outline=(214, 170, 92, 255))
d.polygon(hexa(128, 128, 92), outline=(214, 170, 92, 255))
for i, (dx, dy) in enumerate([(-30, 20), (30, 20), (0, -32)]):
    d.polygon(hexa(128 + dx, 128 + dy, 22), fill=(214, 170, 92, 255))
ic.save(os.path.join(RAIZ, 'overwolf-app', 'assets', 'icon.png'), optimize=True)
print('icone ok')
