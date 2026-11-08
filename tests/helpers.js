import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadSite } from "../js/siteio.js";
import { buildTerrain } from "../js/terrain.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const fsGet = async (p, kind) => {
  const buf = await readFile(path.join(ROOT, p));
  return kind === "json" ? JSON.parse(buf.toString("utf8")) : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};
export async function loadAll(site = "jezero") {
  const policy = await fsGet("config/policy.json", "json");
  const S = await loadSite(`data/sites/${site}`, fsGet);
  const T = buildTerrain(S.site, S.raw, S.traffic, policy);
  return { policy, ...S, T };
}
