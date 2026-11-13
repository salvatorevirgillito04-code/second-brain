// Test del motore dati/sincronizzazione contro un GitHub simulato in memoria.
// Esecuzione: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { FintoGitHub } from "./finto-github.mjs";
const M = createRequire(import.meta.url)("../android/app/src/main/assets/www/motore.js");

const OPZ = { owner: "utente", repo: "second-brain" };
const P = (col, id) => `dati/app/${col}/${id}.json`;
const leggi = (gh, col, id) => { const t = gh.file("dati", P(col, id)); return t === undefined ? undefined : JSON.parse(t); };

async function base() {
  const s = M.statoVuoto();
  await M.salvaRecord(s, "stanze", "st-1", { nome: "Lavoro", obiettivi: ["A"] });
  await M.salvaRecord(s, "agenti", "ag-1", { nome: "Sviluppatore" });
  await M.salvaRecord(s, "memoria", "me-pub", { testo: "condivisa", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: true });
  await M.salvaRecord(s, "memoria", "me-priv", { testo: "privata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z" });
  return s;
}

test("prima sincronizzazione: crea il ramo dati, invia tutto tranne le memorie private", async () => {
  const gh = new FintoGitHub(); const s = await base();
  assert.equal(M.inAttesa(s), 3);
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.ramo_creato, true); assert.equal(e.inviati, 3);
  assert.ok(leggi(gh, "memoria", "me-pub")); assert.equal(leggi(gh, "memoria", "me-priv"), undefined);
  assert.equal(M.inAttesa(s), 0); assert.ok(s.sync.ultimo_ok); assert.equal(s.sync.errore, null);
  assert.equal(gh.file("main", P("stanze", "st-1")), undefined, "il ramo principale non viene toccato");
});

test("modifica fatta altrove con telefono invariato: viene scaricata", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  gh.scriviDiretto("dati", P("stanze", "st-1"), JSON.stringify({ nome: "Lavoro (rinominata altrove)", obiettivi: ["A"] }));
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.ricevuti, 1); assert.equal(M.trova(s, "stanze", "st-1").nome, "Lavoro (rinominata altrove)");
});

test("modifiche concorrenti: conflitto, nessuna sovrascrittura silenziosa, poi risoluzione esplicita", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  gh.scriviDiretto("dati", P("stanze", "st-1"), JSON.stringify({ nome: "Versione repository", obiettivi: ["A"] }));
  await M.salvaRecord(s, "stanze", "st-1", { nome: "Versione telefono", obiettivi: ["A"] });
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.conflitti_nuovi, 1);
  assert.equal(leggi(gh, "stanze", "st-1").nome, "Versione repository", "il repository non è stato sovrascritto");
  assert.equal(M.trova(s, "stanze", "st-1").nome, "Versione telefono", "il telefono non è stato sovrascritto");
  const k = s.sync.conflitti["stanze/st-1"]; assert.equal(k.tipo, "modificato_entrambi"); assert.equal(k.remoto.nome, "Versione repository");
  await M.sincronizza(s, gh.api(), OPZ); // un nuovo tentativo non risolve da solo
  assert.equal(leggi(gh, "stanze", "st-1").nome, "Versione repository");
  await M.risolviConflitto(s, "stanze/st-1", "telefono");
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(leggi(gh, "stanze", "st-1").nome, "Versione telefono"); assert.equal(M.inAttesa(s), 0);
});

test("conflitto risolto tenendo la versione del repository", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  gh.scriviDiretto("dati", P("agenti", "ag-1"), JSON.stringify({ nome: "Remoto" }));
  await M.salvaRecord(s, "agenti", "ag-1", { nome: "Locale" });
  await M.sincronizza(s, gh.api(), OPZ);
  await M.risolviConflitto(s, "agenti/ag-1", "repository");
  assert.equal(M.trova(s, "agenti", "ag-1").nome, "Remoto"); assert.equal(M.inAttesa(s), 0);
  await M.sincronizza(s, gh.api(), OPZ); assert.equal(leggi(gh, "agenti", "ag-1").nome, "Remoto");
});

test("se nel frattempo il repository cambia di nuovo, la scelta 'telefono' genera un nuovo conflitto", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  gh.scriviDiretto("dati", P("agenti", "ag-1"), JSON.stringify({ nome: "R1" }));
  await M.salvaRecord(s, "agenti", "ag-1", { nome: "L1" }); await M.sincronizza(s, gh.api(), OPZ);
  await M.risolviConflitto(s, "agenti/ag-1", "telefono");
  gh.scriviDiretto("dati", P("agenti", "ag-1"), JSON.stringify({ nome: "R2" }));
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.conflitti_nuovi, 1); assert.equal(leggi(gh, "agenti", "ag-1").nome, "R2");
});

