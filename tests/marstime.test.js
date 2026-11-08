import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marsTime, m20Sol, sunriseSunset, sunElevation } from "../js/marstime.js";

test("Mars24 worked example (2000-01-06 00:00 UTC): Ls ~ 277.19 deg, MST ~ 23.997 h", () => {
  const m = marsTime(new Date("2000-01-06T00:00:00Z"), 0);
  assert.ok(Math.abs(m.Ls - 277.18758) < 0.01, `Ls ${m.Ls}`);
  assert.ok(Math.abs(m.mst - 23.99712) < 0.01, `MST ${m.mst}`);
});

test("Perseverance landing (2021-02-18 20:55 UTC) is sol 0", () => {
  assert.equal(m20Sol(new Date("2021-02-18T20:55:00Z")), 0);
});

test("sun is up at noon and down at midnight at Jezero", () => {
  const { declDeg } = marsTime(new Date("2026-11-09T00:00Z"), 77.45);
  assert.ok(sunElevation(12, 18.44, declDeg) > 40);
  assert.ok(sunElevation(0, 18.44, declDeg) < 0);
});

test("geometric sunset agrees with MEDA-observed sunset climatology within 25 min", () => {
  const meda = JSON.parse(readFileSync(new URL("../data/sites/jezero/meda.json", import.meta.url)));
  for (const b of meda.bins) {
    const L = (((b.ls0 + b.ls1) / 2) * Math.PI) / 180;
    const decl = (Math.asin(0.42565 * Math.sin(L)) * 180) / Math.PI + 0.25 * Math.sin(L);
    const { set } = sunriseSunset(18.44, decl);
    assert.ok(Math.abs(set - b.sunset_ltst) < 25 / 60, `Ls ${b.ls0}: geometric ${set.toFixed(2)} vs MEDA ${b.sunset_ltst}`);
  }
});
