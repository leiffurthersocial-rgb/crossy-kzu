import * as THREE from 'three';

// Procedural pixel-art textures painted on small canvases at startup.
// Nearest-neighbour filtering keeps them crisp and blocky, matching the voxels.
// No image files are loaded.

const PX = 16; // texels per tile

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shadeHex(hex, f) {
  const c = new THREE.Color(hex);
  if (f >= 1) c.lerp(new THREE.Color('#ffffff'), f - 1);
  else c.multiplyScalar(f);
  return '#' + c.getHexString();
}

function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function speckle(g, w, h, r, colors, density) {
  const n = Math.floor(w * h * density);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
  }
}

/** Ground for grass-like lanes: base colour, speckles, tufts and a few flowers. */
export function groundTexture(base, flowers, seed = 1, tufts = true) {
  // 4 tiles wide so the repeat pattern is less obvious
  const t = canvasTexture(PX * 4, PX, (g, w, h) => {
    const r = rand(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, [shadeHex(base, 0.9), shadeHex(base, 1.08)], 0.22);
    if (tufts) {
      g.fillStyle = shadeHex(base, 0.82);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(r() * (w - 2));
        const y = Math.floor(r() * (h - 2)) + 1;
        g.fillRect(x, y, 1, 1);
        g.fillRect(x + 1, y - 1, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
      }
    }
    for (let i = 0; i < flowers.length * 3; i++) {
      const f = flowers[i % flowers.length];
      if (r() < 0.5) continue;
      const x = Math.floor(r() * (w - 2));
      const y = Math.floor(r() * (h - 2));
      g.fillStyle = f;
      g.fillRect(x, y, 2, 2);
      g.fillStyle = '#ffe680';
      g.fillRect(x, y, 1, 1);
    }
  });
  t.userData.tiles = 4;
  return t;
}

export function asphaltTexture() {
  return canvasTexture(PX, PX, (g, w, h) => {
    const r = rand(7);
    g.fillStyle = '#545760';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, ['#4b4e56', '#5d6069', '#62656e'], 0.35);
    // tyre tracks, slightly darker
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect(0, 3, w, 2);
    g.fillRect(0, 11, w, 2);
  });
}

export function gravelTexture() {
  return canvasTexture(PX, PX, (g, w, h) => {
    const r = rand(11);
    g.fillStyle = '#9a8e83';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, ['#857a70', '#b0a499', '#7a7066', '#c2b8ad'], 0.55);
  });
}

export function waterTexture() {
  return canvasTexture(PX * 2, PX, (g, w, h) => {
    const r = rand(3);
    g.fillStyle = '#5cc3f2';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, ['#55badf', '#63c9f5'], 0.25);
    g.fillStyle = '#9fe0fb';
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(r() * (w - 5));
      const y = Math.floor(r() * h);
      g.fillRect(x, y, 3 + Math.floor(r() * 3), 1);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(Math.floor(r() * (w - 2)), Math.floor(r() * h), 2, 1);
  });
}

/** Bark: streaks run along U (the log's length). */
export function barkTexture() {
  return canvasTexture(PX, PX, (g, w, h) => {
    const r = rand(5);
    g.fillStyle = '#8b5a2b';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = r() < 0.5 ? '#7a4d22' : '#9a6834';
      g.fillRect(0, y, w, 1);
    }
    speckle(g, w, h, r, ['#6e4420', '#a5733e'], 0.12);
  });
}

/** Foliage / leaves: base with highlight and shadow clusters. Tinted by material colour. */
export function leafTexture() {
  return canvasTexture(8, 8, (g, w, h) => {
    const r = rand(9);
    g.fillStyle = '#d9d9d9';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, ['#ffffff', '#f0f0f0'], 0.25);
    speckle(g, w, h, r, ['#b4b4b4', '#c4c4c4'], 0.25);
  });
}

/** Generic subtle noise, tinted by material colour (rocks, sleepers, sand...). */
export function noiseTexture(seed = 13) {
  return canvasTexture(8, 8, (g, w, h) => {
    const r = rand(seed);
    g.fillStyle = '#e6e6e6';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, ['#ffffff', '#d2d2d2', '#c8c8c8'], 0.45);
  });
}

/** Soft vertical gradient used as the character-select backdrop. */
export function gradientTexture(top, bottom) {
  const cv = document.createElement('canvas');
  cv.width = 2;
  cv.height = 256;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- material helpers --------------------------------------------------------
const texMatCache = new Map();

/**
 * Lambert material using `tex` repeated `rx` x `ry` times, tinted by `color`.
 * Clones share the same image source, so the GPU upload happens once.
 */
export function texMat(key, tex, rx = 1, ry = 1, color = '#ffffff') {
  const k = `${key}|${rx}|${ry}|${color}`;
  let m = texMatCache.get(k);
  if (!m) {
    const t = tex.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    m = new THREE.MeshLambertMaterial({ map: t, color });
    texMatCache.set(k, m);
  }
  return m;
}
