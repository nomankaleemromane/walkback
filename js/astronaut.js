// Procedural suited astronaut for the 3D view: built from three.js primitives (no model
// files, works offline), ~30 meshes, with a walk cycle and an "at work" pose for stations.
// Units are metres; the figure faces +Z, so rotation.y = heading (atan2(dx, dz)).
import * as THREE from "three";

const suit = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.85, metalness: 0 });
const joint = new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 0.7 });
const dark = new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.6 });
const visorMat = new THREE.MeshStandardMaterial({ color: 0xffc23d, metalness: 0.7, roughness: 0.18, emissive: 0x4a2a00 });
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
const put = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

export function makeAstronaut(accent = 0xff8c4a) {
  const band = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6, emissive: accent, emissiveIntensity: 0.15 });
  const root = new THREE.Group();   // placed on the ground, rotated to the heading
  const body = new THREE.Group();   // bobs while walking
  root.add(body);

  // torso, hips, life-support backpack (PLSS), chest display and helmet
  const torso = put(body, cap(0.27, 0.42, suit), 0, 1.2, 0); torso.scale.set(1.12, 1, 0.82);
  put(body, cap(0.22, 0.16, joint), 0, 0.92, 0).scale.set(1.25, 1, 0.9);
  put(body, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.26), suit), 0, 1.24, -0.31);
  put(body, new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.2), joint), 0, 1.6, -0.3);
  put(body, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.08), dark), 0, 1.22, 0.26);
  put(body, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.08, 16), joint), 0, 1.5, 0); // neck ring
  const helmet = put(body, new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), suit), 0, 1.69, 0);
  put(helmet, new THREE.Mesh(new THREE.SphereGeometry(0.205, 24, 16, Math.PI / 2 - 0.95, 1.9, 0.75, 1.15), visorMat), 0, 0, 0);
  put(helmet, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), band), 0, 0.2, 0.02); // helmet light

  const limb = (side) => {
    // leg: hip -> thigh -> knee -> shin -> boot
    const hip = put(body, new THREE.Group(), 0.13 * side, 0.92, 0);
    put(hip, cap(0.095, 0.3, suit), 0, -0.22, 0);
    const knee = put(hip, new THREE.Group(), 0, -0.45, 0);
    put(knee, new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), joint), 0, 0, 0);
    put(knee, cap(0.088, 0.28, suit), 0, -0.2, 0);
    put(knee, new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.3), dark), 0, -0.43, 0.05);
    // arm: shoulder -> upper arm (with crew colour band) -> elbow -> forearm -> glove
    const sh = put(body, new THREE.Group(), 0.34 * side, 1.4, 0);
    put(sh, new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), joint), 0, 0, 0);
    put(sh, cap(0.078, 0.22, suit), 0, -0.17, 0);
    put(sh, new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.06, 12), band), 0, -0.12, 0);
    const el = put(sh, new THREE.Group(), 0, -0.33, 0);
    put(el, cap(0.072, 0.2, suit), 0, -0.14, 0);
    put(el, new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), dark), 0, -0.3, 0);
    return { hip, knee, sh, el };
  };
  const L = limb(1), R = limb(-1);

  // soft contact shadow so the figure sits on the ground
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.08; root.add(shadow);

  let phase = 0, work = 0;
  return {
    root,
    // dt: real seconds; cadenceHz: stride cycles per second; walking: true/false
    update(dt, walking, cadenceHz = 0.9) {
      const target = walking ? 0 : 1;               // blend between walk and work poses
      work += (target - work) * (1 - Math.exp(-dt * 6));
      if (walking) phase += dt * cadenceHz * Math.PI * 2;
      else phase += dt * 1.2;                       // slow "working" motion at a station
      const s = Math.sin(phase), c = Math.cos(phase), w = 1 - work;
      // legs: swing from the hip, bend the knee on the forward swing
      L.hip.rotation.x = s * 0.55 * w - 0.25 * work;  R.hip.rotation.x = -s * 0.55 * w - 0.1 * work;
      L.knee.rotation.x = Math.max(0, -c) * 0.85 * w + 0.45 * work; R.knee.rotation.x = Math.max(0, c) * 0.85 * w + 0.2 * work;
      // arms: counter-swing while walking; at a station one arm works a sampling tool
      L.sh.rotation.x = -s * 0.45 * w - work * (0.9 + 0.25 * Math.sin(phase * 2));
      R.sh.rotation.x = s * 0.45 * w - work * 0.35;
      L.el.rotation.x = -0.35 * w - work * (0.7 + 0.2 * Math.sin(phase * 2 + 1));
      R.el.rotation.x = -0.35 * w - work * 0.4;
      L.sh.rotation.z = 0.12; R.sh.rotation.z = -0.12;
      // body bob and slight forward lean; crouch a little at work
      body.position.y = Math.abs(s) * 0.05 * w - 0.12 * work;
      body.rotation.x = 0.08 * w + 0.12 * work;
      body.rotation.z = s * 0.025 * w;
    },
  };
}
