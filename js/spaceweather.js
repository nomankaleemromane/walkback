// Space-weather alert logic. Pure functions.
//
// Input: NASA CCMC DONKI WSA-Enlil runs. Each run's impactList may predict a CME
// arrival at Mars. A CME arrival is a PROXY for solar energetic particle (SEP) risk:
// SEPs can arrive before the shock, and no dedicated Mars SEP monitor exists since
// MAVEN was declared lost (June 2026). Curiosity RAD is the surface reference.

export const LEVELS = ["quiet", "watch", "warning"];

export function marsArrivals(runs) {
  const out = [];
  for (const r of runs || []) {
    for (const i of r.impactList || []) {
      if (!/mars/i.test(i.location || "") || !i.arrivalTime) continue;
      const s = i.arrivalTime.endsWith("Z") ? i.arrivalTime : i.arrivalTime + "Z";
      const t = Date.parse(s);
      if (!isNaN(t)) out.push({ t, glancing: !!i.isGlancingBlow, runId: r.simulationID || r.link || "", modelCompletion: r.modelCompletionTime });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// Classify the alert level at time `now` (ms) with the policy windows (hours).
export function classify(arrivals, now, policy) {
  const P = policy.params;
  const watchH = P.watch_hours.value, warnH = P.warning_hours.value, pastH = P.warning_past_hours.value;
  let best = null;
  for (const a of arrivals) {
    const h = (a.t - now) / 3.6e6;
    if (h < -pastH || h > watchH) continue;
    if (!best || Math.abs(h) < Math.abs(best.h)) best = { ...a, h };
  }
  if (!best) return { level: "quiet", arrival: null, hours: null };
  const level = best.h <= warnH ? "warning" : "watch";
  // spread of predictions within +-24 h of the chosen one = a simple uncertainty band
  const near = arrivals.filter((a) => Math.abs(a.t - best.t) <= 24 * 3.6e6).map((a) => a.t);
  return { level, arrival: best, hours: best.h, spreadH: near.length > 1 ? (Math.max(...near) - Math.min(...near)) / 3.6e6 : 0, nRuns: near.length };
}

// Radiation time-to-shelter limit (minutes) for a level; null = no extra limit.
export function shelterLimitMin(level, policy) {
  const P = policy.params;
  return level === "warning" ? P.shelter_warning_min.value : level === "watch" ? P.shelter_watch_min.value : P.shelter_quiet_min.value;
}
