export const LANES = [-3.15, 0, 3.15];
export const GRAVITY = 25;
export const JUMP_SPEED = 10.8;
export function speedAt(distance) { return Math.min(24, 12 + distance / 240); }
export function scoreFor(distance, shards) { return Math.floor(distance * 2 + shards * 50); }
export function isOnRoof(segments, travelled, z = 0) {
  return segments.some(s => Math.abs(s.z + travelled - z) <= s.length / 2 + .08);
}
export function hitsObstacle(x, y, z, obstacle) {
  return Math.abs(x - obstacle.x) < 1.1 && Math.abs(z - obstacle.z) < 1.1 && y < obstacle.height - .08;
}
export function safeStored(storage, key, fallback) {
  try { return storage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function safeSave(storage, key, value) {
  try { storage.setItem(key, String(value)); } catch { /* Private browsing can disable storage. */ }
}
