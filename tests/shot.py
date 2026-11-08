"""Screenshot helper: python tests/shot.py URL OUT.png [width height] [wait_ms] [js]"""
import sys
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
w, h = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (1440, 900)
wait = int(sys.argv[5]) if len(sys.argv) > 5 else 6000
js = sys.argv[6] if len(sys.argv) > 6 else None
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": w, "height": h})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.on("response", lambda r: logs.append(f"[http {r.status}] {r.url[:160]}") if r.status >= 400 else None)
    pg.on("requestfailed", lambda r: logs.append(f"[failed] {r.url[:160]} {r.failure}"))
    pg.goto(url)
    pg.wait_for_timeout(wait)
    if js:
        pg.evaluate(js)
        pg.wait_for_timeout(wait)
    pg.screenshot(path=out)
    print("\n".join(logs[-40:]))
    b.close()
