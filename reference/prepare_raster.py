"""Prepare unchanged source geometry for CPU rendering in the viewer world.

The private triangle stream is MDP2 + uint32 count + six float32 surface bounds
then 20 float32 values per triangle (positions, normals, part index, reserved).
The robot has the viewer's existing 3.5-unit height, centered and floor-aligned.
"""
import gzip
import json
import struct
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

from prepare_parts import attach_parts, save_parts

ROOT = Path(__file__).resolve().parent.parent
model = json.loads((ROOT / "dist/assets/duck.json").read_text())
parts = attach_parts(model)
# Use the public pack: a separate raw geometry cache is not required.
binary = gzip.decompress((ROOT / "dist/assets/duck.bin.gz").read_bytes())
rotate_x = Rotation.from_euler("x", -np.pi / 2).as_matrix()
records, all_positions = [], []
for item in model["instances"]:
    geometry = model["geometries"][item["mesh"]]
    vertices = np.frombuffer(binary, "<f4", geometry["position"]["count"],
                             geometry["position"]["offset"]).reshape(-1, 3)
    normals = np.frombuffer(binary, "<f4", geometry["normal"]["count"],
                            geometry["normal"]["offset"]).reshape(-1, 3)
    indices = np.frombuffer(binary, "<u4", geometry["index"]["count"],
                            geometry["index"]["offset"]).reshape(-1, 3)
    transform = np.asarray(item["matrix"]).reshape(4, 4).T
    rotation = rotate_x @ transform[:3, :3]
    positions = vertices @ rotation.T + rotate_x @ transform[:3, 3]
    transformed_normals = normals @ np.linalg.inv(rotation)
    lengths = np.linalg.norm(transformed_normals, axis=1, keepdims=True)
    transformed_normals /= np.maximum(lengths, 1e-12)
    records.append((positions, transformed_normals, indices, item))
    all_positions.append(positions)

vertices = np.concatenate(all_positions)
minimum, maximum = vertices.min(0), vertices.max(0)
scale = 3.5 / (maximum[1] - minimum[1])
offset = np.array([(maximum[0] + minimum[0]) / 2, minimum[1],
                   (maximum[2] + minimum[2]) / 2])
surface_min, surface_max = (minimum - offset) * scale, (maximum - offset) * scale
model["surfaceBounds"] = {"min": surface_min.tolist(), "max": surface_max.tolist()}

triangle_count = sum(len(record[2]) for record in records)
with (ROOT / "reference/triangles.bin").open("wb") as output:
    output.write(struct.pack("<4sI6f", b"MDP2", triangle_count,
                             *surface_min, *surface_max))
    for positions, normals, indices, item in records:
        positions = (positions - offset) * scale
        bounds = {"min": positions.min(0).tolist(), "max": positions.max(0).tolist()}
        item["bounds"] = bounds
        parts[item["partIndex"] - 1]["bounds"] = bounds
        triangles = np.zeros((len(indices), 20), dtype="<f4")
        triangles[:, :9] = positions[indices].reshape(-1, 9)
        triangles[:, 9:18] = normals[indices].reshape(-1, 9)
        triangles[:, 18] = item["partIndex"]
        output.write(triangles.tobytes())
save_parts(model, parts)
print(f"Prepared {triangle_count:,} triangles / {len(parts)} parts")
print("surfaceBounds", json.dumps(model["surfaceBounds"]))
