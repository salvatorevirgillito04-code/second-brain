// Prova dell'interfaccia 1.1 (assets/www) in Chromium con un ponte Android SIMULATO e GitHub SIMULATO.
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
const ATTESO = await M.impronta(M.datiV1aV2(JSON.parse(BACKUP).dati));
const FOTO = process.argv[2];
const gh = new FintoGitHub("salvatorevirgillito04-code", "second-brain");
let fallite = 0;
const ok = (c, nome) => { console.log((c ? "ok   " : "FAIL ") + nome); if (!c) fallite++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errori = [], salvataggi = [];
await ctx.exposeFunction("__nodeGithub", async (id, m, p, c) => { const r = await gh.gestisci(m, p, c ? JSON.parse(c) : null); return [id, r.status, r.corpo == null ? "" : JSON.stringify(r.corpo)]; });
await ctx.exposeFunction("__nodeSalvato", (t) => { salvataggi.push(t); });
await ctx.route("https://app.test/**", (route) => { const nome = new URL(route.request().url()).pathname.slice(1) || "index.html"; route.fulfill({ body: readFileSync(join(WWW, nome)), contentType: nome.endsWith(".js") ? "text/javascript" : "text/html" }); });
await ctx.addInitScript(() => {
  const mem = { dati: "", prec: "", token: false, esportato: null, copie: {} };
  window.__mem = mem;
  window.Android = {
    caricaDati: () => mem.dati || window.__datiIniziali || "", caricaDatiPrecedenti: () => mem.prec,
    salvaCopia: (n, t) => (mem.copie[n] ? "esiste" : ((mem.copie[n] = t), "ok")),
    salvaDati: (t) => { mem.prec = mem.dati; mem.dati = t; window.__nodeSalvato(t); return "ok"; },
    haToken: () => mem.token, impostaToken: (t) => (t.startsWith("github_pat_") ? ((mem.token = true), "ok") : "token non valido"), rimuoviToken: () => { mem.token = false; },
    retePresente: () => window.__rete !== false,
    github: (id, m, p, c) => { window.__nodeGithub(id, m, p, c).then(([i, s, b]) => window.__risposta(i, s, b)); },
    esporta: (nome, testo, msg) => { mem.esportato = testo; setTimeout(() => window.__esportato(true, msg), 10); },
    importa: () => setTimeout(() => window.__importato(true, window.__fileDaImportare), 10), importaFile: () => setTimeout(() => window.__fileScelto(true, window.__fileB64), 10),
    infoApp: () => JSON.stringify({ versione: "1.3.0", codice: 6, pacchetto: "it.secondbrain.app" }), apriLink: () => {},
    haRoutine: () => !!mem.routine, idRoutine: () => (mem.routine || ""), rimuoviRoutine: () => { mem.routine = null; },
    impostaRoutine: (id, tok) => (/^trig_[A-Za-z0-9]{10,}$/.test(id) && tok.startsWith("sk-ant-oat01-") ? ((mem.routine = id), "ok") : "non valido"),
    avviaRoutine: (id) => { mem.avvii = (mem.avvii || 0) + 1; setTimeout(() => window.__risposta(id, 200, JSON.stringify({ type: "routine_fire", claude_code_session_id: "session_Z" })), 10); },
    fine: (e) => { mem.fine = e; },
    notificheConsentite: () => !!mem.notifiche, richiediNotifiche: () => { mem.notifiche = true; setTimeout(() => window.__notifiche(true), 10); },
    notifica: (id, t, x) => { (mem.notificate ||= []).push(id); return true; }, aggiornaWidget: (j) => { mem.widget = JSON.parse(j); },
  };
});
const page = await ctx.newPage(); page.on("pageerror", (e) => errori.push(e.message));
const T = (s) => page.textContent(s);
const vai = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await page.waitForTimeout(150); };
const salvato = async () => JSON.parse(await page.evaluate(() => window.__mem.dati));

await page.goto("https://app.test/index.html#home"); await page.waitForTimeout(300);
ok((await T("main")).includes("Archivio vuoto"), "avvio vuoto: invito a ripristinare o aggiungere");
ok((await T("#chip-sync")) === "solo telefono", "senza token: «solo telefono»");

