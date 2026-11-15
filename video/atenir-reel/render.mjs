// Renderizza reel.html fotogramma per fotogramma e lo codifica in MP4 (H.264, 1080x1920, BT.709).
// Uso: node render.mjs [uscita.mp4] [--fps 30] [--da 0] [--a <durata>]
// La pagina deve esporre window.DURATA (secondi) e window.vaiA(t) che disegna l'istante t.
// Playwright è installato globalmente nell'ambiente: require() lo trova, un import ESM no.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const qui = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const esci = (msg) => { console.error(msg); process.exit(2); };
const opz = (nome, def) => {
  const i = argv.indexOf(nome);
  if (i < 0) return def;
  const n = Number(argv[i + 1]);
  if (!Number.isFinite(n) || n < 0) esci(`${nome}: valore non valido (${argv[i + 1]})`);
  return n;
};
const posizionali = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const uscita = path.resolve(posizionali[0] ?? path.join(qui, 'atenir-reel.mp4'));
const temporaneo = uscita.replace(/\.mp4$/i, '') + '.tmp.mp4';
const FPS = opz('--fps', 30);
// Musica: traccia Epidemic Sound preparata (licenza dell'utente, non nel repository) se presente,
// altrimenti la colonna sonora originale sintetizzata da audio/musica.py.
const colonnaEpidemic = path.join(qui, 'audio', 'epidemic', 'colonna-epidemic.wav');
const colonna = existsSync(colonnaEpidemic) ? colonnaEpidemic : path.join(qui, 'audio', 'colonna.wav');
if (FPS <= 0) esci('--fps deve essere maggiore di 0');

const browser = await chromium.launch();
let ff;
try {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // Nessuna rete durante il render: tutto deve essere locale.
  await page.route(/^(https?|wss?):/, (r) => r.abort());
  const errori = [];
  page.on('pageerror', (e) => errori.push(e.message));
  await page.goto(pathToFileURL(path.join(qui, 'reel.html')).href);
  await page.evaluate(async () => {
    await Promise.all(['132px "Bagel Fat One"', '600 54px "Bricolage Grotesque"', '700 54px "Bricolage Grotesque"'].map((f) => document.fonts.load(f)));
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
  });
  if (errori.length) throw new Error('Errori nella pagina: ' + errori.join('; '));
  const durata = await page.evaluate(() => window.DURATA);
  if (!(durata > 0)) throw new Error('window.DURATA mancante');
  const da = opz('--da', 0);
  const a = Math.min(opz('--a', durata), durata);
  const totale = Math.round((a - da) * FPS);
  if (totale <= 0) throw new Error(`Intervallo vuoto: --da ${da} --a ${a}`);

  ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    // Colonna sonora originale (audio/musica.py → audio/colonna.wav), tagliata sull'intervallo renderizzato.
    // Se manca, traccia muta: alcune app di montaggio gestiscono meglio i file con audio.
    ...(existsSync(colonna)
      ? ['-ss', String(da), '-t', String(totale / FPS), '-i', colonna]
      : ['-f', 'lavfi', '-t', String(totale / FPS), '-i', 'anullsrc=r=44100:cl=stereo']),
    '-shortest',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-f', 'mp4', temporaneo,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fine = new Promise((ok, ko) => {
    ff.on('error', (e) => ko(new Error('ffmpeg non avviabile: ' + e.message)));
    ff.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg è uscito con codice ' + c))));
  });
  fine.catch(() => {}); // gestito sotto; evita il rifiuto non gestito se il ciclo fallisce prima
  ff.stdin.on('error', () => {}); // EPIPE se ffmpeg esce: l'errore vero arriva da «fine»

  for (let f = 0; f < totale; f++) {
    await page.evaluate((t) => window.vaiA(t), da + f / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await Promise.race([new Promise((r) => ff.stdin.once('drain', r)), fine]);
    if (f % 60 === 0) process.stdout.write(`fotogramma ${f}/${totale}\n`);
  }
  ff.stdin.end();
  await fine;
  renameSync(temporaneo, uscita);
  console.log(`OK ${uscita} (${totale} fotogrammi, ${FPS} fps)`);
} catch (e) {
  if (ff && ff.exitCode === null) { ff.stdin.destroy(); ff.kill(); }
  rmSync(temporaneo, { force: true });
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
