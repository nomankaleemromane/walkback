"""Build a Walkback site pack for any Mars site.

Usage:
    python scripts/build_site_pack.py scripts/sites/jezero.json
    python scripts/build_site_pack.py scripts/sites/gale.json

The site config (JSON) gives: id, name, dem_url (GeoTIFF/COG, equirectangular),
optional bbox [west, south, east, north] to clip, cell_target_m (routing grid),
optional ortho_url (GeoTIFF used for the 3D texture), habitat [lat, lon].

Outputs to data/sites/<id>/:
    dem.bin      int16 little-endian, metres, -32768 = no data
    slope.bin    uint8, MAX slope inside each cell from the native DEM, 0.25 deg steps, 255 = no data
    rough.bin    uint8, max local relief (|z - 3x3 mean|) at native resolution, 0.1 m steps, 255 = no data
    texture.jpg  orthoimage (or hillshade) covering exactly the grid bbox
    site.json    grid metadata, habitat, credits

Remote files are read with GDAL /vsicurl/ windowed reads, so a huge global COG only
downloads the window needed.
"""
import json, os, sys, math, urllib.request
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
R_MARS = 3396190.0  # Mars 2000 sphere (IAU), used by USGS equirectangular products


def open_src(url):
    """Local cache if downloaded, else stream with /vsicurl/."""
    local = os.path.join(RAW, os.path.basename(url))
    if os.path.exists(local):
        return rasterio.open(local)
    if url.startswith("http") and os.environ.get("WALKBACK_DOWNLOAD") == "1":
        print("downloading", url)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        os.makedirs(RAW, exist_ok=True)
        with urllib.request.urlopen(req) as r, open(local, "wb") as out:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                out.write(b)
        return rasterio.open(local)
    return rasterio.open("/vsicurl/" + url if url.startswith("http") else url)


def ll_bounds(ds):
    b = ds.bounds
    if ds.crs and ds.crs.is_geographic:
        return b.left, b.bottom, b.right, b.top
    deg = lambda v: math.degrees(v / R_MARS)
    return deg(b.left), deg(b.bottom), deg(b.right), deg(b.top)


def to_native(ds, lon, lat):
    if ds.crs and ds.crs.is_geographic:
        return lon, lat
    return math.radians(lon) * R_MARS, math.radians(lat) * R_MARS


