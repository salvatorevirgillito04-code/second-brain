// Globo neurale della Mappa (index.html) – 1.9.3 «Atlante notturno».
// Ogni linea è una relazione reale (M.relazioni): nessun segmento decorativo che non collega nulla.
// Stanze = anelli con una tinta propria e una nebulosa; progetti = rombi; note = forma per categoria
// (area punto, risorsa rombino, da organizzare anello aperto, archivio punto spento). Archi: stanza continuo
// nella tinta, progetto puntinato, collegamento tra note alto come una costellazione.
(function (radice) {
  "use strict";
  const COL = { inbox: "#ff7eb6", progetto: "#b38cff", area: "#4fe3c1", risorsa: "#ffc46b", archivio: "#7d86b0", stanza: "#5ad1ff" };
  const TIPO = { inbox: "Da organizzare", area: "Aree", risorsa: "Risorse", archivio: "Archivio" };
  // 24 tinte OKLCH validate (dataviz: contrasto ≥5:1 su #060714, distinguibili anche per i daltonici tra posizioni vicine)
  const TINTE = ["#cd5f62", "#43dab0", "#ab68ba", "#c3c54f", "#5285d9", "#fea573", "#0a999f", "#ff98ca", "#549a44", "#bcb2ff", "#ae7c02", "#5bccfe",
    "#cc6349", "#0bdac9", "#b862a7", "#a9cd63", "#6f7dd9", "#fba952", "#0a96af", "#ff9cb3", "#269e5f", "#d0a9fe", "#9e840e", "#80c5ff"];
  const NEBBIA = [20, 26, 58], SFONDO = "#04050f";
  const G = { COL, TINTE };
  const casuale = (seme) => () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const fib = (i, n) => { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), t = i * 2.39996; return [Math.cos(t) * r, y, Math.sin(t) * r]; };
  const titolo = (n) => n.titolo || String(n.testo || "").split("\n")[0].slice(0, 80) || "Nota";
  // tinte delle stanze: posizione da hash FNV-1a dell'id, assegnata in ordine di creazione senza collisioni
  // (una stanza nuova non cambia il colore di quelle esistenti; rinominare non cambia il colore)
  const h32 = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  G.tinte = function (stanze) {
    const usati = new Set(), m = new Map();
    for (const st of [...stanze].sort((a, b) => String(a.creato_il || a.id).localeCompare(String(b.creato_il || b.id)))) {
      let i = h32(st.id) % TINTE.length; while (usati.has(i) && usati.size < TINTE.length) i = (i + 1) % TINTE.length; usati.add(i); m.set(st.id, TINTE[i]);
    }
    return m;
  };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const esa = (c) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  const mescola = (hex, k, verso = NEBBIA) => { const a = rgb(hex); return esa(a.map((x, i) => x + (verso[i] - x) * k)); }; // k=0 colore, k=1 nebbia
  const schiarisci = (hex, k) => mescola(hex, k, [255, 255, 255]);

  // Nodi e archi dai dati reali; posizioni sulla sfera (centri su spirale di Fibonacci, note vicino al loro centro).
  G.costruisci = function (M, stato, isolati) {
    const el = (c) => M.elenco(stato, c);
    const archi = M.relazioni(stato), grado = new Map();
    for (const r of archi) { grado.set(r.da, (grado.get(r.da) || 0) + 1); grado.set(r.a, (grado.get(r.a) || 0) + 1); }
    const cat = (n) => (TIPO[n.categoria] ? n.categoria : "inbox");
    const progetti = new Map(el("progetti").map((p) => [p.id, p])), settimana = Date.now() - 7 * 864e5, tinte = G.tinte(el("stanze"));
    const recente = (n) => { const d = Date.parse(n.aggiornato_il || n.corretto_il || n.registrato_il || n.creato_il || ""); return isFinite(d) && d > settimana; };
    const tutti = [...el("note").map((n) => { const c = cat(n), st = n.stanza_id || (progetti.get(n.progetto_id) || {}).stanza_id || null;
        return { k: "note/" + n.id, nome: titolo(n), col: COL[c], cat: c, tipo: TIPO[c], forma: "c", st, recente: recente(n), apri: ["nota", n.id] }; }),
      ...el("progetti").map((p) => ({ k: "progetti/" + p.id, nome: p.nome || "Progetto", col: COL.progetto, tipo: "Progetto", forma: "p", st: p.stanza_id || null, apri: ["progetto", p.id] })),
      ...el("stanze").map((s) => ({ k: "stanze/" + s.id, nome: s.nome || "Stanza", col: tinte.get(s.id), tinta: tinte.get(s.id), tipo: "Stanza", forma: "e", st: s.id, apri: ["stanza", s.id] }))];
    const nodi = tutti.filter((x) => isolati || grado.has(x.k)).map((x) => ({ ...x, g: grado.get(x.k) || 0 }));
    for (const n of nodi) n.r = n.forma === "e" ? 9 + Math.min(12, n.g * 1.5) : n.forma === "p" ? 7 + Math.min(8, n.g) : 3 + Math.min(4, n.g);
    const idx = new Map(nodi.map((n) => [n.k, n]));
    const E = []; for (const r of archi) { const a = idx.get(r.da), b = idx.get(r.a); if (a && b) { const e = [a, b]; e.tipo = r.tipo; E.push(e); } }
    const vicini = (p) => E.filter(([a, b]) => a === p || b === p).map(([a, b]) => (a === p ? b : a));
    const hub = nodi.filter((n) => n.forma === "e"), resto = nodi.filter((n) => n.forma !== "e"), rnd = casuale(7);
    hub.forEach((n, i) => (n.p = fib(i, Math.max(hub.length, 1))));
    resto.forEach((n, i) => { const h = vicini(n).find((v) => v.p && v.forma === "e") || vicini(n).find((v) => v.p); n.p = h ? norm([h.p[0] + (rnd() - 0.5) * 0.55, h.p[1] + (rnd() - 0.5) * 0.55, h.p[2] + (rnd() - 0.5) * 0.55]) : fib(i, resto.length); });
    E.forEach((e, i) => (e.fase = casuale(i * 104729 + 3)()));
    nodi.forEach((n, i) => (n.fase = casuale(i * 7919 + 11)() * 6.283));
    // nebulose: una per stanza, al baricentro della stanza e delle sue note (territorio, non relazione)
    const nebulose = hub.map((s) => { const membri = nodi.filter((n) => n.st === s.st); const c = norm(membri.reduce((a, n) => [a[0] + n.p[0], a[1] + n.p[1], a[2] + n.p[2]], [0, 0, 0]));
      return { p: c, tinta: s.tinta, n: membri.length - 1, stanza: s }; });
    return { nodi, E, idx, vicini, nebulose };
  };

  // Rotazione libera (1.9.2): la vista ha una matrice 3×3 v.m (righe). Il trascinamento la ruota attorno agli assi dello
  // schermo, quindi la sfera gira a 360° in ogni direzione senza blocchi ai poli.
  G.matrice = function (rx, ry) { // stessa posa iniziale di prima: Rx(rx)·Ry(ry)
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    return [cy, 0, sy, sx * sy, cx, -sx * cy, -cx * sy, sx, cx * cy]; // righe: [r00,r01,r02, r10,r11,r12, r20,r21,r22]
  };
  // m ← R(asse dello schermo, angolo)·m ; asse "y" = verticale dello schermo (trascinamento orizzontale), "x" = orizzontale
  G.ruota = function (m, asse, a) {
    const c = Math.cos(a), s = Math.sin(a), r = m.slice();
    if (asse === "y") for (let k = 0; k < 3; k++) { r[k] = c * m[k] + s * m[6 + k]; r[6 + k] = -s * m[k] + c * m[6 + k]; }
    else for (let k = 0; k < 3; k++) { r[3 + k] = c * m[3 + k] - s * m[6 + k]; r[6 + k] = s * m[3 + k] + c * m[6 + k]; }
    return r;
  };
  G.ortonormalizza = function (m) { // evita la deriva numerica dopo molte rotazioni
    const a = norm([m[0], m[1], m[2]]); let b = [m[3], m[4], m[5]]; const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    b = norm([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]); const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return [...a, ...b, ...c];
  };
  // Proiezione prospettica di un punto della sfera.
  G.punto = function (p, v, W, H) {
    const m = v.m || G.matrice(v.rx || 0, v.ry || 0);
    const x1 = m[0] * p[0] + m[1] * p[1] + m[2] * p[2], y2 = m[3] * p[0] + m[4] * p[1] + m[5] * p[2], z2 = m[6] * p[0] + m[7] * p[1] + m[8] * p[2];
    const R = Math.min(W, H) * 0.4 * v.z, k = 1 / (1 - z2 * 0.18);
    return { x: W / 2 + x1 * R * k, y: H / 2 + y2 * R * k, s: (0.7 + 0.45 * (z2 + 1) / 2) * Math.sqrt(v.z), a: 0.28 + 0.72 * (z2 + 1) / 2, z: z2 };
  };
  // Arco tra a e b, sollevato a metà: più alto per i collegamenti tra note (costellazioni), basso verso le stanze.
  const PASSI = 12, ALTEZZA = { stanza: [0.02, 0.04], progetto: [0.03, 0.05], collegamento: [0.06, 0.12] };
  function arco(a, b, passi, tipo) {
    const [h0, h1] = ALTEZZA[tipo] || ALTEZZA.collegamento;
    const d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), out = [];
    for (let i = 0; i <= passi; i++) {
      const u = i / passi, s = Math.sin(d) || 1, wa = d ? Math.sin((1 - u) * d) / s : 1 - u, wb = d ? Math.sin(u * d) / s : u;
      const h = 1 + Math.sin(Math.PI * u) * Math.min(0.1, h0 + d * h1); // altezza limitata: niente anelli fuori dalla sfera
      const q = norm([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]); out.push([q[0] * h, q[1] * h, q[2] * h]);
    }
    return out;
  }
  const alfa = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  const profondita = (z) => { const t = (z + 1) / 2; return { t, a: 0.15 + 0.85 * Math.pow(t, 1.6), s: 0.6 + 0.5 * t, f: z < -0.33 ? 2 : z > 0.33 ? 0 : 1 }; }; // f: fascia 0 davanti, 2 dietro
  const NEB_F = [0, 0.25, 0.55]; // quanto ogni fascia si perde nella nebbia

  // Immagini preparate una volta: a ogni fotogramma solo drawImage, niente sfumature nuove.
  const cache = new Map();
  function tela(w, h = w) { return typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); }
  function sprite(chiave, fermate) {
    if (cache.has(chiave)) return cache.get(chiave);
    const L = 64, c = tela(L), x = c.getContext("2d"), g = x.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
    for (const [o, col] of fermate) g.addColorStop(o, col);
    x.fillStyle = g; x.fillRect(0, 0, L, L); cache.set(chiave, c); return c;
  }
  const alone = (col) => sprite("a" + col, [[0, alfa(col, 0.9)], [0.3, alfa(col, 0.35)], [1, alfa(col, 0)]]);
  const nebulosa = (col) => sprite("n" + col, [[0, alfa(col, 0.42)], [0.35, alfa(col, 0.22)], [0.7, alfa(col, 0.07)], [1, alfa(col, 0)]]);
  const impulso = (col) => sprite("i" + col, [[0, "rgba(255,255,255,.95)"], [0.25, alfa(col, 0.75)], [1, alfa(col, 0)]]);
  function stelle(W, H, dpr) { // campo stellato fermo, preparato solo quando cambia la dimensione
    const k = "stelle" + W + "x" + H + "x" + dpr; if (cache.has(k)) return cache.get(k);
    for (const c of [...cache.keys()]) if (c.startsWith("stelle")) cache.delete(c);
    const c = tela(Math.ceil(W * dpr), Math.ceil(H * dpr)), x = c.getContext("2d"), rnd = casuale(4242); x.scale(dpr, dpr);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(201,206,255,${0.08 + rnd() * 0.2})`; x.beginPath(); x.arc(rnd() * W, rnd() * H, 0.4 + rnd() * 0.5, 0, 7); x.fill(); }
    cache.set(k, c); return c;
  }
  function corpo(R, dpr) { // la sfera: disco scuro che copre le stelle, bordo di luce più forte in alto a sinistra, riflesso tenue
    const k = "corpo" + Math.round(R) + "x" + dpr; if (cache.has(k)) return cache.get(k);
    for (const c of [...cache.keys()]) if (c.startsWith("corpo")) cache.delete(c);
    const L = Math.ceil(R * 2.3), c = tela(Math.ceil(L * dpr)), x = c.getContext("2d"), m = L / 2; x.scale(dpr, dpr);
    let g = x.createRadialGradient(m, m, R * 0.9, m, m, R * 1.15); g.addColorStop(0, "rgba(155,140,255,.10)"); g.addColorStop(1, "rgba(155,140,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, R * 1.15, 0, 7); x.fill();
    x.fillStyle = "rgba(7,10,28,.85)"; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill();
    g = x.createRadialGradient(m + R * 0.4, m + R * 0.35, 0, m + R * 0.4, m + R * 0.35, R * 0.8); g.addColorStop(0, "rgba(90,209,255,.06)"); g.addColorStop(1, "rgba(90,209,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill();
    g = x.createRadialGradient(m - R * 0.45, m - R * 0.5, 0, m - R * 0.45, m - R * 0.5, R * 1.1); g.addColorStop(0, "rgba(140,125,255,.09)"); g.addColorStop(1, "rgba(140,125,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill(); // luce morbida in alto a sinistra (superficie, non una linea)
    g = x.createRadialGradient(m, m, R * 0.82, m, m, R); g.addColorStop(0, "rgba(155,140,255,0)"); g.addColorStop(1, "rgba(155,140,255,.11)");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill(); // bordo luminoso sfumato (atmosfera)
    const out = { c, L }; cache.set(k, out); return out;
  }
  function etichetta(n, dpr) { // testo con contorno scuro (niente rettangoli neri), preparato una volta per nodo
    const k = "e" + n.k + "|" + n.nome + "|" + dpr; if (cache.has(k)) return cache.get(k);
    const tx = n.nome.length > 26 ? n.nome.slice(0, 25) + "…" : n.nome, stanza = n.forma === "e";
    const font = (stanza ? "600 12px " : n.forma === "p" ? "500 11px " : "11px ") + "system-ui,sans-serif";
    const misura = tela(4).getContext("2d"); misura.font = font; const w = Math.ceil(misura.measureText(tx).width) + (stanza ? 16 : 8), h = 18;
    const c = tela(Math.ceil(w * dpr), Math.ceil(h * dpr)), x = c.getContext("2d"); x.scale(dpr, dpr); x.font = font; x.textBaseline = "middle";
    const x0 = stanza ? 12 : 4; if (stanza) { x.fillStyle = n.tinta; x.fillRect(3, h / 2 - 1, 6, 2); }
    x.lineJoin = "round"; x.lineWidth = 3; x.strokeStyle = SFONDO; x.strokeText(tx, x0, h / 2); x.fillStyle = stanza ? "#e9ecff" : "#c9ceff"; x.fillText(tx, x0, h / 2);
    const out = { c, w, h }; cache.set(k, out); return out;
  }
  function forma(ctx, n, x, y, r, col, a, t) { // disegna il nodo con la forma del suo tipo
    ctx.globalAlpha = a;
    if (n.forma === "e") { // stanza: anello con interno scuro e punto centrale
      ctx.fillStyle = "rgba(7,10,28,.7)"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
    } else if (n.forma === "p") { // progetto: rombo
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(233,236,255,.5)"; ctx.lineWidth = 1; ctx.stroke();
    } else if (n.cat === "inbox") { // da organizzare: anello aperto
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    } else if (n.cat === "risorsa") { // risorsa: rombino
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    } else { // area: punto pieno; archivio: punto piccolo e spento
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, n.cat === "archivio" ? Math.min(r, 2.2) : r, 0, 7); ctx.fill();
    }
    if (n.forma === "c" && n.cat !== "inbox" && n.cat !== "archivio") { // nucleo: bianco e vivo solo per le note toccate in settimana
      const k = n.recente ? 0.8 + 0.2 * Math.sin(t * 0.002 + n.fase) : 1;
      ctx.globalAlpha = a * k; ctx.fillStyle = n.recente ? "#fff" : schiarisci(n.col, 0.3); ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * 0.4), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Disegna il globo. opz: { vista:{m|rx,ry,z}, t (ms), sel, vic:Set, etichette:bool, impulsi:bool, dpr }. Restituisce le proiezioni dei nodi.
  G.disegna = function (ctx, W, H, rete, opz) {
    const { nodi, E } = rete, v = opz.vista, t = opz.t || 0, sel = opz.sel || null, vic = opz.vic || new Set(), dpr = opz.dpr || 1;
    const R = Math.min(W, H) * 0.4 * v.z, cx = W / 2, cy = H / 2, spento = sel ? 0.2 : 1;
    ctx.globalAlpha = spento; ctx.drawImage(stelle(W, H, dpr), 0, 0, W, H); ctx.globalAlpha = 1;
    const cp = corpo(R, dpr); ctx.drawImage(cp.c, cx - cp.L / 2, cy - cp.L / 2, cp.L, cp.L);
    const P = new Map(nodi.map((n) => [n, G.punto(n.p, v, W, H)]));
    ctx.globalCompositeOperation = "lighter";
    // nebulose delle stanze (sotto tutto il resto)
    for (const nb of rete.nebulose || []) {
      const q = G.punto(nb.p, v, W, H), d = profondita(q.z), r = R * (0.26 + 0.045 * Math.sqrt(Math.max(0, nb.n))) * (0.7 + 0.5 * d.t);
      ctx.globalAlpha = d.a * (q.z < 0 ? 0.4 : 1) * (sel ? (sel === nb.stanza || vic.has(nb.stanza) ? 0.6 : 0.2) : 1); ctx.drawImage(nebulosa(nb.tinta), q.x - r, q.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.lineCap = "round";
    // archi raggruppati per tipo, fascia di profondità e colore: pochi stroke invece di uno per arco
    const gruppi = new Map(), accesi = [];
    for (const e of E) {
      const [a, b] = e; if (!e.pts3) e.pts3 = arco(a.p, b.p, PASSI, e.tipo);
      const pts = e.pts3.map((p) => G.punto(p, v, W, H)); e.pts = pts;
      if (sel && (a === sel || b === sel)) { accesi.push(e); continue; }
      const zm = (P.get(a).z + P.get(b).z) / 2, d = profondita(zm), col = e.tipo === "stanza" ? (b.tinta || a.tinta || COL.stanza) : e.tipo === "progetto" ? COL.progetto : "#e9ecff";
      const chiave = e.tipo + "|" + d.f + "|" + col; let g = gruppi.get(chiave); if (!g) gruppi.set(chiave, (g = { tipo: e.tipo, f: d.f, col, a: 0, n: 0, linee: [] }));
      g.linee.push(pts); g.a += d.a; g.n++;
    }
    const STILE = { stanza: [1, 0.45, 0.6, 0.1], progetto: [1.2, 0.55, 0.8, 0.12], collegamento: [1.3, 0.5, 0.6, 0.12] }; // spessore e opacità davanti / dietro
    for (const g of gruppi.values()) {
      const [w1, a1, w2, a2] = STILE[g.tipo] || STILE.collegamento, k = g.f / 2;
      ctx.strokeStyle = alfa(mescola(g.col, NEB_F[g.f]), (a1 + (a2 - a1) * k) * spento); ctx.lineWidth = w1 + (w2 - w1) * k;
      ctx.setLineDash(g.tipo === "progetto" ? [1, 3.5] : []);
      ctx.beginPath(); for (const pts of g.linee) { ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i <= PASSI; i++) ctx.lineTo(pts[i].x, pts[i].y); } ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const e of accesi) { // archi della selezione: gli unici gradienti creati in tempo reale
      const [a, b] = e, pts = e.pts, gr = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[PASSI].x, pts[PASSI].y);
      gr.addColorStop(0, alfa(a.col, 0.85)); gr.addColorStop(1, alfa(b.col, 0.85)); ctx.strokeStyle = gr; ctx.lineWidth = 2;
      ctx.setLineDash(e.tipo === "progetto" ? [1.5, 4] : []); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i <= PASSI; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    ctx.setLineDash([]);
    // impulsi: dalla nota verso il suo contenitore, solo sugli archi davanti (uno ogni tre) o su quelli della selezione
    if (opz.impulsi !== false) {
      ctx.globalCompositeOperation = "lighter";
      for (const e of sel ? accesi : E) {
        const [a, b] = e; if (!sel && (e.fase >= 0.33 || P.get(a).z + P.get(b).z < 0)) continue;
        const u = (t * 0.00012 + e.fase) % 1, f = u * PASSI, i0 = Math.floor(f), q0 = e.pts[i0], q1 = e.pts[Math.min(PASSI, i0 + 1)], w = f - i0;
        const x = q0.x + (q1.x - q0.x) * w, y = q0.y + (q1.y - q0.y) * w, rr = (sel ? 4 : 2.5) * q0.s * 2.5;
        ctx.globalAlpha = profondita(q0.z).a; ctx.drawImage(impulso(a.col), x - rr, y - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    // nodi, dal più lontano al più vicino: alone (solo davanti e a metà), poi la forma del tipo
    for (const n of [...nodi].sort((x, y) => P.get(x).z - P.get(y).z)) {
      const q = P.get(n), d = profondita(q.z), r = n.r * d.s * Math.sqrt(v.z), off = sel && n !== sel && !vic.has(n);
      const col = mescola(n.col, NEB_F[d.f]), a = d.a * (off ? 0.2 : 1);
      if (d.f < 2 && n.cat !== "archivio" && n.cat !== "inbox") { ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a * (n.forma === "c" ? 0.32 : 0.35); const ra = r * (n.forma === "e" ? 2.2 : n.forma === "p" ? 2 : 3); ctx.drawImage(alone(n.col), q.x - ra, q.y - ra, ra * 2, ra * 2); ctx.globalCompositeOperation = "source-over"; }
      forma(ctx, n, q.x, q.y, r, col, a, t);
      if (n === sel) { // selezione: anello bianco e anello tratteggiato che gira piano
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.8 + 3, 0, 7); ctx.stroke();
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(t * 0.0012); ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(155,140,255,.6)"; ctx.beginPath(); ctx.arc(0, 0, r * 2.8 + 5, 0, 7); ctx.stroke(); ctx.restore();
      }
    }
    // etichette di stanze e progetti (e della selezione), senza sovrapposizioni
    if (opz.etichette !== false) {
      const nomiStanze = new Set(nodi.filter((n) => n.forma === "e").map((n) => n.nome)), occupati = [];
      const candidati = nodi.filter((n) => n === sel || ((n.forma === "e" || n.forma === "p" || vic.has(n)) && P.get(n).z > -0.1 && !(n.forma === "p" && nomiStanze.has(n.nome))))
        .sort((x, y) => (y === sel) - (x === sel) || P.get(y).z - P.get(x).z);
      for (const n of candidati) {
        const q = P.get(n), d = profondita(q.z), et = etichetta(n, dpr), x = Math.max(2, Math.min(W - et.w - 2, q.x - et.w / 2)), y = q.y + n.r * d.s * Math.sqrt(v.z) + 4;
        if (n !== sel && occupati.some((o) => x < o[2] && x + et.w > o[0] && y < o[3] && y + et.h > o[1])) continue;
        occupati.push([x, y, x + et.w, y + et.h]); ctx.globalAlpha = n === sel ? 1 : Math.max(0.55, d.a) * (sel && !vic.has(n) && n !== sel ? 0.3 : 1);
        ctx.drawImage(et.c, x, y, et.w, et.h);
      }
      ctx.globalAlpha = 1;
    }
    return P;
  };

  radice.SBGlobo = G;
})(typeof window !== "undefined" ? window : globalThis);
