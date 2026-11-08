"""Trafficability inputs for Jezero, resampled to the Walkback grid.

Inputs (put in raw/, see scripts/README.md):
  raw/stack2020/M2020_JEZ_geology_edited_equi0_allquads_v6_archive.shp
      Mars 2020 Science Team photogeologic map (Stack et al. 2020, Space Sci. Rev. 216:127,
      doi:10.1007/s11214-020-00739-x, supplementary material ESM 3; article CC BY 4.0).
  raw/ti.tif
      THEMIS-derived thermal inertia of Jezero crater (Edwards & Buz 2021,
      doi:10.5281/zenodo.4931348, CC BY 4.0), 100 m/px, J m^-2 K^-1 s^-1/2.

Outputs to data/sites/jezero/:
  geo_bed.bin   uint8 bedrock unit index (0 = outside map)
  geo_surf.bin  uint8 surface-cover unit index (0 = none mapped / outside map)
  ti.bin        uint16 thermal inertia (0 = no data)
  traffic.json  unit list with source descriptions and the hazard scores Walkback assigns
"""
import json, os, math
import numpy as np
import shapefile  # pyshp
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sites", "jezero")
RAW = os.path.join(ROOT, "raw")
R = 3396190.0

# Hazard scores are Walkback's own judgement (an assumption), derived from the unit
# descriptions quoted from Stack et al. (2020). 0 = easy walking, 1 = avoid.
# kind: "rock" (blocks/boulders/rough), "soft" (loose sand/ripples), "smooth".
BED = [
    ("Crater floor fractured 1", 0.15, "smooth", "Massive, light-toned fractured and blocky bedrock; dark sand fills crevices and fractures"),
    ("Crater floor fractured 2", 0.35, "rock", "Rougher, pock-marked surface texture from small m-scale bumps and ridges"),
    ("Crater floor fractured rough", 0.40, "rock", "Rough on the meter-scale, boulder-producing; local relief of only a few meters"),
    ("Margin fractured", 0.35, "rock", "m-scale surface roughness; erosionally resistant blocks 1-5 m in diameter"),
    ("Delta blocky", 0.70, "rock", "Steep-sided boulder-shedding mesas, mounds and terraces; blocks of variable size"),
    ("Delta truncated curvilinear layered", 0.20, "smooth", "Decimeter-scale alternating light/dark strata"),
    ("Delta thinly layered", 0.25, "smooth", "Stair-stepped light-toned ledges, layers <1 m, dark sand or mantling between"),
    ("Delta thickly layered", 0.45, "rock", "Rough-textured, erosionally resistant layers up to several meters thick"),
    ("Delta layered rough", 0.45, "rock", "m-thick layers with a rough surface texture"),
    ("Crater rim blocky", 0.75, "rock", "High-standing ridges that erode to boulders; m-scale rubbly texture"),
    ("Crater rim layered", 0.35, "rock", "m to sub-m layers; fracture-bounded polygons meters to tens of meters across"),
    ("Crater rim breccia", 0.85, "rock", "Brecciated, disrupted bedrock; blocks 10 to >100 m in diameter"),
    ("Crater rim rough", 0.45, "rock", "m-scale rough texture; dark sand infilling small pits"),
    ("Nili Planum fractured", 0.30, "rock", "Low-relief to blocky, ridged expression"),
    ("Neretva Vallis layered", 0.30, "rock", "Layered outcrops with m-scale fracture-bounded polygons"),
]
SURF = [
    ("Aeolian bedforms, large", 0.60, "soft", "Straight-crested bedforms (megaripples); loose sand in troughs"),
    ("Aeolian bedforms, small", 0.40, "soft", "Recently active aeolian ripples; reticulate and polygonal patterns"),
    ("Undifferentiated smooth", 0.10, "smooth", "Smooth unconsolidated mantling deposits of dust, sand, pebbles, cobbles"),
    ("Talus", 0.90, "rock", "Accumulations of m-scale boulders on slopes and below eroded outcrops"),
    ("Moderate Cover Us", 0.10, "smooth", "Unconsolidated cover over ~25-75% of bedrock"),
    ("Minor Cover Us", 0.0, "smooth", "Unconsolidated cover over >0 to ~25% of bedrock (bedrock dominates)"),
]


