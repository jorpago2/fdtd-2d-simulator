#!/usr/bin/env python3
"""Generate deterministic WebP thumbnails for resonator and cavity examples.

The full scene thumbnail set can still be created from image-generation contact
sheets. These resonator thumbnails are intentionally schematic because the
examples need to communicate the coupling geometry and cavity type precisely.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError as exc:  # pragma: no cover - environment guidance
    raise SystemExit("Pillow is required: install it with `python -m pip install pillow`.") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "scene-thumbnails"
SIZE = 192
SCALE = 4

COLORS = {
    "bg": (249, 253, 253, 255),
    "grid": (216, 234, 237, 255),
    "grid_major": (191, 221, 226, 255),
    "outline": (28, 100, 112, 255),
    "material": (128, 217, 225, 255),
    "material_dark": (26, 135, 148, 255),
    "material_light": (190, 238, 242, 255),
    "metal": (77, 83, 87, 255),
    "metal_dark": (42, 48, 52, 255),
    "orange": (248, 151, 32, 185),
    "red": (222, 58, 39, 190),
    "blue": (48, 110, 200, 170),
    "purple": (127, 66, 191, 180),
    "pink": (236, 83, 150, 230),
    "source": (207, 38, 35, 255),
    "source_outline": (255, 244, 232, 255),
    "arrow": (231, 126, 17, 235),
}

TARGET_SCENES = [
    "fabryPerot",
    "fabryPerotStanding",
    "ringResonator",
    "addDropRing",
    "racetrackResonator",
    "dielectricCavity",
    "pecCavity",
    "quarterWaveCavity",
    "qRingdown",
    "purcell2d",
    "betaFactor",
    "degenerateModes",
    "fanoResonator",
    "kerrBistableCavity",
    "modulatedRing",
    "floquetResonators",
    "syntheticFrequency",
    "huygensCavity",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--quality", type=int, default=78)
    return parser.parse_args()


def px(value: float) -> int:
    return int(round(value * SCALE))


def box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(px(value) for value in values)


def new_canvas() -> Image.Image:
    image = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), COLORS["bg"])
    draw = ImageDraw.Draw(image, "RGBA")
    for step, color, width in ((12, COLORS["grid"], 1), (36, COLORS["grid_major"], 1.3)):
        for pos in range(0, SIZE + 1, step):
            draw.line((px(pos), 0, px(pos), px(SIZE)), fill=color, width=max(1, px(width)))
            draw.line((0, px(pos), px(SIZE), px(pos)), fill=color, width=max(1, px(width)))
    draw.rectangle(box((2, 2, SIZE - 2, SIZE - 2)), outline=(110, 188, 199, 255), width=px(1.4))
    return image


def blur_blob(image: Image.Image, bbox: tuple[float, float, float, float], color: tuple[int, int, int, int], blur: float = 4) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.ellipse(box(bbox), fill=color)
    overlay = overlay.filter(ImageFilter.GaussianBlur(px(blur)))
    image.alpha_composite(overlay)


def draw_material_rect(draw: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, *, fill=None, outline=None, radius=0) -> None:
    fill = fill or COLORS["material"]
    outline = outline or COLORS["outline"]
    rect = box((x0, y0, x1, y1))
    if radius > 0:
        draw.rounded_rectangle(rect, radius=px(radius), fill=fill, outline=outline, width=px(1.8))
    else:
        draw.rectangle(rect, fill=fill, outline=outline, width=px(1.8))


def draw_bus(draw: ImageDraw.ImageDraw, y: float, *, x0=12, x1=180, thickness=12, color=None) -> None:
    draw_material_rect(draw, x0, y - thickness / 2, x1, y + thickness / 2, fill=color or COLORS["material"], radius=2)


def draw_waveguide_field(image: Image.Image, y: float, *, x0=22, x1=170, count=7, phase=0.0) -> None:
    span = max(1, x1 - x0)
    for idx in range(count):
        x = x0 + (idx + 0.5) * span / count
        color = COLORS["orange"] if (idx + int(phase)) % 2 == 0 else COLORS["red"]
        blur_blob(image, (x - 11, y - 5, x + 11, y + 5), color, blur=3)


def draw_ring(
    image: Image.Image,
    cx: float,
    cy: float,
    outer: float,
    inner: float,
    *,
    fill=None,
    outline=None,
    field=True,
    active_sections: list[float] | None = None,
) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    fill = fill or COLORS["material"]
    outline = outline or COLORS["outline"]
    draw.ellipse(box((cx - outer, cy - outer, cx + outer, cy + outer)), fill=fill, outline=outline, width=px(1.8))
    draw.ellipse(box((cx - inner, cy - inner, cx + inner, cy + inner)), fill=COLORS["bg"], outline=outline, width=px(1.5))
    if active_sections:
        for angle in active_sections:
            a = math.radians(angle)
            x = cx + (outer - 2) * math.cos(a)
            y = cy + (outer - 2) * math.sin(a)
            blur_blob(image, (x - 7, y - 7, x + 7, y + 7), COLORS["purple"], blur=2)
            draw.line((px(x), px(y - 15), px(x), px(y - 5)), fill=COLORS["purple"], width=px(2))
            draw.line((px(x), px(y + 5), px(x), px(y + 15)), fill=COLORS["purple"], width=px(2))
    if field:
        for idx in range(14):
            angle = 2 * math.pi * idx / 14
            radius = (outer + inner) / 2
            x = cx + radius * math.cos(angle)
            y = cy + radius * math.sin(angle)
            blur_blob(image, (x - 6, y - 6, x + 6, y + 6), COLORS["orange"] if idx % 2 else COLORS["red"], blur=2.4)


def draw_disk(image: Image.Image, cx: float, cy: float, radius: float, *, fill=None, outline=None, field=True) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse(
        box((cx - radius, cy - radius, cx + radius, cy + radius)),
        fill=fill or COLORS["material_light"],
        outline=outline or COLORS["outline"],
        width=px(2),
    )
    if field:
        blur_blob(image, (cx - radius * 0.62, cy - radius * 0.62, cx + radius * 0.62, cy + radius * 0.62), COLORS["orange"], blur=5)
        blur_blob(image, (cx - radius * 0.28, cy - radius * 0.28, cx + radius * 0.28, cy + radius * 0.28), COLORS["red"], blur=3)


def draw_racetrack(image: Image.Image, cx: float, cy: float, width: float, height: float, wall: float, *, field=True) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    outer = (cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)
    inner = (cx - width / 2 + wall, cy - height / 2 + wall, cx + width / 2 - wall, cy + height / 2 - wall)
    draw.rounded_rectangle(box(outer), radius=px(height / 2), fill=COLORS["material"], outline=COLORS["outline"], width=px(2))
    draw.rounded_rectangle(box(inner), radius=px(max(1, height / 2 - wall)), fill=COLORS["bg"], outline=COLORS["outline"], width=px(1.5))
    if field:
        for idx in range(15):
            t = idx / 14
            if t < 0.28:
                x = cx - width / 2 + height / 2 + t / 0.28 * (width - height)
                y = cy - height / 2 + wall / 2 + 3
            elif t < 0.5:
                a = -math.pi / 2 + (t - 0.28) / 0.22 * math.pi
                x = cx + width / 2 - height / 2 + (height / 2 - wall / 2) * math.cos(a)
                y = cy + (height / 2 - wall / 2) * math.sin(a)
            elif t < 0.78:
                x = cx + width / 2 - height / 2 - (t - 0.5) / 0.28 * (width - height)
                y = cy + height / 2 - wall / 2 - 3
            else:
                a = math.pi / 2 + (t - 0.78) / 0.22 * math.pi
                x = cx - width / 2 + height / 2 + (height / 2 - wall / 2) * math.cos(a)
                y = cy + (height / 2 - wall / 2) * math.sin(a)
            blur_blob(image, (x - 5, y - 5, x + 5, y + 5), COLORS["orange"] if idx % 2 else COLORS["red"], blur=2.2)


def draw_source(draw: ImageDraw.ImageDraw, x: float, y: float, radius=4.0) -> None:
    draw.ellipse(box((x - radius - 2, y - radius - 2, x + radius + 2, y + radius + 2)), fill=COLORS["source_outline"])
    draw.ellipse(box((x - radius, y - radius, x + radius, y + radius)), fill=COLORS["source"], outline=(130, 20, 20, 255), width=px(1))


def draw_arrow(draw: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, *, color=None) -> None:
    color = color or COLORS["arrow"]
    draw.line((px(x0), px(y0), px(x1), px(y1)), fill=color, width=px(2.2))
    angle = math.atan2(y1 - y0, x1 - x0)
    head = 7
    for offset in (2.55, -2.55):
        x2 = x1 + head * math.cos(angle + offset)
        y2 = y1 + head * math.sin(angle + offset)
        draw.line((px(x1), px(y1), px(x2), px(y2)), fill=color, width=px(2.2))


def draw_radiation_arcs(draw: ImageDraw.ImageDraw, cx: float, cy: float, *, start=250, end=110, color=None) -> None:
    color = color or (238, 143, 35, 120)
    for radius in (24, 36, 48):
        draw.arc(box((cx - radius, cy - radius, cx + radius, cy + radius)), start=start, end=end, fill=color, width=px(2))


def draw_fabry(image: Image.Image, *, standing=False) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    for side_x in (34, 158):
        for idx in range(5 if standing else 4):
            x = side_x + (idx - 2) * 4
            color = COLORS["metal_dark"] if idx % 2 == 0 else COLORS["material_dark"]
            draw_material_rect(draw, x, 36, x + 3, 156, fill=color, outline=color)
    draw_material_rect(draw, 68, 42, 124, 150, fill=(217, 244, 246, 150), outline=(150, 207, 215, 180), radius=3)
    count = 6 if standing else 5
    for idx in range(count):
        x = 60 + idx * 14
        color = COLORS["red"] if idx % 2 == 0 else COLORS["orange"]
        blur_blob(image, (x - 6, 57, x + 10, 136), color, blur=4)
    if standing:
        for idx in range(count - 1):
            x = 67 + idx * 14
            blur_blob(image, (x - 4, 64, x + 5, 129), COLORS["blue"], blur=3)
    draw_arrow(draw, 18, 96, 46, 96)


def draw_scene(scene_id: str) -> Image.Image:
    image = new_canvas()
    draw = ImageDraw.Draw(image, "RGBA")

    if scene_id == "fabryPerot":
        draw_fabry(image, standing=False)
    elif scene_id == "fabryPerotStanding":
        draw_fabry(image, standing=True)
    elif scene_id == "ringResonator":
        draw_bus(draw, 134, x0=14, x1=178, thickness=12)
        draw_ring(image, 96, 78, 39, 27)
        draw_waveguide_field(image, 134, count=6)
        draw_arrow(draw, 30, 134, 58, 134)
    elif scene_id == "addDropRing":
        draw_bus(draw, 52, x0=16, x1=176, thickness=11)
        draw_bus(draw, 140, x0=16, x1=176, thickness=11)
        draw_ring(image, 96, 96, 37, 25)
        draw_waveguide_field(image, 140, count=5)
        draw_waveguide_field(image, 52, count=4, phase=1)
        draw_arrow(draw, 27, 140, 56, 140)
        draw_arrow(draw, 136, 52, 164, 52)
    elif scene_id == "racetrackResonator":
        draw_bus(draw, 136, x0=15, x1=177, thickness=12)
        draw_racetrack(image, 96, 84, 108, 58, 13)
        draw_waveguide_field(image, 136, count=6)
    elif scene_id == "dielectricCavity":
        draw_disk(image, 96, 96, 42)
        draw_source(draw, 96, 96, radius=4)
        draw_radiation_arcs(draw, 96, 96)
    elif scene_id == "pecCavity":
        draw.rounded_rectangle(box((42, 48, 150, 144)), radius=px(2), fill=COLORS["metal"], outline=COLORS["metal_dark"], width=px(2))
        draw.rounded_rectangle(box((55, 61, 137, 131)), radius=px(1), fill=COLORS["bg"], outline=COLORS["metal_dark"], width=px(1.5))
        for idx in range(5):
            x = 67 + idx * 15
            blur_blob(image, (x - 5, 70, x + 9, 123), COLORS["orange"] if idx % 2 else COLORS["red"], blur=3.5)
        draw_source(draw, 96, 96, radius=3.5)
    elif scene_id == "quarterWaveCavity":
        draw_bus(draw, 130, x0=18, x1=176, thickness=12)
        draw_material_rect(draw, 91, 64, 105, 130, radius=2)
        draw_material_rect(draw, 84, 58, 112, 65, fill=COLORS["metal"], outline=COLORS["metal_dark"], radius=1)
        draw_waveguide_field(image, 130, x0=30, x1=160, count=4)
        for idx in range(3):
            y = 79 + idx * 16
            blur_blob(image, (90, y - 8, 106, y + 8), COLORS["red"] if idx == 0 else COLORS["orange"], blur=2.5)
    elif scene_id == "qRingdown":
        draw_disk(image, 82, 96, 35)
        draw_source(draw, 92, 96, radius=3.5)
        draw_radiation_arcs(draw, 94, 96, start=300, end=60)
        draw_radiation_arcs(draw, 94, 96, start=120, end=240)
    elif scene_id == "purcell2d":
        draw_disk(image, 96, 96, 44, field=False)
        draw_disk(image, 96, 96, 18, fill=(243, 188, 95, 180), outline=(197, 92, 33, 255), field=True)
        draw_source(draw, 96, 96, radius=3.5)
        draw_radiation_arcs(draw, 96, 96, start=285, end=75)
    elif scene_id == "betaFactor":
        draw_bus(draw, 118, x0=18, x1=176, thickness=14)
        draw_waveguide_field(image, 118, x0=42, x1=165, count=5)
        draw_source(draw, 76, 82, radius=4)
        draw_radiation_arcs(draw, 76, 82, start=205, end=335)
        draw_arrow(draw, 80, 89, 97, 111)
        draw_arrow(draw, 88, 118, 132, 118)
    elif scene_id == "degenerateModes":
        draw_disk(image, 96, 96, 44, field=False)
        for cx, cy, color in ((78, 78, COLORS["orange"]), (114, 78, COLORS["blue"]), (78, 114, COLORS["blue"]), (114, 114, COLORS["orange"])):
            blur_blob(image, (cx - 16, cy - 13, cx + 16, cy + 13), color, blur=4)
        draw_source(draw, 88, 96, radius=3)
        draw_source(draw, 104, 96, radius=3)
        draw.line((px(96), px(55), px(96), px(137)), fill=(69, 118, 132, 150), width=px(1.2))
    elif scene_id == "fanoResonator":
        draw_bus(draw, 122, x0=18, x1=176, thickness=12)
        draw_disk(image, 112, 76, 27)
        draw_waveguide_field(image, 122, x0=35, x1=162, count=5)
        blur_blob(image, (93, 112, 130, 132), COLORS["blue"], blur=3)
        draw_arrow(draw, 30, 122, 58, 122)
    elif scene_id == "kerrBistableCavity":
        draw_bus(draw, 135, x0=15, x1=177, thickness=11, color=(178, 224, 228, 255))
        draw_ring(image, 96, 87, 34, 23, field=True)
        draw_material_rect(draw, 76, 80, 116, 94, fill=COLORS["pink"], outline=(141, 36, 104, 255), radius=6)
        draw_waveguide_field(image, 135, count=5)
    elif scene_id == "modulatedRing":
        draw_bus(draw, 135, x0=15, x1=177, thickness=11, color=(178, 224, 228, 255))
        draw_ring(image, 96, 84, 34, 23, field=True, active_sections=[70, 110, 250, 290])
        draw_waveguide_field(image, 135, count=5)
        draw_radiation_arcs(draw, 135, 84, start=300, end=50, color=(136, 44, 178, 130))
    elif scene_id == "floquetResonators":
        draw_bus(draw, 124, x0=18, x1=174, thickness=11, color=(178, 224, 228, 255))
        for idx, (cx, color) in enumerate(((66, COLORS["orange"]), (96, COLORS["purple"]), (126, COLORS["blue"]))):
            draw_disk(image, cx, 82, 18, field=False)
            blur_blob(image, (cx - 10, 72, cx + 10, 92), color, blur=3)
            draw.line((px(cx), px(52), px(cx), px(64)), fill=color, width=px(2.2))
            draw.line((px(cx), px(100), px(cx), px(112)), fill=color, width=px(2.2))
        draw_waveguide_field(image, 124, x0=35, x1=158, count=5)
    elif scene_id == "syntheticFrequency":
        draw_bus(draw, 92, x0=14, x1=178, thickness=10, color=(178, 224, 228, 255))
        phase_colors = [COLORS["orange"], COLORS["purple"], COLORS["blue"], COLORS["red"], COLORS["purple"]]
        for idx, cx in enumerate((46, 71, 96, 121, 146)):
            draw_disk(image, cx, 126, 14, fill=COLORS["material_light"], field=False)
            blur_blob(image, (cx - 8, 118, cx + 8, 134), phase_colors[idx], blur=2.5)
            draw.line((px(cx), px(96), px(cx), px(112)), fill=phase_colors[idx], width=px(2))
        draw_waveguide_field(image, 92, x0=26, x1=166, count=6)
    elif scene_id == "huygensCavity":
        draw_bus(draw, 120, x0=18, x1=176, thickness=12)
        draw_disk(image, 118, 75, 28)
        draw_source(draw, 54, 120, radius=4)
        draw_source(draw, 54, 94, radius=4)
        draw_arrow(draw, 60, 106, 91, 116)
        draw_waveguide_field(image, 120, x0=80, x1=162, count=4)
    else:
        raise ValueError(f"Unsupported scene id: {scene_id}")

    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS).convert("RGB")


def main() -> int:
    args = parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    written = []
    for scene_id in TARGET_SCENES:
        path = args.out_dir / f"{scene_id}.webp"
        image = draw_scene(scene_id)
        image.save(path, "WEBP", quality=args.quality, method=6)
        written.append(path)

    total = sum(path.stat().st_size for path in written)
    largest = max((path.stat().st_size for path in written), default=0)
    print(f"Generated {len(written)} resonator thumbnails ({round(total / 1024)} KB total, max {largest} B).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
