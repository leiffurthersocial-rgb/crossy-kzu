// Thin localStorage wrapper that never throws (private mode, blocked storage...).
const PREFIX = 'crossykzu.';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const storage = {
  get best() { return read('best', 0); },
  set best(v) { write('best', v); },
  get coins() { return read('coins', 0); },
  set coins(v) { write('coins', v); },
  get unlocked() { return read('unlocked', ['robin']); },
  set unlocked(v) { write('unlocked', v); },
  get selected() { return read('selected', 'robin'); },
  set selected(v) { write('selected', v); },
  get muted() { return read('muted', false); },
  set muted(v) { write('muted', v); },
};
