import * as THREE from 'three';

// Every visible object is built from this one shared unit cube.
export const BOX = new THREE.BoxGeometry(1, 1, 1);

const matCache = new Map();
export function mat(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

/** Box centred at (x, y, z). */
export function box(w, h, d, color, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(BOX, typeof color === 'object' ? color : mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = false;
  return m;
}

/** Box whose bottom face sits at yBottom. */
export function boxB(w, h, d, color, x = 0, yBottom = 0, z = 0, cast = true) {
  return box(w, h, d, color, x, yBottom + h / 2, z, cast);
}

export class Pool {
  constructor(factory) {
    this.factory = factory;
    this.free = [];
  }
  get() {
    const o = this.free.pop() || this.factory();
    o.visible = true;
    return o;
  }
  release(o) {
    o.visible = false;
    if (o.parent) o.parent.remove(o);
    this.free.push(o);
  }
}
