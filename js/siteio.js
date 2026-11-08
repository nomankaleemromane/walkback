// Load a Walkback site pack. `get(path, kind)` returns JSON ('json') or an ArrayBuffer ('bin'),
// so the same code runs in the browser (fetch) and in Node tests (fs).
export async function loadSite(base, get) {
  const site = await get(`${base}/site.json`, "json");
  const R = site.rasters || {};
  const bin = async (name, Type) => (R[name] ? new Type(await get(`${base}/${R[name]}`, "bin")) : null);
  const [dem, slope, rough, geo_bed, geo_surf, ti] = await Promise.all([
    bin("dem", Int16Array), bin("slope", Uint8Array), bin("rough", Uint8Array),
    bin("geo_bed", Uint8Array), bin("geo_surf", Uint8Array), bin("ti", Uint16Array),
  ]);
  const opt = async (f) => { try { return await get(`${base}/${f}`, "json"); } catch { return null; } };
  const [traffic, targets, meda] = await Promise.all([
    site.traffic ? opt(site.traffic) : null, opt("targets.json"), opt("meda.json"),
  ]);
  return { site, raw: { dem, slope, rough, geo_bed, geo_surf, ti }, traffic, targets, meda };
}

export const fetchGet = async (url, kind) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return kind === "json" ? r.json() : r.arrayBuffer();
};
