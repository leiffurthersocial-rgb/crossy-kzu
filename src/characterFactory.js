import * as THREE from 'three';
import { box, boxB } from './voxel.js';

// Proportions per build. Everything else in the rig is shared.
const BUILDS = {
  lean: {
    chestW: 0.29, waistW: 0.27, torsoD: 0.18, torsoH: 0.31,
    armW: 0.085, armD: 0.1, legW: 0.11, legD: 0.13, legH: 0.28, legGap: 0.04, sleeve: 0.5,
  },
  normal: {
    chestW: 0.36, waistW: 0.34, torsoD: 0.22, torsoH: 0.3,
    armW: 0.11, armD: 0.13, legW: 0.14, legD: 0.16, legH: 0.25, legGap: 0.03, sleeve: 0.5,
  },
  slightlyHeavy: {
    chestW: 0.42, waistW: 0.46, torsoD: 0.29, torsoH: 0.3,
    armW: 0.125, armD: 0.145, legW: 0.165, legD: 0.18, legH: 0.24, legGap: 0.03, sleeve: 0.5,
  },
  heavyMuscular: {
    chestW: 0.52, waistW: 0.39, torsoD: 0.29, torsoH: 0.32,
    armW: 0.15, armD: 0.17, legW: 0.18, legD: 0.2, legH: 0.25, legGap: 0.03, sleeve: 0.32,
  },
};

const HEAD = 0.34;

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

/**
 * Build a voxel humanoid from a character definition (see characters.js).
 * The model faces +Z and stands on y = 0.
 */
export function buildCharacter(def) {
  const b = BUILDS[def.build] || BUILDS.normal;
  const root = new THREE.Group();

  // --- legs (pivot at the hip) --------------------------------------------
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (b.legGap / 2 + b.legW / 2), b.legH, 0);
    pivot.add(boxB(b.legW, b.legH - 0.06, b.legD, def.pants, 0, -(b.legH - 0.06), 0));
    pivot.add(boxB(b.legW + 0.01, 0.06, b.legD + 0.05, def.shoes, 0, -b.legH, 0.025));
    root.add(pivot);
    legs.push(pivot);
  }

  // --- torso -----------------------------------------------------------------
  const torso = new THREE.Group();
  torso.position.y = b.legH;
  const half = b.torsoH / 2;
  torso.add(boxB(b.waistW, half + 0.01, b.torsoD, def.shirt, 0, 0, 0));
  torso.add(boxB(b.chestW, half, b.torsoD + (def.build === 'heavyMuscular' ? 0.02 : 0), def.shirt, 0, half, 0));
  // belt
  torso.add(boxB(b.waistW + 0.01, 0.04, b.torsoD + 0.01, shade(def.pants, 0.7), 0, 0, 0, false));
  if (def.build === 'heavyMuscular') {
    // pecs and shoulder caps sell the broad chest
    torso.add(boxB(b.chestW * 0.8, 0.1, 0.03, shade(def.shirt, 0.85), 0, half + 0.03, b.torsoD / 2 + 0.01, false));
    for (const side of [-1, 1]) {
      torso.add(boxB(0.14, 0.09, b.torsoD + 0.03, def.shirt, side * (b.chestW / 2 - 0.05), b.torsoH - 0.05, 0));
    }
  }
  if (def.build === 'slightlyHeavy') {
    torso.add(boxB(b.waistW * 0.8, 0.12, 0.03, def.shirt, 0, 0.05, b.torsoD / 2 + 0.01, false));
  }
  root.add(torso);

  // --- arms (pivot at the shoulder) ------------------------------------------
  const arms = [];
  const armLen = b.torsoH * 0.95;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (b.chestW / 2 + b.armW / 2 + 0.005), b.legH + b.torsoH - 0.03, 0);
    const sleeve = armLen * b.sleeve;
    pivot.add(boxB(b.armW + 0.01, sleeve, b.armD + 0.01, def.shirt, 0, -sleeve, 0));
    pivot.add(boxB(b.armW, armLen - sleeve, b.armD, def.skin, 0, -armLen, 0));
    root.add(pivot);
    arms.push(pivot);
  }

  // --- head ------------------------------------------------------------------
  const head = new THREE.Group();
  head.position.y = b.legH + b.torsoH;
  const H = HEAD;
  const fz = H / 2;
  head.add(boxB(H, H, H, def.skin, 0, 0, 0));
  // ears and nose
  head.add(box(0.035, 0.08, 0.07, shade(def.skin, 0.92), -H / 2 - 0.015, 0.17, 0));
  head.add(box(0.035, 0.08, 0.07, shade(def.skin, 0.92), H / 2 + 0.015, 0.17, 0));
  head.add(box(0.045, 0.06, 0.04, shade(def.skin, 0.94), 0, 0.14, fz + 0.015, false));
  // eyes
  const eyeY = 0.19;
  for (const side of [-1, 1]) {
    head.add(box(0.085, 0.075, 0.02, '#ffffff', side * 0.075, eyeY, fz + 0.004, false));
    head.add(box(0.045, 0.06, 0.02, def.eyes, side * 0.07, eyeY - 0.004, fz + 0.012, false));
    head.add(box(0.095, 0.022, 0.02, def.hair.color, side * 0.075, eyeY + 0.068, fz + 0.006, false));
  }
  // mouth
  head.add(box(0.09, 0.022, 0.02, '#7a3b2e', 0, 0.075, fz + 0.004, false));

  addHair(head, def.hair, H);

  if (def.accessories.includes('glasses')) addGlasses(head, H, eyeY);
  if (def.accessories.includes('goatee')) {
    head.add(box(0.11, 0.06, 0.03, def.hair.color, 0, 0.03, fz + 0.01, false));
    head.add(box(0.12, 0.022, 0.025, def.hair.color, 0, 0.102, fz + 0.008, false));
  }
  root.add(head);

  return {
    group: root,
    parts: { head, torso, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1] },
  };
}