// MIGRAZIONE DAL BACKUP 1.0
await vai("impostazioni");
await page.evaluate((b) => { window.__fileDaImportare = b; }, BACKUP);
await page.click("#b-imp"); await page.waitForTimeout(200);
ok((await T("#imp-anteprima")).includes("le memorie diventeranno note"), "backup 1.0 riconosciuto");
await page.click("#b-imp-ok"); await page.waitForTimeout(400);
const msg = await T("#imp-stato");
ok(msg.includes("Importazione verificata") && msg.includes(ATTESO.slice(0, 16)), "migrazione verificata, impronta corrispondente");
const s1 = await salvato();
const v1 = JSON.parse(BACKUP).dati.memoria;
ok(v1.every((m) => { const { id, ...d } = m; return M.canon(s1.collezioni.note[id].dati) === M.canon(d); }), "memorie → note: contenuto identico campo per campo");
ok(Object.keys(s1.collezioni.note).length === v1.length && !Object.keys(s1.collezioni.memoria || {}).length, "nessuna nota in più o in meno");
await page.click("#b-exp"); await page.waitForTimeout(200);
const esp = JSON.parse(await page.evaluate(() => window.__mem.esportato));
ok(esp.versione === 2 && esp.hash_sha256 === ATTESO && !JSON.stringify(esp).includes("github_pat"), "esportazione 1.1: impronta corrispondente, nessun token");

// SINCRONIZZAZIONE
await page.evaluate(() => { window.__mem.token = true; });
await page.click("#b-sync"); await page.waitForTimeout(900);
ok((await T("#sync-stato")).startsWith("Sincronizzato"), "sincronizzazione completata");
ok(gh.file("dati", "dati/app/stanze/st-mwel7t86-4la8o.json") !== undefined, "stanza nel ramo dati");
ok(!v1.some((m) => gh.file("dati", `dati/app/note/${m.id}.json`)), "note private non inviate");

// AGGIUNTA RAPIDA, ORGANIZZAZIONE, RICERCA
await vai("home");
const inboxPrima = Number((await T('[data-org="inbox"] b')).trim());
await page.click("#fab"); await page.fill("#r-testo", "Idea: archivio unico delle note"); await page.click("#f-salva"); await page.waitForTimeout(200);
ok(Number((await T('[data-org="inbox"] b')).trim()) === inboxPrima + 1, "aggiunta rapida: nota in «Da organizzare»");
await page.fill("#cerca", "archivio unico"); await page.waitForTimeout(150);
ok((await T("main")).includes("1 risultati"), "ricerca in diretta");
await page.click('[data-apri="nota"]'); await page.waitForTimeout(150);
await page.click('[data-categoria="risorsa"]'); await page.waitForTimeout(150);
await vai("organizza"); await page.click('[data-org="risorsa"]'); await page.waitForTimeout(100);
ok((await T("main")).includes("Idea: archivio unico"), "nota spostata in Risorse");
await page.click('[data-org="progetti"]'); await page.click('[data-modifica="progetto"]'); await page.fill("#p-nome", "Progetto reale di prova"); await page.click("#f-salva"); await page.waitForTimeout(150);
ok((await T("main")).includes("Progetto reale di prova"), "progetto creato");

