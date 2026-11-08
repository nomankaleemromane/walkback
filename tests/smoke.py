"""Playwright smoke test: python tests/smoke.py [base_url] [shots_dir]
Loads each site pack, exercises Plan / Go / Abort / 3D / exports, checks there are no
console errors (external NASA tile failures and aborted requests are ignored), and saves
screenshots at desktop and tablet size. Needs a server: python -m http.server 8000
"""
import sys, os, re
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
IGNORE = re.compile(r"trek\.nasa\.gov|ERR_ABORTED|net::ERR_|Failed to load resource|ccmc\.gsfc", re.I)
fails = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for site, vp in [("jezero", (1440, 900)), ("jezero", (1024, 1366)), ("gale", (1440, 900))]:
        ctx = b.new_context(viewport={"width": vp[0], "height": vp[1]}, accept_downloads=True)
        pg = ctx.new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and not IGNORE.search(m.text) else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        tag = f"{site} {vp[0]}x{vp[1]}"
        pg.goto(f"{BASE}/index.html?site={site}&nosw")
        pg.wait_for_function("document.body.dataset.ready==='1'", timeout=90000)
        pg.wait_for_timeout(1500)
        v = pg.inner_text("#v")
        check(v in ("GO", "CAUTION", "NO-GO"), f"{tag}: verdict shown ({v})")
        check(pg.locator("#checks li").count() >= 5, f"{tag}: checks listed")
        if SHOTS:
            pg.screenshot(path=os.path.join(SHOTS, f"smoke_{site}_{vp[0]}_plan.png"))
        if site == "jezero" and vp[0] == 1440:
            stops_q = pg.evaluate("WALKBACK.plan ? WALKBACK.plan.order.length : 0")
            pg.select_option("#swm", "warning"); pg.wait_for_timeout(600)
            stops_w = pg.evaluate("WALKBACK.plan ? WALKBACK.plan.order.length : 0")
            check(pg.inner_text("#v") == "NO-GO", "jezero: warning gives NO-GO")
            check(stops_w < stops_q, f"jezero: warning drops stops ({stops_q} -> {stops_w})")
            check(pg.evaluate("WALKBACK.plan.profile.every(p => p[1] <= 30*60 + 1)"), "jezero: warning plan stays within 30 min of shelter")
            pg.select_option("#swm", "quiet"); pg.wait_for_timeout(600)
            with pg.expect_download() as d:
                pg.click("#exGeo")
            check(d.value.suggested_filename.endswith(".geojson"), "jezero: GeoJSON export")
            with pg.expect_download() as d:
                pg.click("#exGpx")
            check(d.value.suggested_filename.endswith(".gpx"), "jezero: GPX export")
            check(pg.locator("#backtest .stats").count() == 1, "jezero: backtest panel")
            check(pg.locator(".pov img").count() >= 20, "jezero: POV images present")
        # Go / Abort
        pg.click(".modes button[data-mode=go]"); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('goT').value=400; document.getElementById('goT').dispatchEvent(new Event('input'))")
        pg.wait_for_timeout(300)
        check(pg.inner_text("#h-wb") != "–", f"{tag}: Go HUD shows time to shelter")
        if SHOTS:
            pg.screenshot(path=os.path.join(SHOTS, f"smoke_{site}_{vp[0]}_go.png"))
        pg.click("#goAbort"); pg.wait_for_timeout(400)
        check("min" in pg.inner_text("#a-eta") or "h" in pg.inner_text("#a-eta"), f"{tag}: Abort ETA ({pg.inner_text('#a-eta')})")
        if SHOTS:
            pg.screenshot(path=os.path.join(SHOTS, f"smoke_{site}_{vp[0]}_abort.png"))
        pg.click(".modes button[data-mode=plan]")
        if vp[0] == 1440:
            pg.click("#view3d"); pg.wait_for_timeout(7000)
            check(pg.locator("#view3 canvas").count() == 1, f"{tag}: 3D view renders")
            if SHOTS:
                pg.screenshot(path=os.path.join(SHOTS, f"smoke_{site}_3d.png"))
        check(not errs, f"{tag}: no console errors" + (f" -> {errs[:3]}" if errs else ""))
        ctx.close()
    b.close()
print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)
