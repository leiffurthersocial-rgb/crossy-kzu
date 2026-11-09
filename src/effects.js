import * as THREE from 'three';
import { box, boxB, mat } from './voxel.js';

// Cheap voxel particles + the eagle that snatches idle players.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.free = [];
    for (let i = 0; i < 90; i++) {
      const m = box(1, 1, 1, '#ffffff', 0, -50, 0, false);
      m.visible = false;
      scene.add(m);
      this.free.push({ mesh: m, vel: new THREE.Vector3(), life: 0, max: 1, size: 0.1 });
    }
    this.eagle = makeEagle();
    this.eagle.visible = false;
    scene.add(this.eagle);
    this.eagleAnim = null;
  }

  burst(pos, colors, count, { speed = 3, up = 4, size = 0.12, life = 0.7, gravity = 14 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = this.free.pop();
      if (!p) return;
      p.mesh.material = mat(colors[i % colors.length]);
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      p.vel.set(Math.cos(a) * r, up * (0.5 + Math.random() * 0.7), Math.sin(a) * r);
      p.life = p.max = life * (0.7 + Math.random() * 0.5);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.gravity = gravity;
      this.particles.push(p);
    }
  }

  splash(pos) {
    this.burst(pos, ['#ffffff', '#bfe9ff', '#7fd0f5'], 22, { speed: 2.2, up: 5, size: 0.14, life: 0.8 });
  }
  sparkle(pos) {
    this.burst(pos, ['#ffe37a', '#f5c518', '#ffffff'], 10, { speed: 1.8, up: 3, size: 0.08, life: 0.45, gravity: 6 });
  }
  dust(pos, color = '#dddddd') {
    this.burst(pos, [color, '#ffffff'], 12, { speed: 3, up: 2.5, size: 0.1, life: 0.5 });
  }

  /** Swoop in from ahead, grab the player, fly off behind the camera. */
  startEagle(player) {
    const p = player.root.position;
    const grab = new THREE.Vector3(p.x, p.y + 1.0, p.z);
    this.eagleAnim = {
      t: 0,
      player,
      from: new THREE.Vector3(p.x + 2, 7, p.z - 16),
      grab,
      to: new THREE.Vector3(p.x - 2, 6, p.z + 18),
      grabbed: false,
    };
    this.eagle.visible = true;
    this.eagle.position.copy(this.eagleAnim.from);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particles.splice(i, 1);
        this.free.push(p);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(p.size * (p.life / p.max));
    }

    const a = this.eagleAnim;
    if (a) {
      a.t += dt;
      const e = this.eagle;
      const T1 = 0.55;
      if (a.t < T1) {
        const k = a.t / T1;
        e.position.lerpVectors(a.from, a.grab, k * k * (3 - 2 * k));
      } else {
        if (!a.grabbed) {
          a.grabbed = true;
          a.player.carrier = e;
        }
        const k = Math.min(1, (a.t - T1) / 1.1);
        e.position.lerpVectors(a.grab, a.to, k * k);
        if (k >= 1) {
          e.visible = false;
          a.player.root.visible = false;
          this.eagleAnim = null;
        }
      }
      const flap = Math.sin(a.t * 16) * 0.7;
      e.userData.wingL.rotation.z = flap;
      e.userData.wingR.rotation.z = -flap;
    }
  }

  reset() {
    for (const p of this.particles) {
      p.mesh.visible = false;
      this.free.push(p);
    }
    this.particles.length = 0;
    this.eagle.visible = false;
    this.eagleAnim = null;
  }
}

function makeEagle() {
  const g = new THREE.Group();
  g.add(box(0.7, 0.45, 1.1, '#6b4a2b'));
  g.add(box(0.48, 0.45, 0.45, '#f4f4f4', 0, 0.2, 0.7));
  g.add(box(0.16, 0.14, 0.24, '#f5b70a', 0, 0.12, 1.02));
  g.add(box(0.07, 0.07, 0.04, '#111', 0.16, 0.3, 0.92, false));
  g.add(box(0.07, 0.07, 0.04, '#111', -0.16, 0.3, 0.92, false));
  g.add(box(0.5, 0.12, 0.5, '#f4f4f4', 0, 0.05, -0.75));
  // talons
  g.add(boxB(0.08, 0.3, 0.08, '#f5b70a', 0.15, -0.5, 0.1));
  g.add(boxB(0.08, 0.3, 0.08, '#f5b70a', -0.15, -0.5, 0.1));
  const wingL = new THREE.Group();
  wingL.position.set(0.35, 0.1, 0);
  wingL.add(box(1.5, 0.1, 0.7, '#553820', 0.75, 0, 0));
  wingL.add(box(0.5, 0.08, 0.5, '#3e2815', 1.6, 0, -0.05));
  const wingR = new THREE.Group();
  wingR.position.set(-0.35, 0.1, 0);
  wingR.add(box(1.5, 0.1, 0.7, '#553820', -0.75, 0, 0));
  wingR.add(box(0.5, 0.08, 0.5, '#3e2815', -1.6, 0, -0.05));
  g.add(wingL, wingR);
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  g.scale.setScalar(1.3);
  return g;
}