// COLLEGAMENTI, RIFERIMENTI IN ENTRATA, MAPPA
const nuova = Object.entries((await salvato()).collezioni.note).find(([, r]) => r.dati.testo.startsWith("Idea:"))[0];
await page.evaluate((id) => { location.hash = "note"; }, nuova); await page.waitForTimeout(100);
await page.click(`[data-apri="nota"][data-id="mem-mwel8hdu-hn371"]`); await page.waitForTimeout(100);
await page.click('[data-modifica="nota"]'); await page.check(`#n-link input[value="${nuova}"]`); await page.selectOption("#n-prog", { label: "Progetto reale di prova" }); await page.click("#f-salva"); await page.waitForTimeout(200);
ok((await T("main")).includes("Collegamenti in uscita · 1"), "collegamento in uscita salvato");
const sn = await salvato();
{ const orig = v1.find((m) => m.id === "mem-mwel8hdu-hn371"); const ora1 = sn.collezioni.note["mem-mwel8hdu-hn371"].dati; ok(Object.keys(orig).filter((k) => k !== "id").every((k) => M.canon(orig[k]) === M.canon(ora1[k])) && !("accessibile_agenti" in ora1), "modifica: tutti i campi originali restano identici (data compresa), nessun permesso aggiunto"); }
await page.click(`[data-apri="nota"][data-id="${nuova}"]`); await page.waitForTimeout(150);
ok((await T("main")).includes("Riferimenti in entrata · 1"), "riferimento in entrata mostrato sulla nota collegata");
await vai("mappa"); await page.waitForTimeout(200);
const relazioni = M.relazioni(M.carica(JSON.stringify(await salvato()), null).stato).length;
ok((await T("#mappa-info")).includes(`${relazioni} relazioni reali`), `mappa: ${relazioni} relazioni, tutte esistenti nei dati`);
const nodiSenza = (await T("#mappa-info")).match(/^(\d+) elementi/)[1];
await page.check("#isolati"); await page.waitForTimeout(200);
ok(Number((await T("#mappa-info")).match(/^(\d+) elementi/)[1]) > Number(nodiSenza), "mappa: elementi isolati nascosti di default, visibili a richiesta");
const pizzica = await page.evaluate(async () => { // due dita che si allontanano: la mappa si ingrandisce (immagine diversa)
  const t = document.querySelector("#tela"), r = t.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, prima = t.toDataURL();
  const ev = (tipo, id, x) => t.dispatchEvent(new PointerEvent(tipo, { pointerId: id, clientX: x, clientY: cy, bubbles: true, isPrimary: id === 1 }));
  t.setPointerCapture = () => {}; ev("pointerdown", 1, cx - 20); ev("pointerdown", 2, cx + 20); ev("pointermove", 1, cx - 80); ev("pointermove", 2, cx + 80); ev("pointerup", 1, cx - 80); ev("pointerup", 2, cx + 80);
  return t.toDataURL() !== prima && document.querySelector("#scheda").hidden; });
ok(pizzica, "mappa: ingrandimento con due dita, senza aprire schede");
if (FOTO) await page.screenshot({ path: join(FOTO, "mappa.png") });

// STANZE E ATTIVITÀ
await vai("stanze"); await page.click('[data-apri="stanza"]'); await page.waitForTimeout(150);
await page.fill("#att-testo", "Prima attività reale"); await page.press("#att-testo", "Enter"); await page.waitForTimeout(200);
ok((await T("main")).includes("Prima attività reale") && (await T("main")).includes("1 aperte"), "attività aggiunta");
await page.check('[data-att]'); await page.waitForTimeout(200);
ok((await T("main")).includes("0 aperte"), "attività segnata come fatta");
if (FOTO) await page.screenshot({ path: join(FOTO, "stanza.png") });

// CONFLITTO
const sid = await page.evaluate(() => document.querySelector('[data-modifica="stanza"][data-id]').dataset.id);
await vai("impostazioni"); await page.click("#b-sync"); await page.waitForTimeout(900);
gh.scriviDiretto("dati", `dati/app/stanze/${sid}.json`, JSON.stringify({ nome: "Versione repository" }));
await page.evaluate((id) => { location.hash = "stanze"; }, sid); await page.waitForTimeout(100);
await page.click(`[data-apri="stanza"][data-id="${sid}"]`); await page.click('[data-modifica="stanza"][data-id]'); await page.fill("#s-nome", "Versione telefono"); await page.click("#f-salva"); await page.waitForTimeout(150);
await vai("impostazioni"); await page.click("#b-sync"); await page.waitForTimeout(900);
ok((await T("main")).includes("Conflitti da risolvere · 1") && JSON.parse(gh.file("dati", `dati/app/stanze/${sid}.json`)).nome === "Versione repository", "conflitto mostrato, repository non sovrascritto");
if (FOTO) await page.screenshot({ path: join(FOTO, "impostazioni.png"), fullPage: true });
await page.click('[data-risolvi="telefono"]'); await page.waitForTimeout(100); await page.click("#b-sync"); await page.waitForTimeout(900);
ok(JSON.parse(gh.file("dati", `dati/app/stanze/${sid}.json`)).nome === "Versione telefono", "conflitto risolto scegliendo il telefono");

