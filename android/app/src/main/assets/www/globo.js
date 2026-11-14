// Globo neurale (1.6): usato dalla mappa (index.html) e dall'immagine del widget (index.html e sfondo.html).
// Le linee luminose con gli impulsi sono SOLO relazioni reali (M.relazioni); la trama tenue di fondo è decorativa e non tocca i nodi.
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
    nodi.forEach((n, i) => { const r = casuale(i * 7919 + 13); n.dend = Array.from({ length: n.forma === "e" ? 7 : 3 }, () => [r() * 6.283, 0.6 + r() * 0.9, (r() - 0.5) * 0.9]); });
    E.forEach((e, i) => (e.fase = casuale(i * 104729 + 3)()));
    // trama decorativa: brevi filamenti sulla superficie, lontani dai nodi
    const rf = casuale(424242), trama = [];
    for (let i = 0; i < 70; i++) { const a = norm([rf() - 0.5, rf() - 0.5, rf() - 0.5]); trama.push([a, norm([a[0] + (rf() - 0.5) * 0.5, a[1] + (rf() - 0.5) * 0.5, a[2] + (rf() - 0.5) * 0.5])]); }
    return { nodi, E, idx, vicini, trama };
  };

  // Proiezione prospettica di un punto della sfera (rotazione ry attorno a Y, rx attorno a X).
  G.punto = function (p, v, W, H) {
    const cy = Math.cos(v.ry), sy = Math.sin(v.ry), cx = Math.cos(v.rx), sx = Math.sin(v.rx);
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx;
    const R = Math.min(W, H) * 0.4 * v.z, k = 1 / (1 - z2 * 0.18);
    return { x: W / 2 + x1 * R * k, y: H / 2 + y2 * R * k, s: (0.7 + 0.45 * (z2 + 1) / 2) * Math.sqrt(v.z), a: 0.28 + 0.72 * (z2 + 1) / 2, z: z2 };
  };
  // Arco "assone": interpolazione sferica tra a e b, sollevato a metà.
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

  // Disegna il globo. opz: { vista:{rx,ry,z}, t (ms), sel, vic:Set, etichette:bool }. Restituisce le proiezioni dei nodi.
  G.disegna = function (ctx, W, H, rete, opz) {
    const { nodi, E, trama } = rete, v = opz.vista, t = opz.t || 0, sel = opz.sel || null, vic = opz.vic || new Set();
    const R = Math.min(W, H) * 0.4 * v.z, cx = W / 2, cy = H / 2;
    // atmosfera e nebulose
    let g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.12);
    g.addColorStop(0, "rgba(130,110,255,.32)"); g.addColorStop(0.5, "rgba(60,70,200,.16)"); g.addColorStop(0.9, "rgba(120,90,255,.24)"); g.addColorStop(1, "rgba(90,209,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(cx + R * 0.35, cy + R * 0.3, 0, cx + R * 0.35, cy + R * 0.3, R * 0.7);
    g.addColorStop(0, "rgba(90,209,255,.12)"); g.addColorStop(1, "rgba(90,209,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.save(); ctx.strokeStyle = "rgba(170,175,255,.35)"; ctx.lineWidth = 1.1; ctx.shadowColor = "rgba(124,108,255,.9)"; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    // trama decorativa (molto tenue)
    ctx.lineWidth = 0.6;
    for (const [a, b] of trama) { const pts = arco(a, b, 6).map((p) => G.punto(p, v, W, H)); ctx.strokeStyle = `rgba(150,140,255,${0.05 * pts[3].a})`; ctx.beginPath(); pts.forEach((q, i) => ctx[i ? "lineTo" : "moveTo"](q.x, q.y)); ctx.stroke(); }
    // assoni = relazioni reali, con impulsi che viaggiano
    const P = new Map(nodi.map((n) => [n, G.punto(n.p, v, W, H)]));
    for (const e of E) {
      const [a, b] = e, acceso = sel && (a === sel || b === sel), pts = arco(a.p, b.p, 16).map((p) => G.punto(p, v, W, H));
      const prof = (P.get(a).a + P.get(b).a) / 2, k = acceso ? 1 : (sel ? 0.35 : 1);
      const gr = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[16].x, pts[16].y);
      gr.addColorStop(0, alfa(a.col, (0.18 + 0.4 * prof) * k)); gr.addColorStop(0.5, `rgba(200,205,255,${(0.10 + 0.25 * prof) * k})`); gr.addColorStop(1, alfa(b.col, (0.18 + 0.4 * prof) * k));
      ctx.strokeStyle = gr; ctx.lineWidth = acceso ? 1.9 : 1;
      ctx.beginPath(); pts.forEach((q, i) => ctx[i ? "lineTo" : "moveTo"](q.x, q.y)); ctx.stroke();
      if (opz.impulsi !== false && (!sel || acceso)) { // impulso (segnale) lungo l'assone
        const u = (t * 0.00018 + e.fase) % 1, f = u * 16, i0 = Math.floor(f), q0 = pts[i0], q1 = pts[Math.min(16, i0 + 1)], w = f - i0;
        const x = q0.x + (q1.x - q0.x) * w, y = q0.y + (q1.y - q0.y) * w, rr = (acceso ? 4 : 2.6) * q0.s;
        const gi = ctx.createRadialGradient(x, y, 0, x, y, rr * 3); gi.addColorStop(0, `rgba(255,255,255,${0.9 * q0.a})`); gi.addColorStop(0.3, `rgba(150,230,255,${0.5 * q0.a})`); gi.addColorStop(1, "rgba(150,230,255,0)");
        ctx.fillStyle = gi; ctx.beginPath(); ctx.arc(x, y, rr * 3, 0, 7); ctx.fill();
      }
    }
    // neuroni: alone, dendriti, nucleo
    for (const n of [...nodi].sort((x, y) => P.get(x).z - P.get(y).z)) {
      const q = P.get(n), r = n.r * q.s, spento = sel && n !== sel && !vic.has(n), A = q.a * (spento ? 0.3 : 1);
      ctx.globalAlpha = A;
      const gl = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3); gl.addColorStop(0, n.col); gl.addColorStop(0.25, alfa(n.col, 0.32)); gl.addColorStop(1, alfa(n.col, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(q.x, q.y, r * 3, 0, 7); ctx.fill();
      ctx.strokeStyle = alfa(n.col, 0.55); ctx.lineWidth = n.forma === "e" ? 1.1 : 0.7;
      for (const [ang, len, curva] of n.dend) { // dendriti ramificati
        const L = r * (n.forma === "e" ? 2.4 : 1.8) * len, x1 = q.x + Math.cos(ang) * L, y1 = q.y + Math.sin(ang) * L;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(q.x + Math.cos(ang + curva) * L * 0.6, q.y + Math.sin(ang + curva) * L * 0.6, x1, y1); ctx.stroke();
        if (n.forma === "e") { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(ang + 0.6) * L * 0.35, y1 + Math.sin(ang + 0.6) * L * 0.35); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(ang - 0.6) * L * 0.35, y1 + Math.sin(ang - 0.6) * L * 0.35); ctx.stroke(); }
      }
      const battito = n.forma === "e" ? 1 + 0.08 * Math.sin(t * 0.003 + n.g) : 1;
      const nu = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 0.8 * battito); nu.addColorStop(0, "#fff"); nu.addColorStop(0.6, alfa(n.col, 0.95)); nu.addColorStop(1, alfa(n.col, 0));
      ctx.fillStyle = nu; ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.8 * battito, 0, 7); ctx.fill();
      if (n === sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, r * 2.1, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
    if (opz.etichette !== false) {
      const nomiStanze = new Set(nodi.filter((n) => n.tipo === "Stanza").map((n) => n.nome));
      for (const n of nodi) {
        if (n !== sel && n.tipo === "Progetto" && nomiStanze.has(n.nome)) continue;
        const q = P.get(n); if (!(n === sel || (n.forma === "e" && q.z > -0.15))) continue;
        const tx = n.nome.length > 24 ? n.nome.slice(0, 23) + "…" : n.nome;
        ctx.font = (n.forma === "e" ? "600 12px " : "11px ") + "system-ui,sans-serif"; ctx.textAlign = "center"; ctx.globalAlpha = n === sel ? 1 : q.a;
        const w = ctx.measureText(tx).width + 10, y = q.y + n.r * q.s * 1.6 + 2;
        ctx.fillStyle = "rgba(4,5,15,.65)"; ctx.fillRect(q.x - w / 2, y, w, 16); ctx.fillStyle = "#e9ecff"; ctx.fillText(tx, q.x, y + 12); ctx.globalAlpha = 1;
      }
    }
    return P;
  };

  // Immagine quadrata per il widget (PNG in base64, senza prefisso). La rotazione cambia con l'ora, così il widget "vive".
  G.immagineWidget = function (M, stato, lato, quando) {
    const c = document.createElement("canvas"); c.width = c.height = lato; const ctx = c.getContext("2d");
    const rete = G.costruisci(M, stato, false), t = quando || Date.now();
    const raggio = lato * 0.09; ctx.beginPath(); ctx.moveTo(raggio, 0); ctx.arcTo(lato, 0, lato, lato, raggio); ctx.arcTo(lato, lato, 0, lato, raggio); ctx.arcTo(0, lato, 0, 0, raggio); ctx.arcTo(0, 0, lato, 0, raggio); ctx.closePath(); ctx.clip();
    const bg = ctx.createRadialGradient(lato * 0.7, lato * 0.1, 0, lato / 2, lato / 2, lato * 0.8); bg.addColorStop(0, "#1d1550"); bg.addColorStop(0.6, "#070920"); bg.addColorStop(1, "#04050f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, lato, lato);
    const rs = casuale(99); for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rs() * 0.6})`; ctx.fillRect(rs() * lato, rs() * lato, rs() < 0.85 ? 1 : 2, 1); }
    ctx.save(); ctx.translate(0, lato * 0.02); ctx.scale(lato / 360, lato / 360);
    G.disegna(ctx, 360, 360, rete, { vista: { rx: -0.3, ry: (t / 3.6e6) % 6.283, z: 0.82 }, t, etichette: false });
    ctx.restore();
    ctx.fillStyle = "#e9ecff"; ctx.font = `600 ${Math.round(lato * 0.05)}px system-ui,sans-serif`; ctx.textAlign = "left"; ctx.fillText("Second Brain", lato * 0.07, lato * 0.1);
    ctx.fillStyle = "#98a0c8"; ctx.font = `${Math.round(lato * 0.038)}px system-ui,sans-serif`;
    ctx.fillText(rete.nodi.length ? `${rete.nodi.length} nodi · ${rete.E.length} connessioni` : "Nessuna relazione ancora", lato * 0.07, lato * 0.94);
    return c.toDataURL("image/png").split(",")[1];
  };

  radice.SBGlobo = G;
})(typeof window !== "undefined" ? window : globalThis);
