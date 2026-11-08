import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { marsArrivals, classify, shelterLimitMin } from "../js/spaceweather.js";
const policy = JSON.parse(readFileSync(new URL("../config/policy.json", import.meta.url)));
const now = Date.parse("2026-11-09T12:00Z");
const run = (t, loc = "Mars", gb = false) => ({ impactList: [{ location: loc, arrivalTime: t, isGlancingBlow: gb }, { location: "Earth", arrivalTime: t }] });

test("only Mars impacts are kept; times without Z are read as UTC", () => {
  const a = marsArrivals([run("2026-11-10T12:00"), run("2026-11-10T12:00Z", "STEREO A")]);
  assert.equal(a.length, 1);
  assert.equal(a[0].t, Date.parse("2026-11-10T12:00Z"));
});

test("levels: >72 h quiet, 24-72 h watch, <24 h warning, up to 12 h after arrival warning", () => {
  const lv = (iso) => classify(marsArrivals([run(iso)]), now, policy).level;
  assert.equal(lv("2026-11-13T13:00Z"), "quiet");
  assert.equal(lv("2026-11-11T12:00Z"), "watch");
  assert.equal(lv("2026-11-10T06:00Z"), "warning");
  assert.equal(lv("2026-11-09T02:00Z"), "warning");
  assert.equal(lv("2026-11-08T20:00Z"), "quiet");
});

test("shelter limits come from the policy (warning = 30 min)", () => {
  assert.equal(shelterLimitMin("warning", policy), 30);
  assert.equal(shelterLimitMin("watch", policy), policy.params.shelter_watch_min.value);
  assert.equal(shelterLimitMin("quiet", policy), null);
});

test("the cached DONKI snapshot parses", () => {
  const snap = JSON.parse(readFileSync(new URL("../data/donki_snapshot.json", import.meta.url)));
  assert.ok(Array.isArray(marsArrivals(snap.runs)));
});
