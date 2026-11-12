"""Lossless CPU channel export; never resample the instance ID channel."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
output = ROOT / "dist/assets/views"
output.mkdir(parents=True, exist_ok=True)
count = 0
for prefix in ("frame", "position", "normal"):
    for index in range(24):
        name = f"{prefix}-{index:02}"
        raw = (ROOT / "reference" / f"{name}.rgba").read_bytes()
        if len(raw) != 840 * 840 * 4:
            raise ValueError(f"Invalid 840×840 RGBA buffer: {name}")
        Image.frombytes("RGBA", (840, 840), raw).save(output / f"{name}.png", optimize=True)
        count += 1
print(f"Exported {count} lossless 840×840 channel maps")
