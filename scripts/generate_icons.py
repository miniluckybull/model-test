#!/usr/bin/env python3
"""Generate the Model Tester desktop icons from the brand's routing mark."""

from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "src-tauri" / "icons"
SIZE = 1024
ACCENT = (216, 255, 99, 255)
INK = (18, 35, 27, 255)


def build_master() -> Image.Image:
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mask = Image.new("L", (SIZE, SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((28, 28, 996, 996), radius=224, fill=255)

    background = Image.new("RGBA", (SIZE, SIZE), INK)
    bg_draw = ImageDraw.Draw(background)
    for y in range(SIZE):
        progress = y / SIZE
        color = (
            int(24 - 8 * progress),
            int(43 - 10 * progress),
            int(32 - 7 * progress),
            255,
        )
        bg_draw.line((0, y, SIZE, y), fill=color)
    image.paste(background, (0, 0), mask)

    details = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    detail_draw = ImageDraw.Draw(details)
    for coordinate in (256, 512, 768):
        detail_draw.line((coordinate, 80, coordinate, 944), fill=(116, 151, 124, 15), width=2)
        detail_draw.line((80, coordinate, 944, coordinate), fill=(116, 151, 124, 15), width=2)
    detail_draw.rounded_rectangle(
        (54, 54, 970, 970), radius=202, outline=(139, 172, 146, 32), width=3
    )
    details.putalpha(Image.composite(details.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), mask))
    image = Image.alpha_composite(image, details)

    points = [(256, 704), (256, 320), (512, 520), (768, 320), (768, 704)]
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.line(points, fill=(216, 255, 99, 105), width=104, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(54))
    glow.putalpha(Image.composite(glow.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), mask))
    image = Image.alpha_composite(image, glow)

    mark = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mark_draw = ImageDraw.Draw(mark)
    mark_draw.line(points, fill=ACCENT, width=68, joint="curve")
    for x, y in (points[1], points[2], points[3]):
        mark_draw.ellipse((x - 42, y - 42, x + 42, y + 42), fill=ACCENT)
    for x, y in (points[0], points[-1]):
        mark_draw.ellipse((x - 34, y - 34, x + 34, y + 34), fill=ACCENT)
    mark.putalpha(Image.composite(mark.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), mask))
    return Image.alpha_composite(image, mark)


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    master = build_master()

    outputs = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "256x256.png": 256,
    }
    for filename, size in outputs.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(ICON_DIR / filename)

    master.save(
        ICON_DIR / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    with tempfile.TemporaryDirectory(prefix="model-tester-icon-") as temporary_dir:
        iconset = Path(temporary_dir) / "icon.iconset"
        iconset.mkdir()
        for base_size in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                size = base_size * scale
                suffix = "@2x" if scale == 2 else ""
                filename = f"icon_{base_size}x{base_size}{suffix}.png"
                master.resize((size, size), Image.Resampling.LANCZOS).save(iconset / filename)
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(ICON_DIR / "icon.icns")],
            check=True,
        )


if __name__ == "__main__":
    main()
