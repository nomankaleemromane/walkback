// Walkback service worker: offline-first. Earth-Mars signal delay is minutes, so the crew
// tool must work with no connection. App shell + site data are pre-cached; NASA Trek tiles
// are cached as you browse (cache-first, capped); the DONKI feed is network-first.
const VERSION = "walkback-v3";
const SHELL = [
"./",
"index.html",
"css/app.css",
"icon.svg",
"manifest.webmanifest",
"config/policy.json",
"data/donki_snapshot.json",
"vendor/leaflet/leaflet.js",
"vendor/leaflet/leaflet.css",
"vendor/three/three.module.min.js",
"vendor/three/OrbitControls.js",
"js/app.js",
"js/charts.js",
"js/demo.js",
"js/export.js",
"js/map2d.js",
"js/marstime.js",
"js/model.js",
"js/planner.js",
"js/router.js",
"js/siteio.js",
"js/spaceweather.js",
"js/terrain.js",
"js/view3d.js",
"data/sites/index.json",
"data/sites/gale/dem.bin",
"data/sites/gale/rough.bin",
"data/sites/gale/site.json",
"data/sites/gale/slope.bin",
"data/sites/gale/targets.json",
"data/sites/gale/texture.jpg",
"data/sites/jezero/backtest.json",
"data/sites/jezero/dem.bin",
"data/sites/jezero/geo_bed.bin",
"data/sites/jezero/geo_surf.bin",
"data/sites/jezero/meda.json",
"data/sites/jezero/rough.bin",
"data/sites/jezero/site.json",
"data/sites/jezero/slope.bin",
"data/sites/jezero/targets.json",
"data/sites/jezero/texture.jpg",
"data/sites/jezero/ti.bin",
"data/sites/jezero/traffic.json",
"data/sites/jezero/traverse.geojson",
"data/sites/jezero/pov/amalik_0.jpg",
"data/sites/jezero/pov/amalik_1.jpg",
"data/sites/jezero/pov/amalik_2.jpg",
"data/sites/jezero/pov/bunsen_0.jpg",
"data/sites/jezero/pov/bunsen_1.jpg",
"data/sites/jezero/pov/bunsen_2.jpg",
"data/sites/jezero/pov/cheyava_0.jpg",
"data/sites/jezero/pov/cheyava_1.jpg",
"data/sites/jezero/pov/cheyava_2.jpg",
"data/sites/jezero/pov/hidden_harbor_0.jpg",
"data/sites/jezero/pov/hidden_harbor_1.jpg",
"data/sites/jezero/pov/hidden_harbor_2.jpg",
"data/sites/jezero/pov/lefroy_0.jpg",
"data/sites/jezero/pov/lefroy_1.jpg",
"data/sites/jezero/pov/lefroy_2.jpg",
"data/sites/jezero/pov/melyn_0.jpg",
"data/sites/jezero/pov/melyn_1.jpg",
"data/sites/jezero/pov/melyn_2.jpg",
"data/sites/jezero/pov/pelican_0.jpg",
"data/sites/jezero/pov/pelican_1.jpg",
"data/sites/jezero/pov/pelican_2.jpg",
"data/sites/jezero/pov/rochette_0.jpg",
"data/sites/jezero/pov/rochette_1.jpg",
"data/sites/jezero/pov/rochette_2.jpg",
"data/sites/jezero/pov/seitah_brac_0.jpg",
"data/sites/jezero/pov/seitah_brac_1.jpg",
"data/sites/jezero/pov/seitah_brac_2.jpg",
"data/sites/jezero/pov/seitah_issole_0.jpg",
"data/sites/jezero/pov/seitah_issole_1.jpg",
"data/sites/jezero/pov/seitah_issole_2.jpg",
"data/sites/jezero/pov/sid_0.jpg",
"data/sites/jezero/pov/sid_1.jpg",
"data/sites/jezero/pov/sid_2.jpg",
"data/sites/jezero/pov/skinner_0.jpg",
"data/sites/jezero/pov/skinner_1.jpg",
"data/sites/jezero/pov/skinner_2.jpg",
"data/sites/jezero/pov/wildcat_0.jpg",
"data/sites/jezero/pov/wildcat_1.jpg",
"data/sites/jezero/pov/wildcat_2.jpg"
];
self.addEventListener("install", (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== "walkback-tiles").map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname === "ccmc.gsfc.nasa.gov") return; // live feed: let the app fall back to its snapshot
  if (u.hostname === "trek.nasa.gov") {
    e.respondWith(caches.open("walkback-tiles").then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) { c.put(e.request, r.clone()); trim(c); }
      return r;
    }));
    return;
  }
  if (u.origin === location.origin) {
    // network-first for the app itself (so updates show), cache fallback offline
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(VERSION).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
let trimming = false;
async function trim(c) {
  if (trimming) return; trimming = true;
  const keys = await c.keys();
  for (let i = 0; i < keys.length - 4000; i++) await c.delete(keys[i]);
  trimming = false;
}