function addGlasses(head, H, eyeY) {
  const c = '#151515';
  const t = 0.02;
  const z = H / 2 + 0.024;
  const w = 0.13;
  const h = 0.105;
  for (const side of [-1, 1]) {
    const cx = side * 0.077;
    head.add(box(w, t, 0.012, c, cx, eyeY + h / 2, z, false));
    head.add(box(w, t, 0.012, c, cx, eyeY - h / 2, z, false));
    head.add(box(t, h, 0.012, c, cx - w / 2 + t / 2, eyeY, z, false));
    head.add(box(t, h, 0.012, c, cx + w / 2 - t / 2, eyeY, z, false));
    // hinge + temple arm along the side of the head
    head.add(box(0.03, t, 0.012, c, side * (H / 2 - 0.0), eyeY + 0.03, z, false));
    head.add(box(0.012, t, H * 0.55, c, side * (H / 2 + 0.008), eyeY + 0.03, z - H * 0.28, false));
  }
  head.add(box(0.03, t, 0.012, c, 0, eyeY + 0.02, z, false));
}

function addHair(head, hair, H) {
  const col = hair.color;
  const e = 0.02;
  const W = H + e * 2;
  const top = H; // y of top of head
  const hb = (w, h, d, x, y, z) => head.add(box(w, h, d, col, x, y, z));

  const cap = (h = 0.08) => hb(W, h, W, 0, top + h / 2 - 0.02, 0);
  const back = (h) => hb(W, h, 0.045, 0, top - h / 2 + 0.02, -H / 2 - 0.012);
  const sides = (h, d = H * 0.6, zc = -H * 0.18) => {
    hb(0.045, h, d, -H / 2 - 0.012, top - h / 2 + 0.02, zc);
    hb(0.045, h, d, H / 2 + 0.012, top - h / 2 + 0.02, zc);
  };
  const fringe = (h) => hb(W, h, 0.045, 0, top - h / 2 + 0.02, H / 2 + 0.012);

  switch (hair.style) {
    case 'spiky': {
      cap(0.07);
      back(0.2);
      sides(0.1);
      fringe(0.05);
      const spikes = [
        [-0.11, 0.1, 0.11, 0.25], [0.0, 0.14, 0.12, 0.3], [0.11, 0.11, 0.1, 0.25],
        [-0.08, 0.12, -0.02, -0.1], [0.07, 0.13, -0.03, 0.1], [-0.02, 0.11, -0.12, -0.25],
        [0.1, 0.09, -0.12, -0.2],
      ];
      for (const [x, h, z, tilt] of spikes) {
        const m = box(0.1, h, 0.1, col, x, top + 0.04 + h / 2, z);
        m.rotation.x = tilt;
        m.rotation.z = -x * 2;
        head.add(m);
      }
      break;
    }
    case 'styled': {
      cap(0.1);
      back(0.2);
      sides(0.1, H * 0.7, -H * 0.12);
      // swept-up quiff at the front
      const q = box(W - 0.02, 0.11, 0.17, col, 0, top + 0.1, H / 2 - 0.06);
      q.rotation.x = -0.25;
      head.add(q);
      hb(W * 0.6, 0.06, 0.12, -0.05, top + 0.13, 0.0);
      break;
    }
    case 'modcut': {
      cap(0.09);
      back(0.3);
      hb(0.045, 0.24, W, -H / 2 - 0.012, top - 0.1, 0);
      hb(0.045, 0.24, W, H / 2 + 0.012, top - 0.1, 0);
      hb(W, 0.09, 0.045, 0, top - 0.035, H / 2 + 0.012); // heavy fringe over the brows
      break;
    }
    case 'middlePart': {
      cap(0.08);
      back(0.26);
      sides(0.17, H * 0.75, -H * 0.1);
      const lw = W / 2 - 0.03;
      for (const s of [-1, 1]) {
        // curtains parted in the middle, sweeping down to the temples
        hb(lw, 0.075, 0.045, s * (lw / 2 + 0.03), top - 0.02, H / 2 + 0.012);
        hb(0.07, 0.15, 0.045, s * (W / 2 - 0.035), top - 0.07, H / 2 + 0.012);
      }
      break;
    }
    case 'buzz': {
      const s = 0.01;
      hb(H + s * 2, 0.03, H + s * 2, 0, top + 0.005, 0);
      hb(H + s * 2, 0.15, s * 2, 0, top - 0.07, -H / 2 - 0.002);
      hb(s * 2, 0.11, H * 0.7, -H / 2 - 0.002, top - 0.05, -0.04);
      hb(s * 2, 0.11, H * 0.7, H / 2 + 0.002, top - 0.05, -0.04);
      hb(H + s * 2, 0.03, s * 2, 0, top - 0.015, H / 2 + 0.002);
      break;
    }
    case 'short':
    default: {
      cap(0.08);
      back(0.22);
      sides(0.12);
      fringe(0.05);
      hb(0.14, 0.04, 0.05, -0.08, top - 0.05, H / 2 + 0.014); // side-swept bit
      break;
    }
  }
}
