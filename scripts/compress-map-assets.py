#!/usr/bin/env python3

"""Compress map PNG assets to category-specific limits with adaptive quality."""

from __future__ import annotations

import io
import math
import os
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIRECTORY = ROOT / "doc" / "gaia" / "map"
BACKGROUND = (16, 21, 25, 255)
COLOR_COUNTS = (256, 224, 192, 160, 128, 112, 96, 80, 64, 48, 32, 24, 16)


def compression_profile(filename: str) -> tuple[int, int, tuple[int, ...], bool]:
    if re.fullmatch(r"(?:0[1-9]|10)-实心\.png", filename):
        return 20_000, 300, (320, 300, 280, 260, 240, 220, 200, 180, 160, 140, 120), False
    if re.fullmatch(r"1[1-8]-(?:实心|空心)\.png", filename):
        return 10_000, 160, (370, 350, 330, 310, 290, 270, 250, 230, 210, 190, 170, 160, 140, 120, 100), True
    return 5_000, 80, (159, 150, 140, 130, 120, 110, 100, 90, 80, 72, 64, 56, 48), False


def composite(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    rendered = image.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
    background = Image.new("RGBA", size, BACKGROUND)
    background.alpha_composite(rendered)
    return background.convert("RGB")


def psnr(reference: Image.Image, candidate: Image.Image) -> float:
    rms = ImageStat.Stat(ImageChops.difference(reference, candidate)).rms
    mean_squared_error = sum(value * value for value in rms) / 3
    if mean_squared_error == 0:
        return 99.0
    return 20 * math.log10(255 / math.sqrt(mean_squared_error))


def encode(image: Image.Image, width: int, colors: int) -> bytes:
    height = round(image.height * width / image.width)
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    indexed = resized.quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )
    output = io.BytesIO()
    indexed.save(output, "PNG", optimize=True, compress_level=9)
    return output.getvalue()


def compress(path: Path) -> tuple[int, int, int, int, float] | None:
    original_size = path.stat().st_size
    max_bytes, display_width, widths, preserve_resolution = compression_profile(path.name)
    if original_size <= max_bytes:
        return None

    with Image.open(path) as opened:
        source = ImageOps.exif_transpose(opened).convert("RGBA")

    display_width = min(display_width, source.width)
    display_height = round(source.height * display_width / source.width)
    reference = composite(source, (display_width, display_height))
    candidates: list[tuple[float, int, int, bytes]] = []

    for width in widths:
        if width > source.width:
            continue
        for colors in COLOR_COUNTS:
            encoded = encode(source, width, colors)
            if len(encoded) > max_bytes:
                continue
            with Image.open(io.BytesIO(encoded)) as candidate:
                score = psnr(reference, composite(candidate, reference.size))
            candidates.append((score, width, colors, encoded))

    if not candidates:
        raise RuntimeError(f"无法将 {path.name} 压缩至 {max_bytes} 字节以内")

    if preserve_resolution:
        score, width, colors, encoded = max(candidates, key=lambda item: (item[1], item[0], item[2]))
    else:
        score, width, colors, encoded = max(candidates, key=lambda item: (item[0], item[1], item[2]))
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(encoded)
    os.replace(temporary, path)
    return original_size, len(encoded), width, colors, score


def main() -> None:
    paths = sorted(ASSET_DIRECTORY.glob("*.png"), key=lambda path: path.name)
    for path in paths:
        result = compress(path)
        if result is None:
            print(f"SKIP {path.name}: {path.stat().st_size} bytes")
            continue
        original_size, compressed_size, width, colors, score = result
        print(
            f"OK   {path.name}: {original_size} -> {compressed_size} bytes, "
            f"{width}px, {colors} colors, PSNR {score:.2f} dB"
        )

    oversized = [
        path for path in paths
        if path.stat().st_size > compression_profile(path.name)[0]
    ]
    if oversized:
        names = ", ".join(
            f"{path.name}（上限 {compression_profile(path.name)[0]} 字节）"
            for path in oversized
        )
        raise RuntimeError(f"仍有图片超过分类上限：{names}")


if __name__ == "__main__":
    main()
