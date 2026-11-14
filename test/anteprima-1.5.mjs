// Schermate di anteprima della 1.5 con dati DIMOSTRATIVI (mai nell'archivio reale). Uso: node test/anteprima-1.5.mjs <cartella>
import { createRequire } from "node:module"; import { readFileSync } from "node:fs"; import { join, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const M = createRequire(import.meta.url)("../android/app/src/main/assets/www/motore.js");
const { chromium } = createRequire(import.meta.url)("playwright"); const require_fs = () => createRequire(import.meta.url)("node:fs");
const WWW = join(dirname(fileURLToPath(import.meta.url)), "../android/app/src/main/assets/www"), OUT = process.argv[2];
const s = M.statoVuoto(); const t = "2026-11-14T08:00:00Z";
for (const [id, nome] of [["st-tv", "TCL Minimal TV"], ["st-sb", "Second brain"], ["st-va", "Voice assistant"], ["st-fk", "Forklift Tycoon"], ["st-tr", "Trading oro e Forex"]]) await M.salvaRecord(s, "stanze", id, { nome, stato: "attiva", obiettivi: [], agenti_ids: [] });
await M.salvaRecord(s, "progetti", "pr-tr", { nome: "Trading oro e Forex", stato: "in pausa", stanza_id: "st-tr" });
const temi = { "st-tv": ["Debloat launcher", "Permessi ADB", "Piano interventi fase 10", "Benchmark fluidità"], "st-sb": ["Archivio unico delle note", "Sincronizzazione ramo dati", "Widget Home", "Firma APK"], "st-va": ["Parola di attivazione", "Sintesi vocale italiana"], "st-fk": ["Diagnostica 60 fps", "Fisica del carrello", "Livelli magazzino"], "st-tr": ["XAU/USD livelli chiave", "Backtest EMA 50/200", "Regole di rischio 1%"] };
let k = 0; const ids = [];
for (const [st, arr] of Object.entries(temi)) for (const x of arr) { const id = "n" + k++; ids.push(id); await M.salvaRecord(s, "note", id, { titolo: x, testo: x, tipo: "originale", categoria: ["risorsa", "area", "inbox"][k % 3], stanza_id: st, collegamenti: k > 2 ? [ids[k - 3]] : [], tag: [], accessibile_agenti: false, data: t, registrato_il: t }); }
s.stato_lavoro = [{ id: "istantanea", rilevato_il: t, sessioni: [
  ["A", "TCL Minimal TV — Verifica permessi tag GitHub", "BLOCKED", "Il tag deve puntare all'head della PR #1 o al bundle?"], ["B", "Negozio miglioramenti", "BLOCKED", "Autorizzare il push del commit ba5dae6"],
  ["C", "Second Brain-Stato", "WORKING"], ["D", "Miglioramento sito", "BLOCKED", "Creare il repository pubblico pignone"], ["E", "App budgeting con Netlify", "BLOCKED", "Crediti Netlify esauriti"], ["F", "Simulatore carrelli elevatori mobile", "COMPLETED"]]
  .map(([i, titolo, b, richiede]) => ({ id: "session_" + i, titolo, status_bucket: "SESSION_STATUS_BUCKET_" + b, richiede, updated_at: t, created_at: t })) },
  { id: "attese", testo: "# Sessioni in attesa – rilevazione 2026-11-14T06:47Z\n\n## 1. TCL Minimal TV — Verifica permessi tag GitHub\nhttps://claude.ai/code/session_A\n- **Cosa chiede:** il tag deve puntare all'head della PR #1 (`3414827`) o al bundle F1c-OIDC?\n- **Risposta consigliata:** «Head della PR #1 (`3414827`); il bundle lo portiamo dopo.» Motivo: nessun push né build.\n- **Rischi:** il tag non include F1c-OIDC.\n\n## 2. Negozio miglioramenti\nhttps://claude.ai/code/session_B\n- **Cosa chiede:** autorizzare il push del commit `ba5dae6`.\n- **Risposta consigliata:** «Autorizzo il push del solo commit ba5dae6, senza force push.»\n- **Rischi:** se il container è stato azzerato il commit non esiste più.\n" }];
await M.noteDaSessioni(s); await M.organizzaAutomatico(s);
const dati = JSON.stringify(s);
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.route("https://app.test/**", (r) => { const n = new URL(r.request().url()).pathname.slice(1) || "index.html"; r.fulfill({ body: readFileSync(join(WWW, n)), contentType: n.endsWith(".js") ? "text/javascript" : "text/html" }); });
await ctx.addInitScript((d) => { window.Android = { caricaDati: () => d, caricaDatiPrecedenti: () => "", salvaDati: () => "ok", salvaCopia: () => "ok", haToken: () => true, retePresente: () => false, github: () => {}, infoApp: () => JSON.stringify({ versione: "1.5.0", codice: 8 }), apriLink: () => {}, haRoutine: () => true, idRoutine: () => "", notificheConsentite: () => true, aggiornaWidget: () => {}, fine: () => {} }; }, dati);
const p = await ctx.newPage(); const vai = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(400); };
await p.goto("https://app.test/index.html#home"); await p.waitForTimeout(600); await p.screenshot({ path: join(OUT, "1-home.png"), fullPage: true });
await vai("mappa"); await p.check("#isolati"); await p.waitForTimeout(500); await p.screenshot({ path: join(OUT, "2-sfera.png") });
const box = await p.$("#tela").then((e) => e.boundingBox());
for (let dy = -120; dy <= 120 && (await p.isHidden("#scheda")); dy += 12) for (let dx = -120; dx <= 120 && (await p.isHidden("#scheda")); dx += 12) await p.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
await p.waitForTimeout(200); await p.screenshot({ path: join(OUT, "3-sfera-scheda.png") });
await p.click('[data-modo="rete"]'); await p.waitForTimeout(500); await p.screenshot({ path: join(OUT, "4-rete.png") });
await vai("stanze"); await p.screenshot({ path: join(OUT, "5-stanze.png") });
const png = await p.evaluate(() => window.SBGlobo.immagineWidget(window.SBMotore, JSON.parse(window.Android.caricaDati()), 512, Date.parse("2026-11-14T09:00:00Z")));
(await import("node:fs")).writeFileSync(join(OUT, "6-widget-globo.png"), Buffer.from(png, "base64"));
const foto = await p.evaluate(() => { const G = window.SBGlobo, s = JSON.parse(window.Android.caricaDati()), q = Date.parse("2026-11-14T09:00:00Z"); return Array.from({ length: G.FOTOGRAMMI }, (_, i) => G.fotogrammaWidget(window.SBMotore, s, 300, q, i / G.FOTOGRAMMI)); });
foto.forEach((b, i) => (require_fs().writeFileSync(join(OUT, `widget-f${String(i).padStart(2, "0")}.png`), Buffer.from(b, "base64"))));
await browser.close(); console.log("ok");