test("cancellazioni: locale propagata; remota con telefono invariato applicata; remota con modifica locale = conflitto", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  M.eliminaRecord(s, "agenti", "ag-1"); assert.equal(M.inAttesa(s), 1);
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(leggi(gh, "agenti", "ag-1"), undefined); assert.equal(s.collezioni.agenti["ag-1"], undefined);
  gh.eliminaDiretto("dati", P("stanze", "st-1"));
  await M.sincronizza(s, gh.api(), OPZ); assert.equal(M.trova(s, "stanze", "st-1"), null);
  await M.salvaRecord(s, "memoria", "me-pub", { testo: "condivisa modificata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: true });
  gh.eliminaDiretto("dati", P("memoria", "me-pub"));
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.conflitti_nuovi, 1); assert.equal(s.sync.conflitti["memoria/me-pub"].tipo, "eliminato_remoto_modificato_locale");
  assert.equal(M.trova(s, "memoria", "me-pub").testo, "condivisa modificata");
});

test("cancellazione locale di un dato modificato nel repository: conflitto, il file remoto resta", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  gh.scriviDiretto("dati", P("agenti", "ag-1"), JSON.stringify({ nome: "Aggiornato altrove" }));
  M.eliminaRecord(s, "agenti", "ag-1");
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.conflitti_nuovi, 1); assert.equal(leggi(gh, "agenti", "ag-1").nome, "Aggiornato altrove");
});

test("tentativi ripetuti: invio applicato ma risposta persa → nessun duplicato né conflitto", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  await M.salvaRecord(s, "stanze", "st-1", { nome: "Dopo", obiettivi: ["A"] });
  gh.guasto = { tipo: "perdi_risposta", quando: (m) => m === "PUT", volte: 1 };
  await assert.rejects(M.sincronizza(s, gh.api(), OPZ), (e) => e.tipo === "rete");
  assert.equal(leggi(gh, "stanze", "st-1").nome, "Dopo"); assert.equal(M.inAttesa(s), 1);
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.conflitti_nuovi, 0); assert.equal(M.inAttesa(s), 0); assert.deepEqual(s.sync.conflitti, {});
  M.eliminaRecord(s, "stanze", "st-1");
  gh.guasto = { tipo: "perdi_risposta", quando: (m) => m === "DELETE", volte: 1 };
  await assert.rejects(M.sincronizza(s, gh.api(), OPZ));
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(s.collezioni.stanze["st-1"], undefined); assert.equal(M.inAttesa(s), 0);
});

test("rete assente: errore registrato, dati e modifiche in attesa intatti", async () => {
  const gh = new FintoGitHub(); const s = await base();
  gh.guasto = { tipo: "rete", quando: () => true, volte: -1 };
  const prima = await M.impronta(M.datiPuliti(s));
  await assert.rejects(M.sincronizza(s, gh.api(), OPZ), (e) => e.tipo === "rete");
  assert.equal(s.sync.errore.tipo, "rete"); assert.match(s.sync.errore.messaggio, /Rete assente/);
  assert.equal(M.inAttesa(s), 3); assert.equal(await M.impronta(M.datiPuliti(s)), prima);
  gh.guasto = null; await M.sincronizza(s, gh.api(), OPZ); assert.equal(s.sync.errore, null); assert.equal(M.inAttesa(s), 0);
});

test("token scaduto (401): messaggio di accesso scaduto, nessun dato perso", async () => {
  const gh = new FintoGitHub(); const s = await base();
  gh.guasto = { tipo: "401", quando: () => true, volte: -1 };
  await assert.rejects(M.sincronizza(s, gh.api(), OPZ), (e) => e.tipo === "accesso");
  assert.match(s.sync.errore.messaggio, /scaduto o revocato/); assert.equal(M.inAttesa(s), 3);
});

