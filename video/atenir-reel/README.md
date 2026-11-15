# Reel Atenir

Reel Instagram 1080×1920, 30 fps, 19 s, per Atenir (uncinetto: borse, borsette, berretti, sciarpotti).

- `atenir-reel.mp4` – il video pronto (traccia audio muta: la musica si sceglie su Instagram).
- `reel.html` – l'animazione. Anteprima nel browser: `reel.html?play` (riproduce) o `reel.html?t=4.5` (un istante).
- `render.mjs` – rigenera il video: `node render.mjs atenir-reel.mp4` (Playwright + ffmpeg, circa 1 minuto).
- `test/` – controlli automatici: `node --test test/` (zone sicure, contrasto, tempi di lettura, lampeggi, formato del file).
- `design/` – token, font (OFL), guida del brand e storyboard con didascalia, hashtag e consigli sull'audio.
- `assets/logo.png` – logo dell'utente, sfondo reso trasparente (originale in `assets/logo-originale.png`).

Da completare prima di pubblicare:
- `HANDLE` in `reel.html`: `@atenir` è un segnaposto.
- `FOTO` in `reel.html`: percorsi delle foto scontornate dei prodotti (con `null` si usano le illustrazioni).
