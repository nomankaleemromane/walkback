// Scripted demo for the video: Quiet -> Watch -> Warning -> mid-EVA abort -> rover safe haven.
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let running = false;
const BIND = { eva: "planned EVA length", consumables: "consumables walk-back", radiation: "radiation shelter time", daylight: "daylight" };

export async function runDemo(S, A) {
  if (running) { running = false; return; }
  running = true;
  const cap = $("caption"), btn = $("demo");
  btn.textContent = "■ Stop demo";
  const say = async (html, ms = 6500) => { if (!running) throw 0; cap.innerHTML = html; cap.hidden = false; await wait(ms); if (!running) throw 0; };
  const keep = { sw: S.swMode, mode: S.mode, view: S.view, rover: S.roverOn, radOverride: S.radOverride,
    stops: S.targets.map((t) => ({ t, enabled: t.enabled, pinned: t.pinned })) };
  const view3 = $("view3d"); view3.disabled = true; // the story is told on the 2D map
  const names = (p) => (p ? p.order.map((j) => S.targets[j - 1].name) : []);
  const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const stops = (n) => `${n} science stop${n === 1 ? "" : "s"}`;
  try {
    // standard demo setup: every catalogue stop considered, nothing pinned, no manual limit
    S.targets.forEach((t) => { if (!t.custom) t.enabled = true; t.pinned = false; });
    S.radOverride = ""; $("radlim").value = "";
    A.refreshStops();
    A.setMode("plan"); if (S.view === "3d") await A.setView("2d");
    if (S.roverOn) { $("rover").checked = false; $("rover").dispatchEvent(new Event("change")); }
    A.setSw("quiet");
    if (S.route.getLatLngs().length) S.M.map.fitBounds(S.route.getBounds().pad(0.25));
    await say(`<b>Quiet space weather.</b> Walkback plans a Marswalk from the habitat: ${stops(names(S.plan).length)} (${list(names(S.plan))}), verdict <b>${S.verdict.verdict}</b>.`, 8000);
    await say(`Every point of the route stays inside the walk-back criterion: the crew can always get home before consumables, daylight or radiation limits run out. Binding now: <b>${BIND[S.verdict.binding] || "none"}</b>.`);
    A.setSw("watch");
    await say(`<b>WATCH:</b> NASA's WSA-Enlil model predicts a CME reaching Mars in ~48 h. The shelter-time limit tightens to ${S.lim} min. Verdict <b>${S.verdict.verdict}</b>, binding: <b>${BIND[S.verdict.binding] || "none"}</b>.`);
    A.setSw("warning");
    const lost = names(S.quietPlan).filter((n) => !names(S.plan).includes(n));
    await say(`<b>WARNING:</b> arrival within 24 h. Stay within ${S.lim} min of shelter (a RAD-based nowcast gives ≥ 30 min warning). ${lost.length ? `${list(lost)} drop${lost.length === 1 ? "s" : ""} out; ` : ""}the policy says <b>${S.verdict.verdict}</b> for a new EVA.`, 8500);
    A.setSw("quiet");
    A.setMode("go");
    if (!S.plan) throw 0;
    const st = S.plan.steps.filter((s) => s.kind === "station");
    const far = st.reduce((a, b) => (S.WB.T[S.cells[b.node - 1]] > S.WB.T[S.cells[a.node - 1]] ? b : a));
    A.setGo((far.t0 + 60) / S.plan.totalS);
    await say(`<b>Go mode</b> (tablet / visor view). The crew is on station at <b>${far.label}</b>. Big glove-friendly controls show time to shelter and the margin left.`);
    S.abortCell = A.goCell();
    A.setSw("warning");
    await say(`A <b>WARNING</b> arrives mid-EVA. The Go view turns red: the crew is now beyond what the new 30-min limit allows.`, 6500);
    A.setMode("abort");
    await say(`One tap on <b>Abort</b>: least-effort walk-back route, ETA ${$("a-eta").textContent}, buddy-assisted ETA ${$("a-eta2").textContent}. This is why Walkback refuses delta stops under a Warning.`, 8000);
    A.setMode("plan");
    $("rover").checked = true; $("rover").dispatchEvent(new Event("change"));
    await wait(900);
    await say(`<b>Rover assistance:</b> the crew drives a pressurized rover to the delta and walks from there. The rover is a safe haven, so even under the WARNING's 30-min limit the delta stops come back: ${stops(names(S.plan).length)}. (Policy still decides whether to go.)`, 8500);
    await say(`Walkback: real NASA terrain, geology, thermal, weather and space-weather data, one decision: <b>can we get home?</b>`, 5000);
  } catch {}
  cap.hidden = true; btn.textContent = "▶ Demo"; running = false; view3.disabled = false;
  // put the user's own choices back
  keep.stops.forEach(({ t, enabled, pinned }) => { t.enabled = enabled; t.pinned = pinned; });
  S.radOverride = keep.radOverride; $("radlim").value = keep.radOverride;
  A.refreshStops();
  if (S.roverOn !== keep.rover) { $("rover").checked = keep.rover; $("rover").dispatchEvent(new Event("change")); }
  A.setSw(keep.sw); A.setMode(keep.mode === "abort" ? "plan" : keep.mode);
  if (keep.view === "3d") A.setView("3d");
}
