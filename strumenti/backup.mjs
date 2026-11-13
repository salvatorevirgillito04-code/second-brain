#!/usr/bin/env node
// Strumento di backup per il prototipo Second Brain.
// Usa la stessa forma canonica e la stessa impronta SHA-256 della pagina (prototipo/index.html),
// così un backup fatto dalla pagina e uno fatto da Claude Code sono confrontabili.
//
// Uso:
//   node strumenti/backup.mjs componi  <cartella_export> <backup.json>
//        <cartella_export> contiene stanze/*.json e memoria/*.json (output di ArtifactData list con out_dir)
//   node strumenti/backup.mjs scomponi <backup.json> <cartella_destinazione>
//        scrive un file JSON per documento, da reinviare con ArtifactData (file_path)
//   node strumenti/backup.mjs impronta <backup.json | cartella_export>
//        stampa l'impronta SHA-256 dei soli dati
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";

// Stesso elenco della pagina (app/index.html → COLLEZIONI)
const COLLEZIONI = ["agenti", "collegamenti", "memoria", "skill", "stanze", "stato_lavoro"];

export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export const impronta = (dati) => createHash("sha256").update(canon(dati), "utf8").digest("hex");

function leggiCartella(dir) {
  const dati = {};
  for (const col of COLLEZIONI) {
    const p = join(dir, col);
    const righe = existsSync(p)
      ? readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => ({ id: basename(f, ".json"), ...JSON.parse(readFileSync(join(p, f), "utf8")) }))
      : [];
    righe.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    dati[col] = righe;
  }
  return dati;
}
function leggiDati(percorso) {
  if (statSync(percorso).isDirectory()) return leggiCartella(percorso);
  const f = JSON.parse(readFileSync(percorso, "utf8"));
  if (f.formato !== "second-brain-backup") throw new Error("Non è un backup di Second Brain: " + percorso);
  return f.dati;
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "componi") {
  const dati = leggiCartella(a);
  const file = { formato: "second-brain-backup", versione: 1, esportato_il: new Date().toISOString(), hash_sha256: impronta(dati), dati };
  writeFileSync(b, JSON.stringify(file, null, 2) + "\n");
  console.log(`backup scritto: ${b}\n` + COLLEZIONI.map((c) => `${c}=${dati[c].length}`).join(" ") + `\nsha256=${file.hash_sha256}`);
} else if (cmd === "scomponi") {
  const f = JSON.parse(readFileSync(a, "utf8"));
  if (f.hash_sha256 !== impronta(f.dati)) throw new Error("Impronta non valida: il file è stato alterato.");
  for (const col of COLLEZIONI) {
    mkdirSync(join(b, col), { recursive: true });
    for (const { id, ...resto } of f.dati[col] || []) writeFileSync(join(b, col, id + ".json"), JSON.stringify(resto));
  }
  console.log(`documenti scritti in ${b} (impronta verificata ${f.hash_sha256})`);
} else if (cmd === "impronta") {
  console.log(impronta(leggiDati(a)));
} else {
  console.error("Comandi: componi | scomponi | impronta");
  process.exit(2);
}
