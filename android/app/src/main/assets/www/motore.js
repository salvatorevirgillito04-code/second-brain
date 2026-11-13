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
    if (nuovi.length) { stato.stato_lavoro = nuovi; stato.sync.istantanea_scaricata_il = ora(); }
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
