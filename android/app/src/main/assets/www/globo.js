// Globo neurale della Mappa (index.html).
// Ogni linea è una relazione reale (M.relazioni): nessun segmento decorativo che non collega nulla.
(function (radice) {
  "use strict";
  const COL = { inbox: "#ff7eb6", progetto: "#b38cff", area: "#4fe3c1", risorsa: "#ffc46b", archivio: "#7d86b0", stanza: "#5ad1ff" };
  const TIPO = { inbox: "Da organizzare", area: "Aree", risorsa: "Risorse", archivio: "Archivio" };
  const G = { COL };
  const casuale = (seme) => () => ((seme = (seme * 16807) % 2147483647) / 2147483647);
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const fib = (i, n) => { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), t = i * 2.39996; return [Math.cos(t) * r, y, Math.sin(t) * r]; };
  const titolo = (n) => n.titolo || String(n.testo || "").split("\n")[0].slice(0, 80) || "Nota";

  // Nodi e archi dai dati reali; posizioni sulla sfera (centri su spirale di Fibonacci, note vicino al loro centro).
  G.costruisci = function (M, stato, isolati) {
    const el = (c) => M.elenco(stato, c);
    const archi = M.relazioni(stato), grado = new Map();
    for (const r of archi) { grado.set(r.da, (grado.get(r.da) || 0) + 1); grado.set(r.a, (grado.get(r.a) || 0) + 1); }
    const cat = (n) => (TIPO[n.categoria] ? n.categoria : "inbox");
    const tutti = [...el("note").map((n) => ({ k: "note/" + n.id, nome: titolo(n), col: COL[cat(n)], tipo: TIPO[cat(n)], forma: "c", apri: ["nota", n.id] })),
      ...el("progetti").map((p) => ({ k: "progetti/" + p.id, nome: p.nome || "Progetto", col: COL.progetto, tipo: "Progetto", forma: "e", apri: ["progetto", p.id] })),
      ...el("stanze").map((s) => ({ k: "stanze/" + s.id, nome: s.nome || "Stanza", col: COL.stanza, tipo: "Stanza", forma: "e", apri: ["stanza", s.id] }))];
    const nodi = tutti.filter((x) => isolati || grado.has(x.k)).map((x) => ({ ...x, g: grado.get(x.k) || 0 }));
    for (const n of nodi) n.r = n.forma === "e" ? 9 + Math.min(12, n.g * 1.5) : 3.5 + Math.min(5, n.g);
    const idx = new Map(nodi.map((n) => [n.k, n]));
    const E = archi.map((r) => [idx.get(r.da), idx.get(r.a)]).filter(([a, b]) => a && b);
    const vicini = (p) => E.filter(([a, b]) => a === p || b === p).map(([a, b]) => (a === p ? b : a));
    const hub = nodi.filter((n) => n.forma === "e"), resto = nodi.filter((n) => n.forma !== "e"), rnd = casuale(7);
    hub.forEach((n, i) => (n.p = fib(i, Math.max(hub.length, 1))));
    resto.forEach((n, i) => { const h = vicini(n).find((v) => v.p && v.forma === "e") || vicini(n).find((v) => v.p); n.p = h ? norm([h.p[0] + (rnd() - 0.5) * 0.55, h.p[1] + (rnd() - 0.5) * 0.55, h.p[2] + (rnd() - 0.5) * 0.55]) : fib(i, resto.length); });
    E.forEach((e, i) => (e.fase = casuale(i * 104729 + 3)()));
    return { nodi, E, idx, vicini };
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
  // Arco "assone": interpolazione sferica tra a e b, sollevato a metà (calcolato una volta per relazione).
  const PASSI = 12;
  function arco(a, b, passi) {
    const d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))), out = [];
    for (let i = 0; i <= passi; i++) {
      const u = i / passi, s = Math.sin(d) || 1, wa = d ? Math.sin((1 - u) * d) / s : 1 - u, wb = d ? Math.sin(u * d) / s : u;
      const h = 1 + Math.sin(Math.PI * u) * (0.03 + d * 0.06);
      const q = norm([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]); out.push([q[0] * h, q[1] * h, q[2] * h]);
    }
    return out;
  }
  const alfa = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");

  // Immagini preparate una volta (aloni, nuclei, impulsi, atmosfera): a ogni fotogramma solo drawImage, niente sfumature nuove.
  const cache = new Map();
  function tela(l) { const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(l, l) : Object.assign(document.createElement("canvas"), { width: l, height: l }); return c; }
  function sprite(chiave, fermate) {
    if (cache.has(chiave)) return cache.get(chiave);
    const L = 64, c = tela(L), x = c.getContext("2d"), g = x.createRadialGradient(L / 2, L / 2, 0, L / 2, L / 2, L / 2);
    for (const [o, col] of fermate) g.addColorStop(o, col);
    x.fillStyle = g; x.fillRect(0, 0, L, L); cache.set(chiave, c); return c;
  }
  const alone = (col) => sprite("a" + col, [[0, col], [0.25, alfa(col, 0.32)], [1, alfa(col, 0)]]);
  const nucleo = (col) => sprite("n" + col, [[0, "#fff"], [0.6, alfa(col, 0.95)], [1, alfa(col, 0)]]);
  const impulso = () => sprite("impulso", [[0, "rgba(255,255,255,.9)"], [0.3, "rgba(150,230,255,.5)"], [1, "rgba(150,230,255,0)"]]);
  function atmosfera(R, dpr) { // sfondo del globo, ridisegnato solo se cambia la dimensione (zoom)
    const k = "atm" + Math.round(R) + "x" + dpr; if (cache.has(k)) return cache.get(k);
    for (const c of [...cache.keys()]) if (c.startsWith("atm")) cache.delete(c);
    const L = Math.ceil(R * 2.6), c = tela(Math.ceil(L * dpr)), x = c.getContext("2d"); x.scale(dpr, dpr); const m = L / 2;
    let g = x.createRadialGradient(m - R * 0.3, m - R * 0.35, R * 0.1, m, m, R * 1.12);
    g.addColorStop(0, "rgba(130,110,255,.32)"); g.addColorStop(0.5, "rgba(60,70,200,.16)"); g.addColorStop(0.9, "rgba(120,90,255,.24)"); g.addColorStop(1, "rgba(90,209,255,0)");
    x.fillStyle = g; x.beginPath(); x.arc(m, m, R * 1.12, 0, 7); x.fill();
    g = x.createRadialGradient(m + R * 0.35, m + R * 0.3, 0, m + R * 0.35, m + R * 0.3, R * 0.7);
    g.addColorStop(0, "rgba(90,209,255,.12)"); g.addColorStop(1, "rgba(90,209,255,0)"); x.fillStyle = g; x.beginPath(); x.arc(m, m, R, 0, 7); x.fill();
    x.strokeStyle = "rgba(170,175,255,.35)"; x.lineWidth = 1.1; x.shadowColor = "rgba(124,108,255,.9)"; x.shadowBlur = 18; x.beginPath(); x.arc(m, m, R, 0, 7); x.stroke();
    const out = { c, L }; cache.set(k, out); return out;
  }

  // Disegna il globo. opz: { vista:{m|rx,ry,z}, t (ms), sel, vic:Set, etichette:bool, dpr }. Restituisce le proiezioni dei nodi.
  G.disegna = function (ctx, W, H, rete, opz) {
    const { nodi, E } = rete, v = opz.vista, t = opz.t || 0, sel = opz.sel || null, vic = opz.vic || new Set();
    const R = Math.min(W, H) * 0.4 * v.z, cx = W / 2, cy = H / 2, atm = atmosfera(R, opz.dpr || 1);
    ctx.drawImage(atm.c, cx - atm.L / 2, cy - atm.L / 2, atm.L, atm.L);
    ctx.globalCompositeOperation = "lighter";
    // assoni = relazioni reali, con impulsi che viaggiano
    const P = new Map(nodi.map((n) => [n, G.punto(n.p, v, W, H)])), imp = impulso();
    ctx.lineCap = "round";
    for (const e of E) {
      const [a, b] = e, acceso = sel && (a === sel || b === sel);
      if (!e.pts3) e.pts3 = arco(a.p, b.p, PASSI);
      const pts = e.pts3.map((p) => G.punto(p, v, W, H));
      const prof = (P.get(a).a + P.get(b).a) / 2, k = acceso ? 1 : (sel ? 0.35 : 1);
      if (acceso) { const gr = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[PASSI].x, pts[PASSI].y); gr.addColorStop(0, alfa(a.col, 0.58 * k)); gr.addColorStop(0.5, `rgba(200,205,255,${0.35 * k})`); gr.addColorStop(1, alfa(b.col, 0.58 * k)); ctx.strokeStyle = gr; }
      else ctx.strokeStyle = `rgba(185,190,255,${(0.14 + 0.32 * prof) * k})`;
      ctx.lineWidth = acceso ? 1.9 : 1;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i <= PASSI; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      if (opz.impulsi !== false && (!sel || acceso)) { // impulso (segnale) lungo l'assone
        const u = (t * 0.00018 + e.fase) % 1, f = u * PASSI, i0 = Math.floor(f), q0 = pts[i0], q1 = pts[Math.min(PASSI, i0 + 1)], w = f - i0;
        const x = q0.x + (q1.x - q0.x) * w, y = q0.y + (q1.y - q0.y) * w, rr = (acceso ? 4 : 2.6) * q0.s * 3;
        ctx.globalAlpha = q0.a; ctx.drawImage(imp, x - rr, y - rr, rr * 2, rr * 2); ctx.globalAlpha = 1;
      }
    }
    // neuroni: alone e nucleo
    for (const n of [...nodi].sort((x, y) => P.get(x).z - P.get(y).z)) {
      const q = P.get(n), r = n.r * q.s, spento = sel && n !== sel && !vic.has(n);
      ctx.globalAlpha = q.a * (spento ? 0.3 : 1);
      ctx.drawImage(alone(n.col), q.x - r * 3, q.y - r * 3, r * 6, r * 6);
      const rn = r * 0.8 * (n.forma === "e" ? 1 + 0.08 * Math.sin(t * 0.003 + n.g) : 1);
      ctx.drawImage(nucleo(n.col), q.x - rn, q.y - rn, rn * 2, rn * 2);
      if (n === sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.1, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
    if (opz.etichette !== false) {
      const nomiStanze = new Set(nodi.filter((n) => n.tipo === "Stanza").map((n) => n.nome));
      ctx.textAlign = "center";
      for (const n of nodi) {
        if (n !== sel && n.tipo === "Progetto" && nomiStanze.has(n.nome)) continue;
        const q = P.get(n); if (!(n === sel || (n.forma === "e" && q.z > -0.15))) continue;
        const tx = n.nome.length > 24 ? n.nome.slice(0, 23) + "…" : n.nome;
        ctx.font = (n.forma === "e" ? "600 12px " : "11px ") + "system-ui,sans-serif"; ctx.globalAlpha = n === sel ? 1 : q.a;
        const w = ctx.measureText(tx).width + 10, y = q.y + n.r * q.s * 1.6 + 2;
        ctx.fillStyle = "rgba(4,5,15,.65)"; ctx.fillRect(q.x - w / 2, y, w, 16); ctx.fillStyle = "#e9ecff"; ctx.fillText(tx, q.x, y + 12); ctx.globalAlpha = 1;
      }
    }
    return P;
  };

  // Immagine quadrata per il widget (PNG in base64, senza prefisso). La rotazione cambia con l'ora, così il widget "vive".
  radice.SBGlobo = G;
})(typeof window !== "undefined" ? window : globalThis);