def main():
    site = json.load(open(os.path.join(OUT, "site.json")))
    w, h = site["w"], site["h"]
    m = lambda d: math.radians(d) * R
    tr = from_bounds(m(site["west"]), m(site["south"]), m(site["east"]), m(site["north"]), w, h)
    ss = 4  # rasterize at 4x the grid resolution, then aggregate
    tr4 = from_bounds(m(site["west"]), m(site["south"]), m(site["east"]), m(site["north"]), w * ss, h * ss)

    shp = shapefile.Reader(os.path.join(RAW, "stack2020", "M2020_JEZ_geology_edited_equi0_allquads_v6_archive"))
    bidx = {n: i + 1 for i, (n, *_r) in enumerate(BED)}
    sidx = {n: i + 1 for i, (n, *_r) in enumerate(SURF)}
    bshapes, sshapes = [], []
    skipped = 0
    for i in range(len(shp)):
        try:
            shape = shp.shape(i)
        except shapefile.ShapefileException:  # a few records have empty geometry
            skipped += 1
            continue
        _, surf, bed = shp.record(i)[:3]
        geom = shape.__geo_interface__
        if bed in bidx:
            bshapes.append((geom, bidx[bed]))
        if surf in sidx:
            sshapes.append((geom, sidx[surf]))
    print(skipped, "empty records skipped;", len(bshapes), "bedrock polygons,", len(sshapes), "surface polygons")
    bed4 = rasterize(bshapes, out_shape=(h * ss, w * ss), transform=tr4, fill=0, dtype="uint8")
    surf4 = rasterize(sshapes, out_shape=(h * ss, w * ss), transform=tr4, fill=0, dtype="uint8")

    def blocks(a):
        return a.reshape(h, ss, w, ss).transpose(0, 2, 1, 3).reshape(h, w, ss * ss)

    # bedrock: dominant unit in the cell
    bb = blocks(bed4)
    bed = np.zeros((h, w), np.uint8)
    counts = np.stack([(bb == k).sum(-1) for k in range(len(BED) + 1)], -1)
    counts[..., 0] = np.where(counts[..., 1:].sum(-1) > 0, 0, counts[..., 0])
    bed = counts.argmax(-1).astype(np.uint8)
    # surface cover: the most hazardous cover type occupying >= 25% of the cell
    sb = blocks(surf4)
    sscore = np.array([0.0] + [s[1] for s in SURF])
    surf = np.zeros((h, w), np.uint8)
    best = np.full((h, w), -1.0)
    for k in range(1, len(SURF) + 1):
        frac = (sb == k).mean(-1)
        take = (frac >= 0.25) & (sscore[k] > best)
        surf[take] = k
        best[take] = sscore[k]
    bed.tofile(os.path.join(OUT, "geo_bed.bin"))
    surf.tofile(os.path.join(OUT, "geo_surf.bin"))
    cover = (bed > 0).mean()
    print(f"geology covers {cover*100:.1f}% of the grid")

    # thermal inertia, averaged onto the grid
    ti = np.zeros((h, w), np.float32)
    with rasterio.open(os.path.join(RAW, "ti.tif")) as ds:
        reproject(ds.read(1), ti, src_transform=ds.transform, src_crs=ds.crs, dst_transform=tr,
                  dst_crs=ds.crs, src_nodata=0, dst_nodata=0, resampling=Resampling.average)
    np.clip(np.rint(ti), 0, 65535).astype("<u2").tofile(os.path.join(OUT, "ti.bin"))
    v = ti[ti > 0]
    print("TI on grid: coverage %.1f%%, p5/p50/p95 = %s" % ((ti > 0).mean() * 100, np.percentile(v, [5, 50, 95]).round()))

    # unit hit counts on the grid (for the legend)
    traffic = {
        "bed_units": [{"id": i + 1, "name": n, "hazard": s, "kind": k, "source_desc": d,
                       "cells": int((bed == i + 1).sum())} for i, (n, s, k, d) in enumerate(BED)],
        "surf_units": [{"id": i + 1, "name": n, "hazard": s, "kind": k, "source_desc": d,
                        "cells": int((surf == i + 1).sum())} for i, (n, s, k, d) in enumerate(SURF)],
        "geology_coverage_pct": round(cover * 100, 1),
        "ti_percentiles": {str(p): float(np.percentile(v, p)) for p in (5, 25, 50, 75, 95)},
        "sources": {
            "geology": "Stack, K.M. et al. (2020) Photogeologic Map of the Perseverance Rover Field Site in Jezero Crater Constructed by the Mars 2020 Science Team. Space Sci. Rev. 216:127. doi:10.1007/s11214-020-00739-x (CC BY 4.0). Mapped at 1:5,000 on a 25 cm HiRISE basemap.",
            "ti": "Edwards, C.S. & Buz, J. (2021) THEMIS-derived Thermal Inertia of Jezero Crater, Mars. Zenodo doi:10.5281/zenodo.4931348 (CC BY 4.0). 100 m/px; overlapping images offset by up to ~20 TI units.",
        },
        "method": "Bedrock unit = dominant unit in each grid cell (rasterized at 4x). Surface cover = most hazardous cover occupying >= 25% of the cell. Unit hazard scores are Walkback assumptions based on the quoted unit descriptions, not values from the source.",
    }
    json.dump(traffic, open(os.path.join(OUT, "traffic.json"), "w"), indent=1)
    site["rasters"].update({"geo_bed": "geo_bed.bin", "geo_surf": "geo_surf.bin", "ti": "ti.bin"})
    site["traffic"] = "traffic.json"
    json.dump(site, open(os.path.join(OUT, "site.json"), "w"), indent=1)
    for u in traffic["bed_units"] + traffic["surf_units"]:
        print(f"  {u['name']:38s} hazard {u['hazard']:.2f}  cells {u['cells']}")


if __name__ == "__main__":
    main()
