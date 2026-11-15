"""Regenerate sw.js with the current list of app files to pre-cache (run after changing files)."""
import os, json, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
files = ["./", "index.html", "css/app.css", "icon.svg", "manifest.webmanifest", "img/logo-32.png", "img/logo-64.png", "img/logo-96.png", "img/logo-256.png", "img/app-icon-192.png", "img/app-icon-512.png", "config/policy.json", "data/donki_snapshot.json",
         "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/three/three.module.min.js", "vendor/three/OrbitControls.js"]
files += ["js/" + f for f in sorted(os.listdir("js")) if f.endswith(".js")]
for root, _, fs in os.walk("data/sites"):
    for f in sorted(fs):
        files.append(os.path.join(root, f).replace("\\", "/"))
src = open("sw.js", encoding="utf8").read()
src = re.sub(r"const SHELL = \[.*?\];", "const SHELL = " + json.dumps(files, indent=0) + ";", src, flags=re.S)
n = int(re.search(r'walkback-v(\d+)', src).group(1)) + 1
src = re.sub(r'walkback-v\d+', f"walkback-v{n}", src)
open("sw.js", "w", encoding="utf8").write(src)
print(len(files), "files; cache", f"walkback-v{n}")
