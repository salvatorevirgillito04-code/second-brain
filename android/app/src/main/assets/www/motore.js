// Second Brain – motore dati e sincronizzazione (nessuna dipendenza esterna).
// Usato dall'app Android (WebView) e dai test Node (test/motore.test.mjs).
//
// Modello locale:
//   stato.collezioni[col][id] = { dati: {...}, sync: { sha, base, sporco, eliminato } }
//     sha    = sha del file nel repository all'ultima sincronizzazione (null se mai inviato)
//     base   = impronta dei dati all'ultima sincronizzazione
//     sporco = ci sono modifiche locali da inviare
//   stato.stato_lavoro = [{id:"istantanea",...}, {id:"ultimo_tentativo",...}]  (solo lettura: lo scrive Claude Code)
//
// Repository (ramo "dati"):
//   dati/app/<collezione>/<id>.json   dati modificabili dall'app
//   dati/stato/istantanea.json        istantanea scritta da Claude Code («aggiorna stato»)
//   dati/stato/ultimo_tentativo.json
(function (radice) {
  "use strict";
  const M = {};
  M.SCHEMA = 2;
  // Schema 2 (app 1.1): le memorie sono diventate note. "memoria" resta solo per eliminare dal repository i file della 1.0.
  M.COLLEZIONI_APP = ["agenti", "collegamenti", "note", "progetti", "skill", "stanze"];
  M.COLLEZIONI_LEGACY = ["memoria"];
  M.COLLEZIONI_SYNC = [...M.COLLEZIONI_APP, ...M.COLLEZIONI_LEGACY];
  M.COLLEZIONI_BACKUP = [...M.COLLEZIONI_APP, "stato_lavoro"];
  M.COLLEZIONI_BACKUP_V1 = ["agenti", "collegamenti", "memoria", "skill", "stanze", "stato_lavoro"];
  M.RAMO = "dati";
  M.CARTELLA_APP = "dati/app";
  M.CARTELLA_STATO = "dati/stato";

  // ---------- utilità ----------
  M.canon = function canon(v) {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v);
  };
  M.sha256 = async function (testo) {
    const buf = await radice.crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  M.impronta = (dati) => M.sha256(M.canon(dati));
  const copia = (o) => JSON.parse(JSON.stringify(o));
  const ora = () => new Date().toISOString();
  M.aBase64 = function (testo) {
    const bytes = new TextEncoder().encode(testo); let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return radice.btoa(bin);
  };
  M.daBase64 = function (b64) {
    const bin = radice.atob(String(b64).replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };
  const ID_VALIDO = /^[A-Za-z0-9_.~:@+-]{1,120}$/;

  // ---------- stato locale ----------
  M.statoVuoto = () => ({
    schema: M.SCHEMA, creato_il: ora(),
    collezioni: Object.fromEntries(M.COLLEZIONI_SYNC.map((c) => [c, {}])),
    stato_lavoro: [],
    sync: { ultimo_ok: null, ultimo_tentativo: null, errore: null, conflitti: {}, istantanea_scaricata_il: null },
  });

  // Carica il testo salvato; se il principale è illeggibile usa la copia precedente.
  // Restituisce anche il rapporto di migrazione: se la verifica fallisce lo stato NON viene sostituito.
  M.carica = function (principale, precedente) {
    for (const [testo, origine] of [[principale, "principale"], [precedente, "precedente"]]) {
      if (!testo) continue;
      let grezzo; try { grezzo = JSON.parse(testo); } catch (_) { continue; }
      if (grezzo && grezzo.schema === 1 && grezzo.collezioni) {
        const m = M.migraV1(grezzo);
        if (!m.rapporto.ok) return { stato: null, origine: "migrazione_fallita", migrazione: m.rapporto, testoOriginale: testo };
        return { stato: m.stato, origine, migrazione: m.rapporto, testoOriginale: testo };
      }
      try { return { stato: M.migra(grezzo), origine }; } catch (_) { /* prova la successiva */ }
    }
    return { stato: M.statoVuoto(), origine: principale || precedente ? "illeggibile" : "nuovo" };
  };
  // Migrazioni di schema future: qui si aggiornano i dati salvati da versioni precedenti dell'app.
  M.migra = function (s) {
    if (!s || typeof s !== "object" || !s.collezioni) throw new Error("formato sconosciuto");
    if ((s.schema || 0) > M.SCHEMA) throw new Error("dati creati da una versione più recente dell'app");
    if ((s.schema || 1) < 2) throw new Error("dati della 1.0: usa migraV1");
    for (const c of M.COLLEZIONI_SYNC) s.collezioni[c] ||= {};
    s.stato_lavoro ||= [];
    s.sync ||= {}; s.sync.conflitti ||= {};
    s.schema = M.SCHEMA;
    return s;
  };

  // ---------- migrazione 1.0 → 1.1: memorie → note ----------
  // Le note conservano ESATTAMENTE i dati della memoria (stesso id, stessi campi): categoria, tag e collegamenti
  // nuovi sono facoltativi e assenti finché non li imposti. Le memorie condivise vengono spostate nel repository
  // da dati/app/memoria a dati/app/note (il vecchio file viene eliminato solo se è ancora la versione vista).
  M.migraV1 = function (s1) {
    const s = copia(s1);
    s.schema = 2;
    for (const c of M.COLLEZIONI_SYNC) s.collezioni[c] ||= {};
    s.collezioni.note = {};
    s.collezioni.memoria = {};
    s.stato_lavoro ||= []; s.sync ||= {}; s.sync.conflitti ||= {};
    const mem = (s1.collezioni && s1.collezioni.memoria) || {};
    for (const [id, r] of Object.entries(mem)) {
      const k = s1.sync && s1.sync.conflitti && s1.sync.conflitti["memoria/" + id];
      if (!r.sync.eliminato) {
        s.collezioni.note[id] = { dati: copia(r.dati), sync: { sha: null, base: null, sporco: M.nelRepository("note", r.dati), eliminato: false } };
      } else if (k && k.remoto) { // eliminata qui ma modificata nel repository: resta una nota da decidere
        s.collezioni.note[id] = { dati: copia(k.remoto), sync: { sha: null, base: null, sporco: false, eliminato: false } };
      }
      const shaRemoto = k ? k.rsha : r.sync.sha;
      if (shaRemoto) s.collezioni.memoria[id] = { dati: copia(r.dati), sync: { sha: shaRemoto, base: r.sync.base, sporco: true, eliminato: true } };
      if (k) {
        delete s.sync.conflitti["memoria/" + id];
        if (s.collezioni.note[id]) s.sync.conflitti["note/" + id] = { col: "note", id, tipo: "migrazione", locale: r.sync.eliminato ? null : copia(r.dati), remoto: k.remoto ? copia(k.remoto) : null, rsha: null, rilevato_il: ora() };
      }
    }
    return { stato: s, rapporto: M.verificaMigrazione(s1, s) };
  };
  M.verificaMigrazione = function (s1, s2) {
    const errori = [], mem = (s1.collezioni && s1.collezioni.memoria) || {};
    const attive = Object.entries(mem).filter(([, r]) => !r.sync.eliminato);
    const note = s2.collezioni.note || {};
    for (const [id, r] of attive) {
      if (!note[id]) errori.push(`memoria ${id} non trovata tra le note`);
      else if (M.canon(note[id].dati) !== M.canon(r.dati)) errori.push(`memoria ${id}: contenuto diverso`);
    }
    const attese = new Set(attive.map(([id]) => id));
    for (const [id, r] of Object.entries(mem)) if (r.sync.eliminato && s1.sync && s1.sync.conflitti && s1.sync.conflitti["memoria/" + id]) attese.add(id);
    for (const id of Object.keys(note)) if (!attese.has(id)) errori.push(`nota ${id} in più (possibile duplicato)`);
    const condPrima = attive.filter(([, r]) => r.dati.accessibile_agenti === true).map(([id]) => id).sort();
    const condDopo = Object.entries(note).filter(([id, r]) => attese.has(id) && mem[id] && !mem[id].sync.eliminato && M.nelRepository("note", r.dati)).map(([id]) => id).sort();
    if (M.canon(condPrima) !== M.canon(condDopo)) errori.push("cambiato l'insieme delle note accessibili agli agenti");
    for (const [id, r] of Object.entries(note)) if (r.dati.accessibile_agenti !== true && r.sync.sporco) errori.push(`nota privata ${id} sarebbe inviata`);
    for (const c of ["agenti", "collegamenti", "skill", "stanze"]) if (M.canon((s1.collezioni || {})[c] || {}) !== M.canon(s2.collezioni[c] || {})) errori.push(`collezione ${c} modificata`);
    if (M.canon(s1.stato_lavoro || []) !== M.canon(s2.stato_lavoro || [])) errori.push("istantanea modificata");
    return { ok: errori.length === 0, errori, memorie: attive.length, note: Object.keys(note).length, condivise: condPrima.length,
      da_spostare_nel_repository: condPrima.length, file_1_0_da_eliminare: Object.keys(s2.collezioni.memoria).length };
  };

  M.elenco = (stato, col) => Object.entries(stato.collezioni[col] || {}).filter(([, r]) => !r.sync.eliminato).map(([id, r]) => ({ id, ...r.dati }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  M.trova = (stato, col, id) => { const r = stato.collezioni[col][id]; return r && !r.sync.eliminato ? { id, ...r.dati } : null; };

  // Il record va nel repository? Le memorie solo se l'utente le ha rese accessibili agli agenti.
  M.nelRepository = (col, dati) => (col !== "note" && col !== "memoria") || (dati && dati.accessibile_agenti === true);

  M.salvaRecord = async function (stato, col, id, dati) {
    if (!M.COLLEZIONI_APP.includes(col)) throw new Error("collezione non modificabile: " + col);
    if (!ID_VALIDO.test(id)) throw new Error("identificativo non valido");
    const pulito = copia(dati); delete pulito.id;
    const r = stato.collezioni[col][id] || { sync: { sha: null, base: null, sporco: false, eliminato: false } };
    r.dati = pulito; r.sync.eliminato = false;
    const h = await M.impronta(pulito);
    // non c'è niente da inviare se: identico all'ultima versione sincronizzata, oppure memoria privata mai inviata
    r.sync.sporco = !(r.sync.base === h && r.sync.sha) && !(r.sync.sha === null && !M.nelRepository(col, pulito));
    stato.collezioni[col][id] = r;
  };

  M.eliminaRecord = function (stato, col, id) {
    const r = stato.collezioni[col][id]; if (!r) return;
    if (!r.sync.sha) { delete stato.collezioni[col][id]; delete stato.sync.conflitti[col + "/" + id]; return; } // mai inviato
    r.sync.eliminato = true; r.sync.sporco = true;
  };

  M.inAttesa = (stato) => M.COLLEZIONI_SYNC.reduce((n, c) => n + Object.values(stato.collezioni[c]).filter((r) => r.sync.sporco).length, 0);

  // Dati "puliti" (senza metadati di sincronizzazione): formato dei backup e dell'impronta.
  M.datiPuliti = function (stato) {
    const d = {};
    for (const c of M.COLLEZIONI_APP) d[c] = M.elenco(stato, c);
    d.stato_lavoro = copia(stato.stato_lavoro || []).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return d;
  };

  // ---------- backup / ripristino / migrazione ----------
  M.creaBackup = async function (stato) {
    const dati = M.datiPuliti(stato);
    return { formato: "second-brain-backup", versione: 2, esportato_il: ora(), hash_sha256: await M.impronta(dati), dati };
  };
  // Backup della 1.0 (versione 1, con "memoria") → stessa forma della 1.1 (le memorie diventano note, identiche).
  M.datiV1aV2 = (d) => { const { memoria, ...resto } = d; return { ...resto, note: memoria || [], progetti: [] }; };
  M.verificaBackup = async function (file) {
    if (!file || file.formato !== "second-brain-backup" || !file.dati) throw new Error("Il file non è un backup di Second Brain.");
    if (file.versione !== 1 && file.versione !== 2) throw new Error("Versione del backup non supportata: aggiorna l'app.");
    const h = await M.impronta(file.dati);
    if (file.hash_sha256 !== h) throw new Error("L'impronta non corrisponde: il file è stato modificato o è danneggiato.");
    const cols = file.versione === 1 ? M.COLLEZIONI_BACKUP_V1 : M.COLLEZIONI_BACKUP;
    for (const c of cols) for (const r of file.dati[c] || []) if (!r || !ID_VALIDO.test(r.id || "")) throw new Error(`Record non valido in ${c}.`);
    const dati = file.versione === 1 ? M.datiV1aV2(file.dati) : file.dati;
    return { hashFile: h, dati, hashAtteso: await M.impronta(dati), versione: file.versione };
  };
  // Sostituisce i dati locali con quelli del file, conservando i riferimenti di sincronizzazione:
  // ciò che differisce dall'ultima versione sincronizzata diventa "da inviare", ciò che manca viene eliminato.
  M.ripristina = async function (stato, file) {
    const v = await M.verificaBackup(file);
    for (const c of M.COLLEZIONI_APP) {
      const nuovi = new Map((v.dati[c] || []).map((r) => [r.id, r]));
      for (const id of Object.keys(stato.collezioni[c])) if (!nuovi.has(id)) M.eliminaRecord(stato, c, id);
      for (const [id, r] of nuovi) { const { id: _x, ...dati } = r; await M.salvaRecord(stato, c, id, dati); }
    }
    stato.stato_lavoro = copia(v.dati.stato_lavoro || []);
    const dopo = await M.impronta(M.datiPuliti(stato));
    return { hashFile: v.hashFile, hashAtteso: v.hashAtteso, hashDopo: dopo, identico: dopo === v.hashAtteso, versione: v.versione };
  };

  // Elimina solo i dati di prova (fittizio: true) e i collegamenti che li riguardano. Le stanze reali
  // che avevano assegnato un agente fittizio perdono solo quell'assegnazione.
  M.eliminaFittizi = async function (stato) {
    const via = new Set(); let n = 0;
    for (const c of M.COLLEZIONI_APP) for (const r of M.elenco(stato, c)) if (r.fittizio === true) via.add(c + "/" + r.id);
    for (const co of M.elenco(stato, "collegamenti")) if ((co.agente_id && via.has("agenti/" + co.agente_id)) || (co.stanza_id && via.has("stanze/" + co.stanza_id))) via.add("collegamenti/" + co.id);
    for (const k of via) { const [c, id] = k.split("/"); M.eliminaRecord(stato, c, id); n++; }
    for (const s of M.elenco(stato, "stanze")) {
      const ag = (s.agenti_ids || []).filter((id) => !via.has("agenti/" + id));
      if (ag.length !== (s.agenti_ids || []).length) { const { id, ...d } = s; d.agenti_ids = ag; await M.salvaRecord(stato, "stanze", id, d); }
    }
    for (const a of M.elenco(stato, "agenti")) {
      const sk = (a.skill_ids || []).filter((id) => !via.has("skill/" + id));
      if (sk.length !== (a.skill_ids || []).length) { const { id, ...d } = a; d.skill_ids = sk; await M.salvaRecord(stato, "agenti", id, d); }
    }
    for (const m of M.elenco(stato, "note")) {
      const d0 = { ...m }; delete d0.id; let cambia = false;
      if (m.stanza_id && via.has("stanze/" + m.stanza_id)) { d0.stanza_id = null; cambia = true; }
      if (m.progetto_id && via.has("progetti/" + m.progetto_id)) { d0.progetto_id = null; cambia = true; }
      const cl = (m.collegamenti || []).filter((x) => !via.has("note/" + x));
      if (cl.length !== (m.collegamenti || []).length) { d0.collegamenti = cl; cambia = true; }
      if (cambia) await M.salvaRecord(stato, "note", m.id, d0);
    }
    for (const p of M.elenco(stato, "progetti")) if (p.stanza_id && via.has("stanze/" + p.stanza_id)) { const { id, ...d } = p; d.stanza_id = null; await M.salvaRecord(stato, "progetti", id, d); }
    return n;
  };
  // Relazioni realmente presenti (per la mappa): solo riferimenti a elementi esistenti.
  M.relazioni = function (stato) {
    const esiste = (c, id) => !!(id && M.trova(stato, c, id));
    const archi = [], visti = new Set();
    const aggiungi = (a, b, tipo) => { const k = [a, b].sort().join("|"); if (a !== b && !visti.has(k)) { visti.add(k); archi.push({ da: a, a: b, tipo }); } };
    for (const n of M.elenco(stato, "note")) {
      for (const x of n.collegamenti || []) if (esiste("note", x)) aggiungi("note/" + n.id, "note/" + x, "collegamento");
      if (esiste("stanze", n.stanza_id)) aggiungi("note/" + n.id, "stanze/" + n.stanza_id, "stanza");
      if (esiste("progetti", n.progetto_id)) aggiungi("note/" + n.id, "progetti/" + n.progetto_id, "progetto");
    }
    for (const p of M.elenco(stato, "progetti")) if (esiste("stanze", p.stanza_id)) aggiungi("progetti/" + p.id, "stanze/" + p.stanza_id, "stanza");
    return archi;
  };
  M.inEntrata = (stato, idNota) => M.elenco(stato, "note").filter((n) => n.id !== idNota && (n.collegamenti || []).includes(idNota));

  // ---------- 1.4: estratti di ricerca, notifiche di intervento, dati del widget ----------
  // Estratto del testo attorno alla prima occorrenza (per i risultati di ricerca, anche nelle chat lunghe).
  M.estratto = function (testo, q, larghezza = 90) {
    const t = String(testo || "").replace(/\s+/g, " "), i = q ? t.toLowerCase().indexOf(String(q).toLowerCase().trim()) : -1;
    if (i < 0) return t.slice(0, larghezza * 2);
    const da = Math.max(0, i - larghezza), a = Math.min(t.length, i + q.trim().length + larghezza);
    return (da > 0 ? "…" : "") + t.slice(da, a) + (a < t.length ? "…" : "");
  };
  // Sessioni che chiedono un tuo intervento e non sono ancora state notificate (per sessione e versione).
  M.interventiDaNotificare = function (stato) {
    const ist = (stato.stato_lavoro || []).find((x) => x.id === "istantanea"); if (!ist) return [];
    const fatti = (stato.impostazioni && stato.impostazioni.notificate) || {};
    return (ist.sessioni || []).filter((s) => s.richiede && /BLOCKED/.test(s.status_bucket || "") && fatti[s.id] !== (s.updated_at || s.richiede))
      .map((s) => ({ id: s.id, titolo: s.titolo || s.id, richiede: s.richiede, chiave: s.updated_at || s.richiede }));
  };
  M.segnaNotificati = function (stato, elenco) {
    stato.impostazioni ||= {}; stato.impostazioni.notificate ||= {};
    for (const x of elenco) stato.impostazioni.notificate[x.id] = x.chiave;
  };
  M.riepilogoWidget = function (stato) {
    const ist = (stato.stato_lavoro || []).find((x) => x.id === "istantanea");
    const attesa = ist ? (ist.sessioni || []).filter((s) => /BLOCKED/.test(s.status_bucket || "")).length : 0;
    return { inbox: M.elenco(stato, "note").filter((n) => !["area", "risorsa", "archivio"].includes(n.categoria)).length,
      progetti: M.elenco(stato, "progetti").filter((p) => (p.stato || "attivo") === "attivo").length,
      attesa, rilevato: ist ? ist.rilevato_il : null, sync: stato.sync.ultimo_ok || null, da_inviare: M.inAttesa(stato) };
  };

  // ---------- 1.3: ogni sessione di Claude Code dell'istantanea diventa una nota privata ----------
  // Aggiornata solo se la sessione è cambiata E l'utente non ha modificato la nota (corretto_il assente).
  M.noteDaSessioni = async function (stato) {
    const ist = (stato.stato_lavoro || []).find((x) => x.id === "istantanea"); if (!ist) return { create: 0, aggiornate: 0 };
    const BK = { WORKING: "in esecuzione", BLOCKED: "attende un tuo intervento", REVIEW_READY: "pronta per revisione", COMPLETED: "completata", FAILED: "fallita", IDLE: "inattiva" };
    const esito = { create: 0, aggiornate: 0 };
    for (const se of ist.sessioni || []) {
      if (!/^session_[A-Za-z0-9]+$/.test(se.id || "")) continue;
      const id = "sessione-" + se.id.slice(8, 120);
      const r = stato.collezioni.note[id];
      const statoS = BK[String(se.status_bucket || "").replace("SESSION_STATUS_BUCKET_", "")] || "sconosciuto";
      const testo = [`Sessione di Claude Code «${se.titolo || se.id}».`, `Stato rilevato: ${statoS} (rilevazione del ${String(ist.rilevato_il).slice(0, 16).replace("T", " ")} UTC, non in tempo reale).`,
        se.riepilogo ? `Ultimo riepilogo: ${se.riepilogo}` : null, se.richiede ? `Richiede un tuo intervento: ${se.richiede}` : null,
        `Creata: ${String(se.created_at || "").slice(0, 16).replace("T", " ")} · ultima attività: ${String(se.updated_at || "").slice(0, 16).replace("T", " ")}${se.origin ? " · origine " + se.origin : ""}.`,
        `Identificativo: ${se.id}`].filter(Boolean).join("\n");
      const origine = { tipo: "sessione_claude_code", id: se.id, aggiornata_il: se.updated_at || null, stato: statoS };
      if (!r) {
        await M.salvaRecord(stato, "note", id, { titolo: "Sessione: " + (se.titolo || se.id), testo, tipo: "riassunto", fonte: `Claude Code, istantanea del ${ist.rilevato_il}`, data: se.created_at || ist.rilevato_il,
          registrato_il: ora(), categoria: "inbox", tag: ["sessione-claude-code"], collegamenti: [], accessibile_agenti: false, origine });
        esito.create++;
      } else if (!r.sync.eliminato && !r.dati.corretto_il && r.dati.origine && (r.dati.origine.aggiornata_il !== origine.aggiornata_il || r.dati.origine.stato !== statoS)) {
        await M.salvaRecord(stato, "note", id, { ...r.dati, testo, fonte: `Claude Code, istantanea del ${ist.rilevato_il}`, origine, aggiornato_il: ora() });
        esito.aggiornate++;
      }
    }
    return esito;
  };
  // ---------- 1.5: organizzazione automatica ----------
  // Ogni nuova sessione di Claude Code finisce nella stanza (area) e nel progetto giusti: se non esistono vengono creati.
  // Le chat importate diventano risorse della stanza più simile; le chat senza stanza ma con lo stesso argomento (almeno 2) ne creano una.
  // Ogni nota viene organizzata UNA sola volta (campo auto_organizzata): se sposti o elimini qualcosa, l'app non lo rifà.
  const VUOTE = new Set("della delle dello degli del dei con per tra fra una uno gli le la il lo di da in su a e o the and for with app setup".split(" "));
  M.parole = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !VUOTE.has(w)));
  M.nucleoTitolo = (t) => String(t || "").split(/\s[—–-]\s|[—–:|]|(?<=\S)-(?=[A-ZÀ-Ý])/)[0].trim().slice(0, 100);
  const affinita = (a, b) => { const A = M.parole(a), B = M.parole(b); if (!A.size || !B.size) return 0; let c = 0; for (const w of A) if (B.has(w)) c++; return c / Math.min(A.size, B.size); };
  function stanzaPiuSimile(stato, testo, soglia) {
    let meglio = null, punti = 0;
    for (const s of M.elenco(stato, "stanze")) {
      if ((s.stato || (s.archiviata ? "archiviata" : "attiva")) === "archiviata" || s.fittizio) continue;
      const p = Math.max(affinita(testo, s.nome), affinita(testo, s.nome + " " + (s.descrizione || "")) * 0.9);
      if (p > punti) { punti = p; meglio = s; }
    }
    return punti >= soglia ? meglio : null;
  }
  async function nuovaStanza(stato, nome, perche) {
    const id = "st-auto-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    await M.salvaRecord(stato, "stanze", id, { nome, descrizione: perche, obiettivi: [], agenti_ids: [], stato: "attiva", attivita: [], automatico: true, creato_il: ora() });
    return M.elenco(stato, "stanze").find((s) => s.id === id);
  }
  M.organizzaAutomatico = async function (stato) {
    const esito = { stanze: 0, progetti: 0, note: 0 };
    if (stato.impostazioni && stato.impostazioni.auto_organizza === false) return esito;
    const note = M.elenco(stato, "note").filter((n) => !n.auto_organizzata && !n.corretto_il && !n.stanza_id && !n.progetto_id && !n.fittizio);
    // 1) sessioni di Claude Code → stanza + progetto
    for (const n of note.filter((x) => x.origine && x.origine.tipo === "sessione_claude_code")) {
      const nome = M.nucleoTitolo(String(n.titolo || "").replace(/^Sessione:\s*/, "")) || "Senza titolo";
      let st = stanzaPiuSimile(stato, nome, 0.5);
      if (!st) { st = await nuovaStanza(stato, nome, `Creata automaticamente dalla sessione di Claude Code «${n.titolo.replace(/^Sessione:\s*/, "")}».`); esito.stanze++; }
      let pr = M.elenco(stato, "progetti").find((p) => p.stanza_id === st.id && (p.stato || "attivo") === "attivo");
      if (!pr) {
        const pid = "pr-auto-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        await M.salvaRecord(stato, "progetti", pid, { nome: st.nome, obiettivo: "", stato: "attivo", stanza_id: st.id, automatico: true, creato_il: ora() });
        pr = { id: pid }; esito.progetti++;
      }
      const { id, ...d } = n;
      const chiusa = n.origine.stato === "completata" && Date.now() - Date.parse(n.origine.aggiornata_il || 0) > 14 * 864e5;
      await M.salvaRecord(stato, "note", id, { ...d, stanza_id: st.id, progetto_id: pr.id, categoria: chiusa ? "archivio" : "risorsa", auto_organizzata: true });
      esito.note++;
    }
    // 2) chat importate → risorsa della stanza più simile; argomenti ricorrenti senza stanza → nuova stanza
    const chat = note.filter((x) => (x.tag || []).includes("chat-claude"));
    const senza = [];
    for (const n of chat) {
      const st = stanzaPiuSimile(stato, (n.titolo || "") + " " + String(n.testo || "").slice(0, 300), 0.6) || stanzaPiuSimile(stato, n.titolo, 0.5);
      if (st) { const { id, ...d } = n; await M.salvaRecord(stato, "note", id, { ...d, stanza_id: st.id, categoria: "risorsa", auto_organizzata: true }); esito.note++; }
      else senza.push(n);
    }
    const usate = new Set();
    for (const a of senza) {
      if (usate.has(a.id)) continue;
      const gruppo = senza.filter((b) => !usate.has(b.id) && (b === a || affinita(M.nucleoTitolo(a.titolo), M.nucleoTitolo(b.titolo)) >= 0.6));
      if (gruppo.length < 2) continue;
      const st = await nuovaStanza(stato, M.nucleoTitolo(a.titolo) || "Chat", `Creata automaticamente da ${gruppo.length} chat di Claude sullo stesso argomento.`); esito.stanze++;
      for (const n of gruppo) { usate.add(n.id); const { id, ...d } = n; await M.salvaRecord(stato, "note", id, { ...d, stanza_id: st.id, categoria: "risorsa", auto_organizzata: true }); esito.note++; }
    }
    if (esito.stanze || esito.note) stato.sync.ultima_organizzazione = { quando: ora(), ...esito };
    return esito;
  };

  // Promemoria per l'esportazione delle chat di claude.ai (non automatizzabile: nessuna API ufficiale).
  M.promemoriaChat = function (stato, adesso = Date.now()) {
    const imp = stato.impostazioni || {};
    if (imp.chat_rimandato_fino && Date.parse(imp.chat_rimandato_fino) > adesso) return null;
    const ultimo = imp.ultimo_import_chat ? Date.parse(imp.ultimo_import_chat) : null;
    const giorni = ultimo ? Math.floor((adesso - ultimo) / 86400000) : null;
    return giorni === null || giorni >= 30 ? { giorni } : null;
  };

  // ---------- 1.2: collegamenti scritti nel testo come [[Titolo]] ----------
  M.titoloNota = (n) => (n.titolo && String(n.titolo).trim()) || String(n.testo || "").split("\n")[0].slice(0, 80).trim();
  M.estraiLink = (testo) => [...String(testo || "").matchAll(/\[\[([^\[\]\n]{1,150})\]\]/g)].map((m) => m[1].split("|")[0].split("#")[0].trim()).filter(Boolean); // [[Titolo|alias]] e [[Titolo#sezione]] come in Obsidian
  // Risolve un titolo: una sola nota con quel titolo → collegamento; nessuna o più di una → non collega (lo segnala).
  M.risolviTitolo = function (stato, titolo, escludiId) {
    const t = String(titolo).toLowerCase().trim();
    const trovate = M.elenco(stato, "note").filter((n) => n.id !== escludiId && M.titoloNota(n).toLowerCase() === t);
    return trovate.length === 1 ? { id: trovate[0].id } : { id: null, motivo: trovate.length ? "ambiguo" : "mancante", quante: trovate.length };
  };
  M.collegamentiDaTesto = function (stato, testo, escludiId) {
    const ok = [], problemi = [];
    for (const t of [...new Set(M.estraiLink(testo))]) { const r = M.risolviTitolo(stato, t, escludiId); if (r.id) ok.push(r.id); else problemi.push({ titolo: t, motivo: r.motivo }); }
    return { ids: [...new Set(ok)], problemi };
  };

  // ---------- 1.2: note simili (mai unite automaticamente) ----------
  const parole = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
  M.somiglianza = function (a, b) {
    const A = parole(a), B = parole(b); if (!A.size || !B.size) return 0;
    let c = 0; for (const w of A) if (B.has(w)) c++;
    return c / (A.size + B.size - c);
  };
  M.SOGLIA_SIMILI = 0.6;
  M.noteSimili = function (stato, id, soglia = M.SOGLIA_SIMILI) {
    const n = M.trova(stato, "note", id); if (!n) return [];
    const base = M.titoloNota(n) + " " + n.testo;
    return M.elenco(stato, "note").filter((x) => x.id !== id).map((x) => ({ id: x.id, punteggio: M.somiglianza(base, M.titoloNota(x) + " " + x.testo) }))
      .filter((x) => x.punteggio >= soglia).sort((a, b) => b.punteggio - a.punteggio);
  };
  M.gruppiSimili = function (stato, soglia = M.SOGLIA_SIMILI, limite = 1500) {
    const note = M.elenco(stato, "note"); if (note.length > limite) return null;
    const insiemi = note.map((n) => parole(M.titoloNota(n) + " " + n.testo)); let coppie = 0;
    for (let i = 0; i < note.length; i++) for (let j = i + 1; j < note.length; j++) {
      const A = insiemi[i], B = insiemi[j]; if (!A.size || !B.size) continue;
      let c = 0; for (const w of A) if (B.has(w)) c++;
      if (c / (A.size + B.size - c) >= soglia) coppie++;
    }
    return coppie;
  };

  // ---------- 1.2: importazione delle chat di Claude (file conversations.json dell'esportazione) ----------
  // Il formato non è documentato ufficialmente: si accettano solo i campi riconosciuti e si segnala il resto.
  const testoMessaggio = (m) => (typeof m.text === "string" && m.text.trim()) ? m.text : (Array.isArray(m.content) ? m.content.filter((c) => c && c.type === "text" && typeof c.text === "string").map((c) => c.text).join("\n") : "");
  M.analizzaChatClaude = function (dati) {
    if (!Array.isArray(dati)) throw new Error("Il file non contiene un elenco di conversazioni (conversations.json).");
    const chat = [], scartate = []; let allegatiIgnorati = 0;
    for (const c of dati) {
      if (!c || typeof c.uuid !== "string" || !Array.isArray(c.chat_messages)) { scartate.push("elemento senza uuid o messaggi"); continue; }
      const msg = c.chat_messages.filter((m) => m && (m.sender === "human" || m.sender === "assistant"));
      for (const m of msg) allegatiIgnorati += (Array.isArray(m.attachments) ? m.attachments.length : 0) + (Array.isArray(m.files) ? m.files.length : 0);
      const righe = msg.map((m) => ({ chi: m.sender === "human" ? "Tu" : "Claude", quando: m.created_at, testo: testoMessaggio(m).trim() })).filter((r) => r.testo);
      if (!righe.length) { scartate.push(`«${c.name || c.uuid}»: nessun messaggio di testo`); continue; }
      const id = "chat-" + c.uuid.replace(/[^A-Za-z0-9-]/g, "").slice(0, 100);
      chat.push({ id, uuid: c.uuid, titolo: (c.name || "").trim() || "Chat senza titolo", creata: c.created_at || righe[0].quando || null, aggiornata: c.updated_at || null, messaggi: righe.length,
        testo: righe.map((r) => `${r.chi}${r.quando ? " (" + String(r.quando).slice(0, 16).replace("T", " ") + ")" : ""}:\n${r.testo}`).join("\n\n") });
    }
    return { chat, scartate, allegatiIgnorati };
  };
  // Crea una nota ORIGINALE e PRIVATA per ogni chat nuova. Le chat già importate non vengono mai sovrascritte.
  M.importaChatClaude = async function (stato, analisi, quando) {
    const esito = { importate: 0, gia_presenti: 0, piu_recenti_non_sovrascritte: 0 };
    for (const c of analisi.chat) {
      const esistente = stato.collezioni.note[c.id];
      if (esistente && !esistente.sync.eliminato) {
        esito.gia_presenti++;
        if (c.aggiornata && esistente.dati.origine && esistente.dati.origine.aggiornata_il && c.aggiornata > esistente.dati.origine.aggiornata_il) esito.piu_recenti_non_sovrascritte++;
        continue;
      }
      await M.salvaRecord(stato, "note", c.id, { titolo: c.titolo, testo: c.testo, tipo: "originale", fonte: `Chat di Claude «${c.titolo}» (claude.ai, esportazione)`,
        data: c.creata || quando, registrato_il: quando, categoria: "inbox", tag: ["chat-claude"], collegamenti: [], accessibile_agenti: false,
        origine: { tipo: "chat_claude", id: c.uuid, aggiornata_il: c.aggiornata, messaggi: c.messaggi } });
      esito.importate++;
    }
    stato.impostazioni ||= {}; stato.impostazioni.ultimo_import_chat = quando;
    await M.organizzaAutomatico(stato); // esito in stato.sync.ultima_organizzazione
    return esito;
  };

  // Lettura minima di un file ZIP (esportazione di claude.ai): restituisce il testo di un file per nome.
  M.leggiDaZip = async function (bytes, nomeCercato) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Archivio ZIP non valido.");
    let p = v.getUint32(eocd + 16, true); const voci = v.getUint16(eocd + 10, true); const nomi = [];
    for (let k = 0; k < voci; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Indice dello ZIP danneggiato.");
      const metodo = v.getUint16(p + 10, true), compr = v.getUint32(p + 20, true), lnome = v.getUint16(p + 28, true), lextra = v.getUint16(p + 30, true), lcomm = v.getUint16(p + 32, true), loc = v.getUint32(p + 42, true);
      const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + lnome)); nomi.push(nome);
      if (nome === nomeCercato || nome.endsWith("/" + nomeCercato)) {
        const inizio = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true);
        const dati = bytes.subarray(inizio, inizio + compr);
        if (metodo === 0) return new TextDecoder().decode(dati);
        if (metodo !== 8) throw new Error("Compressione dello ZIP non supportata.");
        const flusso = new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return await new Response(flusso).text();
      }
      p += 46 + lnome + lextra + lcomm;
    }
    throw new Error(`Nell'archivio non c'è ${nomeCercato} (file trovati: ${nomi.slice(0, 8).join(", ")}).`);
  };

  // Tutte le voci di uno ZIP che soddisfano filtro(nome) → [{nome, testo}] (per le cassaforti di Obsidian).
  M.leggiTuttiDaZip = async function (bytes, filtro, massimo = 5000) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Archivio ZIP non valido.");
    let p = v.getUint32(eocd + 16, true); const voci = v.getUint16(eocd + 10, true), out = [];
    for (let k = 0; k < voci && out.length < massimo; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error("Indice dello ZIP danneggiato.");
      const metodo = v.getUint16(p + 10, true), compr = v.getUint32(p + 20, true), lnome = v.getUint16(p + 28, true), lextra = v.getUint16(p + 30, true), lcomm = v.getUint16(p + 32, true), loc = v.getUint32(p + 42, true);
      const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + lnome));
      if (!nome.endsWith("/") && filtro(nome)) {
        const inizio = loc + 30 + v.getUint16(loc + 26, true) + v.getUint16(loc + 28, true), dati = bytes.subarray(inizio, inizio + compr);
        let testo;
        if (metodo === 0) testo = new TextDecoder().decode(dati);
        else if (metodo === 8) testo = await new Response(new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
        else throw new Error("Compressione dello ZIP non supportata.");
        out.push({ nome, testo });
      }
      p += 46 + lnome + lextra + lcomm;
    }
    return out;
  };

  // ---------- 1.8: come Obsidian ----------
  // #tag nel testo (non i titoli "# Titolo", non i numeri puri, non dentro il codice)
  M.tagsDaTesto = function (testo) {
    const pulito = String(testo || "").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    const out = new Set(); for (const m of pulito.matchAll(/(^|[\s(])#([\p{L}\p{N}_\-/]+)/gu)) if (!/^\d+$/.test(m[2])) out.add(m[2].toLowerCase());
    return [...out];
  };
  M.tagNota = (n) => [...new Set([...(n.tag || []).map((t) => String(t).toLowerCase()), ...M.tagsDaTesto(n.testo)])];
  M.tuttiTag = function (stato) {
    const c = new Map(); for (const n of M.elenco(stato, "note")) for (const t of M.tagNota(n)) c.set(t, (c.get(t) || 0) + 1);
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, quante]) => ({ tag, quante }));
  };
  // Citazioni non collegate: altre note che nominano il titolo di questa senza collegarla
  const regTitolo = (t) => new RegExp("(^|[^\\p{L}\\p{N}\\[])(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![\\p{L}\\p{N}\\]])", "iu");
  M.menzioniNonCollegate = function (stato, idNota) {
    const n = M.trova(stato, "note", idNota); if (!n) return [];
    const t = M.titoloNota(n).trim(); if (t.length < 3) return [];
    const r = regTitolo(t);
    return M.elenco(stato, "note").filter((x) => x.id !== idNota && !(x.collegamenti || []).includes(idNota) && r.test(String(x.testo || "").replace(/\[\[[^\]]*\]\]/g, "")));
  };
  M.collegaMenzione = async function (stato, idSorgente, idDest) {
    const s = M.trova(stato, "note", idSorgente), d = M.trova(stato, "note", idDest); if (!s || !d) return false;
    const t = M.titoloNota(d).trim(); let fatto = false;
    const testo = String(s.testo).replace(regTitolo(t), (m, pre, parola) => { fatto = true; return pre + "[[" + parola + "]]"; });
    const { id, ...dati } = s;
    await M.salvaRecord(stato, "note", id, { ...dati, testo, collegamenti: [...new Set([...(s.collegamenti || []), idDest])], aggiornato_il: ora() });
    return fatto;
  };
  // Modelli: note con il tag #modello. Segnaposto come in Obsidian: {{date}} {{time}} {{title}} (anche in italiano).
  M.modelli = (stato) => M.elenco(stato, "note").filter((n) => M.tagNota(n).includes("modello"));
  M.applicaModello = function (testo, { titolo = "", quando = new Date() } = {}) {
    const d = new Date(quando), z = (x) => String(x).padStart(2, "0");
    const data = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, orario = `${z(d.getHours())}:${z(d.getMinutes())}`;
    return String(testo || "").replace(/\{\{\s*(date|data)\s*\}\}/gi, data).replace(/\{\{\s*(time|ora)\s*\}\}/gi, orario).replace(/\{\{\s*(title|titolo)\s*\}\}/gi, titolo)
      .replace(/(^|\n)#modello\b[^\n]*/g, "$1").replace(/^\n+/, "");
  };
  // Nota del giorno (Daily note): una sola per data; usa il modello «Nota del giorno» se esiste
  M.notaDelGiorno = async function (stato, quando = new Date()) {
    const d = new Date(quando), z = (x) => String(x).padStart(2, "0"), data = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, id = "giorno-" + data;
    const r = stato.collezioni.note[id]; if (r && !r.sync.eliminato) return { id, nuova: false };
    const mod = M.modelli(stato).find((m) => /giorno|daily/i.test(M.titoloNota(m)));
    const testo = mod ? M.applicaModello(mod.testo, { titolo: data, quando: d }) : `## Attività\n- [ ] \n\n## Note\n\n`;
    await M.salvaRecord(stato, "note", id, { titolo: data, testo, tipo: "originale", fonte: "Nota del giorno", data: d.toISOString(), registrato_il: ora(), categoria: "inbox", tag: ["giornaliero"], collegamenti: [], accessibile_agenti: false });
    return { id, nuova: true };
  };
  // Spunta della n-esima casella "- [ ]" nel testo (dalla vista formattata)
  M.spunta = function (testo, indice) {
    let k = -1; return String(testo).replace(/^(\s*[-*+]\s+\[)( |x|X)(\])/gm, (m, a, b, c) => (++k === indice ? a + (b === " " ? "x" : " ") + c : m));
  };

  // Markdown → HTML sicuro (tutto il testo viene prima "escapato"). risolvi(titolo) → id nota o null.
  M.markdown = function (testo, risolvi) {
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const blocchiCodice = [];
    let src = String(testo || "").replace(/\r/g, "").replace(/```([^\n]*)\n([\s\S]*?)```/g, (m, l, c) => { blocchiCodice.push(c); return `\u0000C${blocchiCodice.length - 1}\u0000`; });
    let casella = -1;
    const inline = (t) => {
      const codici = []; t = t.replace(/`([^`\n]+)`/g, (m, c) => { codici.push(c); return `\u0000I${codici.length - 1}\u0000`; });
      t = esc(t)
        .replace(/!?\[\[([^\[\]\n|]{1,150})(?:\|([^\[\]\n]{1,150}))?\]\]/g, (m, dest, alias) => {
          const vero = dest.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").split("#")[0].trim();
          const id = risolvi ? risolvi(vero) : null, vis = alias || dest;
          return id ? `<a class="wl" href="#nota" data-apri="nota" data-id="${esc(id)}">${vis}</a>` : `<a class="wl rotto" href="#nota" data-crea-nota="${esc(vero)}">${vis}</a>`;
        })
        .replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^)\s]{1,500})\)/g, (m, txt, url) => `<a class="ext" href="#" data-link="${url}">${txt}</a>`)
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>").replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
        .replace(/~~([^~\n]+)~~/g, "<del>$1</del>").replace(/==([^=\n]+)==/g, "<mark>$1</mark>")
        .replace(/(^|[\s(])#([\p{L}\p{N}_\-/]+)/gu, (m, pre, tag) => (/^\d+$/.test(tag) ? m : `${pre}<a class="tag" href="#note" data-tag="${tag.toLowerCase()}">#${tag}</a>`));
      return t.replace(/\u0000I(\d+)\u0000/g, (m, i) => `<code>${esc(codici[+i])}</code>`);
    };
    const righe = src.split("\n"), out = []; let lista = null, para = [];
    const chiudiPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
    const chiudiLista = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
    for (const r of righe) {
      let m;
      if ((m = r.match(/^\u0000C(\d+)\u0000$/))) { chiudiPara(); chiudiLista(); out.push(`<pre><code>${esc(blocchiCodice[+m[1]])}</code></pre>`); continue; }
      if (!r.trim()) { chiudiPara(); chiudiLista(); continue; }
      if ((m = r.match(/^(#{1,6})\s+(.*)$/))) { chiudiPara(); chiudiLista(); out.push(`<h${m[1].length + 1 > 6 ? 6 : m[1].length + 1} class="md-h">${inline(m[2])}</h${m[1].length + 1 > 6 ? 6 : m[1].length + 1}>`); continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(r)) { chiudiPara(); chiudiLista(); out.push("<hr>"); continue; }
      if ((m = r.match(/^>\s?(.*)$/))) { chiudiPara(); chiudiLista(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
      if ((m = r.match(/^\s*[-*+]\s+\[( |x|X)\]\s?(.*)$/))) { chiudiPara(); if (lista !== "ul") { chiudiLista(); out.push('<ul class="task">'); lista = "ul"; } casella++; out.push(`<li><label><input type="checkbox" data-spunta="${casella}"${m[1] !== " " ? " checked" : ""}> <span>${inline(m[2])}</span></label></li>`); continue; }
      if ((m = r.match(/^\s*[-*+]\s+(.*)$/))) { chiudiPara(); if (lista !== "ul") { chiudiLista(); out.push("<ul>"); lista = "ul"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = r.match(/^\s*\d+[.)]\s+(.*)$/))) { chiudiPara(); if (lista !== "ol") { chiudiLista(); out.push("<ol>"); lista = "ol"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      chiudiLista(); para.push(r);
    }
    chiudiPara(); chiudiLista();
    return out.join("\n");
  };

  // ---------- cassaforte di Obsidian: esportazione e importazione ----------
  const CARTELLE = { inbox: "0 Da organizzare", progetto: "1 Progetti", area: "2 Aree", risorsa: "3 Risorse", archivio: "4 Archivio" };
  const nomeFile = (t) => String(t || "Senza titolo").replace(/[\\/:*?"<>|#^\[\]\n\r\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Senza titolo";
  const yamlVal = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(String(x))).join(", ")}]` : v === null || v === undefined ? '""' : typeof v === "boolean" || typeof v === "number" ? String(v) : JSON.stringify(String(v)));
  M.vaultObsidian = function (stato) {
    const usati = new Set(), file = [], nomeDi = new Map();
    const note = M.elenco(stato, "note").filter((n) => !n.fittizio);
    for (const n of note) { // nomi unici (Obsidian collega per nome del file)
      let b = nomeFile(M.titoloNota(n)), k = 2, f = b; while (usati.has(f.toLowerCase())) f = `${b} (${k++})`; usati.add(f.toLowerCase()); nomeDi.set(n.id, f);
    }
    for (const n of note) {
      const st = M.trova(stato, "stanze", n.stanza_id), pr = M.trova(stato, "progetti", n.progetto_id);
      const cat = n.progetto_id && (n.categoria || "inbox") === "inbox" ? "progetto" : (CARTELLE[n.categoria] ? n.categoria : "inbox");
      const fm = { "sb-id": n.id, tags: M.tagNota(n), tipo: n.tipo || "", fonte: n.fonte || "", data: n.data || "", stanza: st ? st.nome : "", progetto: pr ? pr.nome : "", "accessibile-agenti": n.accessibile_agenti === true, creato: n.registrato_il || "" };
      let corpo = String(n.testo || "");
      const mancanti = (n.collegamenti || []).filter((x) => nomeDi.has(x) && !corpo.includes("[[" + nomeDi.get(x)));
      if (mancanti.length) corpo += `\n\n## Collegamenti\n${mancanti.map((x) => `- [[${nomeDi.get(x)}]]`).join("\n")}\n`;
      file.push({ percorso: `${CARTELLE[cat]}/${nomeDi.get(n.id)}.md`, testo: `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${yamlVal(v)}`).join("\n")}\n---\n${corpo}` });
    }
    for (const s of M.elenco(stato, "stanze").filter((x) => !x.fittizio)) {
      const dentro = note.filter((n) => n.stanza_id === s.id).map((n) => `- [[${nomeDi.get(n.id)}]]`);
      file.push({ percorso: `Stanze/${nomeFile(s.nome)}.md`, testo: `---\nsb-id: ${yamlVal(s.id)}\ntags: ["stanza"]\n---\n${s.descrizione || ""}\n\n## Obiettivi\n${(s.obiettivi || []).map((o) => "- " + o).join("\n")}\n\n## Note\n${dentro.join("\n")}\n` });
    }
    return file;
  };
  // ZIP senza compressione (formato "store"), leggibile da qualunque programma e da Obsidian
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  M.zip = function (file, radice = "") {
    const enc = new TextEncoder(), parti = [], centrali = []; let off = 0;
    for (const f of file) {
      const nome = enc.encode(radice + f.percorso), dati = enc.encode(f.testo), crc = crc32(dati);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, dati.length, true); h.setUint32(22, dati.length, true); h.setUint16(26, nome.length, true);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, dati.length, true); c.setUint32(24, dati.length, true); c.setUint16(28, nome.length, true); c.setUint32(42, off, true);
      parti.push(new Uint8Array(h.buffer), nome, dati); centrali.push(new Uint8Array(c.buffer), nome); off += 30 + nome.length + dati.length;
    }
    const lc = centrali.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, file.length, true); e.setUint16(10, file.length, true); e.setUint32(12, lc, true); e.setUint32(16, off, true);
    const tutto = [...parti, ...centrali, new Uint8Array(e.buffer)], out = new Uint8Array(tutto.reduce((a, b) => a + b.length, 0));
    let p = 0; for (const b of tutto) { out.set(b, p); p += b.length; } return out;
  };
  // Proprietà YAML semplici (chiave: valore, liste [a, b] o "- a")
  M.leggiProprieta = function (testo) {
    const m = String(testo).replace(/^﻿/, "").match(/^---\n([\s\S]*?)\n---\n?/); if (!m) return { prop: {}, corpo: String(testo) };
    const prop = {}; let ultima = null;
    for (const r of m[1].split("\n")) {
      let k;
      if ((k = r.match(/^\s*-\s+(.*)$/)) && ultima) { (prop[ultima] = Array.isArray(prop[ultima]) ? prop[ultima] : []).push(k[1].replace(/^["']|["']$/g, "")); continue; }
      if ((k = r.match(/^([\w\-]+):\s*(.*)$/))) {
        ultima = k[1]; let v = k[2].trim();
        if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        else if (v === "true" || v === "false") v = v === "true"; else v = v.replace(/^["']|["']$/g, "");
        prop[ultima] = v === "" ? (prop[ultima] || "") : v;
      }
    }
    return { prop, corpo: String(testo).slice(m[0].length) };
  };
  // Importa i .md di una cassaforte: note nuove PRIVATE; mai sovrascrivere note esistenti.
  M.importaVault = async function (stato, file, quando) {
    const esito = { importate: 0, gia_presenti: 0, ignorate: 0 }, inv = Object.fromEntries(Object.entries(CARTELLE).map(([k, v]) => [v.toLowerCase(), k]));
    for (const f of file) {
      if (!/\.md$/i.test(f.nome) || /(^|\/)\.(obsidian|trash)\//.test(f.nome)) { esito.ignorate++; continue; }
      const { prop, corpo } = M.leggiProprieta(f.testo), parti = f.nome.split("/"), titolo = parti[parti.length - 1].replace(/\.md$/i, "");
      if ((Array.isArray(prop.tags) ? prop.tags : []).includes("stanza")) { esito.ignorate++; continue; }
      const id = /^[\w\-]{1,120}$/.test(prop["sb-id"] || "") ? prop["sb-id"] : "md-" + (await M.impronta(f.nome)).slice(0, 24);
      if (stato.collezioni.note[id] && !stato.collezioni.note[id].sync.eliminato) { esito.gia_presenti++; continue; }
      const cartella = (parti.length > 1 ? parti[parti.length - 2] : "").toLowerCase();
      const tag = [...new Set([...(Array.isArray(prop.tags) ? prop.tags : prop.tags ? [prop.tags] : []).map((t) => String(t).replace(/^#/, "").toLowerCase()), "obsidian"])];
      await M.salvaRecord(stato, "note", id, { titolo, testo: corpo.replace(/^\n+/, ""), tipo: prop.tipo || "originale", fonte: prop.fonte || `Obsidian (${f.nome})`, data: prop.data || prop.created || quando, registrato_il: quando,
        categoria: inv[cartella] && inv[cartella] !== "progetto" ? inv[cartella] : "inbox", tag, collegamenti: [], accessibile_agenti: false });
      esito.importate++;
    }
    // i [[collegamenti]] scritti diventano collegamenti reali quando il titolo è unico
    for (const n of M.elenco(stato, "note").filter((x) => (x.tag || []).includes("obsidian"))) {
      const c = M.collegamentiDaTesto(stato, n.testo, n.id).ids || [];
      if (c.length && c.some((x) => !(n.collegamenti || []).includes(x))) { const { id, ...d } = n; await M.salvaRecord(stato, "note", id, { ...d, collegamenti: [...new Set([...(n.collegamenti || []), ...c])] }); }
    }
    return esito;
  };

  // ---------- 1.8: esecuzioni con più agenti ----------
  M.agentiDi = (c) => (Array.isArray(c.agenti_ids) && c.agenti_ids.length ? c.agenti_ids : c.agente_id ? [c.agente_id] : []);
  // Prepara le istruzioni per una nuova sessione di Claude Code con più agenti. La sessione si rinomina «SB·<codice> …»,
  // così alla rilevazione successiva l'app la collega da sola agli agenti e alla stanza scelti.
  M.preparaEsecuzione = function (stato, { agenti_ids, stanza_id, compito, modo = "coordinati" }) {
    const ag = (agenti_ids || []).map((id) => M.trova(stato, "agenti", id)).filter(Boolean);
    if (!ag.length) throw new Error("Scegli almeno un agente.");
    if (!String(compito || "").trim()) throw new Error("Scrivi il compito.");
    const codice = Math.random().toString(36).slice(2, 7), st = M.trova(stato, "stanze", stanza_id);
    const sk = (a) => (a.skill_ids || []).map((id) => (M.trova(stato, "skill", id) || {}).nome).filter(Boolean);
    const righe = [
      `Esecuzione multi-agente di Second Brain (codice ${codice}).`,
      `Per prima cosa rinomina questa sessione con set_session_title in «SB·${codice} ${String(compito).trim().slice(0, 50)}».`,
      "", `Compito: ${String(compito).trim()}`, st ? `Stanza: ${st.nome}${st.descrizione ? " — " + st.descrizione : ""}${(st.obiettivi || []).length ? " (obiettivi: " + st.obiettivi.join("; ") + ")" : ""}` : null,
      "", `Agenti (${modo === "sequenza" ? "uno dopo l'altro, ognuno parte dal risultato del precedente" : "in parallelo come subagenti, poi unisci i risultati"}):`,
      ...ag.map((a, i) => `${i + 1}. ${a.nome}${a.ruolo ? " — " + a.ruolo : ""}${sk(a).length ? " · skill: " + sk(a).join(", ") : ""}${a.istruzioni ? "\n   Istruzioni: " + String(a.istruzioni).split("\n")[0].slice(0, 300) : ""}`),
      "", "Se un agente esiste in .claude/agents usa quella definizione; altrimenti segui il ruolo e le istruzioni qui sopra.",
      "Chiedimi solo l'essenziale. Alla fine scrivi un riepilogo: cosa ha fatto ogni agente, risultato, cosa resta da decidere.",
    ].filter((x) => x !== null);
    stato.impostazioni ||= {}; stato.impostazioni.esecuzioni_previste ||= {};
    stato.impostazioni.esecuzioni_previste[codice] = { agenti_ids: ag.map((a) => a.id), stanza_id: st ? st.id : null, compito: String(compito).trim().slice(0, 300), modo, creata_il: ora() };
    return { codice, prompt: righe.join("\n") };
  };
  // Collega le sessioni rinominate «SB·<codice>» alle esecuzioni previste (una volta sola)
  M.collegaEsecuzioniPreviste = async function (stato) {
    const prev = (stato.impostazioni && stato.impostazioni.esecuzioni_previste) || {}, ist = (stato.stato_lavoro || []).find((x) => x.id === "istantanea");
    let n = 0; if (!ist) return n;
    for (const se of ist.sessioni || []) {
      const m = String(se.titolo || "").match(/^SB·([a-z0-9]{5})\b/); const p = m && prev[m[1]];
      if (!p || p.session_id) continue;
      if (M.elenco(stato, "collegamenti").some((c) => c.session_id === se.id)) { p.session_id = se.id; continue; }
      const id = "co-" + m[1];
      await M.salvaRecord(stato, "collegamenti", id, { session_id: se.id, agenti_ids: p.agenti_ids, agente_id: p.agenti_ids[0] || null, stanza_id: p.stanza_id, compito: p.compito, creato_il: ora() });
      p.session_id = se.id; n++;
    }
    return n;
  };

  M.contaFittizi = (stato) => M.COLLEZIONI_APP.reduce((n, c) => n + M.elenco(stato, c).filter((r) => r.fittizio === true).length, 0);

  // ---------- sincronizzazione ----------
  // api.richiesta(metodo, percorso, corpoOggetto|null) -> Promise<{status, corpo}>  (status 0 = rete assente)
  class ErroreSync extends Error { constructor(tipo, msg, status) { super(msg); this.tipo = tipo; this.status = status; } }
  M.ErroreSync = ErroreSync;
  // Messaggio di GitHub (mai il token, che non passa da qui), utile per capire la causa reale.
  const dettaglio = (res) => { const m = res && res.corpo && typeof res.corpo === "object" && res.corpo.message; return m ? ` GitHub dice: «${String(m).slice(0, 160)}».` : ""; };
  function controlla(res, cosa) {
    if (res.status === 0) throw new ErroreSync("rete", "Rete assente o non raggiungibile: le modifiche restano sul telefono e verranno inviate più tardi.", 0);
    if (res.status === 401) throw new ErroreSync("accesso", "Accesso a GitHub scaduto o revocato: crea un nuovo token e inseriscilo in Dati › Sincronizzazione.", 401);
    if (res.status === 403) throw new ErroreSync("permessi", `GitHub ha rifiutato ${cosa} (403): il token non ha il permesso "Contents: Read and write" su second-brain, oppure è stato superato il limite di richieste.${dettaglio(res)}`, 403);
    if (res.status === 404) throw new ErroreSync("non_trovato", `GitHub non trova ${cosa} (404): controlla che il token dia accesso al repository second-brain.${dettaglio(res)}`, 404);
    throw new ErroreSync("github", `Errore di GitHub durante ${cosa} (${res.status}).${dettaglio(res)}`, res.status);
  }
  const percorsoFile = (col, id) => `${M.CARTELLA_APP}/${col}/${id}.json`;
  const testoFile = (dati) => JSON.stringify(dati, null, 2) + "\n";

  async function leggiFile(api, R, percorso) {
    const res = await api.richiesta("GET", `${R}/contents/${percorso}?ref=${M.RAMO}`);
    if (res.status === 404) return null;
    if (res.status !== 200) controlla(res, "la lettura di " + percorso);
    return { sha: res.corpo.sha, dati: JSON.parse(M.daBase64(res.corpo.content)) };
  }

  async function assicuraRamo(api, R) {
    const b = await api.richiesta("GET", `${R}/branches/${M.RAMO}`);
    if (b.status === 200) return false;
    if (b.status !== 404) controlla(b, "il controllo del ramo dati");
    const repo = await api.richiesta("GET", R);
    if (repo.status !== 200) controlla(repo, "il repository");
    const ref = await api.richiesta("GET", `${R}/git/ref/heads/${repo.corpo.default_branch}`);
    if (ref.status !== 200) controlla(ref, "il ramo principale");
    const nuovo = await api.richiesta("POST", `${R}/git/refs`, { ref: "refs/heads/" + M.RAMO, sha: ref.corpo.object.sha });
    if (nuovo.status !== 201 && nuovo.status !== 422) controlla(nuovo, "la creazione del ramo dati"); // 422: creato nel frattempo
    return true;
  }

  function segnaConflitto(stato, col, id, tipo, locale, remoto, rsha) {
    stato.sync.conflitti[col + "/" + id] = { col, id, tipo, locale: locale ? copia(locale) : null, remoto: remoto ? copia(remoto) : null, rsha: rsha || null, rilevato_il: ora() };
  }

  M.sincronizza = async function (stato, api, opz) {
    const R = `/repos/${opz.owner}/${opz.repo}`;
    const salva = opz.salva || (async () => {});
    const esito = { inviati: 0, ricevuti: 0, eliminati_remoto: 0, eliminati_locale: 0, conflitti_nuovi: 0, ramo_creato: false };
    stato.sync.ultimo_tentativo = ora();
    try {
      esito.ramo_creato = await assicuraRamo(api, R);
      for (const col of M.COLLEZIONI_SYNC) {
        const legacy = M.COLLEZIONI_LEGACY.includes(col);
        const lista = await api.richiesta("GET", `${R}/contents/${M.CARTELLA_APP}/${col}?ref=${M.RAMO}`);
        if (lista.status !== 200 && lista.status !== 404) controlla(lista, "l'elenco di " + col);
        const remoti = new Map((lista.status === 200 ? lista.corpo : []).filter((f) => f.type === "file" && f.name.endsWith(".json")).map((f) => [f.name.slice(0, -5), f.sha]));
        const ids = new Set([...Object.keys(stato.collezioni[col]), ...remoti.keys()]);
        for (const id of ids) {
          if (!ID_VALIDO.test(id)) continue;
          const chiave = col + "/" + id;
          if (stato.sync.conflitti[chiave]) continue; // in attesa di una tua scelta
          const rsha = remoti.get(id) || null;
          const rec = stato.collezioni[col][id];

          if (!rec && legacy) { esito.file_1_0_ignorati = (esito.file_1_0_ignorati || 0) + 1; continue; } // file della 1.0 non nostro: lasciato com'è
          if (!rec) { // nuovo nel repository
            const f = await leggiFile(api, R, percorsoFile(col, id)); if (!f) continue;
            if (stato.collezioni[col][id]) continue; // creato localmente durante la lettura: lo gestirà il prossimo giro
            stato.collezioni[col][id] = { dati: f.dati, sync: { sha: f.sha, base: await M.impronta(f.dati), sporco: false, eliminato: false } };
            esito.ricevuti++; await salva(); continue;
          }

          if (!rec.sync.sporco) {
            if (rsha === rec.sync.sha) continue;
            if (!rsha) { // eliminato nel repository, locale invariato
              if (rec.sync.sha) { delete stato.collezioni[col][id]; esito.eliminati_locale++; await salva(); }
              continue;
            }
            const f = await leggiFile(api, R, percorsoFile(col, id)); if (!f) continue;
            if (rec.sync.sporco) continue; // modificato durante la lettura
            if (!rec.sync.sha && !M.nelRepository(col, rec.dati)) { segnaConflitto(stato, col, id, "stesso_id", rec.dati, f.dati, f.sha); esito.conflitti_nuovi++; continue; }
            rec.dati = f.dati; rec.sync.sha = f.sha; rec.sync.base = await M.impronta(f.dati);
            esito.ricevuti++; await salva(); continue;
          }

          // ci sono modifiche locali
          const vuoleAssente = rec.sync.eliminato || !M.nelRepository(col, rec.dati);
          if (vuoleAssente) {
            if (!rsha) { // già assente: completa
              if (rec.sync.eliminato) delete stato.collezioni[col][id];
              else { rec.sync.sha = null; rec.sync.base = await M.impronta(rec.dati); rec.sync.sporco = false; }
              await salva(); continue;
            }
            if (rsha !== rec.sync.sha) { // cambiato nel repository dopo l'ultima sincronizzazione
              const f = await leggiFile(api, R, percorsoFile(col, id));
              segnaConflitto(stato, col, id, rec.sync.eliminato ? "eliminato_locale_modificato_remoto" : "privata_locale_modificata_remota", rec.sync.eliminato ? null : rec.dati, f && f.dati, f && f.sha);
              esito.conflitti_nuovi++; continue;
            }
            const del = await api.richiesta("DELETE", `${R}/contents/${percorsoFile(col, id)}`, { message: `Second Brain: rimuove ${col}/${id}`, sha: rsha, branch: M.RAMO });
            if (del.status === 409 || del.status === 422) continue; // cambiato nel frattempo: il prossimo giro lo rileva come conflitto
            if (del.status !== 200) controlla(del, "l'eliminazione di " + chiave);
            if (rec.sync.eliminato) delete stato.collezioni[col][id];
            else { rec.sync.sha = null; rec.sync.base = await M.impronta(rec.dati); rec.sync.sporco = false; }
            esito.eliminati_remoto++; await salva(); continue;
          }

          const h = await M.impronta(rec.dati);
          if (rsha && rsha !== rec.sync.sha) { // anche il repository è cambiato: confronta i contenuti
            const f = await leggiFile(api, R, percorsoFile(col, id));
            if (f && (await M.impronta(f.dati)) === h) { rec.sync.sha = f.sha; rec.sync.base = h; rec.sync.sporco = false; await salva(); continue; } // es. invio riuscito ma risposta persa
            segnaConflitto(stato, col, id, "modificato_entrambi", rec.dati, f && f.dati, f && f.sha); esito.conflitti_nuovi++; continue;
          }
          if (!rsha && rec.sync.sha) { segnaConflitto(stato, col, id, "eliminato_remoto_modificato_locale", rec.dati, null, null); esito.conflitti_nuovi++; continue; }
          const corpo = { message: `Second Brain: aggiorna ${col}/${id}`, content: M.aBase64(testoFile(rec.dati)), branch: M.RAMO };
          if (rsha) corpo.sha = rsha;
          const put = await api.richiesta("PUT", `${R}/contents/${percorsoFile(col, id)}`, corpo);
          if (put.status === 409 || put.status === 422) continue; // cambiato nel frattempo: il prossimo giro confronta i contenuti
          if (put.status !== 200 && put.status !== 201) controlla(put, "l'invio di " + chiave);
          rec.sync.sha = put.corpo.content.sha;
          if ((await M.impronta(rec.dati)) === h) { rec.sync.base = h; rec.sync.sporco = false; } // se modificato durante l'invio resta da inviare
          esito.inviati++; await salva();
        }
      }
      await M.scaricaIstantanea(stato, api, opz);
      stato.sync.ultimo_ok = ora(); stato.sync.errore = null;
      await salva();
      return esito;
    } catch (e) {
      stato.sync.errore = { tipo: e.tipo || "interno", messaggio: e.message || String(e), quando: ora() };
      await salva();
      throw e;
    }
  };

  // Istantanea di Claude Code: solo lettura, sostituisce la copia locale solo se presente nel repository.
  M.scaricaIstantanea = async function (stato, api, opz) {
    const R = `/repos/${opz.owner}/${opz.repo}`;
    const nuovi = [];
    for (const nome of ["istantanea", "ultimo_tentativo"]) {
      const f = await leggiFile(api, R, `${M.CARTELLA_STATO}/${nome}.json`);
      if (f) nuovi.push({ id: nome, ...f.dati });
    }
    const at = await api.richiesta("GET", `${R}/contents/${M.CARTELLA_STATO}/attese.md?ref=${M.RAMO}`); // risposte pronte dell'agente «sblocca attese»
    if (at.status === 200) nuovi.push({ id: "attese", testo: M.daBase64(at.corpo.content).slice(0, 60000), sha: at.corpo.sha });
    else if (at.status !== 404) controlla(at, "la lettura di attese.md");
    if (nuovi.length) { stato.stato_lavoro = nuovi; stato.sync.istantanea_scaricata_il = ora(); await M.noteDaSessioni(stato); await M.organizzaAutomatico(stato); await M.collegaEsecuzioniPreviste(stato); }
    return nuovi.length;
  };

  // Risoluzione dei conflitti: niente viene sovrascritto senza una scelta esplicita.
  M.risolviConflitto = async function (stato, chiave, scelta) {
    const k = stato.sync.conflitti[chiave]; if (!k) return;
    const rec = stato.collezioni[k.col][k.id];
    if (k.tipo === "migrazione") { // la versione scelta viene scritta nel nuovo percorso delle note
      if (scelta === "repository" && k.remoto) rec.dati = copia(k.remoto);
      else if (scelta === "repository") { M.eliminaRecord(stato, k.col, k.id); delete stato.sync.conflitti[chiave]; return; }
      else if (scelta !== "telefono") throw new Error("scelta non valida");
      rec.sync.sporco = M.nelRepository(k.col, rec.dati);
      delete stato.sync.conflitti[chiave]; return;
    }
    if (M.COLLEZIONI_LEGACY.includes(k.col)) { // vecchio file della 1.0 cambiato nel repository dopo la migrazione
      if (scelta === "repository" && k.remoto) {
        const n = stato.collezioni.note[k.id] || { sync: { sha: null, base: null, sporco: false, eliminato: false } };
        n.dati = copia(k.remoto); n.sync.eliminato = false; n.sync.sporco = M.nelRepository("note", n.dati); stato.collezioni.note[k.id] = n;
      } else if (scelta !== "repository" && scelta !== "telefono") throw new Error("scelta non valida");
      if (rec) { rec.sync.sha = k.rsha; rec.sync.sporco = true; } // in ogni caso il file nel vecchio percorso va rimosso
      delete stato.sync.conflitti[chiave]; return;
    }
    if (scelta === "repository") {
      if (k.remoto) stato.collezioni[k.col][k.id] = { dati: copia(k.remoto), sync: { sha: k.rsha, base: await M.impronta(k.remoto), sporco: false, eliminato: false } };
      else delete stato.collezioni[k.col][k.id];
    } else if (scelta === "telefono") {
      if (rec) { rec.sync.sha = k.rsha; rec.sync.sporco = true; } // il prossimo invio sostituisce consapevolmente la versione vista
    } else throw new Error("scelta non valida");
    delete stato.sync.conflitti[chiave];
  };

  if (typeof module !== "undefined" && module.exports) module.exports = M; else radice.SBMotore = M;
})(typeof globalThis !== "undefined" ? globalThis : this);
