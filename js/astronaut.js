// Procedural suited astronaut for the 3D view (no model files: works offline).
// Proportions and parts follow a modern planetary EVA suit (Artemis-style): hard upper torso,
// bubble helmet with a gold sun visor and side lights, life-support backpack (PLSS) with vents,
// chest display-and-control module, bearing rings at the joints, gauntlet gloves, heavy boots.
// Crew members are told apart by coloured leg stripes and arm bands (as NASA does with red stripes).
// Units are metres; the figure faces +Z, so rotation.y = heading (atan2(dx, dz)).
import * as THREE from "three";

const M = (color, rough = 0.85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const fabric = M(0xf3f0ea, 0.92);          // outer thermal-micrometeoroid garment
const fabric2 = M(0xe4e0d8, 0.95);         // slightly darker panels
const hard = M(0xf7f6f2, 0.45, 0.05);      // hard upper torso, helmet shell, PLSS shell
const metal = M(0xa9adb3, 0.35, 0.8);      // bearings, fittings
const rubber = M(0x2b2a28, 0.8);           // soles, glove palms
const darkGrey = M(0x4a4b4d, 0.6, 0.2);    // display module, vents
const visor = M(0xd9a441, 0.08, 1.0, { envMapIntensity: 1.6 }); // gold-coated sun visor
const glass = M(0x111418, 0.05, 0.6, { transparent: true, opacity: 0.55 });
const lamp = M(0xffffff, 0.3, 0, { emissive: 0xfff2cc, emissiveIntensity: 0.9 });
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

const cap = (r, len, mat, seg = 12) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, seg), mat);
const cyl = (r1, r2, h, mat, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
const box = (x, y, z, mat) => new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat);
const ring = (r, t, mat) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20), mat); m.rotation.x = Math.PI / 2; return m; };
const put = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

