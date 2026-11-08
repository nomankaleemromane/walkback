"""Build dem.json + dem.bin for the Marswalk Planner from a USGS Jezero CTX DEM.
Usage: pip install rasterio numpy ; python make_dem.py [small|full]
  small = Mars 2020 TRN CTX DTM, 20 m, ~18.21-18.72N 77.16-77.70E (fast, covers landing site + delta)
  full  = whole-crater CTX DEM, 20 m, 17.58-19.29N 76.99-78.58E (large download)"""
import sys, json, os, urllib.request, numpy as np, rasterio
from rasterio.enums import Resampling
U = {"small": ("https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif", 2),
     "full": ("https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif", 8)}
mode = sys.argv[1] if len(sys.argv) > 1 else "small"
url, fac = U[mode]; f = os.path.basename(url)
if not os.path.exists(f):
    print("downloading", url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r, open(f, "wb") as out:
        out.write(r.read())
R = 3396190.0
with rasterio.open(f) as ds:
    h, w = ds.height // fac, ds.width // fac
    a = ds.read(1, out_shape=(h, w), resampling=Resampling.average).astype("float32")
    b = ds.bounds
    if ds.crs and ds.crs.is_geographic: west, south, east, north = b.left, b.bottom, b.right, b.top
    else: west, east, south, north = [np.degrees(v / R) for v in (b.left, b.right, b.bottom, b.top)]  # Mars equirectangular, lat_ts=0
    bad = ~np.isfinite(a) | (a < -9000) | (a > 9000) | (ds.nodata is not None and a == ds.nodata)
a[bad] = -32768
open("dem.bin", "wb").write(np.rint(a).astype("<i2").tobytes())
cell = (east - west) / w * np.pi / 180 * 3389500 * np.cos(np.radians((north + south) / 2))
json.dump(dict(w=w, h=h, west=west, east=east, south=south, north=north, cell_m=cell), open("dem.json", "w"))
print(f"wrote dem.bin/dem.json  {w}x{h}  lon {west:.3f}-{east:.3f}  lat {south:.3f}-{north:.3f}  cell {cell:.0f} m")
print("CHECK these bounds against the USGS page; fix if they look wrong.")