// NOTA CONDIVISA, RETE ASSENTE, TOKEN SCADUTO
await page.click(`text=Avanzate`);
await page.evaluate(() => { window.__rete = false; });
await page.click("#fab").catch(() => {}); await vai("home"); await page.click("#fab"); await page.fill("#r-testo", "Progetto offline"); await page.click('#r-tipo [data-v="progetto"]'); await page.click("#f-salva"); await page.waitForTimeout(150);
await vai("impostazioni"); await page.click("#b-sync"); await page.waitForTimeout(200);
ok((await T("#sync-stato")).includes("Rete assente") && (await T("main")).includes("1 modifiche"), "offline: messaggio chiaro, 1 modifica in attesa");
await page.evaluate(() => { window.__rete = true; }); await page.click("#b-sync"); await page.waitForTimeout(900);
ok((await T("main")).includes("0 modifiche"), "rete tornata: inviata");
gh.guasto = { tipo: "401", quando: () => true, volte: -1 }; await page.click("#b-sync"); await page.waitForTimeout(300);
ok((await T("#sync-stato")).includes("scaduto o revocato"), "token scaduto: messaggio chiaro"); gh.guasto = null;

// DATI DI PROVA
const reali = Object.values((await salvato()).collezioni).flatMap((c) => Object.values(c)).filter((r) => !r.sync.eliminato && r.dati.fittizio !== true).length;
await page.click("#b-fitt"); await page.click("#b-fitt"); await page.waitForTimeout(300);
const dopo = Object.values((await salvato()).collezioni).flatMap((c) => Object.values(c)).filter((r) => !r.sync.eliminato);
ok(dopo.every((r) => r.dati.fittizio !== true) && dopo.length === reali, `dati di prova eliminati, ${reali} elementi reali conservati`);
if (FOTO) { for (const v of ["home", "organizza", "note"]) { await vai(v); await page.screenshot({ path: join(FOTO, v + ".png") }); } }
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "nessuno scorrimento orizzontale a 390 px");

// 1.2: COLLEGAMENTI [[…]], NOTE SIMILI, CHAT DI CLAUDE
await vai("home"); await page.click("#fab"); await page.fill("#r-testo", "Piano orto: vedi [[Calendario semine]] e [[Progetto offline]]"); await page.click("#f-salva"); await page.waitForTimeout(150);
const idOrto = Object.entries((await salvato()).collezioni.note).find(([, r]) => r.dati.testo.startsWith("Piano orto"))[0];
await page.evaluate(() => { location.hash = "note"; }); await page.waitForTimeout(100);
await page.click(`[data-apri="nota"][data-id="${idOrto}"]`); await page.waitForTimeout(150);
ok((await T("main")).includes("Collegamenti scritti ma non risolti") && (await T("main")).includes("[[Calendario semine]]"), "[[…]] verso una nota inesistente: segnalato");
await page.click('[data-crea-da-link="Calendario semine"]'); await page.waitForTimeout(200);
ok((await T("main")).includes("Collegamenti in uscita · 1") && !(await T("main")).includes("[[Calendario semine]] ·"), "«Crea nota» crea e collega (resta segnalato solo [[Progetto offline]], che è un progetto e non una nota)");
await page.click('#vista a[data-apri="nota"]'); await page.waitForTimeout(150);
ok((await T("main")).includes("Riferimenti in entrata · 1") && (await T("main")).includes("Piano orto"), "il collegamento scritto compare come riferimento in entrata");
await vai("home"); await page.click("#fab"); await page.fill("#r-testo", "piano dell'orto: vedi calendario semine e progetto offline"); await page.click("#f-salva"); await page.waitForTimeout(150);
await page.evaluate(() => { location.hash = "note"; }); await page.waitForTimeout(150);
ok((await T("main")).includes("coppie di note simili"), "note simili segnalate nell'elenco");
await page.click(`[data-apri="nota"][data-id="${idOrto}"]`); await page.waitForTimeout(150);
ok(/Note simili · 1[\s\S]*%/.test(await T("main")), "nota: sezione «Note simili» con percentuale, nessuna unione");
const zipB64 = readFileSync(join(QUI, "campioni/esportazione-claude.zip")).toString("base64");
await page.evaluate((b) => { window.__fileB64 = b; }, zipB64);
await vai("impostazioni"); await page.click("#b-chat"); await page.waitForTimeout(400);
ok((await T("#chat-anteprima")).includes("2 chat trovate") && (await T("#chat-anteprima")).includes("2 scartate") && (await T("#chat-anteprima")).includes("1 allegati"), "anteprima importazione chat dallo ZIP");
const nCopie = await page.evaluate(() => Object.keys(window.__mem.copie).length);
await page.click("#b-chat-ok"); await page.waitForTimeout(300);
ok((await T("#chat-stato")).includes("Importate 2 chat"), "chat importate");
ok(await page.evaluate((n) => Object.keys(window.__mem.copie).length === n + 1, nCopie), "copia di sicurezza salvata prima dell'importazione");
const sc = (await salvato()).collezioni.note["chat-aaaa-1111"];
ok(sc && sc.dati.tipo === "originale" && sc.dati.accessibile_agenti === false && sc.sync.sporco === false, "chat = nota originale, privata, non inviata");
await page.click("#b-chat"); await page.waitForTimeout(400);
ok((await T("#chat-anteprima")).includes("0 nuove, 2 già importate") && !(await page.$("#b-chat-ok")), "reimportazione: nessun duplicato");

