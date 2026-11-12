"""Integrity checks for independently editable assembly parts and CPU maps."""
import gzip
import json
import math
from pathlib import Path
import unittest

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "dist/assets"


class PartsAssetsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = json.loads((ASSETS / "duck.json").read_text())
        cls.parts = json.loads((ASSETS / "parts.json").read_text())
        cls.catalog = {part["index"]: part for part in cls.parts}

    def test_all_70_instances_have_unique_stable_ids_and_labels(self):
        self.assertEqual(len(self.parts), 70)
        self.assertEqual(len(self.model["instances"]), 70)
        self.assertEqual([p["id"] for p in self.parts], [f"p{i:03}" for i in range(1, 71)])
        self.assertEqual([p["index"] for p in self.parts], list(range(1, 71)))
        self.assertEqual(len({p["name"] for p in self.parts}), 70)
        sections = ["body"]*10 + ["left-leg"]*17 + ["neck"]*10 + ["head"]*16 + ["right-leg"]*17
        self.assertEqual([p["section"] for p in self.parts], sections)
        for part, instance in zip(self.parts, self.model["instances"]):
            self.assertEqual(set(part), {"id", "index", "name", "mesh", "section", "hardware", "legacyGroup", "bounds"})
            self.assertEqual(part["id"], instance["id"])
            self.assertEqual(part["index"], instance["partIndex"])
            self.assertEqual(part["name"], instance["label"])
            self.assertEqual(part["mesh"], instance["mesh"])
            self.assertEqual(part["section"], instance["section"])
            self.assertEqual(part["legacyGroup"], instance["group"])
            self.assertEqual(part["hardware"], instance["group"] == "fixed")
            self.assertEqual(part["hardware"], instance["hardware"])
            self.assertEqual(part["bounds"], instance["bounds"])

    def test_face_shells_jaw_and_both_feet_are_independent(self):
        required = {
            "face_part": ("p039", "脸部面板"), "top_head_shell": ("p043", "头顶壳"),
            "bottom_head_shell": ("p050", "头部下壳"), "jaw": ("p049", "下颌"),
            "noenoeil": ("p048", "眼睛装饰圈"), "jaw_soft": ("p041", "下颌软垫"),
            "soft_mouth_top": ("p047", "上喙软垫"),
            "foot_left": ("p025", "左脚"), "foot_right": ("p070", "右脚"),
            "sole_left": ("p024", "左脚底板"), "sole_right": ("p068", "右脚底板"),
            "ankle_left": ("p027", "左踝外壳"), "ankle_right": ("p067", "右踝外壳"),
        }
        for mesh, (identifier, name) in required.items():
            matches = [p for p in self.parts if p["mesh"] == mesh]
            self.assertEqual(len(matches), 1, mesh)
            self.assertEqual((matches[0]["id"], matches[0]["name"]), (identifier, name))
        for mesh in ("neck", "leg", "hip_l", "upper_leg_rigidity_plate", "xl330",
                     "seeed_bearing__configuration__22x16x4"):
            matches = [p for p in self.parts if p["mesh"] == mesh]
            self.assertGreater(len(matches), 1)
            self.assertEqual(len({p["id"] for p in matches}), len(matches))
            self.assertEqual(len({json.dumps(p["bounds"]) for p in matches}), len(matches))

    def test_bounds_are_finite_and_match_unmodified_assembly(self):
        surface = self.model["surfaceBounds"]
        lower, upper = np.array(surface["min"]), np.array(surface["max"])
        self.assertTrue(np.isfinite([lower, upper]).all())
        self.assertTrue((upper > lower).all())
        self.assertAlmostEqual(lower[1], 0)
        self.assertAlmostEqual(upper[1], 3.5)
        binary = gzip.decompress((ASSETS / "duck.bin.gz").read_bytes())
        positions = []
        for instance in self.model["instances"]:
            geometry = self.model["geometries"][instance["mesh"]]["position"]
            vertices = np.frombuffer(binary, "<f4", geometry["count"], geometry["offset"]).reshape(-1, 3)
            transform = np.asarray(instance["matrix"]).reshape(4, 4).T
            world = vertices @ transform[:3, :3].T + transform[:3, 3]
            positions.append(world[:, [0, 2, 1]] * np.array([1, 1, -1]))
        raw_lower = np.min([p.min(0) for p in positions], axis=0)
        raw_upper = np.max([p.max(0) for p in positions], axis=0)
        scale = 3.5 / (raw_upper[1] - raw_lower[1])
        offset = (raw_lower + raw_upper) / 2
        offset[1] = raw_lower[1]
        for part, world in zip(self.parts, positions):
            normalized = (world - offset) * scale
            bounds = part["bounds"]
            self.assertTrue(all(math.isfinite(x) for edge in bounds.values() for x in edge))
            np.testing.assert_allclose(bounds["min"], normalized.min(0), atol=1e-7)
            np.testing.assert_allclose(bounds["max"], normalized.max(0), atol=1e-7)
            self.assertTrue((np.array(bounds["min"]) >= lower-1e-7).all())
            self.assertTrue((np.array(bounds["max"]) <= upper+1e-7).all())

    def test_all_24_channel_triplets_have_exact_matching_foreground(self):
        allowed = set(self.catalog)
        for prefix in ("frame", "position", "normal"):
            self.assertEqual(len(list((ASSETS / "views").glob(f"{prefix}-*.png"))), 24)
        for frame in range(24):
            channels = []
            for prefix in ("frame", "position", "normal"):
                with Image.open(ASSETS / "views" / f"{prefix}-{frame:02}.png") as image:
                    self.assertEqual(image.size, (840, 840))
                    self.assertEqual(image.mode, "RGBA")
                    channels.append(np.array(image))
            base, position, normal = channels
            mask = base[:, :, 3] == 255
            self.assertGreater(int(mask.sum()), 50000)
            self.assertEqual(set(np.unique(base[:, :, 3])), {0, 255})
            for image in channels:
                np.testing.assert_array_equal(image[:, :, 3], base[:, :, 3])
                self.assertFalse(image[~mask].any(), "Background data must be transparent zero")
            self.assertTrue(set(np.unique(base[:, :, 1][mask])).issubset(allowed))
            self.assertGreaterEqual(int(base[:, :, 0][mask].min()), 81)
            self.assertGreaterEqual(int(base[:, :, 2][mask].min()), 206)
            self.assertEqual(int(base[:, :, 2][mask].max()), 255)
            vectors = normal[:, :, :3][mask].astype(float) / 127.5 - 1
            np.testing.assert_allclose(np.linalg.norm(vectors, axis=1), 1, atol=.007)

    def test_hero_ids_match_catalog_and_position_maps_stay_in_part_bounds(self):
        base = np.array(Image.open(ASSETS / "views/frame-03.png"))
        mask = base[:, :, 3] == 255
        ids = base[:, :, 1]
        visible = set(np.unique(ids[mask]))
        self.assertTrue({24, 25, 27, 39, 43, 48, 49, 50, 67, 68, 70}.issubset(visible))
        self.assertTrue({self.catalog[index]["id"] for index in visible}.issubset({p["id"] for p in self.parts}))
        lower = np.array(self.model["surfaceBounds"]["min"])
        upper = np.array(self.model["surfaceBounds"]["max"])
        span = upper-lower
        encoded = np.array(Image.open(ASSETS / "views/position-03.png"))
        decoded = lower + encoded[:, :, :3].astype(float)/255*span
        tolerance = span/255*.501 + 1e-6
        for index in visible:
            bounds = self.catalog[index]["bounds"]
            pixels = decoded[mask & (ids == index)]
            self.assertTrue((pixels >= np.array(bounds["min"])-tolerance).all(), index)
            self.assertTrue((pixels <= np.array(bounds["max"])+tolerance).all(), index)


if __name__ == "__main__":
    unittest.main()
