// Sincronizzazione in background (SincronizzazioneJob): stesso motore e stesse regole dell'app aperta.
(async () => {
  const A = window.Android, M = window.SBMotore;
  const attese = new Map(); let seq = 0;
  window.__risposta = (id, st, corpo) => { const r = attese.get(id); if (!r) return; attese.delete(id); let c = null; try { c = corpo ? JSON.parse(corpo) : null; } catch (_) { c = corpo; } r({ status: st, corpo: c }); };
  const api = { richiesta: (m, p, c) => new Promise((res) => { const id = "s" + ++seq; attese.set(id, res); A.github(id, m, p, c ? JSON.stringify(c) : ""); }) };
  try {
    const c = M.carica(A.caricaDati(), A.caricaDatiPrecedenti());
    // dati da convertire o danneggiati: se ne occupa l'app aperta (con copia di sicurezza e verifica)
    if (c.origine !== "principale" || c.migrazione) { A.fine("saltato: aprire l'app"); return; }
    if (!A.haToken() || !A.retePresente()) { A.fine("saltato: nessun token o rete"); return; }
    const s = c.stato;
    const salva = async () => { A.salvaDati(JSON.stringify(s)); };
    try { await M.sincronizza(s, api, { owner: "salvatorevirgillito04-code", repo: "second-brain", salva }); s.sync.ultimo_sfondo = { quando: new Date().toISOString(), esito: "ok" }; }
    catch (e) { s.sync.ultimo_sfondo = { quando: new Date().toISOString(), esito: "errore", messaggio: e.message || String(e) }; }
    await salva();
    A.fine(s.sync.ultimo_sfondo.esito);
  } catch (e) { A.fine("errore: " + (e.message || e)); }
})();
