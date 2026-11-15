// Test del reel Atenir (reel.html + atenir-reel.mp4).
// Uso: node --test video/atenir-reel/test/
// Riferimenti: design/storyboard.md §2.1 (zone sicure), §3 (tempi), §8 (accessibilità), §9 (controlli);
// design/brand.md (soglie di contrasto: 4,5:1 corpo, 3:1 da 104 px in su).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright'); // installato globalmente: import diretto non funziona

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..');
const URL_REEL = pathToFileURL(path.join(RADICE, 'reel.html')).href;
const MP4 = path.join(RADICE, 'atenir-reel.mp4');
const FPS = 30;
const AREA = { x0: 64, x1: 1016, y0: 220, y1: 1540 };
const TOLL = 0.5; // px di tolleranza per arrotondamenti subpixel

// Istanti in cui, secondo lo storyboard (§3 e tabelle di scena), i testi sono pienamente visibili.
const ISTANTI_PIENI = [
  1.8, 2.5, // scena 1: tagline piena 1,20–2,75 (1,8 = copertina)
  3.7, 4.9, 6.2, 7.4, 8.7, 9.9, 11.2, 12.4, // scene 2–5: piena T+0,55 → T+2,05
  14.3, 15.0, // scena 6: piena 13,60–15,10
  16.7, 17.6, 18.9, // scena 7: piena da 16,6 alla fine
];

let browser, page, decoder;
const errori = [];
const richiesteRete = [];

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') errori.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errori.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!/^https?:/.test(r.url())) errori.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on('request', (r) => { if (/^(https?|wss?):/.test(r.url())) richiesteRete.push(r.url()); });
  await page.route(/^https?:/, (r) => r.abort()); // nessuna rete, come nel render
  await page.goto(URL_REEL, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.vaiA(0));
  // Pagina vuota usata solo per decodificare i PNG delle schermate (niente dipendenze npm).
  decoder = await browser.newPage();
});

after(async () => { await browser?.close(); });

const vai = (t) => page.evaluate((x) => window.vaiA(x), t);

