#!/usr/bin/env python3
"""Crop image-generation contact sheets into scene thumbnail WebP files.

The AI image-generation step is intentionally outside this script. Save strict
4x4 contact sheets as sheet-01.png, sheet-02.png, ... and this utility maps
catalog scenes to cells in order.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError as exc:  # pragma: no cover - environment guidance
    raise SystemExit("Pillow is required: install it with `python -m pip install pillow`.") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHEET_DIR = ROOT / "tmp" / "imagegen-thumbnail-sheets"
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "scene-thumbnails"
DEFAULT_CONTACT_SHEET = DEFAULT_SHEET_DIR / "scene-thumbnails-contact-sheet.webp"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet-dir", type=Path, default=DEFAULT_SHEET_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--contact-sheet", type=Path, default=DEFAULT_CONTACT_SHEET)
    parser.add_argument("--size", type=int, default=192)
    parser.add_argument("--quality", type=int, default=78)
    parser.add_argument("--cols", type=int, default=4)
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--clean", action="store_true", help="Remove stale WebP files before writing.")
    return parser.parse_args()


def catalog_scene_ids() -> list[str]:
    catalog_path = ROOT / "js-next" / "runtime" / "data" / "scene-catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    scene_ids = [str(scene["id"]) for scene in catalog.get("scenes", []) if scene.get("id")]
    invalid = [scene_id for scene_id in scene_ids if not scene_id.replace("_", "").replace("-", "").isalnum()]
    if invalid:
        raise SystemExit(f"Scene ids cannot be used as filenames: {', '.join(invalid)}")
    return scene_ids


def crop_cell(sheet: Image.Image, cell_index: int, cols: int, rows: int, size: int) -> Image.Image:
    width, height = sheet.size
    row, col = divmod(cell_index, cols)
    left = round(col * width / cols)
    top = round(row * height / rows)
    right = round((col + 1) * width / cols)
    bottom = round((row + 1) * height / rows)
    crop = sheet.crop((left, top, right, bottom))
    inset = max(0, round(min(crop.size) * 0.018))
    if inset:
        crop = crop.crop((inset, inset, crop.size[0] - inset, crop.size[1] - inset))
    return crop.resize((size, size), Image.Resampling.LANCZOS)


def build_contact_sheet(thumbnails: list[tuple[str, Path]], out_path: Path) -> None:
    if not thumbnails:
        return
    preview_size = 96
    label_height = 18
    padding = 12
    cols = 8
    rows = math.ceil(len(thumbnails) / cols)
    cell_w = preview_size + 2 * padding
    cell_h = preview_size + label_height + 2 * padding
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    for index, (scene_id, path) in enumerate(thumbnails):
        thumb = Image.open(path).convert("RGB").resize((preview_size, preview_size), Image.Resampling.LANCZOS)
        row, col = divmod(index, cols)
        x = col * cell_w + padding
        y = row * cell_h + padding
        sheet.paste(thumb, (x, y))
        draw.text((x, y + preview_size + 3), scene_id[:18], fill=(25, 78, 88))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "WEBP", quality=82, method=6)


def main() -> int:
    args = parse_args()
    if args.cols <= 0 or args.rows <= 0 or args.size < 96:
        raise SystemExit("Invalid grid or output size.")

    scene_ids = catalog_scene_ids()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    if args.clean:
        for path in args.out_dir.glob("*.webp"):
            path.unlink()

    cells_per_sheet = args.cols * args.rows
    expected_sheet_count = math.ceil(len(scene_ids) / cells_per_sheet)
    missing_sheets = [
        args.sheet_dir / f"sheet-{index:02d}.png"
        for index in range(1, expected_sheet_count + 1)
        if not (args.sheet_dir / f"sheet-{index:02d}.png").exists()
    ]
    if missing_sheets:
        formatted = "\n".join(f"- {path}" for path in missing_sheets)
        raise SystemExit(f"Missing image-generation source sheet(s):\n{formatted}")

    written: list[tuple[str, Path]] = []
    open_sheet: Image.Image | None = None
    open_sheet_index = -1
    try:
        for index, scene_id in enumerate(scene_ids):
            sheet_index = index // cells_per_sheet + 1
            cell_index = index % cells_per_sheet
            if sheet_index != open_sheet_index:
                if open_sheet is not None:
                    open_sheet.close()
                sheet_path = args.sheet_dir / f"sheet-{sheet_index:02d}.png"
                open_sheet = Image.open(sheet_path).convert("RGB")
                open_sheet_index = sheet_index
            thumbnail = crop_cell(open_sheet, cell_index, args.cols, args.rows, args.size)
            out_path = args.out_dir / f"{scene_id}.webp"
            thumbnail.save(out_path, "WEBP", quality=args.quality, method=6)
            written.append((scene_id, out_path))
    finally:
        if open_sheet is not None:
            open_sheet.close()

    build_contact_sheet(written, args.contact_sheet)

    total_bytes = sum(path.stat().st_size for _, path in written)
    max_bytes = max((path.stat().st_size for _, path in written), default=0)
    print(
        f"Generated {len(written)} scene thumbnails in {args.out_dir.relative_to(ROOT)} "
        f"({round(total_bytes / 1024)} KB total, max {max_bytes} B)."
    )
    if args.contact_sheet.exists():
        print(f"Contact sheet: {args.contact_sheet}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
