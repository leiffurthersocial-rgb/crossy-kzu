// Small seeded PRNG (mulberry32) with helpers.
export class RNG {
  constructor(seed = 1) {
    this.a = seed >>> 0;
  }
  float() {
    let t = (this.a = (this.a + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.float();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p) {
    return this.float() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.float() * arr.length)];
  }
  /** entries: { key: weight } -> key */
  weighted(entries) {
    let total = 0;
    for (const k in entries) total += Math.max(0, entries[k]);
    let r = this.float() * total;
    for (const k in entries) {
      r -= Math.max(0, entries[k]);
      if (r <= 0) return k;
    }
    return Object.keys(entries)[0];
  }
}
