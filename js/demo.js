// Scripted demo for the video: Quiet -> Watch -> Warning -> mid-EVA abort -> rover safe haven.
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let running = false;

export async function runDemo(S, A) {
  if (running) { running = false; return; }
  running = true;
  const cap = $("caption"), btn = $("demo");
  btn.textContent = "■ Stop demo";
  const say = async (html, ms = 6500) => { if (!running) throw 0; cap.innerHTML = html; cap.hidden = false; await wait(ms); if (!running) throw 0; };
  const keep = { sw: S.swMode, mode: S.mode, view: S.view, rover: S.roverOn };
  try {
    A.setMode("plan"); if (S.view === "3d") await A.setView("2d");
    if (S.roverOn) { $("rover").checked = false; $("rover").dispatchEvent(new Event("change")); }
    A.setSw("quiet");
    if (S.route.getLatLngs().length) S.M.map.fitBounds(S.route.getBounds().pad(0.25));
    await say(`<b>Quiet space weather.</b> Walkback plans a Marswalk from the habitat to the Jezero delta front and the Séítah olivine unit: ${S.plan ? S.plan.order.length : 0} science stops, verdict <b>${S.verdict.verdict}</b>.`, 7500);
    await say(`Every point of the route stays inside the walk-back criterion: the crew can always get home before consumables, daylight or radiation limits run out. Binding now: <b>${S.verdict.binding}</b>.`);
    A.setSw("watch");
    await say(`<b>WATCH:</b> NASA's WSA-Enlil model predicts a CME reaching Mars in ~48 h. The shelter-time limit tightens to ${S.lim} min. Verdict <b>${S.verdict.verdict}</b>, binding: <b>${S.verdict.binding}</b>.`);
    A.setSw("warning");
    await say(`<b>WARNING:</b> arrival within 24 h. Stay within ${S.lim} min of shelter (a RAD-based nowcast gives ≥ 30 min warning). The delta stops drop out; the policy says <b>${S.verdict.verdict}</b> for a new EVA.`, 8000);
    A.setSw("quiet");
    A.setMode("go");
    const st = S.plan.steps.filter((s) => s.kind === "station");
    const far = st.reduce((a, b) => (S.WB.T[S.cells[b.node - 1]] > S.WB.T[S.cells[a.node - 1]] ? b : a));
    A.setGo((far.t0 + 60) / S.plan.totalS);
    await say(`<b>Go mode</b> (tablet / visor view). The crew is on station at <b>${far.label}</b>. Big glove-friendly controls show time to shelter and the margin left.`);
    A.setSw("warning");
    A.setMode("abort");
    await say(`A <b>WARNING</b> arrives mid-EVA. One tap on <b>Abort</b>: least-effort walk-back route, ETA ${$("a-eta").textContent}, buddy-assisted ETA ${$("a-eta2").textContent}.`, 8000);
    A.setMode("plan");
    $("rover").checked = true; $("rover").dispatchEvent(new Event("change"));
    await wait(900);
    await say(`<b>Rover assistance:</b> park a pressurized rover near the delta as a second safe haven. Under the same WARNING the plan now keeps ${S.plan ? S.plan.order.length : 0} stops (verdict for a new EVA still follows policy).`, 8000);
    await say(`Walkback: real NASA terrain, geology, thermal, weather and space-weather data, one decision: <b>can we get home?</b>`, 5000);
  } catch {}
  cap.hidden = true; btn.textContent = "▶ Demo"; running = false;
  if (S.roverOn !== keep.rover) { $("rover").checked = keep.rover; $("rover").dispatchEvent(new Event("change")); }
  A.setSw(keep.sw); A.setMode(keep.mode === "abort" ? "plan" : keep.mode);
}
