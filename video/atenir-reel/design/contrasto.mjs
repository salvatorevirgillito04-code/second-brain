// Verifica WCAG 2.x dei colori di tokens.css. Uso: node contrasto.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("tokens.css", import.meta.url)), "utf8");
const pal = {};
for (const m of css.matchAll(/--at-([a-z]+):\s*(#[0-9A-Fa-f]{6})\b/g)) pal[m[1]] = m[2];

const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const verdict = (r) => (r >= 4.5 ? "AA" : r >= 3 ? "AA-grande" : "NO");

const testi = ["ink", "white", "cream"];
const sfondi = ["red", "orange", "yellow", "green", "blue", "indigo", "violet", "cream", "white", "ink"];
console.log("Sfondo  | " + testi.map((t) => t.padEnd(16)).join(""));
for (const s of sfondi) {
  console.log(s.padEnd(7) + " | " + testi.map((t) => {
    if (t === s) return "-".padEnd(16);
    const r = ratio(pal[s], pal[t]);
    return `${r.toFixed(2)} ${verdict(r)}`.padEnd(16);
  }).join(""));
}

console.log("\nLogo: lettere colorate su ink e su cream");
const logo = [["A", "red"], ["t", "orange"], ["e", "yellow"], ["n", "green"], ["i", "blue"], ["r", "violet"]];
for (const [l, c] of logo) {
  const a = ratio(pal[c], pal.ink), b = ratio(pal[c], pal.cream);
  console.log(`${l} ${c.padEnd(7)} su ink ${a.toFixed(2)} ${verdict(a).padEnd(10)} su cream ${b.toFixed(2)} ${verdict(b)}`);
}
