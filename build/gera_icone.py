"""Gera build/gelae.ico (copo de cerveja), igual ao web/icone.svg. Rodar só se mudar o desenho: python build/gera_icone.py"""
import os

from PIL import Image, ImageDraw

AZUL, AMARELO, BRANCO = (19, 41, 75), (255, 197, 49), (255, 255, 255)
S = 512
k = S / 64

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(14 * k), fill=AZUL)
d.polygon([(20 * k, 16 * k), (42 * k, 16 * k), (40 * k, 54 * k), (22 * k, 54 * k)], fill=AMARELO)
d.polygon([(20 * k, 16 * k), (42 * k, 16 * k), (41.4 * k, 25 * k), (20.6 * k, 25 * k)], fill=BRANCO)
d.rounded_rectangle([40 * k, 24 * k, 51 * k, 42 * k], radius=int(5 * k), outline=AMARELO, width=int(4 * k))
destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gelae.ico")
img.save(destino, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(destino)
