// Renderizza reel.html fotogramma per fotogramma e lo codifica in MP4 (H.264, 1080x1920).
// Uso: node render.mjs [uscita.mp4] [--fps 30] [--da 0] [--a <durata>]
// La pagina deve esporre window.DURATA (secondi) e window.vaiA(t) che disegna l'istante t.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // installato globalmente (require lo trova, import no)
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opz = (nome, def) => {
  const i = argv.indexOf(nome);
  return i >= 0 ? Number(argv[i + 1]) : def;
};
const uscita = path.resolve(argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) ?? path.join(qui, 'atenir-reel.mp4'));
const FPS = opz('--fps', 30);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  // Nessuna rete durante il render: tutto deve essere locale.
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto(pathToFileURL(path.join(qui, 'reel.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const durata = await page.evaluate(() => window.DURATA);
  if (!(durata > 0)) throw new Error('window.DURATA mancante');
  const da = opz('--da', 0);
  const a = Math.min(opz('--a', durata), durata);
  const totale = Math.round((a - da) * FPS);

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-f', 'lavfi', '-t', String(totale / FPS), '-i', 'anullsrc=r=44100:cl=stereo',
    '-shortest', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', uscita,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fine = new Promise((ok, ko) => ff.on('close', (c) => (c === 0 ? ok() : ko(new Error('ffmpeg ' + c)))));

  for (let f = 0; f < totale; f++) {
    await page.evaluate((t) => window.vaiA(t), da + f / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`fotogramma ${f}/${totale}\n`);
  }
  ff.stdin.end();
  await fine;
  console.log(`OK ${uscita} (${totale} fotogrammi, ${FPS} fps)`);
} finally {
  await browser.close();
}
