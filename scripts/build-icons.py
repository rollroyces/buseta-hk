#!/usr/bin/env python3
"""Generate the BusETA HK PWA / favicon icons from the master SVG design.

Source of truth for the icon design lives in ``assets/icon.svg`` and
``assets/favicon.svg`` (the two are identical). This script re-rasterises
the same shape recipe to the exact sizes the PWA manifest, the Apple
home-screen, and the browser favicon slots want:

  - bus-192.png            — PWA install icon (Android Chrome)
  - bus-512.png            — PWA splash icon (Android Chrome)
  - apple-touch-icon.png   — iOS home-screen icon (180×180, no alpha)
  - favicon-16.png         — browser tab favicon
  - favicon-32.png         — browser tab favicon (HiDPI)

Run from the repo root:

    python3 scripts/build-icons.py

Re-run after any change to ``assets/icon.svg`` so the PNGs stay in sync.
Pure stdlib + Pillow; no SVG parsing — the shapes are reproduced verbatim
from the design (gradient + rounded rect + 4 rectangles + 3 circles).
"""

from __future__ import annotations

import os
import sys
from PIL import Image, ImageDraw

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

# Palette — copied verbatim from assets/icon.svg so the script is self-
# contained and stays runnable even if the SVG is moved.
GRAD_TOP = (14, 165, 233)  # #0EA5E9
GRAD_BOTTOM = (3, 105, 161)  # #0369A1
WHITE = (255, 255, 255)
WIND = (14, 165, 233)  # #0EA5E9 (also door — same blue as accent)
WHEEL = (10, 22, 40)  # #0A1628
HEADLIGHT = (250, 204, 21)  # #FACC15

# Master canvas — 64×64 matches the SVG viewBox so shape coordinates are
# identical to the source design (see ``assets/icon.svg``).
MASTER = 64
PAD = 2  # SVG inset for the rounded background tile


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def draw_gradient_bg(size: int) -> Image.Image:
    """Vertical gradient tile (rounded rect inset by PAD px on every side)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    # Two-stop linear gradient: GRAD_TOP at y=0, GRAD_BOTTOM at y=size-1.
    for y in range(size):
        t = y / max(size - 1, 1)
        r = lerp(GRAD_TOP[0], GRAD_BOTTOM[0], t)
        g = lerp(GRAD_TOP[1], GRAD_BOTTOM[1], t)
        b = lerp(GRAD_TOP[2], GRAD_BOTTOM[2], t)
        for x in range(size):
            px[x, y] = (r, g, b, 255)
    # Round the corners to match the SVG `rx=14` on a 64-unit canvas —
    # i.e. radius = (rx / 64) * size.
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = round((14 / MASTER) * size)
    mdraw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask)
    return rounded


def render_master() -> Image.Image:
    """Render the icon at MASTER×MASTER (matches the SVG coordinate space)."""
    # Scale factor — every shape below uses SVG-space coordinates relative
    # to MASTER (a copy of the SVG viewBox). When we want a final 192px /
    # 512px PNG we just resize this master; keeps the recipe readable.
    scale = 1.0  # we draw at 1:1 because MASTER == viewBox
    canvas = draw_gradient_bg(MASTER)
    draw = ImageDraw.Draw(canvas)

    def s(v: float) -> float:
        return v * scale

    # Bus body — rounded rect (white) — SVG ``(x=14, y=16, w=36, h=28, rx=5)``
    draw.rounded_rectangle(
        (s(14), s(16), s(14 + 36), s(16 + 28)),
        radius=s(5),
        fill=WHITE,
    )
    # Windshield — rounded rect (#0EA5E9) — SVG ``(17, 20, 30, 9, rx=2)``
    draw.rounded_rectangle(
        (s(17), s(20), s(17 + 30), s(20 + 9)),
        radius=s(2),
        fill=WIND,
    )
    # Wheels — two circles (#0A1628) — SVG ``cx=22/42, cy=46, r=3.4``
    draw.ellipse(
        (s(22 - 3.4), s(46 - 3.4), s(22 + 3.4), s(46 + 3.4)),
        fill=WHEEL,
    )
    draw.ellipse(
        (s(42 - 3.4), s(46 - 3.4), s(42 + 3.4), s(46 + 3.4)),
        fill=WHEEL,
    )
    # Headlight — small yellow circle — SVG ``cx=46.5, cy=38, r=1.8``
    draw.ellipse(
        (s(46.5 - 1.8), s(38 - 1.8), s(46.5 + 1.8), s(38 + 1.8)),
        fill=HEADLIGHT,
    )
    # Door — small rounded rect (#0EA5E9) — SVG ``(29, 33, 6, 9, rx=1)``
    draw.rounded_rectangle(
        (s(29), s(33), s(29 + 6), s(33 + 9)),
        radius=s(1),
        fill=WIND,
    )
    return canvas


def scale_to(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.LANCZOS)


def main() -> int:
    master = render_master()
    targets = [
        ("bus-192.png", 192, "RGBA"),  # PWA install icon — keep alpha
        ("bus-512.png", 512, "RGBA"),  # PWA splash icon — keep alpha
        ("apple-touch-icon.png", 180, "RGB"),  # iOS — flatten to white
        ("favicon-16.png", 16, "RGBA"),
        ("favicon-32.png", 32, "RGBA"),
    ]
    for name, size, mode in targets:
        out = scale_to(master, size)
        if mode == "RGB":
            # iOS expects a solid-background icon (alpha is ignored, and
            # transparent corners render as black on the home screen).
            bg = Image.new("RGB", (size, size), GRAD_BOTTOM)
            bg.paste(out, (0, 0), out)
            out = bg
        path = os.path.join(ASSETS, name)
        out.save(path, format="PNG", optimize=True)
        print(f"  wrote {path}  ({size}x{size}, {mode})")
    return 0


if __name__ == "__main__":
    sys.exit(main())