export function makeAstronaut(accent = 0xff8c4a) {
  const stripe = M(accent, 0.7, 0, { emissive: accent, emissiveIntensity: 0.12 });
  const root = new THREE.Group();   // on the ground, rotated to the heading
  const body = new THREE.Group();   // bobs and sways while walking
  root.add(body);

  // ---- torso: hard upper torso (HUT) over a soft lower torso, brief/hip assembly
  const hut = put(body, cap(0.29, 0.3, hard, 20), 0, 1.24, 0.01); hut.scale.set(1.18, 1, 0.86);
  put(body, cap(0.25, 0.14, fabric, 16), 0, 1.0, 0).scale.set(1.1, 1, 0.84);
  put(body, ring(0.255, 0.03, metal), 0, 1.07, 0).scale.set(1.12, 0.86, 1);                    // waist bearing
  put(body, cap(0.23, 0.1, fabric2, 16), 0, 0.88, 0).scale.set(1.3, 1, 0.92);                   // brief
  // chest display and control module (DCM) with dials
  const dcm = put(body, box(0.3, 0.17, 0.1, darkGrey), 0, 1.2, 0.27);
  for (const [x, c] of [[-0.08, 0xff6a3d], [0, 0x3dd9ff], [0.08, 0xffd166]]) {
    const knob = put(dcm, cyl(0.022, 0.022, 0.03, M(c, 0.4)), x, 0.02, 0.06); knob.rotation.x = Math.PI / 2;
  }
  put(dcm, box(0.12, 0.04, 0.01, M(0x1e3a2e, 0.2, 0, { emissive: 0x2fa84f, emissiveIntensity: 0.6 })), 0, -0.05, 0.055);
  // life-support backpack (PLSS): shell, side vents, top antenna
  const plss = put(body, box(0.56, 0.72, 0.28, hard), 0, 1.25, -0.33);
  put(plss, box(0.5, 0.64, 0.02, fabric2), 0, 0, -0.15);
  for (const y of [-0.18, -0.06, 0.06]) { put(plss, box(0.035, 0.08, 0.2, darkGrey), 0.29, y, 0); put(plss, box(0.035, 0.08, 0.2, darkGrey), -0.29, y, 0); }
  put(plss, cyl(0.006, 0.006, 0.35, metal, 6), 0.2, 0.52, -0.05);
  put(plss, box(0.2, 0.06, 0.12, darkGrey), -0.12, 0.38, 0);

  // ---- helmet: neck bearing, bubble, gold visor, side lights and camera
  put(body, ring(0.15, 0.03, metal), 0, 1.5, 0.01);
  const head = put(body, new THREE.Group(), 0, 1.69, 0.03);
  put(head, new THREE.Mesh(new THREE.SphereGeometry(0.205, 32, 20), glass));
  // visor-assembly shell wraps the back and sides only, leaving the front window for the visor
  put(head, new THREE.Mesh(new THREE.SphereGeometry(0.218, 32, 20, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0.15, Math.PI * 0.62), hard));
  put(head, new THREE.Mesh(new THREE.SphereGeometry(0.212, 32, 20, Math.PI / 2 - 1.0, 2.0, 0.7, 1.25), visor));
  for (const s of [1, -1]) {
    const pod = put(head, cyl(0.035, 0.035, 0.09, hard, 12), 0.19 * s, 0.07, 0.04); pod.rotation.x = Math.PI / 2;
    put(pod, cyl(0.026, 0.026, 0.005, lamp, 12), 0, 0.047, 0);
  }
  put(head, box(0.05, 0.035, 0.06, darkGrey), 0.12, 0.17, 0.08);                               // helmet camera
  put(head, box(0.12, 0.012, 0.02, stripe), 0, 0.215, -0.02);

  // ---- limbs
  const limb = (side) => {
    // leg: hip bearing -> thigh (crew stripe) -> knee bellows -> lower leg -> boot
    const hip = put(body, new THREE.Group(), 0.13 * side, 0.86, 0);
    put(hip, ring(0.105, 0.022, metal), 0, -0.02, 0);
    put(hip, cap(0.1, 0.27, fabric), 0, -0.22, 0);
    put(hip, cyl(0.104, 0.104, 0.16, stripe), 0, -0.22, 0);
    put(hip, cyl(0.106, 0.106, 0.12, fabric2), 0, -0.22, 0);                                     // stripe shows at the edges
    const knee = put(hip, new THREE.Group(), 0, -0.44, 0);
    for (const y of [0.02, -0.02]) put(knee, ring(0.098, 0.016, fabric2), 0, y, 0);              // bellows
    put(knee, cap(0.092, 0.25, fabric), 0, -0.19, 0);
    const boot = put(knee, new THREE.Group(), 0, -0.42, 0.04);
    put(boot, box(0.17, 0.11, 0.32, M(0xdedbd4, 0.8)), 0, 0, 0);
    put(boot, box(0.18, 0.045, 0.34, rubber), 0, -0.07, 0);
    put(boot, box(0.17, 0.06, 0.06, rubber), 0, -0.02, 0.15);                                    // toe cap
    // arm: shoulder bearing -> upper arm (band) -> elbow bearing -> forearm -> wrist ring -> glove
    const sh = put(body, new THREE.Group(), 0.36 * side, 1.38, 0);
    put(sh, new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), hard));
    const sb = put(sh, ring(0.11, 0.022, metal), 0.04 * side, 0, 0); sb.rotation.set(0, 0, Math.PI / 2);
    put(sh, cap(0.082, 0.2, fabric), 0, -0.18, 0);
    put(sh, cyl(0.087, 0.087, 0.05, stripe), 0, -0.13, 0);
    const el = put(sh, new THREE.Group(), 0, -0.33, 0);
    put(el, ring(0.08, 0.018, metal));
    put(el, cap(0.075, 0.19, fabric), 0, -0.15, 0);
    put(el, ring(0.07, 0.02, metal), 0, -0.29, 0);                                                // wrist disconnect
    const glove = put(el, new THREE.Group(), 0, -0.36, 0.01);
    put(glove, cyl(0.08, 0.07, 0.08, fabric2), 0, 0.04, 0);                                       // gauntlet
    put(glove, new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 10), M(0xd8d4cc, 0.85))).scale.set(0.95, 1.25, 0.75);
    put(glove, box(0.1, 0.07, 0.035, rubber), 0, -0.03, 0.035);                                  // palm grip
    return { hip, knee, sh, el, boot };
  };
  const L = limb(1), R = limb(-1);

  // all meshes cast shadows; a faint contact blob grounds the figure where the shadow map is coarse
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), blobMat);
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.08; blob.castShadow = false; root.add(blob);

  let phase = 0, work = 0, walkB = 0;
  return {
    root,
    // dt: real seconds; walking: legs moving; cadenceHz: stride cycles per second;
    // working: at a science stop (crouch + sampling arm). Neither = standing.
    update(dt, walking, cadenceHz = 0.9, working = false) {
      const k = 1 - Math.exp(-dt * 6);
      walkB += ((walking ? 1 : 0) - walkB) * k;
      work += ((working && !walking ? 1 : 0) - work) * k;
      if (walking) phase += dt * cadenceHz * Math.PI * 2;
      else if (working) phase += dt * 1.2;
      else phase += (Math.round(phase / Math.PI) * Math.PI - phase) * k; // settle feet together when standing
      const s = Math.sin(phase), c = Math.cos(phase), w = walkB, wk = work;
      // Mars-gravity gait in a pressurized suit: long, springy strides, stiff arms, hip sway
      L.hip.rotation.x = s * 0.5 * w - 0.35 * wk;  R.hip.rotation.x = -s * 0.5 * w - 0.12 * wk;
      L.knee.rotation.x = Math.max(0, -c) * 0.9 * w + 0.12 * w + 0.6 * wk; R.knee.rotation.x = Math.max(0, c) * 0.9 * w + 0.12 * w + 0.25 * wk;
      L.boot.rotation.x = -Math.max(0, -c) * 0.35 * w - 0.25 * wk; R.boot.rotation.x = -Math.max(0, c) * 0.35 * w - 0.1 * wk; // keep soles level-ish
      L.sh.rotation.x = -s * 0.32 * w - wk * (0.95 + 0.25 * Math.sin(phase * 2));
      R.sh.rotation.x = s * 0.32 * w - wk * 0.4;
      L.el.rotation.x = -0.45 * w - 0.2 - wk * (0.65 + 0.2 * Math.sin(phase * 2 + 1));
      R.el.rotation.x = -0.45 * w - 0.2 - wk * 0.45;
      L.sh.rotation.z = 0.16; R.sh.rotation.z = -0.16;   // the suit holds the arms away from the body
      // bounce (two per stride, higher in low gravity), forward lean, side-to-side weight shift
      body.position.y = Math.abs(s) * 0.07 * w - 0.14 * wk;
      body.position.x = s * 0.03 * w;
      body.rotation.x = 0.1 * w + 0.15 * wk;
      body.rotation.z = -s * 0.04 * w;
    },
  };
}
