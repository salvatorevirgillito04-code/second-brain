#!/usr/bin/env node
// Prepara i documenti che "aggiorna stato" salva nell'archivio dell'artifact.
// Riduce la risposta di list_sessions ai soli campi che servono al pannello delle esecuzioni.
//
// Uso:
//   node strumenti/istantanea.mjs ok <risposta_list_sessions.json> <rilevato_il ISO> <id_sessione_rilevatrice> <cartella_uscita>
//        scrive <cartella_uscita>/istantanea.json e <cartella_uscita>/ultimo_tentativo.json
//        Se la risposta non è valida termina con errore e NON scrive l'istantanea.
//   node strumenti/istantanea.mjs errore "<messaggio>" <cartella_uscita>
//        scrive solo <cartella_uscita>/ultimo_tentativo.json (l'istantanea precedente resta intatta)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CAMPI = ["id", "title", "session_status", "status_bucket", "origin", "created_at", "updated_at"];
const ID = /^session_[A-Za-z0-9]+$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function riduci(risposta, rilevatoIl, rilevatore) {
  const corpo = risposta && risposta.ccr ? risposta.ccr : risposta;
  if (!corpo || !Array.isArray(corpo.data)) throw new Error("Risposta di list_sessions senza elenco 'data'.");
  if (!ISO.test(rilevatoIl)) throw new Error("Data di rilevazione non valida: " + rilevatoIl);
  if (!ID.test(rilevatore)) throw new Error("Identificativo della sessione rilevatrice non valido: " + rilevatore);
  const sessioni = corpo.data.map((s, i) => {
    if (!s || !ID.test(s.id || "")) throw new Error(`Sessione ${i}: identificativo mancante o non valido.`);
    if (typeof s.status_bucket !== "string" || typeof s.session_status !== "string") throw new Error(`Sessione ${s.id}: stato mancante.`);
    const r = {};
    for (const k of CAMPI) if (s[k] !== undefined && s[k] !== null) r[k === "title" ? "titolo" : k] = String(s[k]).slice(0, 200);
    if (s.id === rilevatore) r.rilevatore = true;
    return r;
  });
  return {
    formato: "istantanea-lavoro",
    versione: 1,
    rilevato_il: rilevatoIl,
    fonte: "Claude Code su richiesta («aggiorna stato»), strumento list_sessions",
    rilevatore_session_id: rilevatore,
    troncato: !!corpo.has_more,
    totale: sessioni.length,
    sessioni,
  };
}

const [cmd, ...a] = process.argv.slice(2);
if (cmd === "ok") {
  const [file, rilevatoIl, rilevatore, out] = a;
  const ist = riduci(JSON.parse(readFileSync(file, "utf8")), rilevatoIl, rilevatore);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "istantanea.json"), JSON.stringify(ist));
  writeFileSync(join(out, "ultimo_tentativo.json"), JSON.stringify({ quando: rilevatoIl, esito: "ok", messaggio: `Lette ${ist.totale} sessioni${ist.troncato ? " (elenco troncato)" : ""}.` }));
  console.log(`istantanea pronta: ${ist.totale} sessioni, troncato=${ist.troncato}, ${Buffer.byteLength(JSON.stringify(ist))} byte`);
} else if (cmd === "errore") {
  const [messaggio, out] = a;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "ultimo_tentativo.json"), JSON.stringify({ quando: new Date().toISOString(), esito: "errore", messaggio: String(messaggio || "errore sconosciuto").slice(0, 500) }));
  console.log("tentativo fallito registrato; istantanea precedente non toccata");
} else {
  console.error("Comandi: ok | errore");
  process.exit(2);
}
