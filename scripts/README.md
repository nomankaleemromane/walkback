# Data builders

Python 3.11 with `numpy rasterio pillow pyshp openpyxl` (`python -m pip install numpy rasterio pillow pyshp openpyxl`); Node 20+ for the `.mjs` scripts. Large downloads go to `raw/` (git-ignored). Run from the repository root.

| Script | Makes | Needs in `raw/` |
|---|---|---|
| `build_site_pack.py scripts/sites/<id>.json` | `data/sites/<id>/` dem, slope (max at native res), roughness, texture, site.json | nothing (streams remote GeoTIFF/COG with /vsicurl/; set `WALKBACK_DOWNLOAD=1` to download instead) |
| `build_traffic_jezero.py` | geology unit rasters, thermal inertia, `traffic.json` | `stack2020/` (unzip Stack et al. 2020 ESM 3 from Springer), `ti.tif` (Zenodo 4931348) |
| `build_targets_jezero.py` | `targets.json` (13 NASA sample sites), `traverse.geojson`, `pov/` images | downloads M20 waypoints/traverse and raw images |
| `build_targets_gale.py` | Gale `targets.json` | downloads MSL waypoints |
| `build_meda_jezero.py` | `meda.json` climatology | `meda/` (unzip "Processed data for analysis.zip" from Zenodo 11198655) |
| `fetch_donki.py` | `data/donki_snapshot.json` (last 30 days) | network |
| `backtest.mjs [legM,sepM,bufferM]` | `data/sites/jezero/backtest.json` | `M20_traverse.json` |
| `report.mjs` | `docs/results.json` (numbers quoted in the docs) | - |
| `build_sw.py` | refreshes the service-worker pre-cache list and cache version | - |

Full Jezero rebuild:

```
python scripts/build_site_pack.py scripts/sites/jezero.json
python scripts/build_traffic_jezero.py
python scripts/build_targets_jezero.py
python scripts/build_meda_jezero.py
python scripts/fetch_donki.py
node scripts/backtest.mjs && node scripts/report.mjs
python scripts/build_sw.py
```

Notes:
- **Zenodo** sometimes returns a 403 HTML page to scripted clients with a browser User-Agent. Plain `curl -L` worked.
- **USGS planetarymaps** URLs redirect to the `asc-pds-services` S3 bucket. Using the bucket URL directly avoids the old User-Agent problem.
- **New site:** copy `scripts/sites/gale.json`, set the DEM URL, bbox, habitat and `read_res_m` (for 1 m DEMs), run the site-pack builder, add the id to `data/sites/index.json`.
