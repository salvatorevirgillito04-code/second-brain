// Prova dell'interfaccia (assets/www) in Chromium con un ponte Android SIMULATO e GitHub SIMULATO.
// Verifica la logica della pagina, non il comportamento reale di Android.
// Esecuzione: node test/interfaccia.test.mjs [cartella_screenshot]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FintoGitHub } from "./finto-github.mjs";
const M = createRequire(import.meta.url)("../android/app/src/main/assets/www/motore.js");
const { chromium } = createRequire(import.meta.url)("playwright");
const QUI = dirname(fileURLToPath(import.meta.url));
const WWW = join(QUI, "../android/app/src/main/assets/www");
const BACKUP = readFileSync(join(QUI, "../backup/migrazione-artifact-2026-11-13.json"), "utf8");
const FOTO = process.argv[2];
const ATTESO = await M.impronta(M.datiV1aV2(JSON.parse(BACKUP).dati)); // stessa forma 1.1: memorie → note
const gh = new FintoGitHub("salvatorevirgillito04-code", "second-brain");
let fallite = 0;
const ok = (cond, nome) => { console.log((cond ? "ok   " : "FAIL ") + nome); if (!cond) fallite++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errori = []; page.on("pageerror", (e) => errori.push(e.message));
let rete = true; const salvataggi = [];
await ctx.exposeFunction("__nodeGithub", async (id, m, p, c) => {
  const r = rete ? await gh.gestisci(m, p, c ? JSON.parse(c) : null) : { status: 0, corpo: null };
  return [id, r.status, r.corpo == null ? "" : JSON.stringify(r.corpo)];
});
await ctx.exposeFunction("__nodeRete", () => rete);
await ctx.exposeFunction("__nodeSalvato", (t) => { salvataggi.push(t); });
await ctx.route("https://app.test/**", (route) => {
  const nome = new URL(route.request().url()).pathname.slice(1) || "index.html";
  route.fulfill({ body: readFileSync(join(WWW, nome)), contentType: nome.endsWith(".js") ? "text/javascript" : "text/html" });
});
await ctx.addInitScript(() => {
  const mem = { dati: window.__datiIniziali || "", prec: "", token: false, esportato: null, copie: {} };
  window.__mem = mem;
  window.Android = {
    caricaDati: () => mem.dati || window.__datiIniziali || "", caricaDatiPrecedenti: () => mem.prec,
    salvaCopia: (n, t) => (mem.copie[n] ? "esiste" : ((mem.copie[n] = t), "ok")), salvaDati: (t) => { mem.prec = mem.dati; mem.dati = t; window.__nodeSalvato(t); return "ok"; },
    haToken: () => mem.token, impostaToken: (t) => (t.startsWith("github_pat_") ? ((mem.token = true), "ok") : "Usa un token a grana fine"), rimuoviToken: () => { mem.token = false; },
    retePresente: () => window.__rete !== false,
    github: (id, m, p, c) => { window.__nodeGithub(id, m, p, c).then(([i, s, b]) => window.__risposta(i, s, b)); },
    esporta: (nome, testo, msg) => { mem.esportato = testo; setTimeout(() => window.__esportato(true, msg), 10); },
    importa: () => setTimeout(() => window.__importato(true, window.__fileDaImportare), 10),
    infoApp: () => JSON.stringify({ versione: "test", codice: 0 }), apriLink: () => {},
  };
});
const testo = (s) => page.textContent(s);

await page.goto("https://app.test/index.html#dati");
await page.waitForTimeout(300);
ok((await testo("#avvisi")).includes("Nessun dato sul telefono"), "primo avvio: invito a importare il backup");
ok((await testo("#chip-sync")).includes("solo telefono"), "senza token: indicato 'solo telefono'");

// MIGRAZIONE
await page.evaluate((b) => { window.__fileDaImportare = b; }, BACKUP);
await page.click("#b-imp"); await page.waitForTimeout(200);
ok((await testo("#imp-preview")).includes("verificata"), "migrazione: impronta del file verificata prima di importare");
await page.click("#b-imp-ok"); await page.waitForTimeout(400);
const msgImp = await testo("#imp-status");
ok(msgImp.includes("Importazione verificata") && msgImp.includes(ATTESO.slice(0, 16)) && msgImp.includes("memorie importate come note"), "migrazione: impronta identica anche dopo il salvataggio");
// esporta e confronta impronta
await page.click("#b-exp"); await page.waitForTimeout(200);
const esp = JSON.parse(await page.evaluate(() => window.__mem.esportato));
ok(esp.versione === 2 && esp.hash_sha256 === ATTESO && esp.dati.note.length === 3, "esportazione 1.1: impronta corrispondente al backup 1.0 convertito");
ok(!JSON.stringify(esp).includes("github_pat"), "esportazione: nessun token");

// SINCRONIZZAZIONE
await page.evaluate(() => { window.__mem.token = true; });
await page.click("#b-sync"); await page.waitForTimeout(800);
ok((await testo("#sync-status")).startsWith("Sincronizzato"), "sincronizzazione: completata");
ok(gh.file("dati", "dati/app/stanze/st-mwel7t86-4la8o.json") !== undefined, "sincronizzazione: stanza reale nel ramo dati");
ok(gh.file("dati", "dati/app/note/mem-mwel8hdu-hn371.json") === undefined, "memoria non resa accessibile: NON inviata");
ok((await testo("#chip-sync")).includes("sincronizzato"), "chip: sincronizzato");

// CONFLITTO
gh.scriviDiretto("dati", "dati/app/stanze/st-mwel7t86-4la8o.json", JSON.stringify({ nome: "Orto (modificato altrove)", obiettivi: [], stato: "attiva" }));
await page.evaluate(() => { location.hash = "stanze"; window.__ripresa(); }); await page.waitForTimeout(800); // ritorno nell'app (onResume): sincronizza
ok((await testo("#l-stanze")).includes("Orto (modificato altrove)"), "modifica remota con telefono invariato: scaricata");
gh.scriviDiretto("dati", "dati/app/stanze/st-mwel7t86-4la8o.json", JSON.stringify({ nome: "Versione repository", obiettivi: [] }));
await page.click('button[data-act="mod-stanza"][data-id="st-mwel7t86-4la8o"]');
await page.fill("#st-nome", "Versione telefono"); await page.click("#st-save"); await page.waitForTimeout(200);
await page.goto("https://app.test/index.html#dati"); await page.waitForTimeout(300);
await page.click("#b-sync"); await page.waitForTimeout(800);
ok(!(await page.isHidden("#c-conflitti")), "conflitto: mostrato");
ok(JSON.parse(gh.file("dati", "dati/app/stanze/st-mwel7t86-4la8o.json")).nome === "Versione repository", "conflitto: repository non sovrascritto");
ok((await testo("#chip-sync")).includes("conflitti"), "chip: conflitti");
if (FOTO) await page.screenshot({ path: join(FOTO, "conflitto.png"), fullPage: true });
await page.click('button[data-act="ris-tel"]'); await page.waitForTimeout(100);
await page.click("#b-sync"); await page.waitForTimeout(800);
ok(JSON.parse(gh.file("dati", "dati/app/stanze/st-mwel7t86-4la8o.json")).nome === "Versione telefono", "conflitto risolto scegliendo il telefono");

// RETE ASSENTE
await page.evaluate(() => { window.__rete = false; });
await page.goto("https://app.test/index.html#memoria"); await page.evaluate(() => { window.__rete = false; }); await page.waitForTimeout(300);
await page.fill("#me-testo", "Nota scritta offline"); await page.fill("#me-fonte", "prova"); await page.check("#me-agenti"); await page.click("#me-save"); await page.waitForTimeout(200);
await page.evaluate(() => { location.hash = "dati"; }); await page.waitForTimeout(100);
await page.click("#b-sync"); await page.waitForTimeout(200);
ok((await testo("#sync-status")).includes("Rete assente"), "offline: messaggio chiaro");
ok((await testo("#sync-kv")).includes("1 modifiche"), "offline: 1 modifica da inviare mostrata");
await page.evaluate(() => { window.__rete = true; }); await page.click("#b-sync"); await page.waitForTimeout(800);
ok((await testo("#sync-kv")).includes("0 modifiche"), "rete tornata: inviata");

// TOKEN SCADUTO
gh.guasto = { tipo: "401", quando: () => true, volte: -1 };
await page.click("#b-sync"); await page.waitForTimeout(300);
ok((await testo("#sync-status")).includes("scaduto o revocato"), "token scaduto: messaggio chiaro");
gh.guasto = null;

// DATI FITTIZI
const reali = JSON.parse(BACKUP).dati;
await page.evaluate(() => { location.hash = "dati"; });
ok((await testo("#fitt-info")).includes("9 elementi"), "dati di prova: conteggio (9: i 10 della v1 meno la stanza riscritta senza marcatore dal test)");
await page.click("#b-fitt"); await page.click("#b-fitt"); await page.waitForTimeout(300);
const dopo = JSON.parse(await page.evaluate(() => window.__mem.dati));
const restanti = Object.values(dopo.collezioni).flatMap((c) => Object.values(c)).filter((r) => !r.sync.eliminato);
ok(restanti.every((r) => r.dati.fittizio !== true), "dati di prova: eliminati tutti");
ok(restanti.length === 2 && restanti.some((r) => r.dati.testo === "Nota scritta offline") && restanti.some((r) => r.dati.nome === "Versione telefono"), "dati reali (non fittizi): rimasti solo questi due");
await page.click("#b-sync"); await page.waitForTimeout(1000);
ok(gh.file("dati", "dati/app/agenti/ag-fittizio-sviluppatore.json") === undefined, "dati di prova: tolti anche dal repository");
if (FOTO) {
  for (const v of ["stanze", "memoria", "lavoro", "dati"]) { await page.evaluate((x) => { location.hash = x; }, v); await page.waitForTimeout(150); await page.screenshot({ path: join(FOTO, v + ".png") }); }
}
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "nessuno scorrimento orizzontale a 390 px");
ok(errori.length === 0, "nessun errore JavaScript" + (errori.length ? ": " + errori.join(" | ") : ""));
ok(!salvataggi.some((t) => t.includes("github_pat")), "nessun token nei dati salvati");
// AVVIO CON DATI DELLA 1.0 (schema 1) già sul telefono
const v1 = { schema: 1, collezioni: { agenti: {}, collegamenti: {}, skill: {}, stanze: {}, memoria: {
  "me-a": { dati: { testo: "condivisa 1.0", tipo: "riassunto", fonte: "chat", data: "2026-11-01T00:00:00.000Z", accessibile_agenti: true }, sync: { sha: null, base: null, sporco: true, eliminato: false } },
  "me-b": { dati: { testo: "privata 1.0", tipo: "dedotto", fonte: "io", data: "2026-11-02T00:00:00.000Z" }, sync: { sha: null, base: null, sporco: false, eliminato: false } } } }, stato_lavoro: [], sync: { conflitti: {} } };
const p2 = await ctx.newPage(); p2.on("pageerror", (e) => errori.push(e.message));
await p2.addInitScript((t) => { window.__datiIniziali = t; }, JSON.stringify(v1));
await p2.goto("https://app.test/index.html#memoria"); await p2.waitForTimeout(400);
ok((await p2.textContent("#avvisi")).includes("2 memorie → 2 note"), "avvio 1.0: conversione mostrata");
const copia = await p2.evaluate(() => window.__mem.copie["dati-1.0-prima-della-migrazione.json"]);
ok(copia && JSON.parse(copia).schema === 1, "avvio 1.0: copia di sicurezza salvata prima della conversione");
const salvato = JSON.parse(await p2.evaluate(() => window.__mem.dati));
ok(salvato.schema === 2 && salvato.collezioni.note["me-b"].dati.testo === "privata 1.0" && salvato.collezioni.note["me-b"].sync.sporco === false, "avvio 1.0: privata convertita e non da inviare");
ok((await p2.textContent("#l-memoria")).includes("condivisa 1.0"), "avvio 1.0: note visibili");
await browser.close();
console.log(fallite ? `\n${fallite} prove fallite` : "\ntutte le prove superate");
process.exit(fallite ? 1 : 0);