/** Decodifica un PNG (Buffer) e restituisce le statistiche della luminanza relativa WCAG dei pixel. */
const statLuminanza = (png) => decoder.evaluate(async (b64) => {
  const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const tab = Array.from({ length: 256 }, (_, v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const n = bmp.width * bmp.height;
  let min = Infinity, max = -Infinity, s = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const l = 0.2126 * tab[d[i * 4]] + 0.7152 * tab[d[i * 4 + 1]] + 0.0722 * tab[d[i * 4 + 2]];
    if (l < min) min = l; if (l > max) max = l; s += l; s2 += l * l;
  }
  const media = s / n;
  return { w: bmp.width, h: bmp.height, min, max, media, dev: Math.sqrt(Math.max(0, s2 / n - media * media)) };
}, png.toString('base64'));

/**
 * Stato di ogni `.at-testo` all'istante corrente: opacità effettiva (prodotto con gli antenati), scena visibile,
 * rettangolo dell'elemento e del testo reale, trabocco, colori, copertura da scene superiori o dal nastro del filo.
 */
const leggiTesti = () => page.evaluate(() => {
  const nastro = document.getElementById('filo-wipe');
  const nr = getComputedStyle(nastro).visibility === 'visible' ? nastro.getBoundingClientRect() : null;
  const scene = [...document.querySelectorAll('.at-scena')];
  const trasparente = (c) => c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
  // Parte sinistra [0, X) mostrata da una scena col clip-path «inset(0 Rpx 0 0)»; Infinity se non ritagliata.
  const bordoClip = (s) => {
    const cp = getComputedStyle(s).clipPath;
    if (!cp || cp === 'none') return Infinity;
    const m = cp.match(/inset\(\s*0(?:px)?\s+([\d.]+)px/);
    return m ? 1080 - Number(m[1]) : Infinity;
  };
  return [...document.querySelectorAll('.at-testo')].map((el, i) => {
    const sc = el.closest('.at-scena');
    let op = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
    const r = el.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(el);
    const rr = [...range.getClientRects()].filter((q) => q.width > 0 && q.height > 0);
    const testo = rr.length ? {
      left: Math.min(...rr.map((q) => q.left)), right: Math.max(...rr.map((q) => q.right)),
      top: Math.min(...rr.map((q) => q.top)), bottom: Math.max(...rr.map((q) => q.bottom)),
    } : null;
    let sfondo = null;
    for (let n = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (!trasparente(bg)) { sfondo = bg; break; }
    }
    const k = scene.indexOf(sc);
    const vis = getComputedStyle(sc).visibility === 'visible';
    const area = testo || r;
    const mostrataFinoA = bordoClip(sc);
    const ritagliata = area.right > mostrataFinoA + 0.5;
    const coperta = scene.slice(k + 1).some((s) => getComputedStyle(s).visibility === 'visible' && bordoClip(s) > area.left)
      || (nr && nr.right > area.left && nr.left < area.right);
    const tr = getComputedStyle(el).translate;
    const dy = tr && tr !== 'none' ? Math.abs(parseFloat(tr.split(' ')[1] || '0')) : 0;
    const cs = getComputedStyle(el);
    return {
      i, scena: sc.id, testo: el.textContent.trim().replace(/\s+/g, ' '),
      opacita: op, scenaVisibile: vis, ritagliata, coperta, dy,
      box: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, rettTesto: testo,
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      colore: cs.color, sfondo, fontSize: parseFloat(cs.fontSize),
    };
  });
});

const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
const lumRel = ([r, g, b]) => {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const rapporto = (a, b) => { const [x, y] = [lumRel(a), lumRel(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const visibile = (s) => s.scenaVisibile && s.opacita > 0.5 && !s.coperta && !s.ritagliata;

// ---------------------------------------------------------------- 1
test('1. caricamento senza errori, senza rete, con Fredoka e Nunito caricati', async () => {
  assert.equal(await page.evaluate(() => window.DURATA), 19, 'window.DURATA');
  assert.equal(await page.evaluate(() => typeof window.vaiA), 'function', 'window.vaiA');
  assert.deepEqual(richiesteRete, [], `richieste di rete: ${richiesteRete.join(', ')}`);
  assert.deepEqual(errori, [], `errori nella pagina:\n${errori.join('\n')}`);
  const font = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  for (const fam of ['Fredoka', 'Nunito']) {
    assert.ok(font.includes(fam), `font ${fam} non caricato (caricati: ${font.join(', ') || 'nessuno'})`);
  }
  // I testi usano davvero i font attesi (nessun ripiego silenzioso su system-ui).
  const ok = await page.evaluate(() => [document.fonts.check('600 104px Fredoka'), document.fonts.check('800 54px Nunito')]);
  assert.deepEqual(ok, [true, true], 'document.fonts.check per Fredoka 600 / Nunito 800');
});

// ---------------------------------------------------------------- 2
test('2. il fotogramma 0 non è vuoto', async () => {
  await vai(0);
  const { min, max, dev } = await statLuminanza(await page.screenshot({ type: 'png' }));
  assert.ok(max - min > 0.3, `fotogramma 0 quasi uniforme: luminanza ${min.toFixed(3)}–${max.toFixed(3)}`);
  assert.ok(dev > 0.01, `fotogramma 0 quasi uniforme: deviazione standard ${dev.toFixed(4)}`);
});

// ---------------------------------------------------------------- 3
test('3. testi visibili dentro l\'area sicura e senza trabocco', async () => {
  const difetti = [];
  for (const t of ISTANTI_PIENI) {
    await vai(t);
    const vis = (await leggiTesti()).filter(visibile);
    if (!vis.length) difetti.push(`t=${t} (fotogramma ${Math.round(t * FPS)}): nessun .at-testo visibile`);
    for (const s of vis) {
      const tag = `t=${t} (fotogramma ${Math.round(t * FPS)}) «${s.testo}»`;
      for (const [nome, q] of [['box', s.box], ['testo', s.rettTesto]]) {
        if (!q) continue;
        if (q.left < AREA.x0 - TOLL || q.right > AREA.x1 + TOLL || q.top < AREA.y0 - TOLL || q.bottom > AREA.y1 + TOLL) {
          difetti.push(`${tag}: ${nome} x ${q.left.toFixed(1)}–${q.right.toFixed(1)}, y ${q.top.toFixed(1)}–${q.bottom.toFixed(1)} fuori da x 64–1016, y 220–1540`);
        }
      }
      if (s.scrollWidth > s.clientWidth) difetti.push(`${tag}: trabocca, scrollWidth ${s.scrollWidth} > clientWidth ${s.clientWidth}`);
    }
  }
  assert.deepEqual(difetti, [], difetti.join('\n'));
});

// ---------------------------------------------------------------- 4
test('4. contrasto testo/sfondo: ≥ 4,5:1 corpo, ≥ 3:1 titoli (≥ 104 px)', async () => {
  const difetti = [];
  const visti = new Map();
  for (const t of ISTANTI_PIENI) {
    await vai(t);
    for (const s of (await leggiTesti()).filter(visibile)) {
      if (visti.has(s.i)) continue;
      visti.set(s.i, true);
      if (!s.sfondo) { difetti.push(`«${s.testo}»: nessuno sfondo pieno trovato`); continue; }
      const r = rapporto(rgb(s.colore), rgb(s.sfondo));
      const soglia = s.fontSize >= 104 ? 3 : 4.5;
      if (r < soglia) difetti.push(`t=${t} «${s.testo}» (${s.fontSize}px): ${s.colore} su ${s.sfondo} = ${r.toFixed(2)}:1 < ${soglia}:1`);
    }
  }
  // Tutti i testi del reel devono essere stati controllati almeno una volta.
  const totale = await page.evaluate(() => document.querySelectorAll('.at-testo').length);
  assert.equal(visti.size, totale, `testi controllati ${visti.size} su ${totale}`);
  assert.deepEqual(difetti, [], difetti.join('\n'));
});

// ---------------------------------------------------------------- 5
test('5. ogni testo resta pienamente visibile per almeno 1,5 s (campionato a 30 fps)', async () => {
  const durata = await page.evaluate(() => window.DURATA);
  const n = Math.round(durata * FPS);
  const corsa = new Map(); // i -> { testo, max, da, a, attuale, inizio }
  for (let f = 0; f < n; f++) {
    await vai(f / FPS);
    for (const s of await leggiTesti()) {
      const c = corsa.get(s.i) ?? { testo: s.testo, max: 0, da: -1, a: -1, attuale: 0, inizio: -1 };
      const pieno = s.scenaVisibile && !s.coperta && !s.ritagliata && s.opacita >= 0.995 && s.dy <= 1;
      if (pieno) {
        if (c.attuale === 0) c.inizio = f;
        c.attuale++;
        if (c.attuale > c.max) { c.max = c.attuale; c.da = c.inizio; c.a = f; }
      } else c.attuale = 0;
      corsa.set(s.i, c);
    }
  }
  const difetti = [...corsa.values()]
    .filter((c) => c.max < 1.5 * FPS)
    .map((c) => `«${c.testo}»: pieno solo ${c.max} fotogrammi (${(c.max / FPS).toFixed(3)} s)` +
      (c.max ? `, fotogrammi ${c.da}–${c.a} (t ${(c.da / FPS).toFixed(3)}–${(c.a / FPS).toFixed(3)})` : ''));
  assert.deepEqual(difetti, [], difetti.join('\n'));
});

// ---------------------------------------------------------------- 6
test('6. nessun lampeggio: luminanza media senza più di 3 variazioni ≥ 10% in 1 s', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 0.1 });
  try {
    const p = await ctx.newPage();
    await p.route(/^https?:/, (r) => r.abort());
    await p.goto(URL_REEL, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const n = Math.round((await p.evaluate(() => window.DURATA)) * FPS);
    const L = [];
    for (let f = 0; f < n; f++) {
      await p.evaluate((t) => window.vaiA(t), f / FPS);
      L.push((await statLuminanza(await p.screenshot({ type: 'png' }))).media);
    }
    // Variazioni significative con isteresi: si registra una variazione quando la luminanza si allontana
    // di ≥ SOGLIA dall'ultimo estremo; le oscillazioni piccole (movimenti) non contano.
    const SOGLIA = 0.1;
    const variazioni = []; // { f, da, a }
    let rif = L[0], dir = 0;
    for (let f = 1; f < L.length; f++) {
      const d = L[f] - rif;
      if (dir === 0) {
        if (Math.abs(d) >= SOGLIA) { dir = Math.sign(d); variazioni.push({ f, da: rif, a: L[f] }); rif = L[f]; }
      } else if (Math.sign(d) === dir) { rif = L[f]; variazioni.at(-1).a = L[f]; }
      else if (Math.abs(d) >= SOGLIA) { dir = -dir; variazioni.push({ f, da: rif, a: L[f] }); rif = L[f]; }
    }
    let peggiore = { conta: 0, f: 0 };
    for (const v of variazioni) {
      const conta = variazioni.filter((w) => w.f >= v.f && w.f < v.f + FPS).length;
      if (conta > peggiore.conta) peggiore = { conta, f: v.f };
    }
    const elenco = variazioni.map((v) => `f${v.f} ${v.da.toFixed(3)}→${v.a.toFixed(3)}`).join(', ');
    assert.ok(L.length === n && L.every(Number.isFinite), 'luminanze non calcolate');
    assert.ok(peggiore.conta <= 3,
      `${peggiore.conta} variazioni ≥ ${SOGLIA} in 1 s dal fotogramma ${peggiore.f} (t=${(peggiore.f / FPS).toFixed(2)}). Variazioni: ${elenco}`);
  } finally {
    await ctx.close();
  }
});

// ---------------------------------------------------------------- 7
const haFfprobe = (() => { try { execFileSync('ffprobe', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
test('7. MP4: 1080x1920, 30 fps, 19 s ± 0,05, h264, yuv420p', {
  skip: !existsSync(MP4) ? 'atenir-reel.mp4 assente' : !haFfprobe ? 'ffprobe non disponibile' : false,
}, () => {
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', MP4], { encoding: 'utf8' }));
  const video = info.streams.filter((s) => s.codec_type === 'video');
  assert.equal(video.length, 1, 'un solo flusso video');
  const v = video[0];
  assert.equal(v.codec_name, 'h264');
  assert.equal(v.pix_fmt, 'yuv420p');
  assert.equal(v.width, 1080);
  assert.equal(v.height, 1920);
  const [num, den] = v.avg_frame_rate.split('/').map(Number);
  assert.ok(Math.abs(num / den - 30) < 1e-6, `fps ${v.avg_frame_rate}`);
  const [rn, rd] = v.r_frame_rate.split('/').map(Number);
  assert.ok(Math.abs(rn / rd - 30) < 1e-6, `r_frame_rate ${v.r_frame_rate}`);
  const dv = Number(v.duration ?? info.format.duration);
  assert.ok(Math.abs(dv - 19) <= 0.05, `durata video ${dv} s`);
  const df = Number(info.format.duration);
  assert.ok(Math.abs(df - 19) <= 0.05, `durata contenitore ${df} s`);
});
