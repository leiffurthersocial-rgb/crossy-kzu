// Keyboard + touch input. Emits direction strings: 'up' | 'down' | 'left' | 'right'.
const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export class Input {
  constructor({ onDir, onKey, onGesture }) {
    this.onDir = onDir;
    this.onKey = onKey;
    this.onGesture = onGesture;
    this.touch = null;

    window.addEventListener('keydown', (e) => {
      const dir = KEYS[e.code];
      if (dir) {
        e.preventDefault();
        if (!e.repeat) this.onDir(dir);
        return;
      }
      this.onKey(e.code, e);
    });

    const isUI = (t) => t && t.closest && t.closest('button, .screen-panel');

    window.addEventListener(
      'touchstart',
      (e) => {
        this.onGesture();
        if (isUI(e.target)) return;
        const t = e.changedTouches[0];
        this.touch = { x: t.clientX, y: t.clientY, time: performance.now(), id: t.identifier, fired: false };
        e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener(
      'touchmove',
      (e) => {
        if (!this.touch) return;
        e.preventDefault();
        // fire swipes as soon as they're clear, without waiting for touchend
        for (const t of e.changedTouches) {
          if (t.identifier !== this.touch.id || this.touch.fired) continue;
          const dir = this.swipeDir(t.clientX - this.touch.x, t.clientY - this.touch.y, 40);
          if (dir) {
            this.touch.fired = true;
            this.onDir(dir);
          }
        }
      },
      { passive: false },
    );
    window.addEventListener('touchend', (e) => {
      if (!this.touch) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this.touch.id) continue;
        if (!this.touch.fired) {
          const dx = t.clientX - this.touch.x;
          const dy = t.clientY - this.touch.y;
          this.onDir(this.swipeDir(dx, dy, 18) || 'up'); // a tap hops forward
        }
        this.touch = null;
      }
    });
    window.addEventListener('touchcancel', () => (this.touch = null));
    window.addEventListener('pointerdown', () => this.onGesture());
  }

  swipeDir(dx, dy, min) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }
}