test("memorie: scegliere se renderle accessibili agli agenti", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  await M.salvaRecord(s, "memoria", "me-priv", { testo: "privata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: true });
  await M.sincronizza(s, gh.api(), OPZ); assert.ok(leggi(gh, "memoria", "me-priv"));
  await M.salvaRecord(s, "memoria", "me-priv", { testo: "privata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: false });
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(leggi(gh, "memoria", "me-priv"), undefined, "tolta dal repository"); assert.ok(M.trova(s, "memoria", "me-priv"), "resta sul telefono");
  assert.equal(M.inAttesa(s), 0);
});

test("istantanea di Claude Code: scaricata in sola lettura, mai inviata dall'app", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  gh.scriviDiretto("dati", "dati/stato/istantanea.json", JSON.stringify({ rilevato_il: "2026-11-13T16:05:34Z", totale: 1, sessioni: [{ id: "session_X", status_bucket: "SESSION_STATUS_BUCKET_WORKING" }] }));
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(s.stato_lavoro.find((x) => x.id === "istantanea").totale, 1); assert.ok(s.sync.istantanea_scaricata_il);
  await assert.rejects(M.salvaRecord(s, "stato_lavoro", "istantanea", {}), /non modificabile/);
  assert.ok(!gh.richieste.some((r) => /^(PUT|DELETE) .*dati\/stato\//.test(r)), "nessuna scrittura sull'istantanea");
});

test("migrazione dal backup dell'artifact: contenuto identico, impronta verificata; file alterato rifiutato", async () => {
  const file = JSON.parse(readFileSync(new URL("../backup/migrazione-artifact-2026-11-13.json", import.meta.url)));
  const s = M.statoVuoto();
  const r = await M.ripristina(s, file);
  assert.equal(r.identico, true); assert.equal(r.hashDopo, file.hash_sha256);
  const esportato = await M.creaBackup(s); assert.equal(esportato.hash_sha256, file.hash_sha256);
  const alterato = JSON.parse(JSON.stringify(file)); alterato.dati.memoria[0].testo += "!";
  await assert.rejects(M.ripristina(M.statoVuoto(), alterato), /impronta non corrisponde/);
});

test("ripristino su dati già sincronizzati: le differenze diventano da inviare, nessuna perdita silenziosa", async () => {
  const gh = new FintoGitHub(); const s = await base(); await M.sincronizza(s, gh.api(), OPZ);
  const bk = await M.creaBackup(s);
  await M.salvaRecord(s, "stanze", "st-1", { nome: "Dopo il backup", obiettivi: [] });
  await M.salvaRecord(s, "skill", "sk-nuova", { nome: "Nuova" });
  const r = await M.ripristina(s, bk); assert.equal(r.identico, true);
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(leggi(gh, "stanze", "st-1").nome, "Lavoro");
});

test("dati fittizi: eliminati separatamente, quelli reali restano identici", async () => {
  const s = M.statoVuoto();
  await M.salvaRecord(s, "stanze", "st-vera", { nome: "Vera", agenti_ids: ["ag-finto", "ag-vero"] });
  await M.salvaRecord(s, "agenti", "ag-vero", { nome: "Vero", skill_ids: ["sk-finta"] });
  await M.salvaRecord(s, "agenti", "ag-finto", { nome: "Finto", fittizio: true });
  await M.salvaRecord(s, "skill", "sk-finta", { nome: "Finta", fittizio: true });
  await M.salvaRecord(s, "stanze", "st-finta", { nome: "Finta", fittizio: true });
  await M.salvaRecord(s, "memoria", "me-vera", { testo: "vera", stanza_id: "st-vera" });
  await M.salvaRecord(s, "collegamenti", "co-1", { session_id: "session_A", agente_id: "ag-finto", stanza_id: "st-vera" });
  await M.salvaRecord(s, "collegamenti", "co-2", { session_id: "session_B", agente_id: "ag-vero", stanza_id: "st-vera" });
  assert.equal(M.contaFittizi(s), 3);
  const n = await M.eliminaFittizi(s);
  assert.equal(n, 4); // 3 fittizi + 1 collegamento che li usa
  assert.deepEqual(M.trova(s, "stanze", "st-vera").agenti_ids, ["ag-vero"]);
  assert.deepEqual(M.trova(s, "agenti", "ag-vero").skill_ids, []);
  assert.ok(M.trova(s, "memoria", "me-vera")); assert.ok(M.trova(s, "collegamenti", "co-2")); assert.equal(M.trova(s, "collegamenti", "co-1"), null);
  assert.equal(M.contaFittizi(s), 0);
});

test("caricamento: file principale danneggiato → copia precedente; dati di una versione futura rifiutati", async () => {
  const s = await base(); const buono = JSON.stringify(s);
  const r = M.carica("{rotto", buono); assert.equal(r.origine, "precedente"); assert.ok(M.trova(r.stato, "stanze", "st-1"));
  const futuro = JSON.stringify({ ...s, schema: 99 });
  assert.equal(M.carica(futuro, null).origine, "illeggibile");
});
