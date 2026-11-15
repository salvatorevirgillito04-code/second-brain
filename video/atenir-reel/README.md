# Reel Atenir

Reel Instagram 1080×1920, 30 fps, 19 s, per Atenir (uncinetto: borse, borsette, berretti, sciarpotti).

- `atenir-reel.mp4` – il video pronto, con colonna sonora originale.
- `audio/musica.py` – genera la colonna sonora (`python3 audio/musica.py audio/colonna.wav`): indie-pop acustico a 96 BPM sintetizzato da zero, nessun diritto di terzi; tagli sul battere, fruscio stereo sulle transizioni, campanelle sul logo.
- `reel.html` – l'animazione. Anteprima nel browser: `reel.html?play` (riproduce) o `reel.html?t=4.5` (un istante).
- `render.mjs` – rigenera il video: `node render.mjs atenir-reel.mp4` (Playwright + ffmpeg, circa 1 minuto).
- `test/` – controlli automatici: `node --test test/` (zone sicure, contrasto, tempi di lettura, lampeggi, formato del file).
- `design/` – token (tavolozza presa dal logo), font Bagel Fat One + Bricolage Grotesque (OFL), guida del brand e storyboard con didascalia, hashtag e consigli sull'audio.
- `assets/grana.png` – grana della carta (generata).
- `assets/logo.png` – logo dell'utente, sfondo reso trasparente (originale in `assets/logo-originale.png`).

Handle confermato: `@atenir`.

Facoltativo:
- `FOTO` in `reel.html`: percorsi delle foto scontornate dei prodotti (con `null` si usano le illustrazioni).

## Direzione grafica (v4)
Moderna e creativa, nello stile del logo disegnato a mano: colori campionati dal logo, contorno bordeaux,
pennellate ad acquerello, raggi arancio e svolazzi, titoli a bolla con ombra da sticker, tratto che vibra
a 10 fps (stile animazione a mano), parola gigante in contorno che scorre sullo sfondo, grana della carta.
Il render è più lento (circa 0,5 s per fotogramma, ~5 minuti) per via dei filtri SVG.
