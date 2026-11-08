// Least-effort routing on the terrain grid (Dijkstra, 8-neighbour). Pure, no DOM.
//
// Route cost per edge = Cw(grade) * d * (1 + hazW * mean hazard)  (Minetti cost, per kg)
// We also accumulate, along the chosen path:
//   E: physical effort per kg (no hazard penalty)  [J/kg]
//   T: walking time at 1 m/s flat pace with the slope pace factor  [s]
// Real joules/seconds come later from the effort case (model.applyCase), so changing
// pace or mass never needs a re-route. Costs use Float64Array: Float32 rounding caused
// endless re-expansion in the prototype.
import { minettiCw, paceFactor } from "./model.js";

class Heap {
  constructor(cap = 1 << 16) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  push(key, val) {
    if (this.n === this.k.length) {
      const k2 = new Float64Array(this.n * 2), v2 = new Int32Array(this.n * 2);
      k2.set(this.k); v2.set(this.v); this.k = k2; this.v = v2;
    }
    let i = this.n++;
    const K = this.k, V = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = key; V[i] = val;
  }
  pop() { // returns value; key in this.top
    const K = this.k, V = this.v, rv = V[0]; this.top = K[0];
    const lk = K[--this.n], lv = V[this.n], m = this.n;
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= m) break; if (c + 1 < m && K[c + 1] < K[c]) c++; if (K[c] >= lk) break; K[i] = K[c]; V[i] = V[c]; i = c; }
    K[i] = lk; V[i] = lv;
    return rv;
  }
}

const NB = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * @param T terrain (terrain.buildTerrain)
 * @param opts.sources  array of start cells (multi-source = nearest of several shelters)
 * @param opts.reverse  true: cost of walking FROM each cell TO the sources (walk-back field);
 *                      P[k] is then the next cell toward the nearest source.
 * @param opts.box      [x0,y0,x1,y1] inclusive search window (default whole grid)
 * @param opts.allow    optional Uint8Array mask; cells with 0 are not entered
 * @param opts.hazW     hazard weight (policy hazard_route_weight)
 * @param opts.targets  optional array of cells: stop early once all are settled
 */
export function dijkstra(T, opts) {
  const { w, h, n, Z, H, pass, cx, cy } = T;
  const { sources, reverse = false, allow = null, hazW = 1.5, targets = null } = opts;
  const [x0, y0, x1, y1] = opts.box || [0, 0, w - 1, h - 1];
  const C = new Float64Array(n).fill(Infinity), E = new Float64Array(n), Tm = new Float64Array(n), P = new Int32Array(n).fill(-1);
  const heap = new Heap();
  const dist = NB.map(([dx, dy]) => Math.hypot(dx * cx, dy * cy));
  for (const s of sources) { if (s >= 0) { C[s] = 0; heap.push(0, s); } }
  let left = targets ? new Set(targets) : null;
  while (heap.n) {
    const u = heap.pop(), cu = heap.top;
    if (cu > C[u]) continue;
    if (left && left.delete(u) && left.size === 0) break;
    const ux = u % w, uy = (u / w) | 0;
    for (let q = 0; q < 8; q++) {
      const vx = ux + NB[q][0], vy = uy + NB[q][1];
      if (vx < x0 || vx > x1 || vy < y0 || vy > y1) continue;
      const v = vy * w + vx;
      if (!pass[v] || (allow && !allow[v])) continue;
      const d = dist[q];
      // walking direction: forward u->v ; reverse v->u (we expand from home outward)
      const g = reverse ? (Z[u] - Z[v]) / d : (Z[v] - Z[u]) / d;
      const e = minettiCw(g) * d, t = d / paceFactor(g);
      const nc = cu + e * (1 + hazW * 0.5 * (H[u] + H[v]));
      if (nc < C[v]) { C[v] = nc; E[v] = E[u] + e; Tm[v] = Tm[u] + t; P[v] = u; heap.push(nc, v); }
    }
  }
  return { C, E, T: Tm, P };
}

// Path from a settled cell back to the source: forward runs give target->source order,
// so reverse it to get source->target. For a reverse (walk-back) field the same walk
// gives cell->home order directly.
export function tracePath(P, k) {
  const out = [];
  for (let c = k, guard = 0; c !== -1 && guard < 1e6; c = P[c], guard++) out.push(c);
  return out;
}

export function boxAround(T, cells, marginCells) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cells) { if (c < 0) continue; const x = c % T.w, y = (c / T.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [Math.max(0, x0 - marginCells), Math.max(0, y0 - marginCells), Math.min(T.w - 1, x1 + marginCells), Math.min(T.h - 1, y1 + marginCells)];
}

// Per-path statistics with real units from an effort case.
export function pathStats(T, path) {
  let d = 0, gain = 0, loss = 0, maxS = 0, maxH = 0;
  for (let q = 1; q < path.length; q++) {
    const a = path[q - 1], b = path[q];
    d += Math.hypot(((b % T.w) - (a % T.w)) * T.cx, (((b / T.w) | 0) - ((a / T.w) | 0)) * T.cy);
    const dz = T.Z[b] - T.Z[a];
    if (dz > 0) gain += dz; else loss -= dz;
  }
  for (const k of path) { maxS = Math.max(maxS, T.slope[k]); maxH = Math.max(maxH, T.H[k]); }
  return { lengthM: d, gainM: gain, lossM: loss, maxSlope: maxS, maxHazard: maxH };
}
