import test from "node:test";
import assert from "node:assert/strict";
import { dijkstra, tracePath, pathStats } from "../js/router.js";

// synthetic terrain, 10 m cells
function flat(w = 30, h = 20, z = () => 0) {
  const n = w * h, Z = new Int16Array(n), slope = new Float32Array(n), H = new Float32Array(n), pass = new Uint8Array(n).fill(1);
  for (let k = 0; k < n; k++) Z[k] = z(k % w, (k / w) | 0);
  return { w, h, n, Z, slope, H, pass, cx: 10, cy: 10 };
}

test("flat straight line: effort = 2.5 J/kg/m x distance, time = distance at 1 m/s", () => {
  const T = flat();
  const R = dijkstra(T, { sources: [0], hazW: 0 });
  assert.ok(Math.abs(R.E[10] - 250) < 1e-9);
  assert.ok(Math.abs(R.T[10] - 100) < 1e-9);
  assert.deepEqual(tracePath(R.P, 10).reverse(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("costs are Float64 and finite everywhere reachable", () => {
  const R = dijkstra(flat(), { sources: [0] });
  assert.ok(R.C instanceof Float64Array);
  assert.ok(R.C.every(Number.isFinite));
});

test("impassable wall forces a detour; the mask is respected", () => {
  const T = flat();
  for (let y = 0; y < 15; y++) T.pass[y * T.w + 15] = 0; // wall with a gap at the bottom
  const R = dijkstra(T, { sources: [0], hazW: 0 });
  assert.ok(tracePath(R.P, 20).every((c) => T.pass[c]));
  assert.ok(R.T[20] > 201);
  const allow = new Uint8Array(T.n).fill(1);
  for (let y = 15; y < 20; y++) allow[y * T.w + 15] = 0; // close the gap via the mask
  assert.equal(dijkstra(T, { sources: [0], allow }).C[20], Infinity);
});

test("hazard penalty steers the route around a hazardous strip", () => {
  const T = flat();
  for (let x = 1; x < 20; x++) T.H[x] = 0.9;
  const R = dijkstra(T, { sources: [0], hazW: 3 });
  assert.ok(tracePath(R.P, 20).some((c) => ((c / T.w) | 0) > 0));
});

test("reverse field: walking home downhill costs less than walking out uphill", () => {
  const T = flat(30, 3, (x) => x * 3); // 0.3 grade climbing east
  const out = dijkstra(T, { sources: [30], hazW: 0 });
  const back = dijkstra(T, { sources: [30], reverse: true, hazW: 0 });
  assert.ok(out.E[40] > back.E[40]);
  assert.equal(back.P[40] % 30, 9, "next hop points toward home (one column west)");
});

test("pathStats measures length and climb", () => {
  const T = flat(30, 3, (x) => x);
  const s = pathStats(T, [30, 31, 32, 33]);
  assert.ok(Math.abs(s.lengthM - 30) < 1e-9);
  assert.equal(s.gainM, 3);
});