// 1.3: PROMEMORIA CHAT, «AGGIORNA ORA», NOTE DALLE SESSIONI, RICARICA DOPO IL BACKGROUND
await vai("home");
ok(!(await T("main")).includes("Importa le tue chat") , "promemoria chat assente subito dopo un'importazione");
await page.evaluate(() => { location.hash = "stanze"; }); await page.waitForTimeout(100); await page.click('[data-sub="esecuzioni"]'); await page.waitForTimeout(100);
await page.click('[data-modifica="routine"]'); await page.fill("#ro-token", "sk-ant-oat01-prova"); await page.click("#f-salva"); await page.waitForTimeout(150);
await page.click("#b-aggiorna-ora"); await page.waitForTimeout(200);
ok((await T("#lv-stato")).includes("Aggiornamento avviato") && await page.evaluate(() => window.__mem.avvii === 1), "«Aggiorna ora»: attività avviata");
gh.scriviDiretto("dati", "dati/stato/istantanea.json", JSON.stringify({ rilevato_il: new Date().toISOString(), totale: 1, sessioni: [{ id: "session_QQ", titolo: "Sito negozio", status_bucket: "SESSION_STATUS_BUCKET_BLOCKED", updated_at: "2026-11-13T20:00:00Z", riepilogo: "bozza pronta", richiede: "approva il testo" }] }));
await page.click("#b-snap"); await page.waitForTimeout(600);
const ns = (await salvato()).collezioni.note["sessione-QQ"];
ok(ns && ns.dati.accessibile_agenti === false && /approva il testo/.test(ns.dati.testo) && ns.dati.tipo === "riassunto", "sessione di Claude Code diventata nota privata con richiesta di intervento");
const disco = await salvato(); disco.collezioni.note["sessione-QQ"].dati.titolo = "Scritto dal background"; const nuovoTesto = JSON.stringify(disco);
await page.evaluate((t) => { window.__mem.dati = t; window.__ripresa(); }, nuovoTesto); await page.waitForTimeout(300);
ok((await salvato()).collezioni.note["sessione-QQ"].dati.titolo === "Scritto dal background", "al ritorno nell'app i dati scritti in background vengono ricaricati, non sovrascritti");

// 1.4: ESTRATTI, BANNER INTERVENTI, WIDGET, NOTIFICHE
await vai("home"); await page.fill("#cerca", "approva il testo"); await page.waitForTimeout(150);
ok((await T("main")).includes("approva il testo") && (await T("main")).includes("1 risultati"), "ricerca: estratto del testo trovato nel risultato");
await page.fill("#cerca", ""); await page.waitForTimeout(100);
ok((await T("main")).includes("Attendono un tuo intervento") && (await T("main")).includes("approva il testo"), "Home: sessioni che attendono un tuo intervento");
const wid = await page.evaluate(() => window.__mem.widget);
ok(wid && typeof wid.inbox === "number" && wid.attesa >= 1, "widget aggiornato con i conteggi reali");

await vai("impostazioni"); await page.click("#b-notifiche"); await page.waitForTimeout(150);
ok((await T("main")).includes("Notifiche interventi") && (await T("main")).includes("attive"), "notifiche attivate su richiesta");
await page.evaluate(() => { window.__apri("home-rapido"); }); await page.waitForTimeout(200);
ok(!(await page.isHidden("#foglio")) && (await T("#foglio")).includes("Aggiunta rapida"), "apertura dal widget: aggiunta rapida");
await page.click("#f-annulla");