def block_reduce(a, f, fn):
    h, w = a.shape[0] // f * f, a.shape[1] // f * f
    a = a[:h, :w].reshape(h // f, f, w // f, f)
    return fn(fn(a, axis=3), axis=1)


def main(cfg_path):
    cfg = json.load(open(cfg_path))
    out = os.path.join(ROOT, "data", "sites", cfg["id"])
    os.makedirs(out, exist_ok=True)
    with open_src(cfg["dem_url"]) as ds:
        W, S, E, N = cfg.get("bbox") or ll_bounds(ds)
        x0, y0 = to_native(ds, W, S)
        x1, y1 = to_native(ds, E, N)
        win = from_bounds(x0, y0, x1, y1, ds.transform).round_offsets().round_lengths()
        z = ds.read(1, window=win).astype("float64")
        tr = ds.window_transform(win)
        nod = ds.nodata
        res_native = abs(tr.a)  # metres (projected) or degrees
        if ds.crs and ds.crs.is_geographic:
            res_native = math.radians(res_native) * R_MARS
        # real bbox of the window actually read
        h0, w0 = z.shape
        wx0, wy1 = tr * (0, 0)
        wx1, wy0 = tr * (w0, h0)
        if not (ds.crs and ds.crs.is_geographic):
            wx0, wx1, wy0, wy1 = [math.degrees(v / R_MARS) for v in (wx0, wx1, wy0, wy1)]
    bad = ~np.isfinite(z) | (z < -9000) | (z > 30000)
    if nod is not None:
        bad |= z == nod
    z[bad] = np.nan
    print(f"native DEM {w0}x{h0} @ {res_native:.1f} m, lon {wx0:.4f}-{wx1:.4f} lat {wy0:.4f}-{wy1:.4f}")

    # --- native-resolution slope and roughness (before downsampling, so steep
    #     sub-cell features are not averaged away)
    lat_mid = math.radians((wy0 + wy1) / 2)
    dx = res_native * math.cos(lat_mid) if not cfg.get("projected_true_scale") else res_native
    dy = res_native
    gy, gx = np.gradient(z, dy, dx)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    pad = np.pad(z, 1, mode="edge")
    m3 = sum(pad[1 + a:1 + a + h0, 1 + b:1 + b + w0] for a in (-1, 0, 1) for b in (-1, 0, 1)) / 9.0
    rough = np.abs(z - m3)

    f = max(1, int(round(cfg.get("cell_target_m", 40) / res_native)))
    H, Wd = h0 // f, w0 // f
    with np.errstate(all="ignore"):
        zc = block_reduce(z, f, np.nanmean)
        sc = block_reduce(np.where(np.isnan(slope), -1, slope), f, np.max)
        rc = block_reduce(np.where(np.isnan(rough), -1, rough), f, np.max)
        badc = block_reduce(bad.astype(np.uint8), f, np.max) > 0
    zc[badc | ~np.isfinite(zc)] = -32768
    sc_u8 = np.where(badc | (sc < 0), 255, np.clip(np.rint(sc * 4), 0, 254)).astype(np.uint8)
    rc_u8 = np.where(badc | (rc < 0), 255, np.clip(np.rint(rc * 10), 0, 254)).astype(np.uint8)
    # bbox of the trimmed grid
    east = wx0 + (wx1 - wx0) * (Wd * f) / w0
    south = wy1 - (wy1 - wy0) * (H * f) / h0
    west, north = wx0, wy1
    np.rint(zc).astype("<i2").tofile(os.path.join(out, "dem.bin"))
    sc_u8.tofile(os.path.join(out, "slope.bin"))
    rc_u8.tofile(os.path.join(out, "rough.bin"))
    cell_x = math.radians((east - west) / Wd) * R_MARS * math.cos(math.radians((north + south) / 2))
    cell_y = math.radians((north - south) / H) * R_MARS
    print(f"grid {Wd}x{H}, cell {cell_x:.1f} x {cell_y:.1f} m, factor {f}")

    # --- texture: orthoimage if given, else hillshade of the DEM
    tex_w = cfg.get("texture_px", 2048)
    tex_h = int(round(tex_w * H / Wd))
    tex_src = "hillshade (computed from the DEM)"
    img = None
    if cfg.get("ortho_url"):
        try:
            with open_src(cfg["ortho_url"]) as ds:
                x0, y0 = to_native(ds, west, south)
                x1, y1 = to_native(ds, east, north)
                win = from_bounds(x0, y0, x1, y1, ds.transform)
                a = ds.read(1, window=win, out_shape=(tex_h, tex_w), resampling=Resampling.average, boundless=True, fill_value=0).astype("float32")
            v = a[a > 0]
            lo, hi = np.percentile(v, [0.5, 99.5]) if v.size else (0, 255)
            a = np.clip((a - lo) / max(hi - lo, 1) * 255, 0, 255)
            img = Image.fromarray(a.astype(np.uint8), "L")
            tex_src = cfg.get("ortho_credit", "orthoimage")
        except Exception as e:  # fall back to hillshade
            print("ortho failed:", e)
    if img is None:
        zz = np.where(zc <= -32768, np.nan, zc)
        gy, gx = np.gradient(zz, cell_y, cell_x)
        az, alt = math.radians(315), math.radians(35)
        sl = np.arctan(np.hypot(gx, gy)); asp = np.arctan2(-gx, gy)
        hs = np.sin(alt) * np.cos(sl) + np.cos(alt) * np.sin(sl) * np.cos(az - asp)
        hs = np.nan_to_num(np.clip(hs, 0, 1) * 255)
        img = Image.fromarray(hs.astype(np.uint8), "L").resize((tex_w, tex_h), Image.BILINEAR)
    img.convert("RGB").save(os.path.join(out, "texture.jpg"), quality=82, optimize=True)

    site = {
        "id": cfg["id"], "name": cfg["name"],
        "w": Wd, "h": H, "west": west, "east": east, "south": south, "north": north,
        "cell_x": cell_x, "cell_y": cell_y, "mars_radius_m": R_MARS,
        "native_res_m": res_native, "agg_factor": f,
        "habitat": cfg["habitat"], "habitat_note": cfg.get("habitat_note", ""),
        "center": cfg.get("center", [(north + south) / 2, (east + west) / 2]),
        "dem_source": cfg.get("dem_credit", cfg["dem_url"]), "dem_url": cfg["dem_url"],
        "texture_source": tex_src,
        "layers": cfg.get("layers", {}),
        "extras": cfg.get("extras", []),
        "rasters": {"dem": "dem.bin", "slope": "slope.bin", "rough": "rough.bin"},
        "notes": cfg.get("notes", []),
    }
    # keep extra rasters/data that other builders already registered
    old = os.path.join(out, "site.json")
    if os.path.exists(old):
        prev = json.load(open(old))
        for k, v in prev.get("rasters", {}).items():
            site["rasters"].setdefault(k, v)
        for k in ("traffic", "files"):
            if k in prev:
                site[k] = prev[k]
    json.dump(site, open(old, "w"), indent=1)
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "scripts", "sites", "jezero.json"))
