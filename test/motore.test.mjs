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
const leggiP = (gh, p) => { const t = gh.file("dati", p); return t === undefined ? undefined : JSON.parse(t); };
const leggi = (gh, col, id) => { const t = gh.file("dati", P(col, id)); return t === undefined ? undefined : JSON.parse(t); };

async function base() {
  const s = M.statoVuoto();
  await M.salvaRecord(s, "stanze", "st-1", { nome: "Lavoro", obiettivi: ["A"] });
  await M.salvaRecord(s, "agenti", "ag-1", { nome: "Sviluppatore" });
  await M.salvaRecord(s, "note", "me-pub", { testo: "condivisa", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: true });
  await M.salvaRecord(s, "note", "me-priv", { testo: "privata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z" });
  return s;
}

test("prima sincronizzazione: crea il ramo dati, invia tutto tranne le memorie private", async () => {
  const gh = new FintoGitHub(); const s = await base();
  assert.equal(M.inAttesa(s), 3);
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.ramo_creato, true); assert.equal(e.inviati, 3);
  assert.ok(leggi(gh, "note", "me-pub")); assert.equal(leggi(gh, "note", "me-priv"), undefined);
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
  await M.salvaRecord(s, "note", "me-pub", { testo: "condivisa modificata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: true });
  gh.eliminaDiretto("dati", P("note", "me-pub"));
  const e = await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(e.conflitti_nuovi, 1); assert.equal(s.sync.conflitti["note/me-pub"].tipo, "eliminato_remoto_modificato_locale");
  assert.equal(M.trova(s, "note", "me-pub").testo, "condivisa modificata");
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
  await M.salvaRecord(s, "note", "me-priv", { testo: "privata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: true });
  await M.sincronizza(s, gh.api(), OPZ); assert.ok(leggi(gh, "note", "me-priv"));
  await M.salvaRecord(s, "note", "me-priv", { testo: "privata", tipo: "originale", fonte: "test", data: "2026-11-13T00:00:00.000Z", accessibile_agenti: false });
  await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(leggi(gh, "note", "me-priv"), undefined, "tolta dal repository"); assert.ok(M.trova(s, "note", "me-priv"), "resta sul telefono");
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
  assert.equal(r.versione, 1); assert.equal(r.identico, true); assert.equal(r.hashDopo, r.hashAtteso);
  const esportato = await M.creaBackup(s); assert.equal(esportato.versione, 2); assert.equal(esportato.hash_sha256, r.hashAtteso);
  for (const m of file.dati.memoria) { const { id, ...d } = m; assert.equal(M.canon(M.trova(s, "note", id)), M.canon({ id, ...d }), "memoria " + id + " identica come nota"); }
  assert.equal(M.elenco(s, "note").length, file.dati.memoria.length);
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
  await M.salvaRecord(s, "note", "me-vera", { testo: "vera", stanza_id: "st-vera" });
  await M.salvaRecord(s, "collegamenti", "co-1", { session_id: "session_A", agente_id: "ag-finto", stanza_id: "st-vera" });
  await M.salvaRecord(s, "collegamenti", "co-2", { session_id: "session_B", agente_id: "ag-vero", stanza_id: "st-vera" });
  assert.equal(M.contaFittizi(s), 3);
  const n = await M.eliminaFittizi(s);
  assert.equal(n, 4); // 3 fittizi + 1 collegamento che li usa
  assert.deepEqual(M.trova(s, "stanze", "st-vera").agenti_ids, ["ag-vero"]);
  assert.deepEqual(M.trova(s, "agenti", "ag-vero").skill_ids, []);
  assert.ok(M.trova(s, "note", "me-vera")); assert.ok(M.trova(s, "collegamenti", "co-2")); assert.equal(M.trova(s, "collegamenti", "co-1"), null);
  assert.equal(M.contaFittizi(s), 0);
});

test("caricamento: file principale danneggiato → copia precedente; dati di una versione futura rifiutati", async () => {
  const s = await base(); const buono = JSON.stringify(s);
  const r = M.carica("{rotto", buono); assert.equal(r.origine, "precedente"); assert.ok(M.trova(r.stato, "stanze", "st-1"));
  const futuro = JSON.stringify({ ...s, schema: 99 });
  assert.equal(M.carica(futuro, null).origine, "illeggibile");
});

// ---------- migrazione 1.0 → 1.1 (memorie → note) ----------
function statoV1() {
  const sync = (sha, extra = {}) => ({ sha, base: sha ? "h" : null, sporco: false, eliminato: false, ...extra });
  return { schema: 1, collezioni: {
      agenti: { "ag-1": { dati: { nome: "A" }, sync: sync("s-ag") } }, collegamenti: {}, skill: {}, stanze: { "st-1": { dati: { nome: "S" }, sync: sync("s-st") } },
      memoria: {
        "me-cond": { dati: { testo: "condivisa", tipo: "riassunto", fonte: "chat", data: "2026-11-01T00:00:00.000Z", stanza_id: "st-1", accessibile_agenti: true, registrato_il: "x" }, sync: sync(null) },
        "me-priv": { dati: { testo: "privata", tipo: "dedotto", fonte: "io", data: "2026-11-02T00:00:00.000Z" }, sync: sync(null) },
        "me-falsa": { dati: { testo: "falsa privata", tipo: "originale", fonte: "io", accessibile_agenti: false }, sync: sync(null) },
        "me-via": { dati: { testo: "eliminata", accessibile_agenti: true }, sync: sync(null, { eliminato: true, sporco: true }) },
      } },
    stato_lavoro: [{ id: "istantanea", totale: 0 }], sync: { conflitti: {} } };
}

test("migrazione 1.0: memorie → note identiche, private restano private, nessun duplicato", async () => {
  const v1 = statoV1();
  const { stato, rapporto } = M.migraV1(v1);
  assert.equal(rapporto.ok, true, rapporto.errori.join("; "));
  assert.equal(rapporto.memorie, 3); assert.equal(rapporto.note, 3); assert.equal(rapporto.condivise, 1);
  for (const id of ["me-cond", "me-priv", "me-falsa"]) assert.equal(M.canon(stato.collezioni.note[id].dati), M.canon(v1.collezioni.memoria[id].dati));
  assert.equal(stato.collezioni.note["me-via"], undefined, "una memoria già eliminata non ritorna");
  assert.equal(M.inAttesa(stato), 1, "da inviare solo la nota condivisa");
  assert.equal(M.canon(stato.collezioni.agenti), M.canon(v1.collezioni.agenti));
  assert.equal(stato.schema, 2);
});

test("migrazione: la verifica rileva perdite, contenuti cambiati, duplicati e private rese accessibili", () => {
  const v1 = statoV1();
  const casi = [
    (s) => delete s.collezioni.note["me-priv"],
    (s) => (s.collezioni.note["me-cond"].dati.testo += "!"),
    (s) => (s.collezioni.note["me-copia"] = JSON.parse(JSON.stringify(s.collezioni.note["me-cond"]))),
    (s) => { s.collezioni.note["me-priv"].dati.accessibile_agenti = true; },
    (s) => { s.collezioni.note["me-falsa"].sync.sporco = true; },
  ];
  for (const guasta of casi) { const { stato } = M.migraV1(v1); guasta(stato); assert.equal(M.verificaMigrazione(v1, stato).ok, false, String(guasta)); }
});

test("migrazione con dati già sincronizzati: file spostati da memoria/ a note/, private mai inviate, vecchi file tolti", async () => {
  const gh = new FintoGitHub(); const OPZ1 = OPZ;
  // situazione 1.0 nel repository: una memoria condivisa e un agente
  gh.rami.dati = new Map(gh.rami.main);
  const vecchio = JSON.stringify({ testo: "condivisa", accessibile_agenti: true }, null, 2) + "\n";
  gh.scriviDiretto("dati", "dati/app/memoria/me-cond.json", vecchio);
  const v1 = { schema: 1, collezioni: { agenti: {}, collegamenti: {}, skill: {}, stanze: {},
      memoria: { "me-cond": { dati: { testo: "condivisa", accessibile_agenti: true }, sync: { sha: FintoGitHub.shaBlob(vecchio), base: "h", sporco: false, eliminato: false } },
                 "me-priv": { dati: { testo: "privata" }, sync: { sha: null, base: null, sporco: false, eliminato: false } } } },
    stato_lavoro: [], sync: { conflitti: {} } };
  const c = M.carica(JSON.stringify(v1), null);
  assert.equal(c.migrazione.ok, true); assert.equal(c.migrazione.file_1_0_da_eliminare, 1);
  const s = c.stato;
  await M.sincronizza(s, gh.api(), OPZ1);
  assert.deepEqual(leggiP(gh, "dati/app/note/me-cond.json"), { testo: "condivisa", accessibile_agenti: true });
  assert.equal(gh.file("dati", "dati/app/memoria/me-cond.json"), undefined, "vecchio file rimosso");
  assert.equal(gh.file("dati", "dati/app/note/me-priv.json"), undefined, "privata mai inviata");
  assert.equal(M.inAttesa(s), 0); assert.deepEqual(s.sync.conflitti, {});
  assert.ok(!gh.richieste.some((r) => r.startsWith("DELETE") && !r.includes("/memoria/")), "nessun'altra eliminazione");
});

test("migrazione: vecchio file cambiato nel repository dopo la migrazione → conflitto, nulla sovrascritto", async () => {
  const gh = new FintoGitHub(); gh.rami.dati = new Map(gh.rami.main);
  const vecchio = JSON.stringify({ testo: "v1" }); gh.scriviDiretto("dati", "dati/app/memoria/me-x.json", vecchio);
  const v1 = { schema: 1, collezioni: { agenti: {}, collegamenti: {}, skill: {}, stanze: {},
      memoria: { "me-x": { dati: { testo: "v1", accessibile_agenti: true }, sync: { sha: FintoGitHub.shaBlob(vecchio), base: "h", sporco: false, eliminato: false } } } },
    stato_lavoro: [], sync: { conflitti: {} } };
  const s = M.carica(JSON.stringify(v1), null).stato;
  gh.scriviDiretto("dati", "dati/app/memoria/me-x.json", JSON.stringify({ testo: "cambiato altrove", accessibile_agenti: true }));
  await M.sincronizza(s, gh.api(), OPZ);
  assert.ok(s.sync.conflitti["memoria/me-x"]); assert.ok(gh.file("dati", "dati/app/memoria/me-x.json"), "vecchio file non eliminato");
  await M.risolviConflitto(s, "memoria/me-x", "repository"); await M.sincronizza(s, gh.api(), OPZ);
  assert.equal(leggiP(gh, "dati/app/note/me-x.json").testo, "cambiato altrove"); assert.equal(gh.file("dati", "dati/app/memoria/me-x.json"), undefined);
});

test("backup: la 1.0 si ripristina ancora; la 1.1 esporta versione 2 e la ripristina identica", async () => {
  const file = JSON.parse(readFileSync(new URL("../backup/migrazione-artifact-2026-11-13.json", import.meta.url)));
  const s = M.statoVuoto(); await M.ripristina(s, file);
  await M.salvaRecord(s, "note", "no-nuova", { testo: "nuova", tipo: "originale", fonte: "app", categoria: "risorsa", tag: ["foto"], collegamenti: ["mem-fittizia-vasi"] });
  const b2 = await M.creaBackup(s);
  const s2 = M.statoVuoto(); const r = await M.ripristina(s2, JSON.parse(JSON.stringify(b2)));
  assert.equal(r.versione, 2); assert.equal(r.identico, true); assert.equal(r.hashDopo, b2.hash_sha256);
  await assert.rejects(M.ripristina(M.statoVuoto(), { ...b2, versione: 3 }), /non supportata/);
});

test("relazioni: solo riferimenti esistenti; riferimenti in entrata; pulizia fittizi su note e progetti", async () => {
  const s = M.statoVuoto();
  await M.salvaRecord(s, "stanze", "st-1", { nome: "S" });
  await M.salvaRecord(s, "progetti", "pr-1", { nome: "P", stanza_id: "st-1" });
  await M.salvaRecord(s, "progetti", "pr-f", { nome: "Finto", fittizio: true });
  await M.salvaRecord(s, "note", "n-a", { testo: "A", collegamenti: ["n-b", "n-inesistente"], stanza_id: "st-1", progetto_id: "pr-f" });
  await M.salvaRecord(s, "note", "n-b", { testo: "B", collegamenti: ["n-a"] });
  await M.salvaRecord(s, "note", "n-f", { testo: "F", fittizio: true, collegamenti: ["n-a"] });
  await M.salvaRecord(s, "note", "n-c", { testo: "C", collegamenti: ["n-f"], progetto_id: "pr-1" });
  const tipi = M.relazioni(s).map((r) => [r.da, r.a, r.tipo].join(" ")).sort();
  assert.ok(!tipi.some((t) => t.includes("inesistente")), "nessun arco verso elementi inesistenti");
  assert.equal(M.relazioni(s).filter((r) => r.tipo === "collegamento").length, 3, "A↔B contato una volta, F→A, C→F");
  assert.deepEqual(M.inEntrata(s, "n-a").map((n) => n.id).sort(), ["n-b", "n-f"]);
  await M.eliminaFittizi(s);
  assert.equal(M.trova(s, "note", "n-a").progetto_id, null); assert.deepEqual(M.trova(s, "note", "n-c").collegamenti, []);
  assert.ok(M.trova(s, "progetti", "pr-1")); assert.equal(M.trova(s, "progetti", "pr-f"), null);
});

test("403 alla creazione del ramo: messaggio di GitHub riportato, nessun dato perso", async () => {
  const gh = new FintoGitHub(); const s = M.statoVuoto();
  await M.salvaRecord(s, "stanze", "st-1", { nome: "S" });
  gh.guasto = { tipo: "403", quando: (m) => m === "POST", volte: -1 };
  const orig = gh.gestisci.bind(gh);
  gh.gestisci = async (m, p, c) => (m === "POST" ? { status: 403, corpo: { message: "Resource not accessible by personal access token" } } : orig(m, p, c));
  await assert.rejects(M.sincronizza(s, gh.api(), OPZ), (e) => e.tipo === "permessi" && /Resource not accessible by personal access token/.test(e.message));
  assert.equal(M.inAttesa(s), 1);
});

// ---------- 1.2 ----------
test("[[Titolo]]: collega solo titoli unici ed esistenti, segnala mancanti e ambigui", async () => {
  const s = M.statoVuoto();
  await M.salvaRecord(s, "note", "n1", { titolo: "Trasloco", testo: "x" });
  await M.salvaRecord(s, "note", "n2", { testo: "Spesa settimanale\naltro" });
  await M.salvaRecord(s, "note", "n3", { titolo: "Doppio", testo: "a" });
  await M.salvaRecord(s, "note", "n4", { titolo: "doppio", testo: "b" });
  const r = M.collegamentiDaTesto(s, "Vedi [[trasloco]], [[Spesa settimanale]], [[Doppio]] e [[Inesistente]] e [[trasloco]]", "n9");
  assert.deepEqual(r.ids.sort(), ["n1", "n2"]);
  assert.deepEqual(r.problemi.map((p) => p.titolo + ":" + p.motivo).sort(), ["Doppio:ambiguo", "Inesistente:mancante"]);
  assert.deepEqual(M.collegamentiDaTesto(s, "[[Trasloco]]", "n1").ids, [], "una nota non si collega a sé stessa");
});

test("note simili: trovate per somiglianza, senza unione automatica", async () => {
  const s = M.statoVuoto();
  await M.salvaRecord(s, "note", "a", { testo: "Decisione: usare vasi da 30 cm con sottovaso sul balcone" });
  await M.salvaRecord(s, "note", "b", { testo: "decisione usare i vasi da 30cm con sottovaso sul balcone!" });
  await M.salvaRecord(s, "note", "c", { testo: "Bollette di novembre pagate" });
  const sim = M.noteSimili(s, "a");
  assert.deepEqual(sim.map((x) => x.id), ["b"]); assert.ok(sim[0].punteggio >= 0.6 && sim[0].punteggio <= 1);
  assert.equal(M.gruppiSimili(s), 1); assert.equal(M.elenco(s, "note").length, 3);
});

test("chat di Claude: JSON e ZIP danno lo stesso risultato; note originali, private, con fonte e data; reimportazione senza duplicati", async () => {
  const json = JSON.parse(readFileSync(new URL("./campioni/conversations.json", import.meta.url), "utf8"));
  const zip = new Uint8Array(readFileSync(new URL("./campioni/esportazione-claude.zip", import.meta.url)));
  const daZip = JSON.parse(await M.leggiDaZip(zip, "conversations.json"));
  assert.deepEqual(daZip, json);
  const a = M.analizzaChatClaude(json);
  assert.equal(a.chat.length, 2); assert.equal(a.scartate.length, 2); assert.equal(a.allegatiIgnorati, 1);
  const s = M.statoVuoto(); const e = await M.importaChatClaude(s, a, "2026-11-13T21:00:00.000Z");
  assert.equal(e.importate, 2);
  const n = M.trova(s, "note", "chat-aaaa-1111");
  assert.equal(n.tipo, "originale"); assert.equal(n.accessibile_agenti, false); assert.equal(n.data, "2026-10-01T10:00:00Z"); assert.match(n.fonte, /Piano trasloco/);
  assert.match(n.testo, /Tu \(2026-10-01 10:00\):\nCome organizzo/); assert.match(n.testo, /Claude .*:\nParti da una checklist/);
  assert.match(M.trova(s, "note", "chat-bbbb-2222").testo, /àèì €/);
  assert.equal(M.inAttesa(s), 0, "le chat importate sono private: niente da inviare");
  await M.salvaRecord(s, "note", "chat-aaaa-1111", { ...n, id: undefined, testo: n.testo + "\nmia aggiunta" });
  const a2 = M.analizzaChatClaude(json); a2.chat[0].aggiornata = "2026-12-01T00:00:00Z";
  const e2 = await M.importaChatClaude(s, a2, "2026-11-14T00:00:00.000Z");
  assert.deepEqual(e2, { importate: 0, gia_presenti: 2, piu_recenti_non_sovrascritte: 1 });
  assert.match(M.trova(s, "note", "chat-aaaa-1111").testo, /mia aggiunta/, "modifica dell'utente non sovrascritta");
  assert.throws(() => M.analizzaChatClaude({ non: "elenco" }), /elenco di conversazioni/);
  await assert.rejects(M.leggiDaZip(zip, "manca.json"), /non c'è manca.json/);
});