// AVVIO CON DATI DELLA 1.0 (schema 1) già sul telefono
const vecchi = { schema: 1, collezioni: { agenti: {}, collegamenti: {}, skill: {}, stanze: {}, memoria: {
  "me-a": { dati: { testo: "condivisa 1.0", tipo: "riassunto", fonte: "chat", data: "2026-11-01T00:00:00.000Z", accessibile_agenti: true }, sync: { sha: null, base: null, sporco: true, eliminato: false } },
  "me-b": { dati: { testo: "privata 1.0", tipo: "dedotto", fonte: "io", data: "2026-11-02T00:00:00.000Z" }, sync: { sha: null, base: null, sporco: false, eliminato: false } } } }, stato_lavoro: [], sync: { conflitti: {} } };
const p2 = await ctx.newPage(); p2.on("pageerror", (e) => errori.push(e.message));
await p2.addInitScript((t) => { window.__datiIniziali = t; }, JSON.stringify(vecchi));
await p2.goto("https://app.test/index.html#home"); await p2.waitForTimeout(400);
ok((await p2.textContent("main")).includes("2 memorie → 2 note"), "avvio 1.0: conversione mostrata");
const copia = await p2.evaluate(() => window.__mem.copie["dati-1.0-prima-della-migrazione.json"]);
ok(copia && JSON.parse(copia).schema === 1, "avvio 1.0: copia di sicurezza salvata prima");
const s2 = JSON.parse(await p2.evaluate(() => window.__mem.dati));
ok(s2.schema === 2 && s2.collezioni.note["me-b"].sync.sporco === false && s2.collezioni.note["me-a"].sync.sporco === true, "avvio 1.0: privata resta privata, condivisa da inviare");

// SINCRONIZZAZIONE IN BACKGROUND (sfondo.html, come la usa SincronizzazioneJob)
const p3 = await ctx.newPage(); p3.on("pageerror", (e) => errori.push(e.message));
const sfondoDati = await salvato(); const pr = Object.keys(sfondoDati.collezioni.progetti)[0]; sfondoDati.collezioni.progetti[pr].dati.nome = "Modificato e inviato in background"; sfondoDati.collezioni.progetti[pr].sync.sporco = true;
await p3.addInitScript((t) => { window.__datiIniziali = t; }, JSON.stringify(sfondoDati));
await p3.addInitScript(() => { setTimeout(() => { window.__mem.token = true; }, 0); });
await p3.evaluate(() => 0).catch(() => {});
await p3.goto("https://app.test/sfondo.html"); await p3.waitForTimeout(1500);
const esitoSfondo = await p3.evaluate(() => window.__mem.fine);
ok(esitoSfondo === "ok" || esitoSfondo === "saltato: nessun token o rete", "background: esecuzione terminata (" + esitoSfondo + ")");
if (esitoSfondo === "ok") { const nn = await p3.evaluate(() => window.__mem.notificate || []); const sv = JSON.parse(await p3.evaluate(() => window.__mem.dati)); ok(Array.isArray(nn) && Object.keys((sv.impostazioni || {}).notificate || {}).length >= 1, "background: interventi segnati come notificati (nessun doppione)"); }
if (esitoSfondo === "ok") ok(JSON.parse(gh.file("dati", `dati/app/progetti/${pr}.json`)).nome === "Modificato e inviato in background" && JSON.parse(await p3.evaluate(() => window.__mem.dati)).sync.ultimo_sfondo.esito === "ok", "background: modifica inviata e salvata");

ok(errori.length === 0, "nessun errore JavaScript" + (errori.length ? ": " + errori.join(" | ") : ""));
ok(!salvataggi.some((t) => t.includes("github_pat")), "nessun token nei dati salvati");
ok(!readFileSync(join(WWW, "index.html"), "utf8").includes("Trasloco a Bologna"), "nessun dato dimostrativo dell'anteprima nell'app");
await browser.close();
console.log(fallite ? `\n${fallite} prove fallite` : "\ntutte le prove superate");
process.exit(fallite ? 1 : 0);
