// Test della sfera della Mappa (globo.js): rotazione libera a 360° e proiezione invariata.
// Esecuzione: node --test test/globo.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
globalThis.window = globalThis; createRequire(import.meta.url)("../android/app/src/main/assets/www/globo.js");
const G = globalThis.SBGlobo;
// formula della 1.9.1 (rx, ry con rx limitato a ±1,3): la posa iniziale deve restare identica
const vecchio = (p, v, W, H) => { const cy = Math.cos(v.ry), sy = Math.sin(v.ry), cx = Math.cos(v.rx), sx = Math.sin(v.rx);
  const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx, R = Math.min(W, H) * 0.4 * v.z, k = 1 / (1 - z2 * 0.18);
  return { x: W / 2 + x1 * R * k, y: H / 2 + y2 * R * k, z: z2 }; };
test("la matrice riproduce la proiezione precedente", () => {
  for (let i = 0; i < 100; i++) {
    const rx = Math.sin(i) * 1.2, ry = i * 0.37, p = [Math.cos(i), Math.sin(i * 1.3), Math.cos(i * 0.7)];
    const a = G.punto(p, { m: G.matrice(rx, ry), z: 1.3 }, 390, 600), b = vecchio(p, { rx, ry, z: 1.3 }, 390, 600);
    assert.ok(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-9);
  }
});
test("trascinamento verticale continuo: la sfera passa oltre i poli e torna al punto di partenza dopo un giro completo", () => {
  let m = G.matrice(0, 0); const p = [0, 0, 1], z = [];
  for (let i = 0; i < 360; i++) { m = G.ruota(m, "x", Math.PI / 180); z.push(G.punto(p, { m, z: 1 }, 400, 400).z); }
  assert.ok(Math.min(...z) < -0.99, "il punto davanti passa dietro: nessun blocco a ±75°");
  const fine = G.punto(p, { m, z: 1 }, 400, 400), inizio = G.punto(p, { m: G.matrice(0, 0), z: 1 }, 400, 400);
  assert.ok(Math.abs(fine.x - inizio.x) + Math.abs(fine.y - inizio.y) < 1e-6, "360° = posizione iniziale");
});
test("la matrice resta una rotazione dopo migliaia di passi (ortonormalizzazione)", () => {
  let m = G.matrice(-0.25, 0.6);
  for (let i = 0; i < 20000; i++) { m = G.ruota(G.ruota(m, "y", 0.011), "x", -0.007); if (i % 120 === 0) m = G.ortonormalizza(m); }
  m = G.ortonormalizza(m);
  const riga = (k) => [m[3 * k], m[3 * k + 1], m[3 * k + 2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) assert.ok(Math.abs(dot(riga(a), riga(b)) - (a === b ? 1 : 0)) < 1e-9);
});
