# Independent assembly part maps

`dist/assets/duck.json` preserves the official source commit, indexed geometry,
instance transforms, legacy groups, and RGBA values. Each of its 70 visual
instances additionally has `id`, `partIndex`, `label`, `section`, `hardware`, and
`bounds`. Reused geometry has a different identity for each assembly location.

`dist/assets/parts.json` is the matching UI catalog. Its `index` is **one-based**
and equals the manifest's `partIndex` and the frame map's green byte. Each entry
contains exactly `id`, `index`, `name`, `mesh`, `section`, `hardware`,
`legacyGroup`, and `bounds`.

All bounds and decoded surface coordinates use the existing centered,
floor-aligned viewer world: X/Z are centered and the robot's Y height is 3.5.
`surfaceBounds` in the manifest covers the entire assembly; each part's own
`bounds` covers that instance's transformed geometry.

Each angle from 00 through 23 has three lossless 840 × 840 RGBA maps:

| Map | R | G | B | A |
| --- | --- | --- | --- | --- |
| `frame-NN.png` | illumination × 170 | part index 1–70 | AO multiplier × 255 | 255 surface, 0 background |
| `position-NN.png` | normalized world X | normalized world Y | normalized world Z | identical mask |
| `normal-NN.png` | world normal X | world normal Y | world normal Z | identical mask |

Decode world position component `c` with
`surfaceBounds.min[c] + byte[c] / 255 * (surfaceBounds.max[c] - surfaceBounds.min[c])`.
Decode the normal with `byte / 127.5 - 1`, then normalize the resulting vector.
All background bytes are zero. IDs must be read only where alpha is 255;
sample without smoothing. Normal and position interpolation is perspective
correct and uses the same depth-winning triangle as the part ID.

The red illumination channel has the same material-neutral lighting formula for
every part, including hardware. It does not contain the original material color
or AO; multiply the separately decoded blue AO channel when desired.

Regenerate from the repository root without a GPU:

```sh
python reference/prepare_raster.py
g++ -std=c++17 -O3 -Wall -Wextra -pedantic reference/raster.cpp -o reference/raster
./reference/raster
python reference/export_views.py
python tests/parts_assets_test.py
```

The existing ignore rules exclude the private triangle stream, executable,
temporary RGBA buffers, source STL cache, and raster QA PNGs. Public PNG maps,
the manifest, catalog, and generation scripts are distributable assets.
